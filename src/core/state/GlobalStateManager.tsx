/**
 * GlobalStateManager — Gerenciador de Estado Global em Tempo Real + Heartbeat de Presença.
 * Conecta-se ao servidor Node.js + Socket.io, substitui o localStorage isolado pela fonte
 * centralizada de dados em nuvem/servidor e controla o ciclo de vida de presença:
 * - `online`: interação nos últimos 3 minutos
 * - `away` (ausente): conectado sem interação há mais de 3 minutos
 * - `offline`: desconectado ou aba fechada
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  DjMediaSyncPayload,
  HeartbeatLifecycleStatus,
  PresenceHeartbeatRecord,
  ServerDatabaseDocument,
  StaffAuditLogEntry,
  StateSyncPatchPayload,
} from '../schemas/dbSchema';
import {
  readCachedAuditLogs,
  registerAuditSocketEmitter,
  subscribeAuditLogs,
  writeCachedAuditLogs,
} from '../security/AuditLogger';
import { resolveCoreStaffRole } from '../security/RoleGuard';
import {
  emitDjMediaSyncToServer,
  emitStatePatchToServer,
  notifyRemoteAuditUpdated,
  notifyRemoteBanReviews,
  notifyRemoteDjSynced,
  notifyRemoteInit,
  notifyRemoteMarketListings,
  notifyRemotePatch,
  notifyRemotePremiumOrders,
  notifyRemotePremiumPix,
  notifyRemotePresence,
  notifyRemoteRoomHealth,
  notifyRemoteRoomTerminated,
  notifyRemoteSupportTickets,
  notifyRoomChatBroadcast,
  notifyRoomPresenceDelta,
  notifyRoomPresenceRemoved,
  notifyRoomSnapshotSync,
  notifySupportModMessages,
  runWithRemoteSyncLock,
  setActiveSyncSocket,
} from './socketBridge';
import type { RoomTerminatedNotice } from './socketBridge';
import type {
  BanReviewRequest,
  MarketListing,
  PremiumOrder,
  PremiumPixConfig,
  RoomAvatarPresence,
  RoomChatMessage,
  RoomDjTrack,
  RoomHealthMetric,
  RoomId,
  SupportModMessage,
  SupportTicket,
  UserAccount,
} from '../../types/game';
import {
  ACCOUNTS_KEY,
  DMS_KEY,
  PLAYER_PREFIX,
  WORLD_KEY,
} from '../../utils/storage';
import { AI_LOGS_KEY } from '../../utils/aiBots';
import { resilientApiRequest } from '../../utils/apiClient';
import type { SharedRoomsSnapshot } from '../../utils/realtime';

const AWAY_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutos
const HEARTBEAT_INTERVAL_MS = 25_000;
const ROOMS_STORAGE_KEY = 'starlight_atelier_rooms_v1';

interface GlobalStateContextValue {
  isSocketConnected: boolean;
  dbVersion: number;
  presencesByAccountId: Record<string, PresenceHeartbeatRecord>;
  myLifecycleStatus: HeartbeatLifecycleStatus;
  staffAuditLogs: StaffAuditLogEntry[];
  supportTickets: SupportTicket[];
  banReviews: BanReviewRequest[];
  premiumOrders: PremiumOrder[];
  premiumPixConfig: PremiumPixConfig;
  marketListings: MarketListing[];
  supportModMessages: SupportModMessage[];
  roomHealthList: RoomHealthMetric[];
  lastTerminatedNotice: RoomTerminatedNotice | null;
  clearTerminatedNotice: () => void;
  syncPatch: (patch: StateSyncPatchPayload) => void;
  syncDjMedia: (payload: DjMediaSyncPayload | { roomId: RoomId; stop: true }) => void;
  refreshStaffAuditLogs: (actor: UserAccount) => Promise<void>;
  refreshSupportTickets: () => Promise<void>;
  refreshBanReviews: () => Promise<void>;
  refreshPremiumOrders: () => Promise<void>;
  refreshPremiumPixConfig: () => Promise<void>;
  refreshMarketListings: () => Promise<void>;
  refreshSupportModMessages: () => Promise<void>;
  refreshRoomHealth: () => Promise<void>;
  bindHeartbeatUser: (
    account: UserAccount | null,
    manualOffline?: boolean,
  ) => void;
}

const GlobalStateContext = createContext<GlobalStateContextValue | null>(null);

/** Normaliza `lastSeen` de presenças vindas do servidor para o relógio local (evita sumiço por fuso/clock skew entre PCs) */
function normalizeRoomsSnapshotPresences(
  snap: SharedRoomsSnapshot,
): SharedRoomsSnapshot {
  const localNow = Date.now();
  const normalizedPresences: Record<string, RoomAvatarPresence> = {};
  for (const [cid, pres] of Object.entries(snap.presences ?? {})) {
    if (!pres || !pres.clientId) continue;
    normalizedPresences[cid] = {
      ...pres,
      lastSeen: localNow,
    };
  }
  return {
    ...snap,
    presences: normalizedPresences,
  };
}

