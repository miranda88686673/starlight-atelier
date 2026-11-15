import {
  ACCOUNT_COUNTRIES,
  AMBIENT_ROOM_AVATARS,
  DEFAULT_BANNED_WORDS,
  DEFAULT_MOCK_USERS,
  DEFAULT_STAFF_MEMBERS,
  DEFAULT_SUITE_ITEMS,
  FURNITURE_CATALOG,
  INITIAL_CLOTHING_CATALOG,
  INITIAL_NEWS_POSTS,
  PURCHASABLE_ROOMS_CATALOG,
  PURCHASABLE_WALLPAPERS_CATALOG,
} from '../data/catalog';
import type { AccountCountryOption } from '../types/game';
import { emitStatePatchToServer } from '../core/state/socketBridge';
import {
  AvatarDisplayMode,
  AvatarGender,
  BotAiSpecialty,
  ClothingItem,
  EquippedOutfit,
  FurnitureDef,
  ItemGenderStyle,
  MockUser,
  NewsPost,
  PlayerProgressState,
  PresenceStatus,
  PrivateMessage,
  PublicProfileSummary,
  PurchasableRoomItem,
  PurchasableWallpaperItem,
  RoomAvatarPresence,
  RoomChatMessage,
  RoomDef,
  ServerRegion,
  SkinToneId,
  StaffRoleTier,
  UserAccount,
  WorldModerationState,
} from '../types/game';

export const ADMIN_OWNER_EMAIL = 'miranda88686673@gmail.com';
export const NAME_CHANGE_FEE_SC = 500;

/** Chaves versionadas no localStorage */
export const ACCOUNTS_KEY = 'starlight_atelier_accounts_v1';
export const SESSION_KEY = 'starlight_atelier_session_v1';
export const WORLD_KEY = 'starlight_atelier_world_v1';
export const PLAYER_PREFIX = 'starlight_atelier_player_v1_';
export const DMS_KEY = 'starlight_atelier_dms_v1';
const REMOVED_STAFF_IDS_KEY = 'starlight_atelier_removed_staff_v1';
const ROOMS_STORAGE_KEY = 'starlight_atelier_rooms_v1';
const REALTIME_CHANNEL_NAME = 'starlight_atelier_realtime_v1';

export const SERVER_REGION_META: Record<
  ServerRegion,
  {
    code: ServerRegion;
    label: string;
    shortLabel: string;
    description: string;
    flagEmoji: string;
    countryName: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  BR: {
    code: 'BR',
    label: 'Servidor Brasileiro (BR)',
    shortLabel: 'Servidor BR',
    description: 'Salas e chat oficial da comunidade em Português',
    flagEmoji: '🇧🇷',
    countryName: 'Brasil',
    badgeBg: 'bg-[#ECFDF5]',
    badgeText: 'text-[#065F46]',
    badgeBorder: 'border-[#A7F3D0]',
  },
  ES: {
    code: 'ES',
    label: 'Servidor Español (ES)',
    shortLabel: 'Servidor ES',
    description: 'Salas y chat oficial de la comunidad en Español',
    flagEmoji: '🇪🇸',
    countryName: 'España & LatAm',
    badgeBg: 'bg-[#FEF2F2]',
    badgeText: 'text-[#991B1B]',
    badgeBorder: 'border-[#FECACA]',
  },
  EN: {
    code: 'EN',
    label: 'English Server (EN)',
    shortLabel: 'Servidor EN',
    description: 'Official community rooms and chat in English',
    flagEmoji: '🇺🇸',
    countryName: 'Global / USA',
    badgeBg: 'bg-[#EFF6FF]',
    badgeText: 'text-[#1E40AF]',
    badgeBorder: 'border-[#BFDBFE]',
  },
};

export const STAFF_ROLE_SERVER_MAP: Record<StaffRoleTier, ServerRegion | undefined> = {
  admin: undefined,
  mod_br: 'BR',
  mod_es: 'ES',
  mod_en: 'EN',
  cm_br: 'BR',
  cm_es: 'ES',
  cm_en: 'EN',
  designer_global: undefined,
};

export const DEFAULT_STAFF_ROLE_TITLES: Record<StaffRoleTier, string> = {
  admin: 'Administrador Geral',
  mod_br: 'Moderador (BR)',
  mod_es: 'Moderador (ES)',
  mod_en: 'Moderador (EN)',
  cm_br: 'Gerente da Comunidade (BR)',
  cm_es: 'Gerente da Comunidade (ES)',
  cm_en: 'Gerente da Comunidade (EN)',
  designer_global: 'Designer Global',
};

/** Converte cargos legados para os cargos padronizados atuais */
export function normalizeStaffTier(rawTier?: string): StaffRoleTier | undefined {
  if (!rawTier) return undefined;
  if (
    rawTier === 'admin' ||
    rawTier === 'mod_br' ||
    rawTier === 'mod_es' ||
    rawTier === 'mod_en' ||
    rawTier === 'cm_br' ||
    rawTier === 'cm_es' ||
    rawTier === 'cm_en' ||
    rawTier === 'designer_global'
  ) {
    return rawTier;
  }
  if (rawTier === 'moderator') return 'mod_br';
  if (rawTier === 'developer') return 'mod_en';
  if (rawTier === 'curator') return 'cm_es';
  return 'mod_br';
}

/** Verifica se a conta é o Administrador Geral exclusivo vinculado a miranda88686673@gmail.com */
export function isPrimaryAdminAccount(account?: UserAccount | null): boolean {
  if (!account) return false;
  return (
    account.email.trim().toLowerCase() === ADMIN_OWNER_EMAIL &&
    Boolean(account.isPrimaryOwner || account.staffRoleTier === 'admin')
  );
}

/** Verifica se a conta possui o cargo de Designer Global */
export function isDesignerGlobalAccount(account?: UserAccount | null): boolean {
  if (!account) return false;
  return account.staffRoleTier === 'designer_global';
}

/** Verifica se a conta possui status VIP (ou cargo com acesso VIP automático) */
export function isVipAccount(account?: UserAccount | null): boolean {
  if (!account) return false;
  return Boolean(
    account.isVip ||
      isPrimaryAdminAccount(account) ||
      account.staffRoleTier === 'designer_global',
  );
}

/** Retorna o servidor regional (BR, ES, EN) moderado pela conta (Moderador), ou null */
export function getModeratorServer(account?: UserAccount | null): ServerRegion | null {
  if (!account || isPrimaryAdminAccount(account)) return null;
  if (account.staffRoleTier === 'mod_br') return 'BR';
  if (account.staffRoleTier === 'mod_es') return 'ES';
  if (account.staffRoleTier === 'mod_en') return 'EN';
  return null;
}

/** Retorna o servidor regional gerido pelo Gerente da Comunidade (BR, ES, EN), ou null */
export function getCommunityManagerServer(account?: UserAccount | null): ServerRegion | null {
  if (!account || isPrimaryAdminAccount(account)) return null;
  if (account.staffRoleTier === 'cm_br') return 'BR';
  if (account.staffRoleTier === 'cm_es') return 'ES';
  if (account.staffRoleTier === 'cm_en') return 'EN';
  return null;
}

/** Verifica se a conta tem permissão exclusiva de banimento no servidor informado */
export function canBanInServer(
  account?: UserAccount | null,
  targetServer: ServerRegion = 'BR',
): boolean {
  if (!account) return false;
  if (isPrimaryAdminAccount(account)) return true;
  const modServer = getModeratorServer(account);
  return modServer !== null && modServer === targetServer;
}

/** Verifica se a conta pode enviar avisos comunitários / eventos no servidor informado */
export function canManageCommunityInServer(
  account?: UserAccount | null,
  targetServer: ServerRegion = 'BR',
): boolean {
  if (!account) return false;
  if (isPrimaryAdminAccount(account)) return true;
  const cmServer = getCommunityManagerServer(account);
  return cmServer !== null && cmServer === targetServer;
}

/** Infere o servidor regional principal a partir do país configurado no perfil */
export function inferServerRegionFromCountry(countryCode?: string): ServerRegion {
  if (countryCode === 'ES' || countryCode === 'AR') return 'ES';
  if (countryCode === 'US') return 'EN';
  return 'BR';
}

/** Verifica compatibilidade anatômica entre o gênero da peça e o modelo de corpo da MeDoll */
export function isItemCompatibleWithGender(
  itemGender: ItemGenderStyle | undefined,
  bodyGender: AvatarGender,
): boolean {
  const resolvedItemGender = itemGender ?? 'unissex';
  if (bodyGender === 'neutro' || resolvedItemGender === 'unissex') return true;
  return resolvedItemGender === bodyGender;
}

/** Desequipa automaticamente qualquer roupa incompatível ao alternar o modelo de corpo (Masculino/Feminino) */
export function unequipIncompatibleClothes(
  equipped: EquippedOutfit,
  nextGender: AvatarGender,
  catalog: ClothingItem[],
): { nextEquipped: EquippedOutfit; removedNames: string[] } {
  const nextEquipped: EquippedOutfit = {};
  const removedNames: string[] = [];

  (Object.keys(equipped) as Array<keyof EquippedOutfit>).forEach((slot) => {
    const itemId = equipped[slot];
    if (!itemId) return;
    const item = catalog.find((c) => c.id === itemId);
    if (!item) return;
    if (isItemCompatibleWithGender(item.gender ?? item.genderStyle, nextGender)) {
      nextEquipped[slot] = itemId;
    } else {
      removedNames.push(item.name);
    }
  });

  return { nextEquipped, removedNames };
}

/** Lê peças customizadas direto do localStorage para uso em catálogos e SVGs */
export function readCustomClothingFromStorage(): ClothingItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WORLD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<WorldModerationState>;
    return Array.isArray(parsed.customClothingCatalog) ? parsed.customClothingCatalog : [];
  } catch {
    return [];
  }
}

/** Lê móveis customizados direto do localStorage */
export function readCustomFurnitureFromStorage(): FurnitureDef[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WORLD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<WorldModerationState>;
    return Array.isArray(parsed.customFurnitureCatalog) ? parsed.customFurnitureCatalog : [];
  } catch {
    return [];
  }
}

/** Lê modelos de sala customizados do localStorage */
export function readCustomRoomsFromStorage(): PurchasableRoomItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WORLD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<WorldModerationState>;
    return Array.isArray(parsed.customRoomCatalog) ? parsed.customRoomCatalog : [];
  } catch {
    return [];
  }
}

/** Lê papéis de parede customizados do localStorage */
export function readCustomWallpapersFromStorage(): PurchasableWallpaperItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WORLD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<WorldModerationState>;
    return Array.isArray(parsed.customWallpaperCatalog) ? parsed.customWallpaperCatalog : [];
  } catch {
    return [];
  }
}

const DEFAULT_ITEM_CROP_BOXES: Record<
  ClothingItem['category'],
  { x: number; y: number; width: number; height: number }
> = {
  cabelo: { x: 64, y: 18, width: 152, height: 150 },
  blusas: { x: 64, y: 130, width: 152, height: 146 },
  vestidos: { x: 56, y: 128, width: 168, height: 282 },
  calcas: { x: 64, y: 214, width: 152, height: 248 },
  sapatos: { x: 76, y: 386, width: 128, height: 122 },
  acessorios: { x: 66, y: 40, width: 148, height: 146 },
};

