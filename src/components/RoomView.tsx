import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Crown,
  Disc3,
  DoorOpen,
  Globe,
  KeyRound,
  Lock,
  MapPin,
  Megaphone,
  Music,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserMinus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { GLOBAL_ROOMS } from '../data/catalog';
import {
  AvatarDisplayMode,
  AvatarGender,
  EquippedOutfit,
  MockUser,
  PlayerProgressState,
  PurchasableRoomItem,
  PurchasableWallpaperItem,
  RoomAvatarPresence,
  RoomBackdropTheme,
  RoomDef,
  RoomDjQueuedTrack,
  RoomDjTrack,
  RoomId,
  RoomInteractiveProp,
  ServerRegion,
  SkinToneId,
  UserAccount,
  UserRole,
} from '../types/game';
import {
  appendRoomMessage,
  checkChatModeration,
  clearRoomDjTrack,
  clearRoomMessages,
  createCustomRoom,
  createRealtimeChannel,
  deleteCustomRoom,
  getSavedCurrentRoomId,
  getTabClientId,
  kickAvatarFromRoom,
  readRoomsSnapshot,
  removeAvatarPresence,
  saveCurrentRoomId,
  setRoomDjTrack,
  SharedRoomsSnapshot,
  updateCustomRoomNotice,
  upsertAvatarPresence,
} from '../utils/realtime';
import {
  evaluateMessageWithSentinelBot,
  getSentinelAiBotForServer,
  handleRoomReportWithModBot,
} from '../utils/aiBots';
import { soundEngine } from '../utils/sound';
import {
  SERVER_REGION_META,
  getAccountByIdOrUsername,
  getFullRoomCatalog,
  getFullWallpaperCatalog,
  getModeratorServer,
  inferServerRegionFromCountry,
  isPrimaryAdminAccount,
  isVipAccount,
  normalizeUsername,
} from '../utils/storage';
import { ChatBox, ChatModCapability } from './ChatBox';
import { ProfileAvatar } from './ProfileAvatar';
import { StaffRoleBadge, VipBadge } from './StaffDirectory';
import { MeDollSvg } from './svg/MeDollSvg';
import { RoomBackdropSvg } from './svg/RoomBackdropSvg';
import { DjBoothModal } from './DjBoothModal';
import { DJMediaSyncController } from '../core/media/DJMediaSyncController';
import { StarlightEngine } from '../core/engine';
import {
  emitRoomTelemetryPing,
  subscribeRemoteSync,
} from '../core/state/socketBridge';
import { resolveCoreStaffRole } from '../core/security/RoleGuard';

export interface PublicProfileFallback {
  equipped?: EquippedOutfit;
  skinTone?: SkinToneId;
  avatarGender?: AvatarGender;
  customAvatarUrl?: string;
  avatarDisplayMode?: AvatarDisplayMode;
  role?: UserRole;
}

interface RoomViewProps {
  currentUser: UserAccount;
  playerState: PlayerProgressState;
  deletedItemIds: string[];
  bannedWords: string[];
  users: MockUser[];
  serverNotices?: Partial<Record<ServerRegion, string>>;
  mutedUsers?: Record<string, { until: number; reason: string; server: ServerRegion }>;
  warningCounts?: Record<string, number>;
  roomCatalog?: PurchasableRoomItem[];
  wallpaperCatalog?: PurchasableWallpaperItem[];
  ownedRoomTemplateIds?: string[];
  ownedWallpaperIds?: string[];
  onGoToShop?: () => void;
  onStaffNotice: (notice: string) => void;
  onUpdateServerNotice?: (server: ServerRegion, notice: string) => void;
  onStaffBanUsername: (
    username: string,
    reason?: string,
    targetServer?: ServerRegion,
  ) => { ok: boolean; error?: string };
  onSentinelModerationAction: (params: {
    bot: UserAccount;
    action: 'warning' | 'mute' | 'ban';
    targetUsername: string;
    reason: string;
    server: ServerRegion;
    muteUntil?: number;
    roomId: RoomId;
  }) => void;
  onReportFiled?: () => void;
  onOpenStaffDesk?: (tab: 'overview' | 'cm' | 'moderation' | 'designer') => void;
  onOpenPublicProfile: (
    username: string,
    fallbackAppearance?: PublicProfileFallback,
  ) => void;
}

const BACKDROP_META: Record<
  RoomBackdropTheme,
  { label: string; desc: string }
> = {
  quarto_cozy: {
    label: 'Quarto Cozy',
    desc: 'Luzes quentes, cama aconchegante e tapete macio',
  },
  lounge_principal: {
    label: 'Lounge Moderno',
    desc: 'Salão arquitetônico em mármore marfim e veludo',
  },
  festa_cobertura: {
    label: 'Festa na Cobertura',
    desc: 'Terraço panorâmico ao entardecer com pista iluminada',
  },
  cafe_starlight: {
    label: 'Cafeteria',
    desc: 'Bistrô parisiense com toldo listado e balcão',
  },
  atelier_rosa: {
    label: 'Atelier Rosé',
    desc: 'Estúdio editorial em tons pastéis e dourado',
  },
  boate_neon: {
    label: 'Boate Neon Club',
    desc: 'Pista noturna com holofotes, mesa de som e LEDs vibrantes',
  },
  hotel_royal_vip: {
    label: 'Hotel de Luxo VIP',
    desc: 'Lobby & suíte de hotel 5 estrelas em mármore e ouro',
  },
  bar_lounge: {
    label: 'Bar Lounge Coquetel',
    desc: 'Bistrô noturno com prateleiras iluminadas e madeira escura',
  },
  cobertura_diamante_vip: {
    label: 'Cobertura Diamante VIP',
    desc: 'Terraço VIP com skyline noturno e pista cristal',
  },
  casa_estar_moderna: {
    label: 'Casa Moderna Living',
    desc: 'Sala ampla residencial com janelão verde e piso carvalho',
  },
  estudio_3d_designer: {
    label: 'Estúdio 3D Designer',
    desc: 'Passarela 3D de alta moda com holofotes cênicos, piso reflexivo e cabine de som',
  },
};


const FREE_BASE_BACKDROPS: RoomBackdropTheme[] = [
  'quarto_cozy',
  'lounge_principal',
  'estudio_3d_designer',
  'cafe_starlight',
  'festa_cobertura',
  'atelier_rosa',
];

/**
 * Módulo 5: Salas Globais Multiplayer em Tempo Real (RoomView.tsx).
 * - Seletor de Salas com contagem ao vivo e criação de salas Públicas ou Privadas.
 * - Suporte a Modelos de Sala (Comuns & VIP) e Papéis de Parede comprados na Starplaza.
 */
