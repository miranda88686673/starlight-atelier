import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  StaffAuditLogEntry,
  StateSyncPatchPayload,
} from './src/core/schemas/dbSchema.ts';
import type {
  BanReviewRequest,
  PremiumOrder,
  PremiumOrderMessage,
  ServerRegion,
  SupportChatMessage,
  SupportModMessage,
  SupportTicket,
} from './src/types/game.ts';
import {
  DEFAULT_LOJA_PREMIUM_PIX_KEY,
  serverDb,
} from './server/database.ts';
import { sendRecoveryEmailIfConfigured } from './server/auth.ts';
import {
  requireStaffRole,
  resolveActorRoleFromServer,
} from './server/middleware/roleGuard.ts';
import type { StaffGuardContext } from './server/middleware/roleGuard.ts';
import {
  attachSocketSyncServer,
  clearRoomTelemetryOnTerminate,
  computeAllRoomHealthMetrics,
  toggleRoomSpike,
} from './server/socketSync.ts';

const ADMIN_OWNER_EMAIL = 'miranda88686673@gmail.com';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_CLOTHING_CATEGORIES = [
  'cabelo',
  'blusas',
  'casacos',
  'vestidos',
  'calcas',
  'sapatos',
  'acessorios',
] as const;

const ALLOWED_FURNITURE_CATEGORIES = ['Assentos', 'Superfícies', 'Decoração'] as const;

const ALLOWED_FURNITURE_TEMPLATES = [
  'tpl_sofa',
  'tpl_mesa',
  'tpl_decoracao',
  'tpl_dj',
  'tpl_pista',
  'tpl_bar',
  'tpl_banqueta',
  'tpl_cama',
  'tpl_cozinha',
  'tpl_banheira',
  'tpl_lustre',
] as const;

const ALLOWED_PATTERNS = [
  'solid',
  'striped',
  'plaid',
  'floral',
  'sequin',
  'denim',
  'neon',
] as const;

const ALLOWED_GENDERS = ['feminino', 'masculino', 'unissex'] as const;

const ALLOWED_THEME_TAGS = ['geral', 'boate', 'casa', 'bar', 'hotel'] as const;

function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim().toUpperCase();
  }
  return fallback;
}

function pickAllowed<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  return fallback;
}

