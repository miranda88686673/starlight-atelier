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
  AiMaintenanceLogEntry,
  BanReviewRequest,
  ClothingItem,
  NewsPost,
  SupportChatMessage,
  SupportTicket,
} from './src/types/game.ts';
import { serverDb } from './server/database.ts';
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

  app.use(express.json({ limit: '12mb' }));
  app.use(express.text({ type: 'text/plain', limit: '64kb' }));

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
    io.emit('presence:updated', {
      presences: publicSnap.presences,
      changedRecord: record,
    });

    res.json({
      ok: true,
      account: result.account,
      progress: result.progress,
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

      // ── DEVOPS / COMMUNITY MANAGER: SAÚDE DE SALAS, KILL-SWITCH & AUTO PATCH ──
      app.get('/api/rooms/health', (_req: Request, res: Response) => {
        res.json({ ok: true, metrics: computeAllRoomHealthMetrics() });
      });

      app.post(
        '/api/rooms/simulate-spike',
        requireStaffRole(['admin', 'cm']),
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
        requireStaffRole(['admin', 'cm']),
        (req: Request, res: Response) => {
          const staffCtx = (req as Request & { staffContext?: StaffGuardContext })
            .staffContext;
          const body = (req.body ?? {}) as {
            roomId?: string;
            reason?: string;
            actorUsername?: string;
          };
          const roomId = (body.roomId || '').trim();
          if (!roomId || roomId === 'lounge_principal') {
            res.status(400).json({
              ok: false,
              error:
                'Informe uma sala válida diferente do Lounge Principal (zona segura de evacuação).',
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
            'Engenheiro DevOps';
          const reason =
            (body.reason || '').trim() || 'Instabilidade de WebSocket / dessincronização';

          const result = serverDb.terminateRoomInstance({
            roomId,
            actorId: staffCtx?.actorId || 'system_devops',
            actorUsername,
            actorRole: staffCtx?.role === 'admin' ? 'admin' : 'cm',
            reason,
          });

          const metrics = clearRoomTelemetryOnTerminate(roomId);
          const snap = serverDb.getPublicSnapshot();

          io.emit('room:terminated', {
            roomId,
            fallbackRoomId: 'lounge_principal',
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
        requireStaffRole(['admin', 'cm']),
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

      // ── SUPORTE IA (BOTÃO HELP NA TELA DE LOGIN) & FILA DE MODERADORES ──
      app.post('/api/support/ask-ai', async (req: Request, res: Response) => {
        const body = (req.body ?? {}) as {
          question?: string;
          username?: string;
          history?: Array<{ senderRole: string; text: string }>;
        };
        const question = (body.question || '').trim();
        if (!question) {
          res.status(400).json({ ok: false, error: 'Escreva sua dúvida antes de enviar.' });
          return;
        }

        const buildDeterministicReply = (q: string): string => {
          const lower = q.toLowerCase();
          if (lower.includes('ban') || lower.includes('suspens') || lower.includes('mut')) {
            return (
              'Olá! Sou o Assistente IA de Moderação do Starlight Atelier. Se sua conta recebeu banimento ou silenciamento e você acredita que houve equívoco, clique em "Encaminhar para Moderador Humano" aqui abaixo informando seu @usuário e o motivo. Nossa equipe de Moderadores analisa revisões diretamente na aba Moderação.'
            );
          }
          if (lower.includes('senha') || lower.includes('login') || lower.includes('conta') || lower.includes('entrar')) {
            return (
              'Para recuperar acesso à sua conta no Starlight Atelier: 1) Use o botão "Redefinir senha" logo acima desta janela informando seu usuário ou e-mail cadastrado; 2) Se não lembrar o e-mail de cadastro, encaminhe um chamado para um Moderador Humano clicando no botão abaixo com seu ID ou @usuário.'
            );
          }
          if (lower.includes('starcoin') || lower.includes('sc') || lower.includes('vip') || lower.includes('compr')) {
            return (
              'No Starlight Atelier, você ganha StarCoins (SC) diariamente no Bônus Diário, completando missões de estilo, participando de Desfiles e interagindo nas salas sociais. Itens exclusivos VIP exigem passe VIP Royale ativo, que pode ser concedido em eventos oficiais ou pela administração.'
            );
          }
          if (lower.includes('sala') || lower.includes('lag') || lower.includes('trav') || lower.includes('bug')) {
            return (
              'Se alguma sala estiver travando ou com erro de sincronização, tente voltar ao Lounge Principal pelo Lobby. Caso o erro persista em uma sala específica, abra um chamado para a Staff para que o Community Manager / DevOps execute a estabilização em tempo real.'
            );
          }
          return (
            'Olá! Bem-vindo ao Suporte Inteligente do Starlight Atelier. Posso orientar sobre: recuperação de senha, revisão de banimentos, StarCoins (SC) & VIP, uso da Starplaza/Suíte e problemas em salas. Se precisar de atendimento personalizado ou revisão de conta, clique em "Encaminhar para Moderador Humano" logo abaixo!'
          );
        };

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          res.json({ ok: true, reply: buildDeterministicReply(question), usedAiModel: false });
          return;
        }

        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });
          const historyContext = (body.history || [])
            .slice(-6)
            .map((h) => `${h.senderRole === 'player' ? 'Jogador' : 'Staff IA'}: ${h.text}`)
            .join('\n');

          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents:
              `Contexto recente da conversa:\n${historyContext || '(início do atendimento)'}\n\n` +
              `Jogador (${body.username || 'Visitante na tela de login'}): ${question}`,
            config: {
              systemInstruction:
                'Você é o Bot de Suporte Oficial da Moderação do jogo social 2D Starlight Atelier. Responda em português do Brasil com tom educado, formal, claro e objetivo (máximo 4 frases). ' +
                'Conhecimentos oficiais do jogo: ' +
                '- Economia: moeda StarCoins (SC), bônus diário, desfiles e missões; passes VIP Royale liberam peças de luxo. ' +
                '- Login e Senha: existe o botão "Redefinir senha" na tela de login para usuários já cadastrados. ' +
                '- Banimentos e Mutes: jogadores punidos podem pedir revisão pelo botão "Encaminhar para Moderador Humano" no chat de Help. ' +
                '- Lojas e Criação: Starplaza vende roupas e móveis 2D; apenas Global Designers e Admin publicam no catálogo oficial; jogadores mobiliam suas Suítes e criam salas VIP. ' +
                '- NUNCA invente comandos falsos, nunca peça a senha do jogador e, caso não seja possível resolver apenas com orientação (ex: desbanimento, bug crítico, recuperação sem e-mail), oriente clicar em "Encaminhar para Moderador Humano".',
            },
          });

          const text = (response.text || '').trim();
          res.json({
            ok: true,
            reply: text || buildDeterministicReply(question),
            usedAiModel: Boolean(text),
          });
        } catch {
          res.json({ ok: true, reply: buildDeterministicReply(question), usedAiModel: false });
        }
      });

      app.get('/api/support/tickets', (_req: Request, res: Response) => {
        res.json({ ok: true, tickets: serverDb.getSupportTickets() });
      });

      app.post('/api/support/tickets', (req: Request, res: Response) => {
        const body = (req.body ?? {}) as {
          requesterAccountId?: string;
          requesterUsername?: string;
          category?: SupportTicket['category'];
          subject?: string;
          messages?: SupportChatMessage[];
          escalateToHuman?: boolean;
        };
        const requesterUsername = (body.requesterUsername || 'Visitante').trim().slice(0, 48);
        const subject = (body.subject || 'Solicitação de Ajuda no Login').trim().slice(0, 120);
        const now = Date.now();
        const ticket: SupportTicket = {
          id: `tkt_${now}_${Math.random().toString(36).slice(2, 6)}`,
          requesterAccountId: body.requesterAccountId,
          requesterUsername,
          category: body.category || 'geral',
          subject,
          status: body.escalateToHuman === false ? 'ai_handling' : 'queued_human',
          messages: Array.isArray(body.messages) ? body.messages.slice(-30) : [],
          createdAt: now,
          updatedAt: now,
        };

        const tickets = serverDb.upsertSupportTicket(ticket);
        io.emit('support:ticket_updated', { tickets, latest: ticket });
        res.json({ ok: true, ticket, tickets });
      });

      app.patch(
        '/api/support/tickets/:id',
        requireStaffRole(['admin', 'moderator', 'cm']),
        (req: Request, res: Response) => {
          const staffCtx = (req as Request & { staffContext?: StaffGuardContext })
            .staffContext;
          const ticketId = req.params.id;
          const existing = serverDb.getSupportTickets().find((t) => t.id === ticketId);
          if (!existing) {
            res.status(404).json({ ok: false, error: 'Chamado não encontrado.' });
            return;
          }
          const body = (req.body ?? {}) as {
            replyText?: string;
            status?: SupportTicket['status'];
            moderatorUsername?: string;
          };
          const now = Date.now();
          const modName = body.moderatorUsername || 'Moderador';
          const nextMessages = [...existing.messages];
          if (body.replyText && body.replyText.trim()) {
            nextMessages.push({
              id: `tmsg_${now}_${Math.random().toString(36).slice(2, 5)}`,
              senderRole: 'moderator',
              senderName: modName,
              text: body.replyText.trim().slice(0, 600),
              createdAt: now,
            });
          }
          const updated: SupportTicket = {
            ...existing,
            status: body.status || (body.replyText ? 'resolved' : existing.status),
            assignedModeratorUsername: modName,
            messages: nextMessages,
            updatedAt: now,
          };
          const tickets = serverDb.upsertSupportTicket(updated);
          const auditEntry: StaffAuditLogEntry = {
            id: `audit_tkt_${now}`,
            timestamp: now,
            actor_id: staffCtx?.actorId || 'system_mod',
            actor_username: modName,
            role: staffCtx?.role === 'admin' ? 'admin' : 'moderator',
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
        requireStaffRole(['admin', 'moderator', 'cm']),
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

          // Se aprovado o desbanimento, libera a conta no snapshot de accounts
          const snap = serverDb.getSnapshot();
          if (updated.status === 'approved_unban') {
            const nextAccounts = snap.accounts.map((acc) =>
              acc.id === existing.targetAccountId ||
              acc.username.toLowerCase() === existing.targetUsername.toLowerCase()
                ? { ...acc, banned: false, mutedUntil: undefined }
                : acc,
            );
            serverDb.applyPatch({ accounts: nextAccounts });
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

      // ── PIPELINE CRON DO BOT DESIGNER GLOBAL (ZERO CONFLITO COM HUMANO) ──
      const GLOBAL_BOT_CONCEPTS: Array<{
        name: string;
        brand: string;
        category: ClothingItem['category'];
        templateId: string;
        gender: ClothingItem['gender'];
        swatchColor: string;
        secondaryColor: string;
        accentColor: string;
        pattern: ClothingItem['pattern'];
        price: number;
        vip: boolean;
        collection: string;
        description: string;
      }> = [
        {
          name: 'Blazer Tóquio Néon 2026',
          brand: 'Studio Shibuya AI',
          category: 'blusas',
          templateId: 'top_blazer_tweed',
          gender: 'unissex',
          swatchColor: '#1E1B24',
          secondaryColor: '#00E5FF',
          accentColor: '#FF2A85',
          pattern: 'neon',
          price: 420,
          vip: false,
          collection: 'Tóquio Runway Cron',
          description: 'Corte arquitetônico inspirado nas semanas de moda asiáticas.',
        },
        {
          name: 'Vestido Cetim Parisienne',
          brand: 'Maison Lumière AI',
          category: 'vestidos',
          templateId: 'dress_cetim_champagne',
          gender: 'feminino',
          swatchColor: '#D4AF37',
          secondaryColor: '#FFF4D8',
          accentColor: '#C8235D',
          pattern: 'sequin',
          price: 680,
          vip: true,
          collection: 'Paris Haute Couture',
          description: 'Caimento fluido com brilho dourado editorial para passarela VIP.',
        },
        {
          name: 'Calça Cargo Seul Street',
          brand: 'Urban District AI',
          category: 'calcas',
          templateId: 'bottom_cargo_urbana',
          gender: 'unissex',
          swatchColor: '#2E3A34',
          secondaryColor: '#1B221F',
          accentColor: '#E8A838',
          pattern: 'denim',
          price: 310,
          vip: false,
          collection: 'Seoul Street Drop',
          description: 'Modelagem utilitária moderna com bolsos estruturados.',
        },
        {
          name: 'Sobretudo Milão Cashmere',
          brand: 'Ateliê Milano AI',
          category: 'blusas',
          templateId: 'top_sobretudo_caramelo',
          gender: 'unissex',
          swatchColor: '#9E6236',
          secondaryColor: '#5B3418',
          accentColor: '#E5C78E',
          pattern: 'plaid',
          price: 520,
          vip: false,
          collection: 'Milão Outono',
          description: 'Peça de alfaiataria italiana com textura xadrez clássica.',
        },
      ];

      const runBotDesignerCronCycle = (force = false) => {
        const snap = serverDb.getSnapshot();
        const now = Date.now();

        // Trava de prioridade humana: se existe Designer Global humano online ou criação humana recente (< 10 min), o Bot cede prioridade
        const humanDesignerOnline = snap.accounts.some((acc) => {
          if (acc.isBot) return false;
          const role = resolveActorRoleFromServer(acc.id, undefined, acc.email);
          if (role !== 'designer') return false;
          const pres = snap.presences[acc.id];
          return pres && pres.status === 'online';
        });

        const recentHumanLock =
          !force &&
          snap.worldState?.lastDesignerCreationAt &&
          now - snap.worldState.lastDesignerCreationAt < 10 * 60_000;

        if (!force && (humanDesignerOnline || recentHumanLock)) {
          return {
            ok: true,
            yieldedToHuman: true,
            reason:
              'Bot Designer cedeu prioridade porque há um Designer Global humano ativo recentemente.',
          };
        }

        const existingIds = new Set(
          (snap.worldState?.customClothingCatalog ?? []).map((i) => i.id),
        );
        const template =
          GLOBAL_BOT_CONCEPTS[Math.floor(Math.random() * GLOBAL_BOT_CONCEPTS.length)];
        const suffix = Math.random().toString(36).slice(2, 6);
        const newId = `cron_bot_${now}_${suffix}`;
        if (existingIds.has(newId)) {
          return { ok: false, reason: 'Colisão de ID no ciclo.' };
        }

        const newItem: ClothingItem = {
          id: newId,
          name: `${template.name} #${suffix.toUpperCase()}`,
          brand: template.brand,
          category: template.category,
          price: template.price,
          zIndex:
            template.category === 'vestidos'
              ? 42
              : template.category === 'calcas'
                ? 30
                : template.category === 'sapatos'
                  ? 20
                  : 40,
          isVipOnly: template.vip,
          vip: template.vip,
          swatchColor: template.swatchColor,
          secondaryColor: template.secondaryColor,
          accentColor: template.accentColor,
          pattern: template.pattern,
          collectionTag: template.collection,
          collection: template.collection,
          gender: template.gender,
          templateId: template.templateId,
          description: template.description,
          badge: 'Bot Designer IA',
          customCreatedAt: now,
          createdBy: 'Bot Designer Global (Cron)',
        };

        const logEntry: AiMaintenanceLogEntry = {
          id: `ailog_cron_${now}`,
          timestamp: now,
          botId: 'bot_designer_global',
          botName: 'Bot Designer Global · Cron',
          botUsername: 'bot_designer_global',
          serverRegion: 'BR',
          category: 'design',
          issueDetected: `Pesquisa e produção automática (${template.collection})`,
          actionTaken: `Lançamento Zero-Downtime na Starplaza: "${newItem.name}" (${newItem.price} SC).`,
          status: 'created',
        };

        const newsPost: NewsPost = {
          id: `news_cron_${now}_${suffix}`,
          title: `Novo Drop Automático · ${newItem.name}`,
          summary: `O Bot Designer Global lançou "${newItem.name}" na Starplaza por ${newItem.price} SC (${template.collection}).`,
          body: `Coleção ${template.collection}: "${newItem.name}" da grife ${newItem.brand} já está disponível com atualização Zero-Downtime no provador da Starplaza. ${newItem.description}`,
          imageUrl: '/news/atelier-fashion.png',
          imageCaption: `${newItem.brand} · Lançamento Bot Designer Global`,
          category: template.vip ? 'Coleção VIP' : 'Lançamentos',
          serverRegion: 'BR',
          authorAccountId: 'bot_designer_global',
          authorUsername: 'Bot Designer Global',
          authorDisplayName: 'Bot Designer Global',
          authorRoleTier: 'designer_global',
          createdAt: now,
        };

        const injected = serverDb.injectDesignerItemZeroDowntime({
          item: newItem,
          logEntry,
          newsPost,
        });

        if (!injected.ok) {
          return { ok: false, reason: injected.reason };
        }

        const updatedSnap = serverDb.getPublicSnapshot();
        const cronPayload = {
          worldState: updatedSnap.worldState,
          aiLogs: updatedSnap.aiLogs,
          updatedAt: updatedSnap.updatedAt,
          version: updatedSnap.version,
        };
        io.emit('state:updated', cronPayload);
        io.emit('state_update', cronPayload);

        return { ok: true, yieldedToHuman: false, item: newItem, newsPost };
      };

      const designerCronTimer = setInterval(() => {
        runBotDesignerCronCycle(false);
      }, 30 * 60_000);
      designerCronTimer.unref();

      app.post(
        '/api/designer/cron-run',
        requireStaffRole(['admin', 'designer', 'cm']),
        (req: Request, res: Response) => {
          const force = Boolean((req.body ?? {})?.force);
          const result = runBotDesignerCronCycle(force);
          res.json(result);
        },
      );

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
                'Extraia a paleta de cores reais predominantes em hexadecimal (#RRGGBB), o padrão de textura, o corte/silhueta mais fiel, nome comercial elegante em português do Brasil, descrição curta de ateliê e preço justo em StarCoins (entre 140 e 1200 SC).',
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
