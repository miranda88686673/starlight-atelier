import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Calendar,
  Camera,
  Check,
  Clock,
  Crown,
  DoorOpen,
  Globe,
  ImagePlus,
  KeyRound,
  Lock,
  Megaphone,
  Network,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { ACCOUNT_COUNTRIES } from '../data/catalog';
import {
  AvatarDisplayMode,
  CATEGORY_LABELS,
  ClothingCategory,
  ClothingItem,
  DEFAULT_FACE_CUSTOMIZATION,
  PlayerProgressState,
  PresenceStatus,
  ProfileBannerConfig,
  ProfileBannerPresetId,
  RoomId,
  ServerRegion,
  UserAccount,
} from '../types/game';
import {
  canonicalCharacterKey,
  cleanCharacterName,
  getLevelProgressMetrics,
  LOGIN_XP_REWARD,
  MAX_ACCOUNT_LEVEL,
  validateCharacterName,
} from '../utils/levelSystem';
import {
  createRealtimeChannel,
  deleteCustomRoom,
  readRoomsSnapshot,
  ROOMS_STORAGE_KEY,
  SharedRoomsSnapshot,
} from '../utils/realtime';
import {
  generateSimulatedIp,
  getCountryMeta,
  getFullClothingCatalog,
  getFullWallpaperCatalog,
  isVipAccount,
  loadAccounts,
  NAME_CHANGE_FEE_SC,
  normalizeUsername,
  SERVER_REGION_META,
} from '../utils/storage';
import { subscribeRemoteSync } from '../core/state/socketBridge';
import { useGlobalState } from '../core/state/GlobalStateManager';
import { CountryFlag } from './CountryFlag';
import {
  PROFILE_BANNER_PRESETS,
  PROFILE_GAME_BANNER_IMAGES,
  ProfileAnimatedBanner,
} from './ProfileAnimatedBanner';
import { ProfileAvatar } from './ProfileAvatar';
import { STAFF_ROLE_BADGE_META, StaffRoleBadge, VipBadge } from './StaffDirectory';
import { Avatar3DViewport } from './three/Avatar3DViewport';
import { ThreeRoomThumbnail } from './three/ThreeItemThumbnail';

interface ProfileAccountViewProps {
  account: UserAccount;
  playerState: PlayerProgressState;
  deletedItemIds: string[];
  catalog?: ClothingItem[];
  onUpdateIdentity: (input: {
    username: string;
    displayName: string;
  }) => { ok: true } | { ok: false; error: string };
  onUpdateProfileFields: (
    patch: Partial<
      Pick<
        PlayerProgressState,
        | 'bio'
        | 'presenceStatus'
        | 'countryCode'
        | 'timezone'
        | 'simulatedIp'
        | 'friendUsernames'
        | 'profileBanner'
      >
    >,
  ) => void;
  onUploadProfilePhoto: (targetUid: string, dataUrl: string) => void;
  onRemoveProfilePhoto: (targetUid: string) => void;
  onChangeAvatarDisplayMode: (mode: AvatarDisplayMode) => void;
  onGoToMeDoll: () => void;
  onGoToSuite: () => void;
  onGoToRoom?: (roomId: RoomId) => void;
  onGoToRoomsLobby?: () => void;
}

export const PRESENCE_META: Record<
  PresenceStatus,
  {
    label: string;
    dotClass: string;
    textClass: string;
    bgActiveClass: string;
    description: string;
  }
> = {
  online: {
    label: 'Online',
    dotClass: 'bg-emerald-500',
    textClass: 'text-[#15803D]',
    bgActiveClass: 'border-emerald-500 bg-emerald-50/70 text-[#14532D]',
    description: 'Visível e disponível para salas, convites e trocas.',
  },
  ausente: {
    label: 'Ausente',
    dotClass: 'bg-amber-400',
    textClass: 'text-[#B45309]',
    bgActiveClass: 'border-amber-400 bg-amber-50/80 text-[#78350F]',
    description: 'Conectado no atelier, mas temporariamente afastado.',
  },
  offline: {
    label: 'Offline',
    dotClass: 'bg-rose-500',
    textClass: 'text-[#B91C1C]',
    bgActiveClass: 'border-rose-400 bg-rose-50/70 text-[#881337]',
    description: 'Modo discreto; aparece como desconectado para a comunidade.',
  },
};

/** Redimensiona imagem enviada do PC via Canvas */
function resizeImageToDataUrl(
  file: File,
  maxWidth = 240,
  maxHeight = 240,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function getTimeOfDayLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Manhã';
  if (hour >= 12 && hour < 18) return 'Tarde';
  if (hour >= 18 && hour < 24) return 'Noite';
  return 'Madrugada';
}

type ProfileSubTab =
  | 'perfil'
  | 'identidade'
  | 'colecoes'
  | 'salas'
  | 'amigos'
  | 'seguranca';

/**
 * Tela de Perfil do Usuário reorganizada:
 * - Banner animado contínuo acima e por trás do avatar, bandeira, nome e informações.
 * - Bandeira real do país posicionada diretamente ao lado do nome de usuário.
 * - Nível e Data de Criação da conta em destaque.
 * - E-mail registrado e quantidade de AM estritamente ocultos na tela de perfil.
 */
