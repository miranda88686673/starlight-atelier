/**
 * Camada de sincronização em tempo real via Socket.io.
 * Anexa o Socket.io ao servidor HTTP do Express na porta 3000 e gerencia:
 * - State Sync bidirecional (worldState, playerState, accounts, rooms, aiLogs, DMs)
 * - Heartbeat de Presença (online / away > 3min / offline)
 * - Sincronização de Mídia da Cabine de DJ (video_id, started_at, is_playing)
 * - Auditoria protegida (staff_audit_logs)
 */

import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io';
import type {
  DjMediaSyncPayload,
  RoomMutationPayload,
  StaffAuditLogEntry,
  StateSyncPatchPayload,
} from '../src/core/schemas/dbSchema.ts';
import type {
  PremiumOrder,
  PremiumOrderMessage,
  RoomAvatarPresence,
  RoomChatMessage,
  RoomHealthMetric,
  ServerRegion,
  SupportChatMessage,
  SupportModMessage,
  SupportTicket,
} from '../src/types/game.ts';
import {
  DEFAULT_LOJA_PREMIUM_PIX_KEY,
  serverDb,
} from './database.ts';
import { resolveActorRoleFromServer } from './middleware/roleGuard.ts';

interface SocketClientMeta {
  accountId?: string;
  username?: string;
  roomId?: string;
  roomClientIds?: Set<string>;
}

interface InternalRoomStats {
  wsErrors: number;
  packetDrops: number;
  latencySamples: number[];
  simulatedSpike: boolean;
  lastTerminatedAt?: number;
  lastErrorMessage?: string;
}

const DEFAULT_CORE_ROOMS: Array<{ id: string; name: string }> = [
  { id: 'lounge_party', name: 'Lounge Party (BR)' },
  { id: 'lounge_party_es', name: 'Lounge Party (ES)' },
  { id: 'lounge_party_en', name: 'Lounge Party (EN)' },
];

const roomTelemetryMap = new Map<string, InternalRoomStats>();

function ensureRoomStats(roomId: string): InternalRoomStats {
  let stats = roomTelemetryMap.get(roomId);
  if (!stats) {
    stats = {
      wsErrors: 0,
      packetDrops: 0,
      latencySamples: [28, 32, 30],
      simulatedSpike: false,
    };
    roomTelemetryMap.set(roomId, stats);
  }
  return stats;
}

export function recordRoomWsAnomaly(
  roomId: string,
  kind: 'ws_error' | 'packet_drop',
  message?: string,
): void {
  const stats = ensureRoomStats(roomId);
  if (kind === 'ws_error') {
    stats.wsErrors += 1;
    if (message) stats.lastErrorMessage = message;
  } else {
    stats.packetDrops += 1;
  }
}

export function toggleRoomSpike(roomId: string, active: boolean): RoomHealthMetric[] {
  const stats = ensureRoomStats(roomId);
  stats.simulatedSpike = active;
  if (active) {
    stats.wsErrors = Math.max(stats.wsErrors, 7);
    stats.packetDrops = Math.max(stats.packetDrops, 14);
    stats.latencySamples = [420, 510, 480];
    stats.lastErrorMessage = 'Pico simulado de pacotes WebSocket / desync de frames';
  } else {
    stats.wsErrors = 0;
    stats.packetDrops = 0;
    stats.latencySamples = [26, 31, 29];
    stats.lastErrorMessage = undefined;
  }
  const metrics = computeAllRoomHealthMetrics();
  const map: Record<string, RoomHealthMetric> = {};
  for (const m of metrics) map[m.roomId] = m;
  serverDb.setRoomHealthMap(map);
  return metrics;
}

export function clearRoomTelemetryOnTerminate(roomId: string): RoomHealthMetric[] {
  const stats = ensureRoomStats(roomId);
  stats.wsErrors = 0;
  stats.packetDrops = 0;
  stats.simulatedSpike = false;
  stats.latencySamples = [22, 24, 25];
  stats.lastErrorMessage = undefined;
  stats.lastTerminatedAt = Date.now();
  const metrics = computeAllRoomHealthMetrics();
  const map: Record<string, RoomHealthMetric> = {};
  for (const m of metrics) map[m.roomId] = m;
  serverDb.setRoomHealthMap(map);
  return metrics;
}