export function getDefaultCropBoxForItem(
  item: ClothingItem,
): { x: number; y: number; width: number; height: number } {
  if (item.crop_box) return item.crop_box;
  if (item.category === 'acessorios' && item.templateId?.includes('bolsa')) {
    return { x: 46, y: 185, width: 186, height: 180 };
  }
  return DEFAULT_ITEM_CROP_BOXES[item.category];
}

/** Retorna o catálogo unificado de vestuário (Base + Peças criadas pelo Designer Global / Admin) */
export function getFullClothingCatalog(world?: WorldModerationState): ClothingItem[] {
  const custom = world ? world.customClothingCatalog ?? [] : readCustomClothingFromStorage();
  const seen = new Set<string>();
  const combined: ClothingItem[] = [];
  for (const item of [...INITIAL_CLOTHING_CATALOG, ...custom]) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    combined.push({
      ...item,
      gender: item.gender ?? item.genderStyle ?? 'unissex',
      crop_box: getDefaultCropBoxForItem(item),
    });
  }
  return combined;
}

/** Retorna o catálogo unificado de móveis (Base + Móveis criados pelo Designer Global / Admin) */
export function getFullFurnitureCatalog(world?: WorldModerationState): FurnitureDef[] {
  const custom = world ? world.customFurnitureCatalog ?? [] : readCustomFurnitureFromStorage();
  const seen = new Set<string>();
  const combined: FurnitureDef[] = [];
  for (const furn of [...FURNITURE_CATALOG, ...custom]) {
    if (!furn || !furn.id || seen.has(furn.id)) continue;
    seen.add(furn.id);
    combined.push(furn);
  }
  return combined;
}

/** Retorna o catálogo unificado de Modelos de Sala (Comuns & VIP) */
export function getFullRoomCatalog(world?: WorldModerationState): PurchasableRoomItem[] {
  const custom = world ? world.customRoomCatalog ?? [] : readCustomRoomsFromStorage();
  const seen = new Set<string>();
  const combined: PurchasableRoomItem[] = [];
  for (const r of [...PURCHASABLE_ROOMS_CATALOG, ...custom]) {
    if (!r || !r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    combined.push(r);
  }
  return combined;
}

/** Retorna o catálogo unificado de Papéis de Parede / Planos de Fundo */
export function getFullWallpaperCatalog(
  world?: WorldModerationState,
): PurchasableWallpaperItem[] {
  const custom = world ? world.customWallpaperCatalog ?? [] : readCustomWallpapersFromStorage();
  const seen = new Set<string>();
  const combined: PurchasableWallpaperItem[] = [];
  for (const w of [...PURCHASABLE_WALLPAPERS_CATALOG, ...custom]) {
    if (!w || !w.id || seen.has(w.id)) continue;
    seen.add(w.id);
    combined.push(w);
  }
  return combined;
}

let sharedSyncChannel: BroadcastChannel | null = null;

function getSyncChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!sharedSyncChannel) {
    sharedSyncChannel = new BroadcastChannel(REALTIME_CHANNEL_NAME);
  }
  return sharedSyncChannel;
}

function postSyncMessage(
  type: 'player:sync' | 'accounts:sync' | 'world:sync' | 'dm:sync',
  detail?: Record<string, string>,
): void {
  const ch = getSyncChannel();
  if (!ch) return;
  try {
    ch.postMessage({ type, ...detail });
  } catch {
    // Silencioso se o canal estiver fechado
  }
}

/** Normaliza nome de usuário para evitar duplicidades por maiúsculas/espaços/@ */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/** Normaliza nome de exibição para validação global case-insensitive */
export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Verifica exclusividade global (case-insensitive) para username e displayName entre contas, bots e comunidade */
export function checkGlobalNameConflict(params: {
  accounts: UserAccount[];
  world: WorldModerationState;
  username: string;
  displayName: string;
  excludeAccountId?: string;
}): string | null {
  const { accounts, world, username, displayName, excludeAccountId } = params;
  const targetUser = normalizeUsername(username);
  const targetDisplay = normalizeDisplayName(displayName);

  const excludeAccount = excludeAccountId
    ? accounts.find((a) => a.id === excludeAccountId)
    : undefined;
  const excludeOldUser = excludeAccount
    ? normalizeUsername(excludeAccount.username)
    : undefined;

  const userTakenInAccounts = accounts.some(
    (a) => a.id !== excludeAccountId && normalizeUsername(a.username) === targetUser,
  );
  const userTakenInWorld = world.users.some(
    (u) =>
      u.id !== excludeAccountId &&
      (!excludeOldUser || normalizeUsername(u.username) !== excludeOldUser) &&
      normalizeUsername(u.username) === targetUser,
  );

  if (userTakenInAccounts || userTakenInWorld) {
    return `O nome de usuário "${targetUser}" já está em uso por outro jogador ou avatar.`;
  }

  const displayTakenInAccounts = accounts.some(
    (a) =>
      a.id !== excludeAccountId &&
      (normalizeDisplayName(a.displayName) === targetDisplay ||
        normalizeUsername(a.username) === targetDisplay),
  );
  const displayTakenInWorld = world.users.some(
    (u) =>
      u.id !== excludeAccountId &&
      (!excludeOldUser || normalizeUsername(u.username) !== excludeOldUser) &&
      (normalizeDisplayName(u.displayName ?? u.username) === targetDisplay ||
        normalizeUsername(u.username) === targetDisplay),
  );

  if (displayTakenInAccounts || displayTakenInWorld) {
    return `O nome "${displayName.trim()}" já está em uso por outro jogador ou avatar.`;
  }

  return null;
}

/** Obtém metadados do país configurado ou retorna Brasil (Salvador/BR) como padrão */
export function getCountryMeta(countryCode?: string): AccountCountryOption {
  return (
    ACCOUNT_COUNTRIES.find((c) => c.code === countryCode) ?? ACCOUNT_COUNTRIES[0]
  );
}

/** Gera um IP simulado determinístico baseado na conta/usuário e país selecionado */
export function generateSimulatedIp(
  seed: string,
  countryCode: string = 'BR',
): string {
  const country = getCountryMeta(countryCode);
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 65025;
  }
  const oct3 = 12 + (hash % 230);
  const oct4 = 10 + (Math.floor(hash / 230) % 235);
  return `${country.ipPrefix}.${oct3}.${oct4}`;
}