function readCachedRoomsFromLocal(): SharedRoomsSnapshot | null {
  try {
    const raw = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SharedRoomsSnapshot;
  } catch {
    return null;
  }
}

function applySnapshotToLocalCache(snapshot: ServerDatabaseDocument): boolean {
  if (typeof window === 'undefined') return false;
  let hydratedAny = false;

  runWithRemoteSyncLock(() => {
    try {
      if (Array.isArray(snapshot.accounts) && snapshot.accounts.length > 0) {
        window.localStorage.setItem(
          ACCOUNTS_KEY,
          JSON.stringify(snapshot.accounts),
        );
        hydratedAny = true;
      }
      if (snapshot.worldState) {
        window.localStorage.setItem(
          WORLD_KEY,
          JSON.stringify(snapshot.worldState),
        );
        hydratedAny = true;
      }
      if (snapshot.playersById && typeof snapshot.playersById === 'object') {
        for (const [accId, progress] of Object.entries(snapshot.playersById)) {
          window.localStorage.setItem(
            `${PLAYER_PREFIX}${accId}`,
            JSON.stringify(progress),
          );
        }
      }
      if (Array.isArray(snapshot.aiLogs) && snapshot.aiLogs.length > 0) {
        window.localStorage.setItem(
          AI_LOGS_KEY,
          JSON.stringify(snapshot.aiLogs),
        );
      }
      if (Array.isArray(snapshot.dms) && snapshot.dms.length > 0) {
        window.localStorage.setItem(DMS_KEY, JSON.stringify(snapshot.dms));
      }
      if (snapshot.roomsSnapshot) {
        window.localStorage.setItem(
          ROOMS_STORAGE_KEY,
          JSON.stringify(normalizeRoomsSnapshotPresences(snapshot.roomsSnapshot)),
        );
      }
      if (Array.isArray(snapshot.staff_audit_logs)) {
        writeCachedAuditLogs(snapshot.staff_audit_logs);
      }
    } catch {
      // Silencioso em modo restrito
    }
  });

  return hydratedAny;
}

function applyPatchToLocalCache(patch: StateSyncPatchPayload): void {
  if (typeof window === 'undefined') return;
  runWithRemoteSyncLock(() => {
    try {
      if (Array.isArray(patch.accounts) && patch.accounts.length > 0) {
        window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(patch.accounts));
      }
      if (patch.worldState) {
        window.localStorage.setItem(WORLD_KEY, JSON.stringify(patch.worldState));
      }
      if (patch.playerPatch?.accountId && patch.playerPatch.progress) {
        window.localStorage.setItem(
          `${PLAYER_PREFIX}${patch.playerPatch.accountId}`,
          JSON.stringify(patch.playerPatch.progress),
        );
      }
      if (Array.isArray(patch.aiLogs)) {
        window.localStorage.setItem(AI_LOGS_KEY, JSON.stringify(patch.aiLogs));
      }
      if (Array.isArray(patch.dms)) {
        window.localStorage.setItem(DMS_KEY, JSON.stringify(patch.dms));
      }
      if (patch.roomsSnapshot) {
        window.localStorage.setItem(
          ROOMS_STORAGE_KEY,
          JSON.stringify(normalizeRoomsSnapshotPresences(patch.roomsSnapshot)),
        );
      }
      if (patch.djTrackUpdate) {
        const raw = window.localStorage.getItem(ROOMS_STORAGE_KEY);
        const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const prevTracks =
          (current.djTracksByRoom as Record<string, RoomDjTrack> | undefined) ?? {};
        const nextTracks = { ...prevTracks };
        if (patch.djTrackUpdate.track) {
          nextTracks[patch.djTrackUpdate.roomId] = patch.djTrackUpdate.track;
        } else {
          delete nextTracks[patch.djTrackUpdate.roomId];
        }
        window.localStorage.setItem(
          ROOMS_STORAGE_KEY,
          JSON.stringify({ ...current, djTracksByRoom: nextTracks }),
        );
      }
    } catch {
      // Silencioso
    }
  });
}