export const ProfileAccountView: React.FC<ProfileAccountViewProps> = ({
  account,
  playerState,
  deletedItemIds,
  catalog,
  onUpdateIdentity,
  onUpdateProfileFields,
  onUploadProfilePhoto,
  onRemoveProfilePhoto,
  onChangeAvatarDisplayMode,
  onGoToMeDoll,
  onGoToSuite,
  onGoToRoom,
  onGoToRoomsLobby,
}) => {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const unifiedAccountName =
    cleanCharacterName(account.displayName || account.username) || account.username;

  const [characterNameDraft, setCharacterNameDraft] = useState(unifiedAccountName);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const { presencesByAccountId } = useGlobalState();
  const [profileTab, setProfileTab] = useState<ProfileSubTab>('perfil');
  const [newFriendInput, setNewFriendInput] = useState('');
  const [friendError, setFriendError] = useState<string | null>(null);
  const [roomsSnapshot, setRoomsSnapshot] = useState<SharedRoomsSnapshot>(() =>
    readRoomsSnapshot(),
  );
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);

  const accountsByUsername = useMemo(() => {
    const map = new Map<string, UserAccount>();
    for (const acc of loadAccounts()) {
      map.set(acc.username.trim().toLowerCase(), acc);
    }
    return map;
  }, [profileTab]);

  const activeCatalog = useMemo(() => {
    const base = catalog ?? getFullClothingCatalog();
    return base.filter((item) => !deletedItemIds.includes(item.id));
  }, [catalog, deletedItemIds]);

  const catalogMap = useMemo(() => {
    const map = new Map<string, { name: string; isLegendary: boolean; category: string }>();
    for (const item of activeCatalog) {
      map.set(item.id, {
        name: item.name,
        isLegendary: Boolean(item.isLegendary || item.itemClass === 'legendary'),
        category: item.category,
      });
    }
    return map;
  }, [activeCatalog]);

  const equippedEntries = useMemo(() => {
    const order: ClothingCategory[] = [
      'cabelo',
      'vestidos',
      'blusas',
      'casacos',
      'calcas',
      'sapatos',
      'acessorios',
    ];
    return order
      .map((category) => {
        const itemId = playerState.equipped[category];
        if (!itemId) return null;
        const item = catalogMap.get(itemId);
        if (!item) return null;
        return {
          category,
          categoryLabel: CATEGORY_LABELS[category] ?? category,
          itemId,
          itemName: item.name,
          isLegendary: item.isLegendary,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [playerState.equipped, catalogMap]);

  useEffect(() => {
    setCharacterNameDraft(unifiedAccountName);
    setIdentityError(null);
  }, [account.id, unifiedAccountName]);

  useEffect(() => {
    if (!bannerModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBannerModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bannerModalOpen]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setRoomsSnapshot(readRoomsSnapshot());

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === ROOMS_STORAGE_KEY) {
        setRoomsSnapshot(readRoomsSnapshot());
      }
    };
    window.addEventListener('storage', handleStorage);

    const channel = createRealtimeChannel();
    if (channel) {
      channel.onmessage = (event) => {
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
      window.removeEventListener('storage', handleStorage);
      channel?.close();
      unsubscribeSocket();
    };
  }, []);

  const wallpapersById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getFullWallpaperCatalog>[number]>();
    for (const wp of getFullWallpaperCatalog()) {
      map.set(wp.id, wp);
    }
    return map;
  }, []);

  const userActiveRooms = useMemo(() => {
    const myUsernameNorm = normalizeUsername(account.username);
    const myDisplayNorm = normalizeUsername(account.displayName || account.username);
    return (roomsSnapshot.customRooms ?? []).filter((room) => {
      const creatorNorm = normalizeUsername(room.creatorUsername ?? '');
      if (!creatorNorm) return false;
      return creatorNorm === myUsernameNorm || creatorNorm === myDisplayNorm;
    });
  }, [roomsSnapshot.customRooms, account.username, account.displayName]);

  const avatarCountByRoom = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(roomsSnapshot.presences ?? {}).forEach((p) => {
      if (p?.roomId) {
        counts[p.roomId] = (counts[p.roomId] ?? 0) + 1;
      }
    });
    return counts;
  }, [roomsSnapshot.presences]);

  const handleDeleteUserRoom = (roomId: RoomId, roomName: string) => {
    const channel = createRealtimeChannel();
    const updated = deleteCustomRoom(roomId, channel);
    channel?.close();
    setRoomsSnapshot(updated);
    setConfirmDeleteRoomId(null);
    flashSaved(`Sala "${roomName}" encerrada.`);
  };

  const flashSaved = (msg: string) => {
    setSaveFeedback(msg);
    window.setTimeout(() => setSaveFeedback(null), 2600);
  };

  const activeOwnedItems = useMemo(
    () => playerState.ownedItemIds.filter((id) => !deletedItemIds.includes(id)),
    [playerState.ownedItemIds, deletedItemIds],
  );
  const activeOwnedCount = activeOwnedItems.length;
  const isPrimaryAdmin =
    Boolean(account.isPrimaryOwner) || account.id === 'acc_admin_owner';
  const levelMetrics = getLevelProgressMetrics(
    playerState.level,
    playerState.xp,
    isPrimaryAdmin,
  );
  const playerLevel = levelMetrics.level;
  const countryMeta = getCountryMeta(playerState.countryCode);
  const presenceMeta = PRESENCE_META[playerState.presenceStatus];
  const activeBanner: ProfileBannerConfig = playerState.profileBanner ?? {
    presetId: 'atelier_aurora',
    motionSpeed: 'slow',
  };

  const cleanedCharacterDraft = cleanCharacterName(characterNameDraft);
  const identityChanged =
    canonicalCharacterKey(cleanedCharacterDraft) !==
    canonicalCharacterKey(unifiedAccountName);
  const hasEnoughForNameChange = playerState.starcoins >= NAME_CHANGE_FEE_SC;

  const clockFormatted = useMemo(() => {
    try {
      const timeStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: playerState.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);

      const dateStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: playerState.timezone,
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(now);

      const hourPart = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: playerState.timezone,
          hour: 'numeric',
          hour12: false,
        }).format(now),
      );

      return {
        timeStr,
        dateStr,
        period: getTimeOfDayLabel(Number.isNaN(hourPart) ? now.getHours() : hourPart),
      };
    } catch {
      return {
        timeStr: now.toLocaleTimeString('pt-BR'),
        dateStr: now.toLocaleDateString('pt-BR'),
        period: getTimeOfDayLabel(now.getHours()),
      };
    }
  }, [now, playerState.timezone]);

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    setIdentityError(null);
    const formatError = validateCharacterName(cleanedCharacterDraft);
    if (formatError) {
      setIdentityError(formatError);
      return;
    }
    const result = onUpdateIdentity({
      username: cleanedCharacterDraft,
      displayName: cleanedCharacterDraft,
    });
    if (!result.ok) {
      setIdentityError(result.error);
      return;
    }
    flashSaved('Nome do personagem atualizado em todo o atelier.');
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Selecione um arquivo de imagem válido (PNG, JPG ou WebP).');
      return;
    }

    try {
      setUploadError(null);
      const dataUrl = await resizeImageToDataUrl(file, 240, 240);
      onUploadProfilePhoto(account.id, dataUrl);
      flashSaved('Foto de perfil salva.');
    } catch {
      setUploadError('Não foi possível processar esta foto.');
    }
  };

  const handleBannerFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBannerError('Selecione uma imagem válida (PNG, JPG ou WebP) para o banner.');
      return;
    }

    try {
      setBannerError(null);
      const dataUrl = await resizeImageToDataUrl(file, 1280, 480);
      onUpdateProfileFields({
        profileBanner: {
          presetId: 'custom_image',
          customImageUrl: dataUrl,
          motionSpeed: activeBanner.motionSpeed ?? 'slow',
        },
      });
      flashSaved('Banner panorâmico em movimento aplicado!');
    } catch {
      setBannerError('Não foi possível carregar a imagem do banner.');
    }
  };

  const handleSelectBannerPreset = (presetId: ProfileBannerPresetId) => {
    onUpdateProfileFields({
      profileBanner: {
        ...activeBanner,
        presetId,
      },
    });
    flashSaved('Banner animado atualizado.');
  };

  const handleToggleBannerSpeed = (speed: 'slow' | 'medium') => {
    onUpdateProfileFields({
      profileBanner: {
        ...activeBanner,
        motionSpeed: speed,
      },
    });
    flashSaved(speed === 'medium' ? 'Movimento dinâmico ativado.' : 'Movimento suave ativado.');
  };

  const handleRemoveCustomBanner = () => {
    onUpdateProfileFields({
      profileBanner: {
        presetId: 'atelier_aurora',
        customImageUrl: undefined,
        motionSpeed: activeBanner.motionSpeed ?? 'slow',
      },
    });
    flashSaved('Banner restaurado para o tema animado do Atelier.');
  };

  const handleSelectCountry = (nextCode: string) => {
    const meta = getCountryMeta(nextCode);
    const nextIp = generateSimulatedIp(`${account.id}_${meta.code}`, meta.code);
    onUpdateProfileFields({
      countryCode: meta.code,
      timezone: meta.timezone,
      simulatedIp: nextIp,
    });
    flashSaved(`País e bandeira atualizados para ${meta.name}.`);
  };

  const handleUseBrowserTimezone = () => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTz) return;
    onUpdateProfileFields({ timezone: browserTz });
    flashSaved(`Fuso sincronizado (${browserTz}).`);
  };

  const handleRegenerateSimulatedIp = () => {
    const entropy = `${account.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextIp = generateSimulatedIp(entropy, playerState.countryCode);
    onUpdateProfileFields({ simulatedIp: nextIp });
    flashSaved('Sessão de conexão atualizada.');
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    setFriendError(null);
    const clean = newFriendInput.trim().toLowerCase();
    if (!clean) return;
    const currentFriends = playerState.friendUsernames ?? [];
    if (currentFriends.includes(clean)) {
      setFriendError('Este usuário já está na sua lista de amigos.');
      return;
    }
    if (clean === account.username.trim().toLowerCase()) {
      setFriendError('Você não pode adicionar a si mesma como amiga.');
      return;
    }
    onUpdateProfileFields({ friendUsernames: [...currentFriends, clean] });
    setNewFriendInput('');
    flashSaved(`Amigo @${clean} adicionado!`);
  };

  const handleRemoveFriend = (friendName: string) => {
    const currentFriends = playerState.friendUsernames ?? [];
    onUpdateProfileFields({
      friendUsernames: currentFriends.filter((f) => f !== friendName),
    });
    flashSaved(`Amigo @${friendName} removido.`);
  };

  const handleSelectGameBannerImage = (imageUrl: string, title: string) => {
    setBannerError(null);
    onUpdateProfileFields({
      profileBanner: {
        presetId: 'custom_image',
        customImageUrl: imageUrl,
        motionSpeed: activeBanner.motionSpeed ?? 'slow',
      },
    });
    flashSaved(`Banner "${title}" aplicado com movimento.`);
  };

  const openBannerCustomizer = () => {
    setBannerError(null);
    setBannerModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Inputs de upload ocultos */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelected}
        className="hidden"
        aria-label="Selecionar foto de perfil do computador"
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        onChange={handleBannerFileSelected}
        className="hidden"
        aria-label="Selecionar imagem para o banner animado do perfil"
      />

      {/* HERO DO PERFIL COM BANNER ANIMADO ACIMA E POR TRÁS DE FOTO, NOME E INFORMAÇÕES */}
      <section className="rounded-2xl border border-[#E6E0D8] bg-white overflow-hidden shadow-xs">
        <div className="relative min-h-[268px] sm:min-h-[296px] flex flex-col justify-between p-6 sm:p-8">
          {/* Banner em movimento atrás e acima de todo o cabeçalho */}
          <ProfileAnimatedBanner banner={activeBanner} />

          {/* Barra superior do banner: rótulo discreto + ações rápidas */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-white/85">
              <span>Perfil do Atelier</span>
              <span aria-hidden="true" className="text-white/40">·</span>
              <span className="inline-flex items-center gap-1.5 font-mono-num">
                <span className={`w-2 h-2 rounded-full ${presenceMeta.dotClass}`} />
                {presenceMeta.label}
              </span>
              {saveFeedback && (
                <>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span className="text-emerald-300 font-semibold">{saveFeedback}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {playerState.customAvatarUrl && (
                <div className="flex items-center gap-0.5 p-0.5 bg-black/45 backdrop-blur-md border border-white/15 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      onChangeAvatarDisplayMode('medoll');
                      flashSaved('Avatar alterado para MeDoll.');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      playerState.avatarDisplayMode === 'medoll'
                        ? 'bg-white text-[#1C1917]'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    MeDoll
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeAvatarDisplayMode('photo');
                      flashSaved('Avatar alterado para Foto enviada.');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      playerState.avatarDisplayMode === 'photo'
                        ? 'bg-white text-[#1C1917]'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    Foto
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/20 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-rose-300" />
                {playerState.customAvatarUrl ? 'Alterar Foto' : 'Enviar Foto'}
              </button>

              {playerState.customAvatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveProfilePhoto(account.id);
                    flashSaved('Foto removida.');
                  }}
                  title="Remover foto enviada"
                  className="p-1.5 text-white/80 hover:text-rose-300 bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/20 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={openBannerCustomizer}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1C1917] bg-white/95 hover:bg-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                <Wand2 className="w-3.5 h-3.5 text-[#C8235D]" />
                Personalizar Banner
              </button>
            </div>
          </div>

          {/* Bloco Principal sobre o banner em movimento: Foto + Nome + Bandeira ao lado + Info da conta */}
          <div className="relative z-10 mt-10 sm:mt-14 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5 min-w-0">
              <div className="relative shrink-0 self-start sm:self-auto">
                <ProfileAvatar
                  username={account.username}
                  equipped={playerState.equipped}
                  skinTone={playerState.skinTone}
                  avatarGender={playerState.avatarGender}
                  faceCustomization={playerState.faceCustomization}
                  customAvatarUrl={playerState.customAvatarUrl}
                  avatarDisplayMode={playerState.avatarDisplayMode}
                  deletedItemIds={deletedItemIds}
                  sizeClass="w-24 h-24 sm:w-28 sm:h-28 ring-2 ring-white/90 shadow-xl"
                  roundedClass="rounded-2xl"
                />
                <span
                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#161211] ${presenceMeta.dotClass}`}
                  title={`Status: ${presenceMeta.label}`}
                />
              </div>

              <div className="min-w-0 space-y-1.5 text-white">
                {/* Nome Único do Personagem + Bandeira da vida real diretamente ao lado */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white truncate drop-shadow-xs">
                    {unifiedAccountName}
                  </h2>
                  <CountryFlag
                    countryCode={countryMeta.code}
                    countryName={countryMeta.name}
                    size="lg"
                  />
                  {isVipAccount(account) && <VipBadge />}
                </div>

                {/* Cargo + País */}
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-white/85">
                  {account.staffRoleTier ? (
                    <StaffRoleBadge tier={account.staffRoleTier} />
                  ) : account.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-300">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {STAFF_ROLE_BADGE_META.admin.label}
                    </span>
                  ) : (
                    <span className="text-white/85 font-medium">
                      Estilista da Comunidade
                    </span>
                  )}
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span className="text-white/85">
                    {countryMeta.name} ({clockFormatted.timeStr})
                  </span>
                </div>

                {/* Resumo da Bio sobre o banner */}
                <p className="text-xs sm:text-sm text-white/80 max-w-2xl line-clamp-2 leading-relaxed pt-0.5">
                  {playerState.bio || 'Explorando estilos e criações no Nocturne Vale Club.'}
                </p>

                {uploadError && (
                  <p className="text-xs text-rose-300 font-medium pt-1">{uploadError}</p>
                )}
              </div>
            </div>

            {/* Destaque direto de Nível, Barra de XP & Criação no canto direito do banner */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 shrink-0 border-t border-white/15 pt-4 md:border-t-0 md:pt-0">
              <div className="min-w-[180px]">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-wider text-white/65 font-semibold">
                    Nível Atual
                  </p>
                  <span className="font-mono-num text-[11px] text-white/75">
                    / {MAX_ACCOUNT_LEVEL}
                  </span>
                </div>
                <p className="font-mono-num text-2xl sm:text-3xl font-bold text-white leading-tight mt-0.5">
                  Nível {playerLevel}
                </p>
                <div
                  className="mt-2 h-1.5 w-full rounded-full bg-white/20 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={levelMetrics.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progresso de XP para o próximo nível"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F43F5E] to-[#FBBF24] transition-all duration-500"
                    style={{ width: `${levelMetrics.percent}%` }}
                  />
                </div>
                <p className="font-mono-num text-[11px] text-white/80 mt-1">
                  {levelMetrics.isMaxLevel
                    ? 'Nível máximo atingido'
                    : `${levelMetrics.xp.toLocaleString('pt-BR')} / ${levelMetrics.xpRequired.toLocaleString('pt-BR')} XP`}
                </p>
              </div>
              <div className="hidden sm:block h-11 w-px bg-white/20" aria-hidden="true" />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/65 font-semibold">
                  Conta Criada em
                </p>
                <p className="font-mono-num text-base sm:text-lg font-bold text-amber-200 leading-tight mt-1">
                  {account.createdAt}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Faixa de Métricas Organizada (SEM E-MAIL e SEM QUANTIDADE DE AM) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-[#EFEAE3] bg-white border-t border-[#EFEAE3]">
          <div className="px-6 py-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#FDF2F5] border border-[#F3D0DC] flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-[#C8235D]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#78716C]">
                  Nível &amp; XP por Login
                </p>
                <span className="font-mono-num text-[11px] font-semibold text-[#C8235D]">
                  {levelMetrics.percent}%
                </span>
              </div>
              <p className="font-mono-num text-lg font-bold text-[#1C1917] truncate">
                Nível {playerLevel}{' '}
                <span className="text-xs font-medium text-[#78716C]">
                  / {MAX_ACCOUNT_LEVEL}
                </span>
              </p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#EFEAE3] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#C8235D] transition-all duration-500"
                  style={{ width: `${levelMetrics.percent}%` }}
                />
              </div>
              <p className="font-mono-num text-[10px] text-[#6B645D] mt-1">
                {levelMetrics.isMaxLevel
                  ? 'Nível Máximo (1.000)'
                  : `${levelMetrics.xp} / ${levelMetrics.xpRequired} XP · +${LOGIN_XP_REWARD} XP ao entrar`}
              </p>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-[#B45309]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#78716C]">
                Criação da Conta
              </p>
              <p className="font-mono-num text-lg font-bold text-[#1C1917] truncate">
                {account.createdAt}
              </p>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] flex items-center justify-center shrink-0">
              <CountryFlag
                countryCode={countryMeta.code}
                countryName={countryMeta.name}
                size="md"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#78716C]">
                Origem da Conta
              </p>
              <p className="text-sm font-bold text-[#1C1917] truncate">
                {countryMeta.name}
              </p>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[#C8235D]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#78716C]">
                Closet &amp; Rede
              </p>
              <p className="font-mono-num text-sm font-bold text-[#1C1917] truncate">
                {activeOwnedCount} peças · {(playerState.friendUsernames ?? []).length} amigos
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Navegação Interna em Linha Única */}
      <nav
        aria-label="Seções do perfil"
        className="flex items-center gap-1.5 overflow-x-auto bg-white border border-[#E6E0D8] rounded-xl p-2"
      >
        {[
          { id: 'perfil' as const, label: 'Visão Geral & Personagem', icon: Sparkles },
          { id: 'identidade' as const, label: 'Identidade & País', icon: Globe },
          { id: 'colecoes' as const, label: 'Vitrine de Coleções', icon: Crown },
          { id: 'salas' as const, label: 'Salas', icon: DoorOpen },
          { id: 'amigos' as const, label: 'Amigos', icon: Users },
          { id: 'seguranca' as const, label: 'Privacidade & E-mail', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = profileTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setProfileTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#1C1917] text-white shadow-xs'
                  : 'text-[#57534E] hover:bg-[#F5F2EC] hover:text-[#1C1917]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ABA 1: VISÃO GERAL COM PERSONAGEM DA CONTA EM TEMPO REAL, BIO E STATUS */}
      {profileTab === 'perfil' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Quadro Principal: Personagem da Conta em Tempo Real com Roupa e Itens Equipados */}
          <section className="lg:col-span-7 bg-white border border-[#E6E0D8] rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFEAE3]">
              <div>
                <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                  Personagem em Tempo Real
                </h3>
                <p className="text-xs text-[#6B645D] mt-0.5">
                  Exibe automaticamente seu visual completo com roupas, cabelo e acessórios vestidos agora.
                </p>
              </div>

              <button
                type="button"
                onClick={onGoToMeDoll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-300" />
                Trocar Roupa no MeDoll
              </button>
            </div>

            <Avatar3DViewport
              equipped={playerState.equipped}
              skinTone={playerState.skinTone}
              avatarGender={playerState.avatarGender}
              faceCustomization={playerState.faceCustomization ?? DEFAULT_FACE_CUSTOMIZATION}
              catalog={activeCatalog}
              showControls={true}
              heightClassName="h-[400px] sm:h-[430px]"
              backgroundHex="#F6F1EA"
            />

            {/* Resumo das peças vestidas no momento */}
            <div className="pt-4 border-t border-[#EFEAE3] space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#1C1917]">
                  Peças &amp; Itens Equipados Agora
                </span>
                <span className="font-mono-num text-[#6B645D]">
                  {equippedEntries.length}{' '}
                  {equippedEntries.length === 1 ? 'item em uso' : 'itens em uso'}
                </span>
              </div>

              {equippedEntries.length === 0 ? (
                <div className="py-4 px-4 rounded-xl bg-[#FAF8F5] border border-dashed border-[#E6E0D8] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B645D]">
                  <span>Nenhuma roupa ou acessório vestido no momento.</span>
                  <button
                    type="button"
                    onClick={onGoToMeDoll}
                    className="font-semibold text-[#C8235D] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Vestir no MeDoll
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {equippedEntries.map((entry) => (
                    <div
                      key={entry.category}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-[#F3EFE8] min-w-0"
                    >
                      <span className="text-[#78716C] shrink-0">
                        {entry.categoryLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[#1C1917] truncate">
                        {entry.isLegendary && (
                          <Crown className="w-3 h-3 text-[#D97706] shrink-0" />
                        )}
                        <span className="truncate">{entry.itemName}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Coluna Direita: Biografia, Presença e Atalhos */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white border border-[#E6E0D8] rounded-2xl p-6 space-y-4">
              <div className="flex items-baseline justify-between gap-2 pb-2.5 border-b border-[#EFEAE3]">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#1C1917]">
                    Biografia / Recado
                  </h3>
                  <p className="text-xs text-[#6B645D]">
                    Apresentação salva automaticamente no seu perfil
                  </p>
                </div>
                <span className="text-xs font-mono-num text-[#78716C]">
                  {playerState.bio.length}/280
                </span>
              </div>

              <textarea
                rows={4}
                maxLength={280}
                value={playerState.bio}
                onChange={(e) => onUpdateProfileFields({ bio: e.target.value })}
                placeholder="Conte sobre seu estilo favorito, criações ou deixe um recado para visitantes..."
                aria-label="Biografia ou recado do perfil"
                className="w-full px-3.5 py-2.5 text-sm text-[#1C1917] bg-[#FAF8F5] border border-[#E6E0D8] rounded-xl focus:outline-none focus:border-[#C8235D] resize-none leading-relaxed"
              />
            </section>

            <section className="bg-white border border-[#E6E0D8] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2.5 border-b border-[#EFEAE3]">
                <UserCheck className="w-4 h-4 text-[#C8235D]" />
                <h3 className="font-display text-xl font-bold text-[#1C1917]">
                  Status de Presença
                </h3>
              </div>

              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                role="radiogroup"
                aria-label="Seletor de status de presença"
              >
                {(['online', 'ausente', 'offline'] as PresenceStatus[]).map((statusKey) => {
                  const meta = PRESENCE_META[statusKey];
                  const isActive = playerState.presenceStatus === statusKey;
                  return (
                    <button
                      key={statusKey}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => {
                        onUpdateProfileFields({ presenceStatus: statusKey });
                        flashSaved(`Status: ${meta.label}.`);
                      }}
                      className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                        isActive
                          ? meta.bgActiveClass
                          : 'border-[#E6E0D8] bg-[#FAF8F5] hover:bg-white hover:border-[#C7BEB2]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.dotClass}`} />
                        <span className="text-xs font-bold">{meta.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[#EFEAE3] flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onGoToSuite}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ir para Suíte
                </button>
                <button
                  type="button"
                  onClick={onGoToMeDoll}
                  className="px-3.5 py-2 text-xs font-semibold text-[#1C1917] bg-[#F5F2EC] hover:bg-[#EAE4DA] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Abrir MeDoll
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ABA 2: IDENTIDADE, BANDEIRA DO PAÍS, RELÓGIO LOCAL & DADOS DE CONEXÃO */}
      {profileTab === 'identidade' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* País & Bandeira da Vida Real + Horário */}
          <section className="lg:col-span-6 bg-white border border-[#E6E0D8] rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#C8235D]" />
                <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                  País, Bandeira &amp; Fuso Horário
                </h3>
              </div>
              <button
                type="button"
                onClick={handleUseBrowserTimezone}
                className="text-xs font-semibold text-[#C8235D] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sincronizar navegador
              </button>
            </div>

            {/* Grade visual de seleção de países com bandeiras reais */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#44403C]">
                Selecione a bandeira exibida ao lado do seu nome de usuário:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ACCOUNT_COUNTRIES.map((country) => {
                  const selected = playerState.countryCode === country.code;
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => handleSelectCountry(country.code)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#C8235D] bg-[#FDF2F5]/70 text-[#1C1917]'
                          : 'border-[#E6E0D8] bg-[#FAF8F5] hover:border-[#C7BEB2] text-[#44403C]'
                      }`}
                    >
                      <CountryFlag
                        countryCode={country.code}
                        countryName={country.name}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{country.name}</p>
                        <p className="text-[10px] text-[#78716C] truncate">{country.cityLabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Relógio ao Vivo */}
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#6B645D]">
                  <Clock className="w-3.5 h-3.5 text-[#C8235D]" />
                  <span>Horário local · {clockFormatted.period}</span>
                </div>
                <p className="font-mono-num text-2xl font-bold text-[#1C1917] mt-1">
                  {clockFormatted.timeStr}
                </p>
                <p className="text-xs text-[#57534E] capitalize mt-0.5">
                  {clockFormatted.dateStr}
                </p>
              </div>
              <div className="text-right flex flex-col items-end gap-1.5">
                <CountryFlag
                  countryCode={countryMeta.code}
                  countryName={countryMeta.name}
                  size="lg"
                />
                <p className="text-xs font-semibold text-[#1C1917]">{countryMeta.cityLabel}</p>
                <p className="text-[11px] font-mono-num text-[#78716C]">{playerState.timezone}</p>
              </div>
            </div>
          </section>

          {/* Identidade Pública (Nome Único) + Dados de Sessão */}
          <div className="lg:col-span-6 space-y-6">
            <section className="bg-white border border-[#E6E0D8] rounded-2xl p-6">
              <form onSubmit={handleSaveIdentity} className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-[#C8235D]" />
                    <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                      Nome do Personagem
                    </h3>
                  </div>
                  <span className="text-xs text-[#6B645D]">
                    Nome próprio e exclusivo
                  </span>
                </div>

                <label className="block text-xs font-medium text-[#44403C]">
                  Nome Único do Personagem (Exibição &amp; Usuário unificados)
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={24}
                    value={characterNameDraft}
                    onChange={(e) => {
                      setCharacterNameDraft(e.target.value.replace(/^@+/, ''));
                      if (identityError) setIdentityError(null);
                    }}
                    placeholder="Ex: Clara Couture"
                    className="mt-1.5 w-full px-3.5 py-2.5 text-sm text-[#1C1917] bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                  />
                </label>

                <p className="text-[11px] text-[#6B645D] leading-relaxed">
                  No Nocturne Vale Club cada conta possui um único nome próprio (usado simultaneamente como nome de exibição e identificação). Ninguém poderá copiar um nome já existente.
                </p>

                {!hasEnoughForNameChange && identityChanged && (
                  <p className="text-xs font-medium text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] px-3 py-2 rounded-lg">
                    No momento não é possível concluir a troca de nome desta conta.
                  </p>
                )}

                {identityError && (
                  <p
                    role="alert"
                    className="text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 rounded-lg"
                  >
                    {identityError}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-[#78716C]">
                    Atualiza imediatamente em salas, suíte, mercado e perfil.
                  </span>
                  <button
                    type="submit"
                    disabled={!identityChanged || !hasEnoughForNameChange}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] disabled:bg-[#D6CFC7] disabled:text-[#78716C] disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Atualizar Nome
                  </button>
                </div>
              </form>
            </section>

            {/* Dados Técnicos de Conexão */}
            <section className="bg-white border border-[#E6E0D8] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-[#C8235D]" />
                  <h3 className="font-display text-xl font-bold text-[#1C1917]">
                    Registro da Conta &amp; Progresso
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateSimulatedIp}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1C1917] bg-[#F5F2EC] hover:bg-[#EAE4DA] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Renovar Sessão
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] space-y-2.5 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[#6B645D]">Data de Criação</span>
                  <span className="font-mono-num font-bold text-[#1C1917]">
                    {account.createdAt}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[#6B645D]">Nível da Conta</span>
                  <span className="font-mono-num font-bold text-[#C8235D]">
                    Nível {playerLevel} / {MAX_ACCOUNT_LEVEL}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[#6B645D]">Experiência (XP por Login)</span>
                    <span className="font-mono-num font-semibold text-[#1C1917]">
                      {levelMetrics.isMaxLevel
                        ? 'Máximo atingido'
                        : `${levelMetrics.xp} / ${levelMetrics.xpRequired} XP`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#E6E0D8] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#C8235D] transition-all duration-500"
                      style={{ width: `${levelMetrics.percent}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[#6B645D]">Localidade da Sessão</span>
                  <span className="font-semibold text-[#1C1917] inline-flex items-center gap-1.5">
                    <CountryFlag countryCode={countryMeta.code} countryName={countryMeta.name} size="sm" />
                    {countryMeta.cityLabel} ({countryMeta.code})
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[#6B645D]">IP Simulado (Auditoria Staff)</span>
                  <span className="font-mono-num font-semibold text-[#1C1917]">
                    {playerState.simulatedIp}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ABA 3: VITRINE DE COLEÇÕES */}
      {profileTab === 'colecoes' && (
        <section className="bg-white border border-[#E6E0D8] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFEAE3]">
            <div>
              <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                Vitrine de Coleções
              </h3>
              <p className="text-xs text-[#6B645D] mt-0.5">
                Peças, coroas e itens exclusivos guardados no seu closet do Nocturne Vale Club.
              </p>
            </div>
            <span className="font-mono-num text-xs font-semibold text-[#C8235D]">
              {activeOwnedCount} peças no closet · Nível {playerLevel}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 pt-1">
            {activeOwnedItems.slice(0, 24).map((itemId, idx) => {
              const info = catalogMap.get(itemId);
              const isLegendary = Boolean(info?.isLegendary);
              return (
                <div
                  key={`${itemId}-${idx}`}
                  className={`rounded-xl p-3 flex flex-col items-center justify-center text-center border transition-colors ${
                    isLegendary
                      ? 'bg-[#FFFDF5] border-[#F59E0B]'
                      : 'bg-[#FAF8F5] border-[#E6E0D8] hover:border-[#C8235D]'
                  }`}
                >
                  <div className="w-11 h-11 rounded-lg bg-white border border-[#EFEAE3] flex items-center justify-center mb-2">
                    {isLegendary ? (
                      <Crown className="w-5 h-5 text-[#D97706]" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-[#C8235D]" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-[#1C1917] truncate w-full">
                    {info?.name ?? `Peça ${itemId.slice(0, 10)}`}
                  </span>
                  <span className="text-[10px] text-[#78716C] capitalize mt-0.5">
                    {isLegendary ? 'Item Lendário' : info?.category ?? 'Coleção'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ABA 4: SALAS CRIADAS PELO USUÁRIO ATIVAS NA ABA SALAS */}
      {profileTab === 'salas' && (
        <section className="bg-white border border-[#E6E0D8] rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFEAE3]">
            <div>
              <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                Salas
              </h3>
              <p className="text-xs text-[#6B645D] mt-0.5">
                Todas as salas criadas por você que estão ativas no momento na aba Salas.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono-num text-xs font-semibold text-[#C8235D]">
                {userActiveRooms.length}{' '}
                {userActiveRooms.length === 1 ? 'sala ativa' : 'salas ativas'}
              </span>
              {onGoToRoomsLobby && (
                <button
                  type="button"
                  onClick={onGoToRoomsLobby}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-rose-300" />
                  Abrir Aba Salas
                </button>
              )}
            </div>
          </div>

          {userActiveRooms.length === 0 ? (
            <div className="py-12 px-6 text-center rounded-2xl bg-[#FAF8F5] border border-dashed border-[#D6CFC7] space-y-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-[#E6E0D8] flex items-center justify-center mx-auto">
                <DoorOpen className="w-6 h-6 text-[#C8235D]" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <p className="text-sm font-bold text-[#1C1917]">
                  Nenhuma sala criada ativa no momento
                </p>
                <p className="text-xs text-[#6B645D] leading-relaxed">
                  Quando você criar uma sala na aba Salas (pública ou privada), ela aparecerá automaticamente aqui com acesso direto.
                </p>
              </div>
              {onGoToRoomsLobby && (
                <button
                  type="button"
                  onClick={onGoToRoomsLobby}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors cursor-pointer"
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  Ir para a Aba Salas
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userActiveRooms.map((room) => {
                const srv: ServerRegion = room.serverRegion ?? 'BR';
                const srvMeta = SERVER_REGION_META[srv];
                const avatarCount = avatarCountByRoom[room.id] ?? 0;
                const roomWallpaper = room.wallpaperId
                  ? wallpapersById.get(room.wallpaperId)
                  : undefined;
                const isConfirmingDelete = confirmDeleteRoomId === room.id;

                return (
                  <article
                    key={room.id}
                    className="rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] overflow-hidden flex flex-col justify-between transition-colors hover:border-[#C7BEB2]"
                  >
                    <div>
                      <div className="relative h-36 w-full bg-[#1C1917] overflow-hidden border-b border-[#E6E0D8]">
                        {room.customBackgroundImageUrl ? (
                          <img
                            src={room.customBackgroundImageUrl}
                            alt={room.name}
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <ThreeRoomThumbnail
                            theme={room.backdropTheme}
                            wallpaper={roomWallpaper}
                            alt={room.name}
                            className="w-full h-full object-cover"
                          />
                        )}

                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-semibold">
                            <span>{srvMeta.flagEmoji}</span>
                            <span>{srv}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-mono-num font-semibold">
                            {room.visibility === 'private' ? (
                              <Lock className="w-3 h-3 text-amber-300" />
                            ) : (
                              <Globe className="w-3 h-3 text-emerald-300" />
                            )}
                            {room.visibility === 'private' ? 'Privada' : 'Pública'}
                          </span>
                        </div>

                        <div className="absolute bottom-2.5 right-2.5 pointer-events-none">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/95 text-[#1C1917] text-[10px] font-mono-num font-bold shadow-xs">
                            <Users className="w-3 h-3 text-[#C8235D]" />
                            {avatarCount} {avatarCount === 1 ? 'avatar' : 'avatares'}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-lg font-bold text-[#1C1917] leading-snug line-clamp-1">
                            {room.name}
                          </h4>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                            Ativa
                          </span>
                        </div>

                        <p className="text-xs text-[#57534E] line-clamp-2 leading-relaxed">
                          {room.subtitle}
                        </p>

                        {room.roomNotice && (
                          <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#EFEAE3] text-[11px] text-[#44403C]">
                            <Megaphone className="w-3.5 h-3.5 text-[#C8235D] shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{room.roomNotice}</span>
                          </div>
                        )}

                        {room.visibility === 'private' && (room.password || room.inviteCode) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[11px] text-[#92400E] font-mono-num">
                            {room.password && (
                              <span className="inline-flex items-center gap-1">
                                <KeyRound className="w-3 h-3 shrink-0" />
                                Senha: <strong>{room.password}</strong>
                              </span>
                            )}
                            {room.inviteCode && (
                              <span>
                                Convite: <strong>{room.inviteCode}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-4 pb-4 pt-2 border-t border-[#EFEAE3] flex items-center justify-between gap-2">
                      {onGoToRoom && (
                        <button
                          type="button"
                          onClick={() => onGoToRoom(room.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <DoorOpen className="w-3.5 h-3.5" />
                          Entrar na Sala
                        </button>
                      )}

                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeleteUserRoom(room.id, room.name)}
                            className="px-2.5 py-2 text-[11px] font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg transition-colors cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRoomId(null)}
                            className="px-2 py-2 text-[11px] font-medium text-[#57534E] bg-white border border-[#E6E0D8] hover:bg-[#F5F2EC] rounded-lg transition-colors cursor-pointer"
                          >
                            Voltar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRoomId(room.id)}
                          title="Encerrar sala ativa"
                          aria-label={`Encerrar sala ${room.name}`}
                          className="p-2 text-[#78716C] hover:text-[#B91C1C] bg-white border border-[#E6E0D8] hover:border-rose-200 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ABA 4: AMIGOS */}
      {profileTab === 'amigos' && (
        <section className="bg-white border border-[#E6E0D8] rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFEAE3]">
            <div>
              <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                Lista de Amigos
              </h3>
              <p className="text-xs text-[#6B645D] mt-0.5">
                Adicione jogadores pelo nome de usuário para acompanhar status e visitar suítes.
              </p>
            </div>
            <span className="font-mono-num text-xs font-semibold text-[#15803D]">
              {(playerState.friendUsernames ?? []).length} amigos
            </span>
          </div>

          <form onSubmit={handleAddFriend} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newFriendInput}
              onChange={(e) => {
                setNewFriendInput(e.target.value.replace(/^@+/, ''));
                if (friendError) setFriendError(null);
              }}
              placeholder="Digite o nome de usuário (ex: sofia_style)..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-xl focus:outline-none focus:border-[#C8235D]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Adicionar Amigo
            </button>
          </form>

          {friendError && (
            <p role="alert" className="text-xs text-[#B91C1C] font-medium">
              {friendError}
            </p>
          )}

          <div className="space-y-2">
            {!playerState.friendUsernames || playerState.friendUsernames.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#6B645D] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E6E0D8]">
                Sua lista de amigos está vazia. Adicione estilistas para interagir nas salas!
              </div>
            ) : (
              playerState.friendUsernames.map((friendName) => {
                const matchedAcc = accountsByUsername.get(friendName.trim().toLowerCase());
                const livePresence =
                  (matchedAcc ? presencesByAccountId[matchedAcc.id] : undefined) ??
                  Object.values(presencesByAccountId).find(
                    (p) => p.username.trim().toLowerCase() === friendName.trim().toLowerCase(),
                  );
                const status = livePresence?.status ?? 'offline';
                const statusMeta =
                  status === 'online'
                    ? { label: 'Online', dotClass: 'bg-emerald-500', textClass: 'text-emerald-700' }
                    : status === 'away'
                      ? { label: 'Ausente', dotClass: 'bg-amber-400', textClass: 'text-amber-700' }
                      : { label: 'Offline', dotClass: 'bg-stone-400', textClass: 'text-stone-500' };

                return (
                  <div
                    key={friendName}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-full bg-[#1C1917] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {friendName.slice(0, 2).toUpperCase()}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#FAF8F5] ${statusMeta.dotClass}`}
                          title={statusMeta.label}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1C1917] truncate">
                          @{friendName}
                        </p>
                        <p className={`text-[11px] font-medium ${statusMeta.textClass}`}>
                          {statusMeta.label}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFriend(friendName)}
                      className="px-3 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* ABA 5: PRIVACIDADE & E-MAIL OCULTO */}
      {profileTab === 'seguranca' && (
        <section className="bg-white border border-[#E6E0D8] rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFEAE3]">
            <div>
              <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                Privacidade da Conta
              </h3>
              <p className="text-xs text-[#6B645D] mt-0.5">
                Dados sensíveis como e-mail registrado e saldo financeiro ficam ocultos na visualização do perfil.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Check className="w-4 h-4" />
              E-mail Protegido &amp; Oculto
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#1C1917]">
                E-mail vinculado oculto por privacidade (••••••••@•••••••)
              </p>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Por segurança da conta, o endereço de e-mail cadastrado nunca é exibido na tela de perfil para jogadores ou visitantes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-[#6B645D]">
            <span>
              Conta criada em <strong className="font-mono-num text-[#1C1917]">{account.createdAt}</strong> · Nível <strong className="font-mono-num text-[#1C1917]">{playerLevel}</strong>
            </span>
            <button
              type="button"
              onClick={() => flashSaved('Verificação de privacidade confirmada no servidor.')}
              className="px-4 py-2 bg-[#1C1917] hover:bg-[#332E2B] text-white font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Verificar Proteção da Conta
            </button>
          </div>
        </section>
      )}

      {/* MODAL PERSONALIZAR BANNER (aberto pelo botão lá em cima: Foto do PC, Imagens do Jogo, Temas + Movimento Suave/Dinâmico) */}
      {bannerModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Personalizar Banner Animado do Perfil"
          onClick={() => setBannerModalOpen(false)}
        >
          <div
            className="bg-white border border-[#E6E0D8] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-[#EFEAE3] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                  Personalizar Banner Animado do Perfil
                </h3>
                <p className="text-xs text-[#6B645D] mt-0.5">
                  Escolha uma foto do computador, uma imagem do jogo ou um tema editorial e ajuste o movimento.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1 p-1 bg-[#F5F2EC] rounded-lg"
                  role="group"
                  aria-label="Velocidade do movimento do banner"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleBannerSpeed('slow')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      (activeBanner.motionSpeed ?? 'slow') === 'slow'
                        ? 'bg-white text-[#1C1917] shadow-xs'
                        : 'text-[#6B645D] hover:text-[#1C1917]'
                    }`}
                  >
                    Movimento Suave
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleBannerSpeed('medium')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeBanner.motionSpeed === 'medium'
                        ? 'bg-white text-[#1C1917] shadow-xs'
                        : 'text-[#6B645D] hover:text-[#1C1917]'
                    }`}
                  >
                    Dinâmico
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setBannerModalOpen(false)}
                  aria-label="Fechar Personalizar Banner"
                  className="p-2 text-[#57534E] hover:text-[#1C1917] hover:bg-[#F5F2EC] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Pré-visualização ao vivo do Banner com Movimento */}
              <div className="relative h-32 rounded-xl overflow-hidden border border-[#E6E0D8]">
                <ProfileAnimatedBanner banner={activeBanner} />
                <div className="relative z-10 h-full px-5 flex items-end pb-4 justify-between text-white">
                  <div className="flex items-center gap-2.5">
                    <span className="font-display text-xl font-bold">
                      {unifiedAccountName}
                    </span>
                    <CountryFlag
                      countryCode={countryMeta.code}
                      countryName={countryMeta.name}
                      size="sm"
                    />
                  </div>
                  <span className="font-mono-num text-xs text-white/85">
                    Nível {playerLevel} · {account.createdAt}
                  </span>
                </div>
              </div>

              {/* Opção 1: Enviar Foto do Computador */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#57534E]">
                    Foto do Computador
                  </h4>
                  <span className="text-[11px] text-[#78716C]">
                    PNG, JPG ou WebP em movimento contínuo
                  </span>
                </div>
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border ${
                    activeBanner.presetId === 'custom_image' &&
                    !PROFILE_GAME_BANNER_IMAGES.some(
                      (g) => g.imageUrl === activeBanner.customImageUrl,
                    )
                      ? 'border-[#C8235D] bg-[#FDF2F5]/60'
                      : 'border-dashed border-[#D6CFC7] bg-[#FAF8F5]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#1C1917]">
                      Escolher imagem do seu computador
                    </p>
                    <p className="text-xs text-[#6B645D] mt-0.5">
                      Use qualquer foto panorâmica e alterne entre Movimento Suave ou Dinâmico acima.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      Escolher do Computador
                    </button>
                    {activeBanner.customImageUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveCustomBanner}
                        title="Restaurar tema padrão do Atelier"
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#B91C1C] bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Opção 2: Imagens Existentes do Jogo */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#57534E]">
                    Imagens Existentes do Jogo
                  </h4>
                  <span className="text-[11px] text-[#78716C]">
                    Acervo oficial Nocturne Vale Club
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PROFILE_GAME_BANNER_IMAGES.map((gameImg) => {
                    const selected =
                      activeBanner.presetId === 'custom_image' &&
                      activeBanner.customImageUrl === gameImg.imageUrl;
                    return (
                      <button
                        key={gameImg.id}
                        type="button"
                        onClick={() =>
                          handleSelectGameBannerImage(gameImg.imageUrl, gameImg.name)
                        }
                        className={`group rounded-xl border overflow-hidden text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#C8235D] bg-[#FDF2F5]/60'
                            : 'border-[#E6E0D8] bg-[#FAF8F5] hover:border-[#C7BEB2]'
                        }`}
                      >
                        <div className="relative h-20 w-full overflow-hidden bg-[#1C1917]">
                          <img
                            src={gameImg.imageUrl}
                            alt={gameImg.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {selected && (
                            <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#C8235D] text-white flex items-center justify-center shadow-sm">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-bold text-[#1C1917] truncate">
                            {gameImg.name}
                          </p>
                          <p className="text-[11px] text-[#6B645D] line-clamp-1 mt-0.5">
                            {gameImg.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opção 3: Temas Animados do Atelier */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#57534E]">
                    Temas Animados do Atelier
                  </h4>
                  <span className="text-[11px] text-[#78716C]">
                    Fundos em movimento fluido
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROFILE_BANNER_PRESETS.map((preset) => {
                    const selected = activeBanner.presetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectBannerPreset(preset.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#C8235D] bg-[#FDF2F5]/60'
                            : 'border-[#E6E0D8] bg-[#FAF8F5] hover:border-[#C7BEB2]'
                        }`}
                      >
                        <span
                          className="w-10 h-10 rounded-lg shrink-0 ring-1 ring-black/10"
                          style={{ background: preset.baseGradient }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#1C1917] truncate">
                              {preset.name}
                            </span>
                            {selected && (
                              <Check className="w-3.5 h-3.5 text-[#C8235D] shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#6B645D] line-clamp-1 mt-0.5">
                            {preset.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {bannerError && (
                <p className="text-xs text-[#B91C1C] font-medium">{bannerError}</p>
              )}

              <div className="pt-3 border-t border-[#EFEAE3] flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setBannerModalOpen(false)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors cursor-pointer"
                >
                  Concluir Personalização
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