/** Cria o progresso inicial da MeDoll + Suíte conforme o gênero/avatar selecionado */
export function createDefaultPlayerState(
  avatarGender: AvatarGender = 'feminino',
  seedForIp: string = 'guest_session',
): PlayerProgressState {
  const starterIds = INITIAL_CLOTHING_CATALOG.filter((item) => item.starter).map(
    (item) => item.id,
  );

  // Look inicial adaptado ao estilo de avatar selecionado no cadastro
  const defaultEquippedByGender: Record<AvatarGender, EquippedOutfit> = {
    feminino: {
      cabelo: 'hair_ondas_mel',
      blusas: 'top_camisa_seda',
      calcas: 'bottom_saia_midi',
      sapatos: 'shoes_scarpin_preto',
    },
    masculino: {
      cabelo: 'hair_corte_executivo',
      blusas: 'top_camisa_social_azul',
      calcas: 'bottom_chino_areia',
      sapatos: 'shoes_oxford_couro',
    },
    neutro: {
      cabelo: 'hair_coque_atelier',
      blusas: 'top_camisa_seda',
      calcas: 'bottom_calca_alfaiataria',
      sapatos: 'shoes_tenis_branco',
    },
  };

  // Garante que o cabelo inicial do look neutro esteja liberado no guarda-roupa
  const initialOwned =
    avatarGender === 'neutro'
      ? Array.from(new Set([...starterIds, 'hair_coque_atelier']))
      : starterIds;

  const defaultCountry = getCountryMeta('BR');

  const starterFurnitureIds = FURNITURE_CATALOG.filter((f) => f.starter).map((f) => f.id);
  const starterRoomIds = PURCHASABLE_ROOMS_CATALOG.filter((r) => r.starter).map((r) => r.id);
  const starterWallpaperIds = PURCHASABLE_WALLPAPERS_CATALOG.filter((w) => w.starter).map(
    (w) => w.id,
  );

  return {
    starcoins: 1200,
    ownedItemIds: initialOwned,
    ownedFurnitureIds: starterFurnitureIds,
    ownedRoomTemplateIds: starterRoomIds,
    ownedWallpaperIds: starterWallpaperIds,
    equipped: defaultEquippedByGender[avatarGender],
    skinTone: 'pessego',
    avatarGender,
    avatarDisplayMode: 'medoll',
    bio: 'Explorando estilos na Starplaza e decorando minha Suíte no Starlight Atelier.',
    presenceStatus: 'online',
    countryCode: defaultCountry.code,
    timezone: defaultCountry.timezone,
    simulatedIp: generateSimulatedIp(seedForIp, defaultCountry.code),
    suite: {
      theme: 'paris_marfim',
      wallpaperId: 'wp_boiserie_marfim',
      items: DEFAULT_SUITE_ITEMS,
      avatarPos: {
        x: 292,
        y: 138,
        zIndex: 14,
        flipped: false,
      },
      lastSavedAt: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  };
}

/** Contas iniciais pré-cadastradas (Administrador Geral e bots iniciais da Staff por servidor) */
function createSeededAccounts(): UserAccount[] {
  return [
    {
      id: 'acc_admin_owner',
      username: 'vitor',
      displayName: 'Vitor',
      email: ADMIN_OWNER_EMAIL,
      password: '@manuel868673',
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'admin',
      staffRoleTitle: 'Administrador Geral',
      isVip: true,
      isPrimaryOwner: true,
      createdAt: '01/01/2025',
    },
    {
      id: 'acc_staff_bella',
      username: 'bella_mod',
      displayName: 'Bella',
      email: 'bella@starlightatelier.com',
      password: 'staff123',
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'mod_br',
      staffRoleTitle: 'Moderador (BR)',
      serverRegion: 'BR',
      isBot: true,
      botAiSpecialty: 'moderation',
      botActive: true,
      botRoamRooms: true,
      createdAt: '05/01/2025',
    },
    {
      id: 'acc_staff_kaio',
      username: 'kaio_dev',
      displayName: 'Kaio',
      email: 'kaio@starlightatelier.com',
      password: 'staff123',
      avatarGender: 'masculino',
      role: 'admin',
      staffRoleTier: 'mod_en',
      staffRoleTitle: 'Moderador (EN)',
      serverRegion: 'EN',
      isBot: true,
      botAiSpecialty: 'hybrid',
      botActive: true,
      botRoamRooms: true,
      createdAt: '10/01/2025',
    },
    {
      id: 'acc_staff_mari',
      username: 'mari_estilo',
      displayName: 'Mari',
      email: 'mari@starlightatelier.com',
      password: 'staff123',
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'mod_es',
      staffRoleTitle: 'Moderador (ES)',
      serverRegion: 'ES',
      isBot: true,
      botAiSpecialty: 'moderation',
      botActive: true,
      botRoamRooms: true,
      createdAt: '15/01/2025',
    },
    {
      id: 'acc_staff_lucas',
      username: 'lucas_eventos',
      displayName: 'Lucas',
      email: 'lucas@starlightatelier.com',
      password: 'staff123',
      avatarGender: 'masculino',
      role: 'admin',
      staffRoleTier: 'cm_br',
      staffRoleTitle: 'Gerente da Comunidade (BR)',
      serverRegion: 'BR',
      isBot: true,
      botAiSpecialty: 'hybrid',
      botActive: true,
      botRoamRooms: true,
      createdAt: '18/01/2025',
    },
    {
      id: 'acc_staff_celine',
      username: 'celine_atelier',
      displayName: 'Celine',
      email: 'celine@starlightatelier.com',
      password: 'staff123',
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'designer_global',
      staffRoleTitle: 'Designer Global',
      isVip: true,
      isBot: true,
      botAiSpecialty: 'designer',
      botActive: true,
      botRoamRooms: true,
      createdAt: '20/01/2025',
    },
    {
      id: 'acc_staff_sofia_cm',
      username: 'sofia_comunidad',
      displayName: 'Sofía',
      email: 'sofia@starlightatelier.com',
      password: 'staff123',
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'cm_es',
      staffRoleTitle: 'Gerente da Comunidade (ES)',
      serverRegion: 'ES',
      isBot: true,
      botAiSpecialty: 'hybrid',
      botActive: true,
      botRoamRooms: true,
      createdAt: '22/01/2025',
    },
    {
      id: 'acc_staff_alex_cm',
      username: 'alex_community',
      displayName: 'Alex',
      email: 'alex@starlightatelier.com',
      password: 'staff123',
      avatarGender: 'masculino',
      role: 'admin',
      staffRoleTier: 'cm_en',
      staffRoleTitle: 'Gerente da Comunidade (EN)',
      serverRegion: 'EN',
      isBot: true,
      botAiSpecialty: 'hybrid',
      botActive: true,
      botRoamRooms: true,
      createdAt: '24/01/2025',
    },
  ];
}

function getRemovedStaffIds(): string[] {
  try {
    const raw = window.localStorage.getItem(REMOVED_STAFF_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function addRemovedStaffId(accountId: string): void {
  try {
    const current = getRemovedStaffIds();
    if (!current.includes(accountId)) {
      window.localStorage.setItem(
        REMOVED_STAFF_IDS_KEY,
        JSON.stringify([...current, accountId]),
      );
    }
  } catch {
    // Silencioso
  }
}

function clearRemovedStaffId(accountId: string): void {
  try {
    const current = getRemovedStaffIds();
    if (current.includes(accountId)) {
      window.localStorage.setItem(
        REMOVED_STAFF_IDS_KEY,
        JSON.stringify(current.filter((id) => id !== accountId)),
      );
    }
  } catch {
    // Silencioso
  }
}

/** Garante que cada membro inicial da Staff tenha sua MeDoll e bio persistidas como conta real */
function ensureSeededStaffProgress(accounts: UserAccount[]): void {
  if (typeof window === 'undefined') return;
  for (const staff of DEFAULT_STAFF_MEMBERS) {
    const account = accounts.find(
      (a) =>
        (staff.accountId && a.id === staff.accountId) ||
        normalizeUsername(a.username) === normalizeUsername(staff.username),
    );
    if (!account) continue;

    const storageKey = `${PLAYER_PREFIX}${account.id}`;
    try {
      if (!window.localStorage.getItem(storageKey)) {
        const base = createDefaultPlayerState(staff.avatarGender, account.id);
        const equippedIds = Object.values(staff.equipped).filter(
          (v): v is string => Boolean(v),
        );
        const seededProgress: PlayerProgressState = {
          ...base,
          starcoins: staff.roleTier === 'admin' ? 4500 : 2200,
          ownedItemIds: Array.from(new Set([...base.ownedItemIds, ...equippedIds])),
          equipped: { ...staff.equipped },
          skinTone: staff.skinTone,
          avatarGender: staff.avatarGender,
          avatarDisplayMode: 'medoll',
          bio: staff.bio,
          presenceStatus: staff.status === 'ausente' ? 'ausente' : 'online',
        };
        window.localStorage.setItem(storageKey, JSON.stringify(seededProgress));
      }
    } catch {
      // Silencioso em modo restrito
    }
  }
}

/** Estado compartilhado padrão da sala e moderação */
export function createDefaultWorldState(): WorldModerationState {
  const seededAccounts = createSeededAccounts();
  const seededStaffUsers: MockUser[] = seededAccounts.map((acc) => ({
    id: acc.id,
    username: normalizeUsername(acc.username),
    displayName: acc.displayName,
    level: acc.staffRoleTier === 'admin' ? 50 : 38,
    starcoins: acc.staffRoleTier === 'admin' ? 4500 : 2200,
    status: 'active',
    joinedAt: acc.createdAt,
    role: acc.role,
    staffRoleTier: acc.staffRoleTier,
    serverRegion: acc.serverRegion,
    isVip: Boolean(acc.isVip),
    isPrimaryOwner: acc.isPrimaryOwner,
  }));

  return {
    globalNotice:
      'Bem-vinda ao Starlight Atelier! Nova coleção Boutique VIP disponível na Starplaza.',
    serverNotices: {
      BR: 'Evento da Semana BR: Desfile Editorial na Festa na Cobertura hoje às 20h!',
      ES: 'Evento ES: Encuentro de looks vintage en el Salón Principal ES.',
      EN: 'EN Community Event: Rooftop Fashion Meetup open all day!',
    },
    users: [...seededStaffUsers, ...DEFAULT_MOCK_USERS],
    deletedItemIds: [],
    customClothingCatalog: [],
    customFurnitureCatalog: [],
    customRoomCatalog: [],
    customWallpaperCatalog: [],
    mutedUsers: {},
    warningCounts: {},
    reports: [],
    bannedWords: DEFAULT_BANNED_WORDS,
    newsPosts: INITIAL_NEWS_POSTS,
    lastDesignerCreationAt: Date.now(),
    lastWeeklyVipReleaseAt: Date.now(),
    lastDesignerAuditAt: Date.now(),
  };
}

const LEGACY_ROLE_TITLES = new Set([
  'Fundadora / Administradora Geral',
  'Administrador Geral (Fundador)',
  'Moderador do Servidor Brasileiro',
  'Moderadora do Servidor Brasileiro',
  'Moderador (BR) — Servidor Brasileiro',
  'Moderador do Servidor Espanhol',
  'Moderadora do Servidor Espanhol',
  'Moderador (ES) — Servidor Espanhol',
  'Moderador do Servidor em Inglês',
  'Moderador (EN) — Servidor em Inglês',
  'Engenheiro & Mod do Servidor Inglês',
  'Gerente da Comunidade (BR) — Servidor Brasileiro',
  'Gerente da Comunidade (ES) — Servidor Espanhol',
  'Gerente da Comunidade (EN) — Servidor em Inglês',
]);

/** Carrega todas as contas cadastradas no localStorage (Fonte Única de Verdade) */
export function loadAccounts(): UserAccount[] {
  const seeded = createSeededAccounts();
  const removedIds = getRemovedStaffIds();

  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seeded));
      ensureSeededStaffProgress(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Array<Partial<UserAccount>>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seeded));
      ensureSeededStaffProgress(seeded);
      return seeded;
    }

    let changed = false;
    const merged: UserAccount[] = parsed.map((rawAcc) => {
      const seedMatch = seeded.find(
        (s) =>
          s.id === rawAcc.id ||
          (rawAcc.isPrimaryOwner && s.isPrimaryOwner) ||
          (rawAcc.username && normalizeUsername(s.username) === normalizeUsername(rawAcc.username)),
      );
      const isPrimaryOwner =
        Boolean(rawAcc.isPrimaryOwner) || rawAcc.id === 'acc_admin_owner';
      const cleanUsername = normalizeUsername(rawAcc.username ?? 'estilista');
      const displayName =
        typeof rawAcc.displayName === 'string' && rawAcc.displayName.trim()
          ? rawAcc.displayName
          : seedMatch?.displayName ?? cleanUsername;

      const rawTierStr = rawAcc.staffRoleTier as string | undefined;
      const normalizedTier = normalizeStaffTier(rawTierStr) ?? seedMatch?.staffRoleTier;
      const staffRoleTier = isPrimaryOwner ? 'admin' : normalizedTier;
      const serverRegion =
        staffRoleTier === 'admin' || staffRoleTier === 'designer_global'
          ? undefined
          : rawAcc.serverRegion ??
            (staffRoleTier ? STAFF_ROLE_SERVER_MAP[staffRoleTier] : undefined);

      const wasLegacyTier =
        rawTierStr === 'moderator' ||
        rawTierStr === 'developer' ||
        rawTierStr === 'curator';
      const hasLegacyTitle =
        typeof rawAcc.staffRoleTitle === 'string' &&
        LEGACY_ROLE_TITLES.has(rawAcc.staffRoleTitle);

      const staffRoleTitle =
        !wasLegacyTier && !hasLegacyTitle && rawAcc.staffRoleTitle
          ? rawAcc.staffRoleTitle
          : staffRoleTier
            ? DEFAULT_STAFF_ROLE_TITLES[staffRoleTier]
            : undefined;

      const isBot =
        typeof rawAcc.isBot === 'boolean'
          ? rawAcc.isBot
          : Boolean(seedMatch?.isBot);
      const botAiSpecialty: BotAiSpecialty | undefined = isBot
        ? rawAcc.botAiSpecialty ??
          seedMatch?.botAiSpecialty ??
          (staffRoleTier === 'designer_global' ? 'designer' : 'hybrid')
        : rawAcc.botAiSpecialty;
      const botActive = isBot
        ? typeof rawAcc.botActive === 'boolean'
          ? rawAcc.botActive
          : true
        : rawAcc.botActive;
      const botRoamRooms = isBot
        ? typeof rawAcc.botRoamRooms === 'boolean'
          ? rawAcc.botRoamRooms
          : true
        : rawAcc.botRoamRooms;
      const isVip =
        typeof rawAcc.isVip === 'boolean'
          ? rawAcc.isVip
          : isPrimaryOwner || staffRoleTier === 'designer_global' || Boolean(seedMatch?.isVip);

      const resolvedEmail = isPrimaryOwner
        ? ADMIN_OWNER_EMAIL
        : rawAcc.email ?? 'estilista@starlightatelier.com';

      if (
        rawAcc.displayName !== displayName ||
        Boolean(rawAcc.isPrimaryOwner) !== isPrimaryOwner ||
        rawAcc.email !== resolvedEmail ||
        rawAcc.staffRoleTier !== staffRoleTier ||
        rawAcc.staffRoleTitle !== staffRoleTitle ||
        rawAcc.serverRegion !== serverRegion ||
        rawAcc.botAiSpecialty !== botAiSpecialty ||
        rawAcc.botActive !== botActive ||
        rawAcc.botRoamRooms !== botRoamRooms ||
        rawAcc.isVip !== isVip
      ) {
        changed = true;
      }

      return {
        id: rawAcc.id ?? `acc_${Date.now()}`,
        username: rawAcc.username ?? 'estilista',
        displayName,
        email: resolvedEmail,
        password: rawAcc.password ?? '',
        avatarGender: rawAcc.avatarGender ?? 'feminino',
        role: isPrimaryOwner || staffRoleTier ? 'admin' : rawAcc.role ?? 'player',
        staffRoleTier,
        staffRoleTitle,
        serverRegion,
        isVip,
        isBot,
        botAiSpecialty,
        botActive,
        botRoamRooms,
        isPrimaryOwner,
        createdAt: rawAcc.createdAt ?? new Date().toLocaleDateString('pt-BR'),
      };
    });

    // Garante que apenas contas iniciais NÃO removidas pelo Admin sejam inseridas
    for (const seedAcc of seeded) {
      if (!seedAcc.isPrimaryOwner && removedIds.includes(seedAcc.id)) {
        continue;
      }
      const exists = merged.some(
        (a) =>
          a.id === seedAcc.id ||
          (seedAcc.isPrimaryOwner && a.isPrimaryOwner) ||
          normalizeUsername(a.username) === normalizeUsername(seedAcc.username),
      );
      if (!exists) {
        merged.push(seedAcc);
        changed = true;
      }
    }

    if (changed) {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(merged));
    }
    ensureSeededStaffProgress(merged);
    return merged;
  } catch {
    ensureSeededStaffProgress(seeded);
    return seeded;
  }
}

