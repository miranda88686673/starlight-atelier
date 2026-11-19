import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Crown,
  DoorOpen,
  Globe,
  Home,
  Lock,
  MessageCircle,
  Network,
  Send,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  PrivateMessage,
  PublicProfileSummary,
  RoomId,
  ServerRegion,
  UserAccount,
} from '../types/game';
import {
  cleanCharacterName,
  getLevelProgressMetrics,
  MAX_ACCOUNT_LEVEL,
} from '../utils/levelSystem';
import {
  createRealtimeChannel,
  readRoomsSnapshot,
  ROOMS_STORAGE_KEY,
  SharedRoomsSnapshot,
} from '../utils/realtime';
import { subscribeRemoteSync } from '../core/state/socketBridge';
import {
  DMS_KEY,
  getCountryMeta,
  getFullClothingCatalog,
  getFullWallpaperCatalog,
  loadPrivateMessagesBetween,
  normalizeUsername,
  sendPrivateMessage,
  SERVER_REGION_META,
} from '../utils/storage';
import { CountryFlag } from './CountryFlag';
import { ProfileAnimatedBanner } from './ProfileAnimatedBanner';
import { PRESENCE_META } from './ProfileAccountView';
import { ProfileAvatar } from './ProfileAvatar';
import { StaffRoleBadge, VipBadge } from './StaffDirectory';
import { Avatar3DViewport } from './three/Avatar3DViewport';
import { ThreeRoomThumbnail } from './three/ThreeItemThumbnail';

interface VisitorProfileModalProps {
  profile: PublicProfileSummary;
  currentUser: UserAccount;
  deletedItemIds: string[];
  isFriend: boolean;
  onToggleFriend: (username: string) => void;
  onVisitSuite: (profile: PublicProfileSummary) => void;
  onGoToRoom?: (roomId: RoomId) => void;
  onClose: () => void;
}

function getPeriodLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Manhã';
  if (hour >= 12 && hour < 18) return 'Tarde';
  if (hour >= 18 && hour < 24) return 'Noite';
  return 'Madrugada';
}

/**
 * Modal de Perfil Público Visitante de qualquer jogador ou Staff:
 * - Banner animado acima e por trás da foto/nome/informações da conta.
 * - Bandeira real do país posicionada diretamente ao lado do nome de usuário.
 * - Nível e data de criação visíveis com clareza; e-mail e saldo AM nunca exibidos.
 */