export const RoomView: React.FC<RoomViewProps> = ({
  currentUser,
  playerState,
  deletedItemIds,
  bannedWords,
  users,
  serverNotices,
  mutedUsers,
  warningCounts,
  roomCatalog,
  wallpaperCatalog,
  ownedRoomTemplateIds,
  ownedWallpaperIds,
  onGoToShop,
  onStaffNotice,
  onUpdateServerNotice,
  onStaffBanUsername,
  onSentinelModerationAction,
  onReportFiled,
  onOpenStaffDesk,
  onOpenPublicProfile,
}) => {
  const clientId = useMemo(() => getTabClientId(), []);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const isPrimaryAdmin = isPrimaryAdminAccount(currentUser);
  const modServer = getModeratorServer(currentUser);
  const initialServer: ServerRegion =
    currentUser.serverRegion ??
    modServer ??
    inferServerRegionFromCountry(playerState.countryCode) ??
    'BR';

  const [snapshot, setSnapshot] = useState<SharedRoomsSnapshot>(() =>
    readRoomsSnapshot(),
  );

  const resolvedInitialRoom = useMemo(() => {
    const savedId = getSavedCurrentRoomId(currentUser.id);
    const availableRooms = [...GLOBAL_ROOMS, ...snapshot.customRooms];
    if (savedId) {
      const found = availableRooms.find((r) => r.id === savedId);
      if (found) return found;
    }
    return (
      GLOBAL_ROOMS.find((r) => (r.serverRegion ?? 'BR') === initialServer) ??
      GLOBAL_ROOMS[0]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myStaffCoreRole = useMemo(
    () => resolveCoreStaffRole(currentUser),
    [currentUser],
  );

  const [activeServer, setActiveServer] = useState<ServerRegion>(
    () => resolvedInitialRoom.serverRegion ?? initialServer,
  );
  const [activeRoomId, setActiveRoomId] = useState<RoomId>(
    () => resolvedInitialRoom.id,
  );

  useEffect(() => {
    emitRoomTelemetryPing(activeRoomId, 24);
    const t = window.setInterval(() => {
      emitRoomTelemetryPing(activeRoomId, Math.round(20 + Math.random() * 14));
    }, 15_000);
    return () => window.clearInterval(t);
  }, [activeRoomId]);
  const [myPos, setMyPos] = useState<{ x: number; y: number; facing: 'left' | 'right' }>(() => ({
    x: 48,
    y: Math.round((resolvedInitialRoom.walkMinY + resolvedInitialRoom.walkMaxY) / 2),
    facing: 'right',
  }));
  const [isMyWalking, setIsMyWalking] = useState(false);
  const [isMySeated, setIsMySeated] = useState(false);
  const isMySeatedRef = useRef(isMySeated);
  isMySeatedRef.current = isMySeated;
  const myPosRef = useRef(myPos);
  myPosRef.current = myPos;
  const walkRafRef = useRef<number | null>(null);
  const lastBroadcastPosAtRef = useRef<number>(0);

  const [clickMarker, setClickMarker] = useState<{ x: number; y: number } | null>(null);
  const clickMarkerTimerRef = useRef<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [roomAlert, setRoomAlert] = useState<string | null>(null);
  const [banFeedback, setBanFeedback] = useState<string | null>(null);

  // Estado da Cabine de DJ e Áudio da Sala (sincronizado via YouTube IFrame API)
  const [showDjModal, setShowDjModal] = useState(false);
  const [isDjAudioMuted, setIsDjAudioMuted] = useState(false);
  const [djVolume, setDjVolume] = useState(80);
  const djAudioHostRef = useRef<HTMLDivElement | null>(null);
  const djControllerRef = useRef<DJMediaSyncController | null>(null);
  const starlightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const starlightEngineRef = useRef<StarlightEngine | null>(null);

  // Estado do Modal / Formulário de Criação de Nova Sala
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomSubtitle, setNewRoomSubtitle] = useState('');
  const [newRoomNotice, setNewRoomNotice] = useState('');
  const [newRoomBackdrop, setNewRoomBackdrop] =
    useState<RoomBackdropTheme>('quarto_cozy');
  const [newRoomWallpaperId, setNewRoomWallpaperId] = useState<string>('');
  const [newRoomVisibility, setNewRoomVisibility] = useState<'public' | 'private'>(
    'public',
  );
  const [newRoomServer, setNewRoomServer] = useState<ServerRegion>(initialServer);
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [lobbyFilter, setLobbyFilter] = useState<'todas' | 'public' | 'private' | 'minhas'>(
    'todas',
  );

  const resolvedRoomCatalog = useMemo(
    () => roomCatalog ?? getFullRoomCatalog(),
    [roomCatalog],
  );
  const resolvedWallpaperCatalog = useMemo(
    () => wallpaperCatalog ?? getFullWallpaperCatalog(),
    [wallpaperCatalog],
  );
  const ownedRoomSet = useMemo(
    () =>
      new Set(
        ownedRoomTemplateIds ??
          playerState.ownedRoomTemplateIds ??
          resolvedRoomCatalog.filter((r) => r.starter).map((r) => r.id),
      ),
    [ownedRoomTemplateIds, playerState.ownedRoomTemplateIds, resolvedRoomCatalog],
  );
  const ownedWallpaperSet = useMemo(
    () =>
      new Set(
        ownedWallpaperIds ??
          playerState.ownedWallpaperIds ??
          resolvedWallpaperCatalog.filter((w) => w.starter).map((w) => w.id),
      ),
    [ownedWallpaperIds, playerState.ownedWallpaperIds, resolvedWallpaperCatalog],
  );
  const unlockedCreateBackdrops = useMemo(() => {
    const ownedThemes = resolvedRoomCatalog
      .filter((r) => ownedRoomSet.has(r.id))
      .map((r) => r.backdropTheme);
    return Array.from(new Set<RoomBackdropTheme>([...FREE_BASE_BACKDROPS, ...ownedThemes]));
  }, [resolvedRoomCatalog, ownedRoomSet]);
  const lockedStarplazaRooms = useMemo(
    () => resolvedRoomCatalog.filter((r) => !ownedRoomSet.has(r.id)),
    [resolvedRoomCatalog, ownedRoomSet],
  );
  const ownedWallpapersList = useMemo(
    () => resolvedWallpaperCatalog.filter((w) => ownedWallpaperSet.has(w.id)),
    [resolvedWallpaperCatalog, ownedWallpaperSet],
  );

  // Estado do Painel de Dono da Sala
  const [roomNoticeDraft, setRoomNoticeDraft] = useState('');
  const [confirmCloseRoom, setConfirmCloseRoom] = useState(false);

  // Estado do Portão de Senha para entrar em salas Privadas
  const [pendingPrivateRoom, setPendingPrivateRoom] = useState<RoomDef | null>(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlockedRoomIds, setUnlockedRoomIds] = useState<string[]>([]);

  const allRooms = useMemo(
    () => [...GLOBAL_ROOMS, ...snapshot.customRooms],
    [snapshot.customRooms],
  );

  const activeRoom =
    allRooms.find((r) => r.id === activeRoomId) ?? GLOBAL_ROOMS[0];
  const activeRoomServer: ServerRegion = activeRoom.serverRegion ?? 'BR';

  const hasRoomModJurisdiction =
    isPrimaryAdmin || (modServer !== null && modServer === activeRoomServer);
  const chatModCapability: ChatModCapability = isPrimaryAdmin
    ? 'admin'
    : hasRoomModJurisdiction
      ? 'ban_only'
      : 'none';
  const chatModLabel = isPrimaryAdmin
    ? 'Administrador Geral'
    : hasRoomModJurisdiction
      ? `Moderador (${activeRoomServer})`
      : undefined;

  const filteredLobbyRooms = useMemo(() => {
    return allRooms.filter((room) => {
      if ((room.serverRegion ?? 'BR') !== activeServer) return false;
      if (lobbyFilter === 'public') return room.visibility === 'public';
      if (lobbyFilter === 'private') return room.visibility === 'private';
      if (lobbyFilter === 'minhas') {
        return (
          Boolean(room.creatorUsername) &&
          normalizeUsername(room.creatorUsername ?? '') ===
            normalizeUsername(currentUser.username)
        );
      }
      return true;
    });
  }, [allRooms, activeServer, lobbyFilter, currentUser.username]);

  // Sincroniza rascunho de aviso local ao trocar de sala
  useEffect(() => {
    setRoomNoticeDraft(activeRoom.roomNotice ?? '');
    setConfirmCloseRoom(false);
  }, [activeRoom.id, activeRoom.roomNotice]);

  // Verifica se o jogador atual é o criador local da sala ou o Admin Geral dono das salas oficiais
  const isOfficialOwner =
    Boolean(activeRoom.ownerId && activeRoom.ownerId === currentUser.id) ||
    (Boolean(activeRoom.isOfficial) && isPrimaryAdmin);
  const isRoomHost =
    isOfficialOwner ||
    (Boolean(activeRoom.creatorUsername) &&
      normalizeUsername(activeRoom.creatorUsername ?? '') ===
        normalizeUsername(currentUser.username));
  const canModerateRoomLocally =
    isRoomHost || (Boolean(activeRoom.isCustom) && isPrimaryAdmin);

  const activeRoomIdRef = useRef<RoomId>(activeRoomId);
  activeRoomIdRef.current = activeRoomId;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const playerStateRef = useRef(playerState);
  playerStateRef.current = playerState;

  // Lê sempre das refs mais recentes por padrão para evitar stale closures no heartbeat
  const buildMyPresence = (
    pos = myPosRef.current,
    roomId = activeRoomIdRef.current,
  ): RoomAvatarPresence => {
    const user = currentUserRef.current;
    const pState = playerStateRef.current;
    return {
      clientId,
      username: user.username,
      role: user.role,
      staffRoleTier: user.staffRoleTier,
      isVip: isVipAccount(user),
      roomId,
      x: pos.x,
      y: pos.y,
      facing: pos.facing,
      isSeated: isMySeatedRef.current,
      equipped: pState.equipped,
      skinTone: pState.skinTone,
      avatarGender: pState.avatarGender,
      customAvatarUrl: pState.customAvatarUrl,
      avatarDisplayMode: pState.avatarDisplayMode,
      lastSeen: Date.now(),
    };
  };

  // Garante retorno seguro ao Lounge apenas se a sala atual realmente deixou de existir ou se o avatar foi expulso
  useEffect(() => {
    const roomStillExists = allRooms.some((r) => r.id === activeRoomId);
    if (!roomStillExists) {
      activeRoomIdRef.current = 'lounge_principal';
      saveCurrentRoomId(currentUser.id, 'lounge_principal');
      setActiveRoomId('lounge_principal');
      setRoomAlert('A sala anterior foi encerrada pelo anfitrião.');
      return;
    }

    const latestKick = snapshot.kicks.find(
      (k) =>
        k.targetClientId === clientId &&
        k.roomId === activeRoomId &&
        Date.now() - k.at < 15_000,
    );
    if (latestKick) {
      activeRoomIdRef.current = 'lounge_principal';
      saveCurrentRoomId(currentUser.id, 'lounge_principal');
      setActiveRoomId('lounge_principal');
      setRoomAlert(
        `Você foi removida da sala pelo anfitrião ${latestKick.byUsername}.`,
      );
    }
  }, [allRooms, activeRoomId, snapshot.kicks, clientId, currentUser.id]);

  // Inicializa BroadcastChannel, ouvintes de storage e heartbeat
  useEffect(() => {
    const channel = createRealtimeChannel();
    channelRef.current = channel;

    const initialSnap = upsertAvatarPresence(buildMyPresence(), channel);
    setSnapshot(initialSnap);

    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === 'rooms:sync' && event.data.snapshot) {
          setSnapshot(event.data.snapshot as SharedRoomsSnapshot);
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'starlight_atelier_rooms_v1') {
        setSnapshot(readRoomsSnapshot());
      }
    };
    window.addEventListener('storage', handleStorage);

    const interval = window.setInterval(() => {
      setNowTs(Date.now());
      const refreshed = upsertAvatarPresence(buildMyPresence(), channelRef.current);
      setSnapshot(refreshed);
    }, 4000);

    const bubbleTicker = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    const handleBeforeUnload = () => {
      removeAvatarPresence(clientId, channelRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        setNowTs(Date.now());
        const refreshed = upsertAvatarPresence(buildMyPresence(), channelRef.current);
        setSnapshot(refreshed);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    const unsubscribeSocket = subscribeRemoteSync({
      onInit: () => {
        setSnapshot(readRoomsSnapshot());
      },
      onPatch: (patch) => {
        if (patch.roomsSnapshot || patch.djTrackUpdate) {
          setSnapshot(readRoomsSnapshot());
        }
      },
      onDjSynced: ({ roomId, track }) => {
        setSnapshot((prev) => {
          const nextTracks = { ...(prev.djTracksByRoom ?? {}) };
          if (track) {
            nextTracks[roomId] = track;
          } else {
            delete nextTracks[roomId];
          }
          return { ...prev, djTracksByRoom: nextTracks };
        });
      },
      onRoomTerminated: (notice) => {
        if (activeRoomIdRef.current !== notice.roomId) return;
        const fallbackId = (notice.fallbackRoomId || 'lounge_principal') as RoomId;
        const fallbackRoom =
          GLOBAL_ROOMS.find((r) => r.id === fallbackId) ?? GLOBAL_ROOMS[0];
        const safePos = { x: 48, y: 72, facing: 'right' as const };
        activeRoomIdRef.current = fallbackRoom.id;
        myPosRef.current = safePos;
        saveCurrentRoomId(currentUserRef.current.id, fallbackRoom.id);
        setActiveRoomId(fallbackRoom.id);
        setActiveServer(fallbackRoom.serverRegion ?? 'BR');
        setMyPos(safePos);
        setIsMyWalking(false);
        const evacuated = upsertAvatarPresence(
          buildMyPresence(safePos, fallbackRoom.id),
          channelRef.current,
        );
        setSnapshot(evacuated);
        setRoomAlert(
          `Sala reiniciada por ${notice.terminatedBy} (${notice.reason}). Você foi transferido com segurança para o Lounge Principal.`,
        );
      },
    });

    return () => {
      unsubscribeSocket();
      if (walkRafRef.current !== null) {
        window.cancelAnimationFrame(walkRafRef.current);
        walkRafRef.current = null;
      }
      if (clickMarkerTimerRef.current !== null) {
        window.clearTimeout(clickMarkerTimerRef.current);
      }
      window.clearInterval(interval);
      window.clearInterval(bubbleTicker);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      channel?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Sincroniza visual oficial (MeDoll ou Foto) e posição com throttling leve durante caminhada
  useEffect(() => {
    const now = Date.now();
    if (isMyWalking && now - lastBroadcastPosAtRef.current < 220) {
      return;
    }
    lastBroadcastPosAtRef.current = now;
    const updated = upsertAvatarPresence(buildMyPresence(), channelRef.current);
    setSnapshot(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeRoomId,
    myPos.x,
    myPos.y,
    myPos.facing,
    isMyWalking,
    isMySeated,
    playerState.equipped,
    playerState.skinTone,
    playerState.avatarGender,
    playerState.customAvatarUrl,
    playerState.avatarDisplayMode,
    currentUser.username,
    currentUser.role,
  ]);

  const resolveWalkablePoint = (
    rawX: number,
    rawY: number,
    ignoreSeatCollision = false,
  ): { x: number; y: number } => {
    let x = Math.max(8, Math.min(92, Number(rawX.toFixed(1))));
    let y = Math.max(
      activeRoom.walkMinY,
      Math.min(activeRoom.walkMaxY, Number(rawY.toFixed(1))),
    );
    if (!ignoreSeatCollision && Array.isArray(activeRoom.interactiveProps)) {
      for (const prop of activeRoom.interactiveProps) {
        if (!prop.collidable) continue;
        const radius = prop.collisionRadius ?? 6.5;
        const dx = x - prop.x;
        const dy = y - prop.y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius) {
          const angle = dist > 0.01 ? Math.atan2(dy, dx) : Math.PI / 2;
          x = Math.max(8, Math.min(92, Number((prop.x + Math.cos(angle) * (radius + 0.8)).toFixed(1))));
          y = Math.max(
            activeRoom.walkMinY,
            Math.min(activeRoom.walkMaxY, Number((prop.y + Math.sin(angle) * (radius + 0.8)).toFixed(1))),
          );
        }
      }
    }
    return { x, y };
  };

  // Movimentação por teclado (Setas ou WASD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -4;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 4;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dy = -3;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dy = 3;

      if (dx === 0 && dy === 0) return;
      e.preventDefault();
      setIsMySeated(false);

      setMyPos((prev) => {
        const safe = resolveWalkablePoint(prev.x + dx, prev.y + dy);
        return {
          x: safe.x,
          y: safe.y,
          facing: dx < 0 ? 'left' : dx > 0 ? 'right' : prev.facing,
        };
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRoom.walkMinY, activeRoom.walkMaxY, activeRoom.interactiveProps]);

  const roomCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allRooms.forEach((r) => {
      counts[r.id] = 0;
    });
    Object.values(snapshot.presences).forEach((p) => {
      counts[p.roomId] = (counts[p.roomId] ?? 0) + 1;
    });
    return counts;
  }, [allRooms, snapshot.presences]);

  const avatarsInRoom = useMemo(() => {
    return Object.values(snapshot.presences)
      .filter((p) => p.roomId === activeRoomId)
      .sort((a, b) => a.y - b.y);
  }, [snapshot.presences, activeRoomId]);

  const serverAvatarCounts = useMemo(() => {
    const counts: Record<ServerRegion, number> = { BR: 0, ES: 0, EN: 0 };
    Object.values(snapshot.presences).forEach((p) => {
      const room = allRooms.find((r) => r.id === p.roomId);
      const srv: ServerRegion = room?.serverRegion ?? 'BR';
      counts[srv] += 1;
    });
    return counts;
  }, [allRooms, snapshot.presences]);

  const cancelWalkAnimation = () => {
    if (walkRafRef.current !== null) {
      window.cancelAnimationFrame(walkRafRef.current);
      walkRafRef.current = null;
    }
    setIsMyWalking(false);
  };

  const enterRoomDirectly = (room: RoomDef) => {
    cancelWalkAnimation();
    setIsMySeated(false);
    soundEngine.playEquip();
    setRoomAlert(null);
    const nextPos: { x: number; y: number; facing: 'left' | 'right' } = {
      x: 48,
      y: Math.round((room.walkMinY + room.walkMaxY) / 2),
      facing: 'right',
    };
    activeRoomIdRef.current = room.id;
    myPosRef.current = nextPos;
    saveCurrentRoomId(currentUser.id, room.id);
    setActiveServer(room.serverRegion ?? 'BR');
    setActiveRoomId(room.id);
    setMyPos(nextPos);
    const updatedSnap = upsertAvatarPresence(
      buildMyPresence(nextPos, room.id),
      channelRef.current,
    );
    setSnapshot(updatedSnap);
  };

  const handleSelectRoom = (room: RoomDef) => {
    if (room.id === activeRoomId) return;

    const isCreator =
      Boolean(room.creatorUsername) &&
      normalizeUsername(room.creatorUsername ?? '') ===
        normalizeUsername(currentUser.username);

    if (
      room.visibility === 'private' &&
      !isCreator &&
      !isPrimaryAdmin &&
      !unlockedRoomIds.includes(room.id)
    ) {
      setPendingPrivateRoom(room);
      setEnteredPassword('');
      setPasswordError(null);
      return;
    }

    enterRoomDirectly(room);
  };

  const handleConfirmPrivateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPrivateRoom) return;

    const secret = enteredPassword.trim();
    const matchesPassword =
      pendingPrivateRoom.password && secret === pendingPrivateRoom.password;
    const matchesInvite =
      pendingPrivateRoom.inviteCode &&
      secret.toUpperCase() === pendingPrivateRoom.inviteCode.toUpperCase();

    if (!matchesPassword && !matchesInvite) {
      setPasswordError('Senha ou código de convite incorreto.');
      soundEngine.playModAction();
      return;
    }

    setUnlockedRoomIds((prev) => [...prev, pendingPrivateRoom.id]);
    const target = pendingPrivateRoom;
    setPendingPrivateRoom(null);
    enterRoomDirectly(target);
  };

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    if (newRoomVisibility === 'private' && newRoomPassword.trim().length < 2) {
      return;
    }

    const inviteCode = `STAR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const created: RoomDef = {
      id: `room_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: newRoomName.trim(),
      subtitle:
        newRoomSubtitle.trim() || `Ambiente exclusivo criado por ${currentUser.username}`,
      backdropTheme: newRoomBackdrop,
      wallpaperId: newRoomWallpaperId || undefined,
      walkMinY: 56,
      walkMaxY: 88,
      visibility: newRoomVisibility,
      serverRegion: newRoomServer,
      password: newRoomVisibility === 'private' ? newRoomPassword.trim() : undefined,
      inviteCode: newRoomVisibility === 'private' ? inviteCode : undefined,
      creatorUsername: currentUser.username,
      roomNotice: newRoomNotice.trim() || undefined,
      isCustom: true,
    };

    soundEngine.playPurchase();
    const nextSnap = createCustomRoom(created, channelRef.current);
    setSnapshot(nextSnap);
    setShowCreateModal(false);
    setNewRoomName('');
    setNewRoomSubtitle('');
    setNewRoomNotice('');
    setNewRoomPassword('');
    setNewRoomWallpaperId('');
    setNewRoomVisibility('public');
    enterRoomDirectly(created);
  };

  const handleSaveRoomNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom.isCustom) return;
    soundEngine.playModAction();
    const nextSnap = updateCustomRoomNotice(
      activeRoom.id,
      roomNoticeDraft,
      currentUser.username,
      channelRef.current,
    );
    setSnapshot(nextSnap);
  };

  const handleKickFromMyRoom = (guest: RoomAvatarPresence) => {
    soundEngine.playModAction();
    const nextSnap = kickAvatarFromRoom(
      activeRoom.id,
      guest.clientId,
      guest.username,
      currentUser.username,
      channelRef.current,
    );
    setSnapshot(nextSnap);
  };

  const handleDeleteMyRoom = () => {
    if (!activeRoom.isCustom) return;
    soundEngine.playModAction();
    const nextSnap = deleteCustomRoom(activeRoom.id, channelRef.current);
    setConfirmCloseRoom(false);
    activeRoomIdRef.current = 'lounge_principal';
    saveCurrentRoomId(currentUser.id, 'lounge_principal');
    const updatedSnap = upsertAvatarPresence(
      buildMyPresence(myPosRef.current, 'lounge_principal'),
      channelRef.current,
    );
    setSnapshot({ ...nextSnap, presences: updatedSnap.presences });
  };

  const currentRoomDjTrack = snapshot.djTracksByRoom?.[activeRoomId];

  // Controlador oficial YouTube IFrame API (DJMediaSyncController) sincronizado por segundo exato
  useEffect(() => {
    const host = djAudioHostRef.current;
    if (!host) return;
    const controller = new DJMediaSyncController();
    djControllerRef.current = controller;
    void controller.mount(host).catch(() => undefined);

    return () => {
      controller.destroy();
      djControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = djControllerRef.current;
    if (!controller) return;
    controller.setMuted(isDjAudioMuted);
    controller.setVolume(djVolume);
    if (currentRoomDjTrack?.videoId) {
      controller.syncTrack({
        video_id: currentRoomDjTrack.videoId,
        started_at: currentRoomDjTrack.startedAt,
        is_playing: currentRoomDjTrack.isPlaying,
      });
    } else {
      controller.syncTrack(null);
    }
  }, [
    currentRoomDjTrack?.videoId,
    currentRoomDjTrack?.startedAt,
    currentRoomDjTrack?.isPlaying,
    isDjAudioMuted,
    djVolume,
  ]);

  // Motor Gráfico StarlightEngine (60 FPS FXPipeline: Iluminação Ambiente, Partículas & Pulsos DJ)
  useEffect(() => {
    const canvas = starlightCanvasRef.current;
    if (!canvas) return;
    const engine = new StarlightEngine(canvas, {
      logicalWidth: 1000,
      logicalHeight: 625,
      mode: 'fx_overlay',
    });
    engine.setLocalPlayerId(clientId);
    engine.start();
    starlightEngineRef.current = engine;

    return () => {
      engine.destroy();
      starlightEngineRef.current = null;
    };
  }, [clientId]);

  useEffect(() => {
    const engine = starlightEngineRef.current;
    if (!engine) return;
    engine.setRoomBackdropTheme(activeRoom.backdropTheme);
    engine.syncDjTrack(currentRoomDjTrack);
    engine.syncPresences(avatarsInRoom);
  }, [activeRoom.backdropTheme, currentRoomDjTrack, avatarsInRoom]);

  const handlePlayDjTrack = (newTrack: RoomDjTrack) => {
    soundEngine.playEquip();
    const nextSnap = setRoomDjTrack(activeRoomId, newTrack, channelRef.current);
    setSnapshot(nextSnap);

    const noticeSnap = appendRoomMessage(
      activeRoomId,
      {
        id: `msg_dj_${Date.now()}`,
        roomId: activeRoomId,
        senderUsername: 'Cabine de DJ 🎧',
        senderRole: 'system',
        text: `🎶 Nova música tocando: "${newTrack.title}" (selecionada por ${newTrack.addedBy})`,
        createdAt: Date.now(),
      },
      null,
      channelRef.current,
    );
    setSnapshot(noticeSnap);
  };

  const handleAddToDjQueue = (item: RoomDjQueuedTrack) => {
    soundEngine.playEquip();
    if (!currentRoomDjTrack) {
      handlePlayDjTrack({
        videoId: item.videoId,
        youtubeUrl: item.youtubeUrl,
        title: item.title,
        addedBy: item.addedBy,
        startedAt: Date.now(),
        isPlaying: true,
        queue: [],
      });
      return;
    }
    const nextQueue = [...(currentRoomDjTrack.queue ?? []), item];
    const nextSnap = setRoomDjTrack(
      activeRoomId,
      { ...currentRoomDjTrack, queue: nextQueue },
      channelRef.current,
    );
    setSnapshot(nextSnap);
  };

  const handleRemoveFromDjQueue = (queueItemId: string) => {
    if (!currentRoomDjTrack) return;
    const nextQueue = (currentRoomDjTrack.queue ?? []).filter(
      (q) => q.id !== queueItemId,
    );
    const nextSnap = setRoomDjTrack(
      activeRoomId,
      { ...currentRoomDjTrack, queue: nextQueue },
      channelRef.current,
    );
    setSnapshot(nextSnap);
  };

  const handlePlayNextFromDjQueue = () => {
    const queue = currentRoomDjTrack?.queue ?? [];
    if (queue.length === 0) return;
    const [nextItem, ...rest] = queue;
    handlePlayDjTrack({
      videoId: nextItem.videoId,
      youtubeUrl: nextItem.youtubeUrl,
      title: nextItem.title,
      addedBy: nextItem.addedBy,
      startedAt: Date.now(),
      isPlaying: true,
      queue: rest,
    });
  };

  useEffect(() => {
    const controller = djControllerRef.current;
    if (!controller) return;
    controller.setOnEnded(() => {
      const q = currentRoomDjTrack?.queue ?? [];
      if (q.length > 0) {
        const [nextItem, ...rest] = q;
        const nextSnap = setRoomDjTrack(
          activeRoomId,
          {
            videoId: nextItem.videoId,
            youtubeUrl: nextItem.youtubeUrl,
            title: nextItem.title,
            addedBy: nextItem.addedBy,
            startedAt: Date.now(),
            isPlaying: true,
            queue: rest,
          },
          channelRef.current,
        );
        setSnapshot(nextSnap);
      } else if (currentRoomDjTrack?.isPlaying) {
        controller.syncTrack({
          video_id: currentRoomDjTrack.videoId,
          started_at: Date.now(),
          is_playing: true,
        });
      }
    });
    return () => controller.setOnEnded(undefined);
  }, [activeRoomId, currentRoomDjTrack]);

  const handleStopDjTrack = () => {
    soundEngine.playModAction();
    const nextSnap = clearRoomDjTrack(activeRoomId, channelRef.current);
    setSnapshot(nextSnap);

    const noticeSnap = appendRoomMessage(
      activeRoomId,
      {
        id: `msg_dj_stop_${Date.now()}`,
        roomId: activeRoomId,
        senderUsername: 'Cabine de DJ 🎧',
        senderRole: 'system',
        text: `⏹️ A música da sala foi pausada por ${currentUser.username}.`,
        createdAt: Date.now(),
      },
      null,
      channelRef.current,
    );
    setSnapshot(noticeSnap);
  };

  const walkAvatarToTarget = (
    rawTargetX: number,
    rawTargetY: number,
    sitOnArrival: boolean,
  ) => {
    const { x: targetX, y: targetY } = resolveWalkablePoint(
      rawTargetX,
      rawTargetY,
      sitOnArrival,
    );

    setClickMarker({ x: targetX, y: targetY });
    starlightEngineRef.current?.emitSparkleAtPercent(targetX, targetY, 10);
    if (clickMarkerTimerRef.current !== null) {
      window.clearTimeout(clickMarkerTimerRef.current);
    }
    clickMarkerTimerRef.current = window.setTimeout(() => setClickMarker(null), 650);

    const startPos = myPosRef.current;
    const dx = targetX - startPos.x;
    const dy = targetY - startPos.y;
    const dist = Math.hypot(dx, dy);

    const nextFacing: 'left' | 'right' =
      Math.abs(dx) > 0.6 ? (dx < 0 ? 'left' : 'right') : startPos.facing;

    cancelWalkAnimation();
    setIsMySeated(false);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (dist < 0.8 || prefersReducedMotion) {
      setMyPos({ x: targetX, y: targetY, facing: nextFacing });
      setIsMySeated(sitOnArrival);
      return;
    }

    const durationMs = Math.max(240, Math.min(1850, dist * 26));
    const startTime = performance.now();
    setIsMyWalking(true);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      const curX = Number((startPos.x + dx * eased).toFixed(2));
      const curY = Number((startPos.y + dy * eased).toFixed(2));

      setMyPos({ x: curX, y: curY, facing: nextFacing });

      if (t < 1) {
        walkRafRef.current = window.requestAnimationFrame(step);
      } else {
        walkRafRef.current = null;
        setMyPos({ x: targetX, y: targetY, facing: nextFacing });
        setIsMyWalking(false);
        setIsMySeated(sitOnArrival);
      }
    };

    walkRafRef.current = window.requestAnimationFrame(step);
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    walkAvatarToTarget(clickX, clickY, false);
  };

  const handlePropClick = (prop: RoomInteractiveProp, e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playEquip();
    if (prop.kind === 'chair' || prop.kind === 'sofa') {
      walkAvatarToTarget(prop.seatX ?? prop.x, prop.seatY ?? prop.y, true);
    } else {
      walkAvatarToTarget(prop.x, prop.y + (prop.collisionRadius ?? 6.5) + 1.5, false);
    }
  };

  const activeSentinelBot = getSentinelAiBotForServer(activeRoomServer);
  const roomMessages = snapshot.messagesByRoom[activeRoomId] ?? [];
  const myMuteEntry = mutedUsers?.[normalizeUsername(currentUser.username)];
  const myMutedUntil =
    myMuteEntry && myMuteEntry.until > nowTs ? myMuteEntry.until : null;

  const handleSendChatMessage = (
    text: string,
  ): { blocked: boolean; reason?: string } => {
    if (myMutedUntil && myMutedUntil > Date.now()) {
      return {
        blocked: true,
        reason: `Você está silenciada temporariamente (${myMuteEntry?.reason ?? 'Reincidência no chat'}).`,
      };
    }

    const isSenderStaff =
      isPrimaryAdmin ||
      Boolean(currentUser.isPrimaryOwner) ||
      currentUser.role === 'admin' ||
      Boolean(currentUser.staffRoleTier);

    // Vigilância progressiva em tempo real do Bot Sentinela (Advertência -> Mute 5 min -> Ban)
    if (!isSenderStaff) {
      const priorWarnings =
        warningCounts?.[normalizeUsername(currentUser.username)] ?? 0;
      const sentinelCheck = evaluateMessageWithSentinelBot({
        text,
        roomServer: activeRoomServer,
        senderUsername: currentUser.username,
        bannedWords,
        recentRoomMessages: roomMessages,
        priorWarnings,
      });

      if (
        sentinelCheck.triggered &&
        sentinelCheck.bot &&
        sentinelCheck.publicChatNotice &&
        sentinelCheck.action !== 'none'
      ) {
        soundEngine.playModAction();
        const noticeSnap = appendRoomMessage(
          activeRoomId,
          {
            id: `msg_bot_mod_${Date.now()}`,
            roomId: activeRoomId,
            senderUsername: `Moderador (${activeRoomServer})`,
            senderRole: 'system',
            text: sentinelCheck.publicChatNotice,
            createdAt: Date.now(),
          },
          null,
          channelRef.current,
        );
        setSnapshot(noticeSnap);

        onSentinelModerationAction({
          bot: sentinelCheck.bot,
          action: sentinelCheck.action,
          targetUsername: currentUser.username,
          reason:
            sentinelCheck.reason ??
            `Violação detectada automaticamente pelo Moderador (${activeRoomServer})`,
          server: activeRoomServer,
          muteUntil: sentinelCheck.muteUntil,
          roomId: activeRoomId,
        });

        return {
          blocked: true,
          reason: sentinelCheck.publicChatNotice,
        };
      }

      const wordCheck = checkChatModeration(text, bannedWords);
      if (wordCheck.blocked) {
        return {
          blocked: true,
          reason: `Mensagem bloqueada pelo filtro de moderação (termo não permitido: "${wordCheck.matchedWord}").`,
        };
      }
    }

    soundEngine.playEquip();
    let nextSnap = appendRoomMessage(
      activeRoomId,
      {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        roomId: activeRoomId,
        senderUsername: currentUser.username,
        senderRole: currentUser.role,
        senderStaffTier: currentUser.staffRoleTier,
        senderIsVip: isVipAccount(currentUser),
        text,
        createdAt: Date.now(),
        senderAvatar: {
          equipped: playerState.equipped,
          skinTone: playerState.skinTone,
          avatarGender: playerState.avatarGender,
          customAvatarUrl: playerState.customAvatarUrl,
          avatarDisplayMode: playerState.avatarDisplayMode,
        },
      },
      clientId,
      channelRef.current,
    );

    setSnapshot(nextSnap);
    return { blocked: false };
  };

  const applyRoomBanToTarget = (
    targetUsername: string,
    reason?: string,
  ): { ok: true } | { ok: false; error: string } => {
    const targetNormalized = normalizeUsername(targetUsername);
    if (targetNormalized === normalizeUsername(currentUser.username)) {
      return { ok: false, error: 'Você não pode banir a própria conta.' };
    }

    const targetAccount = getAccountByIdOrUsername(undefined, targetNormalized);
    const targetMockUser = users.find(
      (u) => normalizeUsername(u.username) === targetNormalized,
    );

    if (!targetMockUser && !targetAccount) {
      return {
        ok: false,
        error: `Usuário "${targetNormalized}" não encontrado na comunidade.`,
      };
    }

    const targetIsStaffOrOwner =
      Boolean(targetAccount?.isPrimaryOwner) ||
      Boolean(targetMockUser?.isPrimaryOwner) ||
      targetAccount?.role === 'admin' ||
      targetMockUser?.role === 'admin';

    if (targetIsStaffOrOwner && !isPrimaryAdmin) {
      return {
        ok: false,
        error: 'Moderadores não têm permissão para banir outros integrantes da Staff.',
      };
    }

    const targetServer: ServerRegion =
      targetMockUser?.serverRegion ??
      targetAccount?.serverRegion ??
      inferServerRegionFromCountry(targetMockUser?.countryCode);
    const isPresentInCurrentServerRoom = avatarsInRoom.some(
      (a) => normalizeUsername(a.username) === targetNormalized,
    );

    if (
      !isPrimaryAdmin &&
      modServer !== null &&
      targetServer !== modServer &&
      !(activeRoomServer === modServer && isPresentInCurrentServerRoom)
    ) {
      return {
        ok: false,
        error: `Jurisdição restrita: ${targetNormalized} pertence ao Servidor ${targetServer}, fora do seu Servidor ${modServer}.`,
      };
    }

    const banResult = onStaffBanUsername(
      targetNormalized,
      reason?.trim() || `Banimento aplicado no Servidor ${activeRoomServer}`,
      activeRoomServer,
    );
    if (!banResult.ok) {
      return { ok: false, error: banResult.error ?? 'Não foi possível aplicar o banimento.' };
    }

    const nextSnap = appendRoomMessage(
      activeRoomId,
      {
        id: `msg_ban_${Date.now()}`,
        roomId: activeRoomId,
        senderUsername: `Moderação (${activeRoomServer})`,
        senderRole: 'system',
        text: `${targetNormalized} foi suspensa no Servidor ${activeRoomServer} por ${currentUser.username}.`,
        createdAt: Date.now(),
      },
      null,
      channelRef.current,
    );
    setSnapshot(nextSnap);
    return { ok: true };
  };

  const handleStaffCommand = (commandText: string): string | null => {
    const parts = commandText.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === '/report') {
      const target = parts[1];
      if (!target) {
        return 'Uso correto: /report usuario [motivo]';
      }
      const reason = parts.slice(2).join(' ').trim() || 'Conduta imprópria reportada';
      soundEngine.playModAction();
      const res = handleRoomReportWithModBot({
        reporter: currentUser.username,
        target,
        reason,
        server: activeRoomServer,
        roomId: activeRoomId,
      });
      const nextSnap = appendRoomMessage(
        activeRoomId,
        {
          id: `msg_rep_${Date.now()}`,
          roomId: activeRoomId,
          senderUsername: `Moderação (${activeRoomServer})`,
          senderRole: 'system',
          text: res.publicChatNotice,
          createdAt: Date.now(),
        },
        null,
        channelRef.current,
      );
      setSnapshot(nextSnap);
      onReportFiled?.();
      return null;
    }

    if (cmd === '/ajuda') {
      if (chatModCapability === 'admin') {
        return 'Comandos Administrador Geral: /aviso <texto>, /evento <texto>, /ban usuario [motivo], /limpar, /report usuario motivo';
      }
      if (chatModCapability === 'ban_only') {
        return `Comandos Moderador (${activeRoomServer}): /ban usuario [motivo], /report usuario motivo`;
      }
      return 'Comando disponível: /report usuario [motivo]';
    }

    if (!hasRoomModJurisdiction) {
      return `Sem permissão de moderação neste servidor (${activeRoomServer}). Use /report usuario motivo.`;
    }

    if (cmd === '/limpar') {
      if (chatModCapability !== 'admin') {
        return 'Permissão restrita: apenas o Administrador Geral pode limpar o histórico do chat.';
      }
      soundEngine.playModAction();
      const cleared = clearRoomMessages(activeRoomId, channelRef.current);
      setSnapshot(cleared);
      return null;
    }

    if (cmd === '/aviso' || cmd === '/evento') {
      if (chatModCapability !== 'admin') {
        return 'Permissão restrita: apenas o Administrador Geral pode publicar avisos e eventos.';
      }
      const noticeText = parts.slice(1).join(' ').trim();
      if (!noticeText) {
        return `Uso correto: ${cmd} <mensagem>`;
      }
      if (cmd === '/aviso' && isPrimaryAdmin) {
        onStaffNotice(noticeText);
      }
      onUpdateServerNotice?.(activeRoomServer, noticeText);
      const nextSnap = appendRoomMessage(
        activeRoomId,
        {
          id: `msg_sys_${Date.now()}`,
          roomId: activeRoomId,
          senderUsername:
            cmd === '/evento'
              ? `Evento (${activeRoomServer})`
              : `Comunicado (${activeRoomServer})`,
          senderRole: 'system',
          text: `Publicado por ${currentUser.displayName || currentUser.username}: "${noticeText}"`,
          createdAt: Date.now(),
        },
        null,
        channelRef.current,
      );
      setSnapshot(nextSnap);
      return null;
    }

    if (cmd === '/ban') {
      if (!hasRoomModJurisdiction) {
        return 'Permissão restrita: apenas Moderadores do servidor e Administrador Geral podem aplicar banimentos.';
      }
      const rawTarget = parts[1];
      if (!rawTarget) {
        return 'Uso correto: /ban usuario [motivo opcional]';
      }
      const reason =
        parts.slice(2).join(' ').trim() ||
        `Banimento aplicado no chat (${activeRoomServer})`;
      const res = applyRoomBanToTarget(rawTarget, reason);
      return res.ok ? null : res.error;
    }

    return `Comando desconhecido (${cmd}). Digite /ajuda para ver os comandos liberados.`;
  };

  return (
    <div className="space-y-6">
      {/* Alerta caso o usuário seja expulso ou a sala seja encerrada */}
      {roomAlert && (
        <div
          role="alert"
          className="px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#B91C1C] flex items-center justify-between gap-3"
        >
          <span>{roomAlert}</span>
          <button
            type="button"
            onClick={() => setRoomAlert(null)}
            className="text-[#B91C1C] hover:underline shrink-0 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 1. Seletor de Salas Globais (Lobby) + Botão Criar Nova Sala */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EFEAE3]">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#1C1917] tracking-tight">
              Lobby de Salas Globais
            </h2>
            <p className="text-xs text-[#6B645D] mt-0.5">
              Entre em um ambiente existente ou crie sua própria sala pública ou privada com painel de dono
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#44403C] font-mono-num">
              <Users className="w-4 h-4 text-[#C8235D]" />
              {Object.keys(snapshot.presences).length} avatares online
            </span>

            <button
              type="button"
              onClick={() => {
                setNewRoomServer(activeServer);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Criar Nova Sala
            </button>
          </div>
        </div>

        {/* Seletor de Servidor Regional (BR, ES, EN) */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['BR', 'ES', 'EN'] as ServerRegion[]).map((srv) => {
              const srvMeta = SERVER_REGION_META[srv];
              const isSelectedServer = activeServer === srv;
              const isMyModServer = modServer === srv;
              return (
                <button
                  key={srv}
                  type="button"
                  onClick={() => setActiveServer(srv)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                    isSelectedServer
                      ? 'bg-[#1C1917] text-white border-[#1C1917]'
                      : 'bg-[#FAF8F5] text-[#44403C] border-[#E6E0D8] hover:bg-white hover:border-[#C7BEB2]'
                  }`}
                >
                  <span className="text-base leading-none">{srvMeta.flagEmoji}</span>
                  <span>{srvMeta.label}</span>
                  <span className="font-mono-num text-[11px] opacity-80">
                    ({serverAvatarCounts[srv]})
                  </span>
                  {isMyModServer && (
                    <span className="text-[10px] font-bold text-[#C8235D] bg-[#FCE8EF] px-1.5 py-0.5 rounded">
                      Seu Servidor
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <span className="text-[11px] text-[#6B645D] flex items-center gap-1.5">
            <span className="text-sm">{SERVER_REGION_META[activeServer].flagEmoji}</span>
            <span>{SERVER_REGION_META[activeServer].description}</span>
          </span>
        </div>

        {/* Filtros rápidos do Lobby */}
        {snapshot.customRooms.some((r) => (r.serverRegion ?? 'BR') === activeServer) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-3">
            {(
              [
                { id: 'todas', label: 'Todas' },
                { id: 'public', label: 'Públicas' },
                { id: 'private', label: 'Privadas' },
                { id: 'minhas', label: 'Minhas Salas' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setLobbyFilter(f.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  lobbyFilter === f.id
                    ? 'bg-[#1C1917] text-white'
                    : 'bg-[#F5F2EC] text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {filteredLobbyRooms.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#6B645D]">
            Nenhuma sala encontrada neste filtro. Clique em <strong>Criar Nova Sala</strong> para abrir seu próprio ambiente!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {filteredLobbyRooms.map((room) => {
              const isSelected = room.id === activeRoomId;
              const count = roomCounts[room.id] ?? 0;
              const roomSrv = room.serverRegion ?? 'BR';
              const srvMeta = SERVER_REGION_META[roomSrv];

              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => handleSelectRoom(room)}
                  className={`text-left rounded-xl border p-4 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#C8235D] bg-[#C8235D]/[0.04]'
                      : 'border-[#E6E0D8] bg-[#FAF8F5] hover:border-[#C7BEB2] hover:bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="text-base leading-none shrink-0"
                          title={`Servidor: ${srvMeta.countryName}`}
                        >
                          {srvMeta.flagEmoji}
                        </span>
                        <h3 className="text-sm font-bold text-[#1C1917] inline-flex items-center gap-1.5 truncate">
                          {room.visibility === 'private' ? (
                            <Lock className="w-3.5 h-3.5 text-[#C8235D] shrink-0" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 text-[#6B645D] shrink-0" />
                          )}
                          <span className="truncate">{room.name}</span>
                        </h3>
                      </div>
                      <span className="font-mono-num text-xs font-semibold text-[#C8235D] shrink-0">
                        {count} {count === 1 ? 'avatar' : 'avatares'}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B645D] mt-1.5 leading-relaxed line-clamp-2">
                      {room.subtitle}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#EFEAE3] flex items-center justify-between text-xs gap-2">
                    <span
                      className={`font-semibold inline-flex items-center gap-1 ${
                        isSelected ? 'text-[#C8235D]' : 'text-[#44403C]'
                      }`}
                    >
                      <DoorOpen className="w-3.5 h-3.5" />
                      {isSelected
                        ? 'Você está aqui'
                        : room.visibility === 'private'
                          ? 'Privada · Senha'
                          : 'Entrar na sala'}
                    </span>
                    <span className="text-[11px] text-[#78716C] truncate inline-flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#E6E0D8] text-[10px] font-mono font-semibold text-[#44403C] inline-flex items-center gap-1">
                        <span>{srvMeta.flagEmoji}</span>
                        <span>{roomSrv}</span>
                      </span>
                      <span className="truncate">
                        {room.creatorUsername
                          ? `por ${room.creatorUsername}`
                          : BACKDROP_META[room.backdropTheme]?.label ?? 'Sala Oficial'}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal: Criar Nova Sala Própria */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Criar Nova Sala"
        >
          <div className="bg-white border border-[#E6E0D8] rounded-xl max-w-2xl w-full p-6 shadow-xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE3]">
              <div>
                <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                  Criar Nova Sala
                </h3>
                <p className="text-xs text-[#6B645D] mt-0.5">
                  Você receberá privilégios de Dono da Sala para moderar, definir avisos e fechar o ambiente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-[#6B645D] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoomSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">Nome da sala</span>
                  <input
                    type="text"
                    required
                    maxLength={38}
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Ex: Quarto Cozy da Sofia"
                    className="mt-1.5 w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">
                    Aviso inicial da sala (opcional)
                  </span>
                  <input
                    type="text"
                    maxLength={100}
                    value={newRoomNotice}
                    onChange={(e) => setNewRoomNotice(e.target.value)}
                    placeholder="Ex: Tema do desfile hoje: Vintage!"
                    className="mt-1.5 w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">
                    Descrição / Tema
                  </span>
                  <input
                    type="text"
                    maxLength={90}
                    value={newRoomSubtitle}
                    onChange={(e) => setNewRoomSubtitle(e.target.value)}
                    placeholder="Ex: Encontro para montar looks e bater papo"
                    className="mt-1.5 w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">
                    Servidor Regional da Sala
                  </span>
                  <select
                    value={newRoomServer}
                    onChange={(e) => setNewRoomServer(e.target.value as ServerRegion)}
                    className="mt-1.5 w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                  >
                    <option value="BR">🇧🇷 Servidor Brasileiro (BR)</option>
                    <option value="ES">🇪🇸 Servidor Español (ES)</option>
                    <option value="EN">🇺🇸 English Server (EN)</option>
                  </select>
                </label>
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#44403C] mb-1.5">
                  Modelos de Sala Desbloqueados (Comuns & Adquiridos)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {unlockedCreateBackdrops.map((themeKey) => {
                    const meta = BACKDROP_META[themeKey];
                    const selected = newRoomBackdrop === themeKey;
                    return (
                      <button
                        key={themeKey}
                        type="button"
                        onClick={() => setNewRoomBackdrop(themeKey)}
                        className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#C8235D] bg-[#C8235D]/[0.06] text-[#1C1917]'
                            : 'border-[#E6E0D8] bg-[#FAF8F5] text-[#57534E] hover:border-[#C7BEB2]'
                        }`}
                      >
                        <div className="h-14 relative rounded overflow-hidden border border-[#E6E0D8] mb-1.5">
                          <RoomBackdropSvg theme={themeKey} />
                        </div>
                        <p className="text-xs font-semibold text-[#1C1917] leading-tight">
                          {meta.label}
                        </p>
                        <p className="text-[10px] text-[#6B645D] mt-0.5 line-clamp-1">
                          {meta.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {lockedStarplazaRooms.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#57534E]">
                        Modelos Exclusivos na Starplaza ({lockedStarplazaRooms.length})
                      </span>
                      {onGoToShop && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateModal(false);
                            onGoToShop();
                          }}
                          className="text-[11px] font-semibold text-[#C8235D] hover:underline cursor-pointer"
                        >
                          Desbloquear na Starplaza
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {lockedStarplazaRooms.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#EFEAE3] opacity-85"
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-[#1C1917] truncate">
                              {r.name}
                            </p>
                            <p className="text-[10px] font-mono-num text-[#6B645D]">
                              {r.isVipOnly ? 'VIP · ' : ''}
                              {r.price} AM
                            </p>
                          </div>
                          <Lock className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-[#44403C]">
                  Papel de Parede / Plano de Fundo (Opcional)
                </span>
                <select
                  value={newRoomWallpaperId}
                  onChange={(e) => setNewRoomWallpaperId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                >
                  <option value="">Padrão original do modelo escolhido</option>
                  {ownedWallpapersList.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="block text-xs font-semibold text-[#44403C] mb-1.5">
                  Tipo de acesso
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRoomVisibility('public')}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      newRoomVisibility === 'public'
                        ? 'border-[#C8235D] bg-[#C8235D]/[0.06]'
                        : 'border-[#E6E0D8] bg-[#FAF8F5]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#1C1917] flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      Pública
                    </p>
                    <p className="text-[11px] text-[#6B645D] mt-0.5">
                      Todos os jogadores podem entrar livremente
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRoomVisibility('private')}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      newRoomVisibility === 'private'
                        ? 'border-[#C8235D] bg-[#C8235D]/[0.06]'
                        : 'border-[#E6E0D8] bg-[#FAF8F5]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#1C1917] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Privada
                    </p>
                    <p className="text-[11px] text-[#6B645D] mt-0.5">
                      Protegida por senha e código de convite
                    </p>
                  </button>
                </div>
              </div>

              {newRoomVisibility === 'private' && (
                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">
                    Senha de acesso da sala
                  </span>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={newRoomPassword}
                    onChange={(e) => setNewRoomPassword(e.target.value)}
                    placeholder="Defina uma senha para suas convidadas"
                    className="mt-1.5 w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                  />
                </label>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#57534E] hover:text-[#1C1917] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors cursor-pointer"
                >
                  Publicar Sala no Lobby
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Senha / Convite para Sala Privada */}
      {pendingPrivateRoom && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Entrar em sala privada"
        >
          <div className="bg-white border border-[#E6E0D8] rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE3]">
              <h3 className="font-display text-xl font-bold text-[#1C1917] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#C8235D]" />
                {pendingPrivateRoom.name}
              </h3>
              <button
                type="button"
                onClick={() => setPendingPrivateRoom(null)}
                className="p-1 text-[#6B645D] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPrivateRoom} className="mt-4 space-y-3">
              <p className="text-xs text-[#57534E]">
                Esta sala privada pertence a{' '}
                <strong>{pendingPrivateRoom.creatorUsername}</strong>. Informe a senha
                ou o código de convite para entrar.
              </p>

              {passwordError && (
                <p className="text-xs text-[#B91C1C] font-medium">{passwordError}</p>
              )}

              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  placeholder="Senha ou código STAR-XXXX"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingPrivateRoom(null)}
                  className="px-4 py-2 text-xs font-medium text-[#57534E] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors cursor-pointer"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Palco 2D da Sala Multiplayer + 3. Chat Lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Palco da Sala (8 colunas) */}
        <section className="lg:col-span-8 bg-white border border-[#E6E0D8] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-4 h-4 text-[#C8235D] shrink-0" />
              <h3 className="text-base font-bold text-[#1C1917] truncate">
                {activeRoom.name}
              </h3>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1C1917] bg-[#FAF8F5] border border-[#E6E0D8] px-2.5 py-0.5 rounded-lg shadow-2xs"
                title={`Servidor ${SERVER_REGION_META[activeRoomServer].label} (${SERVER_REGION_META[activeRoomServer].countryName})`}
              >
                <span className="text-sm leading-none">
                  {SERVER_REGION_META[activeRoomServer].flagEmoji}
                </span>
                <span>Servidor {activeRoomServer}</span>
              </span>
              {activeRoom.backdropTheme === 'estudio_3d_designer' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] bg-[#F5F3FF] border border-[#DDD6FE] px-2 py-0.5 rounded-lg shadow-2xs">
                  <Sparkles className="w-3 h-3 text-[#8B5CF6]" />
                  3D Runway
                </span>
              )}
              {activeRoom.creatorUsername && (
                <span className="text-[11px] text-[#6B645D] truncate">
                  · Dono:{' '}
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPublicProfile(activeRoom.creatorUsername ?? '')
                    }
                    className="font-bold text-[#1C1917] hover:text-[#C8235D] hover:underline cursor-pointer"
                  >
                    {activeRoom.creatorUsername}
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDjModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#92400E] bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#F59E0B]/50 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Abrir Cabine de DJ da sala"
              >
                <Disc3 className={`w-3.5 h-3.5 text-[#B45309] ${currentRoomDjTrack?.isPlaying ? 'animate-spin' : ''}`} />
                <span>Cabine de DJ</span>
                {currentRoomDjTrack?.isPlaying && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                )}
              </button>
              <p className="text-xs text-[#6B645D] hidden sm:block">
                Clique no chão para caminhar ou no avatar para ver perfil
              </p>
            </div>
          </div>

          {/* Aviso de Eventos do Servidor Regional (Admin) */}
          {serverNotices?.[activeRoomServer] && (
            <div className="mt-3 px-3.5 py-2 rounded-lg bg-[#FFFBEB] border border-[#FCD34D] flex items-center gap-2 text-xs text-[#78350F]">
              <Megaphone className="w-3.5 h-3.5 shrink-0 text-[#D97706]" />
              <span className="truncate">
                <strong className="font-semibold">Servidor {activeRoomServer}:</strong>{' '}
                {serverNotices[activeRoomServer]}
              </span>
            </div>
          )}

          {/* Aviso local definido pelo Dono da Sala */}
          {activeRoom.roomNotice && (
            <div className="mt-2 px-3.5 py-2 rounded-lg bg-[#FDF2F5] border border-[#F3D0DC] flex items-center gap-2 text-xs text-[#9E1646]">
              <Megaphone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                <strong className="font-semibold">Aviso da Sala:</strong>{' '}
                {activeRoom.roomNotice}
              </span>
            </div>
          )}

          <div className="mt-4 relative w-full overflow-hidden rounded-xl border border-[#DFD8CE]">
            <div
              ref={stageRef}
              onClick={handleStageClick}
              className="relative w-full aspect-[16/10] select-none cursor-pointer overflow-hidden"
            >
              <RoomBackdropSvg
                theme={activeRoom.backdropTheme}
                wallpaper={
                  activeRoom.wallpaperId
                    ? resolvedWallpaperCatalog.find(
                        (w) => w.id === activeRoom.wallpaperId,
                      )
                    : undefined
                }
              />

              {/* Camada de Atmosfera, Iluminação Ambiente e Partículas 60 FPS do StarlightEngine */}
              <canvas
                ref={starlightCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-15"
                aria-hidden="true"
              />

              {/* Mini-player flutuante da Cabine de DJ quando há música tocando */}
              {currentRoomDjTrack?.isPlaying && currentRoomDjTrack.videoId && (
                <div
                  className="absolute top-3 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1C1917]/90 backdrop-blur-md border border-[#F59E0B]/50 text-white shadow-xl pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Disc3 className="w-4 h-4 text-[#F59E0B] animate-spin shrink-0" />
                  <div className="flex flex-col max-w-[115px] sm:max-w-[165px]">
                    <span className="text-[11px] font-bold text-[#FDE68A] truncate">
                      {currentRoomDjTrack.title}
                    </span>
                    <span className="text-[9px] text-[#D6D3D1] truncate">
                      por {currentRoomDjTrack.addedBy}
                      {(currentRoomDjTrack.queue?.length ?? 0) > 0
                        ? ` · +${currentRoomDjTrack.queue?.length} na fila`
                        : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDjAudioMuted((m) => !m)}
                    className="p-1 text-[#FDE68A] hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title={isDjAudioMuted ? 'Desmutar som do DJ' : 'Mutar som do DJ'}
                  >
                    {isDjAudioMuted || djVolume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isDjAudioMuted ? 0 : djVolume}
                    onChange={(e) => {
                      const nextVol = Number(e.target.value);
                      setDjVolume(nextVol);
                      if (nextVol > 0 && isDjAudioMuted) setIsDjAudioMuted(false);
                    }}
                    title={`Volume individual: ${isDjAudioMuted ? 0 : djVolume}%`}
                    aria-label="Volume individual da sala"
                    className="w-14 sm:w-16 accent-[#F59E0B] cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDjModal(true)}
                    className="px-2 py-0.5 text-[10px] font-bold bg-[#F59E0B] hover:bg-[#D97706] text-[#1C1917] rounded-md transition-colors cursor-pointer"
                  >
                    DJ
                  </button>
                </div>
              )}

              {/* Contêiner oculto gerenciado pelo DJMediaSyncController (YouTube IFrame API) */}
              <div
                ref={djAudioHostRef}
                className="w-0 h-0 opacity-0 pointer-events-none absolute overflow-hidden"
                aria-hidden="true"
              />

              {/* Objetos Interativos 2D (Cadeiras/Sofás clicáveis para sentar + Mesas com colisão) */}
              {(activeRoom.interactiveProps ?? []).map((prop) => {
                const isSeat = prop.kind === 'chair' || prop.kind === 'sofa';
                return (
                  <button
                    key={prop.id}
                    type="button"
                    onClick={(e) => handlePropClick(prop, e)}
                    style={{
                      left: `${prop.x}%`,
                      top: `${prop.y}%`,
                      zIndex: Math.round(prop.y) - 1,
                    }}
                    title={
                      isSeat
                        ? `${prop.label} — Clique para sentar`
                        : `${prop.label} — Mesa sólida`
                    }
                    className={`absolute -translate-x-1/2 -translate-y-1/2 group select-none ${
                      isSeat ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    {prop.kind === 'sofa' && (
                      <svg viewBox="0 0 88 46" className="w-16 sm:w-20 h-9 sm:h-11 drop-shadow-md transition-transform group-hover:scale-105">
                        <ellipse cx="44" cy="41" rx="38" ry="4" fill="#000" fillOpacity="0.22" />
                        <rect x="8" y="8" width="72" height="20" rx="6" fill="#9E1646" stroke="#D4A853" strokeWidth="1.2" />
                        <rect x="12" y="20" width="64" height="14" rx="4" fill="#C8235D" stroke="#F3E6C8" strokeWidth="0.9" />
                        <rect x="5" y="14" width="9" height="22" rx="4" fill="#7D1036" />
                        <rect x="74" y="14" width="9" height="22" rx="4" fill="#7D1036" />
                      </svg>
                    )}
                    {prop.kind === 'chair' && (
                      <svg viewBox="0 0 48 48" className="w-9 sm:w-11 h-9 sm:h-11 drop-shadow-md transition-transform group-hover:scale-105">
                        <ellipse cx="24" cy="43" rx="16" ry="3.5" fill="#000" fillOpacity="0.22" />
                        <rect x="11" y="10" width="26" height="16" rx="5" fill="#1C1917" stroke="#D4A853" strokeWidth="1.2" />
                        <rect x="10" y="23" width="28" height="10" rx="4" fill="#332E2B" stroke="#E5C78E" strokeWidth="0.9" />
                        <line x1="15" y1="33" x2="14" y2="42" stroke="#D4A853" strokeWidth="2.2" />
                        <line x1="33" y1="33" x2="34" y2="42" stroke="#D4A853" strokeWidth="2.2" />
                      </svg>
                    )}
                    {prop.kind === 'table' && (
                      <svg viewBox="0 0 72 48" className="w-14 sm:w-16 h-9 sm:h-11 drop-shadow-md">
                        <ellipse cx="36" cy="43" rx="22" ry="4" fill="#000" fillOpacity="0.24" />
                        <rect x="33" y="20" width="6" height="21" rx="2" fill="#B68A3E" />
                        <ellipse cx="36" cy="18" rx="30" ry="11" fill="#FAF6F0" stroke="#D4A853" strokeWidth="1.6" />
                        <ellipse cx="36" cy="17" rx="22" ry="6.5" fill="#FFFFFF" fillOpacity="0.7" />
                      </svg>
                    )}
                  </button>
                );
              })}

              {/* Mesas de Trabalho Interativas na Central da Staff */}
              {activeRoom.id === 'central_staff' &&
                (
                  [
                    {
                      id: 'admin_desk',
                      tab: 'overview' as const,
                      requiredRole: 'admin' as const,
                      title: 'Mesa do Administrador',
                      subtitle: 'RH & Chave Mestre',
                      x: '16%',
                      y: '66%',
                      accent: '#C8235D',
                      trim: '#F59E0B',
                    },
                    {
                      id: 'cm_control_desk',
                      tab: 'cm' as const,
                      requiredRole: 'cm' as const,
                      title: 'Central Community Manager',
                      subtitle: 'Tickets & Loja Premium',
                      x: '37%',
                      y: '62%',
                      accent: '#0284C7',
                      trim: '#38BDF8',
                    },
                    {
                      id: 'moderator_desk',
                      tab: 'moderation' as const,
                      requiredRole: 'moderator' as const,
                      title: 'Mesa da Moderação',
                      subtitle: 'Suporte & Denúncias',
                      x: '58%',
                      y: '64%',
                      accent: '#059669',
                      trim: '#34D399',
                    },
                    {
                      id: 'designer_workbench',
                      tab: 'designer' as const,
                      requiredRole: 'designer' as const,
                      title: 'Bancada Designer Global',
                      subtitle: 'Camadas PNG & Cron',
                      x: '76%',
                      y: '62%',
                      accent: '#7C3AED',
                      trim: '#C084FC',
                    },
                  ] as const
                ).map((desk) => {
                  const hasAccess =
                    myStaffCoreRole === 'admin' || myStaffCoreRole === desk.requiredRole;
                  return (
                    <div
                      key={desk.id}
                      style={{ left: desk.x, top: desk.y, zIndex: 72 }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 select-none group cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        soundEngine.playEquip();
                        if (!hasAccess) {
                          onStaffNotice(
                            `Acesso restrito na ${desk.title}: apenas ${desk.requiredRole.toUpperCase()} ou Administrador (Chave Mestre) pode operar esta mesa.`,
                          );
                          return;
                        }
                        if (onOpenStaffDesk) {
                          onOpenStaffDesk(desk.tab);
                        } else {
                          onStaffNotice(`Mesa "${desk.title}" conectada.`);
                        }
                      }}
                      title={`${desk.title} (${desk.subtitle})`}
                    >
                      <div className="mb-1 flex flex-col items-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow border whitespace-nowrap transition-transform group-hover:scale-105 ${
                            hasAccess
                              ? 'bg-[#1C1917]/90 text-white border-white/30'
                              : 'bg-white/90 text-[#57534E] border-[#D6CFC7]'
                          }`}
                        >
                          {desk.title}
                        </span>
                      </div>
                      <div className="w-20 sm:w-24 h-14 drop-shadow-lg transition-transform group-hover:scale-105">
                        <svg viewBox="0 0 110 70" className="w-full h-full">
                          <ellipse cx="55" cy="64" rx="45" ry="5" fill="#000" fillOpacity="0.32" />
                          <path
                            d="M12 24 L98 24 L104 58 L6 58 Z"
                            fill="#231F20"
                            stroke={desk.trim}
                            strokeWidth="1.8"
                          />
                          <polygon
                            points="12,24 98,24 90,12 20,12"
                            fill="#332E2B"
                            stroke={desk.accent}
                            strokeWidth="1.2"
                          />
                          {/* Monitor da Estação */}
                          <rect x="38" y="4" width="34" height="16" rx="2" fill="#0F172A" stroke={desk.trim} strokeWidth="1.3" />
                          <rect x="41" y="7" width="28" height="10" rx="1" fill={desk.accent} fillOpacity="0.85" />
                          <rect x="52" y="20" width="6" height="4" fill="#525252" />
                          {/* Placa frontal */}
                          <rect x="28" y="34" width="54" height="14" rx="2" fill="#171516" stroke={desk.accent} strokeWidth="1" />
                          <circle cx="36" cy="41" r="2.5" fill={hasAccess ? '#10B981' : '#EF4444'} />
                        </svg>
                      </div>
                    </div>
                  );
                })}

              {/* Cabine de DJ Interativa no Palco */}
              <div
                style={{
                  left: '84%',
                  top: '64%',
                  zIndex: 75,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 select-none group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playEquip();
                  setShowDjModal(true);
                }}
                title="Cabine de DJ da Sala · Clique para adicionar música do YouTube"
              >
                {/* Floating DJ Status Badge */}
                <div className="mb-1 flex flex-col items-center">
                  {currentRoomDjTrack?.isPlaying ? (
                    <div className="px-2.5 py-0.5 rounded-full bg-[#1C1917]/90 backdrop-blur-xs border border-[#F59E0B] shadow-lg flex items-center gap-1.5 animate-pulse">
                      <Disc3 className="w-3 h-3 text-[#F59E0B] animate-spin" />
                      <span className="text-[10px] font-bold text-[#FDE68A] max-w-[100px] truncate">
                        DJ Ao Vivo
                      </span>
                    </div>
                  ) : (
                    <div className="px-2 py-0.5 rounded-full bg-[#1C1917]/80 backdrop-blur-xs border border-[#D4AF37]/50 shadow text-[10px] font-bold text-[#FDF8E2] group-hover:bg-[#C8235D] group-hover:text-white transition-colors flex items-center gap-1">
                      <Music className="w-3 h-3 text-[#D4AF37] group-hover:text-white" />
                      Cabine de DJ
                    </div>
                  )}
                </div>

                {/* 3D Gold DJ Console Turntable SVG graphic */}
                <div className="w-24 sm:w-28 h-16 sm:h-20 drop-shadow-xl transition-transform group-hover:scale-105">
                  <svg viewBox="0 0 120 80" className="w-full h-full">
                    <defs>
                      <linearGradient id="djBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#292524" />
                        <stop offset="50%" stopColor="#1C1917" />
                        <stop offset="100%" stopColor="#0C0A09" />
                      </linearGradient>
                      <linearGradient id="djGoldTrim" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#F59E0B" />
                        <stop offset="50%" stopColor="#FDE68A" />
                        <stop offset="100%" stopColor="#D97706" />
                      </linearGradient>
                    </defs>
                    {/* Shadow / Base */}
                    <ellipse cx="60" cy="74" rx="52" ry="6" fill="#000000" fillOpacity="0.45" />
                    {/* Main DJ Desk */}
                    <path
                      d="M12 28 L108 28 L114 68 L6 68 Z"
                      fill="url(#djBodyGrad)"
                      stroke="url(#djGoldTrim)"
                      strokeWidth="2"
                    />
                    {/* Top Desk Surface */}
                    <polygon
                      points="12,28 108,28 100,16 20,16"
                      fill="#262626"
                      stroke="#404040"
                      strokeWidth="1"
                    />
                    {/* Left Turntable Vinyl */}
                    <ellipse cx="38" cy="22" rx="14" ry="5.5" fill="#111" stroke="#333" strokeWidth="1" />
                    <ellipse cx="38" cy="22" rx="5" ry="2" fill="#D4AF37" />
                    {/* Right Turntable Vinyl */}
                    <ellipse cx="82" cy="22" rx="14" ry="5.5" fill="#111" stroke="#333" strokeWidth="1" />
                    <ellipse cx="82" cy="22" rx="5" ry="2" fill="#D4AF37" />
                    {/* Mixer Center Channel */}
                    <rect x="56" y="17" width="8" height="10" rx="1" fill="#1C1917" stroke="#525252" strokeWidth="0.5" />
                    {/* Neon / Equalizer LED bars on front panel */}
                    <g opacity="0.9">
                      <rect x="22" y="38" width="6" height={currentRoomDjTrack?.isPlaying ? '18' : '10'} rx="1" fill="#10B981" />
                      <rect x="32" y="34" width="6" height={currentRoomDjTrack?.isPlaying ? '22' : '12'} rx="1" fill="#3B82F6" />
                      <rect x="42" y="32" width="6" height={currentRoomDjTrack?.isPlaying ? '24' : '14'} rx="1" fill="#EC4899" />
                      <rect x="72" y="32" width="6" height={currentRoomDjTrack?.isPlaying ? '24' : '14'} rx="1" fill="#EC4899" />
                      <rect x="82" y="34" width="6" height={currentRoomDjTrack?.isPlaying ? '22' : '12'} rx="1" fill="#3B82F6" />
                      <rect x="92" y="38" width="6" height={currentRoomDjTrack?.isPlaying ? '18' : '10'} rx="1" fill="#10B981" />
                    </g>
                    {/* Golden Atelier Logo Plate in center */}
                    <rect x="52" y="38" width="16" height="16" rx="2" fill="#1C1917" stroke="#D4AF37" strokeWidth="1" />
                    <polygon points="60,42 63,48 57,48" fill="#F59E0B" />
                    <polygon points="60,50 63,44 57,44" fill="#FDE68A" />
                  </svg>
                </div>
              </div>

              {clickMarker && (
                <div
                  style={{
                    left: `${clickMarker.x}%`,
                    top: `${clickMarker.y}%`,
                  }}
                  className="target-ring-pulse absolute -translate-x-1/2 -translate-y-1/2 w-10 h-4 rounded-full border-2 border-[#C8235D]/80 pointer-events-none z-10"
                  aria-hidden="true"
                />
              )}

              {avatarsInRoom.map((avatar) => {
                const isSelf = avatar.clientId === clientId;
                const displayX = isSelf ? myPos.x : avatar.x;
                const displayY = isSelf ? myPos.y : avatar.y;
                const displayFacing = isSelf ? myPos.facing : avatar.facing;
                const walkingThisAvatar = isSelf && isMyWalking;
                const showBubble =
                  Boolean(avatar.lastMessage) &&
                  Boolean(avatar.lastMessageAt) &&
                  nowTs - (avatar.lastMessageAt ?? 0) < 6000;

                // 3D Depth Scaling: escala suave de 82% a 108% baseada na profundidade Y
                const minY = activeRoom.walkMinY;
                const maxY = activeRoom.walkMaxY;
                const yProgress = Math.max(0, Math.min(1, (displayY - minY) / Math.max(1, maxY - minY)));
                const depthScale = Number((0.82 + yProgress * 0.26).toFixed(3));

                const openAvatarProfile = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onOpenPublicProfile(avatar.username, {
                    equipped: avatar.equipped,
                    skinTone: avatar.skinTone,
                    avatarGender: avatar.avatarGender,
                    customAvatarUrl: avatar.customAvatarUrl,
                    avatarDisplayMode: avatar.avatarDisplayMode,
                    role: avatar.role,
                  });
                };

                return (
                  <div
                    key={avatar.clientId}
                    style={{
                      left: `${displayX}%`,
                      top: `${displayY}%`,
                      zIndex: Math.round(displayY) + (isSelf ? 1 : 0),
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-[88%] pointer-events-none flex flex-col items-center ${
                      walkingThisAvatar
                        ? 'transition-none'
                        : 'transition-[left,top] duration-500 ease-out'
                    }`}
                  >
                    {showBubble && (
                      <div className="mb-1 max-w-[170px] px-2.5 py-1.5 rounded-lg bg-white border border-[#D6CFC7] shadow-sm text-[11px] text-[#1C1917] text-center leading-snug break-words">
                        {avatar.lastMessage}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={openAvatarProfile}
                      title={`Ver perfil de ${avatar.username}`}
                      className={`pointer-events-auto cursor-pointer mb-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap border shadow-2xs inline-flex items-center gap-1 transition-colors ${
                        isSelf
                          ? 'bg-[#1C1917] text-white border-[#1C1917] hover:bg-[#332E2B]'
                          : 'bg-white/95 text-[#1C1917] border-[#E6E0D8] hover:border-[#C8235D] hover:text-[#C8235D]'
                      }`}
                    >
                      {avatar.role === 'admin' && (
                        <ShieldCheck
                          className={`w-3 h-3 ${isSelf ? 'text-[#F59EB8]' : 'text-[#C8235D]'}`}
                        />
                      )}
                      <span>{avatar.username}</span>
                    </button>

                    <button
                      type="button"
                      onClick={openAvatarProfile}
                      title={`Abrir perfil de ${avatar.username}`}
                      aria-label={`Abrir perfil de ${avatar.username}`}
                      className="pointer-events-auto cursor-pointer w-20 sm:w-24 h-36 sm:h-44 hover:drop-shadow-md transition-transform"
                      style={{
                        transform: `${displayFacing === 'left' ? 'scaleX(-1)' : ''} scale(${depthScale})${
                          (isSelf ? isMySeated : avatar.isSeated)
                            ? ' translateY(6px) scaleY(0.94)'
                            : ''
                        }`,
                        transformOrigin: 'bottom center',
                      }}
                    >
                      <MeDollSvg
                        equipped={avatar.equipped}
                        skinTone={avatar.skinTone}
                        avatarGender={avatar.avatarGender}
                        deletedItemIds={deletedItemIds}
                        isWalking={walkingThisAvatar}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lista clicável de jogadores presentes na sala */}
          <div className="mt-3.5 pt-3 border-t border-[#EFEAE3] flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-[#57534E] mr-1">
              Presentes na sala ({avatarsInRoom.length}):
            </span>
            {avatarsInRoom.map((avatar) => (
              <button
                key={`list-${avatar.clientId}`}
                type="button"
                onClick={() =>
                  onOpenPublicProfile(avatar.username, {
                    equipped: avatar.equipped,
                    skinTone: avatar.skinTone,
                    avatarGender: avatar.avatarGender,
                    customAvatarUrl: avatar.customAvatarUrl,
                    avatarDisplayMode: avatar.avatarDisplayMode,
                    role: avatar.role,
                  })
                }
                title={`Abrir perfil completo de ${avatar.username}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-white border border-[#E6E0D8] hover:border-[#C8235D] text-xs font-medium text-[#1C1917] transition-colors cursor-pointer"
              >
                <ProfileAvatar
                  username={avatar.username}
                  equipped={avatar.equipped}
                  skinTone={avatar.skinTone}
                  avatarGender={avatar.avatarGender}
                  customAvatarUrl={avatar.customAvatarUrl}
                  avatarDisplayMode={avatar.avatarDisplayMode}
                  deletedItemIds={deletedItemIds}
                  sizeClass="w-5 h-5"
                  roundedClass="rounded"
                />
                <span>{avatar.username}</span>
                {avatar.staffRoleTier ? (
                  <StaffRoleBadge tier={avatar.staffRoleTier} compact />
                ) : avatar.role === 'admin' ? (
                  <ShieldCheck className="w-3 h-3 text-[#C8235D]" />
                ) : null}
                {avatar.isVip && <VipBadge compact />}
              </button>
            ))}
          </div>

          {/* Ação rápida de Banimento para Staff autorizada neste servidor */}
          {hasRoomModJurisdiction && (
            <div className="mt-3 p-3.5 rounded-xl bg-[#FDF2F5]/60 border border-[#F3D0DC] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-[#9E1646] inline-flex items-center gap-1">
                  <Ban className="w-3.5 h-3.5" />
                  Banimento rápido · Servidor {activeRoomServer}:
                </span>
                {avatarsInRoom.filter(
                  (a) =>
                    normalizeUsername(a.username) !==
                      normalizeUsername(currentUser.username) &&
                    a.role !== 'admin',
                ).length === 0 ? (
                  <span className="text-[11px] text-[#6B645D]">
                    Nenhum jogador comum presente nesta sala agora.
                  </span>
                ) : (
                  avatarsInRoom
                    .filter(
                      (a) =>
                        normalizeUsername(a.username) !==
                          normalizeUsername(currentUser.username) &&
                        a.role !== 'admin',
                    )
                    .map((guest) => (
                      <button
                        key={`ban-${guest.clientId}`}
                        type="button"
                        onClick={() => {
                          const res = applyRoomBanToTarget(
                            guest.username,
                            `Conduta inadequada na sala (${activeRoomServer})`,
                          );
                          setBanFeedback(
                            res.ok
                              ? `${guest.username} foi banida no Servidor ${activeRoomServer}.`
                              : res.error,
                          );
                          window.setTimeout(() => setBanFeedback(null), 2800);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#B91C1C] bg-white hover:bg-[#FEE2E2] border border-[#FECACA] rounded-lg transition-colors cursor-pointer"
                      >
                        <Ban className="w-3 h-3" />
                        Banir {guest.username}
                      </button>
                    ))
                )}
              </div>

              {banFeedback && (
                <span className="text-[11px] font-semibold text-[#9E1646]">
                  {banFeedback}
                </span>
              )}
            </div>
          )}

          {/* Painel completo do Dono da Sala: aviso local, expulsão de convidados e fechar ambiente */}
          {canModerateRoomLocally && (
            <div className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[#C8235D]" />
                  <h4 className="text-xs font-bold text-[#1C1917]">
                    Painel de Dono da Sala
                  </h4>
                  {activeRoom.visibility === 'private' && activeRoom.inviteCode && (
                    <span className="text-[11px] font-mono-num text-[#57534E] bg-white border border-[#E6E0D8] px-2 py-0.5 rounded">
                      Senha: <strong>{activeRoom.password}</strong> · Convite:{' '}
                      <strong>{activeRoom.inviteCode}</strong>
                    </span>
                  )}
                </div>

                {activeRoom.isCustom && (
                  <div className="flex items-center gap-2">
                    {confirmCloseRoom ? (
                      <>
                        <button
                          type="button"
                          onClick={handleDeleteMyRoom}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Confirmar Fechamento
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmCloseRoom(false)}
                          className="px-2.5 py-1.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmCloseRoom(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#B91C1C] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Fechar Ambiente
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Alterar aviso da sala */}
              {activeRoom.isCustom && (
                <form
                  onSubmit={handleSaveRoomNotice}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                >
                  <input
                    type="text"
                    maxLength={100}
                    value={roomNoticeDraft}
                    onChange={(e) => setRoomNoticeDraft(e.target.value)}
                    placeholder="Alterar aviso fixo desta sala para visitantes..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Salvar Aviso da Sala
                  </button>
                </form>
              )}

              {/* Expulsar jogadores indesejados presentes na sala */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-[#57534E]">
                  Moderação de visitantes:
                </span>
                {avatarsInRoom.filter((a) => a.clientId !== clientId && !a.isBot).length === 0 ? (
                  <span className="text-[11px] text-[#78716C]">
                    Nenhum outro jogador na sala no momento.
                  </span>
                ) : (
                  avatarsInRoom
                    .filter((a) => a.clientId !== clientId && !a.isBot)
                    .map((guest) => (
                      <button
                        key={guest.clientId}
                        type="button"
                        onClick={() => handleKickFromMyRoom(guest)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#B91C1C] bg-white hover:bg-[#FEF2F2] border border-[#FECACA] rounded-lg transition-colors cursor-pointer"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Expulsar {guest.username}
                      </button>
                    ))
                )}
              </div>
            </div>
          )}
        </section>

        {/* Chat Lateral (4 colunas) */}
        <div className="lg:col-span-4">
          <ChatBox
            roomName={activeRoom.name}
            messages={roomMessages}
            presencesInRoom={avatarsInRoom}
            currentUsername={currentUser.username}
            modCapability={chatModCapability}
            modLabel={chatModLabel}
            sentinelLabel={
              activeSentinelBot
                ? `Moderação (${activeRoomServer}): ${activeSentinelBot.displayName}`
                : undefined
            }
            mutedUntil={myMutedUntil}
            onSendMessage={handleSendChatMessage}
            onStaffCommand={handleStaffCommand}
            onSelectProfile={(username, fallback) =>
              onOpenPublicProfile(username, fallback)
            }
          />
        </div>
      </div>

      {/* Modal Interativo da Cabine de DJ (YouTube, Fila Sincronizada e Volume Individual) */}
      {showDjModal && (
        <DjBoothModal
          roomId={activeRoomId}
          roomName={activeRoom.name}
          currentTrack={currentRoomDjTrack}
          currentUser={currentUser.username}
          isHostOrStaff={canModerateRoomLocally || hasRoomModJurisdiction}
          volume={djVolume}
          isMuted={isDjAudioMuted}
          onChangeVolume={(vol) => {
            setDjVolume(vol);
            if (vol > 0 && isDjAudioMuted) setIsDjAudioMuted(false);
          }}
          onToggleMute={() => setIsDjAudioMuted((m) => !m)}
          onClose={() => setShowDjModal(false)}
          onSetTrack={handlePlayDjTrack}
          onAddToQueue={handleAddToDjQueue}
          onRemoveFromQueue={handleRemoveFromDjQueue}
          onPlayNextFromQueue={handlePlayNextFromDjQueue}
          onClearTrack={handleStopDjTrack}
        />
      )}
    </div>
  );
};