function saveAccounts(accounts: UserAccount[]): void {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Silencioso em modo restrito
  }
  postSyncMessage('accounts:sync');
  emitStatePatchToServer({ accounts });
}

/** Carrega estado compartilhado de moderação sincronizado com as contas reais */
export function loadWorldState(): WorldModerationState {
  const accounts = loadAccounts();
  const removedIds = getRemovedStaffIds();
  const fallback = createDefaultWorldState();
  try {
    const raw = window.localStorage.getItem(WORLD_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<WorldModerationState>;

    const baseUsers = Array.isArray(parsed.users)
      ? parsed.users.filter((u) => !removedIds.includes(u.id))
      : [...fallback.users];

    const existingUsers: MockUser[] = baseUsers.map((u) => {
      const normalizedTier = normalizeStaffTier(u.staffRoleTier as string | undefined);
      const serverRegion =
        u.serverRegion ??
        (normalizedTier && STAFF_ROLE_SERVER_MAP[normalizedTier]) ??
        inferServerRegionFromCountry(u.countryCode);
      return {
        ...u,
        username: normalizeUsername(u.username),
        staffRoleTier: normalizedTier,
        serverRegion,
      };
    });

      // Sincroniza todas as contas registradas (matching por ID primeiro para preservar edições de username)
    for (const acc of accounts) {
      const existingIdx = existingUsers.findIndex(
        (u) =>
          u.id === acc.id ||
          normalizeUsername(u.username) === normalizeUsername(acc.username),
      );
      if (existingIdx === -1) {
        existingUsers.unshift({
          id: acc.id,
          username: normalizeUsername(acc.username),
          displayName: acc.displayName,
          level: acc.staffRoleTier === 'admin' ? 50 : acc.staffRoleTier ? 38 : 1,
          starcoins: acc.staffRoleTier === 'admin' ? 4500 : 1200,
          status: 'active',
          joinedAt: acc.createdAt,
          role: acc.role,
          staffRoleTier: acc.staffRoleTier,
          serverRegion: acc.serverRegion,
          isVip: isVipAccount(acc),
          isPrimaryOwner: acc.isPrimaryOwner,
        });
      } else {
        existingUsers[existingIdx] = {
          ...existingUsers[existingIdx],
          id: acc.id,
          username: normalizeUsername(acc.username),
          displayName: acc.displayName,
          role: acc.role,
          staffRoleTier: acc.staffRoleTier,
          serverRegion: acc.serverRegion ?? existingUsers[existingIdx].serverRegion,
          isVip: isVipAccount(acc) || Boolean(existingUsers[existingIdx].isVip),
          isPrimaryOwner: acc.isPrimaryOwner,
        };
      }
    }

    return {
      globalNotice:
        typeof parsed.globalNotice === 'string'
          ? parsed.globalNotice
          : fallback.globalNotice,
      serverNotices: parsed.serverNotices ?? fallback.serverNotices,
      users: existingUsers,
      deletedItemIds: Array.isArray(parsed.deletedItemIds)
        ? parsed.deletedItemIds
        : [],
      customClothingCatalog: Array.isArray(parsed.customClothingCatalog)
        ? parsed.customClothingCatalog
        : [],
      customFurnitureCatalog: Array.isArray(parsed.customFurnitureCatalog)
        ? parsed.customFurnitureCatalog
        : [],
      customRoomCatalog: Array.isArray(parsed.customRoomCatalog)
        ? parsed.customRoomCatalog
        : [],
      customWallpaperCatalog: Array.isArray(parsed.customWallpaperCatalog)
        ? parsed.customWallpaperCatalog
        : [],
      mutedUsers:
        parsed.mutedUsers && typeof parsed.mutedUsers === 'object'
          ? parsed.mutedUsers
          : {},
      warningCounts:
        parsed.warningCounts && typeof parsed.warningCounts === 'object'
          ? parsed.warningCounts
          : {},
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      bannedWords: Array.isArray(parsed.bannedWords)
        ? parsed.bannedWords
        : fallback.bannedWords,
      newsPosts:
        Array.isArray(parsed.newsPosts) && parsed.newsPosts.length > 0
          ? parsed.newsPosts
          : fallback.newsPosts,
      lastDesignerCreationAt:
        typeof parsed.lastDesignerCreationAt === 'number'
          ? parsed.lastDesignerCreationAt
          : fallback.lastDesignerCreationAt,
      lastWeeklyVipReleaseAt:
        typeof parsed.lastWeeklyVipReleaseAt === 'number'
          ? parsed.lastWeeklyVipReleaseAt
          : fallback.lastWeeklyVipReleaseAt,
      lastDesignerAuditAt:
        typeof parsed.lastDesignerAuditAt === 'number'
          ? parsed.lastDesignerAuditAt
          : fallback.lastDesignerAuditAt,
    };
  } catch {
    return fallback;
  }
}

export function saveWorldState(world: WorldModerationState): void {
  try {
    const serialized = JSON.stringify(world);
    if (window.localStorage.getItem(WORLD_KEY) === serialized) {
      return;
    }
    window.localStorage.setItem(WORLD_KEY, serialized);
  } catch {
    // Ignorar falha de armazenamento
  }
  postSyncMessage('world:sync');
  emitStatePatchToServer({ worldState: world });
}

/** Localiza uma conta registrada pelo ID ou pelo username */
export function getAccountByIdOrUsername(
  accountId?: string,
  username?: string,
): UserAccount | undefined {
  const accounts = loadAccounts();
  if (accountId) {
    const byId = accounts.find((a) => a.id === accountId);
    if (byId) return byId;
  }
  if (username) {
    const target = normalizeUsername(username);
    return accounts.find((a) => normalizeUsername(a.username) === target);
  }
  return undefined;
}

/**
 * Obtém o progresso visual atual (MeDoll, roupas, tom de pele e foto) salvo na conta.
 */
export function getAccountLiveProgress(
  accountId?: string,
  username?: string,
  fallbackAppearance?: {
    skinTone: SkinToneId;
    avatarGender: AvatarGender;
    equipped: EquippedOutfit;
  },
): PlayerProgressState {
  const account = getAccountByIdOrUsername(accountId, username);
  if (account) {
    return loadPlayerProgress(account.id, account.avatarGender);
  }
  const base = createDefaultPlayerState(
    fallbackAppearance?.avatarGender ?? 'feminino',
    accountId ?? username ?? 'community_user',
  );
  if (!fallbackAppearance) return base;
  return {
    ...base,
    skinTone: fallbackAppearance.skinTone,
    avatarGender: fallbackAppearance.avatarGender,
    equipped: fallbackAppearance.equipped,
  };
}

export interface StaffAccountProfile {
  account: UserAccount;
  progress: PlayerProgressState;
}

const STAFF_TIER_ORDER: Record<StaffRoleTier, number> = {
  admin: 0,
  mod_br: 1,
  mod_es: 2,
  mod_en: 3,
  cm_br: 4,
  cm_es: 5,
  cm_en: 6,
  designer_global: 7,
};

/**
 * Fonte Única de Verdade para a aba "Equipe de Moderação e Staff":
 * filtra dinamicamente todas as contas registradas que possuem cargo de Staff
 * e retorna seus dados reais (nome, @username, bio, status e avatar).
 */
export function getStaffAccountsWithProgress(liveOverride?: {
  accountId?: string;
  playerState: PlayerProgressState;
}): StaffAccountProfile[] {
  const accounts = loadAccounts();
  const staffAccounts = accounts.filter(
    (acc) => acc.role === 'admin' || Boolean(acc.staffRoleTier),
  );

  staffAccounts.sort((a, b) => {
    if (a.isPrimaryOwner && !b.isPrimaryOwner) return -1;
    if (!a.isPrimaryOwner && b.isPrimaryOwner) return 1;
    const tierA = STAFF_TIER_ORDER[a.staffRoleTier ?? 'admin'] ?? 9;
    const tierB = STAFF_TIER_ORDER[b.staffRoleTier ?? 'admin'] ?? 9;
    if (tierA !== tierB) return tierA - tierB;
    return a.username.localeCompare(b.username);
  });

  return staffAccounts.map((account) => {
    const isLive = liveOverride?.accountId === account.id;
    const progress = isLive
      ? liveOverride.playerState
      : loadPlayerProgress(account.id, account.avatarGender);
    return { account, progress };
  });
}

/**
 * Atualiza username e Nome de Exibição da conta no localStorage (Fonte Única de Verdade)
 * aplicando exclusividade global (case-insensitive) e taxa obrigatória de 500 SC (quando player altera).
 */
export function updateAccountIdentity(
  accountId: string,
  input: { username: string; displayName: string; chargeFee?: boolean },
):
  | {
      ok: true;
      account: UserAccount;
      world: WorldModerationState;
      progress: PlayerProgressState;
      feeCharged: number;
    }
  | { ok: false; error: string } {
  const nextUsername = normalizeUsername(input.username);
  const nextDisplayName = input.displayName.trim().replace(/\s+/g, ' ');
  const shouldChargeFee = input.chargeFee !== false;

  if (nextDisplayName.length < 2 || nextDisplayName.length > 40) {
    return {
      ok: false,
      error: 'O nome de exibição deve ter entre 2 e 40 caracteres.',
    };
  }
  if (nextUsername.length < 3 || nextUsername.length > 24) {
    return {
      ok: false,
      error: 'O nome de usuário deve ter entre 3 e 24 caracteres.',
    };
  }
  if (!/^[a-z0-9_]+$/.test(nextUsername)) {
    return {
      ok: false,
      error: 'Use apenas letras minúsculas, números ou underline (_) no nome de usuário.',
    };
  }

  const accounts = loadAccounts();
  const targetAccount = accounts.find((a) => a.id === accountId);
  if (!targetAccount) {
    return { ok: false, error: 'Conta não encontrada no armazenamento local.' };
  }

  const oldUsername = normalizeUsername(targetAccount.username);
  const oldDisplayNorm = normalizeDisplayName(targetAccount.displayName);
  const nextDisplayNorm = normalizeDisplayName(nextDisplayName);
  const hasChanged = nextUsername !== oldUsername || nextDisplayNorm !== oldDisplayNorm;

  if (shouldChargeFee && !hasChanged) {
    return {
      ok: false,
      error: `Nenhuma alteração detectada. Modifique o nome para aplicar a taxa de ${NAME_CHANGE_FEE_SC} SC.`,
    };
  }

  const world = loadWorldState();
  const conflictError = checkGlobalNameConflict({
    accounts,
    world,
    username: nextUsername,
    displayName: nextDisplayName,
    excludeAccountId: accountId,
  });
  if (conflictError) {
    return { ok: false, error: conflictError };
  }

  const currentProgress = loadPlayerProgress(accountId, targetAccount.avatarGender);
  const feeToDeduct = shouldChargeFee && hasChanged ? NAME_CHANGE_FEE_SC : 0;

  if (feeToDeduct > 0 && currentProgress.starcoins < feeToDeduct) {
    return {
      ok: false,
      error: `Saldo insuficiente! Alterar o nome do avatar exige ${NAME_CHANGE_FEE_SC} SC (seu saldo: ${currentProgress.starcoins} SC).`,
    };
  }

  const nextProgress: PlayerProgressState =
    feeToDeduct > 0
      ? { ...currentProgress, starcoins: currentProgress.starcoins - feeToDeduct }
      : currentProgress;

  if (feeToDeduct > 0) {
    savePlayerProgress(accountId, nextProgress);
  }

  const updatedAccount: UserAccount = {
    ...targetAccount,
    username: nextUsername,
    displayName: nextDisplayName,
  };

  saveAccounts(
    accounts.map((a) => (a.id === accountId ? updatedAccount : a)),
  );

  // Atualiza lista de usuários no estado compartilhado
  const nextWorld: WorldModerationState = {
    ...world,
    users: world.users.map((u) =>
      u.id === accountId || normalizeUsername(u.username) === oldUsername
        ? {
            ...u,
            id: accountId,
            username: nextUsername,
            displayName: nextDisplayName,
            starcoins: nextProgress.starcoins,
          }
        : u,
    ),
  };
  saveWorldState(nextWorld);

  // Se o @username mudou, atualiza referências em DMs, salas e lista de amigos
  if (oldUsername !== nextUsername && typeof window !== 'undefined') {
    try {
      const rawDms = window.localStorage.getItem(DMS_KEY);
      if (rawDms) {
        const parsedDms = JSON.parse(rawDms) as PrivateMessage[];
        if (Array.isArray(parsedDms)) {
          const updatedDms = parsedDms.map((m) => ({
            ...m,
            fromUsername:
              normalizeUsername(m.fromUsername) === oldUsername
                ? nextUsername
                : m.fromUsername,
            toUsername:
              normalizeUsername(m.toUsername) === oldUsername
                ? nextUsername
                : m.toUsername,
          }));
          window.localStorage.setItem(DMS_KEY, JSON.stringify(updatedDms));
          postSyncMessage('dm:sync');
        }
      }
    } catch {
      // Silencioso
    }

    try {
      const rawRooms = window.localStorage.getItem(ROOMS_STORAGE_KEY);
      if (rawRooms) {
        const parsedRooms = JSON.parse(rawRooms) as {
          presences?: Record<string, RoomAvatarPresence>;
          messagesByRoom?: Record<string, RoomChatMessage[]>;
          customRooms?: RoomDef[];
          kicks?: unknown[];
        };
        const nextCustomRooms = Array.isArray(parsedRooms.customRooms)
          ? parsedRooms.customRooms.map((r) =>
              r.creatorUsername && normalizeUsername(r.creatorUsername) === oldUsername
                ? { ...r, creatorUsername: nextUsername }
                : r,
            )
          : [];
        const nextPresences = parsedRooms.presences ? { ...parsedRooms.presences } : {};
        Object.keys(nextPresences).forEach((cid) => {
          if (normalizeUsername(nextPresences[cid].username) === oldUsername) {
            nextPresences[cid] = { ...nextPresences[cid], username: nextUsername };
          }
        });
        window.localStorage.setItem(
          ROOMS_STORAGE_KEY,
          JSON.stringify({
            ...parsedRooms,
            presences: nextPresences,
            customRooms: nextCustomRooms,
          }),
        );
      }
    } catch {
      // Silencioso
    }

    for (const acc of accounts) {
      if (acc.id === accountId) continue;
      const prog = loadPlayerProgress(acc.id, acc.avatarGender);
      if (prog.friendUsernames?.includes(oldUsername)) {
        savePlayerProgress(acc.id, {
          ...prog,
          friendUsernames: prog.friendUsernames.map((f) =>
            f === oldUsername ? nextUsername : f,
          ),
        });
      }
    }
  }

  return {
    ok: true,
    account: updatedAccount,
    world: nextWorld,
    progress: nextProgress,
    feeCharged: feeToDeduct,
  };
}

/**
 * Cria um novo membro/bot da Staff do zero (exclusivo do Administrador).
 */
export function createStaffAccount(input: {
  displayName: string;
  username: string;
  bio: string;
  staffRoleTier: StaffRoleTier;
  staffRoleTitle?: string;
  presenceStatus: PresenceStatus;
  avatarGender: AvatarGender;
  skinTone: SkinToneId;
  equipped: EquippedOutfit;
  customAvatarUrl?: string;
  avatarDisplayMode: AvatarDisplayMode;
  botAiSpecialty?: BotAiSpecialty;
  botActive?: boolean;
  botRoamRooms?: boolean;
  isVip?: boolean;
}):
  | { ok: true; account: UserAccount; world: WorldModerationState }
  | { ok: false; error: string } {
  const normalizedUsername = normalizeUsername(input.username);
  const trimmedDisplay = input.displayName.trim();

  if (trimmedDisplay.length < 2 || trimmedDisplay.length > 40) {
    return { ok: false, error: 'O nome de exibição deve ter entre 2 e 40 caracteres.' };
  }
  if (normalizedUsername.length < 3 || normalizedUsername.length > 24) {
    return { ok: false, error: 'O nome de usuário deve ter entre 3 e 24 caracteres.' };
  }
  if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
    return {
      ok: false,
      error: 'Use apenas letras minúsculas, números ou underline (_) no nome de usuário.',
    };
  }

  const accounts = loadAccounts();
  const world = loadWorldState();

  const conflictError = checkGlobalNameConflict({
    accounts,
    world,
    username: normalizedUsername,
    displayName: trimmedDisplay,
  });

  if (conflictError) {
    return {
      ok: false,
      error: conflictError,
    };
  }

  const serverRegion = STAFF_ROLE_SERVER_MAP[input.staffRoleTier];
  const newAccount: UserAccount = {
    id: `acc_bot_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    username: normalizedUsername,
    displayName: trimmedDisplay,
    email: `${normalizedUsername}@starlightatelier.com`,
    password: 'staff123',
    avatarGender: input.avatarGender,
    role: 'admin',
    staffRoleTier: input.staffRoleTier,
    staffRoleTitle:
      input.staffRoleTitle?.trim() || DEFAULT_STAFF_ROLE_TITLES[input.staffRoleTier],
    serverRegion,
    isVip:
      input.isVip ??
      (input.staffRoleTier === 'admin' || input.staffRoleTier === 'designer_global'),
    isBot: true,
    botAiSpecialty:
      input.botAiSpecialty ??
      (input.staffRoleTier === 'designer_global' ? 'designer' : 'hybrid'),
    botActive: input.botActive ?? true,
    botRoamRooms: input.botRoamRooms ?? true,
    createdAt: new Date().toLocaleDateString('pt-BR'),
  };

  saveAccounts([...accounts, newAccount]);

  const baseProgress = createDefaultPlayerState(input.avatarGender, newAccount.id);
  const equippedIds = Object.values(input.equipped).filter((v): v is string => Boolean(v));
  const countryByServer = serverRegion === 'ES' ? 'ES' : serverRegion === 'EN' ? 'US' : 'BR';
  const countryMeta = getCountryMeta(countryByServer);

  const staffProgress: PlayerProgressState = {
    ...baseProgress,
    starcoins: input.staffRoleTier === 'admin' ? 4000 : 2500,
    ownedItemIds: Array.from(new Set([...baseProgress.ownedItemIds, ...equippedIds])),
    equipped: { ...input.equipped },
    skinTone: input.skinTone,
    avatarGender: input.avatarGender,
    customAvatarUrl: input.customAvatarUrl,
    avatarDisplayMode:
      input.avatarDisplayMode === 'photo' && input.customAvatarUrl ? 'photo' : 'medoll',
    bio: input.bio.trim() || 'Integrante oficial da equipe Starlight Atelier.',
    presenceStatus: input.presenceStatus,
    countryCode: countryMeta.code,
    timezone: countryMeta.timezone,
    simulatedIp: generateSimulatedIp(newAccount.id, countryMeta.code),
  };

  savePlayerProgress(newAccount.id, staffProgress);

  const nextWorld: WorldModerationState = {
    ...world,
    users: [
      {
        id: newAccount.id,
        username: newAccount.username,
        displayName: newAccount.displayName,
        level: 38,
        starcoins: staffProgress.starcoins,
        status: 'active',
        joinedAt: newAccount.createdAt,
        role: 'admin',
        staffRoleTier: newAccount.staffRoleTier,
        serverRegion: newAccount.serverRegion,
        isVip: newAccount.isVip,
        countryCode: countryMeta.code,
        simulatedIp: staffProgress.simulatedIp,
      },
      ...world.users,
    ],
  };
  saveWorldState(nextWorld);

  return { ok: true, account: newAccount, world: nextWorld };
}

/**
 * Permite ao Administrador editar livremente qualquer perfil de bot/membro da Staff
 * (nome, nome de usuário, bio, foto de perfil, roupas/MeDoll, status e servidor de atuação).
 */
export function updateStaffProfileByAdmin(
  accountId: string,
  input: {
    displayName: string;
    username: string;
    bio: string;
    staffRoleTier: StaffRoleTier;
    staffRoleTitle?: string;
    presenceStatus: PresenceStatus;
    avatarGender: AvatarGender;
    skinTone: SkinToneId;
    equipped: EquippedOutfit;
    customAvatarUrl?: string;
    avatarDisplayMode: AvatarDisplayMode;
    botAiSpecialty?: BotAiSpecialty;
    botActive?: boolean;
    botRoamRooms?: boolean;
    isVip?: boolean;
  },
):
  | { ok: true; account: UserAccount; progress: PlayerProgressState; world: WorldModerationState }
  | { ok: false; error: string } {
  const identityRes = updateAccountIdentity(accountId, {
    username: input.username,
    displayName: input.displayName,
    chargeFee: false,
  });
  if (!identityRes.ok) {
    return identityRes;
  }

  const accounts = loadAccounts();
  const target = accounts.find((a) => a.id === accountId);
  if (!target) {
    return { ok: false, error: 'Conta da Staff não encontrada.' };
  }

  const isOwner = Boolean(target.isPrimaryOwner) || target.id === 'acc_admin_owner';
  const nextTier: StaffRoleTier = isOwner ? 'admin' : input.staffRoleTier;
  const nextServer = isOwner ? undefined : STAFF_ROLE_SERVER_MAP[nextTier];
  const nextTitle =
    input.staffRoleTitle?.trim() || DEFAULT_STAFF_ROLE_TITLES[nextTier];
  const nextRoamRooms = target.isBot
    ? input.botRoamRooms ?? target.botRoamRooms ?? true
    : target.botRoamRooms;

  const updatedAccount: UserAccount = {
    ...target,
    avatarGender: input.avatarGender,
    role: 'admin',
    staffRoleTier: nextTier,
    staffRoleTitle: nextTitle,
    serverRegion: nextServer,
    isVip:
      input.isVip ??
      (isOwner || nextTier === 'designer_global' ? true : target.isVip),
    botAiSpecialty: target.isBot
      ? input.botAiSpecialty ??
        target.botAiSpecialty ??
        (nextTier === 'designer_global' ? 'designer' : 'hybrid')
      : target.botAiSpecialty,
    botActive: target.isBot ? input.botActive ?? target.botActive ?? true : target.botActive,
    botRoamRooms: nextRoamRooms,
  };

  saveAccounts(accounts.map((a) => (a.id === accountId ? updatedAccount : a)));

  if (target.isBot && !nextRoamRooms) {
    removeBotPresenceFromRoomsStorage(accountId);
  }

  const currentProgress = loadPlayerProgress(accountId, input.avatarGender);
  const equippedIds = Object.values(input.equipped).filter((v): v is string => Boolean(v));
  const updatedProgress: PlayerProgressState = {
    ...currentProgress,
    bio: input.bio.trim(),
    presenceStatus: input.presenceStatus,
    avatarGender: input.avatarGender,
    skinTone: input.skinTone,
    equipped: { ...input.equipped },
    ownedItemIds: Array.from(new Set([...currentProgress.ownedItemIds, ...equippedIds])),
    customAvatarUrl: input.customAvatarUrl,
    avatarDisplayMode:
      input.avatarDisplayMode === 'photo' && input.customAvatarUrl ? 'photo' : 'medoll',
  };
  savePlayerProgress(accountId, updatedProgress);

  const freshWorld = loadWorldState();
  const nextWorld: WorldModerationState = {
    ...freshWorld,
    users: freshWorld.users.map((u) =>
      u.id === accountId
        ? {
            ...u,
            username: updatedAccount.username,
            displayName: updatedAccount.displayName,
            role: 'admin',
            staffRoleTier: updatedAccount.staffRoleTier,
            serverRegion: updatedAccount.serverRegion,
            isVip: isVipAccount(updatedAccount),
          }
        : u,
    ),
  };
  saveWorldState(nextWorld);

  return {
    ok: true,
    account: updatedAccount,
    progress: updatedProgress,
    world: nextWorld,
  };
}

function removeBotPresenceFromRoomsStorage(accountId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    if (!raw) return;
    const snap = JSON.parse(raw) as {
      presences?: Record<string, RoomAvatarPresence>;
      messagesByRoom?: Record<string, RoomChatMessage[]>;
      customRooms?: RoomDef[];
      kicks?: unknown[];
    };
    const botClientId = `bot_live_${accountId}`;
    if (snap.presences && snap.presences[botClientId]) {
      delete snap.presences[botClientId];
      window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(snap));
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel(REALTIME_CHANNEL_NAME);
        ch.postMessage({ type: 'rooms:sync', snapshot: snap });
        ch.close();
      }
    }
  } catch {
    // Silencioso
  }
}

/** Alterna se um Bot circula livremente pelas salas públicas ou fica offline/fora das salas */
export function toggleBotRoamRooms(accountId: string): UserAccount | null {
  const accounts = loadAccounts();
  let updated: UserAccount | null = null;
  const nextAccounts = accounts.map((acc) => {
    if (acc.id !== accountId || !acc.isBot) return acc;
    const nextRoam = acc.botRoamRooms === false;
    updated = { ...acc, botRoamRooms: nextRoam };
    return updated;
  });
  if (updated) {
    saveAccounts(nextAccounts);
    if (!(updated as UserAccount).botRoamRooms) {
      removeBotPresenceFromRoomsStorage(accountId);
    }
  }
  return updated;
}

/** Alterna o status VIP de uma conta ou usuário da comunidade */
export function toggleUserVipStatus(userId: string): WorldModerationState {
  const accounts = loadAccounts();
  const world = loadWorldState();
  const targetUser = world.users.find((u) => u.id === userId);
  const targetAcc = accounts.find(
    (a) =>
      a.id === userId ||
      (targetUser && normalizeUsername(a.username) === normalizeUsername(targetUser.username)),
  );

  const currentVip = Boolean(targetAcc?.isVip ?? targetUser?.isVip);
  const nextVip = !currentVip;

  if (targetAcc) {
    saveAccounts(
      accounts.map((a) => (a.id === targetAcc.id ? { ...a, isVip: nextVip } : a)),
    );
  }

  const nextWorld: WorldModerationState = {
    ...world,
    users: world.users.map((u) =>
      u.id === userId || (targetAcc && u.id === targetAcc.id)
        ? { ...u, isVip: nextVip }
        : u,
    ),
  };
  saveWorldState(nextWorld);
  return nextWorld;
}

/** Adiciona uma nova peça criada ao catálogo global da Starplaza */
export function addCustomClothingToWorld(item: ClothingItem): WorldModerationState {
  const world = loadWorldState();
  const current = world.customClothingCatalog ?? [];
  const nextWorld: WorldModerationState = {
    ...world,
    customClothingCatalog: [item, ...current.filter((c) => c.id !== item.id)],
  };
  saveWorldState(nextWorld);
  return nextWorld;
}

/** Adiciona um novo móvel criado ao catálogo da Suíte */
export function addCustomFurnitureToWorld(furn: FurnitureDef): WorldModerationState {
  const world = loadWorldState();
  const current = world.customFurnitureCatalog ?? [];
  const nextWorld: WorldModerationState = {
    ...world,
    customFurnitureCatalog: [furn, ...current.filter((f) => f.id !== furn.id)],
  };
  saveWorldState(nextWorld);
  return nextWorld;
}

/** Adiciona um novo modelo de Sala (Comum ou VIP) ao catálogo da Starplaza */
export function addCustomRoomTemplateToWorld(
  roomTpl: PurchasableRoomItem,
): WorldModerationState {
  const world = loadWorldState();
  const current = world.customRoomCatalog ?? [];
  const nextWorld: WorldModerationState = {
    ...world,
    customRoomCatalog: [roomTpl, ...current.filter((r) => r.id !== roomTpl.id)],
  };
  saveWorldState(nextWorld);
  return nextWorld;
}

/** Adiciona um novo papel de parede / plano de fundo ao catálogo da Starplaza */
export function addCustomWallpaperToWorld(
  wp: PurchasableWallpaperItem,
): WorldModerationState {
  const world = loadWorldState();
  const current = world.customWallpaperCatalog ?? [];
  const nextWorld: WorldModerationState = {
    ...world,
    customWallpaperCatalog: [wp, ...current.filter((w) => w.id !== wp.id)],
  };
  saveWorldState(nextWorld);
  return nextWorld;
}

/**
 * Remove qualquer bot ou membro da Staff (exceto a conta Fundadora/Admin principal).
 * Bots são excluídos permanentemente (sem reaparecer no reload); contas de jogadores são rebaixadas para 'player'.
 */
export function removeStaffMember(
  accountId: string,
): { removed: boolean; world: WorldModerationState } {
  const accounts = loadAccounts();
  const target = accounts.find((a) => a.id === accountId);
  const currentWorld = loadWorldState();

  if (!target || target.isPrimaryOwner || target.id === 'acc_admin_owner') {
    return { removed: false, world: currentWorld };
  }

  const isBotOrSeed = Boolean(target.isBot) || target.id.startsWith('acc_staff_') || target.id.startsWith('acc_bot_');

  if (isBotOrSeed) {
    addRemovedStaffId(target.id);
    saveAccounts(accounts.filter((a) => a.id !== target.id));
    try {
      window.localStorage.removeItem(`${PLAYER_PREFIX}${target.id}`);
    } catch {
      // Silencioso
    }
    const nextWorld: WorldModerationState = {
      ...currentWorld,
      users: currentWorld.users.filter((u) => u.id !== target.id),
    };
    saveWorldState(nextWorld);
    return { removed: true, world: nextWorld };
  }

  // Para contas humanas de jogadores, remove o cargo de Staff retornando ao papel de Estilista
  const demotedAccount: UserAccount = {
    ...target,
    role: 'player',
    staffRoleTier: undefined,
    staffRoleTitle: undefined,
    serverRegion: undefined,
  };
  saveAccounts(accounts.map((a) => (a.id === target.id ? demotedAccount : a)));

  const nextWorld: WorldModerationState = {
    ...currentWorld,
    users: currentWorld.users.map((u) =>
      u.id === target.id
        ? {
            ...u,
            role: 'player',
            staffRoleTier: undefined,
          }
        : u,
    ),
  };
  saveWorldState(nextWorld);
  return { removed: true, world: nextWorld };
}

/**
 * Atualiza o cargo de Staff e privilégios administrativos diretamente na conta salva.
 */
export function updateAccountStaffAssignment(
  usernameOrId: string,
  roleTier: StaffRoleTier | null,
  staffRoleTitle?: string,
): UserAccount | null {
  const accounts = loadAccounts();
  const normalizedTarget = normalizeUsername(usernameOrId);
  let updatedAccount: UserAccount | null = null;

  const nextAccounts = accounts.map((acc) => {
    const matches =
      acc.id === usernameOrId || normalizeUsername(acc.username) === normalizedTarget;
    if (!matches) return acc;

    // A conta fundadora sempre mantém privilégio de administrador
    const isOwner = Boolean(acc.isPrimaryOwner) || acc.id === 'acc_admin_owner';
    const nextTier: StaffRoleTier | undefined = isOwner
      ? 'admin'
      : roleTier ?? undefined;
    const nextRole = isOwner || nextTier ? 'admin' : 'player';
    const nextServer = nextTier ? STAFF_ROLE_SERVER_MAP[nextTier] : undefined;
    const nextTitle = nextTier
      ? staffRoleTitle?.trim() || DEFAULT_STAFF_ROLE_TITLES[nextTier]
      : undefined;

    updatedAccount = {
      ...acc,
      role: nextRole,
      staffRoleTier: nextTier,
      staffRoleTitle: nextTitle,
      serverRegion: nextServer,
    };
    return updatedAccount;
  });

  if (updatedAccount) {
    saveAccounts(nextAccounts);
  }
  return updatedAccount;
}

/**
 * Cria uma conta vinculada caso o administrador promova à Staff um jogador
 * que originalmente era apenas um perfil fictício da comunidade.
 */
export function ensureAccountForCommunityUser(
  mockUser: MockUser,
  roleTier: StaffRoleTier,
): UserAccount {
  const existing = getAccountByIdOrUsername(mockUser.id, mockUser.username);
  if (existing) {
    clearRemovedStaffId(existing.id);
    return updateAccountStaffAssignment(existing.id, roleTier) ?? existing;
  }

  const normalized = normalizeUsername(mockUser.username);
  const nextServer = STAFF_ROLE_SERVER_MAP[roleTier];
  const newAccount: UserAccount = {
    id: mockUser.id.startsWith('acc_') ? mockUser.id : `acc_${normalized}`,
    username: normalized,
    displayName: mockUser.displayName?.trim() || normalized,
    email: `${normalized}@starlightatelier.com`,
    password: 'staff123',
    avatarGender: 'feminino',
    role: 'admin',
    staffRoleTier: roleTier,
    staffRoleTitle: DEFAULT_STAFF_ROLE_TITLES[roleTier],
    serverRegion: nextServer,
    createdAt: mockUser.joinedAt || new Date().toLocaleDateString('pt-BR'),
  };

  const accounts = loadAccounts();
  saveAccounts([...accounts, newAccount]);

  const initialProgress = createDefaultPlayerState('feminino', newAccount.id);
  savePlayerProgress(newAccount.id, {
    ...initialProgress,
    starcoins: mockUser.starcoins || initialProgress.starcoins,
  });

  return newAccount;
}

/**
 * Atualiza a aparência (roupas, cabelo, tom de pele e gênero) no perfil da conta vinculada.
 */
export function syncAppearanceToAccount(
  accountId: string,
  appearance: {
    skinTone: SkinToneId;
    avatarGender: AvatarGender;
    equipped: EquippedOutfit;
  },
): void {
  const account = getAccountByIdOrUsername(accountId);
  if (!account) return;
  const current = loadPlayerProgress(account.id, appearance.avatarGender);
  const equippedIds = Object.values(appearance.equipped).filter(
    (v): v is string => Boolean(v),
  );
  savePlayerProgress(account.id, {
    ...current,
    skinTone: appearance.skinTone,
    avatarGender: appearance.avatarGender,
    equipped: { ...current.equipped, ...appearance.equipped },
    ownedItemIds: Array.from(new Set([...current.ownedItemIds, ...equippedIds])),
  });
}

/** Registra uma nova conta validando duplicidade de username e vinculando servidor regional */
export function registerAccount(input: {
  username: string;
  displayName?: string;
  email: string;
  password: string;
  avatarGender: AvatarGender;
  serverRegion?: ServerRegion;
}): { ok: true; account: UserAccount } | { ok: false; error: string } {
  const normalized = normalizeUsername(input.username);

  if (normalized.length < 3) {
    return { ok: false, error: 'O nome de usuário deve ter pelo menos 3 caracteres.' };
  }
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return {
      ok: false,
      error: 'Use apenas letras, números ou underline (_) no nome de usuário.',
    };
  }
  if (!input.email.includes('@') || input.email.trim().length < 5) {
    return { ok: false, error: 'Informe um e-mail válido.' };
  }
  const cleanedEmail = input.email.trim().toLowerCase();
  const accounts = loadAccounts();
  const emailAlreadyExists = accounts.some(
    (acc) => acc.email.trim().toLowerCase() === cleanedEmail,
  );
  if (emailAlreadyExists) {
    return {
      ok: false,
      error: 'Este endereço de e-mail já está cadastrado em outra conta. O Starlight Atelier exige 1 e-mail único por conta.',
    };
  }
  if (input.password.length < 4) {
    return { ok: false, error: 'A senha deve ter pelo menos 4 caracteres.' };
  }

  const world = loadWorldState();
  const candidateDisplayName = input.displayName?.trim() || normalized;

  // Garante exclusividade global (case-insensitive) de username e nome de exibição
  const conflictError = checkGlobalNameConflict({
    accounts,
    world,
    username: normalized,
    displayName: candidateDisplayName,
  });

  if (conflictError) {
    return {
      ok: false,
      error: conflictError,
    };
  }

  const chosenServer: ServerRegion = input.serverRegion ?? 'BR';
  const defaultCountryCode =
    chosenServer === 'ES' ? 'ES' : chosenServer === 'EN' ? 'US' : 'BR';
  const countryMeta = getCountryMeta(defaultCountryCode);

  const newAccount: UserAccount = {
    id: `acc_${Date.now()}`,
    username: normalized,
    displayName: candidateDisplayName,
    email: input.email.trim().toLowerCase(),
    password: input.password,
    avatarGender: input.avatarGender,
    role: 'player',
    serverRegion: chosenServer,
    createdAt: new Date().toLocaleDateString('pt-BR'),
  };

  saveAccounts([...accounts, newAccount]);

  // Inicializa progresso próprio com país/fuso/IP alinhados ao Servidor selecionado
  const basePlayer = createDefaultPlayerState(input.avatarGender, newAccount.id);
  const initialPlayer: PlayerProgressState = {
    ...basePlayer,
    countryCode: countryMeta.code,
    timezone: countryMeta.timezone,
    simulatedIp: generateSimulatedIp(newAccount.id, countryMeta.code),
  };
  savePlayerProgress(newAccount.id, initialPlayer);

  saveWorldState({
    ...world,
    users: [
      {
        id: newAccount.id,
        username: newAccount.username,
        displayName: newAccount.displayName,
        level: 1,
        starcoins: initialPlayer.starcoins,
        status: 'active',
        joinedAt: newAccount.createdAt,
        role: newAccount.role,
        staffRoleTier: newAccount.staffRoleTier,
        serverRegion: chosenServer,
        simulatedIp: initialPlayer.simulatedIp,
        countryCode: countryMeta.code,
      },
      ...world.users,
    ],
  });

  setSessionAccountId(newAccount.id);
  return { ok: true, account: newAccount };
}

/** Realiza login verificando credenciais por username ou e-mail e status de banimento */
export function loginAccount(input: {
  username: string;
  password: string;
}): { ok: true; account: UserAccount } | { ok: false; error: string } {
  const rawInput = input.username.trim();
  const normalized = normalizeUsername(rawInput);
  const rawEmail = rawInput.toLowerCase();
  if (!rawInput || !input.password) {
    return { ok: false, error: 'Preencha usuário (ou e-mail) e senha.' };
  }

  const accounts = loadAccounts();
  const found = accounts.find(
    (acc) =>
      normalizeUsername(acc.username) === normalized ||
      acc.email.trim().toLowerCase() === rawEmail,
  );

  const cleanedPass = input.password.trim();
  const isAdminTarget =
    normalized === 'vitor' ||
    rawEmail === ADMIN_OWNER_EMAIL ||
    (found && (found.id === 'acc_admin_owner' || found.isPrimaryOwner));

  const actualAccount: UserAccount | undefined =
    found ||
    (isAdminTarget
      ? accounts.find((a) => a.id === 'acc_admin_owner' || a.isPrimaryOwner)
      : undefined);

  const passwordMatches =
    (actualAccount && actualAccount.password === cleanedPass) ||
    (isAdminTarget &&
      (cleanedPass === '@manuel868673' ||
       cleanedPass === 'senha @manuel868673' ||
       cleanedPass === 'admin123'));

  if (!actualAccount || !passwordMatches) {
    return { ok: false, error: 'Usuário, e-mail ou senha incorretos.' };
  }

  // Verifica se a conta foi banida pelo painel de Moderação
  const world = loadWorldState();
  const moderatedEntry = world.users.find(
    (u) =>
      u.id === actualAccount.id ||
      normalizeUsername(u.username) === normalizeUsername(actualAccount.username),
  );
  if (moderatedEntry?.status === 'banned') {
    return {
      ok: false,
      error: `Conta suspensa pela moderação${moderatedEntry.banReason ? `: ${moderatedEntry.banReason}` : '.'}`,
    };
  }

  setSessionAccountId(actualAccount.id);
  return { ok: true, account: actualAccount };
}

/** Hidrata sessão e cache local após autenticação bem-sucedida na API centralizada */
export function syncAccountAndProgressFromServer(params: {
  account: UserAccount;
  progress?: PlayerProgressState | null;
  accounts?: UserAccount[] | null;
  worldState?: WorldModerationState | null;
}): void {
  if (typeof window === 'undefined') return;
  try {
    if (Array.isArray(params.accounts) && params.accounts.length > 0) {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(params.accounts));
    } else {
      const existing = loadAccounts();
      const idx = existing.findIndex((a) => a.id === params.account.id);
      const next =
        idx >= 0
          ? existing.map((a) => (a.id === params.account.id ? params.account : a))
          : [...existing, params.account];
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
    }
    if (params.progress) {
      window.localStorage.setItem(
        `${PLAYER_PREFIX}${params.account.id}`,
        JSON.stringify(params.progress),
      );
    }
    if (params.worldState) {
      window.localStorage.setItem(WORLD_KEY, JSON.stringify(params.worldState));
    }
  } catch {
    // Silencioso
  }
  setSessionAccountId(params.account.id);
}

export function setSessionAccountId(accountId: string | null): void {
  try {
    if (!accountId) {
      window.localStorage.removeItem(SESSION_KEY);
    } else {
      window.localStorage.setItem(SESSION_KEY, accountId);
    }
  } catch {
    // Silencioso
  }
}

export function getLoggedAccount(): UserAccount | null {
  try {
    const sessionId = window.localStorage.getItem(SESSION_KEY);
    if (!sessionId) return null;
    const accounts = loadAccounts();
    return accounts.find((acc) => acc.id === sessionId) ?? null;
  } catch {
    return null;
  }
}

export function logoutAccount(): void {
  setSessionAccountId(null);
}

/** Carrega progresso da MeDoll, guarda-roupa, perfil e Suíte de uma conta específica */
export function loadPlayerProgress(
  accountId: string,
  fallbackGender: AvatarGender = 'feminino',
): PlayerProgressState {
  const fallback = createDefaultPlayerState(fallbackGender, accountId);
  try {
    const raw = window.localStorage.getItem(`${PLAYER_PREFIX}${accountId}`);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<PlayerProgressState>;
    const starterIds = INITIAL_CLOTHING_CATALOG.filter((item) => item.starter).map(
      (item) => item.id,
    );
    const starterFurnitureIds = FURNITURE_CATALOG.filter((f) => f.starter).map((f) => f.id);
    const starterRoomIds = PURCHASABLE_ROOMS_CATALOG.filter((r) => r.starter).map((r) => r.id);
    const starterWallpaperIds = PURCHASABLE_WALLPAPERS_CATALOG.filter((w) => w.starter).map(
      (w) => w.id,
    );
    const placedFurnitureIds = Array.isArray(parsed.suite?.items)
      ? parsed.suite.items.map((it) => it.furnitureId)
      : [];

    const countryMeta = getCountryMeta(parsed.countryCode ?? fallback.countryCode);
    const validPresence: PresenceStatus =
      parsed.presenceStatus === 'ausente' || parsed.presenceStatus === 'offline'
        ? parsed.presenceStatus
        : 'online';

    return {
      starcoins: typeof parsed.starcoins === 'number' ? parsed.starcoins : fallback.starcoins,
      ownedItemIds: Array.isArray(parsed.ownedItemIds)
        ? Array.from(new Set([...parsed.ownedItemIds, ...starterIds]))
        : fallback.ownedItemIds,
      ownedFurnitureIds: Array.isArray(parsed.ownedFurnitureIds)
        ? Array.from(
            new Set([
              ...parsed.ownedFurnitureIds,
              ...starterFurnitureIds,
              ...placedFurnitureIds,
            ]),
          )
        : Array.from(new Set([...starterFurnitureIds, ...placedFurnitureIds])),
      ownedRoomTemplateIds: Array.isArray(parsed.ownedRoomTemplateIds)
        ? Array.from(new Set([...parsed.ownedRoomTemplateIds, ...starterRoomIds]))
        : starterRoomIds,
      ownedWallpaperIds: Array.isArray(parsed.ownedWallpaperIds)
        ? Array.from(new Set([...parsed.ownedWallpaperIds, ...starterWallpaperIds]))
        : starterWallpaperIds,
      equipped: parsed.equipped ?? fallback.equipped,
      skinTone: parsed.skinTone ?? fallback.skinTone,
      avatarGender: parsed.avatarGender ?? fallbackGender,
      customAvatarUrl:
        typeof parsed.customAvatarUrl === 'string' ? parsed.customAvatarUrl : undefined,
      avatarDisplayMode:
        parsed.avatarDisplayMode === 'photo' && parsed.customAvatarUrl
          ? 'photo'
          : 'medoll',
      bio: typeof parsed.bio === 'string' ? parsed.bio : fallback.bio,
      presenceStatus: validPresence,
      countryCode: countryMeta.code,
      timezone:
        typeof parsed.timezone === 'string' && parsed.timezone
          ? parsed.timezone
          : countryMeta.timezone,
      simulatedIp:
        typeof parsed.simulatedIp === 'string' && parsed.simulatedIp
          ? parsed.simulatedIp
          : generateSimulatedIp(accountId, countryMeta.code),
      friendUsernames: Array.isArray(parsed.friendUsernames)
        ? parsed.friendUsernames
        : [],
      suite: parsed.suite?.items
        ? {
            theme: parsed.suite.theme ?? 'paris_marfim',
            wallpaperId: parsed.suite.wallpaperId ?? 'wp_boiserie_marfim',
            items: parsed.suite.items,
            avatarPos: parsed.suite.avatarPos ?? fallback.suite.avatarPos,
            lastSavedAt: parsed.suite.lastSavedAt ?? fallback.suite.lastSavedAt,
          }
        : fallback.suite,
    };
  } catch {
    return fallback;
  }
}

export function savePlayerProgress(
  accountId: string,
  progress: PlayerProgressState,
): void {
  const key = `${PLAYER_PREFIX}${accountId}`;
  try {
    const serialized = JSON.stringify(progress);
    if (window.localStorage.getItem(key) === serialized) {
      return;
    }
    window.localStorage.setItem(key, serialized);
  } catch {
    // Silencioso
  }
  postSyncMessage('player:sync', { accountId });
  emitStatePatchToServer({ playerPatch: { accountId, progress } });
}

/** Credita StarCoins adquiridos na Loja Financeira diretamente na conta e no diretório global */
export function creditUserStarcoins(
  accountId: string,
  amount: number,
): { progress: PlayerProgressState; world: WorldModerationState } {
  const acc = getAccountByIdOrUsername(accountId);
  const current = loadPlayerProgress(accountId, acc?.avatarGender ?? 'feminino');
  const nextProgress: PlayerProgressState = {
    ...current,
    starcoins: Math.max(0, current.starcoins + Math.round(amount)),
  };
  savePlayerProgress(accountId, nextProgress);

  const world = loadWorldState();
  const nextWorld: WorldModerationState = {
    ...world,
    users: world.users.map((u) =>
      u.id === accountId ? { ...u, starcoins: nextProgress.starcoins } : u,
    ),
  };
  saveWorldState(nextWorld);

  return { progress: nextProgress, world: nextWorld };
}

/** Ativa a Assinatura VIP na conta do jogador com bônus imediato de StarCoins */
export function activateUserVipSubscription(
  accountId: string,
  bonusStarcoins: number = 0,
): {
  account: UserAccount | null;
  progress: PlayerProgressState;
  world: WorldModerationState;
} {
  const accounts = loadAccounts();
  const nextAccounts = accounts.map((a) =>
    a.id === accountId ? { ...a, isVip: true } : a,
  );
  const updatedAcc = nextAccounts.find((a) => a.id === accountId) ?? null;
  if (updatedAcc) {
    saveAccounts(nextAccounts);
  }

  const current = loadPlayerProgress(accountId, updatedAcc?.avatarGender ?? 'feminino');
  const nextProgress: PlayerProgressState = {
    ...current,
    starcoins: current.starcoins + Math.max(0, Math.round(bonusStarcoins)),
  };
  savePlayerProgress(accountId, nextProgress);

  const world = loadWorldState();
  const nextWorld: WorldModerationState = {
    ...world,
    users: world.users.map((u) =>
      u.id === accountId
        ? { ...u, isVip: true, starcoins: nextProgress.starcoins }
        : u,
    ),
  };
  saveWorldState(nextWorld);

  return { account: updatedAcc, progress: nextProgress, world: nextWorld };
}

/** Publica uma notícia editorial com foto no Feed de Notícias do mundo compartilhado */
export function publishNewsPostToWorld(
  input: Omit<NewsPost, 'id' | 'createdAt'>,
): { post: NewsPost; world: WorldModerationState } {
  const world = loadWorldState();
  const newPost: NewsPost = {
    ...input,
    id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const nextWorld: WorldModerationState = {
    ...world,
    newsPosts: [newPost, ...(world.newsPosts ?? [])].slice(0, 40),
  };
  saveWorldState(nextWorld);
  return { post: newPost, world: nextWorld };
}

/** Carrega todas as mensagens privadas salvas no localStorage */
export function loadAllPrivateMessages(): PrivateMessage[] {
  try {
    const raw = window.localStorage.getItem(DMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrivateMessage[]) : [];
  } catch {
    return [];
  }
}

/** Retorna a conversa privada ordenada cronologicamente entre dois usuários */
export function loadPrivateMessagesBetween(
  userA: string,
  userB: string,
): PrivateMessage[] {
  const a = normalizeUsername(userA);
  const b = normalizeUsername(userB);
  return loadAllPrivateMessages()
    .filter(
      (msg) =>
        (normalizeUsername(msg.fromUsername) === a &&
          normalizeUsername(msg.toUsername) === b) ||
        (normalizeUsername(msg.fromUsername) === b &&
          normalizeUsername(msg.toUsername) === a),
    )
    .sort((x, y) => x.createdAt - y.createdAt);
}

/** Envia e persiste uma mensagem privada entre jogadores */
export function sendPrivateMessage(
  fromUsername: string,
  toUsername: string,
  text: string,
): PrivateMessage[] {
  const trimmed = text.trim();
  if (!trimmed) return loadPrivateMessagesBetween(fromUsername, toUsername);

  const all = loadAllPrivateMessages();
  const nextMsg: PrivateMessage = {
    id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fromUsername: normalizeUsername(fromUsername),
    toUsername: normalizeUsername(toUsername),
    text: trimmed,
    createdAt: Date.now(),
  };

  const updated = [...all, nextMsg].slice(-250);
  try {
    window.localStorage.setItem(DMS_KEY, JSON.stringify(updated));
  } catch {
    // Silencioso
  }
  postSyncMessage('dm:sync', {
    from: nextMsg.fromUsername,
    to: nextMsg.toUsername,
  });
  emitStatePatchToServer({ dms: updated });
  return loadPrivateMessagesBetween(fromUsername, toUsername);
}

/**
 * Resolve um perfil público completo e unificado para o Modal de Perfil Visitante,
 * lendo diretamente da Fonte Única de Verdade (UserAccount + PlayerProgressState).
 */
export function resolvePublicProfileSummary(params: {
  targetUsername: string;
  currentUser: UserAccount;
  currentPlayerState: PlayerProgressState;
  worldState: WorldModerationState;
  fallbackAppearance?: {
    equipped?: EquippedOutfit;
    skinTone?: SkinToneId;
    avatarGender?: AvatarGender;
    customAvatarUrl?: string;
    avatarDisplayMode?: AvatarDisplayMode;
    role?: 'admin' | 'player';
  };
}): PublicProfileSummary {
  const {
    targetUsername,
    currentUser,
    currentPlayerState,
    worldState,
    fallbackAppearance,
  } = params;

  const cleanUsername = normalizeUsername(targetUsername);
  const accountMatch = getAccountByIdOrUsername(undefined, cleanUsername);
  const isSelf =
    normalizeUsername(currentUser.username) === cleanUsername ||
    (accountMatch !== undefined && accountMatch.id === currentUser.id);

  const mockMatch = worldState.users.find(
    (u) =>
      (accountMatch && u.id === accountMatch.id) ||
      normalizeUsername(u.username) === cleanUsername,
  );
  const ambientMatch = AMBIENT_ROOM_AVATARS.find(
    (a) => normalizeUsername(a.username) === cleanUsername,
  );

  // Resolve progresso vivo salvo no localStorage (ou do usuário atual)
  let progress: PlayerProgressState;
  if (isSelf) {
    progress = currentPlayerState;
  } else if (accountMatch) {
    progress = loadPlayerProgress(accountMatch.id, accountMatch.avatarGender);
  } else {
    progress = getAccountLiveProgress(mockMatch?.id, cleanUsername, {
      skinTone: fallbackAppearance?.skinTone ?? ambientMatch?.skinTone ?? 'pessego',
      avatarGender:
        fallbackAppearance?.avatarGender ?? ambientMatch?.avatarGender ?? 'feminino',
      equipped: fallbackAppearance?.equipped ?? ambientMatch?.equipped ?? {},
    });
  }

  const ownedCount = progress.ownedItemIds.length;
  const computedLevel =
    mockMatch?.level ?? Math.max(1, 1 + Math.floor(ownedCount / 3));

  const resolvedAccount = isSelf ? currentUser : accountMatch;
  const resolvedRole =
    resolvedAccount?.role ?? mockMatch?.role ?? fallbackAppearance?.role ?? 'player';
  const resolvedTier = resolvedAccount?.staffRoleTier ?? mockMatch?.staffRoleTier;
  const resolvedStaffTitle =
    resolvedAccount?.staffRoleTitle ??
    (resolvedTier ? DEFAULT_STAFF_ROLE_TITLES[resolvedTier] : undefined);

  const countryCode = progress.countryCode || mockMatch?.countryCode || 'BR';
  const countryMeta = getCountryMeta(countryCode);
  const resolvedPresence: PresenceStatus = progress.presenceStatus ?? 'online';
  const resolvedServerRegion =
    resolvedAccount?.serverRegion ??
    mockMatch?.serverRegion ??
    inferServerRegionFromCountry(countryMeta.code);

  return {
    accountId: resolvedAccount?.id ?? mockMatch?.id,
    username: resolvedAccount?.username ?? cleanUsername,
    displayName:
      resolvedAccount?.displayName ?? mockMatch?.displayName ?? cleanUsername,
    role: resolvedRole,
    staffRoleTier: resolvedTier,
    staffRoleTitle: resolvedStaffTitle,
    serverRegion: resolvedServerRegion,
    isVip: isVipAccount(resolvedAccount) || Boolean(mockMatch?.isVip),
    level: computedLevel,
    starcoins: isSelf
      ? currentPlayerState.starcoins
      : mockMatch?.starcoins ?? progress.starcoins,
    presenceStatus: resolvedPresence,
    bio: progress.bio,
    countryCode: countryMeta.code,
    timezone: progress.timezone || countryMeta.timezone,
    simulatedIp:
      isSelf
        ? currentPlayerState.simulatedIp
        : progress.simulatedIp ??
          mockMatch?.simulatedIp ??
          generateSimulatedIp(cleanUsername, countryMeta.code),
    equipped:
      isSelf
        ? currentPlayerState.equipped
        : Object.keys(progress.equipped).length > 0
          ? progress.equipped
          : fallbackAppearance?.equipped ?? {},
    skinTone:
      isSelf
        ? currentPlayerState.skinTone
        : progress.skinTone ?? fallbackAppearance?.skinTone ?? 'pessego',
    avatarGender:
      isSelf
        ? currentPlayerState.avatarGender
        : progress.avatarGender ?? fallbackAppearance?.avatarGender ?? 'feminino',
    customAvatarUrl: isSelf
      ? currentPlayerState.customAvatarUrl
      : progress.customAvatarUrl ?? fallbackAppearance?.customAvatarUrl,
    avatarDisplayMode: isSelf
      ? currentPlayerState.avatarDisplayMode
      : progress.avatarDisplayMode ?? fallbackAppearance?.avatarDisplayMode ?? 'medoll',
    suite: progress.suite,
  };
}

/** Restaura o mundo compartilhado e o progresso do usuário atual */
export function resetAccountAndWorld(
  account: UserAccount,
): { player: PlayerProgressState; world: WorldModerationState } {
  try {
    window.localStorage.removeItem(REMOVED_STAFF_IDS_KEY);
  } catch {
    // Silencioso
  }
  const freshPlayer = createDefaultPlayerState(account.avatarGender, account.id);
  const freshWorld = createDefaultWorldState();
  savePlayerProgress(account.id, freshPlayer);
  saveWorldState(freshWorld);
  return { player: freshPlayer, world: loadWorldState() };
}
