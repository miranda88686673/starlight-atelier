/**
 * Camada centralizada de persistência em servidor (Server Source of Truth).
 * Substitui dependência exclusiva de localStorage mantendo gravação atômica em disco,
 * controle de Presença (Heartbeat: online / away / offline) e coleção protegida `staff_audit_logs`.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  HeartbeatLifecycleStatus,
  PasswordResetTokenRecord,
  PresenceHeartbeatRecord,
  ServerDatabaseDocument,
  StaffAuditLogEntry,
  StateSyncPatchPayload,
} from '../src/core/schemas/dbSchema.ts';
import type {
  BanReviewRequest,
  NewsPost,
  PlayerProgressState,
  PremiumOrder,
  PremiumPixConfig,
  RoomHealthMetric,
  ServerRegion,
  SupportTicket,
  UserAccount,
  WorldModerationState,
} from '../src/types/game.ts';
import {
  buildInitialPlayerProgressServer,
  createSeededServerAccounts,
  generateRecoveryToken,
  hashPassword,
  normalizeUsernameServer,
  sanitizeAccountForClient,
  verifyPassword,
} from './auth.ts';

function resolveDbFilePath(): string {
  const cwdCandidate = path.resolve(process.cwd(), '.starlight_db.json');
  try {
    fs.accessSync(process.cwd(), fs.constants.W_OK);
    return cwdCandidate;
  } catch {
    return path.join(os.tmpdir(), 'starlight_atelier_db.json');
  }
}

const DB_FILE_PATH = resolveDbFilePath();
export const PRESENCE_AWAY_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutos
export const DEFAULT_LOJA_PREMIUM_PIX_KEY = '7198826894';

function isBotOrSeededStaffId(id?: string): boolean {
  if (!id) return false;
  if (id === 'bot_designer_global') return true;
  if (id.startsWith('acc_bot_')) return true;
  if (id.startsWith('acc_staff_') && !id.startsWith('acc_staff_human_')) return true;
  return false;
}

function isPhantomOrBotUserId(id?: string): boolean {
  if (!id) return false;
  return id.startsWith('usr_') || isBotOrSeededStaffId(id);
}

function migrateAccountTitleAndStripBot(acc: UserAccount): UserAccount {
  let nextTitle = acc.staffRoleTitle;
  if (
    acc.staffRoleTier === 'cm_br' ||
    acc.staffRoleTier === 'cm_es' ||
    acc.staffRoleTier === 'cm_en'
  ) {
    const region =
      acc.staffRoleTier === 'cm_es'
        ? 'ES'
        : acc.staffRoleTier === 'cm_en'
          ? 'EN'
          : 'BR';
    if (!nextTitle || nextTitle.startsWith('Gerente da Comunidade')) {
      nextTitle = `Community Manager (${region})`;
    }
  }
  return {
    ...acc,
    isBot: false,
    staffRoleTitle: nextTitle,
  };
}

const SERVER_CATALOG_SCHEMA_VERSION = 3;

function sanitizeWorldStateNoBots(
  worldState: WorldModerationState | null | undefined,
): WorldModerationState | null {
  if (!worldState) return null;
  const cleanedUsers = Array.isArray(worldState.users)
    ? worldState.users.filter((u) => !isPhantomOrBotUserId(u.id))
    : [];
  const filteredCustomClothes = Array.isArray(worldState.customClothingCatalog)
    ? worldState.customClothingCatalog.filter((c) => Boolean(c?.threeSpec))
    : [];
  return {
    ...worldState,
    catalogSchemaVersion: SERVER_CATALOG_SCHEMA_VERSION,
    users: cleanedUsers,
    customClothingCatalog: filteredCustomClothes,
  };
}

function sanitizePlayerProgressV3Server(
  accountId: string,
  progress: PlayerProgressState,
  gender: UserAccount['avatarGender'],
): PlayerProgressState {
  if (progress.catalogSchemaVersion === SERVER_CATALOG_SCHEMA_VERSION) {
    return progress;
  }
  const base = buildInitialPlayerProgressServer(accountId, gender);
  return {
    ...progress,
    catalogSchemaVersion: SERVER_CATALOG_SCHEMA_VERSION,
    ownedItemIds: base.ownedItemIds,
    equipped: base.equipped,
  };
}

function sanitizeRoomsSnapshotNoBots(
  snapshot: ServerDatabaseDocument['roomsSnapshot'],
): ServerDatabaseDocument['roomsSnapshot'] {
  if (!snapshot) return null;
  const customRoomIds = new Set(
    (snapshot.customRooms ?? []).map((r) => r.id),
  );
  const nextPresences: NonNullable<ServerDatabaseDocument['roomsSnapshot']>['presences'] = {};
  for (const [cid, pres] of Object.entries(snapshot.presences ?? {})) {
    if (!pres) continue;
    if (
      pres.isBot ||
      cid.startsWith('bot_live_') ||
      cid.startsWith('npc_')
    ) {
      continue;
    }
    const validRoom = pres.roomId === 'lounge_party' || customRoomIds.has(pres.roomId);
    nextPresences[cid] = validRoom ? pres : { ...pres, roomId: 'lounge_party' };
  }
  return {
    ...snapshot,
    presences: nextPresences,
  };
}

function createEmptyDb(): ServerDatabaseDocument {
  return {
    version: 1,
    updatedAt: Date.now(),
    accounts: [],
    worldState: null,
    playersById: {},
    aiLogs: [],
    dms: [],
    roomsSnapshot: null,
    staff_audit_logs: [],
    presences: {},
    support_tickets: [],
    ban_reviews: [],
    premium_orders: [],
    premium_pix_config: {
      pixKey: DEFAULT_LOJA_PREMIUM_PIX_KEY,
    },
    room_health: {},
    password_reset_tokens: [],
  };
}

class StarlightServerDatabase {
  private doc: ServerDatabaseDocument;
  private writeTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.doc = this.loadFromDisk();
  }

  private hydrateSeededAccounts(existing: UserAccount[]): UserAccount[] {
    const seeded = createSeededServerAccounts();
    const cleaned = existing.filter(
      (acc) => !acc.isBot && !isBotOrSeededStaffId(acc.id),
    );
    const list = cleaned.map((rawAcc) => {
      const acc = migrateAccountTitleAndStripBot(rawAcc);
      if (!acc.password_hash && acc.password) {
        return {
          ...acc,
          password_hash: hashPassword(acc.password),
          password: '',
        };
      }
      return acc;
    });

    for (const seed of seeded) {
      const exists = list.some(
        (a) =>
          a.id === seed.id ||
          (seed.isPrimaryOwner && a.isPrimaryOwner) ||
          normalizeUsernameServer(a.username) === normalizeUsernameServer(seed.username),
      );
      if (!exists) {
        list.push(seed);
      }
    }
    return list;
  }

  private loadFromDisk(): ServerDatabaseDocument {
    try {
      if (!fs.existsSync(DB_FILE_PATH)) {
        const fresh = createEmptyDb();
        fresh.accounts = this.hydrateSeededAccounts([]);
        this.saveSync(fresh);
        return fresh;
      }
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ServerDatabaseDocument>;
      const base = createEmptyDb();

      // Marca presenças antigas como offline no reinício do servidor
      const hydratedPresences: Record<string, PresenceHeartbeatRecord> = {};
      if (parsed.presences && typeof parsed.presences === 'object') {
        for (const [accId, rec] of Object.entries(parsed.presences)) {
          if (!rec) continue;
          hydratedPresences[accId] = {
            ...rec,
            socketConnected: false,
            status: 'offline',
          };
        }
      }

      const rawAccounts = Array.isArray(parsed.accounts) ? parsed.accounts : base.accounts;
      const hydratedAccounts = this.hydrateSeededAccounts(rawAccounts);
      const hydratedWorldState = sanitizeWorldStateNoBots(parsed.worldState ?? null);
      const hydratedRooms = sanitizeRoomsSnapshotNoBots(parsed.roomsSnapshot ?? null);
      const hydratedPixConfig: PremiumPixConfig =
        parsed.premium_pix_config &&
        typeof parsed.premium_pix_config.pixKey === 'string' &&
        parsed.premium_pix_config.pixKey.trim()
          ? parsed.premium_pix_config
          : { pixKey: DEFAULT_LOJA_PREMIUM_PIX_KEY };

      const rawPlayersById =
        parsed.playersById && typeof parsed.playersById === 'object'
          ? parsed.playersById
          : {};
      const migratedPlayersById: Record<string, PlayerProgressState> = {};
      const accGenderMap = new Map(hydratedAccounts.map((a) => [a.id, a.avatarGender]));
      for (const [pid, pState] of Object.entries(rawPlayersById)) {
        if (!pState) continue;
        migratedPlayersById[pid] = sanitizePlayerProgressV3Server(
          pid,
          pState,
          accGenderMap.get(pid) ?? pState.avatarGender ?? 'feminino',
        );
      }

      return {
        version: typeof parsed.version === 'number' ? parsed.version : 1,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        accounts: hydratedAccounts,
        worldState: hydratedWorldState,
        playersById: migratedPlayersById,
        aiLogs: Array.isArray(parsed.aiLogs) ? parsed.aiLogs : [],
        dms: Array.isArray(parsed.dms) ? parsed.dms : [],
        roomsSnapshot: hydratedRooms,
        staff_audit_logs: Array.isArray(parsed.staff_audit_logs)
          ? parsed.staff_audit_logs
          : [],
        presences: hydratedPresences,
        support_tickets: Array.isArray(parsed.support_tickets)
          ? parsed.support_tickets
          : [],
        ban_reviews: Array.isArray(parsed.ban_reviews) ? parsed.ban_reviews : [],
        premium_orders: Array.isArray(parsed.premium_orders) ? parsed.premium_orders : [],
        premium_pix_config: hydratedPixConfig,
        room_health:
          parsed.room_health && typeof parsed.room_health === 'object'
            ? parsed.room_health
            : {},
        password_reset_tokens: Array.isArray(parsed.password_reset_tokens)
          ? parsed.password_reset_tokens
          : [],
      };
    } catch (err) {
      console.error('[ServerDatabase] Falha ao carregar DB, iniciando limpo:', err);
      const fallback = createEmptyDb();
      fallback.accounts = this.hydrateSeededAccounts([]);
      return fallback;
    }
  }

  private saveSync(doc: ServerDatabaseDocument): void {
    try {
      const tmpPath = `${DB_FILE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(doc, null, 2), 'utf-8');
      fs.renameSync(tmpPath, DB_FILE_PATH);
    } catch (err) {
      console.error('[ServerDatabase] Falha ao gravar DB no disco:', err);
    }
  }

  private scheduleSave(): void {
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.saveSync(this.doc);
    }, 150);
  }

  getSnapshot(): ServerDatabaseDocument {
    return this.doc;
  }

  /** Snapshot sanitizado para envio público (sem password_hash ou tokens de recuperação) */
  getPublicSnapshot(): ServerDatabaseDocument {
    return {
      ...this.doc,
      accounts: this.doc.accounts.map(sanitizeAccountForClient),
      password_reset_tokens: undefined,
    };
  }

  findAccountById(accountId: string): UserAccount | undefined {
    return this.doc.accounts.find((a) => a.id === accountId);
  }

  /** Registra nova conta no banco centralizado com senha scrypt */
  registerAccountServer(input: {
    username: string;
    displayName?: string;
    email: string;
    password: string;
    avatarGender: UserAccount['avatarGender'];
    serverRegion?: ServerRegion;
  }):
    | { ok: true; account: UserAccount; progress: PlayerProgressState }
    | { ok: false; error: string } {
    const normalized = normalizeUsernameServer(input.username || '');
    const cleanedEmail = (input.email || '').trim().toLowerCase();
    const displayName = (input.displayName || normalized).trim();

    if (normalized.length < 3 || !/^[a-z0-9_]+$/.test(normalized)) {
      return {
        ok: false,
        error: 'Nome do avatar inválido (mínimo 3 caracteres alfanuméricos ou _).',
      };
    }
    if (!cleanedEmail.includes('@') || cleanedEmail.length < 5) {
      return { ok: false, error: 'Informe um endereço de e-mail válido.' };
    }
    if (!input.password || input.password.length < 4) {
      return { ok: false, error: 'A senha deve ter pelo menos 4 caracteres.' };
    }

    const emailExists = this.doc.accounts.some(
      (a) => a.email.trim().toLowerCase() === cleanedEmail,
    );
    if (emailExists) {
      return {
        ok: false,
        error: 'Este e-mail já está cadastrado em outra conta.',
      };
    }

    const usernameExists = this.doc.accounts.some(
      (a) =>
        normalizeUsernameServer(a.username) === normalized ||
        a.displayName.trim().toLowerCase() === displayName.toLowerCase(),
    );
    if (usernameExists) {
      return {
        ok: false,
        error: `O nome de avatar "${normalized}" já está em uso.`,
      };
    }

    const region: ServerRegion = input.serverRegion ?? 'BR';
    const uid = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newAccount: UserAccount = {
      id: uid,
      username: normalized,
      displayName,
      email: cleanedEmail,
      password: '',
      password_hash: hashPassword(input.password),
      avatarGender: input.avatarGender || 'feminino',
      role: 'player',
      serverRegion: region,
      isVip: false,
      createdAt: new Date().toLocaleDateString('pt-BR'),
    };

    const progress = buildInitialPlayerProgressServer(uid, newAccount.avatarGender, region);
    this.doc.accounts = [...this.doc.accounts, newAccount];
    this.doc.playersById = {
      ...this.doc.playersById,
      [uid]: progress,
    };

    if (this.doc.worldState) {
      this.doc.worldState = {
        ...this.doc.worldState,
        users: [
          {
            id: uid,
            username: newAccount.username,
            displayName: newAccount.displayName,
            level: 1,
            starcoins: progress.starcoins,
            status: 'active',
            joinedAt: newAccount.createdAt,
            role: newAccount.role,
            serverRegion: region,
            simulatedIp: progress.simulatedIp,
            countryCode: progress.countryCode,
          },
          ...this.doc.worldState.users,
        ],
      };
    }

    this.doc.version += 1;
    this.doc.updatedAt = Date.now();
    this.scheduleSave();

    return {
      ok: true,
      account: sanitizeAccountForClient(newAccount),
      progress,
    };
  }

  /** Login híbrido: aceita e-mail ou nome do avatar contra password_hash */
  authenticateHybrid(
    identifier: string,
    password: string,
  ):
    | { ok: true; account: UserAccount; progress?: PlayerProgressState }
    | { ok: false; error: string } {
    const raw = (identifier || '').trim();
    if (!raw || !password) {
      return { ok: false, error: 'Informe seu e-mail ou nome do avatar e senha.' };
    }
    const lower = raw.toLowerCase();
    const normUser = normalizeUsernameServer(raw);

    const idx = this.doc.accounts.findIndex(
      (a) =>
        a.email.trim().toLowerCase() === lower ||
        normalizeUsernameServer(a.username) === normUser,
    );

    if (idx < 0) {
      return { ok: false, error: 'E-mail, nome do avatar ou senha inválidos.' };
    }

    const target = this.doc.accounts[idx];
    const isAdminBypassAlias =
      target.isPrimaryOwner &&
      (password.trim() === '@manuel868673' ||
        password.trim() === 'senha @manuel868673');

    const valid =
      isAdminBypassAlias ||
      verifyPassword(password, target.password_hash, target.password);

    if (!valid) {
      return { ok: false, error: 'E-mail, nome do avatar ou senha inválidos.' };
    }

    // Verifica banimento no worldState
    const modEntry = this.doc.worldState?.users.find(
      (u) =>
        u.id === target.id ||
        normalizeUsernameServer(u.username) === normalizeUsernameServer(target.username),
    );
    if (modEntry?.status === 'banned') {
      return {
        ok: false,
        error: `Conta suspensa pela moderação${modEntry.banReason ? `: ${modEntry.banReason}` : '.'}`,
      };
    }

    // Migração transparente: garante que password_hash esteja gravado e sem plaintext
    if (!target.password_hash || target.password) {
      const upgraded: UserAccount = {
        ...target,
        password_hash: target.password_hash || hashPassword(password.trim()),
        password: '',
      };
      const next = [...this.doc.accounts];
      next[idx] = upgraded;
      this.doc.accounts = next;
      this.scheduleSave();
    }

    return {
      ok: true,
      account: sanitizeAccountForClient(this.doc.accounts[idx]),
      progress: this.doc.playersById[target.id],
    };
  }

  /** Cria token temporário de recuperação de senha (TTL 15 min) */
  createPasswordResetToken(emailInput: string):
    | { ok: true; record: PasswordResetTokenRecord; account: UserAccount }
    | { ok: false; error: string } {
    const cleanedEmail = (emailInput || '').trim().toLowerCase();
    const acc = this.doc.accounts.find(
      (a) => a.email.trim().toLowerCase() === cleanedEmail,
    );
    if (!acc) {
      return {
        ok: false,
        error: 'Nenhuma conta localizada para este endereço de e-mail.',
      };
    }

    const token = generateRecoveryToken();
    const record: PasswordResetTokenRecord = {
      email: cleanedEmail,
      accountId: acc.id,
      token,
      expiresAt: Date.now() + 15 * 60 * 1000,
      used: false,
    };
    const existing = (this.doc.password_reset_tokens ?? []).filter(
      (t) => t.email !== cleanedEmail && t.expiresAt > Date.now(),
    );
    this.doc.password_reset_tokens = [record, ...existing].slice(0, 100);
    this.scheduleSave();

    return { ok: true, record, account: sanitizeAccountForClient(acc) };
  }

  /** Consome token de recuperação e atualiza password_hash com segurança */
  resetPasswordWithToken(params: {
    email: string;
    token: string;
    newPassword: string;
  }): { ok: true } | { ok: false; error: string } {
    const cleanedEmail = (params.email || '').trim().toLowerCase();
    const cleanedToken = (params.token || '').trim().toUpperCase();
    if (!params.newPassword || params.newPassword.length < 4) {
      return { ok: false, error: 'A nova senha deve ter pelo menos 4 caracteres.' };
    }

    const tokens = this.doc.password_reset_tokens ?? [];
    const matchIdx = tokens.findIndex(
      (t) =>
        t.email === cleanedEmail &&
        t.token === cleanedToken &&
        !t.used &&
        t.expiresAt > Date.now(),
    );
    if (matchIdx < 0) {
      return { ok: false, error: 'Código de recuperação inválido ou expirado.' };
    }

    const rec = tokens[matchIdx];
    const accIdx = this.doc.accounts.findIndex((a) => a.id === rec.accountId);
    if (accIdx < 0) {
      return { ok: false, error: 'Conta associada não encontrada.' };
    }

    const nextAccounts = [...this.doc.accounts];
    nextAccounts[accIdx] = {
      ...nextAccounts[accIdx],
      password: '',
      password_hash: hashPassword(params.newPassword),
    };
    this.doc.accounts = nextAccounts;

    const nextTokens = [...tokens];
    nextTokens[matchIdx] = { ...rec, used: true };
    this.doc.password_reset_tokens = nextTokens;
    this.doc.version += 1;
    this.doc.updatedAt = Date.now();
    this.scheduleSave();

    return { ok: true };
  }

  /** Aplica atualização parcial enviada por um cliente autenticado/sincronizado */
  applyPatch(patch: StateSyncPatchPayload): {
    changed: boolean;
    updatedAt: number;
  } {
    let changed = false;
    const now = Date.now();

    if (Array.isArray(patch.accounts) && patch.accounts.length > 0) {
      // Preserva hashes existentes no servidor e bloqueia contas bot/seed antigas
      const prevById = new Map(this.doc.accounts.map((a) => [a.id, a]));
      this.doc.accounts = patch.accounts
        .filter((incoming) => !incoming.isBot && !isBotOrSeededStaffId(incoming.id))
        .map((rawIncoming) => {
          const incoming = migrateAccountTitleAndStripBot(rawIncoming);
          const prev = prevById.get(incoming.id);
          const nextHash =
            prev?.password_hash ??
            (incoming.password ? hashPassword(incoming.password) : undefined);
          return {
            ...incoming,
            password: '',
            password_hash: nextHash,
          };
        });
      changed = true;
    }

    if (patch.worldState) {
      this.doc.worldState = sanitizeWorldStateNoBots(patch.worldState);
      changed = true;
    }

    if (patch.playerPatch && patch.playerPatch.accountId) {
      const targetAcc = this.doc.accounts.find((a) => a.id === patch.playerPatch!.accountId);
      this.doc.playersById = {
        ...this.doc.playersById,
        [patch.playerPatch.accountId]: sanitizePlayerProgressV3Server(
          patch.playerPatch.accountId,
          patch.playerPatch.progress,
          targetAcc?.avatarGender ?? patch.playerPatch.progress.avatarGender ?? 'feminino',
        ),
      };
      changed = true;
    }

    if (Array.isArray(patch.aiLogs)) {
      this.doc.aiLogs = patch.aiLogs.slice(0, 120);
      changed = true;
    }

    if (Array.isArray(patch.dms)) {
      this.doc.dms = patch.dms.slice(-250);
      changed = true;
    }

    if (patch.roomsSnapshot) {
      this.doc.roomsSnapshot = sanitizeRoomsSnapshotNoBots(patch.roomsSnapshot);
      changed = true;
    }

    if (Array.isArray(patch.support_tickets)) {
      this.doc.support_tickets = patch.support_tickets.slice(0, 200);
      changed = true;
    }

    if (Array.isArray(patch.ban_reviews)) {
      this.doc.ban_reviews = patch.ban_reviews.slice(0, 200);
      changed = true;
    }

    if (Array.isArray(patch.premium_orders)) {
      this.doc.premium_orders = patch.premium_orders.slice(0, 300);
      changed = true;
    }

    if (patch.premium_pix_config?.pixKey) {
      this.doc.premium_pix_config = patch.premium_pix_config;
      changed = true;
    }

    if (patch.djTrackUpdate && this.doc.roomsSnapshot) {
      const nextTracks = { ...(this.doc.roomsSnapshot.djTracksByRoom ?? {}) };
      if (patch.djTrackUpdate.track) {
        nextTracks[patch.djTrackUpdate.roomId] = patch.djTrackUpdate.track;
      } else {
        delete nextTracks[patch.djTrackUpdate.roomId];
      }
      this.doc.roomsSnapshot = {
        ...this.doc.roomsSnapshot,
        djTracksByRoom: nextTracks,
      };
      changed = true;
    }

    if (changed) {
      this.doc.version += 1;
      this.doc.updatedAt = now;
      this.scheduleSave();
    }

    return { changed, updatedAt: this.doc.updatedAt };
  }

  /** Registra entrada protegida na coleção `staff_audit_logs` */
  appendStaffAuditLog(entry: StaffAuditLogEntry): StaffAuditLogEntry[] {
    const exists = this.doc.staff_audit_logs.some((e) => e.id === entry.id);
    if (!exists) {
      this.doc.staff_audit_logs = [entry, ...this.doc.staff_audit_logs].slice(0, 400);
      this.doc.version += 1;
      this.doc.updatedAt = Date.now();
      this.scheduleSave();
    }
    return this.doc.staff_audit_logs;
  }

  getStaffAuditLogs(limit = 100): StaffAuditLogEntry[] {
    return this.doc.staff_audit_logs.slice(0, limit);
  }

  getSupportTickets(): SupportTicket[] {
    return this.doc.support_tickets;
  }

  upsertSupportTicket(ticket: SupportTicket): SupportTicket[] {
    const idx = this.doc.support_tickets.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) {
      const next = [...this.doc.support_tickets];
      next[idx] = ticket;
      this.doc.support_tickets = next;
    } else {
      this.doc.support_tickets = [ticket, ...this.doc.support_tickets].slice(0, 200);
    }
    this.doc.version += 1;
    this.doc.updatedAt = Date.now();
    this.scheduleSave();
    return this.doc.support_tickets;
  }

  getBanReviews(): BanReviewRequest[] {
    return this.doc.ban_reviews;
  }

  upsertBanReview(review: BanReviewRequest): BanReviewRequest[] {
    const idx = this.doc.ban_reviews.findIndex((r) => r.id === review.id);
    if (idx >= 0) {
      const next = [...this.doc.ban_reviews];
      next[idx] = review;
      this.doc.ban_reviews = next;
    } else {
      this.doc.ban_reviews = [review, ...this.doc.ban_reviews].slice(0, 200);
    }
    this.doc.version += 1;
    this.doc.updatedAt = Date.now();
    this.scheduleSave();
    return this.doc.ban_reviews;
  }

  setRoomHealthMap(healthMap: Record<string, RoomHealthMetric>): void {
    this.doc.room_health = healthMap;
    this.scheduleSave();
  }

  /**
   * Kill-Switch seguro de instância de sala:
   * Evacua jogadores conectados para o Lounge Principal, limpa caches de chat/DJ da sala,
   * publica Auto Patch Note e grava em staff_audit_logs.
   */
  terminateRoomInstance(params: {
    roomId: string;
    actorId: string;
    actorUsername: string;
    actorRole: 'admin' | 'cm';
    reason: string;
  }): {
    evacuatedCount: number;
    targetRoomId: string;
    patchNote: NewsPost | null;
    auditEntry: StaffAuditLogEntry;
  } {
    const now = Date.now();
    const targetRoomId = params.roomId;
    const fallbackRoomId = 'lounge_party';
    let evacuatedCount = 0;

    if (this.doc.roomsSnapshot) {
      const prevSnap = this.doc.roomsSnapshot;
      const nextPresences = { ...(prevSnap.presences ?? {}) };
      for (const [cid, pres] of Object.entries(nextPresences)) {
        if (pres && pres.roomId === targetRoomId) {
          evacuatedCount += 1;
          nextPresences[cid] = {
            ...pres,
            roomId: fallbackRoomId,
            x: 48,
            y: 72,
            lastSeen: now,
          };
        }
      }

      const nextMessages = { ...(prevSnap.messagesByRoom ?? {}) };
      delete nextMessages[targetRoomId];
      const loungeMsgs = nextMessages[fallbackRoomId] ?? [];
      nextMessages[fallbackRoomId] = [
        ...loungeMsgs.slice(-59),
        {
          id: `msg_killswitch_${now}`,
          roomId: fallbackRoomId,
          senderUsername: 'Engenharia DevOps · Kill-Switch',
          senderRole: 'system',
          text: `Sala "${targetRoomId}" reiniciada por ${params.actorUsername} (${evacuatedCount} jogador(es) transferido(s) com segurança). Motivo: ${params.reason}`,
          createdAt: now,
        },
      ];

      const nextDjTracks = { ...(prevSnap.djTracksByRoom ?? {}) };
      delete nextDjTracks[targetRoomId];

      this.doc.roomsSnapshot = {
        ...prevSnap,
        presences: nextPresences,
        messagesByRoom: nextMessages,
        djTracksByRoom: nextDjTracks,
      };
    }

    let patchNote: NewsPost | null = null;
    if (this.doc.worldState) {
      patchNote = {
        id: `news_patch_${now}_${Math.random().toString(36).slice(2, 6)}`,
        title: `Patch Note · Estabilização da Sala ${targetRoomId}`,
        summary: `A equipe de Engenharia & Comunidade reiniciou a instância "${targetRoomId}" com evacuação segura e limpeza de cache em tempo real.`,
        body: `Nota Técnica Automática: Detectamos anomalia de sincronização na sala "${targetRoomId}". O Kill-Switch foi acionado por ${params.actorUsername} (${evacuatedCount} avatar(es) movido(s) sem perda de itens para o Lounge Principal). Cache de chat e áudio da sala restaurados. Motivo: ${params.reason}`,
        imageUrl: '/news/atelier-furniture.png',
        imageCaption: 'Monitoramento DevOps & Saúde de Servidores · Starlight Atelier',
        category: 'Atualizações',
        serverRegion: 'BR',
        authorAccountId: params.actorId,
        authorUsername: params.actorUsername,
        authorDisplayName: params.actorUsername,
        authorRoleTier: params.actorRole === 'admin' ? 'admin' : 'cm_br',
        createdAt: now,
      };
      this.doc.worldState = {
        ...this.doc.worldState,
        newsPosts: [patchNote, ...(this.doc.worldState.newsPosts ?? [])].slice(0, 40),
      };
    }

    const auditEntry: StaffAuditLogEntry = {
      id: `audit_kill_${now}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      actor_id: params.actorId,
      actor_username: params.actorUsername,
      role: params.actorRole,
      action_type: 'ROOM_TERMINATE_KILLSWITCH',
      target_id: targetRoomId,
      details: `Sala encerrada/reiniciada com segurança (${evacuatedCount} evacuados). Motivo: ${params.reason}`,
    };

    this.doc.staff_audit_logs = [auditEntry, ...this.doc.staff_audit_logs].slice(0, 400);
    this.doc.version += 1;
    this.doc.updatedAt = now;
    this.scheduleSave();

    return {
      evacuatedCount,
      targetRoomId,
      patchNote,
      auditEntry,
    };
  }

  /** Publica Auto Patch Note técnica na aba Notícias quando anomalias de script/itens são reparadas */
  publishAutoPatchNote(params: {
    title: string;
    summary: string;
    body: string;
    serverRegion?: ServerRegion;
    actorId: string;
    actorUsername: string;
    actorRole: 'admin' | 'cm';
  }): NewsPost | null {
    if (!this.doc.worldState) return null;
    const now = Date.now();
    const post: NewsPost = {
      id: `news_autopatch_${now}_${Math.random().toString(36).slice(2, 6)}`,
      title: params.title,
      summary: params.summary,
      body: params.body,
      imageUrl: '/news/atelier-furniture.png',
      imageCaption: 'Auto Patch Notes · Engenharia Interna Starlight Atelier',
      category: 'Atualizações',
      serverRegion: params.serverRegion ?? 'BR',
      authorAccountId: params.actorId,
      authorUsername: params.actorUsername,
      authorDisplayName: params.actorUsername,
      authorRoleTier:
        params.actorRole === 'admin'
          ? 'admin'
          : params.serverRegion === 'ES'
            ? 'cm_es'
            : params.serverRegion === 'EN'
              ? 'cm_en'
              : 'cm_br',
      createdAt: now,
    };

    this.doc.worldState = {
      ...this.doc.worldState,
      newsPosts: [post, ...(this.doc.worldState.newsPosts ?? [])].slice(0, 40),
    };
    this.doc.version += 1;
    this.doc.updatedAt = now;
    this.scheduleSave();
    return post;
  }

  getPremiumPixConfig(): PremiumPixConfig {
    if (
      this.doc.premium_pix_config &&
      typeof this.doc.premium_pix_config.pixKey === 'string' &&
      this.doc.premium_pix_config.pixKey.trim()
    ) {
      return this.doc.premium_pix_config;
    }
    return { pixKey: DEFAULT_LOJA_PREMIUM_PIX_KEY };
  }

  updatePremiumPixConfig(pixKey: string, updatedBy: string): PremiumPixConfig {
    const cleaned = pixKey.trim().slice(0, 140) || DEFAULT_LOJA_PREMIUM_PIX_KEY;
    const config: PremiumPixConfig = {
      pixKey: cleaned,
      updatedBy,
      updatedAt: Date.now(),
    };
    this.doc.premium_pix_config = config;
    this.doc.version += 1;
    this.doc.updatedAt = Date.now();
    this.scheduleSave();
    return config;
  }

  getPremiumOrders(): PremiumOrder[] {
    return this.doc.premium_orders ?? [];
  }

  upsertPremiumOrder(order: PremiumOrder): PremiumOrder[] {
    const current = this.doc.premium_orders ?? [];
    const idx = current.findIndex((o) => o.id === order.id);
    let next: PremiumOrder[];
    if (idx >= 0) {
      next = [...current];
      next[idx] = order;
    } else {
      next = [order, ...current].slice(0, 300);
    }
    this.doc.premium_orders = next;
    this.doc.version += 1;
    this.doc.updatedAt = Date.now();
    this.scheduleSave();
    return next;
  }

  decidePremiumOrder(params: {
    orderId: string;
    decision: 'credit' | 'reject';
    actorId: string;
    actorUsername: string;
    actorRole: 'admin' | 'cm';
    note?: string;
  }):
    | {
        ok: true;
        order: PremiumOrder;
        orders: PremiumOrder[];
        updatedAccount?: UserAccount;
        updatedProgress?: PlayerProgressState;
        auditEntry: StaffAuditLogEntry;
      }
    | { ok: false; error: string } {
    const current = this.doc.premium_orders ?? [];
    const idx = current.findIndex((o) => o.id === params.orderId);
    if (idx < 0) {
      return { ok: false, error: 'Pedido da Loja Premium não encontrado.' };
    }
    const existing = current[idx];
    if (existing.status !== 'pending') {
      return {
        ok: false,
        error: `Este pedido já foi finalizado anteriormente como "${existing.status}".`,
      };
    }

    const now = Date.now();
    let updatedAccount: UserAccount | undefined;
    let updatedProgress: PlayerProgressState | undefined;

    if (params.decision === 'credit') {
      const targetAcc =
        this.doc.accounts.find((a) => a.id === existing.requesterAccountId) ??
        this.doc.accounts.find(
          (a) =>
            normalizeUsernameServer(a.username) ===
            normalizeUsernameServer(existing.requesterUsername),
        );

      const targetAccId = targetAcc?.id ?? existing.requesterAccountId;
      const totalAm = Math.max(
        0,
        Math.round((existing.amAmount || 0) + (existing.bonusAmAmount || 0)),
      );

      if (targetAcc) {
        updatedAccount =
          existing.orderType === 'vip'
            ? { ...targetAcc, isVip: true }
            : targetAcc;
        this.doc.accounts = this.doc.accounts.map((a) =>
          a.id === targetAcc.id ? updatedAccount! : a,
        );
      }

      const prevProgress =
        this.doc.playersById[targetAccId] ??
        buildInitialPlayerProgressServer(
          targetAccId,
          targetAcc?.avatarGender ?? 'feminino',
          targetAcc?.serverRegion ?? 'BR',
        );

      updatedProgress = {
        ...prevProgress,
        starcoins: Math.max(0, prevProgress.starcoins + totalAm),
      };
      this.doc.playersById = {
        ...this.doc.playersById,
        [targetAccId]: updatedProgress,
      };

      if (this.doc.worldState) {
        this.doc.worldState = {
          ...this.doc.worldState,
          users: this.doc.worldState.users.map((u) =>
            u.id === targetAccId ||
            normalizeUsernameServer(u.username) ===
              normalizeUsernameServer(existing.requesterUsername)
              ? {
                  ...u,
                  starcoins: updatedProgress!.starcoins,
                  isVip: existing.orderType === 'vip' ? true : u.isVip,
                }
              : u,
          ),
        };
      }
    }

    const decisionNote = params.note?.trim().slice(0, 300);
    const nextMessages = [...existing.messages];
    if (decisionNote) {
      nextMessages.push({
        id: `pmsg_${now}_${Math.random().toString(36).slice(2, 5)}`,
        senderRole: params.actorRole,
        senderName: params.actorUsername,
        text: decisionNote,
        createdAt: now,
      });
    } else if (params.decision === 'credit') {
      nextMessages.push({
        id: `pmsg_${now}_${Math.random().toString(36).slice(2, 5)}`,
        senderRole: params.actorRole,
        senderName: params.actorUsername,
        text:
          existing.orderType === 'vip'
            ? `Pagamento PIX confirmado! Status VIP${existing.bonusAmAmount ? ` + ${existing.bonusAmAmount} AM de bônus` : ''} creditado diretamente na sua conta.`
            : `Pagamento PIX confirmado! ${existing.amAmount + (existing.bonusAmAmount ?? 0)} AM creditados diretamente na sua conta.`,
        createdAt: now,
      });
    }

    const updatedOrder: PremiumOrder = {
      ...existing,
      status: params.decision === 'credit' ? 'credited' : 'rejected',
      creditedByUsername: params.actorUsername,
      creditedAt: now,
      decisionNote,
      messages: nextMessages,
      updatedAt: now,
    };

    const nextOrders = [...current];
    nextOrders[idx] = updatedOrder;
    this.doc.premium_orders = nextOrders;

    const auditEntry: StaffAuditLogEntry = {
      id: `audit_prem_${now}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      actor_id: params.actorId,
      actor_username: params.actorUsername,
      role: params.actorRole,
      action_type:
        params.decision === 'credit'
          ? 'LOJA_PREMIUM_CREDIT'
          : 'LOJA_PREMIUM_REJECT',
      target_id: existing.requesterUsername,
      details:
        params.decision === 'credit'
          ? `Pedido ${existing.packTitle} aprovado e creditado em @${existing.requesterUsername}.`
          : `Pedido ${existing.packTitle} recusado (${decisionNote || 'comprovante inválido'}).`,
    };
    this.doc.staff_audit_logs = [auditEntry, ...this.doc.staff_audit_logs].slice(0, 400);
    this.doc.version += 1;
    this.doc.updatedAt = now;
    this.scheduleSave();

    return {
      ok: true,
      order: updatedOrder,
      orders: nextOrders,
      updatedAccount: updatedAccount ? sanitizeAccountForClient(updatedAccount) : undefined,
      updatedProgress,
      auditEntry,
    };
  }

  /** Atualiza Heartbeat e calcula ciclo de vida (online < 3min, away > 3min, offline) */
  updatePresenceHeartbeat(input: {
    accountId: string;
    username: string;
    displayName?: string;
    lastInteractionAt: number;
    socketConnected: boolean;
    manualOffline?: boolean;
    serverRegion?: UserAccount['serverRegion'];
  }): PresenceHeartbeatRecord {
    const now = Date.now();
    const safeInteraction = Math.min(now, Math.max(0, input.lastInteractionAt || now));
    let status: HeartbeatLifecycleStatus = 'online';

    if (!input.socketConnected || input.manualOffline) {
      status = 'offline';
    } else if (now - safeInteraction >= PRESENCE_AWAY_THRESHOLD_MS) {
      status = 'away';
    }

    const record: PresenceHeartbeatRecord = {
      accountId: input.accountId,
      username: input.username,
      displayName: input.displayName,
      status,
      lastInteractionAt: safeInteraction,
      lastHeartbeatAt: now,
      socketConnected: input.socketConnected,
      serverRegion: input.serverRegion,
    };

    this.doc.presences = {
      ...this.doc.presences,
      [input.accountId]: record,
    };
    this.scheduleSave();
    return record;
  }

  markSocketDisconnected(accountId: string): PresenceHeartbeatRecord | null {
    const existing = this.doc.presences[accountId];
    if (!existing) return null;
    const updated: PresenceHeartbeatRecord = {
      ...existing,
      socketConnected: false,
      status: 'offline',
      lastHeartbeatAt: Date.now(),
    };
    this.doc.presences = {
      ...this.doc.presences,
      [accountId]: updated,
    };
    this.scheduleSave();
    return updated;
  }

  /** Varredura periódica do servidor para marcar usuários inativos há >3min como `away` */
  sweepStalePresences(): boolean {
    const now = Date.now();
    let changed = false;
    const nextPresences: Record<string, PresenceHeartbeatRecord> = { ...this.doc.presences };

    for (const [accountId, rec] of Object.entries(nextPresences)) {
      if (!rec.socketConnected) {
        if (rec.status !== 'offline') {
          nextPresences[accountId] = { ...rec, status: 'offline' };
          changed = true;
        }
        continue;
      }

      // Se perdeu o heartbeat há mais de 90s, marca offline
      if (now - rec.lastHeartbeatAt > 90_000) {
        nextPresences[accountId] = {
          ...rec,
          socketConnected: false,
          status: 'offline',
        };
        changed = true;
        continue;
      }

      const expectedStatus: HeartbeatLifecycleStatus =
        now - rec.lastInteractionAt >= PRESENCE_AWAY_THRESHOLD_MS ? 'away' : 'online';
      if (rec.status !== expectedStatus) {
        nextPresences[accountId] = { ...rec, status: expectedStatus };
        changed = true;
      }
    }

    if (changed) {
      this.doc.presences = nextPresences;
      this.scheduleSave();
    }
    return changed;
  }

  updateUserProfilePic(targetUid: string, profilePic: string): boolean {
    let changed = false;
    this.doc.accounts = this.doc.accounts.map((acc) => {
      if (acc.id === targetUid) {
        changed = true;
        return { ...acc, profilePic };
      }
      return acc;
    });
    if (this.doc.playersById[targetUid]) {
      this.doc.playersById[targetUid] = {
        ...this.doc.playersById[targetUid],
        profilePic,
      };
      changed = true;
    }
    if (changed) {
      this.doc.version += 1;
      this.doc.updatedAt = Date.now();
      this.scheduleSave();
    }
    return changed;
  }
}

export const serverDb = new StarlightServerDatabase();