function readLocalSeedSnapshot(): StateSyncPatchPayload {
  const payload: StateSyncPatchPayload = {};
  if (typeof window === 'undefined') return payload;
  try {
    const rawAccounts = window.localStorage.getItem(ACCOUNTS_KEY);
    if (rawAccounts) payload.accounts = JSON.parse(rawAccounts);
    const rawWorld = window.localStorage.getItem(WORLD_KEY);
    if (rawWorld) payload.worldState = JSON.parse(rawWorld);
    const rawAi = window.localStorage.getItem(AI_LOGS_KEY);
    if (rawAi) payload.aiLogs = JSON.parse(rawAi);
    const rawDms = window.localStorage.getItem(DMS_KEY);
    if (rawDms) payload.dms = JSON.parse(rawDms);
    const rawRooms = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    if (rawRooms) payload.roomsSnapshot = JSON.parse(rawRooms);
  } catch {
    // Silencioso
  }
  return payload;
}

export const GlobalStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [dbVersion, setDbVersion] = useState(1);
  const [presencesByAccountId, setPresencesByAccountId] = useState<
    Record<string, PresenceHeartbeatRecord>
  >({});
  const [myLifecycleStatus, setMyLifecycleStatus] =
    useState<HeartbeatLifecycleStatus>('online');
  const [staffAuditLogs, setStaffAuditLogs] = useState<StaffAuditLogEntry[]>(() =>
    readCachedAuditLogs(),
  );
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [banReviews, setBanReviews] = useState<BanReviewRequest[]>([]);
  const [premiumOrders, setPremiumOrders] = useState<PremiumOrder[]>([]);
  const [premiumPixConfig, setPremiumPixConfig] = useState<PremiumPixConfig>({
    pixKey: '7198826894',
  });
  const [marketListings, setMarketListings] = useState<MarketListing[]>([]);
  const [supportModMessages, setSupportModMessages] = useState<SupportModMessage[]>([]);
  const [roomHealthList, setRoomHealthList] = useState<RoomHealthMetric[]>([]);
  const [lastTerminatedNotice, setLastTerminatedNotice] =
    useState<RoomTerminatedNotice | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const activeUserRef = useRef<UserAccount | null>(null);
  const manualOfflineRef = useRef<boolean>(false);
  const lastInteractionAtRef = useRef<number>(Date.now());

  const emitCurrentHeartbeat = useCallback((forceStatusUpdate = false) => {
    const sock = socketRef.current;
    const user = activeUserRef.current;
    const now = Date.now();
    const idleMs = now - lastInteractionAtRef.current;
    const nextStatus: HeartbeatLifecycleStatus = manualOfflineRef.current
      ? 'offline'
      : idleMs >= AWAY_THRESHOLD_MS
        ? 'away'
        : 'online';

    setMyLifecycleStatus((prev) =>
      prev !== nextStatus || forceStatusUpdate ? nextStatus : prev,
    );

    if (sock && sock.connected && user) {
      sock.emit('presence:heartbeat', {
        accountId: user.id,
        username: user.username,
        displayName: user.displayName,
        lastInteractionAt: lastInteractionAtRef.current,
        manualOffline: manualOfflineRef.current,
        serverRegion: user.serverRegion,
      });
    }
  }, []);

  // Subscreve atualizações locais de logs de auditoria
  useEffect(() => {
    return subscribeAuditLogs((logs) => {
      setStaffAuditLogs(logs);
    });
  }, []);

  // Conexão persistente Socket.io + hidratação inicial do banco centralizado
  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;
    setActiveSyncSocket(socket);

    registerAuditSocketEmitter((entry) => {
      if (socket.connected) {
        socket.emit('audit:staff_action', entry);
      }
    });

    socket.on('connect', () => {
      setIsSocketConnected(true);
      socket.emit('state:request_init');
      emitCurrentHeartbeat(true);
      socket.emit('support:list_tickets', {}, (res: { ok?: boolean; tickets?: SupportTicket[] }) => {
        if (res?.ok && Array.isArray(res.tickets)) {
          setSupportTickets(res.tickets);
          notifyRemoteSupportTickets(res.tickets);
        }
      });
      socket.emit('premium:list_orders', {}, (res: { ok?: boolean; orders?: PremiumOrder[] }) => {
        if (res?.ok && Array.isArray(res.orders)) {
          setPremiumOrders(res.orders);
          notifyRemotePremiumOrders(res.orders);
        }
      });
      socket.emit('market:list_listings', {}, (res: { ok?: boolean; listings?: MarketListing[] }) => {
        if (res?.ok && Array.isArray(res.listings)) {
          setMarketListings(res.listings);
          notifyRemoteMarketListings(res.listings);
        }
      });
      socket.emit('support_mod:list_messages', {}, (res: { ok?: boolean; messages?: SupportModMessage[] }) => {
        if (res?.ok && Array.isArray(res.messages)) {
          setSupportModMessages(res.messages);
          notifySupportModMessages(res.messages);
        }
      });
    });

    socket.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    const applyRemoteSnapshot = (snapshot: ServerDatabaseDocument) => {
      if (!snapshot) return;
      setDbVersion(snapshot.version ?? 1);
      if (snapshot.presences) {
        setPresencesByAccountId(snapshot.presences);
        notifyRemotePresence(snapshot.presences);
      }
      if (Array.isArray(snapshot.staff_audit_logs)) {
        setStaffAuditLogs(snapshot.staff_audit_logs);
        writeCachedAuditLogs(snapshot.staff_audit_logs);
      }
      if (Array.isArray(snapshot.support_tickets)) {
        setSupportTickets(snapshot.support_tickets);
        notifyRemoteSupportTickets(snapshot.support_tickets);
      }
      if (Array.isArray(snapshot.ban_reviews)) {
        setBanReviews(snapshot.ban_reviews);
        notifyRemoteBanReviews(snapshot.ban_reviews);
      }
      if (Array.isArray(snapshot.premium_orders)) {
        setPremiumOrders(snapshot.premium_orders);
        notifyRemotePremiumOrders(snapshot.premium_orders);
      }
      if (Array.isArray(snapshot.market_listings)) {
        setMarketListings(snapshot.market_listings);
        notifyRemoteMarketListings(snapshot.market_listings);
      }
      if (Array.isArray(snapshot.support_mod_messages)) {
        setSupportModMessages(snapshot.support_mod_messages);
        notifySupportModMessages(snapshot.support_mod_messages);
      }
      if (snapshot.premium_pix_config?.pixKey) {
        setPremiumPixConfig(snapshot.premium_pix_config);
        notifyRemotePremiumPix(snapshot.premium_pix_config);
      }
      if (snapshot.room_health && typeof snapshot.room_health === 'object') {
        const list = Object.values(snapshot.room_health);
        if (list.length > 0) {
          setRoomHealthList(list);
          notifyRemoteRoomHealth(list);
        }
      }

      const serverHasData =
        Boolean(snapshot.worldState) ||
        (Array.isArray(snapshot.accounts) && snapshot.accounts.length > 0);

      if (serverHasData) {
        applySnapshotToLocalCache(snapshot);
        if (!snapshot.roomsSnapshot) {
          const localSeed = readLocalSeedSnapshot();
          if (localSeed.roomsSnapshot) {
            socket.emit('state:sync_patch', { roomsSnapshot: localSeed.roomsSnapshot });
          }
        }
        notifyRemoteInit(snapshot);
      } else {
        // Primeiro arranque do banco no servidor: envia seed inicial para persistência centralizada
        const initialSeed = readLocalSeedSnapshot();
        if (initialSeed.accounts || initialSeed.worldState) {
          socket.emit('state:sync_patch', initialSeed);
        }
      }
    };

    // Hidratação imediata via REST resiliente enquanto WebSocket completa o handshake
    void resilientApiRequest<{ ok?: boolean; snapshot?: ServerDatabaseDocument }>('/api/state/snapshot')
      .then((data) => {
        if (data?.ok && data.snapshot) {
          applyRemoteSnapshot(data.snapshot);
        }
      })
      .catch(() => {
        // Silencioso; Socket.io assume na sequência
      });

    socket.on('state:init', applyRemoteSnapshot);

    const handleStateUpdatedPatch = (
      patch: StateSyncPatchPayload & { version?: number },
    ) => {
      if (!patch) return;
      if (typeof patch.version === 'number') {
        setDbVersion(patch.version);
      }
      applyPatchToLocalCache(patch);
      notifyRemotePatch(patch);
    };

    socket.on('state:updated', handleStateUpdatedPatch);
    socket.on('state_update', handleStateUpdatedPatch);

    socket.on(
      'presence:updated',
      (payload: { presences?: Record<string, PresenceHeartbeatRecord> }) => {
        if (!payload?.presences) return;
        setPresencesByAccountId(payload.presences);
        notifyRemotePresence(payload.presences);
      },
    );

    socket.on(
      'media:dj_synced',
      (payload: { roomId: RoomId; track: RoomDjTrack | null }) => {
        if (!payload?.roomId) return;
        applyPatchToLocalCache({
          djTrackUpdate: { roomId: payload.roomId, track: payload.track },
        });
        notifyRemoteDjSynced(payload);
      },
    );

    socket.on('audit:updated', (payload: { logs?: StaffAuditLogEntry[] }) => {
      if (!Array.isArray(payload?.logs)) return;
      setStaffAuditLogs(payload.logs);
      writeCachedAuditLogs(payload.logs);
      notifyRemoteAuditUpdated(payload.logs);
    });

    socket.on(
      'support:ticket_updated',
      (payload: { tickets?: SupportTicket[] }) => {
        if (!Array.isArray(payload?.tickets)) return;
        setSupportTickets(payload.tickets);
        notifyRemoteSupportTickets(payload.tickets);
      },
    );

    socket.on(
      'ban:review_updated',
      (payload: { reviews?: BanReviewRequest[] }) => {
        if (!Array.isArray(payload?.reviews)) return;
        setBanReviews(payload.reviews);
        notifyRemoteBanReviews(payload.reviews);
      },
    );

    socket.on(
      'premium:orders_updated',
      (payload: { orders?: PremiumOrder[] }) => {
        if (!Array.isArray(payload?.orders)) return;
        setPremiumOrders(payload.orders);
        notifyRemotePremiumOrders(payload.orders);
      },
    );

    socket.on(
      'premium:pix_updated',
      (payload: { config?: PremiumPixConfig }) => {
        if (!payload?.config?.pixKey) return;
        setPremiumPixConfig(payload.config);
        notifyRemotePremiumPix(payload.config);
      },
    );

    socket.on(
      'market:updated',
      (payload: { listings?: MarketListing[] }) => {
        if (!Array.isArray(payload?.listings)) return;
        setMarketListings(payload.listings);
        notifyRemoteMarketListings(payload.listings);
      },
    );

    socket.on(
      'room:health_updated',
      (payload: { metrics?: RoomHealthMetric[] }) => {
        if (!Array.isArray(payload?.metrics)) return;
        setRoomHealthList(payload.metrics);
        notifyRemoteRoomHealth(payload.metrics);
      },
    );

    socket.on('room:terminated', (notice: RoomTerminatedNotice) => {
      if (!notice?.roomId) return;
      setLastTerminatedNotice(notice);
      notifyRemoteRoomTerminated(notice);
    });

    // Sincronização atômica em tempo real entre diferentes PCs / IPs na mesma sala
    socket.on('room:presence_delta', (payload: { presence?: RoomAvatarPresence }) => {
      if (!payload?.presence?.clientId) return;
      const stampedPresence: RoomAvatarPresence = {
        ...payload.presence,
        lastSeen: Date.now(),
      };
      runWithRemoteSyncLock(() => {
        const cached = readCachedRoomsFromLocal();
        if (cached) {
          try {
            window.localStorage.setItem(
              ROOMS_STORAGE_KEY,
              JSON.stringify({
                ...cached,
                presences: {
                  ...(cached.presences ?? {}),
                  [stampedPresence.clientId]: stampedPresence,
                },
              }),
            );
          } catch {
            // Silencioso
          }
        }
      });
      notifyRoomPresenceDelta(stampedPresence);
    });

    socket.on('room:presence_removed', (payload: { clientId?: string }) => {
      const removedClientId = payload?.clientId;
      if (!removedClientId) return;
      runWithRemoteSyncLock(() => {
        const cached = readCachedRoomsFromLocal();
        if (cached && cached.presences?.[removedClientId]) {
          const nextPresences = { ...cached.presences };
          delete nextPresences[removedClientId];
          try {
            window.localStorage.setItem(
              ROOMS_STORAGE_KEY,
              JSON.stringify({ ...cached, presences: nextPresences }),
            );
          } catch {
            // Silencioso
          }
        }
      });
      notifyRoomPresenceRemoved(removedClientId);
    });

    socket.on(
      'room:chat_broadcast',
      (payload: { roomId?: RoomId; message?: RoomChatMessage; senderClientId?: string | null }) => {
        if (!payload?.roomId || !payload?.message) return;
        const { roomId, message, senderClientId } = payload;
        runWithRemoteSyncLock(() => {
          const cached = readCachedRoomsFromLocal();
          if (cached) {
            const prevMsgs = cached.messagesByRoom?.[roomId] ?? [];
            const alreadyHas = prevMsgs.some((m) => m.id === message.id);
            const nextMsgs = alreadyHas ? prevMsgs : [...prevMsgs, message].slice(-80);
            const nextPresences = { ...(cached.presences ?? {}) };
            if (senderClientId && nextPresences[senderClientId] && message.senderRole !== 'system') {
              nextPresences[senderClientId] = {
                ...nextPresences[senderClientId],
                lastMessage: message.text,
                lastMessageAt: message.createdAt,
                lastSeen: Date.now(),
              };
            }
            try {
              window.localStorage.setItem(
                ROOMS_STORAGE_KEY,
                JSON.stringify({
                  ...cached,
                  presences: nextPresences,
                  messagesByRoom: {
                    ...(cached.messagesByRoom ?? {}),
                    [roomId]: nextMsgs,
                  },
                }),
              );
            } catch {
              // Silencioso
            }
          }
        });
        notifyRoomChatBroadcast({ roomId, message, senderClientId });
      },
    );

    socket.on('room:snapshot_sync', (payload: { roomsSnapshot?: SharedRoomsSnapshot }) => {
      if (!payload?.roomsSnapshot) return;
      const normalized = normalizeRoomsSnapshotPresences(payload.roomsSnapshot);
      runWithRemoteSyncLock(() => {
        try {
          window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(normalized));
        } catch {
          // Silencioso
        }
      });
      notifyRoomSnapshotSync(normalized);
    });

    socket.on('support_mod:updated', (payload: { messages?: SupportModMessage[] }) => {
      if (!Array.isArray(payload?.messages)) return;
      setSupportModMessages(payload.messages);
      notifySupportModMessages(payload.messages);
    });

    return () => {
      registerAuditSocketEmitter(null);
      setActiveSyncSocket(null);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [emitCurrentHeartbeat]);

  // Monitor de atividade do usuário + Heartbeat (online < 3min, away > 3min, offline on unload)
  useEffect(() => {
    let lastThrottleAt = 0;
    const handleInteraction = () => {
      const now = Date.now();
      if (now - lastThrottleAt < 1500) return;
      lastThrottleAt = now;
      const wasAway = now - lastInteractionAtRef.current >= AWAY_THRESHOLD_MS;
      lastInteractionAtRef.current = now;
      if (wasAway && !manualOfflineRef.current) {
        emitCurrentHeartbeat(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleInteraction();
      }
    };

    const handleBeforeUnload = () => {
      const sock = socketRef.current;
      const user = activeUserRef.current;
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try {
          const flushPatch = readLocalSeedSnapshot();
          if (user) {
            const rawPlayer = window.localStorage.getItem(`${PLAYER_PREFIX}${user.id}`);
            if (rawPlayer) {
              flushPatch.playerPatch = {
                accountId: user.id,
                progress: JSON.parse(rawPlayer),
              };
            }
          }
          if (
            flushPatch.accounts ||
            flushPatch.worldState ||
            flushPatch.roomsSnapshot ||
            flushPatch.playerPatch
          ) {
            navigator.sendBeacon(
              '/api/state/sync',
              new Blob([JSON.stringify(flushPatch)], {
                type: 'application/json',
              }),
            );
          }
        } catch {
          // Silencioso
        }
      }
      if (user) {
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            navigator.sendBeacon(
              '/api/presence/offline',
              new Blob([JSON.stringify({ accountId: user.id })], {
                type: 'application/json',
              }),
            );
          }
        } catch {
          // Silencioso
        }
      }
      if (sock && sock.connected && user) {
        sock.emit('presence:heartbeat', {
          accountId: user.id,
          username: user.username,
          lastInteractionAt: lastInteractionAtRef.current,
          manualOffline: true,
        });
      }
    };

    window.addEventListener('pointerdown', handleInteraction, { passive: true });
    window.addEventListener('keydown', handleInteraction, { passive: true });
    window.addEventListener('mousemove', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    const heartbeatTimer = window.setInterval(() => {
      emitCurrentHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    // Verificador leve local para alternar imediatamente para `away` ao completar 3 min sem interação
    const lifecycleChecker = window.setInterval(() => {
      const idleMs = Date.now() - lastInteractionAtRef.current;
      const nextStatus: HeartbeatLifecycleStatus = manualOfflineRef.current
        ? 'offline'
        : idleMs >= AWAY_THRESHOLD_MS
          ? 'away'
          : 'online';
      setMyLifecycleStatus((prev) => {
        if (prev !== nextStatus) {
          emitCurrentHeartbeat(true);
          return nextStatus;
        }
        return prev;
      });
    }, 10_000);

    return () => {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.clearInterval(heartbeatTimer);
      window.clearInterval(lifecycleChecker);
    };
  }, [emitCurrentHeartbeat]);

  const bindHeartbeatUser = useCallback(
    (account: UserAccount | null, manualOffline = false) => {
      activeUserRef.current = account;
      manualOfflineRef.current = manualOffline;
      if (account) {
        lastInteractionAtRef.current = Date.now();
        emitCurrentHeartbeat(true);
      } else {
        setMyLifecycleStatus('offline');
      }
    },
    [emitCurrentHeartbeat],
  );

  const syncPatch = useCallback((patch: StateSyncPatchPayload) => {
    emitStatePatchToServer(patch);
  }, []);

  const syncDjMedia = useCallback(
    (payload: DjMediaSyncPayload | { roomId: RoomId; stop: true }) => {
      emitDjMediaSyncToServer(payload);
    },
    [],
  );

  const refreshStaffAuditLogs = useCallback(async (actor: UserAccount) => {
    const role = resolveCoreStaffRole(actor);
    if (!role) return;
    try {
      const data = await resilientApiRequest<{
        ok?: boolean;
        logs?: StaffAuditLogEntry[];
      }>('/api/staff/audit-logs', {
        headers: {
          'x-actor-id': actor.id,
          'x-staff-role': role,
          'x-actor-email': actor.email,
        },
      });
      if (data.ok && Array.isArray(data.logs)) {
        setStaffAuditLogs(data.logs);
        writeCachedAuditLogs(data.logs);
      }
    } catch {
      // Silencioso
    }
  }, []);

  const clearTerminatedNotice = useCallback(() => {
    setLastTerminatedNotice(null);
  }, []);

  const refreshSupportTickets = useCallback(async () => {
    try {
      const data = await resilientApiRequest<{ ok?: boolean; tickets?: SupportTicket[] }>(
        '/api/support/tickets',
        { socketEvent: 'support:list_tickets' },
      );
      if (data.ok && Array.isArray(data.tickets)) {
        setSupportTickets(data.tickets);
      }
    } catch {
      // Silencioso
    }
  }, []);

  const refreshBanReviews = useCallback(async () => {
    try {
      const data = await resilientApiRequest<{ ok?: boolean; reviews?: BanReviewRequest[] }>(
        '/api/ban-reviews',
      );
      if (data.ok && Array.isArray(data.reviews)) {
        setBanReviews(data.reviews);
      }
    } catch {
      // Silencioso
    }
  }, []);

  const refreshPremiumOrders = useCallback(async () => {
    try {
      const data = await resilientApiRequest<{ ok?: boolean; orders?: PremiumOrder[] }>(
        '/api/premium-orders',
        { socketEvent: 'premium:list_orders' },
      );
      if (data.ok && Array.isArray(data.orders)) {
        setPremiumOrders(data.orders);
      }
    } catch {
      // Silencioso
    }
  }, []);

  const refreshPremiumPixConfig = useCallback(async () => {
    try {
      const data = await resilientApiRequest<{ ok?: boolean; config?: PremiumPixConfig }>(
        '/api/premium-pix-config',
        { socketEvent: 'premium:get_pix' },
      );
      if (data.ok && data.config?.pixKey) {
        setPremiumPixConfig(data.config);
      }
    } catch {
      // Silencioso
    }
  }, []);

  const refreshMarketListings = useCallback(async () => {
    try {
      const data = await resilientApiRequest<{ ok?: boolean; listings?: MarketListing[] }>(
        '/api/market/listings',
        { socketEvent: 'market:list_listings' },
      );
      if (data.ok && Array.isArray(data.listings)) {
        setMarketListings(data.listings);
      }
    } catch {
      // Silencioso
    }
  }, []);

  const refreshSupportModMessages = useCallback(async () => {
    try {
      const data = await resilientApiRequest<{ ok?: boolean; messages?: SupportModMessage[] }>(
        '/api/support-mod/messages',
        { socketEvent: 'support_mod:list_messages' },
      );
      if (data.ok && Array.isArray(data.messages)) {
        setSupportModMessages(data.messages);
      }
    } catch {
      // Silencioso
    }
  }, []);

  const refreshRoomHealth = useCallback(async () => {
    try {
      const data = await resilientApiRequest<{ ok?: boolean; metrics?: RoomHealthMetric[] }>(
        '/api/rooms/health',
      );
      if (data.ok && Array.isArray(data.metrics)) {
        setRoomHealthList(data.metrics);
      }
    } catch {
      // Silencioso
    }
  }, []);

  const value = useMemo<GlobalStateContextValue>(
    () => ({
      isSocketConnected,
      dbVersion,
      presencesByAccountId,
      myLifecycleStatus,
      staffAuditLogs,
      supportTickets,
      banReviews,
      premiumOrders,
      premiumPixConfig,
      marketListings,
      supportModMessages,
      roomHealthList,
      lastTerminatedNotice,
      clearTerminatedNotice,
      syncPatch,
      syncDjMedia,
      refreshStaffAuditLogs,
      refreshSupportTickets,
      refreshBanReviews,
      refreshPremiumOrders,
      refreshPremiumPixConfig,
      refreshMarketListings,
      refreshSupportModMessages,
      refreshRoomHealth,
      bindHeartbeatUser,
    }),
    [
      isSocketConnected,
      dbVersion,
      presencesByAccountId,
      myLifecycleStatus,
      staffAuditLogs,
      supportTickets,
      banReviews,
      premiumOrders,
      premiumPixConfig,
      marketListings,
      supportModMessages,
      roomHealthList,
      lastTerminatedNotice,
      clearTerminatedNotice,
      syncPatch,
      syncDjMedia,
      refreshStaffAuditLogs,
      refreshSupportTickets,
      refreshBanReviews,
      refreshPremiumOrders,
      refreshPremiumPixConfig,
      refreshMarketListings,
      refreshSupportModMessages,
      refreshRoomHealth,
      bindHeartbeatUser,
    ],
  );

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export function useGlobalState(): GlobalStateContextValue {
  const ctx = useContext(GlobalStateContext);
  if (!ctx) {
    throw new Error('useGlobalState deve ser usado dentro de GlobalStateProvider.');
  }
  return ctx;
}