export function computeAllRoomHealthMetrics(): RoomHealthMetric[] {
  const snap = serverDb.getSnapshot();
  const now = Date.now();
  const roomEntries = new Map<string, string>();
  for (const r of DEFAULT_CORE_ROOMS) {
    roomEntries.set(r.id, r.name);
  }
  const customRooms = snap.roomsSnapshot?.customRooms ?? [];
  for (const cr of customRooms) {
    if (cr?.id) roomEntries.set(cr.id, cr.name || cr.id);
  }

  const activeByRoom = new Map<string, number>();
  const roomPresences = snap.roomsSnapshot?.presences ?? {};
  for (const pres of Object.values(roomPresences)) {
    if (pres && pres.roomId && now - (pres.lastSeen || 0) < 180_000) {
      activeByRoom.set(pres.roomId, (activeByRoom.get(pres.roomId) || 0) + 1);
    }
  }

  const metrics: RoomHealthMetric[] = [];
  for (const [roomId, roomName] of roomEntries.entries()) {
    const stats = ensureRoomStats(roomId);
    const activePlayers = activeByRoom.get(roomId) || 0;
    const avgLatency =
      stats.latencySamples.length > 0
        ? Math.round(
            stats.latencySamples.reduce((acc, v) => acc + v, 0) /
              stats.latencySamples.length,
          )
        : 28;
    const isCritical =
      stats.simulatedSpike ||
      stats.wsErrors >= 5 ||
      stats.packetDrops >= 10 ||
      avgLatency >= 350;

    metrics.push({
      roomId,
      roomName,
      serverRegion: 'BR',
      status: isCritical ? 'Crítica' : 'Estável',
      activePlayers,
      activeClients: activePlayers,
      latencyMs: avgLatency,
      packetDrops: stats.packetDrops,
      packetDropRate: stats.packetDrops,
      wsErrorsPerMin: stats.wsErrors,
      simulatedSpike: stats.simulatedSpike,
      lastTerminatedAt: stats.lastTerminatedAt,
      lastCheckedAt: now,
    });
  }

  return metrics;
}