function extractBase64Payload(raw: string, fallbackMime = 'image/jpeg') {
  const trimmed = raw.trim();
  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/s.exec(trimmed);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1] || fallbackMime,
      data: dataUrlMatch[2],
    };
  }
  return {
    mimeType: fallbackMime,
    data: trimmed,
  };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = attachSocketSyncServer(httpServer);
  const port = Number(process.env.PORT || 3000);
  const isProduction = process.env.NODE_ENV === 'production';

  app.use((req: Request, res: Response, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,x-actor-id,x-staff-role,x-actor-email',
    );
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '16mb' }));
  app.use(express.text({ type: 'text/plain', limit: '64kb' }));

  app.use(
    (
      err: { status?: number; type?: string; message?: string } | null,
      _req: Request,
      res: Response,
      next: (err?: unknown) => void,
    ) => {
      if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
        res.status(err.status || 400).json({
          ok: false,
          error:
            err.type === 'entity.too.large'
              ? 'Arquivo ou imagem excedeu o limite máximo permitido.'
              : 'Formato de dados inválido enviado ao servidor.',
        });
        return;
      }
      next(err);
    },
  );

  app.get('/api/health', (_req: Request, res: Response) => {
    const snap = serverDb.getPublicSnapshot();
    res.json({
      ok: true,
      service: 'starlight-atelier',
      dbVersion: snap.version,
      connectedPresences: Object.keys(snap.presences).length,
    });
  });

  app.get('/api/state/snapshot', (_req: Request, res: Response) => {
    res.json({ ok: true, snapshot: serverDb.getPublicSnapshot() });
  });

  app.post('/api/state/sync', (req: Request, res: Response) => {
    const patch = (req.body ?? {}) as StateSyncPatchPayload;
    const result = serverDb.applyPatch(patch);
    if (result.changed) {
      const publicSnap = serverDb.getPublicSnapshot();
      const sanitizedPatch = {
        ...patch,
        ...(Array.isArray(patch.accounts) ? { accounts: publicSnap.accounts } : {}),
        updatedAt: result.updatedAt,
        version: publicSnap.version,
      };
      io.emit('state:updated', sanitizedPatch);
      io.emit('state_update', sanitizedPatch);
    }
    res.json({ ok: true, changed: result.changed, updatedAt: result.updatedAt });
  });

  app.get('/api/presence', (_req: Request, res: Response) => {
    res.json({ ok: true, presences: serverDb.getPublicSnapshot().presences });
  });

  app.post('/api/presence/offline', (req: Request, res: Response) => {
    let payload: { accountId?: string } = {};
    if (typeof req.body === 'string') {
      try {
        payload = JSON.parse(req.body) as { accountId?: string };
      } catch {
        payload = {};
      }
    } else if (req.body && typeof req.body === 'object') {
      payload = req.body as { accountId?: string };
    }
    if (payload.accountId) {
      const updated = serverDb.markSocketDisconnected(payload.accountId);
      if (updated) {
        io.emit('presence:updated', {
          presences: serverDb.getPublicSnapshot().presences,
          changedRecord: updated,
        });
      }
    }
    res.json({ ok: true });
  });

  // ── AUTENTICAÇÃO CENTRALIZADA, CADASTRO E RECUPERAÇÃO DE CONTA ──
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      username?: string;
      displayName?: string;
      email?: string;
      password?: string;
      avatarGender?: 'feminino' | 'masculino' | 'neutro';
      serverRegion?: 'BR' | 'ES' | 'EN';
    };
    const result = serverDb.registerAccountServer({
      username: body.username || '',
      displayName: body.displayName,
      email: body.email || '',
      password: body.password || '',
      avatarGender: body.avatarGender || 'feminino',
      serverRegion: body.serverRegion || 'BR',
    });

    if (!result.ok) {
      res.status(400).json(result);
      return;
    }

    const publicSnap = serverDb.getPublicSnapshot();
    const syncPayload = {
      accounts: publicSnap.accounts,
      worldState: publicSnap.worldState,
      playerPatch: {
        accountId: result.account.id,
        progress: result.progress,
      },
      updatedAt: publicSnap.updatedAt,
      version: publicSnap.version,
    };
    io.emit('state:updated', syncPayload);
    io.emit('state_update', syncPayload);

    res.json({
      ok: true,
      account: result.account,
      progress: result.progress,
      accounts: publicSnap.accounts,
      worldState: publicSnap.worldState,
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      identifier?: string;
      password?: string;
    };
    const result = serverDb.authenticateHybrid(body.identifier || '', body.password || '');
    if (!result.ok) {
      res.status(401).json(result);
      return;
    }

    const record = serverDb.updatePresenceHeartbeat({
      accountId: result.account.id,
      username: result.account.username,
      displayName: result.account.displayName,
      lastInteractionAt: Date.now(),
      socketConnected: true,
      manualOffline: false,
      serverRegion: result.account.serverRegion,
    });

    const publicSnap = serverDb.getPublicSnapshot();
    const syncPayload = {
      worldState: publicSnap.worldState,
      playerPatch: {
        accountId: result.account.id,
        progress: result.progress,
      },
      updatedAt: publicSnap.updatedAt,
      version: publicSnap.version,
    };
    io.emit('state:updated', syncPayload);
    io.emit('state_update', syncPayload);
    io.emit('presence:updated', {
      presences: publicSnap.presences,
      changedRecord: record,
    });

    res.json({
      ok: true,
      account: result.account,
      progress: result.progress,
      loginXpAward: result.loginXpAward,
      accounts: publicSnap.accounts,
      worldState: publicSnap.worldState,
    });
  });

  app.post('/api/auth/firebase-google', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      firebaseUid?: string;
      email?: string;
      displayName?: string;
      avatarGender?: 'feminino' | 'masculino' | 'neutro';
      serverRegion?: 'BR' | 'ES' | 'EN';
    };
    if (!body.firebaseUid || !body.email) {
      res.status(400).json({ ok: false, error: 'Dados da conta Google inválidos.' });
      return;
    }
    const result = serverDb.authenticateOrRegisterGoogleUser({
      firebaseUid: body.firebaseUid,
      email: body.email,
      displayName: body.displayName,
      avatarGender: body.avatarGender,
      serverRegion: body.serverRegion,
    });
    if (!result.ok) {
      res.status(401).json(result);
      return;
    }

    const record = serverDb.updatePresenceHeartbeat({
      accountId: result.account.id,
      username: result.account.username,
      displayName: result.account.displayName,
      lastInteractionAt: Date.now(),
      socketConnected: true,
      manualOffline: false,
      serverRegion: result.account.serverRegion,
    });

    const publicSnap = serverDb.getPublicSnapshot();
    const syncPayload = {
      accounts: publicSnap.accounts,
      worldState: publicSnap.worldState,
      playerPatch: {
        accountId: result.account.id,
        progress: result.progress,
      },
      updatedAt: publicSnap.updatedAt,
      version: publicSnap.version,
    };
    io.emit('state:updated', syncPayload);
    io.emit('state_update', syncPayload);
    io.emit('presence:updated', {
      presences: publicSnap.presences,
      changedRecord: record,
    });

    res.json({
      ok: true,
      account: result.account,
      progress: result.progress,
      loginXpAward: result.loginXpAward,
      accounts: publicSnap.accounts,
      worldState: publicSnap.worldState,
    });
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { email?: string };
    const created = serverDb.createPasswordResetToken(body.email || '');
    if (!created.ok) {
      res.status(404).json(created);
      return;
    }

    const delivery = await sendRecoveryEmailIfConfigured({
      toEmail: created.record.email,
      username: created.account.username,
      token: created.record.token,
    });

    res.json({
      ok: true,
      deliveredByEmail: delivery.deliveredByEmail,
      provider: delivery.provider,
      ...(delivery.provider === 'local_dispatch' ? { previewToken: created.record.token } : {}),
    });
  });

  app.post('/api/auth/reset-password', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      email?: string;
      token?: string;
      newPassword?: string;
    };
    const result = serverDb.resetPasswordWithToken({
      email: body.email || '',
      token: body.token || '',
      newPassword: body.newPassword || '',
    });
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }

    const publicSnap = serverDb.getPublicSnapshot();
    const syncPayload = {
      accounts: publicSnap.accounts,
      updatedAt: publicSnap.updatedAt,
      version: publicSnap.version,
    };
    io.emit('state:updated', syncPayload);
    io.emit('state_update', syncPayload);
    res.json({ ok: true });
  });

  app.get(
    '/api/staff/audit-logs',
    requireStaffRole(['admin', 'cm', 'moderator', 'designer']),
    (_req: Request, res: Response) => {
      res.json({ ok: true, logs: serverDb.getStaffAuditLogs(150) });
    },
  );

  app.post(
    '/api/staff/audit-logs',
    requireStaffRole(['admin', 'cm', 'moderator', 'designer']),
    (req: Request, res: Response) => {
      const staffCtx = (req as Request & { staffContext?: StaffGuardContext })
        .staffContext;
      const body = (req.body ?? {}) as Partial<StaffAuditLogEntry>;

      if (!body.action_type || !body.target_id) {
        res.status(400).json({
          ok: false,
          error: 'Campos action_type e target_id são obrigatórios para auditoria.',
        });
        return;
      }

      const entry: StaffAuditLogEntry = {
        id:
          body.id ||
          `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: typeof body.timestamp === 'number' ? body.timestamp : Date.now(),
        actor_id: staffCtx?.actorId || body.actor_id || 'unknown_staff',
        actor_username: body.actor_username,
        role: staffCtx?.role || body.role || 'moderator',
        action_type: String(body.action_type).slice(0, 64),
        target_id: String(body.target_id).slice(0, 80),
        details: String(body.details || '').slice(0, 320),
      };

      const logs = serverDb.appendStaffAuditLog(entry);
      io.emit('audit:updated', { logs: logs.slice(0, 100), latest: entry });
      res.json({ ok: true, entry });
    },
  );

      // ── ADMIN: SAÚDE DE SALAS, KILL-SWITCH & AUTO PATCH ──
      app.get('/api/rooms/health', (_req: Request, res: Response) => {
        res.json({ ok: true, metrics: computeAllRoomHealthMetrics() });
      });

      app.post(
        '/api/rooms/simulate-spike',
        requireStaffRole(['admin']),
        (req: Request, res: Response) => {
          const { roomId, active } = (req.body ?? {}) as {
            roomId?: string;
            active?: boolean;
          };
          if (!roomId) {
            res.status(400).json({ ok: false, error: 'Informe roomId.' });
            return;
          }
          const metrics = toggleRoomSpike(roomId, active !== false);
          io.emit('room:health_updated', { metrics });
          res.json({ ok: true, metrics });
        },
      );

      app.post(
        '/api/rooms/terminate',
        requireStaffRole(['admin']),
        (req: Request, res: Response) => {
          const staffCtx = (req as Request & { staffContext?: StaffGuardContext })
            .staffContext;
          const body = (req.body ?? {}) as {
            roomId?: string;
            reason?: string;
            actorUsername?: string;
          };
          const roomId = (body.roomId || '').trim();
          if (!roomId || roomId === 'lounge_party') {
            res.status(400).json({
              ok: false,
              error:
                'Informe uma sala válida diferente da Lounge Party Oficial (zona segura de evacuação).',
            });
            return;
          }

          const actorAccount = staffCtx?.actorId
            ? serverDb.findAccountById(staffCtx.actorId)
            : undefined;
          const actorUsername =
            body.actorUsername ||
            actorAccount?.displayName ||
            actorAccount?.username ||
            'Administrador Geral';
          const reason =
            (body.reason || '').trim() || 'Instabilidade de WebSocket / dessincronização';

          const result = serverDb.terminateRoomInstance({
            roomId,
            actorId: staffCtx?.actorId || 'system_admin',
            actorUsername,
            actorRole: 'admin',
            reason,
          });

          const metrics = clearRoomTelemetryOnTerminate(roomId);
          const snap = serverDb.getPublicSnapshot();

          io.emit('room:terminated', {
            roomId,
            fallbackRoomId: 'lounge_party',
            evacuatedCount: result.evacuatedCount,
            reason,
            terminatedBy: actorUsername,
          });
          io.emit('room:health_updated', { metrics });
          const terminatePayload = {
            roomsSnapshot: snap.roomsSnapshot,
            worldState: snap.worldState,
            updatedAt: snap.updatedAt,
            version: snap.version,
          };
          io.emit('state:updated', terminatePayload);
          io.emit('state_update', terminatePayload);
          io.emit('audit:updated', {
            logs: serverDb.getStaffAuditLogs(100),
            latest: result.auditEntry,
          });

          res.json({
            ok: true,
            ...result,
            metrics,
          });
        },
      );

      app.post(
        '/api/rooms/auto-patch',
        requireStaffRole(['admin']),
        (req: Request, res: Response) => {
          const staffCtx = (req as Request & { staffContext?: StaffGuardContext })
            .staffContext;
          const body = (req.body ?? {}) as {
            actorUsername?: string;
            serverRegion?: 'BR' | 'ES' | 'EN';
            anomalySummary?: string;
          };
          const metrics = computeAllRoomHealthMetrics();
          const criticalRooms = metrics.filter((m) => m.status === 'Crítica');
          for (const cr of criticalRooms) {
            toggleRoomSpike(cr.roomId, false);
          }

          const actorAccount = staffCtx?.actorId
            ? serverDb.findAccountById(staffCtx.actorId)
            : undefined;
          const actorUsername =
            body.actorUsername ||
            actorAccount?.displayName ||
            actorAccount?.username ||
            'Community Manager';

          const repairedList =
            criticalRooms.length > 0
              ? criticalRooms.map((c) => c.roomName).join(', ')
              : 'sincronização de cache Starplaza e latência de salas';

          const post = serverDb.publishAutoPatchNote({
            title: `Auto Patch Note · Estabilização (${repairedList})`,
            summary:
              body.anomalySummary ||
              `Varredura DevOps executada por ${actorUsername}: ${criticalRooms.length} sala(s) crítica(s) normalizada(s) sem queda de servidor.`,
            body:
              `Relatório Automático de Engenharia: Todas as instâncias passaram por verificação de pacotes WebSocket e integridade do catálogo 2D. ` +
              (criticalRooms.length > 0
                ? `Anomalias corrigidas em: ${repairedList}.`
                : 'Nenhuma sala crítica pendente; índices de latência estabilizados abaixo de 40ms.'),
            serverRegion: body.serverRegion || 'BR',
            actorId: staffCtx?.actorId || 'system_cm',
            actorUsername,
            actorRole: staffCtx?.role === 'admin' ? 'admin' : 'cm',
          });

          const updatedMetrics = computeAllRoomHealthMetrics();
          const auditEntry: StaffAuditLogEntry = {
            id: `audit_patch_${Date.now()}`,
            timestamp: Date.now(),
            actor_id: staffCtx?.actorId || 'system_cm',
            actor_username: actorUsername,
            role: staffCtx?.role === 'admin' ? 'admin' : 'cm',
            action_type: 'AUTO_PATCH_REPAIR',
            target_id: 'all_rooms',
            details: `Auto Patch Notes publicado (${criticalRooms.length} sala(s) estabilizada(s)).`,
          };
          const logs = serverDb.appendStaffAuditLog(auditEntry);
          const snap = serverDb.getPublicSnapshot();

          io.emit('room:health_updated', { metrics: updatedMetrics });
          const patchPayload = {
            worldState: snap.worldState,
            updatedAt: snap.updatedAt,
            version: snap.version,
          };
          io.emit('state:updated', patchPayload);
          io.emit('state_update', patchPayload);
          io.emit('audit:updated', { logs: logs.slice(0, 100), latest: auditEntry });

          res.json({
            ok: true,
            repairedCount: criticalRooms.length,
            post,
            metrics: updatedMetrics,
          });
        },
      );

      // ── SISTEMA OFICIAL DE TICKETS SALVOS (TELA INICIAL & IN-GAME -> COMMUNITY MANAGER) ──
      app.post('/api/support/ask-ai', (_req: Request, res: Response) => {
        res.status(410).json({
          ok: false,
          error:
            'O suporte automático por IA foi desativado. Utilize o sistema oficial de Tickets respondido pelo Community Manager.',
        });
      });

      app.get('/api/support/tickets', (_req: Request, res: Response) => {
        res.json({ ok: true, tickets: serverDb.getSupportTickets() });
      });

      app.post('/api/support/tickets', (req: Request, res: Response) => {
        const body = (req.body ?? {}) as {
          requesterAccountId?: string;
          requesterUsername?: string;
          email?: string;
          category?: SupportTicket['category'];
          serverRegion?: ServerRegion;
          subject?: string;
          messages?: SupportChatMessage[];
        };
        const requesterUsername = (body.requesterUsername || 'Visitante')
          .trim()
          .slice(0, 48);
        const subject = (body.subject || 'Novo Ticket de Suporte').trim().slice(0, 120);
        const now = Date.now();
        const ticket: SupportTicket = {
          id: `tkt_${now}_${Math.random().toString(36).slice(2, 6)}`,
          requesterAccountId: body.requesterAccountId,
          requesterUsername,
          email: body.email?.trim().slice(0, 120),
          category: body.category || 'geral',
          serverRegion: body.serverRegion || 'BR',
          subject,
          status: 'open',
          messages: Array.isArray(body.messages) ? body.messages.slice(-50) : [],
          createdAt: now,
          updatedAt: now,
        };

        const tickets = serverDb.upsertSupportTicket(ticket);
        io.emit('support:ticket_updated', { tickets, latest: ticket });
        res.json({ ok: true, ticket, tickets });
      });

      app.post('/api/support/tickets/:id/reply', (req: Request, res: Response) => {
        const ticketId = req.params.id;
        const existing = serverDb.getSupportTickets().find((t) => t.id === ticketId);
        if (!existing) {
          res.status(404).json({ ok: false, error: 'Ticket não encontrado.' });
          return;
        }
        const body = (req.body ?? {}) as {
          text?: string;
          senderName?: string;
          senderRole?: SupportChatMessage['senderRole'];
          actorId?: string;
        };
        const text = (body.text || '').trim().slice(0, 800);
        if (!text) {
          res.status(400).json({ ok: false, error: 'Escreva uma mensagem antes de enviar.' });
          return;
        }

        const actorId =
          body.actorId || (req.headers['x-actor-id'] as string | undefined);
        const claimedRole =
          (req.headers['x-staff-role'] as string | undefined) || body.senderRole;
        const actorEmail = req.headers['x-actor-email'] as string | undefined;
        const staffRole = actorId
          ? resolveActorRoleFromServer(actorId, claimedRole, actorEmail)
          : null;

        const isStaffReply = staffRole === 'cm' || staffRole === 'admin';
        const resolvedSenderRole: SupportChatMessage['senderRole'] = isStaffReply
          ? staffRole === 'admin'
            ? 'admin'
            : 'cm'
          : 'player';

        const senderName = (
          body.senderName ||
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
        if (isStaffReply) {
          const auditEntry: StaffAuditLogEntry = {
            id: `audit_tkt_${now}_${Math.random().toString(36).slice(2, 5)}`,
            timestamp: now,
            actor_id: actorId || 'system_cm',
            actor_username: senderName,
            role: staffRole === 'admin' ? 'admin' : 'cm',
            action_type: 'TICKET_REPLY',
            target_id: existing.requesterUsername,
            details: `Resposta registrada no Ticket ${existing.id}.`,
          };
          const logs = serverDb.appendStaffAuditLog(auditEntry);
          io.emit('audit:updated', { logs: logs.slice(0, 100), latest: auditEntry });
        }
        io.emit('support:ticket_updated', { tickets, latest: updated });
        res.json({ ok: true, ticket: updated, tickets });
      });

      app.patch(
        '/api/support/tickets/:id',
        requireStaffRole(['admin', 'cm']),
        (req: Request, res: Response) => {
          const staffCtx = (req as Request & { staffContext?: StaffGuardContext })
            .staffContext;
          const ticketId = req.params.id;
          const existing = serverDb.getSupportTickets().find((t) => t.id === ticketId);
          if (!existing) {
            res.status(404).json({ ok: false, error: 'Ticket não encontrado.' });
            return;
          }
          const body = (req.body ?? {}) as {
            replyText?: string;
            status?: SupportTicket['status'];
            cmUsername?: string;
            moderatorUsername?: string;
          };
          const now = Date.now();
          const cmName =
            body.cmUsername || body.moderatorUsername || 'Community Manager';
          const senderRole: SupportChatMessage['senderRole'] =
            staffCtx?.role === 'admin' ? 'admin' : 'cm';
          const nextMessages = [...existing.messages];
          if (body.replyText && body.replyText.trim()) {
            nextMessages.push({
              id: `tmsg_${now}_${Math.random().toString(36).slice(2, 5)}`,
              senderRole,
              sender: 'staff',
              senderName: cmName,
              text: body.replyText.trim().slice(0, 800),
              createdAt: now,
            });
          }
          const updated: SupportTicket = {
            ...existing,
            status: body.status || (body.replyText ? 'answered' : existing.status),
            assignedCmUsername: cmName,
            messages: nextMessages,
            updatedAt: now,
          };
          const tickets = serverDb.upsertSupportTicket(updated);
          const auditEntry: StaffAuditLogEntry = {
            id: `audit_tkt_${now}`,
            timestamp: now,
            actor_id: staffCtx?.actorId || 'system_cm',
            actor_username: cmName,
            role: staffCtx?.role === 'admin' ? 'admin' : 'cm',
            action_type: 'SUPPORT_TICKET_RESPONSE',
            target_id: existing.requesterUsername,
            details: `Ticket ${existing.id} atualizado para "${updated.status}".`,
          };
          const logs = serverDb.appendStaffAuditLog(auditEntry);
          io.emit('support:ticket_updated', { tickets, latest: updated });
          io.emit('audit:updated', { logs: logs.slice(0, 100), latest: auditEntry });
          res.json({ ok: true, ticket: updated, tickets });
        },
      );

      // ── MERCADO DE JOGADORES (COMPRA & VENDA EM AM) ──
      app.get('/api/market/listings', (_req: Request, res: Response) => {
        res.json({ ok: true, listings: serverDb.getMarketListings() });
      });

      app.post('/api/market/listings', (req: Request, res: Response) => {
        const body = (req.body ?? {}) as {
          sellerAccountId?: string;
          itemId?: string;
          price?: number;
        };
        const sellerId =
          body.sellerAccountId || (req.headers['x-actor-id'] as string | undefined) || '';
        const result = serverDb.createMarketListing({
          sellerAccountId: sellerId,
          itemId: body.itemId || '',
          price: Number(body.price),
        });
        if (!result.ok) {
          res.status(400).json({ ok: false, error: result.error });
          return;
        }
        io.emit('market:updated', { listings: result.listings });
        res.json({ ok: true, listing: result.listing, listings: result.listings });
      });

      app.delete('/api/market/listings/:id', (req: Request, res: Response) => {
        const listingId = req.params.id;
        const actorId = (req.headers['x-actor-id'] as string | undefined) || '';
        const claimedRole = req.headers['x-staff-role'] as string | undefined;
        const actorEmail = req.headers['x-actor-email'] as string | undefined;
        const staffRole = actorId ? resolveActorRoleFromServer(actorId, claimedRole, actorEmail) : null;
        const result = serverDb.cancelMarketListing({
          listingId,
          actorAccountId: actorId,
          isAdmin: staffRole === 'admin',
        });
        if (!result.ok) {
          res.status(400).json({ ok: false, error: result.error });
          return;
        }
        io.emit('market:updated', { listings: result.listings });
        res.json({ ok: true, listing: result.listing, listings: result.listings });
      });

      app.post('/api/market/listings/:id/buy', (req: Request, res: Response) => {
        const listingId = req.params.id;
        const body = (req.body ?? {}) as { buyerAccountId?: string };
        const buyerId =
          body.buyerAccountId || (req.headers['x-actor-id'] as string | undefined) || '';
        const result = serverDb.buyMarketListing({
          listingId,
          buyerAccountId: buyerId,
        });
        if (!result.ok) {
          res.status(400).json({ ok: false, error: result.error });
          return;
        }
        const snap = serverDb.getPublicSnapshot();
        io.emit('market:updated', { listings: result.listings });
        const buyerPatch = {
          worldState: snap.worldState,
          playerPatch: { accountId: buyerId, progress: result.buyerProgress },
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
        res.json({
          ok: true,
          listing: result.listing,
          listings: result.listings,
          buyerProgress: result.buyerProgress,
        });
      });

      // ── PAGAMENTO DE SALÁRIO EM SALAS DOS USUÁRIOS (AM) ──
      app.post('/api/rooms/pay-employee', (req: Request, res: Response) => {
        const body = (req.body ?? {}) as {
          roomId?: string;
          ownerAccountId?: string;
          employeeUserId?: string;
          amount?: number;
        };
        const ownerId =
          body.ownerAccountId || (req.headers['x-actor-id'] as string | undefined) || '';
        if (!body.roomId || !ownerId || !body.employeeUserId) {
          res.status(400).json({
            ok: false,
            error: 'Informe a sala, o proprietário e o funcionário para pagar.',
          });
          return;
        }
        const result = serverDb.payRoomEmployee({
          roomId: body.roomId,
          ownerAccountId: ownerId,
          employeeUserId: body.employeeUserId,
          amount: body.amount,
        });
        if (!result.ok) {
          res.status(400).json({ ok: false, error: result.error });
          return;
        }

        const snap = serverDb.getPublicSnapshot();
        io.emit('room:snapshot_sync', { roomsSnapshot: result.roomsSnapshot });
        const ownerPatch = {
          worldState: result.worldState ?? snap.worldState,
          playerPatch: { accountId: ownerId, progress: result.ownerProgress },
          updatedAt: snap.updatedAt,
          version: snap.version,
        };
        io.emit('state:updated', ownerPatch);
        io.emit('state_update', ownerPatch);

        const empAcc = serverDb
          .getSnapshot()
          .accounts.find(
            (a) =>
              a.id === body.employeeUserId ||
              a.username.toLowerCase() === result.employeeUsername.toLowerCase(),
          );
        if (empAcc && empAcc.id !== ownerId) {
          const empPatch = {
            worldState: result.worldState ?? snap.worldState,
            playerPatch: { accountId: empAcc.id, progress: result.employeeProgress },
            updatedAt: snap.updatedAt,
            version: snap.version,
          };
          io.emit('state:updated', empPatch);
          io.emit('state_update', empPatch);
        }

        res.json({
          ok: true,
          amountPaid: result.amountPaid,
          employeeUsername: result.employeeUsername,
          jobTitle: result.jobTitle,
          ownerProgress: result.ownerProgress,
          roomsSnapshot: result.roomsSnapshot,
        });
      });

      // ── COMUNICAÇÃO DIRETA SUPORTE OFICIAL ↔ MODERADORES (ABA MODERAÇÃO) ──
      app.get('/api/support-mod/messages', (_req: Request, res: Response) => {
        res.json({ ok: true, messages: serverDb.getSupportModMessages() });
      });

      app.post('/api/support-mod/messages', (req: Request, res: Response) => {
        const body = (req.body ?? {}) as {
          senderAccountId?: string;
          senderUsername?: string;
          text?: string;
        };
        const actorId =
          body.senderAccountId || (req.headers['x-actor-id'] as string | undefined) || '';
        const text = (body.text || '').trim().slice(0, 600);
        if (!actorId || !text) {
          res.status(400).json({ ok: false, error: 'Escreva uma mensagem válida.' });
          return;
        }
        const acc = serverDb.findAccountById(actorId);
        const staffRole = resolveActorRoleFromServer(
          actorId,
          req.headers['x-staff-role'] as string | undefined,
          (req.headers['x-actor-email'] as string | undefined) || acc?.email,
        );
        const snap = serverDb.getSnapshot();
        const normUname = (acc?.username || body.senderUsername || '').trim().toLowerCase();
        const isOfficialSupport = Object.values(snap.roomsSnapshot?.officialOverrides ?? {}).some(
          (ov) =>
            Array.isArray(ov?.supportStaff) &&
            ov.supportStaff.some((u) => u.trim().toLowerCase() === normUname),
        );
        if (!staffRole && !isOfficialSupport) {
          res.status(403).json({
            ok: false,
            error: 'Acesso restrito à equipe de Suporte Oficial, Moderadores e Administrador.',
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
          senderAccountId: actorId,
          senderUsername: acc?.username || body.senderUsername || 'Equipe',
          senderRoleLabel: roleLabel,
          isSupport: isOfficialSupport && !staffRole,
          text,
          createdAt: Date.now(),
        };
        const messages = serverDb.appendSupportModMessage(msg);
        io.emit('support_mod:updated', { messages, latest: msg });
        res.json({ ok: true, messages, latest: msg });
      });

      app.post(
        '/api/admin/grant-item',
        requireStaffRole(['admin']),
        (req: Request, res: Response) => {
          const staffCtx = (req as Request & { staffContext?: StaffGuardContext }).staffContext;
          const body = (req.body ?? {}) as {
            targetAccountIdOrUsername?: string;
            itemId?: string;
            actorUsername?: string;
          };
          const actorAccount = staffCtx?.actorId
            ? serverDb.findAccountById(staffCtx.actorId)
            : undefined;
          const result = serverDb.adminGrantItemToAccount({
            actorId: staffCtx?.actorId || 'admin',
            actorUsername:
              body.actorUsername ||
              actorAccount?.displayName ||
              actorAccount?.username ||
              'Admin',
            targetAccountIdOrUsername: body.targetAccountIdOrUsername || '',
            itemId: body.itemId || '',
          });
          if (!result.ok) {
            res.status(400).json({ ok: false, error: result.error });
            return;
          }
          const snap = serverDb.getPublicSnapshot();
          const patchPayload = {
            playerPatch: {
              accountId: result.targetAccountId,
              progress: result.updatedProgress,
            },
            updatedAt: snap.updatedAt,
            version: snap.version,
          };
          io.emit('state:updated', patchPayload);
          io.emit('state_update', patchPayload);
          io.emit('audit:updated', {
            logs: (snap.staff_audit_logs ?? []).slice(0, 100),
            latest: result.auditEntry,
          });
          res.json({
            ok: true,
            targetAccountId: result.targetAccountId,
            targetUsername: result.targetUsername,
            updatedProgress: result.updatedProgress,
          });
        },
      );

      // ── LOJA PREMIUM (AM & VIP · PIX + COMPROVANTE + CRÉDITO PELO COMMUNITY MANAGER) ──
      app.get('/api/premium-pix-config', (_req: Request, res: Response) => {
        res.json({ ok: true, config: serverDb.getPremiumPixConfig() });
      });

      app.put(
        '/api/premium-pix-config',
        requireStaffRole(['admin', 'cm']),
        (req: Request, res: Response) => {
          const staffCtx = (req as Request & { staffContext?: StaffGuardContext })
            .staffContext;
          const body = (req.body ?? {}) as { pixKey?: string; actorUsername?: string };
          const pixKey = (body.pixKey || '').trim();
          if (!pixKey) {
            res.status(400).json({ ok: false, error: 'Informe uma chave PIX válida.' });
            return;
          }
          const actorAccount = staffCtx?.actorId
            ? serverDb.findAccountById(staffCtx.actorId)
            : undefined;
          const actorUsername =
            body.actorUsername ||
            actorAccount?.displayName ||
            actorAccount?.username ||
            'Community Manager';

          const config = serverDb.updatePremiumPixConfig(pixKey, actorUsername);
          const auditEntry: StaffAuditLogEntry = {
            id: `audit_pix_${Date.now()}`,
            timestamp: Date.now(),
            actor_id: staffCtx?.actorId || 'system_cm',
            actor_username: actorUsername,
            role: staffCtx?.role === 'admin' ? 'admin' : 'cm',
            action_type: 'LOJA_PREMIUM_PIX_UPDATE',
            target_id: 'premium_pix_config',
            details: `Chave PIX da Loja Premium atualizada para "${config.pixKey}".`,
          };
          const logs = serverDb.appendStaffAuditLog(auditEntry);
          io.emit('premium:pix_updated', { config });
          io.emit('audit:updated', { logs: logs.slice(0, 100), latest: auditEntry });
          res.json({ ok: true, config });
        },
      );

      app.get('/api/premium-orders', (_req: Request, res: Response) => {
        res.json({ ok: true, orders: serverDb.getPremiumOrders() });
      });

      app.post('/api/premium-orders', (req: Request, res: Response) => {
        const body = (req.body ?? {}) as {
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
        };

        if (!body.requesterAccountId || !body.requesterUsername || !body.packId) {
          res.status(400).json({
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
        res.json({ ok: true, order, orders });
      });

      app.post('/api/premium-orders/:id/message', (req: Request, res: Response) => {
        const orderId = req.params.id;
        const existing = serverDb.getPremiumOrders().find((o) => o.id === orderId);
        if (!existing) {
          res.status(404).json({ ok: false, error: 'Pedido não encontrado.' });
          return;
        }
        const body = (req.body ?? {}) as {
          text?: string;
          attachmentImageUrl?: string;
          senderName?: string;
          actorId?: string;
        };
        const text = (body.text || '').trim().slice(0, 800);
        if (!text && !body.attachmentImageUrl) {
          res.status(400).json({ ok: false, error: 'Informe uma mensagem ou anexe o comprovante.' });
          return;
        }

        const actorId =
          body.actorId || (req.headers['x-actor-id'] as string | undefined);
        const claimedRole = req.headers['x-staff-role'] as string | undefined;
        const actorEmail = req.headers['x-actor-email'] as string | undefined;
        const staffRole = actorId
          ? resolveActorRoleFromServer(actorId, claimedRole, actorEmail)
          : null;

        const isStaff = staffRole === 'cm' || staffRole === 'admin';
        const senderRole: PremiumOrderMessage['senderRole'] = isStaff
          ? staffRole === 'admin'
            ? 'admin'
            : 'cm'
          : 'player';
        const senderName = (
          body.senderName ||
          (isStaff ? 'Community Manager' : existing.requesterDisplayName || existing.requesterUsername)
        )
          .trim()
          .slice(0, 48);

        const now = Date.now();
        const nextMsg: PremiumOrderMessage = {
          id: `pmsg_${now}_${Math.random().toString(36).slice(2, 5)}`,
          senderRole,
          senderName,
          text: text || 'Comprovante atualizado.',
          attachmentImageUrl: body.attachmentImageUrl,
          createdAt: now,
        };

        const updated: PremiumOrder = {
          ...existing,
          receiptImageUrl: body.attachmentImageUrl || existing.receiptImageUrl,
          messages: [...existing.messages, nextMsg].slice(-60),
          updatedAt: now,
        };
        const orders = serverDb.upsertPremiumOrder(updated);
        io.emit('premium:orders_updated', { orders, latest: updated });
        res.json({ ok: true, order: updated, orders });
      });

      app.post(
        '/api/premium-orders/:id/decide',
        requireStaffRole(['admin', 'cm']),
        (req: Request, res: Response) => {
          const staffCtx = (req as Request & { staffContext?: StaffGuardContext })
            .staffContext;
          const body = (req.body ?? {}) as {
            decision?: 'credit' | 'reject';
            note?: string;
            actorUsername?: string;
          };
          const decision = body.decision === 'reject' ? 'reject' : 'credit';
          const actorAccount = staffCtx?.actorId
            ? serverDb.findAccountById(staffCtx.actorId)
            : undefined;
          const actorUsername =
            body.actorUsername ||
            actorAccount?.displayName ||
            actorAccount?.username ||
            'Community Manager';

          const result = serverDb.decidePremiumOrder({
            orderId: req.params.id,
            decision,
            actorId: staffCtx?.actorId || 'system_cm',
            actorUsername,
            actorRole: staffCtx?.role === 'admin' ? 'admin' : 'cm',
            note: body.note,
          });

          if (!result.ok) {
            res.status(400).json(result);
            return;
          }

          const snap = serverDb.getPublicSnapshot();
          io.emit('premium:orders_updated', {
            orders: result.orders,
            latest: result.order,
          });

          if (decision === 'credit') {
            const creditPayload: StateSyncPatchPayload & { version?: number } = {
              accounts: snap.accounts,
              worldState: snap.worldState ?? undefined,
              ...(result.updatedProgress
                ? {
                    playerPatch: {
                      accountId:
                        result.updatedAccount?.id ?? result.order.requesterAccountId,
                      progress: result.updatedProgress,
                    },
                  }
                : {}),
              updatedAt: snap.updatedAt,
              version: snap.version,
            };
            io.emit('state:updated', creditPayload);
            io.emit('state_update', creditPayload);
          }

          io.emit('audit:updated', {
            logs: serverDb.getStaffAuditLogs(100),
            latest: result.auditEntry,
          });

          res.json({
            ok: true,
            order: result.order,
            orders: result.orders,
            account: result.updatedAccount,
            progress: result.updatedProgress,
          });
        },
      );

      // ── FILA DE REVISÃO DE BANIMENTO (MODERAÇÃO) ──
      app.get('/api/ban-reviews', (_req: Request, res: Response) => {
        res.json({ ok: true, reviews: serverDb.getBanReviews() });
      });

      app.post('/api/ban-reviews', (req: Request, res: Response) => {
        const body = (req.body ?? {}) as Partial<BanReviewRequest>;
        const targetUsername = (body.targetUsername || '').trim();
        if (!targetUsername) {
          res.status(400).json({ ok: false, error: 'Informe targetUsername.' });
          return;
        }
        const now = Date.now();
        const review: BanReviewRequest = {
          id: `banrev_${now}_${Math.random().toString(36).slice(2, 6)}`,
          targetAccountId: body.targetAccountId || `acc_${targetUsername}`,
          targetUsername,
          reason: (body.reason || 'Revisão solicitada via Moderação').slice(0, 260),
          appealMessage: body.appealMessage?.slice(0, 400),
          status: 'pending',
          createdAt: now,
        };
        const reviews = serverDb.upsertBanReview(review);
        io.emit('ban:review_updated', { reviews, latest: review });
        res.json({ ok: true, review, reviews });
      });

      app.patch(
        '/api/ban-reviews/:id',
        requireStaffRole(['admin', 'moderator']),
        (req: Request, res: Response) => {
          const staffCtx = (req as Request & { staffContext?: StaffGuardContext })
            .staffContext;
          const existing = serverDb.getBanReviews().find((r) => r.id === req.params.id);
          if (!existing) {
            res.status(404).json({ ok: false, error: 'Revisão de banimento não encontrada.' });
            return;
          }
          const body = (req.body ?? {}) as {
            status?: BanReviewRequest['status'];
            moderatorNote?: string;
            reviewerUsername?: string;
          };
          const now = Date.now();
          const reviewer = body.reviewerUsername || 'Moderador';
          const updated: BanReviewRequest = {
            ...existing,
            status: body.status || 'upheld',
            moderatorNote: body.moderatorNote?.slice(0, 300),
            reviewedBy: reviewer,
            reviewedAt: now,
          };

          // Se aprovado o desbanimento, libera a conta e o usuário no worldState
          const snap = serverDb.getSnapshot();
          if (updated.status === 'approved_unban') {
            const nextAccounts = snap.accounts.map((acc) =>
              acc.id === existing.targetAccountId ||
              acc.username.toLowerCase() === existing.targetUsername.toLowerCase()
                ? { ...acc, banned: false, mutedUntil: undefined }
                : acc,
            );
            const nextWorldUsers = (snap.worldState?.users ?? []).map((u) =>
              u.id === existing.targetAccountId ||
              u.username.toLowerCase() === existing.targetUsername.toLowerCase()
                ? { ...u, status: 'active' as const, banReason: undefined }
                : u,
            );
            serverDb.applyPatch({
              accounts: nextAccounts,
              worldState: snap.worldState ? { ...snap.worldState, users: nextWorldUsers } : undefined,
            });
          }

          const reviews = serverDb.upsertBanReview(updated);
          const auditEntry: StaffAuditLogEntry = {
            id: `audit_banrev_${now}`,
            timestamp: now,
            actor_id: staffCtx?.actorId || 'system_mod',
            actor_username: reviewer,
            role: staffCtx?.role === 'admin' ? 'admin' : 'moderator',
            action_type: 'BAN_REVIEW_DECISION',
            target_id: existing.targetUsername,
            details: `Revisão ${existing.id} decidida como "${updated.status}".`,
          };
          const logs = serverDb.appendStaffAuditLog(auditEntry);
          const nextSnap = serverDb.getPublicSnapshot();

          io.emit('ban:review_updated', { reviews, latest: updated });
          const banReviewPayload = {
            accounts: nextSnap.accounts,
            updatedAt: nextSnap.updatedAt,
            version: nextSnap.version,
          };
          io.emit('state:updated', banReviewPayload);
          io.emit('state_update', banReviewPayload);
          io.emit('audit:updated', { logs: logs.slice(0, 100), latest: auditEntry });
          res.json({ ok: true, review: updated, reviews });
        },
      );

      // Endpoint legado do Bot Designer Cron desativado permanentemente
      app.post('/api/designer/cron-run', (_req: Request, res: Response) => {
        res.status(410).json({
          ok: false,
          error: 'Geração automática de itens por Bot Designer foi desativada.',
        });
      });

      // ── TRANSCRIÇÃO DE MICROFONE PARA CHAT DO JOGO (GEMINI 3.5 TRANSCRIBE) ──
      app.post('/api/audio/transcribe', async (req: Request, res: Response) => {
        try {
          const body = (req.body ?? {}) as {
            audioBase64?: string;
            mimeType?: string;
          };

          if (!body.audioBase64 || typeof body.audioBase64 !== 'string') {
            res.status(400).json({
              ok: false,
              error: 'Envie um áudio válido gravado pelo microfone.',
            });
            return;
          }

          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            res.status(503).json({
              ok: false,
              error:
                'Chave de API do Gemini indisponível no servidor. Verifique Settings > Secrets.',
            });
            return;
          }

          const { mimeType: rawMime, data } = extractBase64Payload(
            body.audioBase64,
            body.mimeType || 'audio/webm',
          );
          if (!data || data.length < 32) {
            res.status(400).json({
              ok: false,
              error: 'Gravação de áudio vazia ou muito curta.',
            });
            return;
          }

          // Remove parâmetros como ';codecs=opus' para manter MIME limpo (ex: 'audio/webm')
          const cleanMimeType = rawMime.split(';')[0].trim() || 'audio/webm';

          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const response = await ai.models.generateContent({
            model: 'gemini-3.5-transcribe',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMimeType,
                    data,
                  },
                },
                {
                  text:
                    'Transcreva fielmente apenas o que o jogador falou neste áudio, no idioma falado (português do Brasil por padrão). ' +
                    'Retorne somente o texto falado, sem aspas nem comentários extras. Se houver apenas silêncio ou ruído sem fala, retorne string vazia.',
                },
              ],
            },
          });

          const rawText = (response.text ?? '')
            .trim()
            .replace(/^["'“”]+|["'“”]+$/g, '')
            .replace(/\s+/g, ' ')
            .slice(0, 180);

          res.json({ ok: true, text: rawText });
        } catch (error) {
          const errMsg =
            error instanceof Error ? error.message : 'Falha ao transcrever áudio.';
          console.error('[api/audio/transcribe] error:', errMsg);
          res.status(500).json({
            ok: false,
            error: `Erro na transcrição de voz: ${errMsg}`,
          });
        }
      });

      app.post('/api/designer/analyze-photo', async (req: Request, res: Response) => {
        try {
          const body = (req.body ?? {}) as {
            imageBase64?: string;
            mimeType?: string;
            targetKind?: 'auto' | 'clothing' | 'furniture';
            adminEmail?: string;
            actor_id?: string;
            role?: string;
            hintName?: string;
          };

          const callerEmail = (
            body.adminEmail ||
            (req.headers['x-actor-email'] as string | undefined) ||
            ''
          )
            .trim()
            .toLowerCase();
          const actorId =
            body.actor_id || (req.headers['x-actor-id'] as string | undefined);
          const claimedRole =
            body.role || (req.headers['x-staff-role'] as string | undefined);
          const verifiedRole = resolveActorRoleFromServer(
            actorId,
            claimedRole,
            callerEmail,
          );

          if (
            callerEmail !== ADMIN_OWNER_EMAIL &&
            verifiedRole !== 'admin' &&
            verifiedRole !== 'designer'
          ) {
            res.status(403).json({
              ok: false,
              error: 'Acesso restrito ao Administrador Geral ou Global Designer.',
            });
            return;
          }

      if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
        res.status(400).json({
          ok: false,
          error: 'Envie uma foto válida para análise visual.',
        });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(503).json({
          ok: false,
          error:
            'Chave de API do Gemini indisponível no servidor. Verifique Settings > Secrets.',
        });
        return;
      }

      const { mimeType, data } = extractBase64Payload(
        body.imageBase64,
        body.mimeType || 'image/jpeg'
      );

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const targetInstruction =
        body.targetKind === 'clothing'
          ? 'Trate o objeto principal da foto como um item de vestuário ou cabelo para avatar 2D (kind = "clothing").'
          : body.targetKind === 'furniture'
          ? 'Trate o objeto principal da foto como um móvel/objeto de decoração para suíte 2D (kind = "furniture").'
          : 'Identifique automaticamente se o objeto principal da foto é vestuário/cabelo ("clothing") ou móvel/decoração ("furniture").';

      const hintInstruction = body.hintName?.trim()
        ? `Dica de título do Administrador: "${body.hintName.trim()}".`
        : '';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data,
              },
            },
            {
              text:
                `Analise esta fotografia com precisão de diretor criativo de moda e design de interiores do jogo 2D Starlight Atelier. ${targetInstruction} ${hintInstruction} ` +
                'Extraia a paleta de cores reais predominantes em hexadecimal (#RRGGBB), o padrão de textura, o corte/silhueta mais fiel, nome comercial elegante em português do Brasil, descrição curta de ateliê e preço justo em moedas AM (entre 140 e 1200 AM).',
            },
          ],
        },
        config: {
          systemInstruction:
            'Você é o motor de visão computacional do Designer Global do Starlight Atelier. Responda estritamente em JSON seguindo o schema fornecido.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              kind: {
                type: Type.STRING,
                description: 'Valor exato: "clothing" ou "furniture".',
              },
              name: {
                type: Type.STRING,
                description: 'Nome elegante da peça ou móvel em português.',
              },
              brand: {
                type: Type.STRING,
                description: 'Nome da marca fictícia de ateliê (ex: Atelier Lumière, Maison Royale VIP, Neon Studio).',
              },
              description: {
                type: Type.STRING,
                description: 'Breve descrição dos materiais, caimento e inspiração visual da foto.',
              },
              clothingCategory: {
                type: Type.STRING,
                description:
                  'Se clothing: um de "cabelo", "blusas", "vestidos", "calcas", "sapatos", "acessorios".',
              },
              gender: {
                type: Type.STRING,
                description: 'Se clothing: "feminino", "masculino" ou "unissex".',
              },
              clothingTemplateId: {
                type: Type.STRING,
                description:
                  'ID base mais próximo para recorte vetorial: cabelo (hair_ondas_mel, hair_coque_atelier, hair_corte_executivo, hair_fade_moderno), blusa (top_blazer_tweed, top_cropped_veludo, top_camisa_social_azul, top_jaqueta_couro, top_hoodie_y2k_ny), vestido (dress_tubinho_atelier, dress_gala_escarlate, dress_cetim_champagne), calca (bottom_calca_alfaiataria, bottom_saia_midi, bottom_jeans_cintura, bottom_cargo_urbana), sapato (shoes_scarpin_preto, shoes_oxford_couro, shoes_tenis_branco, shoes_bota_cano), acessorio (acc_oculos_gatinho, acc_oculos_aviador, acc_boina_francesa, acc_bolsa_estruturada, acc_coroa_imperial_vip).',
              },
              furnitureCategory: {
                type: Type.STRING,
                description: 'Se furniture: "Assentos", "Superfícies" ou "Decoração".',
              },
              furnitureTemplateId: {
                type: Type.STRING,
                description:
                  'Se furniture: "tpl_sofa", "tpl_mesa", "tpl_decoracao", "tpl_dj", "tpl_pista", "tpl_bar", "tpl_banqueta", "tpl_cama", "tpl_cozinha", "tpl_banheira" ou "tpl_lustre".',
              },
              themeTag: {
                type: Type.STRING,
                description: 'Se furniture: "geral", "boate", "casa", "bar" ou "hotel".',
              },
              swatchColor: {
                type: Type.STRING,
                description: 'Cor principal predominante observada na foto em formato #RRGGBB.',
              },
              secondaryColor: {
                type: Type.STRING,
                description: 'Cor secundária observada na foto em formato #RRGGBB.',
              },
              accentColor: {
                type: Type.STRING,
                description: 'Cor de detalhes/acabamento/metais observada na foto em formato #RRGGBB.',
              },
              pattern: {
                type: Type.STRING,
                description: 'Um de "solid", "striped", "plaid", "floral", "sequin", "denim", "neon".',
              },
              collectionTag: {
                type: Type.STRING,
                description: 'Rótulo curto da coleção (ex: Alta Costura IA, Streetwear Real, Hotel Boutique).',
              },
              suggestedPriceSc: {
                type: Type.INTEGER,
                description: 'Preço sugerido em StarCoins entre 150 e 1100.',
              },
              suggestedVip: {
                type: Type.BOOLEAN,
                description: 'true se o item da foto aparentar alto luxo, gala ou peça de colecionador.',
              },
            },
            required: [
              'kind',
              'name',
              'brand',
              'description',
              'swatchColor',
              'secondaryColor',
              'accentColor',
              'pattern',
              'suggestedPriceSc',
              'suggestedVip',
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as Record<string, unknown>;

      const normalizedKind =
        body.targetKind === 'clothing' || body.targetKind === 'furniture'
          ? body.targetKind
          : parsed.kind === 'furniture'
          ? 'furniture'
          : 'clothing';

      const swatchColor = sanitizeHexColor(parsed.swatchColor, '#C8235D');
      const secondaryColor = sanitizeHexColor(parsed.secondaryColor, '#27232A');
      const accentColor = sanitizeHexColor(parsed.accentColor, '#D4A853');
      const pattern = pickAllowed(parsed.pattern, ALLOWED_PATTERNS, 'solid');
      const rawPrice = Number(parsed.suggestedPriceSc);
      const suggestedPriceSc = Number.isFinite(rawPrice)
        ? Math.max(90, Math.min(2500, Math.round(rawPrice)))
        : 320;

      const design = {
        kind: normalizedKind,
        name:
          typeof parsed.name === 'string' && parsed.name.trim()
            ? parsed.name.trim().slice(0, 64)
            : normalizedKind === 'furniture'
            ? 'Peça Exclusiva Foto Ateliê'
            : 'Look Clonado Foto Real',
        brand:
          typeof parsed.brand === 'string' && parsed.brand.trim()
            ? parsed.brand.trim().slice(0, 42)
            : 'Designer Global Vision',
        description:
          typeof parsed.description === 'string' && parsed.description.trim()
            ? parsed.description.trim().slice(0, 220)
            : 'Peça vetorial fielmente reinterpretada a partir de referência fotográfica real.',
        clothingCategory: pickAllowed(
          parsed.clothingCategory,
          ALLOWED_CLOTHING_CATEGORIES,
          'blusas'
        ),
        gender: pickAllowed(parsed.gender, ALLOWED_GENDERS, 'unissex'),
        clothingTemplateId:
          typeof parsed.clothingTemplateId === 'string' && parsed.clothingTemplateId.trim()
            ? parsed.clothingTemplateId.trim()
            : 'top_blazer_tweed',
        furnitureCategory: pickAllowed(
          parsed.furnitureCategory,
          ALLOWED_FURNITURE_CATEGORIES,
          'Decoração'
        ),
        furnitureTemplateId: pickAllowed(
          parsed.furnitureTemplateId,
          ALLOWED_FURNITURE_TEMPLATES,
          'tpl_sofa'
        ),
        themeTag: pickAllowed(parsed.themeTag, ALLOWED_THEME_TAGS, 'geral'),
        swatchColor,
        secondaryColor,
        accentColor,
        pattern,
        collectionTag:
          typeof parsed.collectionTag === 'string' && parsed.collectionTag.trim()
            ? parsed.collectionTag.trim().slice(0, 36)
            : 'Clonagem Visão IA',
        suggestedPriceSc,
        suggestedVip: Boolean(parsed.suggestedVip),
      };

      res.json({ ok: true, design });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Falha ao analisar imagem.';
      console.error('[api/designer/analyze-photo] error:', errMsg);
      res.status(500).json({
        ok: false,
        error: `Não foi possível analisar a foto com a Visão IA: ${errMsg}`,
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Starlight Atelier server + Socket.io listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
