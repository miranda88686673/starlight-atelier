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
  StaffAuditLogEntry,
  StateSyncPatchPayload,
} from '../src/core/schemas/dbSchema.ts';
import type { RoomHealthMetric } from '../src/types/game.ts';
import { serverDb } from './database.ts';
import { resolveActorRoleFromServer } from './middleware/roleGuard.ts';

interface SocketClientMeta {
  accountId?: string;
  username?: string;
  roomId?: string;
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
  { id: 'lounge_principal', name: 'Lounge Principal' },
  { id: 'central_staff', name: 'Central da Staff · Mesas de Trabalho' },
  { id: 'cafe_atelier', name: 'Café Atelier Paris' },
  { id: 'passarela_vip', name: 'Passarela VIP Diamante' },
  { id: 'club_starlight', name: 'Boate Neon Starlight' },
  { id: 'cobertura_sunset', name: 'Cobertura Sunset Terrace' },
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