export function attachSocketSyncServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  const socketMeta = new Map<string, SocketClientMeta>();

  io.on('connection', (socket: Socket) => {
    // Entrega snapshot inicial sanitizado do banco para o cliente recém-conectado
    socket.emit('state:init', serverDb.getPublicSnapshot());
    socket.emit('room:health_updated', { metrics: computeAllRoomHealthMetrics() });

    socket.on('state:request_init', () => {
      socket.emit('state:init', serverDb.getPublicSnapshot());
    });

    socket.on('state:sync_patch', (patch: StateSyncPatchPayload) => {
      if (!patch || typeof patch !== 'object') return;
      const result = serverDb.applyPatch(patch);
      if (result.changed) {
        const publicSnap = serverDb.getPublicSnapshot();
        const sanitizedPatch = {
          ...patch,
          ...(Array.isArray(patch.accounts) ? { accounts: publicSnap.accounts } : {}),
          updatedAt: result.updatedAt,
          version: publicSnap.version,
        };
        socket.broadcast.emit('state:updated', sanitizedPatch);
        socket.broadcast.emit('state_update', sanitizedPatch);
      }
    });

    // ── MULTIPLAYER EM TEMPO REAL POR SALA (PRESENÇA ATÔMICA, CHAT & MUTAÇÕES) ──
    socket.on(
      'room:presence_upsert',
      (
        payload: { presence?: RoomAvatarPresence } | RoomAvatarPresence,
        cb?: (res: { ok: boolean; presence?: RoomAvatarPresence }) => void,
      ) => {
        const rawPresence =
          payload && 'presence' in payload && payload.presence
            ? payload.presence
            : (payload as RoomAvatarPresence);
        if (!rawPresence || !rawPresence.clientId || !rawPresence.roomId) {
          cb?.({ ok: false });
          return;
        }
        const meta = socketMeta.get(socket.id) ?? {};
        const nextIds = meta.roomClientIds ?? new Set<string>();
        nextIds.add(rawPresence.clientId);
        socketMeta.set(socket.id, {
          ...meta,
          roomId: rawPresence.roomId,
          roomClientIds: nextIds,
        });

        const { presence } = serverDb.upsertRoomPresence(rawPresence);
        socket.broadcast.emit('room:presence_delta', { presence });
        cb?.({ ok: true, presence });
      },
    );

    socket.on(
      'room:presence_leave',
      (
        payload: { clientId?: string },
        cb?: (res: { ok: boolean }) => void,
      ) => {
        const clientId = payload?.clientId;
        if (!clientId) {
          cb?.({ ok: false });
          return;
        }
        const meta = socketMeta.get(socket.id);
        meta?.roomClientIds?.delete(clientId);
        const { removed } = serverDb.removeRoomPresence(clientId);
        if (removed) {
          io.emit('room:presence_removed', { clientId });
        }
        cb?.({ ok: true });
      },
    );

    socket.on(
      'room:chat_send',
      (
        payload: {
          roomId?: string;
          message?: RoomChatMessage;
          senderClientId?: string | null;
        },
        cb?: (res: { ok: boolean; message?: RoomChatMessage }) => void,
      ) => {
        if (!payload?.roomId || !payload?.message?.text) {
          cb?.({ ok: false });
          return;
        }
        const { message } = serverDb.appendRoomChatMessage({
          roomId: payload.roomId,
          message: payload.message,
          senderClientId: payload.senderClientId,
        });
        io.emit('room:chat_broadcast', {
          roomId: payload.roomId,
          message,
          senderClientId: payload.senderClientId ?? null,
        });
        cb?.({ ok: true, message });
      },
    );

    socket.on(
      'room:mutate',
      (
        action: RoomMutationPayload,
        cb?: (res: { ok: boolean; roomsSnapshot?: ReturnType<typeof serverDb.mutateRoomData> }) => void,
      ) => {
        if (!action || !action.type) {
          cb?.({ ok: false });
          return;
        }
        const roomsSnapshot = serverDb.mutateRoomData(action);
        io.emit('room:snapshot_sync', { roomsSnapshot });
        cb?.({ ok: true, roomsSnapshot });
      },
    );

    socket.on(
      'room:pay_employee',
      (
        payload: {
          roomId?: string;
          ownerAccountId?: string;
          employeeUserId?: string;
          amount?: number;
        },
        cb?: (res: Record<string, unknown>) => void,
      ) => {
        if (!payload?.roomId || !payload?.ownerAccountId || !payload?.employeeUserId) {
          cb?.({ ok: false, error: 'Dados incompletos para pagar salário.' });
          return;
        }
        const result = serverDb.payRoomEmployee({
          roomId: payload.roomId,
          ownerAccountId: payload.ownerAccountId,
          employeeUserId: payload.employeeUserId,
          amount: payload.amount,
        });
        if (!result.ok) {
          cb?.(result);
          return;
        }
        const snap = serverDb.getPublicSnapshot();
        io.emit('room:snapshot_sync', { roomsSnapshot: result.roomsSnapshot });
        const ownerPatch = {
          worldState: result.worldState ?? snap.worldState,
          playerPatch: {
            accountId: payload.ownerAccountId,
            progress: result.ownerProgress,
          },
          updatedAt: snap.updatedAt,
          version: snap.version,
        };
        const empAcc = serverDb
          .getSnapshot()
          .accounts.find(
            (a) =>
              a.id === payload.employeeUserId ||
              a.username.toLowerCase() === result.employeeUsername.toLowerCase(),
          );
        io.emit('state:updated', ownerPatch);
        io.emit('state_update', ownerPatch);
        if (empAcc && empAcc.id !== payload.ownerAccountId) {
          const empPatch = {
            worldState: result.worldState ?? snap.worldState,
            playerPatch: {
              accountId: empAcc.id,
              progress: result.employeeProgress,
            },
            updatedAt: snap.updatedAt,
            version: snap.version,
          };
          io.emit('state:updated', empPatch);
          io.emit('state_update', empPatch);
        }
        cb?.({
          ok: true,
          amountPaid: result.amountPaid,
          employeeUsername: result.employeeUsername,
          jobTitle: result.jobTitle,
          ownerProgress: result.ownerProgress,
          roomsSnapshot: result.roomsSnapshot,
        });
      },
    );

    // ── RPC VIA SOCKET.IO PARA TICKETS, LOJA PREMIUM, MERCADO E CANAL SUPORTE↔MOD ──
    socket.on('support:list_tickets', (_payload: unknown, cb?: (res: unknown) => void) => {
      cb?.({ ok: true, tickets: serverDb.getSupportTickets() });
    });

    socket.on(
      'support:create_ticket',
      (
        body: {
          requesterAccountId?: string;
          requesterUsername?: string;
          email?: string;
          category?: SupportTicket['category'];
          serverRegion?: ServerRegion;
          subject?: string;
          messages?: SupportChatMessage[];
        },
        cb?: (res: unknown) => void,
      ) => {
        const requesterUsername = (body?.requesterUsername || 'Visitante')
          .trim()
          .slice(0, 48);
        const subject = (body?.subject || 'Novo Ticket de Suporte').trim().slice(0, 120);
        const now = Date.now();
        const ticket: SupportTicket = {
          id: `tkt_${now}_${Math.random().toString(36).slice(2, 6)}`,
          requesterAccountId: body?.requesterAccountId,
          requesterUsername,
          email: body?.email?.trim().slice(0, 120),
          category: body?.category || 'geral',
          serverRegion: body?.serverRegion || 'BR',
          subject,
          status: 'open',
          messages: Array.isArray(body?.messages) ? body.messages.slice(-50) : [],
          createdAt: now,
          updatedAt: now,
        };
        const tickets = serverDb.upsertSupportTicket(ticket);
        io.emit('support:ticket_updated', { tickets, latest: ticket });
        cb?.({ ok: true, ticket, tickets });
      },
    );

    socket.on(
      'support:reply_ticket',
      (
        body: {
          ticketId?: string;
          text?: string;
          senderName?: string;
          senderRole?: SupportChatMessage['senderRole'];
          actorId?: string;
        },
        cb?: (res: unknown) => void,
      ) => {
        const existing = serverDb.getSupportTickets().find((t) => t.id === body?.ticketId);
        if (!existing) {
          cb?.({ ok: false, error: 'Ticket não encontrado.' });
          return;
        }
        const text = (body?.text || '').trim().slice(0, 800);
        if (!text) {
          cb?.({ ok: false, error: 'Escreva uma mensagem antes de enviar.' });
          return;
        }
        const staffRole = body?.actorId
          ? resolveActorRoleFromServer(body.actorId, body.senderRole)
          : null;
        const isStaffReply = staffRole === 'cm' || staffRole === 'admin';
        const resolvedSenderRole: SupportChatMessage['senderRole'] = isStaffReply
          ? staffRole === 'admin'
            ? 'admin'
            : 'cm'
          : 'player';
        const senderName = (
          body?.senderName ||
          (isStaffReply ? 'Community Manager' : existing.requesterUsername)
        )
          .trim()
          .slice(0, 48);
        const now = Date.now();
        const nextMessage: SupportChatMessage = {
          id: `tmsg_${now}_${Math.random().toString(36).slice(2, 5)}`,
          senderRole: resolvedSenderRole,
          sender: isStaffReply ? 'staff' : 'user',
          senderName,
          text,
          createdAt: now,
        };
        const updated: SupportTicket = {
          ...existing,
          status:
            existing.status === 'resolved'
              ? isStaffReply
                ? 'resolved'
                : 'open'
              : isStaffReply
                ? 'answered'
                : 'open',
          assignedCmUsername: isStaffReply ? senderName : existing.assignedCmUsername,
          messages: [...existing.messages, nextMessage].slice(-80),
          updatedAt: now,
        };
        const tickets = serverDb.upsertSupportTicket(updated);
        io.emit('support:ticket_updated', { tickets, latest: updated });
        cb?.({ ok: true, ticket: updated, tickets });
      },
    );

    socket.on('premium:get_pix', (_payload: unknown, cb?: (res: unknown) => void) => {
      cb?.({ ok: true, config: serverDb.getPremiumPixConfig() });
    });

    socket.on('premium:list_orders', (_payload: unknown, cb?: (res: unknown) => void) => {
      cb?.({ ok: true, orders: serverDb.getPremiumOrders() });
    });

    socket.on(
      'premium:create_order',
      (
        body: {
          requesterAccountId?: string;
          requesterUsername?: string;
          requesterDisplayName?: string;
          packId?: string;
          packTitle?: string;
          priceLabel?: string;
          orderType?: PremiumOrder['orderType'];
          amAmount?: number;
          bonusAmAmount?: number;
          receiptImageUrl?: string;
          initialMessage?: string;
        },
        cb?: (res: unknown) => void,
      ) => {
        if (!body?.requesterAccountId || !body?.requesterUsername || !body?.packId) {
          cb?.({
            ok: false,
            error: 'Dados da conta e pacote são obrigatórios para registrar o pedido.',
          });
          return;
        }
        const now = Date.now();
        const currentPix = serverDb.getPremiumPixConfig().pixKey || DEFAULT_LOJA_PREMIUM_PIX_KEY;
        const msgText = (body.initialMessage || '').trim();
        const messages: PremiumOrderMessage[] = [];
        if (msgText || body.receiptImageUrl) {
          messages.push({
            id: `pmsg_${now}_${Math.random().toString(36).slice(2, 5)}`,
            senderRole: 'player',
            senderName: body.requesterDisplayName || body.requesterUsername,
            text:
              msgText ||
              `Comprovante PIX anexado para o pacote "${body.packTitle || body.packId}".`,
            attachmentImageUrl: body.receiptImageUrl,
            createdAt: now,
          });
        }
        const order: PremiumOrder = {
          id: `prem_${now}_${Math.random().toString(36).slice(2, 6)}`,
          requesterAccountId: body.requesterAccountId,
          requesterUsername: body.requesterUsername.trim(),
          requesterDisplayName: body.requesterDisplayName?.trim(),
          packId: body.packId,
          packTitle: (body.packTitle || 'Pacote Loja Premium').slice(0, 90),
          priceLabel: (body.priceLabel || 'PIX').slice(0, 40),
          orderType: body.orderType === 'vip' ? 'vip' : 'am_pack',
          amAmount: Math.max(0, Math.round(Number(body.amAmount || 0))),
          bonusAmAmount: Math.max(0, Math.round(Number(body.bonusAmAmount || 0))),
          pixKeyUsed: currentPix,
          receiptImageUrl: body.receiptImageUrl,
          messages,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        };
        const orders = serverDb.upsertPremiumOrder(order);
        io.emit('premium:orders_updated', { orders, latest: order });
        cb?.({ ok: true, order, orders });
      },
    );

    socket.on(
      'premium:message_order',
      (
        body: {
          orderId?: string;
          text?: string;
          attachmentImageUrl?: string;
          senderName?: string;
          actorId?: string;
        },
        cb?: (res: unknown) => void,
      ) => {
        const existing = serverDb.getPremiumOrders().find((o) => o.id === body?.orderId);
        if (!existing) {
          cb?.({ ok: false, error: 'Pedido não encontrado.' });
          return;
        }
        const text = (body?.text || '').trim().slice(0, 800);
        if (!text && !body?.attachmentImageUrl) {
          cb?.({ ok: false, error: 'Informe uma mensagem ou anexe o comprovante.' });
          return;
        }
        const staffRole = body?.actorId
          ? resolveActorRoleFromServer(body.actorId)
          : null;
        const isStaff = staffRole === 'cm' || staffRole === 'admin';
        const senderRole: PremiumOrderMessage['senderRole'] = isStaff
          ? staffRole === 'admin'
            ? 'admin'
            : 'cm'
          : 'player';
        const now = Date.now();
        const nextMsg: PremiumOrderMessage = {
          id: `pmsg_${now}_${Math.random().toString(36).slice(2, 5)}`,
          senderRole,
          senderName: (
            body?.senderName ||
            (isStaff ? 'Community Manager' : existing.requesterDisplayName || existing.requesterUsername)
          )
            .trim()
            .slice(0, 48),
          text: text || 'Comprovante atualizado.',
          attachmentImageUrl: body?.attachmentImageUrl,
          createdAt: now,
        };
        const updated: PremiumOrder = {
          ...existing,
          receiptImageUrl: body?.attachmentImageUrl || existing.receiptImageUrl,
          messages: [...existing.messages, nextMsg].slice(-60),
          updatedAt: now,
        };
        const orders = serverDb.upsertPremiumOrder(updated);
        io.emit('premium:orders_updated', { orders, latest: updated });
        cb?.({ ok: true, order: updated, orders });
      },
    );

    socket.on('market:list_listings', (_payload: unknown, cb?: (res: unknown) => void) => {
      cb?.({ ok: true, listings: serverDb.getMarketListings() });
    });

    socket.on(
      'market:create_listing',
      (
        body: { sellerAccountId?: string; itemId?: string; price?: number },
        cb?: (res: unknown) => void,
      ) => {
        const result = serverDb.createMarketListing({
          sellerAccountId: body?.sellerAccountId || '',
          itemId: body?.itemId || '',
          price: Number(body?.price),
        });
        if (!result.ok) {
          cb?.({ ok: false, error: result.error });
          return;
        }
        io.emit('market:updated', { listings: result.listings });
        cb?.({ ok: true, listing: result.listing, listings: result.listings });
      },
    );

    socket.on(
      'market:buy_listing',
      (
        body: { listingId?: string; buyerAccountId?: string },
        cb?: (res: unknown) => void,
      ) => {
        const result = serverDb.buyMarketListing({
          listingId: body?.listingId || '',
          buyerAccountId: body?.buyerAccountId || '',
        });
        if (!result.ok) {
          cb?.({ ok: false, error: result.error });
          return;
        }
        const snap = serverDb.getPublicSnapshot();
        io.emit('market:updated', { listings: result.listings });
        const buyerPatch = {
          worldState: snap.worldState,
          playerPatch: { accountId: body?.buyerAccountId || '', progress: result.buyerProgress },
          updatedAt: snap.updatedAt,
          version: snap.version,
        };
        const sellerPatch = {
          worldState: snap.worldState,
          playerPatch: {
            accountId: result.listing.sellerAccountId,
            progress: result.sellerProgress,
          },
          updatedAt: snap.updatedAt,
          version: snap.version,
        };
        io.emit('state:updated', buyerPatch);
        io.emit('state_update', buyerPatch);
        io.emit('state:updated', sellerPatch);
        io.emit('state_update', sellerPatch);
        cb?.({
          ok: true,
          listing: result.listing,
          listings: result.listings,
          buyerProgress: result.buyerProgress,
        });
      },
    );

    socket.on(
      'market:cancel_listing',
      (
        body: { listingId?: string; actorAccountId?: string },
        cb?: (res: unknown) => void,
      ) => {
        const staffRole = body?.actorAccountId
          ? resolveActorRoleFromServer(body.actorAccountId)
          : null;
        const result = serverDb.cancelMarketListing({
          listingId: body?.listingId || '',
          actorAccountId: body?.actorAccountId || '',
          isAdmin: staffRole === 'admin',
        });
        if (!result.ok) {
          cb?.({ ok: false, error: result.error });
          return;
        }
        io.emit('market:updated', { listings: result.listings });
        cb?.({ ok: true, listing: result.listing, listings: result.listings });
      },
    );

    socket.on('support_mod:list_messages', (_payload: unknown, cb?: (res: unknown) => void) => {
      cb?.({ ok: true, messages: serverDb.getSupportModMessages() });
    });

    socket.on(
      'support_mod:send_message',
      (
        body: {
          senderAccountId?: string;
          senderUsername?: string;
          text?: string;
        },
        cb?: (res: unknown) => void,
      ) => {
        const text = (body?.text || '').trim().slice(0, 600);
        if (!text || !body?.senderAccountId) {
          cb?.({ ok: false, error: 'Escreva uma mensagem válida.' });
          return;
        }
        const acc = serverDb.findAccountById(body.senderAccountId);
        const staffRole = resolveActorRoleFromServer(body.senderAccountId, undefined, acc?.email);
        const snap = serverDb.getSnapshot();
        const normUname = (acc?.username || body.senderUsername || '').trim().toLowerCase();
        const isOfficialSupport = Object.values(snap.roomsSnapshot?.officialOverrides ?? {}).some(
          (ov) =>
            Array.isArray(ov?.supportStaff) &&
            ov.supportStaff.some((u) => u.trim().toLowerCase() === normUname),
        );
        if (!staffRole && !isOfficialSupport) {
          cb?.({
            ok: false,
            error: 'Apenas equipe de Suporte Oficial, Moderadores ou Administrador podem enviar mensagens aqui.',
          });
          return;
        }
        const roleLabel =
          staffRole === 'admin'
            ? 'Administrador'
            : staffRole === 'moderator'
              ? 'Moderador'
              : staffRole === 'cm'
                ? 'Community Manager'
                : 'Suporte Oficial';
        const msg: SupportModMessage = {
          id: `supmod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          senderAccountId: body.senderAccountId,
          senderUsername: acc?.username || body.senderUsername || 'Equipe',
          senderRoleLabel: roleLabel,
          isSupport: isOfficialSupport && !staffRole,
          text,
          createdAt: Date.now(),
        };
        const messages = serverDb.appendSupportModMessage(msg);
        io.emit('support_mod:updated', { messages, latest: msg });
        cb?.({ ok: true, messages, latest: msg });
      },
    );

    socket.on(
      'room:telemetry_ping',
      (payload: { roomId?: string; latencyMs?: number; packetDrop?: boolean }) => {
        if (!payload?.roomId) return;
        const meta = socketMeta.get(socket.id) ?? {};
        socketMeta.set(socket.id, { ...meta, roomId: payload.roomId });
        const stats = ensureRoomStats(payload.roomId);
        if (typeof payload.latencyMs === 'number' && Number.isFinite(payload.latencyMs)) {
          stats.latencySamples = [
            ...stats.latencySamples.slice(-7),
            Math.max(5, Math.min(2000, Math.round(payload.latencyMs))),
          ];
        }
        if (payload.packetDrop) {
          stats.packetDrops += 1;
        }
      },
    );

    socket.on('error', (err) => {
      const meta = socketMeta.get(socket.id);
      if (meta?.roomId) {
        recordRoomWsAnomaly(meta.roomId, 'ws_error', err?.message || 'Socket error');
      }
    });

    socket.on('user:update_profile_pic', (payload: { actorId: string; targetUid: string; profilePic: string }) => {
      if (!payload?.actorId || !payload?.targetUid || typeof payload.profilePic !== 'string') return;
      const actor = serverDb.findAccountById(payload.actorId);
      if (!actor) return;
      const isOwner = actor.id === payload.targetUid;
      const isAdminGeneral = actor.isPrimaryOwner || actor.email === 'miranda88686673@gmail.com' || (actor.role === 'admin' && actor.staffRoleTier === 'admin');
      if (!isOwner && !isAdminGeneral) {
        socket.emit('error', { message: 'Permissão negada para alterar foto de perfil de outro usuário.' });
        return;
      }
      const changed = serverDb.updateUserProfilePic(payload.targetUid, payload.profilePic);
      if (changed) {
        const publicSnap = serverDb.getPublicSnapshot();
        const syncPayload = {
          accounts: publicSnap.accounts,
          updatedAt: publicSnap.updatedAt,
          version: publicSnap.version,
        };
        io.emit('state:updated', syncPayload);
        io.emit('state_update', syncPayload);
      }
    });

    socket.on(
      'presence:heartbeat',
      (payload: {
        accountId?: string;
        username?: string;
        displayName?: string;
        lastInteractionAt?: number;
        manualOffline?: boolean;
        serverRegion?: 'BR' | 'ES' | 'EN';
      }) => {
        if (!payload?.accountId || !payload?.username) return;

        const prevMeta = socketMeta.get(socket.id) ?? {};
        socketMeta.set(socket.id, {
          ...prevMeta,
          accountId: payload.accountId,
          username: payload.username,
        });

        const record = serverDb.updatePresenceHeartbeat({
          accountId: payload.accountId,
          username: payload.username,
          displayName: payload.displayName,
          lastInteractionAt: payload.lastInteractionAt ?? Date.now(),
          socketConnected: true,
          manualOffline: Boolean(payload.manualOffline),
          serverRegion: payload.serverRegion,
        });

        io.emit('presence:updated', {
          presences: serverDb.getSnapshot().presences,
          changedRecord: record,
        });
      },
    );

    socket.on('media:dj_sync', (payload: DjMediaSyncPayload | { roomId: string; stop: true }) => {
      if (!payload || !payload.roomId) return;

      if ('stop' in payload && payload.stop) {
        serverDb.applyPatch({
          djTrackUpdate: { roomId: payload.roomId, track: null },
        });
        io.emit('media:dj_synced', { roomId: payload.roomId, track: null });
        return;
      }

      const media = payload as DjMediaSyncPayload;
      const track = {
        videoId: media.video_id,
        youtubeUrl:
          media.youtubeUrl || `https://www.youtube.com/watch?v=${media.video_id}`,
        title: media.title || `Faixa ${media.video_id}`,
        addedBy: media.addedBy || 'DJ',
        startedAt: media.started_at || Date.now(),
        isPlaying: Boolean(media.is_playing),
        queue: Array.isArray(media.queue) ? media.queue : undefined,
      };

      serverDb.applyPatch({
        djTrackUpdate: { roomId: media.roomId, track },
      });
      io.emit('media:dj_synced', { roomId: media.roomId, track });
    });

    socket.on('audit:staff_action', (entry: StaffAuditLogEntry) => {
      if (!entry || !entry.actor_id || !entry.action_type) return;
      const verifiedRole = resolveActorRoleFromServer(entry.actor_id, entry.role);
      if (!verifiedRole) {
        socket.emit('audit:rejected', {
          reason: 'RoleGuard rejeitou registro sem permissão de Staff.',
        });
        return;
      }
      const verifiedEntry: StaffAuditLogEntry = {
        ...entry,
        role: verifiedRole,
        timestamp: entry.timestamp || Date.now(),
      };
      const logs = serverDb.appendStaffAuditLog(verifiedEntry);
      io.emit('audit:updated', { logs: logs.slice(0, 100), latest: verifiedEntry });
    });

    socket.on('disconnect', () => {
      const meta = socketMeta.get(socket.id);
      socketMeta.delete(socket.id);

      if (meta?.roomClientIds && meta.roomClientIds.size > 0) {
        for (const cid of meta.roomClientIds) {
          const { removed } = serverDb.removeRoomPresence(cid);
          if (removed) {
            io.emit('room:presence_removed', { clientId: cid });
          }
        }
      }

      if (meta?.accountId) {
        // Verifica se não há outra aba/socket aberto para o mesmo accountId
        const hasAnotherSocket = Array.from(socketMeta.values()).some(
          (m) => m.accountId === meta.accountId,
        );
        if (!hasAnotherSocket) {
          const updated = serverDb.markSocketDisconnected(meta.accountId);
          if (updated) {
            io.emit('presence:updated', {
              presences: serverDb.getSnapshot().presences,
              changedRecord: updated,
            });
          }
        }
      }
    });
  });

  // Varredura contínua do servidor para marcar usuários inativos há > 3 minutos como `away`
  // e atualizar a telemetria em tempo real das salas
  const presenceSweeper = setInterval(() => {
    const changed = serverDb.sweepStalePresences();
    if (changed) {
      io.emit('presence:updated', {
        presences: serverDb.getSnapshot().presences,
      });
    }
    const metrics = computeAllRoomHealthMetrics();
    const map: Record<string, RoomHealthMetric> = {};
    for (const m of metrics) map[m.roomId] = m;
    serverDb.setRoomHealthMap(map);
    io.emit('room:health_updated', { metrics });
  }, 15_000);
  presenceSweeper.unref();

  return io;
}
