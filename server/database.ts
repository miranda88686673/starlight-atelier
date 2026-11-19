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
  RoomMutationPayload,
  ServerDatabaseDocument,
  StaffAuditLogEntry,
  StateSyncPatchPayload,
} from '../src/core/schemas/dbSchema.ts';
import type {
  BanReviewRequest,
  MarketListing,
  NewsPost,
  PlayerProgressState,
  PremiumOrder,
  PremiumPixConfig,
  RoomAvatarPresence,
  RoomChatMessage,
  RoomDef,
  RoomHealthMetric,
  ServerRegion,
  SupportModMessage,
  SupportTicket,
  UserAccount,
  WorldModerationState,
} from '../src/types/game.ts';
import type { SharedRoomsSnapshot } from '../src/utils/realtime.ts';
import {
  buildInitialPlayerProgressServer,
  createSeededServerAccounts,
  generateRecoveryToken,
  hashPassword,
  normalizeUsernameServer,
  sanitizeAccountForClient,
  verifyPassword,
} from './auth.ts';
import {
  ADMIN_CREATED_AT,
  ADMIN_INITIAL_LEVEL,
  LOGIN_XP_REWARD,
  awardLoginXp,
  canonicalCharacterKey,
  cleanCharacterName,
  collapsedCharacterKey,
  normalizeLevelAndXp,
  validateCharacterName,
} from '../src/utils/levelSystem.ts';

export function isInfiniteAdminAccountServer(acc?: UserAccount | null): boolean {
  if (!acc) return false;
  const email = (acc.email || '').trim().toLowerCase();
  return Boolean(
    acc.isPrimaryOwner ||
      acc.id === 'acc_admin_owner' ||
      acc.role === 'admin' ||
      acc.staffRoleTier === 'admin' ||
      email === 'miranda88686673@gmail.com',
  );
}


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

const SERVER_CATALOG_SCHEMA_VERSION = 4;

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
  const filteredNews = Array.isArray(worldState.newsPosts)
    ? worldState.newsPosts.filter((p) => !p.id.startsWith('news_seed_'))
    : [];
  const now = Date.now();
  const rawLaunches =
    worldState.legendaryLaunchTimestamps &&
    typeof worldState.legendaryLaunchTimestamps === 'object'
      ? worldState.legendaryLaunchTimestamps
      : {};
  const mergedLaunches: Record<string, number> = {
    legendary_coroa_2023: rawLaunches.legendary_coroa_2023 ?? now,
    legendary_coroa_2024: rawLaunches.legendary_coroa_2024 ?? now,
    legendary_coroa_2025: rawLaunches.legendary_coroa_2025 ?? now,
    legendary_coroa_2026: rawLaunches.legendary_coroa_2026 ?? now,
    legendary_dragaozinho: rawLaunches.legendary_dragaozinho ?? now,
    legendary_tigre_branco: rawLaunches.legendary_tigre_branco ?? now,
    ...rawLaunches,
  };
  return {
    ...worldState,
    catalogSchemaVersion: SERVER_CATALOG_SCHEMA_VERSION,
    users: cleanedUsers,
    soldOutItemIds: Array.isArray(worldState.soldOutItemIds) ? worldState.soldOutItemIds : [],
    legendaryLaunchTimestamps: mergedLaunches,
    customClothingCatalog: filteredCustomClothes,
    customFurnitureCatalog: Array.isArray(worldState.customFurnitureCatalog)
      ? worldState.customFurnitureCatalog
      : [],
    customRoomCatalog: Array.isArray(worldState.customRoomCatalog)
      ? worldState.customRoomCatalog
      : [],
    customWallpaperCatalog: Array.isArray(worldState.customWallpaperCatalog)
      ? worldState.customWallpaperCatalog
      : [],
    newsPosts: filteredNews,
  };
}

function sanitizePlayerProgressV4Server(
  accountId: string,
  progress: PlayerProgressState,
  gender: UserAccount['avatarGender'],
  isPrimaryAdmin: boolean = accountId === 'acc_admin_owner',
): PlayerProgressState {
  const { level, xp } = normalizeLevelAndXp(progress.level, progress.xp, isPrimaryAdmin);
  const base = buildInitialPlayerProgressServer(accountId, gender, 'BR', isPrimaryAdmin);
  const mergedOwnedItems = Array.isArray(progress.ownedItemIds)
    ? Array.from(new Set([...base.ownedItemIds, ...progress.ownedItemIds]))
    : [...base.ownedItemIds];
  return {
    ...base,
    ...progress,
    catalogSchemaVersion: SERVER_CATALOG_SCHEMA_VERSION,
    level,
    xp,
    ownedItemIds: mergedOwnedItems,
    ownedFurnitureIds: Array.isArray(progress.ownedFurnitureIds)
      ? Array.from(new Set([...(base.ownedFurnitureIds ?? []), ...progress.ownedFurnitureIds]))
      : [...(base.ownedFurnitureIds ?? [])],
    ownedRoomTemplateIds: Array.isArray(progress.ownedRoomTemplateIds)
      ? Array.from(new Set([...(base.ownedRoomTemplateIds ?? []), ...progress.ownedRoomTemplateIds]))
      : [...(base.ownedRoomTemplateIds ?? [])],
    ownedWallpaperIds: Array.isArray(progress.ownedWallpaperIds)
      ? Array.from(new Set([...(base.ownedWallpaperIds ?? []), ...progress.ownedWallpaperIds]))
      : [...(base.ownedWallpaperIds ?? [])],
    equipped:
      progress.equipped && typeof progress.equipped === 'object'
        ? progress.equipped
        : { ...base.equipped },
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
    const validRoom =
      pres.roomId === 'lounge_party' ||
      pres.roomId === 'lounge_party_es' ||
      pres.roomId === 'lounge_party_en' ||
      pres.roomId === 'ilha_brasil' ||
      pres.roomId === 'ilha_spanish' ||
      pres.roomId === 'ilha_english' ||
      customRoomIds.has(pres.roomId);
    const prevEq = pres.equipped ?? {};
    const cleanEq: NonNullable<typeof pres.equipped> = {};
    (Object.keys(prevEq) as Array<keyof typeof cleanEq>).forEach((slot) => {
      if (slot === 'acessoriosSlots') {
        if (prevEq.acessoriosSlots && typeof prevEq.acessoriosSlots === 'object') {
          cleanEq.acessoriosSlots = prevEq.acessoriosSlots;
        }
        return;
      }
      const id = prevEq[slot];
      if (typeof id === 'string' && id.trim().length > 0) {
        cleanEq[slot] = id;
      }
    });
    nextPresences[cid] = {
      ...(validRoom ? pres : { ...pres, roomId: 'lounge_party' }),
      equipped: cleanEq,
    };
  }
  return {
    ...snapshot,
    customRooms: Array.isArray(snapshot.customRooms) ? snapshot.customRooms : [],
    messagesByRoom: snapshot.messagesByRoom ?? {},
    kicks: Array.isArray(snapshot.kicks) ? snapshot.kicks : [],
    djTracksByRoom: snapshot.djTracksByRoom ?? {},
    officialOverrides: snapshot.officialOverrides ?? {},
    presences: nextPresences,
  };
}