export const VisitorProfileModal: React.FC<VisitorProfileModalProps> = ({
  profile,
  currentUser,
  deletedItemIds,
  isFriend,
  onToggleFriend,
  onVisitSuite,
  onGoToRoom,
  onClose,
}) => {
  const isSelf =
    normalizeUsername(currentUser.username) === normalizeUsername(profile.username);
  const canViewTechnicalIp = isSelf || currentUser.role === 'admin';

  const [now, setNow] = useState<Date>(() => new Date());
  const [modalTab, setModalTab] = useState<'perfil' | 'salas'>('perfil');
  const [dmOpen, setDmOpen] = useState(false);
  const [dmDraft, setDmDraft] = useState('');
  const [messages, setMessages] = useState<PrivateMessage[]>(() =>
    loadPrivateMessagesBetween(currentUser.username, profile.username),
  );
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [roomsSnapshot, setRoomsSnapshot] = useState<SharedRoomsSnapshot>(() =>
    readRoomsSnapshot(),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setMessages(loadPrivateMessagesBetween(currentUser.username, profile.username));

    const onStorage = (e: StorageEvent) => {
      if (e.key === DMS_KEY) {
        setMessages(loadPrivateMessagesBetween(currentUser.username, profile.username));
      }
    };
    window.addEventListener('storage', onStorage);

    const unsubRemote = subscribeRemoteSync({
      onPatch: (patch) => {
        if (patch.dms) {
          setMessages(loadPrivateMessagesBetween(currentUser.username, profile.username));
        }
      },
    });

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('starlight_atelier_realtime_v1');
      channel.onmessage = (event) => {
        if (event.data?.type === 'dm:sync') {
          setMessages(loadPrivateMessagesBetween(currentUser.username, profile.username));
        }
      };
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      unsubRemote();
      channel?.close();
    };
  }, [currentUser.username, profile.username]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    setModalTab('perfil');
    setRoomsSnapshot(readRoomsSnapshot());

    const handleRoomsStorage = (e: StorageEvent) => {
      if (!e.key || e.key === ROOMS_STORAGE_KEY) {
        setRoomsSnapshot(readRoomsSnapshot());
      }
    };
    window.addEventListener('storage', handleRoomsStorage);

    const roomsChannel = createRealtimeChannel();
    if (roomsChannel) {
      roomsChannel.onmessage = (event) => {
        if (event.data?.type === 'rooms:sync' && event.data.snapshot) {
          setRoomsSnapshot(event.data.snapshot as SharedRoomsSnapshot);
        }
      };
    }

    const unsubscribeSocket = subscribeRemoteSync({
      onInit: () => setRoomsSnapshot(readRoomsSnapshot()),
      onPatch: (patch) => {
        if (patch.roomsSnapshot) {
          setRoomsSnapshot(readRoomsSnapshot());
        }
      },
    });

    return () => {
      window.removeEventListener('storage', handleRoomsStorage);
      roomsChannel?.close();
      unsubscribeSocket();
    };
  }, [profile.username]);

  const wallpapersById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getFullWallpaperCatalog>[number]>();
    for (const wp of getFullWallpaperCatalog()) {
      map.set(wp.id, wp);
    }
    return map;
  }, []);

  const creatorActiveRooms = useMemo(() => {
    const targetNorm = normalizeUsername(profile.username);
    const displayNorm = normalizeUsername(profile.displayName || profile.username);
    return (roomsSnapshot.customRooms ?? []).filter((room) => {
      const creatorNorm = normalizeUsername(room.creatorUsername ?? '');
      if (!creatorNorm) return false;
      return creatorNorm === targetNorm || creatorNorm === displayNorm;
    });
  }, [roomsSnapshot.customRooms, profile.username, profile.displayName]);

  const roomAvatarCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(roomsSnapshot.presences ?? {}).forEach((p) => {
      if (p?.roomId) {
        counts[p.roomId] = (counts[p.roomId] ?? 0) + 1;
      }
    });
    return counts;
  }, [roomsSnapshot.presences]);

  const countryMeta = getCountryMeta(profile.countryCode);
  const presenceMeta = PRESENCE_META[profile.presenceStatus];
  const unifiedVisitorName =
    cleanCharacterName(profile.displayName || profile.username) || profile.username;
  const visitorMetrics = getLevelProgressMetrics(
    profile.level,
    profile.xp ?? 0,
    profile.accountId === 'acc_admin_owner',
  );

  const clockInfo = useMemo(() => {
    try {
      const timeStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: profile.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);

      const hourNum = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: profile.timezone,
          hour: 'numeric',
          hour12: false,
        }).format(now),
      );

      return {
        timeStr,
        period: getPeriodLabel(Number.isNaN(hourNum) ? now.getHours() : hourNum),
      };
    } catch {
      return {
        timeStr: now.toLocaleTimeString('pt-BR'),
        period: getPeriodLabel(now.getHours()),
      };
    }
  }, [now, profile.timezone]);

  const handleToggleFriendClick = () => {
    onToggleFriend(profile.username);
    setActionFeedback(
      isFriend
        ? `${profile.username} removida da lista de amigos.`
        : `${profile.username} adicionada como amiga!`,
    );
    window.setTimeout(() => setActionFeedback(null), 2400);
  };

  const handleSendDm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmDraft.trim()) return;
    const updated = sendPrivateMessage(currentUser.username, profile.username, dmDraft);
    setMessages(updated);
    setDmDraft('');
    setActionFeedback(`Mensagem privada enviada para ${profile.username}.`);
    window.setTimeout(() => setActionFeedback(null), 2400);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil público de ${profile.username}`}
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#E6E0D8] rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Hero com Banner Animado acima e por trás */}
        <div className="relative px-6 pt-5 pb-6 overflow-hidden">
          <ProfileAnimatedBanner banner={profile.profileBanner} />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/85">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <span className={`w-2 h-2 rounded-full ${presenceMeta.dotClass}`} />
                {presenceMeta.label}
              </span>
              <span aria-hidden="true" className="text-white/40">·</span>
              <span>{countryMeta.name}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar perfil"
              className="p-1.5 text-white/85 hover:text-white rounded-lg bg-black/35 hover:bg-black/55 backdrop-blur-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative z-10 mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4 min-w-0">
              <ProfileAvatar
                username={profile.username}
                equipped={profile.equipped}
                skinTone={profile.skinTone}
                avatarGender={profile.avatarGender}
                faceCustomization={profile.faceCustomization}
                customAvatarUrl={profile.customAvatarUrl}
                avatarDisplayMode={profile.avatarDisplayMode}
                deletedItemIds={deletedItemIds}
                sizeClass="w-20 h-20 ring-2 ring-white/90 shadow-lg shrink-0"
                roundedClass="rounded-2xl"
              />

              <div className="min-w-0 text-white space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-white truncate">
                    {unifiedVisitorName}
                  </h2>
                  <CountryFlag
                    countryCode={countryMeta.code}
                    countryName={countryMeta.name}
                    size="md"
                  />
                  {profile.isVip && <VipBadge />}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-white/85">
                  {profile.staffRoleTier ? (
                    <StaffRoleBadge tier={profile.staffRoleTier} />
                  ) : profile.role === 'admin' ? (
                    <StaffRoleBadge tier="admin" />
                  ) : (
                    <span>Estilista da Comunidade</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-5 shrink-0 text-white border-t border-white/15 pt-3 sm:border-t-0 sm:pt-0">
              <div className="min-w-[140px]">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/65 font-semibold">
                    Nível
                  </p>
                  <span className="font-mono-num text-[10px] text-white/70">
                    / {MAX_ACCOUNT_LEVEL}
                  </span>
                </div>
                <p className="font-mono-num text-xl font-bold">
                  Nível {visitorMetrics.level}
                </p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F43F5E] to-[#FBBF24]"
                    style={{ width: `${visitorMetrics.percent}%` }}
                  />
                </div>
                <p className="font-mono-num text-[10px] text-white/75 mt-1">
                  {visitorMetrics.isMaxLevel
                    ? 'Nível Máximo'
                    : `${visitorMetrics.xp} / ${visitorMetrics.xpRequired} XP`}
                </p>
              </div>
              {profile.createdAt && (
                <>
                  <div className="hidden sm:block h-10 w-px bg-white/20" aria-hidden="true" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/65 font-semibold">
                      Criada em
                    </p>
                    <p className="font-mono-num text-sm font-bold text-amber-200 mt-0.5">
                      {profile.createdAt}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Corpo do Modal: Avatar 3D Completo + Dados Organizados */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          <div className="md:col-span-5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3] p-4 flex flex-col items-center justify-between relative overflow-hidden min-h-[320px]">
            <div
              className="absolute top-5 w-48 h-72 rounded-t-full bg-[#F2ECE3]/90 border border-[#E6DDD0]"
              aria-hidden="true"
            />

            <div className="relative z-10 w-full my-auto">
              <Avatar3DViewport
                equipped={profile.equipped}
                skinTone={profile.skinTone}
                avatarGender={profile.avatarGender}
                faceCustomization={profile.faceCustomization}
                catalog={getFullClothingCatalog().filter((i) => !deletedItemIds.includes(i.id))}
                showControls={false}
                heightClassName="h-[270px]"
                backgroundHex="#F2ECE3"
              />
            </div>

            <div className="relative z-10 w-full pt-3 border-t border-[#E6DDD0] space-y-1.5 text-xs text-[#57534E] font-mono-num">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 font-bold text-[#1C1917]">
                  <Crown className="w-3.5 h-3.5 text-[#C8235D]" />
                  Nível {visitorMetrics.level} / {MAX_ACCOUNT_LEVEL}
                </span>
                <span>
                  {profile.avatarGender === 'masculino'
                    ? 'Corpo Masculino'
                    : profile.avatarGender === 'neutro'
                      ? 'Corpo Neutro'
                      : 'Corpo Feminino'}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#E6DDD0] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#C8235D]"
                  style={{ width: `${visitorMetrics.percent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-1.5 border-b border-[#EFEAE3] pb-2.5">
              <button
                type="button"
                onClick={() => setModalTab('perfil')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  modalTab === 'perfil'
                    ? 'bg-[#1C1917] text-white'
                    : 'bg-[#FAF8F5] text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                Perfil
              </button>
              <button
                type="button"
                onClick={() => setModalTab('salas')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  modalTab === 'salas'
                    ? 'bg-[#1C1917] text-white'
                    : 'bg-[#FAF8F5] text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5" />
                Salas
                <span className="font-mono-num opacity-80">
                  ({creatorActiveRooms.length})
                </span>
              </button>
            </div>

            {modalTab === 'perfil' ? (
              <div className="space-y-4">
                {profile.staffRoleTitle && (
                  <p className="text-xs font-semibold text-[#C8235D]">
                    Cargo Oficial: {profile.staffRoleTitle}
                  </p>
                )}

                <div>
                  <h3 className="text-xs font-semibold text-[#78716C]">
                    Biografia / Recado
                  </h3>
                  <p className="mt-1.5 text-sm text-[#1C1917] bg-[#FAF8F5] border border-[#EFEAE3] rounded-xl px-4 py-3 leading-relaxed">
                    “{profile.bio || 'Explorando estilos no Nocturne Vale Club.'}”
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3]">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B645D]">
                      <CountryFlag
                        countryCode={countryMeta.code}
                        countryName={countryMeta.name}
                        size="sm"
                      />
                      <span>Origem da Conta</span>
                    </div>
                    <p className="text-xs font-bold text-[#1C1917] mt-1.5">
                      {countryMeta.name}
                    </p>
                    <p className="text-[11px] text-[#6B645D] mt-0.5">
                      {countryMeta.cityLabel}
                      {profile.serverRegion ? ` · Servidor ${profile.serverRegion}` : ''}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3]">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B645D]">
                      <Clock className="w-3.5 h-3.5 text-[#C8235D]" />
                      <span>Horário Local · {clockInfo.period}</span>
                    </div>
                    <p className="font-mono-num text-sm font-bold text-[#1C1917] mt-1.5">
                      {clockInfo.timeStr}
                    </p>
                    {profile.createdAt && (
                      <p className="inline-flex items-center gap-1 text-[11px] font-mono-num text-[#6B645D] mt-0.5">
                        <Calendar className="w-3 h-3" />
                        Desde {profile.createdAt}
                      </p>
                    )}
                  </div>
                </div>

                {canViewTechnicalIp ? (
                  <div className="p-3.5 rounded-xl bg-[#FDF2F5]/60 border border-[#F3D0DC] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Network className="w-4 h-4 text-[#C8235D] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#9E1646]">
                          IP Simulado (Moderação / Dono)
                        </p>
                        <p className="font-mono-num text-xs font-bold text-[#1C1917] truncate">
                          {profile.simulatedIp} - {countryMeta.cityLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3] flex items-center gap-2 text-[11px] text-[#78716C]">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Dados sensíveis da conta (e-mail, saldo e IP) ocultos por privacidade.
                    </span>
                  </div>
                )}

                {actionFeedback && (
                  <p
                    role="status"
                    className="text-xs font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-2 rounded-lg"
                  >
                    {actionFeedback}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {creatorActiveRooms.length === 0 ? (
                  <div className="py-8 px-4 text-center rounded-xl bg-[#FAF8F5] border border-dashed border-[#E6E0D8] text-xs text-[#6B645D]">
                    {unifiedVisitorName} não possui salas ativas na aba Salas no momento.
                  </div>
                ) : (
                  creatorActiveRooms.map((room) => {
                    const srv: ServerRegion = room.serverRegion ?? 'BR';
                    const srvMeta = SERVER_REGION_META[srv];
                    const count = roomAvatarCounts[room.id] ?? 0;
                    const wp = room.wallpaperId
                      ? wallpapersById.get(room.wallpaperId)
                      : undefined;
                    return (
                      <div
                        key={room.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8]"
                      >
                        <div className="w-20 h-14 rounded-lg overflow-hidden bg-[#1C1917] border border-[#E6E0D8] shrink-0">
                          {room.customBackgroundImageUrl ? (
                            <img
                              src={room.customBackgroundImageUrl}
                              alt={room.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ThreeRoomThumbnail
                              theme={room.backdropTheme}
                              wallpaper={wp}
                              alt={room.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs leading-none">{srvMeta.flagEmoji}</span>
                            {room.visibility === 'private' ? (
                              <Lock className="w-3 h-3 text-[#C8235D] shrink-0" />
                            ) : (
                              <Globe className="w-3 h-3 text-[#6B645D] shrink-0" />
                            )}
                            <p className="text-xs font-bold text-[#1C1917] truncate">
                              {room.name}
                            </p>
                          </div>
                          <p className="text-[11px] text-[#6B645D] truncate mt-0.5">
                            {room.subtitle}
                          </p>
                          <p className="text-[10px] font-mono-num text-[#78716C] mt-0.5 inline-flex items-center gap-1">
                            <Users className="w-3 h-3 text-[#C8235D]" />
                            {count} {count === 1 ? 'avatar' : 'avatares'} ·{' '}
                            {room.visibility === 'private' ? 'Privada' : 'Pública'}
                          </p>
                        </div>
                        {onGoToRoom && (
                          <button
                            type="button"
                            onClick={() => {
                              onGoToRoom(room.id);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <DoorOpen className="w-3.5 h-3.5" />
                            Entrar
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="pt-4 border-t border-[#EFEAE3] flex flex-wrap items-center gap-2.5">
              {!isSelf && (
                <button
                  type="button"
                  onClick={handleToggleFriendClick}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isFriend
                      ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0] hover:bg-[#DCFCE7]'
                      : 'bg-[#FAF8F5] text-[#1C1917] border-[#E6E0D8] hover:bg-[#F2ECE3]'
                  }`}
                >
                  {isFriend ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Amigo Adicionado
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5 text-[#C8235D]" />
                      Adicionar Amigo
                    </>
                  )}
                </button>
              )}

              {!isSelf && (
                <button
                  type="button"
                  onClick={() => setDmOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dmOpen
                      ? 'bg-[#1C1917] text-white border-[#1C1917]'
                      : 'bg-[#FAF8F5] text-[#1C1917] border-[#E6E0D8] hover:bg-[#F2ECE3]'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Mensagem Privada
                  {messages.length > 0 && (
                    <span className="font-mono-num opacity-75">({messages.length})</span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onVisitSuite(profile);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-auto"
              >
                <Home className="w-3.5 h-3.5" />
                {isSelf ? 'Ir para Minha Suíte' : 'Visitar Suíte'}
              </button>
            </div>
          </div>
        </div>

        {dmOpen && !isSelf && (
          <div className="px-6 pb-6 pt-2 border-t border-[#EFEAE3] bg-[#FAF8F5]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-[#1C1917]">
                Mensagem Privada com @{profile.username}
              </h4>
              <span className="text-[11px] text-[#6B645D]">
                Conversa salva localmente
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-2 mb-3 p-3 rounded-xl bg-white border border-[#E6E0D8]">
              {messages.length === 0 ? (
                <p className="text-xs text-[#78716C] text-center py-2">
                  Nenhuma mensagem ainda. Diga olá para @{profile.username}!
                </p>
              ) : (
                messages.map((m) => {
                  const sentByMe =
                    normalizeUsername(m.fromUsername) ===
                    normalizeUsername(currentUser.username);
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${sentByMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-1.5 rounded-lg text-xs ${
                          sentByMe
                            ? 'bg-[#C8235D] text-white'
                            : 'bg-[#F5F2EC] text-[#1C1917]'
                        }`}
                      >
                        {m.text}
                      </div>
                      <span className="text-[10px] font-mono-num text-[#8C8278] mt-0.5">
                        @{m.fromUsername} ·{' '}
                        {new Date(m.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendDm} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={220}
                value={dmDraft}
                onChange={(e) => setDmDraft(e.target.value)}
                placeholder={`Escreva uma mensagem privada para @${profile.username}...`}
                className="flex-1 px-3 py-2 text-xs bg-white border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar DM
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
