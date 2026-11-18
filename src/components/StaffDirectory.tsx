import React, { useEffect, useState } from 'react';
import {
  Camera,
  Crown,
  Gem,
  Globe,
  MapPin,
  MapPinOff,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { SKIN_TONES } from '../data/catalog';
import {
  AvatarDisplayMode,
  AvatarGender,
  BotAiSpecialty,
  ClothingCategory,
  EquippedOutfit,
  PlayerProgressState,
  PresenceStatus,
  ServerRegion,
  SkinToneId,
  StaffRoleTier,
  UserAccount,
} from '../types/game';
import { BOT_SPECIALTY_META } from '../utils/aiBots';
import {
  ACCOUNTS_KEY,
  DEFAULT_STAFF_ROLE_TITLES,
  PLAYER_PREFIX,
  SERVER_REGION_META,
  WORLD_KEY,
  getFullClothingCatalog,
  getStaffAccountsWithProgress,
  isItemCompatibleWithGender,
  loadAccounts,
  unequipIncompatibleClothes,
} from '../utils/storage';
import { useGlobalState } from '../core/state/GlobalStateManager';
import { ProfileAvatar } from './ProfileAvatar';
import { Avatar3DViewport } from './three/Avatar3DViewport';

export const ALL_STAFF_ROLE_TIERS: StaffRoleTier[] = [
  'admin',
  'mod_br',
  'mod_es',
  'mod_en',
  'cm_br',
  'cm_es',
  'cm_en',
  'designer_global',
];

export const STAFF_ROLE_BADGE_META: Record<
  StaffRoleTier,
  {
    label: string;
    defaultTitle: string;
    tierMaterial: 'Diamante' | 'Dourado' | 'Prata';
    server?: ServerRegion;
    badgeClass: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  admin: {
    label: 'Administrador Geral',
    defaultTitle: DEFAULT_STAFF_ROLE_TITLES.admin,
    tierMaterial: 'Diamante',
    badgeClass:
      'bg-gradient-to-r from-[#E0F2FE] via-[#FFFFFF] to-[#BAE6FD] text-[#0C4A6E] border-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.45)] diamond-shimmer',
    Icon: Gem,
  },
  mod_br: {
    label: 'Moderador (BR)',
    defaultTitle: DEFAULT_STAFF_ROLE_TITLES.mod_br,
    tierMaterial: 'Prata',
    server: 'BR',
    badgeClass:
      'bg-gradient-to-r from-[#F8FAFC] via-[#E2E8F0] to-[#CBD5E1] text-[#334155] border-[#94A3B8] shadow-2xs',
    Icon: Shield,
  },
  mod_es: {
    label: 'Moderador (ES)',
    defaultTitle: DEFAULT_STAFF_ROLE_TITLES.mod_es,
    tierMaterial: 'Prata',
    server: 'ES',
    badgeClass:
      'bg-gradient-to-r from-[#F8FAFC] via-[#E2E8F0] to-[#CBD5E1] text-[#334155] border-[#94A3B8] shadow-2xs',
    Icon: Shield,
  },
  mod_en: {
    label: 'Moderador (EN)',
    defaultTitle: DEFAULT_STAFF_ROLE_TITLES.mod_en,
    tierMaterial: 'Prata',
    server: 'EN',
    badgeClass:
      'bg-gradient-to-r from-[#F8FAFC] via-[#E2E8F0] to-[#CBD5E1] text-[#334155] border-[#94A3B8] shadow-2xs',
    Icon: Shield,
  },
  cm_br: {
    label: 'Community Manager (BR)',
    defaultTitle: DEFAULT_STAFF_ROLE_TITLES.cm_br,
    tierMaterial: 'Dourado',
    server: 'BR',
    badgeClass:
      'bg-gradient-to-r from-[#FEF3C7] via-[#FDE68A] to-[#F59E0B]/40 text-[#78350F] border-[#D97706] shadow-2xs',
    Icon: Star,
  },
  cm_es: {
    label: 'Community Manager (ES)',
    defaultTitle: DEFAULT_STAFF_ROLE_TITLES.cm_es,
    tierMaterial: 'Dourado',
    server: 'ES',
    badgeClass:
      'bg-gradient-to-r from-[#FEF3C7] via-[#FDE68A] to-[#F59E0B]/40 text-[#78350F] border-[#D97706] shadow-2xs',
    Icon: Star,
  },
  cm_en: {
    label: 'Community Manager (EN)',
    defaultTitle: DEFAULT_STAFF_ROLE_TITLES.cm_en,
    tierMaterial: 'Dourado',
    server: 'EN',
    badgeClass:
      'bg-gradient-to-r from-[#FEF3C7] via-[#FDE68A] to-[#F59E0B]/40 text-[#78350F] border-[#D97706] shadow-2xs',
    Icon: Star,
  },
  designer_global: {
    label: 'Designer Global',
    defaultTitle: DEFAULT_STAFF_ROLE_TITLES.designer_global,
    tierMaterial: 'Dourado',
    badgeClass:
      'bg-gradient-to-r from-[#FEF3C7] via-[#FCD34D]/70 to-[#FDE68A] text-[#78350F] border-[#D97706] shadow-2xs',
    Icon: Palette,
  },
};

export const StaffRoleBadge: React.FC<{ tier: StaffRoleTier; compact?: boolean }> = ({
  tier,
  compact = false,
}) => {
  const meta = STAFF_ROLE_BADGE_META[tier] ?? STAFF_ROLE_BADGE_META.mod_br;
  const BadgeIcon = meta.Icon;
  return (
    <span
      title={`Insígnia ${meta.tierMaterial}: ${meta.label}`}
      className={`inline-flex items-center gap-1 rounded-md font-bold border whitespace-nowrap ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${meta.badgeClass}`}
    >
      <BadgeIcon className={compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
      {meta.label}
    </span>
  );
};

export const VipBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <span
    title="Assinante VIP — Acesso liberado à Boutique VIP Exclusiva"
    className={`inline-flex items-center gap-1 rounded-md font-bold border whitespace-nowrap bg-gradient-to-r from-[#FEF3C7] via-[#FDE68A] to-[#FCD34D] text-[#78350F] border-[#D97706] shadow-2xs ${
      compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
    }`}
  >
    <Crown className={compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
    VIP
  </span>
);

const PRESENCE_STATUS_BADGE: Record<
  PresenceStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  online: {
    label: 'Online',
    dotClass: 'bg-emerald-500',
    textClass: 'text-[#15803D]',
  },
  ausente: {
    label: 'Ausente',
    dotClass: 'bg-amber-400',
    textClass: 'text-[#B45309]',
  },
  offline: {
    label: 'Offline',
    dotClass: 'bg-stone-400',
    textClass: 'text-[#57534E]',
  },
};

export interface StaffBotEditorPayload {
  displayName: string;
  username: string;
  password?: string;
  bio: string;
  staffRoleTier: StaffRoleTier;
  staffRoleTitle?: string;
  presenceStatus: PresenceStatus;
  avatarGender: AvatarGender;
  skinTone: SkinToneId;
  equipped: EquippedOutfit;
  customAvatarUrl?: string;
  avatarDisplayMode: AvatarDisplayMode;
  botAiSpecialty: BotAiSpecialty;
  botActive: boolean;
  botRoamRooms: boolean;
  isVip?: boolean;
  serverRegion?: ServerRegion;
}

interface StaffDirectoryProps {
  isPrimaryAdmin: boolean;
  currentUser?: UserAccount;
  deletedItemIds?: string[];
  liveUserProfile?: {
    accountId?: string;
    username: string;
    displayName?: string;
    playerState: PlayerProgressState;
  };
  onAssignAccountStaffRole?: (
    accountId: string,
    roleTier: StaffRoleTier | null,
    staffRoleTitle?: string,
  ) => void;
  onCreateStaffBot?: (
    input: StaffBotEditorPayload,
  ) => { ok: true } | { ok: false; error: string };
  onUpdateStaffProfile?: (
    accountId: string,
    input: StaffBotEditorPayload,
  ) => { ok: true } | { ok: false; error: string };
  onRemoveStaffMember?: (accountId: string) => void;
  onToggleBotRoam?: (accountId: string) => void;
  onGoToMyProfile?: () => void;
  onOpenPublicProfile?: (
    username: string,
    fallbackAppearance?: {
      equipped?: EquippedOutfit;
      skinTone?: SkinToneId;
      avatarGender?: AvatarGender;
      customAvatarUrl?: string;
      avatarDisplayMode?: AvatarDisplayMode;
      role?: 'admin' | 'player';
    },
  ) => void;
  onUploadProfilePhoto?: (targetUid: string, dataUrl: string) => void;
  onRemoveProfilePhoto?: (targetUid: string) => void;
}

function resizeStaffPhoto(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
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
        resolve(canvas.toDataURL('image/jpeg', 0.80));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const DEFAULT_BOT_DRAFT: StaffBotEditorPayload = {
  displayName: '',
  username: '',
  bio: 'Integrante oficial atuando nas salas e sistemas do servidor.',
  staffRoleTier: 'mod_br',
  staffRoleTitle: DEFAULT_STAFF_ROLE_TITLES.mod_br,
  presenceStatus: 'online',
  avatarGender: 'feminino',
  skinTone: 'pessego',
  equipped: {},
  customAvatarUrl: undefined,
  avatarDisplayMode: 'medoll',
  botAiSpecialty: 'hybrid',
  botActive: true,
  botRoamRooms: true,
  isVip: false,
};

/**
 * Seção "Equipe de Moderação e Staff" com hierarquia de insígnias metálicas e diamante,
 * zero abreviações nos cargos, sem prefixos "@" e controle individual de circulação dos bots.
 */
export const StaffDirectory: React.FC<StaffDirectoryProps> = ({
  isPrimaryAdmin,
  currentUser,
  deletedItemIds = [],
  liveUserProfile,
  onAssignAccountStaffRole,
  onCreateStaffBot,
  onUpdateStaffProfile,
  onRemoveStaffMember,
  onToggleBotRoam,
  onGoToMyProfile,
  onOpenPublicProfile,
  onUploadProfilePhoto,
  onRemoveProfilePhoto,
}) => {
  const { presencesByAccountId } = useGlobalState();
  const [registeredAccounts, setRegisteredAccounts] = useState<UserAccount[]>(() =>
    loadAccounts(),
  );
  const [, setSyncTick] = useState(0);
  const [tierFilter, setTierFilter] = useState<'todos' | StaffRoleTier>('todos');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedRoleTier, setSelectedRoleTier] = useState<StaffRoleTier>('mod_br');
  const [customRoleTitle, setCustomRoleTitle] = useState(
    STAFF_ROLE_BADGE_META.mod_br.defaultTitle,
  );

  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingIsPrimaryOwner, setEditingIsPrimaryOwner] = useState(false);
  const [editorDraft, setEditorDraft] =
    useState<StaffBotEditorPayload>(DEFAULT_BOT_DRAFT);
  const [editorError, setEditorError] = useState<string | null>(null);

  const flashToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2800);
  };

  useEffect(() => {
    const refreshFromStorage = () => {
      setRegisteredAccounts(loadAccounts());
      setSyncTick((t) => t + 1);
    };

    const onStorage = (e: StorageEvent) => {
      if (
        !e.key ||
        e.key.startsWith(PLAYER_PREFIX) ||
        e.key === ACCOUNTS_KEY ||
        e.key === WORLD_KEY
      ) {
        refreshFromStorage();
      }
    };

    window.addEventListener('storage', onStorage);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('starlight_atelier_realtime_v1');
      channel.onmessage = (event) => {
        const data = event.data as { type?: string } | null;
        if (
          data?.type === 'player:sync' ||
          data?.type === 'accounts:sync' ||
          data?.type === 'world:sync'
        ) {
          refreshFromStorage();
        }
      };
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      if (channel) channel.close();
    };
  }, []);

  const staffProfiles = getStaffAccountsWithProgress(
    liveUserProfile
      ? {
          accountId: liveUserProfile.accountId,
          playerState: liveUserProfile.playerState,
        }
      : undefined,
  );

  const filteredStaffProfiles = staffProfiles.filter(({ account }) => {
    if (tierFilter === 'todos') return true;
    return (account.staffRoleTier ?? 'admin') === tierFilter;
  });

  const promotableAccounts = registeredAccounts.filter(
    (acc) => acc.role !== 'admin' && !acc.staffRoleTier,
  );

  const onlineCount = staffProfiles.filter(
    ({ progress }) => progress.presenceStatus === 'online',
  ).length;

  const fullCatalog = getFullClothingCatalog();
  const activeCatalog = fullCatalog.filter((item) => !deletedItemIds.includes(item.id));

  const openCreateBotModal = () => {
    setEditorMode('create');
    setEditingAccountId(null);
    setEditingIsPrimaryOwner(false);
    setEditorDraft({
      ...DEFAULT_BOT_DRAFT,
      equipped: { ...DEFAULT_BOT_DRAFT.equipped },
    });
    setEditorError(null);
  };

  const openEditStaffModal = (
    account: UserAccount,
    progress: PlayerProgressState,
  ) => {
    const tier: StaffRoleTier = account.staffRoleTier ?? 'admin';
    setEditorMode('edit');
    setEditingAccountId(account.id);
    setEditingIsPrimaryOwner(Boolean(account.isPrimaryOwner));
    setEditorDraft({
      displayName: account.displayName,
      username: account.username,
      bio: progress.bio,
      staffRoleTier: tier,
      staffRoleTitle:
        account.staffRoleTitle || STAFF_ROLE_BADGE_META[tier].defaultTitle,
      presenceStatus: progress.presenceStatus,
      avatarGender: progress.avatarGender,
      skinTone: progress.skinTone,
      equipped: { ...progress.equipped },
      customAvatarUrl: progress.customAvatarUrl,
      avatarDisplayMode: progress.avatarDisplayMode,
      botAiSpecialty:
        account.botAiSpecialty ?? (tier === 'designer_global' ? 'designer' : 'hybrid'),
      botActive: account.botActive !== false,
      botRoamRooms: account.botRoamRooms !== false,
      isVip: Boolean(account.isVip),
    });
    setEditorError(null);
  };

  const handleEditorPhotoSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setEditorError('Selecione uma imagem válida (PNG, JPG ou WebP).');
      return;
    }
    try {
      const dataUrl = await resizeStaffPhoto(file);
      setEditorDraft((prev) => ({
        ...prev,
        customAvatarUrl: dataUrl,
        avatarDisplayMode: 'photo',
      }));
      setEditorError(null);
    } catch {
      setEditorError('Não foi possível processar a imagem enviada.');
    }
  };

  const handleEditorEquipChange = (
    category: ClothingCategory,
    itemId: string,
  ) => {
    setEditorDraft((prev) => {
      const nextEquipped = { ...prev.equipped };
      if (!itemId) {
        delete nextEquipped[category];
      } else {
        nextEquipped[category] = itemId;
        if (category === 'vestidos') {
          delete nextEquipped.blusas;
          delete nextEquipped.calcas;
        } else if (category === 'blusas' || category === 'calcas') {
          delete nextEquipped.vestidos;
        }
      }
      return { ...prev, equipped: nextEquipped };
    });
  };

  const handleEditorGenderSwitch = (nextGender: AvatarGender) => {
    setEditorDraft((prev) => {
      const { nextEquipped } = unequipIncompatibleClothes(
        prev.equipped,
        nextGender,
        fullCatalog,
      );
      return {
        ...prev,
        avatarGender: nextGender,
        equipped: nextEquipped,
      };
    });
  };

  const handleEditorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditorError(null);

    if (editorMode === 'create') {
      if (!onCreateStaffBot) return;
      const res = onCreateStaffBot(editorDraft);
      if (!res.ok) {
        setEditorError(res.error);
        return;
      }
      setRegisteredAccounts(loadAccounts());
      setEditorMode(null);
      flashToast(
        `Novo integrante da Staff "${editorDraft.displayName}" (${editorDraft.username}) adicionado!`,
      );
      return;
    }

    if (editorMode === 'edit' && editingAccountId && onUpdateStaffProfile) {
      const res = onUpdateStaffProfile(editingAccountId, editorDraft);
      if (!res.ok) {
        setEditorError(res.error);
        return;
      }
      setRegisteredAccounts(loadAccounts());
      setEditorMode(null);
      flashToast(`Perfil de ${editorDraft.displayName} atualizado na Staff.`);
    }
  };

  const handlePromoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !onAssignAccountStaffRole) return;
    onAssignAccountStaffRole(
      selectedAccountId,
      selectedRoleTier,
      customRoleTitle.trim() || STAFF_ROLE_BADGE_META[selectedRoleTier].defaultTitle,
    );
    setRegisteredAccounts(loadAccounts());
    setSelectedAccountId('');
    setPromoteOpen(false);
    flashToast('Conta promovida para a Equipe de Staff.');
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Equipe / Staff */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FDF2F5] border border-[#F3D0DC] text-[#C8235D] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-[#1C1917] tracking-tight">
              Equipe de Moderação e Staff
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5 max-w-2xl">
              Hierarquia oficial com insígnias Diamante, Dourado e Prata. Moderadores atuam na disciplina do servidor designado; Community Managers respondem Tickets e validam pedidos PIX na Loja Premium; o Designer Global cria modas e salas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="text-xs text-[#6B645D] font-mono-num mr-1">
            {onlineCount} online · {staffProfiles.length} membros
          </span>

          {toastMsg && (
            <span className="text-xs font-medium text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-1.5 rounded-lg">
              {toastMsg}
            </span>
          )}

          {isPrimaryAdmin && onCreateStaffBot && (
            <button
              type="button"
              onClick={openCreateBotModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Membro à Staff
            </button>
          )}

          {isPrimaryAdmin && onAssignAccountStaffRole && (
            <button
              type="button"
              onClick={() => {
                setRegisteredAccounts(loadAccounts());
                setPromoteOpen((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1C1917] bg-[#FAF8F5] hover:bg-[#F2ECE3] border border-[#E6E0D8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#C8235D]" />
              Promover Jogador
            </button>
          )}
        </div>
      </section>

      {/* Filtro rápido por Cargo Completo (Zero abreviações) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTierFilter('todos')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
            tierFilter === 'todos'
              ? 'bg-[#1C1917] text-white border-[#1C1917]'
              : 'bg-white text-[#57534E] border-[#E6E0D8] hover:text-[#1C1917]'
          }`}
        >
          Todos ({staffProfiles.length})
        </button>
        {ALL_STAFF_ROLE_TIERS.map((tierId) => (
          <button
            key={tierId}
            type="button"
            onClick={() => setTierFilter(tierId)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              tierFilter === tierId
                ? 'bg-[#1C1917] text-white border-[#1C1917]'
                : 'bg-white text-[#57534E] border-[#E6E0D8] hover:text-[#1C1917]'
            }`}
          >
            {STAFF_ROLE_BADGE_META[tierId].label}
          </button>
        ))}
      </div>

      {/* Painel de Promoção de Contas Registradas para Staff (somente Administrador Geral) */}
      {isPrimaryAdmin && promoteOpen && (
        <section className="bg-white border border-[#C8235D]/40 rounded-xl p-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE3]">
            <div>
              <h3 className="text-base font-semibold text-[#1C1917]">
                Promover Conta Existente para a Staff
              </h3>
              <p className="text-xs text-[#6B645D] mt-0.5">
                Escolha uma conta registrada para atribuir um cargo oficial da equipe.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPromoteOpen(false)}
              className="p-1 text-[#6B645D] hover:text-[#1C1917] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {promotableAccounts.length === 0 ? (
            <p className="text-xs text-[#57534E] mt-4">
              Todas as contas registradas no momento já fazem parte da Staff. Você pode
              criar um novo perfil direto em <strong>Adicionar Membro à Staff</strong>.
            </p>
          ) : (
            <form
              onSubmit={handlePromoteSubmit}
              className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
            >
              <label className="block md:col-span-4">
                <span className="text-xs font-semibold text-[#44403C]">
                  Conta Registrada
                </span>
                <select
                  required
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                >
                  <option value="">Selecionar jogador...</option>
                  {promotableAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.displayName} ({acc.username})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-4">
                <span className="text-xs font-semibold text-[#44403C]">
                  Cargo Oficial
                </span>
                <select
                  value={selectedRoleTier}
                  onChange={(e) => {
                    const nextTier = e.target.value as StaffRoleTier;
                    setSelectedRoleTier(nextTier);
                    setCustomRoleTitle(STAFF_ROLE_BADGE_META[nextTier].defaultTitle);
                  }}
                  className="mt-1.5 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                >
                  {ALL_STAFF_ROLE_TIERS.map((tierOpt) => (
                    <option key={tierOpt} value={tierOpt}>
                      {STAFF_ROLE_BADGE_META[tierOpt].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-semibold text-[#44403C]">
                  Título Exibido
                </span>
                <input
                  type="text"
                  required
                  maxLength={44}
                  value={customRoleTitle}
                  onChange={(e) => setCustomRoleTitle(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                />
              </label>

              <div className="md:col-span-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors cursor-pointer"
                >
                  Promover
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Grade Dinâmica de Cards de Perfil da Staff */}
      {filteredStaffProfiles.length === 0 ? (
        <div className="bg-white border border-[#E6E0D8] rounded-xl p-8 text-center text-xs text-[#6B645D]">
          Nenhum integrante da Staff encontrado neste filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredStaffProfiles.map(({ account, progress }) => {
            const isCurrentUserCard = liveUserProfile?.accountId === account.id;
            const displayAccount =
              isCurrentUserCard && liveUserProfile
                ? {
                    ...account,
                    username: liveUserProfile.username,
                    displayName: liveUserProfile.displayName ?? account.displayName,
                  }
                : account;

            const tier: StaffRoleTier = displayAccount.staffRoleTier ?? 'admin';
            const tierMeta = STAFF_ROLE_BADGE_META[tier] ?? STAFF_ROLE_BADGE_META.mod_br;
            const roleTitle = tierMeta.label;

            const livePresence = presencesByAccountId[displayAccount.id];
            const resolvedPresence: PresenceStatus = livePresence
              ? livePresence.status === 'away'
                ? 'ausente'
                : livePresence.status
              : isCurrentUserCard
                ? progress.presenceStatus
                : displayAccount.isBot
                  ? displayAccount.botActive !== false && displayAccount.botRoamRooms !== false
                    ? progress.presenceStatus
                    : 'offline'
                  : 'offline';

            const presenceMeta =
              PRESENCE_STATUS_BADGE[resolvedPresence] ??
              PRESENCE_STATUS_BADGE.offline;

            const usingCustomPhoto =
              progress.avatarDisplayMode === 'photo' && Boolean(progress.customAvatarUrl);

            const isBotRoaming = displayAccount.botRoamRooms !== false;

            const openMemberProfile = () =>
              onOpenPublicProfile?.(displayAccount.username, {
                equipped: progress.equipped,
                skinTone: progress.skinTone,
                avatarGender: progress.avatarGender,
                customAvatarUrl: progress.customAvatarUrl,
                avatarDisplayMode: progress.avatarDisplayMode,
                role: displayAccount.role,
              });

            const canAdminRemove =
              isPrimaryAdmin &&
              !displayAccount.isPrimaryOwner &&
              displayAccount.id !== 'acc_admin_owner';

            return (
              <article
                key={displayAccount.id}
                onClick={openMemberProfile}
                role={onOpenPublicProfile ? 'button' : undefined}
                tabIndex={onOpenPublicProfile ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onOpenPublicProfile && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    openMemberProfile();
                  }
                }}
                title={`Clique para abrir o perfil completo de ${displayAccount.displayName}`}
                className={`bg-white border border-[#E6E0D8] rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors ${
                  onOpenPublicProfile
                    ? 'cursor-pointer hover:border-[#C8235D]/60 hover:bg-[#FAF8F5]/50'
                    : 'hover:border-[#D6C5CC]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <ProfileAvatar
                      username={displayAccount.username}
                      equipped={progress.equipped}
                      skinTone={progress.skinTone}
                      avatarGender={progress.avatarGender}
                      profilePic={displayAccount.profilePic}
                      customAvatarUrl={progress.customAvatarUrl}
                      avatarDisplayMode={displayAccount.profilePic ? 'photo' : progress.avatarDisplayMode}
                      deletedItemIds={deletedItemIds}
                      sizeClass="w-24 h-24"
                      roundedClass="rounded-xl"
                    />
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#78716C]">
                      <RefreshCw className="w-2.5 h-2.5 text-[#C8235D]" />
                      {displayAccount.profilePic ? 'Foto do perfil' : 'MeDoll ao vivo'}
                    </span>
                    {currentUser &&
                      (currentUser.id === displayAccount.id ||
                        currentUser.isPrimaryOwner ||
                        currentUser.email === 'miranda88686673@gmail.com' ||
                        (currentUser.role === 'admin' && currentUser.staffRoleTier === 'admin')) && (
                        <div className="flex items-center gap-1 mt-1">
                          <label
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[#1C1917] bg-[#FAF8F5] hover:bg-[#F2ECE3] border border-[#E6E0D8] rounded-md cursor-pointer transition-colors"
                          >
                            <Camera className="w-3 h-3 text-[#C8235D]" />
                            <span>Alterar</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file) return;
                                try {
                                  const url = await resizeStaffPhoto(file, 200);
                                  onUploadProfilePhoto?.(displayAccount.id, url);
                                  flashToast(`Foto de perfil de ${displayAccount.displayName} salva.`);
                                } catch {
                                  flashToast('Erro ao processar imagem.');
                                }
                              }}
                            />
                          </label>
                          {displayAccount.profilePic && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveProfilePhoto?.(displayAccount.id);
                                flashToast('Foto de perfil removida.');
                              }}
                              title="Remover foto"
                              className="p-1 text-[#78716C] hover:text-[#B91C1C] bg-[#FAF8F5] border border-[#E6E0D8] rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <h3 className="text-base font-bold text-[#1C1917] hover:text-[#C8235D] truncate">
                          {displayAccount.displayName}
                        </h3>
                        <span className="text-xs font-mono-num text-[#6B645D] truncate">
                          {displayAccount.username}
                        </span>
                        <StaffRoleBadge tier={tier} />
                        {displayAccount.isVip && <VipBadge compact />}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${presenceMeta.textClass}`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${presenceMeta.dotClass}`}
                        />
                        {presenceMeta.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <p className="text-xs font-medium text-[#57534E]">{roleTitle}</p>
                      {tierMeta.server && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono-num text-[#6B645D]">
                          · <Globe className="w-3 h-3 text-[#C8235D]" />
                          {SERVER_REGION_META[tierMeta.server].shortLabel}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#57534E] mt-2.5 leading-relaxed">
                      “{progress.bio}”
                    </p>
                  </div>
                </div>

                {/* Controle de Presença nas Salas para Bots + Ações do Admin / Membro */}
                {(isCurrentUserCard || isPrimaryAdmin) && (
                  <div className="pt-3 border-t border-[#EFEAE3] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isPrimaryAdmin && displayAccount.isBot && onToggleBotRoam ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleBotRoam(displayAccount.id);
                            setRegisteredAccounts(loadAccounts());
                            flashToast(
                              isBotRoaming
                                ? `${displayAccount.displayName} retirado das salas públicas.`
                                : `${displayAccount.displayName} liberado para circular pelas salas.`,
                            );
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                            isBotRoaming
                              ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0] hover:bg-[#D1FAE5]'
                              : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8] hover:bg-[#F2ECE3]'
                          }`}
                        >
                          {isBotRoaming ? (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-[#059669]" />
                              Presença ativa nas salas
                            </>
                          ) : (
                            <>
                              <MapPinOff className="w-3.5 h-3.5 text-[#78716C]" />
                              Fora das salas públicas
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#78716C]">
                          {displayAccount.isPrimaryOwner
                            ? 'Insígnia Diamante · Clique para abrir perfil'
                            : 'Perfil unificado · Clique para abrir'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isCurrentUserCard && onGoToMyProfile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onGoToMyProfile();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FAF8F5] hover:bg-[#F2ECE3] border border-[#E6E0D8] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#C8235D]" />
                          Editar no Meu Perfil
                        </button>
                      )}

                      {isPrimaryAdmin && !isCurrentUserCard && onUpdateStaffProfile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditStaffModal(displayAccount, progress);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#1C1917] bg-[#FAF8F5] hover:bg-[#F2ECE3] border border-[#E6E0D8] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#C8235D]" />
                          Editar Perfil
                        </button>
                      )}

                      {isPrimaryAdmin &&
                        !displayAccount.isPrimaryOwner &&
                        onAssignAccountStaffRole && (
                          <select
                            aria-label={`Alterar cargo de ${displayAccount.username}`}
                            value={tier}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              const nextTier = e.target.value as StaffRoleTier;
                              onAssignAccountStaffRole(
                                displayAccount.id,
                                nextTier,
                                STAFF_ROLE_BADGE_META[nextTier].defaultTitle,
                              );
                              setRegisteredAccounts(loadAccounts());
                              flashToast(
                                `${displayAccount.displayName} atualizado para ${STAFF_ROLE_BADGE_META[nextTier].label}.`,
                              );
                            }}
                            className="px-2 py-1.5 text-xs font-medium bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D] cursor-pointer"
                          >
                            {ALL_STAFF_ROLE_TIERS.map((tierOpt) => (
                              <option key={tierOpt} value={tierOpt}>
                                {STAFF_ROLE_BADGE_META[tierOpt].label}
                              </option>
                            ))}
                          </select>
                        )}

                      {canAdminRemove && (onRemoveStaffMember || onAssignAccountStaffRole) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onRemoveStaffMember) {
                              onRemoveStaffMember(displayAccount.id);
                            } else {
                              onAssignAccountStaffRole?.(displayAccount.id, null);
                            }
                            setRegisteredAccounts(loadAccounts());
                            flashToast(
                              `${displayAccount.displayName} removida da lista da Staff.`,
                            );
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Completo de Criação e Edição de Perfil Staff / Bot (Exclusivo Administrador Geral) */}
      {isPrimaryAdmin && editorMode && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={
            editorMode === 'create'
              ? 'Adicionar Membro à Staff'
              : `Editar perfil de ${editorDraft.username}`
          }
          onClick={() => setEditorMode(null)}
        >
          <div
            className="bg-white border border-[#E6E0D8] rounded-2xl max-w-4xl w-full p-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE3]">
              <div>
                <h3 className="font-display text-2xl font-bold text-[#1C1917] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#C8235D]" />
                  {editorMode === 'create'
                    ? 'Adicionar Integrante à Staff'
                    : `Editar Perfil da Staff · ${editorDraft.displayName || editorDraft.username}`}
                </h3>
                <p className="text-xs text-[#6B645D] mt-0.5">
                  Configure identidade, cargo oficial, atribuição na equipe, presença nas salas e visual da MeDoll.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorMode(null)}
                aria-label="Fechar editor"
                className="p-1.5 text-[#6B645D] hover:text-[#1C1917] rounded-lg hover:bg-[#F5F2EC] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditorSubmit} className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Prévia ao vivo da MeDoll e Foto de Perfil */}
              <div className="lg:col-span-4 space-y-4">
                <div className="rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] p-4 flex flex-col items-center">
                  <div className="w-full flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#44403C]">
                      Prévia em tempo real
                    </span>
                    <ProfileAvatar
                      username={editorDraft.username || 'staff'}
                      equipped={editorDraft.equipped}
                      skinTone={editorDraft.skinTone}
                      avatarGender={editorDraft.avatarGender}
                      customAvatarUrl={editorDraft.customAvatarUrl}
                      avatarDisplayMode={editorDraft.avatarDisplayMode}
                      deletedItemIds={deletedItemIds}
                      sizeClass="w-10 h-10"
                      roundedClass="rounded-lg"
                    />
                  </div>

                  <div className="w-full my-1">
                    <Avatar3DViewport
                      equipped={editorDraft.equipped}
                      skinTone={editorDraft.skinTone}
                      avatarGender={editorDraft.avatarGender}
                      catalog={activeCatalog}
                      showControls={false}
                      heightClassName="h-[260px]"
                      backgroundHex="#FAF8F5"
                    />
                  </div>

                  <div className="w-full pt-3 border-t border-[#E6E0D8] space-y-2">
                    <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1C1917] bg-white hover:bg-[#F2ECE3] border border-[#E6E0D8] rounded-lg cursor-pointer transition-colors">
                      <Camera className="w-3.5 h-3.5 text-[#C8235D]" />
                      {editorDraft.customAvatarUrl
                        ? 'Trocar Foto de Perfil'
                        : 'Enviar Foto do PC'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditorPhotoSelected}
                        className="hidden"
                      />
                    </label>

                    {editorDraft.customAvatarUrl && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setEditorDraft((prev) => ({
                              ...prev,
                              avatarDisplayMode: 'medoll',
                            }))
                          }
                          className={`flex-1 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${
                            editorDraft.avatarDisplayMode === 'medoll'
                              ? 'bg-[#1C1917] text-white border-[#1C1917]'
                              : 'bg-white text-[#57534E] border-[#E6E0D8]'
                          }`}
                        >
                          Usar MeDoll
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditorDraft((prev) => ({
                              ...prev,
                              avatarDisplayMode: 'photo',
                            }))
                          }
                          className={`flex-1 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${
                            editorDraft.avatarDisplayMode === 'photo'
                              ? 'bg-[#1C1917] text-white border-[#1C1917]'
                              : 'bg-white text-[#57534E] border-[#E6E0D8]'
                          }`}
                        >
                          Usar Foto
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditorDraft((prev) => ({
                              ...prev,
                              customAvatarUrl: undefined,
                              avatarDisplayMode: 'medoll',
                            }))
                          }
                          title="Remover foto"
                          className="p-1 text-[#B91C1C] bg-white border border-[#FECACA] rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dados do Perfil, Cargo Oficial, IA e Guarda-roupa da MeDoll */}
              <div className="lg:col-span-8 space-y-4">
                {editorError && (
                  <p
                    role="alert"
                    className="text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 rounded-lg"
                  >
                    {editorError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-[#44403C]">
                      Nome de Exibição
                    </span>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={40}
                      value={editorDraft.displayName}
                      onChange={(e) =>
                        setEditorDraft((prev) => ({
                          ...prev,
                          displayName: e.target.value,
                        }))
                      }
                      placeholder="Ex: Sofía Madrid"
                      className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#44403C]">
                      Nome de Usuário (identificador)
                    </span>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={24}
                      value={editorDraft.username}
                      onChange={(e) =>
                        setEditorDraft((prev) => ({
                          ...prev,
                          username: e.target.value.replace(/^@+/, ''),
                        }))
                      }
                      placeholder="sofia_mod_es"
                      className="mt-1 w-full px-3 py-2 text-xs font-mono-num bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-[#44403C]">
                      Cargo Oficial
                    </span>
                    <select
                      disabled={editingIsPrimaryOwner}
                      value={editorDraft.staffRoleTier}
                      onChange={(e) => {
                        const nextTier = e.target.value as StaffRoleTier;
                        setEditorDraft((prev) => ({
                          ...prev,
                          staffRoleTier: nextTier,
                          staffRoleTitle: STAFF_ROLE_BADGE_META[nextTier].defaultTitle,
                          botAiSpecialty:
                            nextTier === 'designer_global'
                              ? 'designer'
                              : nextTier.startsWith('cm_')
                                ? 'hybrid'
                                : prev.botAiSpecialty,
                        }));
                      }}
                      className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D] disabled:opacity-60"
                    >
                      {ALL_STAFF_ROLE_TIERS.map((tierOpt) => (
                        <option key={tierOpt} value={tierOpt}>
                          {STAFF_ROLE_BADGE_META[tierOpt].label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#44403C]">
                      Título do Cargo
                    </span>
                    <input
                      type="text"
                      maxLength={48}
                      value={editorDraft.staffRoleTitle ?? ''}
                      onChange={(e) =>
                        setEditorDraft((prev) => ({
                          ...prev,
                          staffRoleTitle: e.target.value,
                        }))
                      }
                      className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#44403C]">
                      Status em Tempo Real
                    </span>
                    <select
                      value={editorDraft.presenceStatus}
                      onChange={(e) =>
                        setEditorDraft((prev) => ({
                          ...prev,
                          presenceStatus: e.target.value as PresenceStatus,
                        }))
                      }
                      className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                    >
                      <option value="online">Online</option>
                      <option value="ausente">Ausente</option>
                      <option value="offline">Offline</option>
                    </select>
                  </label>
                </div>

                {/* Especialidade de IA Autônoma do Bot & Presença nas Salas */}
                {!editingIsPrimaryOwner && (
                  <div className="p-3.5 rounded-xl bg-[#FDF2F5]/60 border border-[#F3D0DC] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-bold text-[#9E1646] inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        Atribuição & Automação na Equipe
                      </span>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1C1917] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editorDraft.botRoamRooms}
                            onChange={(e) =>
                              setEditorDraft((prev) => ({
                                ...prev,
                                botRoamRooms: e.target.checked,
                              }))
                            }
                            className="accent-[#059669] w-3.5 h-3.5 cursor-pointer"
                          />
                          Presença automática nas salas
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1C1917] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editorDraft.botActive}
                            onChange={(e) =>
                              setEditorDraft((prev) => ({
                                ...prev,
                                botActive: e.target.checked,
                              }))
                            }
                            className="accent-[#C8235D] w-3.5 h-3.5 cursor-pointer"
                          />
                          Atuação automática ativa
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {(
                        ['maintenance', 'moderation', 'hybrid', 'designer'] as BotAiSpecialty[]
                      ).map((specKey) => {
                        const meta = BOT_SPECIALTY_META[specKey];
                        const selected = editorDraft.botAiSpecialty === specKey;
                        return (
                          <button
                            key={specKey}
                            type="button"
                            onClick={() =>
                              setEditorDraft((prev) => ({
                                ...prev,
                                botAiSpecialty: specKey,
                              }))
                            }
                            className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                              selected
                                ? 'bg-white border-[#C8235D] shadow-2xs'
                                : 'bg-white/60 border-[#E6E0D8] hover:bg-white'
                            }`}
                          >
                            <p className="text-xs font-bold text-[#1C1917]">
                              {meta.shortLabel}
                            </p>
                            <p className="text-[10px] text-[#57534E] mt-0.5 leading-snug">
                              {meta.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">
                    Biografia / Recado da Staff
                  </span>
                  <textarea
                    rows={2}
                    maxLength={240}
                    value={editorDraft.bio}
                    onChange={(e) =>
                      setEditorDraft((prev) => ({ ...prev, bio: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D] resize-none"
                  />
                </label>

                {/* Base do Corpo e Tom de Pele */}
                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold text-[#1C1917] inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#C8235D]" />
                      Aparência & Roupas da MeDoll
                    </span>

                    <div className="flex items-center gap-1.5">
                      {(['feminino', 'masculino', 'neutro'] as AvatarGender[]).map(
                        (g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleEditorGenderSwitch(g)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border capitalize cursor-pointer ${
                              editorDraft.avatarGender === g
                                ? 'bg-[#1C1917] text-white border-[#1C1917]'
                                : 'bg-white text-[#57534E] border-[#E6E0D8]'
                            }`}
                          >
                            {g}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Tons de pele */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-[#57534E]">
                      Tom de pele:
                    </span>
                    {SKIN_TONES.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() =>
                          setEditorDraft((prev) => ({ ...prev, skinTone: tone.id }))
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${
                          editorDraft.skinTone === tone.id
                            ? 'border-[#C8235D] bg-white text-[#1C1917]'
                            : 'border-[#E6E0D8] bg-white/60 text-[#57534E]'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-black/15"
                          style={{ backgroundColor: tone.base }}
                        />
                        {tone.label}
                      </button>
                    ))}
                  </div>

                  {/* Seletores de peças compatíveis com o modelo de corpo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {(
                      [
                        { cat: 'cabelo', label: 'Cabelo' },
                        { cat: 'blusas', label: 'Blusa / Jaqueta' },
                        { cat: 'calcas', label: 'Calça / Saia' },
                        { cat: 'vestidos', label: 'Vestido (peça única)' },
                        { cat: 'sapatos', label: 'Sapato' },
                        { cat: 'acessorios', label: 'Acessório' },
                      ] as const
                    ).map(({ cat, label }) => {
                      const options = activeCatalog.filter(
                        (item) =>
                          item.category === cat &&
                          isItemCompatibleWithGender(item.gender, editorDraft.avatarGender),
                      );
                      return (
                        <label key={cat} className="block">
                          <span className="text-[11px] font-semibold text-[#57534E]">
                            {label}
                          </span>
                          <select
                            value={editorDraft.equipped[cat] ?? ''}
                            onChange={(e) => handleEditorEquipChange(cat, e.target.value)}
                            className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                          >
                            <option value="">Sem peça</option>
                            {options.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditorMode(null)}
                    className="px-4 py-2 text-xs font-medium text-[#57534E] hover:text-[#1C1917] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors cursor-pointer"
                  >
                    {editorMode === 'create'
                      ? 'Adicionar à Equipe'
                      : 'Salvar Alterações da Staff'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