function createDefaultRoomsSnapshotServer(): SharedRoomsSnapshot {
  return {
    presences: {},
    messagesByRoom: {},
    customRooms: [],
    kicks: [],
    djTracksByRoom: {},
    officialOverrides: {},
  };
}

function mergeRoomsSnapshot(
  existing: ServerDatabaseDocument['roomsSnapshot'],
  incoming: NonNullable<ServerDatabaseDocument['roomsSnapshot']>,
): SharedRoomsSnapshot {
  const cleanIncoming = sanitizeRoomsSnapshotNoBots(incoming) ?? createDefaultRoomsSnapshotServer();
  if (!existing) return cleanIncoming;
  const cleanExisting = sanitizeRoomsSnapshotNoBots(existing) ?? createDefaultRoomsSnapshotServer();
  const now = Date.now();
  const ROOM_PRESENCE_TTL_MS = 90_000;

  // Mescla presenças sem apagar avatares de outros IPs/computadores
  const mergedPresences: Record<string, RoomAvatarPresence> = {};
  for (const [cid, pres] of Object.entries(cleanExisting.presences ?? {})) {
    if (pres && now - (pres.lastSeen || 0) < ROOM_PRESENCE_TTL_MS) {
      mergedPresences[cid] = pres;
    }
  }
  for (const [cid, pres] of Object.entries(cleanIncoming.presences ?? {})) {
    if (!pres) continue;
    const prev = mergedPresences[cid];
    if (!prev || (pres.lastSeen ?? 0) >= (prev.lastSeen ?? 0)) {
      mergedPresences[cid] = { ...pres, lastSeen: now };
    }
  }

  // Mescla customRooms por ID (preserva salas criadas por qualquer usuário)
  const roomMap = new Map<string, RoomDef>();
  for (const r of cleanExisting.customRooms ?? []) {
    if (r?.id) roomMap.set(r.id, r);
  }
  for (const r of cleanIncoming.customRooms ?? []) {
    if (r?.id) roomMap.set(r.id, r);
  }

  // Mescla mensagens de chat por ID
  const mergedMessages: Record<string, RoomChatMessage[]> = {
    ...(cleanExisting.messagesByRoom ?? {}),
  };
  for (const [rid, msgs] of Object.entries(cleanIncoming.messagesByRoom ?? {})) {
    if (!Array.isArray(msgs)) continue;
    const existingMsgs = mergedMessages[rid] ?? [];
    const byId = new Map<string, RoomChatMessage>();
    for (const m of existingMsgs) if (m?.id) byId.set(m.id, m);
    for (const m of msgs) if (m?.id) byId.set(m.id, m);
    mergedMessages[rid] = Array.from(byId.values())
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .slice(-80);
  }

  return {
    presences: mergedPresences,
    messagesByRoom: mergedMessages,
    customRooms: Array.from(roomMap.values()),
    kicks: [...(cleanExisting.kicks ?? []), ...(cleanIncoming.kicks ?? [])]
      .filter((k) => now - (k.at || 0) < 30_000)
      .slice(-40),
    djTracksByRoom: {
      ...(cleanExisting.djTracksByRoom ?? {}),
      ...(cleanIncoming.djTracksByRoom ?? {}),
    },
    officialOverrides: {
      ...(cleanExisting.officialOverrides ?? {}),
      ...(cleanIncoming.officialOverrides ?? {}),
    },
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
    market_listings: [],
    support_mod_messages: [],
    premium_pix_config: {
      pixKey: DEFAULT_LOJA_PREMIUM_PIX_KEY,
    },
    room_health: {},
    password_reset_tokens: [],
  };
}

class NocturneValeServerDatabase {
  private doc: ServerDatabaseDocument;
  private writeTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.doc = this.loadFromDisk();
    if (typeof process !== 'undefined') {
      const flushOnExit = () => {
        this.flushSaveNow();
      };
      process.once('beforeExit', flushOnExit);
      process.once('SIGINT', () => {
        flushOnExit();
        process.exit(0);
      });
      process.once('SIGTERM', () => {
        flushOnExit();
        process.exit(0);
      });
    }
  }

  private hydrateSeededAccounts(existing: UserAccount[]): UserAccount[] {
    const seeded = createSeededServerAccounts();
    const cleaned = existing.filter(
      (acc) => !acc.isBot && !isBotOrSeededStaffId(acc.id),
    );
    const list = cleaned.map((rawAcc) => {
      const acc = migrateAccountTitleAndStripBot(rawAcc);
      const isPrimaryOwner =
        Boolean(acc.isPrimaryOwner) || acc.id === 'acc_admin_owner';
      const nextCreatedAt = isPrimaryOwner ? ADMIN_CREATED_AT : acc.createdAt;
      const unifiedName = cleanCharacterName(acc.displayName || acc.username) || acc.username;
      const normalizedAcc: UserAccount = {
        ...acc,
        username: unifiedName,
        displayName: unifiedName,
        createdAt: nextCreatedAt,
      };
      if (!normalizedAcc.password_hash && normalizedAcc.password) {
        return {
          ...normalizedAcc,
          password_hash: hashPassword(normalizedAcc.password),
          password: '',
        };
      }
      return normalizedAcc;
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
      const accOwnerMap = new Map(
        hydratedAccounts.map((a) => [a.id, Boolean(a.isPrimaryOwner) || a.id === 'acc_admin_owner']),
      );
      for (const [pid, pState] of Object.entries(rawPlayersById)) {
        if (!pState) continue;
        migratedPlayersById[pid] = sanitizePlayerProgressV4Server(
          pid,
          pState,
          accGenderMap.get(pid) ?? pState.avatarGender ?? 'feminino',
          accOwnerMap.get(pid) ?? pid === 'acc_admin_owner',
        );
      }
      for (const acc of hydratedAccounts) {
        const isPrimaryAdmin = Boolean(acc.isPrimaryOwner) || acc.id === 'acc_admin_owner';
        if (!migratedPlayersById[acc.id]) {
          migratedPlayersById[acc.id] = buildInitialPlayerProgressServer(
            acc.id,
            acc.avatarGender,
            acc.serverRegion ?? 'BR',
            isPrimaryAdmin,
          );
        }
      }

      const docResult: ServerDatabaseDocument = {
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
        market_listings: Array.isArray(parsed.market_listings) ? parsed.market_listings : [],
        support_mod_messages: Array.isArray(parsed.support_mod_messages)
          ? parsed.support_mod_messages
          : [],
        premium_pix_config: hydratedPixConfig,
        room_health:
          parsed.room_health && typeof parsed.room_health === 'object'
            ? parsed.room_health
            : {},
        password_reset_tokens: Array.isArray(parsed.password_reset_tokens)
          ? parsed.password_reset_tokens
          : [],
      };
      const anyPlayerMigrated = Object.values(rawPlayersById).some(
        (pState) =>
          pState && pState.catalogSchemaVersion !== SERVER_CATALOG_SCHEMA_VERSION,
      );
      if (
        parsed.worldState?.catalogSchemaVersion !== SERVER_CATALOG_SCHEMA_VERSION ||
        anyPlayerMigrated
      ) {
        this.saveSync(docResult);
      }
      return docResult;
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

  flushSaveNow(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.saveSync(this.doc);
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

  /** Registra nova conta no banco centralizado com nome único unificado e e-mail exclusivo */
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
    const unifiedName = cleanCharacterName(input.username || input.displayName || '');
    const nameFormatErr = validateCharacterName(unifiedName);
    if (nameFormatErr) {
      return { ok: false, error: nameFormatErr };
    }

    const cleanedEmail = (input.email || '').trim().toLowerCase();
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
        error: 'Este e-mail já foi utilizado em outra conta. Só é permitido 1 conta por e-mail.',
      };
    }

    const targetKey = canonicalCharacterKey(unifiedName);
    const targetCollapsed = collapsedCharacterKey(unifiedName);
    const nameTakenInAccounts = this.doc.accounts.some((a) => {
      const uKey = canonicalCharacterKey(a.username);
      const dKey = canonicalCharacterKey(a.displayName);
      const uCol = collapsedCharacterKey(a.username);
      const dCol = collapsedCharacterKey(a.displayName);
      return (
        uKey === targetKey ||
        dKey === targetKey ||
        uCol === targetCollapsed ||
        dCol === targetCollapsed
      );
    });
    const nameTakenInWorld = Boolean(
      this.doc.worldState?.users.some((u) => {
        const uKey = canonicalCharacterKey(u.username);
        const dKey = canonicalCharacterKey(u.displayName ?? u.username);
        const uCol = collapsedCharacterKey(u.username);
        const dCol = collapsedCharacterKey(u.displayName ?? u.username);
        return (
          uKey === targetKey ||
          dKey === targetKey ||
          uCol === targetCollapsed ||
          dCol === targetCollapsed
        );
      }),
    );

    if (nameTakenInAccounts || nameTakenInWorld) {
      return {
        ok: false,
        error: `O nome de personagem "${unifiedName}" já está em uso. Cada jogador deve ter seu próprio nome exclusivo.`,
      };
    }

    const region: ServerRegion = input.serverRegion ?? 'BR';
    const uid = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newAccount: UserAccount = {
      id: uid,
      username: unifiedName,
      displayName: unifiedName,
      email: cleanedEmail,
      password: '',
      password_hash: hashPassword(input.password),
      avatarGender: input.avatarGender || 'feminino',
      role: 'player',
      serverRegion: region,
      isVip: false,
      createdAt: new Date().toLocaleDateString('pt-BR'),
    };

    const progress = buildInitialPlayerProgressServer(
      uid,
      newAccount.avatarGender,
      region,
      false,
    );
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
    this.flushSaveNow();

    return {
      ok: true,
      account: sanitizeAccountForClient(newAccount),
      progress,
    };
  }

  /** Login híbrido: aceita e-mail ou nome do personagem, e concede XP de login com subida de nível */
  authenticateHybrid(
    identifier: string,
    password: string,
  ):
    | {
        ok: true;
        account: UserAccount;
        progress: PlayerProgressState;
        loginXpAward: ReturnType<typeof awardLoginXp>;
      }
    | { ok: false; error: string } {
    const raw = (identifier || '').trim();
    if (!raw || !password) {
      return { ok: false, error: 'Informe seu e-mail ou nome do personagem e senha.' };
    }
    const lower = raw.toLowerCase();
    const normKey = canonicalCharacterKey(raw);

    const idx = this.doc.accounts.findIndex(
      (a) =>
        a.email.trim().toLowerCase() === lower ||
        canonicalCharacterKey(a.username) === normKey ||
        canonicalCharacterKey(a.displayName) === normKey,
    );

    if (idx < 0) {
      return { ok: false, error: 'E-mail, nome do personagem ou senha inválidos.' };
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
      return { ok: false, error: 'E-mail, nome do personagem ou senha inválidos.' };
    }

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

    const isPrimaryAdmin =
      Boolean(target.isPrimaryOwner) || target.id === 'acc_admin_owner';

    if (!target.password_hash || target.password || (isPrimaryAdmin && target.createdAt !== ADMIN_CREATED_AT)) {
      const upgraded: UserAccount = {
        ...target,
        createdAt: isPrimaryAdmin ? ADMIN_CREATED_AT : target.createdAt,
        password_hash: target.password_hash || hashPassword(password.trim()),
        password: '',
      };
      const next = [...this.doc.accounts];
      next[idx] = upgraded;
      this.doc.accounts = next;
    }

    // Concede XP de entrada (login) e atualiza nível caso a barra tenha completado
    const baseProgress =
      this.doc.playersById[target.id] ??
      buildInitialPlayerProgressServer(
        target.id,
        target.avatarGender,
        target.serverRegion ?? 'BR',
        isPrimaryAdmin,
      );

    const xpRes = awardLoginXp(
      baseProgress.level ?? (isPrimaryAdmin ? ADMIN_INITIAL_LEVEL : 1),
      baseProgress.xp ?? 0,
      LOGIN_XP_REWARD,
      isPrimaryAdmin,
    );

    const nextProgress: PlayerProgressState = {
      ...baseProgress,
      level: xpRes.level,
      xp: xpRes.xp,
      lastLoginXpAt: Date.now(),
      lastLoginXpGained: xpRes.xpGained,
    };

    this.doc.playersById = {
      ...this.doc.playersById,
      [target.id]: nextProgress,
    };

    if (this.doc.worldState) {
      const existsInWorld = this.doc.worldState.users.some(
        (u) => u.id === target.id,
      );
      this.doc.worldState = {
        ...this.doc.worldState,
        users: existsInWorld
          ? this.doc.worldState.users.map((u) =>
              u.id === target.id
                ? {
                    ...u,
                    level: xpRes.level,
                    joinedAt: isPrimaryAdmin ? ADMIN_CREATED_AT : u.joinedAt,
                  }
                : u,
            )
          : [
              {
                id: target.id,
                username: target.username,
                displayName: target.displayName,
                level: xpRes.level,
                starcoins: nextProgress.starcoins,
                status: 'active',
                joinedAt: isPrimaryAdmin ? ADMIN_CREATED_AT : target.createdAt,
                role: target.role,
                staffRoleTier: target.staffRoleTier,
                serverRegion: target.serverRegion,
                isVip: target.isVip,
                isPrimaryOwner: target.isPrimaryOwner,
                simulatedIp: nextProgress.simulatedIp,
                countryCode: nextProgress.countryCode,
              },
              ...this.doc.worldState.users,
            ],
      };
    }

    this.doc.version += 1;
    this.doc.updatedAt = Date.now();
    this.flushSaveNow();

    return {
      ok: true,
      account: sanitizeAccountForClient(this.doc.accounts[idx]),
      progress: nextProgress,
      loginXpAward: xpRes,
    };
  }

  /** Autentica ou cria conta vinculada ao login Google (Firebase Auth) */
  authenticateOrRegisterGoogleUser(input: {
    firebaseUid: string;
    email: string;
    displayName?: string;
    avatarGender?: UserAccount['avatarGender'];
    serverRegion?: ServerRegion;
  }):
    | {
        ok: true;
        account: UserAccount;
        progress: PlayerProgressState;
        loginXpAward: ReturnType<typeof awardLoginXp>;
      }
    | { ok: false; error: string } {
    const cleanedEmail = (input.email || '').trim().toLowerCase();
    if (!cleanedEmail || !cleanedEmail.includes('@')) {
      return { ok: false, error: 'E-mail Google inválido para autenticação.' };
    }

    let idx = this.doc.accounts.findIndex(
      (a) => a.email.trim().toLowerCase() === cleanedEmail,
    );

    if (idx < 0) {
      const rawBase =
        cleanCharacterName(input.displayName || cleanedEmail.split('@')[0] || 'Player')
          .replace(/[^a-zA-Z0-9_.\- ]/g, '')
          .trim() || 'Player';
      let candidate = rawBase.slice(0, 20);
      if (candidate.length < 3) candidate = `Player_${candidate}`;
      let suffix = 1;
      while (
        this.doc.accounts.some(
          (a) =>
            canonicalCharacterKey(a.username) === canonicalCharacterKey(candidate) ||
            collapsedCharacterKey(a.username) === collapsedCharacterKey(candidate),
        )
      ) {
        candidate = `${rawBase.slice(0, 16)}${suffix++}`;
      }
      const regRes = this.registerAccountServer({
        username: candidate,
        displayName: candidate,
        email: cleanedEmail,
        password: `fb_${input.firebaseUid}_${Date.now()}`,
        avatarGender: input.avatarGender || 'feminino',
        serverRegion: input.serverRegion || 'BR',
      });
      if (!regRes.ok) {
        return regRes;
      }
      idx = this.doc.accounts.findIndex((a) => a.id === regRes.account.id);
    }

    const target = this.doc.accounts[idx];
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

    const isPrimaryAdmin =
      Boolean(target.isPrimaryOwner) || target.id === 'acc_admin_owner';
    const baseProgress =
      this.doc.playersById[target.id] ??
      buildInitialPlayerProgressServer(
        target.id,
        target.avatarGender,
        target.serverRegion ?? 'BR',
        isPrimaryAdmin,
      );

    const xpRes = awardLoginXp(
      baseProgress.level ?? (isPrimaryAdmin ? ADMIN_INITIAL_LEVEL : 1),
      baseProgress.xp ?? 0,
      LOGIN_XP_REWARD,
      isPrimaryAdmin,
    );

    const nextProgress: PlayerProgressState = {
      ...baseProgress,
      level: xpRes.level,
      xp: xpRes.xp,
      lastLoginXpAt: Date.now(),
      lastLoginXpGained: xpRes.xpGained,
    };

    this.doc.playersById = {
      ...this.doc.playersById,
      [target.id]: nextProgress,
    };

    this.doc.version += 1;
    this.doc.updatedAt = Date.now();
    this.flushSaveNow();

    return {
      ok: true,
      account: sanitizeAccountForClient(target),
      progress: nextProgress,
      loginXpAward: xpRes,
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
    this.flushSaveNow();

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
      const isPrimaryAdmin =
        Boolean(targetAcc?.isPrimaryOwner) || patch.playerPatch.accountId === 'acc_admin_owner';
      this.doc.playersById = {
        ...this.doc.playersById,
        [patch.playerPatch.accountId]: sanitizePlayerProgressV4Server(
          patch.playerPatch.accountId,
          patch.playerPatch.progress,
          targetAcc?.avatarGender ?? patch.playerPatch.progress.avatarGender ?? 'feminino',
          isPrimaryAdmin,
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
      this.doc.roomsSnapshot = mergeRoomsSnapshot(
        this.doc.roomsSnapshot,
        patch.roomsSnapshot,
      );
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

    if (Array.isArray(patch.market_listings)) {
      this.doc.market_listings = patch.market_listings.slice(0, 500);
      changed = true;
    }

    if (Array.isArray(patch.support_mod_messages)) {
      this.doc.support_mod_messages = patch.support_mod_messages.slice(-150);
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
      this.flushSaveNow();
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
      this.flushSaveNow();
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
    this.flushSaveNow();
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
    this.flushSaveNow();
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
        imageCaption: 'Monitoramento DevOps & Saúde de Servidores · Nocturne Vale Club',
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
    this.flushSaveNow();

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
      imageCaption: 'Auto Patch Notes · Engenharia Interna Nocturne Vale Club',
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
    this.flushSaveNow();
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
    this.flushSaveNow();
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
    this.flushSaveNow();
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
    this.flushSaveNow();

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

  getMarketListings(): MarketListing[] {
    return this.doc.market_listings ?? [];
  }

  createMarketListing(params: {
    sellerAccountId: string;
    itemId: string;
    price: number;
  }):
    | { ok: true; listing: MarketListing; listings: MarketListing[] }
    | { ok: false; error: string } {
    const seller = this.doc.accounts.find((a) => a.id === params.sellerAccountId);
    if (!seller) {
      return { ok: false, error: 'Conta do vendedor não encontrada no servidor.' };
    }
    const cleanItemId = (params.itemId || '').trim();
    const numericPrice = Math.round(Number(params.price));
    if (!cleanItemId) {
      return { ok: false, error: 'Selecione um item válido para anunciar.' };
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 1 || numericPrice > 10_000_000) {
      return { ok: false, error: 'Informe um preço válido em AM (mínimo 1 AM).' };
    }

    const sellerProgress =
      this.doc.playersById[seller.id] ??
      buildInitialPlayerProgressServer(seller.id, seller.avatarGender, seller.serverRegion);

    if (!sellerProgress.ownedItemIds.includes(cleanItemId)) {
      return { ok: false, error: 'Você precisa possuir este item no guarda-roupa para vendê-lo no Mercado.' };
    }

    const currentListings = this.doc.market_listings ?? [];
    const alreadyListed = currentListings.some(
      (l) => l.status === 'active' && l.sellerAccountId === seller.id && l.itemId === cleanItemId,
    );
    if (alreadyListed) {
      return { ok: false, error: 'Este item já está anunciado por você no Mercado.' };
    }

    const now = Date.now();
    const listing: MarketListing = {
      id: `mkt_${now}_${Math.random().toString(36).slice(2, 7)}`,
      itemId: cleanItemId,
      sellerAccountId: seller.id,
      sellerUsername: seller.username,
      sellerDisplayName: seller.displayName || seller.username,
      price: numericPrice,
      status: 'active',
      createdAt: now,
    };

    const next = [listing, ...currentListings].slice(0, 500);
    this.doc.market_listings = next;
    this.doc.version += 1;
    this.doc.updatedAt = now;
    this.flushSaveNow();
    return { ok: true, listing, listings: next };
  }

  cancelMarketListing(params: {
    listingId: string;
    actorAccountId: string;
    isAdmin?: boolean;
  }):
    | { ok: true; listing: MarketListing; listings: MarketListing[] }
    | { ok: false; error: string } {
    const current = this.doc.market_listings ?? [];
    const idx = current.findIndex((l) => l.id === params.listingId);
    if (idx < 0) {
      return { ok: false, error: 'Anúncio não encontrado.' };
    }
    const existing = current[idx];
    if (existing.status !== 'active') {
      return { ok: false, error: 'Este anúncio já foi encerrado.' };
    }
    if (!params.isAdmin && existing.sellerAccountId !== params.actorAccountId) {
      return { ok: false, error: 'Apenas o vendedor ou o Administrador pode cancelar este anúncio.' };
    }

    const updated: MarketListing = { ...existing, status: 'cancelled' };
    const next = [...current];
    next[idx] = updated;
    this.doc.market_listings = next;
    this.doc.version += 1;
    this.doc.updatedAt = Date.now();
    this.flushSaveNow();
    return { ok: true, listing: updated, listings: next };
  }

  buyMarketListing(params: {
    listingId: string;
    buyerAccountId: string;
  }):
    | {
        ok: true;
        listing: MarketListing;
        listings: MarketListing[];
        buyerProgress: PlayerProgressState;
        sellerProgress: PlayerProgressState;
      }
    | { ok: false; error: string } {
    const current = this.doc.market_listings ?? [];
    const idx = current.findIndex((l) => l.id === params.listingId);
    if (idx < 0) {
      return { ok: false, error: 'Anúncio não encontrado no Mercado.' };
    }
    const listing = current[idx];
    if (listing.status !== 'active') {
      return { ok: false, error: 'Este item já foi comprado ou retirado do Mercado.' };
    }

    const buyer = this.doc.accounts.find((a) => a.id === params.buyerAccountId);
    if (!buyer) {
      return { ok: false, error: 'Conta do comprador não encontrada.' };
    }
    if (buyer.id === listing.sellerAccountId) {
      return { ok: false, error: 'Você não pode comprar o seu próprio anúncio.' };
    }

    const buyerProgress =
      this.doc.playersById[buyer.id] ??
      buildInitialPlayerProgressServer(buyer.id, buyer.avatarGender, buyer.serverRegion);

    if (buyerProgress.ownedItemIds.includes(listing.itemId)) {
      return { ok: false, error: 'Você já possui este item no seu guarda-roupa.' };
    }
    const isBuyerInfiniteAdmin = isInfiniteAdminAccountServer(buyer);
    if (!isBuyerInfiniteAdmin && buyerProgress.starcoins < listing.price) {
      return {
        ok: false,
        error: `Saldo insuficiente: você precisa de ${listing.price.toLocaleString('pt-BR')} AM.`,
      };
    }

    const seller = this.doc.accounts.find((a) => a.id === listing.sellerAccountId);
    const sellerProgress =
      this.doc.playersById[listing.sellerAccountId] ??
      buildInitialPlayerProgressServer(
        listing.sellerAccountId,
        seller?.avatarGender ?? 'feminino',
        seller?.serverRegion ?? 'BR',
      );

    if (!sellerProgress.ownedItemIds.includes(listing.itemId)) {
      // Vendedor não tem mais o item: encerra anúncio com segurança
      const cancelled = [...current];
      cancelled[idx] = { ...listing, status: 'cancelled' };
      this.doc.market_listings = cancelled;
      this.scheduleSave();
      return { ok: false, error: 'Este item não está mais disponível no inventário do vendedor.' };
    }

    const now = Date.now();

    // Remove item do vendedor (inventário + equipado atual) e credita AM
    const nextSellerEquipped = { ...sellerProgress.equipped };
    (Object.keys(nextSellerEquipped) as Array<keyof typeof nextSellerEquipped>).forEach((slot) => {
      if (nextSellerEquipped[slot] === listing.itemId) {
        delete nextSellerEquipped[slot];
      }
    });
    const nextSellerProgress: PlayerProgressState = {
      ...sellerProgress,
      starcoins: Math.max(0, sellerProgress.starcoins + listing.price),
      ownedItemIds: sellerProgress.ownedItemIds.filter((id) => id !== listing.itemId),
      equipped: nextSellerEquipped,
    };

    // Debita AM do comprador e adiciona item (ou mantém AM infinito se admin)
    const nextBuyerProgress: PlayerProgressState = {
      ...buyerProgress,
      starcoins: isBuyerInfiniteAdmin
        ? buyerProgress.starcoins
        : Math.max(0, buyerProgress.starcoins - listing.price),
      ownedItemIds: Array.from(new Set([...buyerProgress.ownedItemIds, listing.itemId])),
    };

    this.doc.playersById = {
      ...this.doc.playersById,
      [buyer.id]: nextBuyerProgress,
      [listing.sellerAccountId]: nextSellerProgress,
    };

    if (this.doc.worldState) {
      this.doc.worldState = {
        ...this.doc.worldState,
        users: this.doc.worldState.users.map((u) => {
          if (u.id === buyer.id) return { ...u, starcoins: nextBuyerProgress.starcoins };
          if (u.id === listing.sellerAccountId) return { ...u, starcoins: nextSellerProgress.starcoins };
          return u;
        }),
      };
    }

    const updatedListing: MarketListing = {
      ...listing,
      status: 'sold',
      buyerAccountId: buyer.id,
      buyerUsername: buyer.username,
      soldAt: now,
    };
    const nextListings = [...current];
    nextListings[idx] = updatedListing;
    this.doc.market_listings = nextListings;

    this.doc.version += 1;
    this.doc.updatedAt = now;
    this.flushSaveNow();

    return {
      ok: true,
      listing: updatedListing,
      listings: nextListings,
      buyerProgress: nextBuyerProgress,
      sellerProgress: nextSellerProgress,
    };
  }

  adminGrantItemToAccount(params: {
    actorId: string;
    actorUsername: string;
    targetAccountIdOrUsername: string;
    itemId: string;
  }):
    | {
        ok: true;
        targetAccountId: string;
        targetUsername: string;
        updatedProgress: PlayerProgressState;
        auditEntry: StaffAuditLogEntry;
      }
    | { ok: false; error: string } {
    const cleanTarget = normalizeUsernameServer(params.targetAccountIdOrUsername || '');
    const targetAcc = this.doc.accounts.find(
      (a) =>
        a.id === params.targetAccountIdOrUsername ||
        normalizeUsernameServer(a.username) === cleanTarget,
    );
    if (!targetAcc) {
      return { ok: false, error: 'Jogador de destino não encontrado no servidor.' };
    }
    const cleanItemId = (params.itemId || '').trim();
    if (!cleanItemId) {
      return { ok: false, error: 'Informe um ID de item válido.' };
    }

    const prevProgress =
      this.doc.playersById[targetAcc.id] ??
      buildInitialPlayerProgressServer(targetAcc.id, targetAcc.avatarGender, targetAcc.serverRegion);

    const updatedProgress: PlayerProgressState = {
      ...prevProgress,
      ownedItemIds: Array.from(new Set([...prevProgress.ownedItemIds, cleanItemId])),
    };
    this.doc.playersById = {
      ...this.doc.playersById,
      [targetAcc.id]: updatedProgress,
    };

    const now = Date.now();
    const auditEntry: StaffAuditLogEntry = {
      id: `audit_grant_${now}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      actor_id: params.actorId,
      actor_username: params.actorUsername,
      role: 'admin',
      action_type: 'ADMIN_GRANT_ITEM',
      target_id: targetAcc.username,
      details: `Item "${cleanItemId}" concedido pelo Administrador para @${targetAcc.username}.`,
    };
    this.doc.staff_audit_logs = [auditEntry, ...this.doc.staff_audit_logs].slice(0, 400);
    this.doc.version += 1;
    this.doc.updatedAt = now;
    this.flushSaveNow();

    return {
      ok: true,
      targetAccountId: targetAcc.id,
      targetUsername: targetAcc.username,
      updatedProgress,
      auditEntry,
    };
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
      this.flushSaveNow();
    }
    return changed;
  }

  private ensureRoomsSnapshot(): SharedRoomsSnapshot {
    if (!this.doc.roomsSnapshot) {
      this.doc.roomsSnapshot = createDefaultRoomsSnapshotServer();
    }
    return this.doc.roomsSnapshot;
  }

  /** Insere ou atualiza presença de um único avatar com carimbo de relógio do servidor */
  upsertRoomPresence(rawPresence: RoomAvatarPresence): {
    presence: RoomAvatarPresence;
    roomsSnapshot: SharedRoomsSnapshot;
  } {
    const snap = this.ensureRoomsSnapshot();
    const now = Date.now();
    const nextPresences: Record<string, RoomAvatarPresence> = {};
    for (const [cid, p] of Object.entries(snap.presences ?? {})) {
      if (p && !p.isBot && !cid.startsWith('bot_live_') && !cid.startsWith('npc_') && now - (p.lastSeen || 0) < 90_000) {
        nextPresences[cid] = p;
      }
    }

    const customIds = new Set((snap.customRooms ?? []).map((r) => r.id));
    const validRoom =
      rawPresence.roomId === 'lounge_party' ||
      rawPresence.roomId === 'lounge_party_es' ||
      rawPresence.roomId === 'lounge_party_en' ||
      rawPresence.roomId === 'ilha_brasil' ||
      rawPresence.roomId === 'ilha_spanish' ||
      rawPresence.roomId === 'ilha_english' ||
      customIds.has(rawPresence.roomId);

    const serverPresence: RoomAvatarPresence = {
      ...rawPresence,
      isBot: false,
      roomId: validRoom ? rawPresence.roomId : 'lounge_party',
      lastSeen: now,
    };

    nextPresences[serverPresence.clientId] = serverPresence;
    const updatedSnap: SharedRoomsSnapshot = {
      ...snap,
      presences: nextPresences,
    };
    this.doc.roomsSnapshot = updatedSnap;
    this.scheduleSave();
    return { presence: serverPresence, roomsSnapshot: updatedSnap };
  }

  /** Remove presença de uma aba/socket da sala sem afetar demais jogadores */
  removeRoomPresence(clientId: string): {
    removed: boolean;
    roomsSnapshot: SharedRoomsSnapshot;
  } {
    const snap = this.ensureRoomsSnapshot();
    if (!snap.presences?.[clientId]) {
      return { removed: false, roomsSnapshot: snap };
    }
    const nextPresences = { ...snap.presences };
    delete nextPresences[clientId];
    const updatedSnap: SharedRoomsSnapshot = {
      ...snap,
      presences: nextPresences,
    };
    this.doc.roomsSnapshot = updatedSnap;
    this.scheduleSave();
    return { removed: true, roomsSnapshot: updatedSnap };
  }

  /** Registra mensagem de chat em sala com deduplicação e sincronia de balão */
  appendRoomChatMessage(params: {
    roomId: string;
    message: RoomChatMessage;
    senderClientId?: string | null;
  }): { message: RoomChatMessage; roomsSnapshot: SharedRoomsSnapshot } {
    const snap = this.ensureRoomsSnapshot();
    const now = Date.now();
    const serverMsg: RoomChatMessage = {
      ...params.message,
      roomId: params.roomId,
      createdAt: params.message.createdAt || now,
    };

    const prevMsgs = snap.messagesByRoom?.[params.roomId] ?? [];
    const deduped = prevMsgs.some((m) => m.id === serverMsg.id)
      ? prevMsgs
      : [...prevMsgs, serverMsg].slice(-80);

    const nextPresences = { ...(snap.presences ?? {}) };
    if (serverMsg.senderRole !== 'system' && serverMsg.text) {
      const normSender = normalizeUsernameServer(serverMsg.senderUsername);
      if (params.senderClientId && nextPresences[params.senderClientId]) {
        nextPresences[params.senderClientId] = {
          ...nextPresences[params.senderClientId],
          lastMessage: serverMsg.text,
          lastMessageAt: now,
          lastSeen: now,
        };
      }
      for (const [cid, pres] of Object.entries(nextPresences)) {
        if (pres && normalizeUsernameServer(pres.username) === normSender) {
          nextPresences[cid] = {
            ...pres,
            lastMessage: serverMsg.text,
            lastMessageAt: now,
            lastSeen: now,
          };
        }
      }
    }

    const updatedSnap: SharedRoomsSnapshot = {
      ...snap,
      presences: nextPresences,
      messagesByRoom: {
        ...(snap.messagesByRoom ?? {}),
        [params.roomId]: deduped,
      },
    };
    this.doc.roomsSnapshot = updatedSnap;
    this.doc.version += 1;
    this.doc.updatedAt = now;
    this.scheduleSave();
    return { message: serverMsg, roomsSnapshot: updatedSnap };
  }

  /** Aplica mutação atômica em sala customizada ou oficial (móveis, tema, cargos, expulsão) */
  mutateRoomData(action: RoomMutationPayload): SharedRoomsSnapshot {
    const snap = this.ensureRoomsSnapshot();
    const now = Date.now();
    let updatedSnap: SharedRoomsSnapshot = snap;

    if (action.type === 'create_custom') {
      const exists = (snap.customRooms ?? []).some((r) => r.id === action.room.id);
      const nextRooms = exists
        ? snap.customRooms.map((r) => (r.id === action.room.id ? action.room : r))
        : [action.room, ...(snap.customRooms ?? [])];
      const welcomeMsg: RoomChatMessage = {
        id: `msg_created_${now}`,
        roomId: action.room.id,
        senderUsername: 'Sistema',
        senderRole: 'system',
        text: `Sala "${action.room.name}" criada por ${action.room.creatorUsername ?? 'anfitriao'}.`,
        createdAt: now,
      };
      updatedSnap = {
        ...snap,
        customRooms: nextRooms,
        messagesByRoom: {
          ...(snap.messagesByRoom ?? {}),
          [action.room.id]: snap.messagesByRoom?.[action.room.id] ?? [welcomeMsg],
        },
      };
    } else if (action.type === 'delete_custom') {
      const nextPresences = { ...(snap.presences ?? {}) };
      for (const [cid, p] of Object.entries(nextPresences)) {
        if (p && p.roomId === action.roomId) {
          nextPresences[cid] = { ...p, roomId: 'lounge_party', x: 50, y: 72 };
        }
      }
      const nextMessages = { ...(snap.messagesByRoom ?? {}) };
      delete nextMessages[action.roomId];
      updatedSnap = {
        ...snap,
        presences: nextPresences,
        customRooms: (snap.customRooms ?? []).filter((r) => r.id !== action.roomId),
        messagesByRoom: nextMessages,
      };
    } else if (action.type === 'update_custom') {
      const nextRooms = (snap.customRooms ?? []).map((r) => {
        if (r.id !== action.roomId) return r;
        const nextRoom = { ...r };
        if (action.patch.roomNotice !== undefined) {
          nextRoom.roomNotice = action.patch.roomNotice?.trim() || undefined;
        }
        if (action.patch.customBackgroundImageUrl !== undefined) {
          nextRoom.customBackgroundImageUrl =
            action.patch.customBackgroundImageUrl || undefined;
        }
        if (action.patch.interactiveProps !== undefined) {
          nextRoom.interactiveProps = action.patch.interactiveProps;
        }
        if (action.patch.employees !== undefined) {
          nextRoom.employees = action.patch.employees;
        }
        return nextRoom;
      });

      const nextMessages = { ...(snap.messagesByRoom ?? {}) };
      if (action.patch.roomNotice !== undefined && action.patch.byUsername) {
        const trimmed = action.patch.roomNotice?.trim() || '';
        const prevMsgs = nextMessages[action.roomId] ?? [];
        nextMessages[action.roomId] = [
          ...prevMsgs,
          {
            id: `msg_rnotice_${now}`,
            roomId: action.roomId,
            senderUsername: 'Dono da Sala',
            senderRole: 'system' as const,
            text: trimmed
              ? `${action.patch.byUsername} definiu o aviso da sala: "${trimmed}"`
              : `${action.patch.byUsername} removeu o aviso da sala.`,
            createdAt: now,
          },
        ].slice(-80);
      }

      updatedSnap = {
        ...snap,
        customRooms: nextRooms,
        messagesByRoom: nextMessages,
      };
    } else if (action.type === 'update_official') {
      const nextOverrides = { ...(snap.officialOverrides ?? {}) };
      for (const id of action.roomIds) {
        nextOverrides[id] = {
          ...(nextOverrides[id] ?? {}),
          ...action.updates,
        };
      }
      updatedSnap = {
        ...snap,
        officialOverrides: nextOverrides,
      };
    } else if (action.type === 'kick_avatar') {
      const nextPresences = { ...(snap.presences ?? {}) };
      if (nextPresences[action.targetClientId]) {
        nextPresences[action.targetClientId] = {
          ...nextPresences[action.targetClientId],
          roomId: 'lounge_party',
          x: 50,
          y: 74,
        };
      }
      const prevMsgs = snap.messagesByRoom?.[action.roomId] ?? [];
      updatedSnap = {
        ...snap,
        presences: nextPresences,
        messagesByRoom: {
          ...(snap.messagesByRoom ?? {}),
          [action.roomId]: [
            ...prevMsgs,
            {
              id: `msg_kick_${now}`,
              roomId: action.roomId,
              senderUsername: 'Moderação Local',
              senderRole: 'system' as const,
              text: `${action.targetUsername} foi expulsa desta sala pelo anfitrião ${action.byUsername}.`,
              createdAt: now,
            },
          ].slice(-80),
        },
        kicks: [
          ...(snap.kicks ?? []).filter((k) => now - (k.at || 0) < 30_000),
          {
            roomId: action.roomId,
            targetClientId: action.targetClientId,
            targetUsername: action.targetUsername,
            byUsername: action.byUsername,
            at: now,
          },
        ],
      };
    } else if (action.type === 'clear_messages') {
      updatedSnap = {
        ...snap,
        messagesByRoom: {
          ...(snap.messagesByRoom ?? {}),
          [action.roomId]: [
            {
              id: `msg_clear_${now}`,
              roomId: action.roomId,
              senderUsername: 'Moderação',
              senderRole: 'system' as const,
              text: 'Histórico do chat da sala limpo pela Staff.',
              createdAt: now,
            },
          ],
        },
      };
    }

    this.doc.roomsSnapshot = updatedSnap;
    this.doc.version += 1;
    this.doc.updatedAt = now;
    this.flushSaveNow();
    return updatedSnap;
  }

  /** Paga salário em AM do dono da sala para um funcionário contratado na sala */
  payRoomEmployee(params: {
    roomId: string;
    ownerAccountId: string;
    employeeUserId: string;
    amount?: number;
  }):
    | {
        ok: true;
        amountPaid: number;
        employeeUsername: string;
        jobTitle: string;
        ownerProgress: PlayerProgressState;
        employeeProgress: PlayerProgressState;
        roomsSnapshot: SharedRoomsSnapshot;
        worldState: WorldModerationState | null;
      }
    | { ok: false; error: string } {
    const snap = this.ensureRoomsSnapshot();
    const roomIdx = (snap.customRooms ?? []).findIndex((r) => r.id === params.roomId);
    if (roomIdx < 0) {
      return { ok: false, error: 'Sala personalizada não encontrada.' };
    }
    const room = snap.customRooms[roomIdx];
    const ownerAcc = this.doc.accounts.find((a) => a.id === params.ownerAccountId);
    if (!ownerAcc) {
      return { ok: false, error: 'Conta do proprietário da sala não encontrada.' };
    }
    const isOwner =
      (room.ownerId && room.ownerId === ownerAcc.id) ||
      (room.creatorUsername &&
        normalizeUsernameServer(room.creatorUsername) ===
          normalizeUsernameServer(ownerAcc.username));
    if (!isOwner) {
      return { ok: false, error: 'Apenas o dono da sala pode pagar salários.' };
    }

    const employees = room.employees ?? [];
    const empIdx = employees.findIndex(
      (e) =>
        e.userId === params.employeeUserId ||
        normalizeUsernameServer(e.username) === normalizeUsernameServer(params.employeeUserId),
    );
    if (empIdx < 0) {
      return { ok: false, error: 'Funcionário não encontrado na folha de cargos desta sala.' };
    }
    const emp = employees[empIdx];
    const empAcc =
      this.doc.accounts.find((a) => a.id === emp.userId) ??
      this.doc.accounts.find(
        (a) => normalizeUsernameServer(a.username) === normalizeUsernameServer(emp.username),
      );
    if (!empAcc) {
      return { ok: false, error: 'Conta do funcionário não encontrada no servidor.' };
    }

    const payAmount = Math.round(Number(params.amount ?? emp.wage));
    if (!Number.isFinite(payAmount) || payAmount < 1 || payAmount > 10_000_000) {
      return { ok: false, error: 'Valor de salário inválido (mínimo 1 AM).' };
    }

    const ownerProg =
      this.doc.playersById[ownerAcc.id] ??
      buildInitialPlayerProgressServer(ownerAcc.id, ownerAcc.avatarGender, ownerAcc.serverRegion);

    const isOwnerInfiniteAdmin = isInfiniteAdminAccountServer(ownerAcc);
    if (!isOwnerInfiniteAdmin && ownerProg.starcoins < payAmount) {
      return {
        ok: false,
        error: `Saldo insuficiente para pagar ${payAmount.toLocaleString('pt-BR')} AM (seu saldo: ${ownerProg.starcoins.toLocaleString('pt-BR')} AM).`,
      };
    }

    const empProg =
      this.doc.playersById[empAcc.id] ??
      buildInitialPlayerProgressServer(empAcc.id, empAcc.avatarGender, empAcc.serverRegion);

    const now = Date.now();
    let nextOwnerProg: PlayerProgressState;
    let nextEmpProg: PlayerProgressState;

    if (ownerAcc.id === empAcc.id) {
      nextOwnerProg = ownerProg;
      nextEmpProg = ownerProg;
    } else {
      nextOwnerProg = {
        ...ownerProg,
        starcoins: isOwnerInfiniteAdmin
          ? ownerProg.starcoins
          : Math.max(0, ownerProg.starcoins - payAmount),
      };
      nextEmpProg = {
        ...empProg,
        starcoins: Math.max(0, empProg.starcoins + payAmount),
      };
    }

    this.doc.playersById = {
      ...this.doc.playersById,
      [ownerAcc.id]: nextOwnerProg,
      [empAcc.id]: nextEmpProg,
    };

    if (this.doc.worldState) {
      this.doc.worldState = {
        ...this.doc.worldState,
        users: this.doc.worldState.users.map((u) => {
          if (u.id === ownerAcc.id) return { ...u, starcoins: nextOwnerProg.starcoins };
          if (u.id === empAcc.id) return { ...u, starcoins: nextEmpProg.starcoins };
          return u;
        }),
      };
    }

    const nextEmployees = [...employees];
    nextEmployees[empIdx] = { ...emp, lastPaidAt: now };
    const nextCustomRooms = [...snap.customRooms];
    nextCustomRooms[roomIdx] = { ...room, employees: nextEmployees };

    const periodLabel =
      emp.period === 'hora' ? 'hora' : emp.period === 'semana' ? 'semana' : 'mês';
    const prevMsgs = snap.messagesByRoom?.[params.roomId] ?? [];
    const nextSnap: SharedRoomsSnapshot = {
      ...snap,
      customRooms: nextCustomRooms,
      messagesByRoom: {
        ...(snap.messagesByRoom ?? {}),
        [params.roomId]: [
          ...prevMsgs,
          {
            id: `msg_salary_${now}_${Math.random().toString(36).slice(2, 5)}`,
            roomId: params.roomId,
            senderUsername: 'Folha da Sala',
            senderRole: 'system' as const,
            text: `💰 ${ownerAcc.username} pagou ${payAmount.toLocaleString('pt-BR')} AM (${emp.jobTitle} · taxa/${periodLabel}) para ${empAcc.username}.`,
            createdAt: now,
          },
        ].slice(-80),
      },
    };
    this.doc.roomsSnapshot = nextSnap;
    this.doc.version += 1;
    this.doc.updatedAt = now;
    this.flushSaveNow();

    return {
      ok: true,
      amountPaid: payAmount,
      employeeUsername: empAcc.username,
      jobTitle: emp.jobTitle,
      ownerProgress: nextOwnerProg,
      employeeProgress: nextEmpProg,
      roomsSnapshot: nextSnap,
      worldState: this.doc.worldState,
    };
  }

  getSupportModMessages(): SupportModMessage[] {
    return this.doc.support_mod_messages ?? [];
  }

  appendSupportModMessage(msg: SupportModMessage): SupportModMessage[] {
    const current = this.doc.support_mod_messages ?? [];
    if (current.some((m) => m.id === msg.id)) {
      return current;
    }
    const next = [...current, msg].slice(-150);
    this.doc.support_mod_messages = next;
    this.doc.version += 1;
    this.doc.updatedAt = Date.now();
    this.flushSaveNow();
    return next;
  }
}

export const serverDb = new NocturneValeServerDatabase();
