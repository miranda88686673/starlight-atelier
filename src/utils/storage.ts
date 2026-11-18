import {
  ACCOUNT_COUNTRIES,
  CATALOG_SCHEMA_VERSION,
  DEFAULT_BANNED_WORDS,
  DEFAULT_SUITE_ITEMS,
  FURNITURE_CATALOG,
  INITIAL_CLOTHING_CATALOG,
  INITIAL_NEWS_POSTS,
  PURCHASABLE_ROOMS_CATALOG,
  PURCHASABLE_WALLPAPERS_CATALOG,
  STARTER_IDS_BY_GENDER,
} from '../data/catalog';
import type { AccountCountryOption } from '../types/game';
import { emitStatePatchToServer } from '../core/state/socketBridge';
import {
  ADMIN_CREATED_AT,
  ADMIN_INITIAL_LEVEL,
  LOGIN_XP_REWARD,
  awardLoginXp,
  canonicalCharacterKey,
  cleanCharacterName,
  collapsedCharacterKey,
  getLevelProgressMetrics,
  normalizeLevelAndXp,
  validateCharacterName,
} from './levelSystem';
import {
  AccessoryBodySlot,
  AvatarDisplayMode,
  AvatarGender,
  ClothingCategory,
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
  FacePreset,
} from '../types/game';

export const ADMIN_OWNER_EMAIL = 'miranda88686673@gmail.com';
export const NAME_CHANGE_FEE_SC = 500;

/** Chaves versionadas no localStorage */
export const ACCOUNTS_KEY = 'starlight_atelier_accounts_v1';
export const SESSION_KEY = 'starlight_atelier_session_v1';
export const WORLD_KEY = 'starlight_atelier_world_v1';
export const PLAYER_PREFIX = 'starlight_atelier_player_v1_';
export const DMS_KEY = 'starlight_atelier_dms_v1';
export const FACE_PRESETS_KEY = 'starlight_atelier_face_presets_v1';
const REMOVED_STAFF_IDS_KEY = 'starlight_atelier_removed_staff_v1';
const ROOMS_STORAGE_KEY = 'starlight_atelier_rooms_v1';
const REALTIME_CHANNEL_NAME = 'starlight_atelier_realtime_v1';

export function getSavedFacePresets(): FacePreset[] {
  try {
    const raw = localStorage.getItem(FACE_PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFacePreset(preset: FacePreset): FacePreset[] {
  try {
    const current = getSavedFacePresets();
    const existingIdx = current.findIndex((p) => p.id === preset.id);
    let next: FacePreset[];
    if (existingIdx >= 0) {
      next = [...current];
      next[existingIdx] = preset;
    } else {
      next = [preset, ...current];
    }
    localStorage.setItem(FACE_PRESETS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function deleteFacePreset(presetId: string): FacePreset[] {
  try {
    const current = getSavedFacePresets();
    const next = current.filter((p) => p.id !== presetId);
    localStorage.setItem(FACE_PRESETS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

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
  cm_br: 'Community Manager (BR)',
  cm_es: 'Community Manager (ES)',
  cm_en: 'Community Manager (EN)',
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

/** Retorna o servidor regional do Community Manager (BR, ES, EN), ou null */
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

/** Verifica se a conta pode enviar avisos comunitários / eventos no servidor informado (apenas Admin Geral) */
export function canManageCommunityInServer(
  account?: UserAccount | null,
  _targetServer: ServerRegion = 'BR',
): boolean {
  return isPrimaryAdminAccount(account);
}

/** Infere o servidor regional principal a partir do país configurado no perfil */
export function inferServerRegionFromCountry(countryCode?: string): ServerRegion {
  if (countryCode === 'ES' || countryCode === 'AR' || countryCode === 'MX') return 'ES';
  if (countryCode === 'US' || countryCode === 'GB' || countryCode === 'CA') return 'EN';
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

/** Determina a parte anatômica onde um acessório é equipado (permite múltiplos acessórios simultâneos) */
export function getAccessoryBodySlot(
  item: Pick<ClothingItem, 'id' | 'name' | 'templateId' | 'threeSpec' | 'accessorySlot'>,
): AccessoryBodySlot {
  if (item.accessorySlot) return item.accessorySlot;
  const sil = item.threeSpec?.garmentSilhouette;
  if (sil === 'acc_dragon' || sil === 'acc_white_tiger') return 'companion';
  if (sil === 'acc_eyepatch' || sil === 'acc_sunglasses') return 'face';
  if (sil === 'acc_watch') return 'arm';
  if (sil === 'acc_scepter' || sil === 'acc_bag') return 'hand';
  if (sil === 'acc_necklace') return 'neck';
  if (sil === 'acc_earrings') return 'ear';
  if (sil === 'acc_crown' || sil === 'acc_hat') return 'head';

  const hint = `${item.id} ${item.templateId ?? ''} ${item.name}`.toLowerCase();
  if (
    hint.includes('dragao') ||
    hint.includes('dragon') ||
    hint.includes('tigre') ||
    hint.includes('tiger') ||
    hint.includes('pet')
  ) {
    return 'companion';
  }
  if (hint.includes('tapa-olho') || hint.includes('tapa olho') || hint.includes('eyepatch') || hint.includes('oculos') || hint.includes('óculos')) return 'face';
  if (hint.includes('relogio') || hint.includes('relógio') || hint.includes('watch') || hint.includes('bracelete') || hint.includes('pulseira')) return 'arm';
  if (hint.includes('cetro') || hint.includes('scepter') || hint.includes('bolsa') || hint.includes('bag')) return 'hand';
  if (hint.includes('colar') || hint.includes('necklace') || hint.includes('gargantilha')) return 'neck';
  if (hint.includes('brinco') || hint.includes('ear')) return 'ear';
  return 'head';
}

export const ACCESSORY_SLOT_LABELS: Record<AccessoryBodySlot, string> = {
  head: 'Cabeça',
  ear: 'Orelha',
  face: 'Rosto',
  neck: 'Pescoço',
  arm: 'Braço',
  hand: 'Mão',
  companion: 'Ao Lado (Mascote)',
};

/** Retorna todos os acessórios equipados (unindo legado `acessorios` + mapa `acessoriosSlots`) */
export function getEquippedAccessoriesList(
  equipped: EquippedOutfit | undefined,
  catalogMapOrArray: Map<string, ClothingItem> | ClothingItem[],
): Array<{ slot: AccessoryBodySlot; item: ClothingItem }> {
  if (!equipped) return [];
  const lookup = (id: string): ClothingItem | undefined =>
    catalogMapOrArray instanceof Map
      ? catalogMapOrArray.get(id)
      : catalogMapOrArray.find((c) => c.id === id);

  const slotsMap: Partial<Record<AccessoryBodySlot, string>> = {
    ...(equipped.acessoriosSlots ?? {}),
  };

  if (equipped.acessorios) {
    const legacyItem = lookup(equipped.acessorios);
    if (legacyItem) {
      const legacySlot = getAccessoryBodySlot(legacyItem);
      if (!slotsMap[legacySlot]) {
        slotsMap[legacySlot] = legacyItem.id;
      }
    }
  }

  const results: Array<{ slot: AccessoryBodySlot; item: ClothingItem }> = [];
  const seenIds = new Set<string>();
  (Object.entries(slotsMap) as Array<[AccessoryBodySlot, string | undefined]>).forEach(
    ([slot, id]) => {
      if (!id || seenIds.has(id)) return;
      const item = lookup(id);
      if (!item) return;
      seenIds.add(id);
      results.push({ slot, item });
    },
  );
  return results;
}

/** Verifica se uma peça ou acessório está equipado no avatar */
export function isClothingItemEquipped(
  equipped: EquippedOutfit | undefined,
  item: Pick<ClothingItem, 'id' | 'category'>,
): boolean {
  if (!equipped) return false;
  if (item.category === 'acessorios') {
    if (equipped.acessorios === item.id) return true;
    const slotValues = Object.values(equipped.acessoriosSlots ?? {});
    return slotValues.includes(item.id);
  }
  return equipped[item.category] === item.id;
}

/** Alterna uma peça mantendo múltiplos acessórios equipados em partes distintas do corpo */
export function toggleItemInEquippedOutfit(
  equipped: EquippedOutfit,
  item: ClothingItem,
  catalog?: ClothingItem[],
): EquippedOutfit {
  const nextEquipped: EquippedOutfit = {
    ...equipped,
    acessoriosSlots: equipped.acessoriosSlots ? { ...equipped.acessoriosSlots } : undefined,
  };

  if (item.category === 'acessorios') {
    const targetSlot = getAccessoryBodySlot(item);
    const nextSlots: Partial<Record<AccessoryBodySlot, string>> = {
      ...(nextEquipped.acessoriosSlots ?? {}),
    };

    // Preserva acessório legado em seu próprio slot antes de alterar o slot alvo
    if (nextEquipped.acessorios && catalog) {
      const legacyItem = catalog.find((c) => c.id === nextEquipped.acessorios);
      if (legacyItem) {
        const legacySlot = getAccessoryBodySlot(legacyItem);
        if (!nextSlots[legacySlot]) {
          nextSlots[legacySlot] = legacyItem.id;
        }
      }
    }

    const currentlyEquippedInSlot = nextSlots[targetSlot] === item.id || (!nextSlots[targetSlot] && nextEquipped.acessorios === item.id);
    if (currentlyEquippedInSlot) {
      delete nextSlots[targetSlot];
      if (nextEquipped.acessorios === item.id) {
        const remaining = Object.values(nextSlots).find((v): v is string => Boolean(v));
        if (remaining) nextEquipped.acessorios = remaining;
        else delete nextEquipped.acessorios;
      }
    } else {
      nextSlots[targetSlot] = item.id;
      nextEquipped.acessorios = item.id;
    }

    if (Object.keys(nextSlots).length > 0) {
      nextEquipped.acessoriosSlots = nextSlots;
    } else {
      delete nextEquipped.acessoriosSlots;
    }
    return nextEquipped;
  }

  const currentInSlot = nextEquipped[item.category];
  if (currentInSlot === item.id) {
    delete nextEquipped[item.category];
  } else {
    nextEquipped[item.category] = item.id;
    if (item.category === 'vestidos') {
      delete nextEquipped.blusas;
      delete nextEquipped.calcas;
    } else if (item.category === 'blusas' || item.category === 'calcas') {
      delete nextEquipped.vestidos;
    }
  }
  return nextEquipped;
}

/** Desequipa automaticamente qualquer roupa incompatível ao alternar o modelo de corpo (Masculino/Feminino) */
export function unequipIncompatibleClothes(
  equipped: EquippedOutfit,
  nextGender: AvatarGender,
  catalog: ClothingItem[],
): { nextEquipped: EquippedOutfit; removedNames: string[] } {
  const nextEquipped: EquippedOutfit = {};
  const removedNames: string[] = [];

  const mainCategories: ClothingCategory[] = [
    'cabelo',
    'blusas',
    'casacos',
    'vestidos',
    'calcas',
    'sapatos',
    'acessorios',
  ];

  mainCategories.forEach((slot) => {
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

  if (equipped.acessoriosSlots) {
    const keptSlots: Partial<Record<AccessoryBodySlot, string>> = {};
    (Object.entries(equipped.acessoriosSlots) as Array<[AccessoryBodySlot, string | undefined]>).forEach(
      ([subSlot, itemId]) => {
        if (!itemId) return;
        const item = catalog.find((c) => c.id === itemId);
        if (!item) return;
        if (isItemCompatibleWithGender(item.gender ?? item.genderStyle, nextGender)) {
          keptSlots[subSlot] = itemId;
        } else if (!removedNames.includes(item.name)) {
          removedNames.push(item.name);
        }
      },
    );
    if (Object.keys(keptSlots).length > 0) {
      nextEquipped.acessoriosSlots = keptSlots;
    }
  }

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
  casacos: { x: 58, y: 126, width: 164, height: 192 },
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

/** Verifica exclusividade global (case-insensitive e anti-cópia) para nome único do personagem */
export function checkGlobalNameConflict(params: {
  accounts: UserAccount[];
  world: WorldModerationState;
  username: string;
  displayName: string;
  excludeAccountId?: string;
}): string | null {
  const { accounts, world, username, displayName, excludeAccountId } = params;
  const candidate = cleanCharacterName(displayName || username);
  const targetKey = canonicalCharacterKey(candidate);
  const targetCollapsed = collapsedCharacterKey(candidate);
  const userKey = canonicalCharacterKey(username);
  const userCollapsed = collapsedCharacterKey(username);

  const excludeAccount = excludeAccountId
    ? accounts.find((a) => a.id === excludeAccountId)
    : undefined;
  const excludeOldUser = excludeAccount
    ? normalizeUsername(excludeAccount.username)
    : undefined;

  const conflictInAccounts = accounts.some((a) => {
    if (a.id === excludeAccountId) return false;
    const keys = [
      canonicalCharacterKey(a.username),
      canonicalCharacterKey(a.displayName),
      collapsedCharacterKey(a.username),
      collapsedCharacterKey(a.displayName),
    ];
    return (
      keys.includes(targetKey) ||
      keys.includes(targetCollapsed) ||
      keys.includes(userKey) ||
      keys.includes(userCollapsed)
    );
  });

  const conflictInWorld = world.users.some((u) => {
    if (u.id === excludeAccountId) return false;
    if (excludeOldUser && normalizeUsername(u.username) === excludeOldUser) return false;
    const keys = [
      canonicalCharacterKey(u.username),
      canonicalCharacterKey(u.displayName ?? u.username),
      collapsedCharacterKey(u.username),
      collapsedCharacterKey(u.displayName ?? u.username),
    ];
    return (
      keys.includes(targetKey) ||
      keys.includes(targetCollapsed) ||
      keys.includes(userKey) ||
      keys.includes(userCollapsed)
    );
  });

  if (conflictInAccounts || conflictInWorld) {
    return `O nome de personagem "${candidate}" já está em uso. Cada conta tem seu nome próprio exclusivo.`;
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
  const genderStarter = STARTER_IDS_BY_GENDER[avatarGender] ?? STARTER_IDS_BY_GENDER.feminino;
  const defaultCountry = getCountryMeta('BR');
  const isPrimaryAdmin = seedForIp === 'acc_admin_owner';

  const starterFurnitureIds = FURNITURE_CATALOG.filter((f) => f.starter).map((f) => f.id);
  const starterRoomIds = PURCHASABLE_ROOMS_CATALOG.filter((r) => r.starter).map((r) => r.id);
  const starterWallpaperIds = PURCHASABLE_WALLPAPERS_CATALOG.filter((w) => w.starter).map(
    (w) => w.id,
  );

  return {
    catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
    level: isPrimaryAdmin ? ADMIN_INITIAL_LEVEL : 1,
    xp: 0,
    starcoins: 1200,
    ownedItemIds: [...genderStarter.owned],
    ownedFurnitureIds: starterFurnitureIds,
    ownedRoomTemplateIds: starterRoomIds,
    ownedWallpaperIds: starterWallpaperIds,
    equipped: {},
    skinTone: 'pessego',
    avatarGender,
    avatarDisplayMode: 'medoll',
    profileBanner: {
      presetId: 'atelier_aurora',
      motionSpeed: 'slow',
    },
    bio: 'Explorando estilos 3D na Starplaza e decorando minha Suíte no Nocturne Vale Club.',
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

/** Contas iniciais pré-cadastradas (Apenas Administrador Geral) */
function createSeededAccounts(): UserAccount[] {
  return [
    {
      id: 'acc_admin_owner',
      username: 'Vitor',
      displayName: 'Vitor',
      email: ADMIN_OWNER_EMAIL,
      password: '@manuel868673',
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'admin',
      staffRoleTitle: 'Administrador Geral',
      isVip: true,
      isPrimaryOwner: true,
      createdAt: ADMIN_CREATED_AT,
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

/** Estado compartilhado padrão da sala e moderação */
function buildDefaultLegendaryLaunchMap(baseTs: number = Date.now()): Record<string, number> {
  return {
    legendary_coroa_2023: baseTs,
    legendary_coroa_2024: baseTs,
    legendary_coroa_2025: baseTs,
    legendary_coroa_2026: baseTs,
    legendary_dragaozinho: baseTs,
    legendary_tigre_branco: baseTs,
  };
}

export function createDefaultWorldState(): WorldModerationState {
  const seededAccounts = createSeededAccounts();
  const seededStaffUsers: MockUser[] = seededAccounts.map((acc) => ({
    id: acc.id,
    username: acc.username,
    displayName: acc.displayName,
    level: acc.isPrimaryOwner || acc.id === 'acc_admin_owner' ? ADMIN_INITIAL_LEVEL : 1,
    starcoins: acc.staffRoleTier === 'admin' ? 4500 : 1200,
    status: 'active',
    joinedAt: acc.createdAt,
    role: acc.role,
    staffRoleTier: acc.staffRoleTier,
    serverRegion: acc.serverRegion,
    isVip: Boolean(acc.isVip),
    isPrimaryOwner: acc.isPrimaryOwner,
  }));

  return {
    catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
    globalNotice:
      'Bem-vinda ao Nocturne Vale Club 3D! Lounge Party Oficial e decorações exclusivas na Starplaza.',
    serverNotices: {
      BR: 'Encontro Oficial no Lounge Party! Explore as salas 3D e móveis da Starplaza.',
      ES: '¡Encuentro oficial en Lounge Party! Explora las salas 3D y muebles de Starplaza.',
      EN: 'Official Meetup at Lounge Party! Explore the 3D rooms and Starplaza furniture.',
    },
    users: [...seededStaffUsers],
    deletedItemIds: [],
    soldOutItemIds: [],
    legendaryLaunchTimestamps: buildDefaultLegendaryLaunchMap(),
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
  'Gerente da Comunidade (BR)',
  'Gerente da Comunidade (ES)',
  'Gerente da Comunidade (EN)',
  'Gerente da Comunidade (BR) — Servidor Brasileiro',
  'Gerente da Comunidade (ES) — Servidor Espanhol',
  'Gerente da Comunidade (EN) — Servidor em Inglês',
]);

function isBotOrLegacySeedId(id?: string): boolean {
  if (!id) return false;
  if (id === 'bot_designer_global') return true;
  if (id.startsWith('acc_bot_')) return true;
  if (id.startsWith('acc_staff_') && !id.startsWith('acc_staff_human_')) return true;
  return false;
}

/** Carrega todas as contas reais cadastradas no localStorage (expurga bots e seeds) */
export function loadAccounts(): UserAccount[] {
  const seeded = createSeededAccounts();
  const removedIds = getRemovedStaffIds();

  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Array<Partial<UserAccount>>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seeded));
      return seeded;
    }

    let changed = false;
    const filteredRaw = parsed.filter((rawAcc) => {
      if (rawAcc.isBot || isBotOrLegacySeedId(rawAcc.id)) {
        changed = true;
        return false;
      }
      return true;
    });

    const merged: UserAccount[] = filteredRaw.map((rawAcc) => {
      const seedMatch = seeded.find(
        (s) =>
          s.id === rawAcc.id ||
          (rawAcc.isPrimaryOwner && s.isPrimaryOwner) ||
          (rawAcc.username && normalizeUsername(s.username) === normalizeUsername(rawAcc.username)),
      );
      const isPrimaryOwner =
        Boolean(rawAcc.isPrimaryOwner) || rawAcc.id === 'acc_admin_owner';
      const unifiedBase =
        cleanCharacterName(rawAcc.displayName || rawAcc.username || '') ||
        seedMatch?.displayName ||
        'estilista';
      const resolvedCreatedAt = isPrimaryOwner
        ? ADMIN_CREATED_AT
        : rawAcc.createdAt ?? new Date().toLocaleDateString('pt-BR');

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

      const isVip =
        typeof rawAcc.isVip === 'boolean'
          ? rawAcc.isVip
          : isPrimaryOwner || staffRoleTier === 'designer_global' || Boolean(seedMatch?.isVip);

      const resolvedEmail = isPrimaryOwner
        ? ADMIN_OWNER_EMAIL
        : rawAcc.email ?? 'estilista@starlightatelier.com';

      if (
        rawAcc.username !== unifiedBase ||
        rawAcc.displayName !== unifiedBase ||
        rawAcc.createdAt !== resolvedCreatedAt ||
        Boolean(rawAcc.isPrimaryOwner) !== isPrimaryOwner ||
        rawAcc.email !== resolvedEmail ||
        rawAcc.staffRoleTier !== staffRoleTier ||
        rawAcc.staffRoleTitle !== staffRoleTitle ||
        rawAcc.serverRegion !== serverRegion ||
        rawAcc.isVip !== isVip
      ) {
        changed = true;
      }

      return {
        id: rawAcc.id ?? `acc_${Date.now()}`,
        username: unifiedBase,
        displayName: unifiedBase,
        email: resolvedEmail,
        password: rawAcc.password ?? '',
        password_hash: rawAcc.password_hash,
        profilePic: rawAcc.profilePic,
        avatarGender: rawAcc.avatarGender ?? 'feminino',
        role: isPrimaryOwner || staffRoleTier ? 'admin' : rawAcc.role ?? 'player',
        staffRoleTier,
        staffRoleTitle,
        serverRegion,
        isVip,
        isBot: false,
        isPrimaryOwner,
        createdAt: resolvedCreatedAt,
      };
    });

    // Garante apenas que a conta Admin Fundadora exista
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
    return merged;
  } catch {
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

/** Carrega estado compartilhado de moderação sincronizado com as contas reais (sem fantasmas nem bots) */
export function loadWorldState(): WorldModerationState {
  const accounts = loadAccounts();
  const removedIds = getRemovedStaffIds();
  const fallback = createDefaultWorldState();
  try {
    const raw = window.localStorage.getItem(WORLD_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<WorldModerationState>;

    const baseUsers = Array.isArray(parsed.users)
      ? parsed.users.filter(
          (u) =>
            !removedIds.includes(u.id) &&
            !u.id.startsWith('usr_') &&
            !isBotOrLegacySeedId(u.id),
        )
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

      // Sincroniza todas as contas registradas (matching por ID primeiro para preservar edições de nome único)
    for (const acc of accounts) {
      const isPrimaryOwner = Boolean(acc.isPrimaryOwner) || acc.id === 'acc_admin_owner';
      const accProgress = loadPlayerProgress(acc.id, acc.avatarGender);
      const { level: syncedLevel } = normalizeLevelAndXp(
        accProgress.level,
        accProgress.xp,
        isPrimaryOwner,
      );
      const existingIdx = existingUsers.findIndex(
        (u) =>
          u.id === acc.id ||
          normalizeUsername(u.username) === normalizeUsername(acc.username),
      );
      if (existingIdx === -1) {
        existingUsers.unshift({
          id: acc.id,
          username: acc.username,
          displayName: acc.displayName,
          level: syncedLevel,
          starcoins: accProgress.starcoins,
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
          username: acc.username,
          displayName: acc.displayName,
          level: isPrimaryOwner
            ? Math.max(ADMIN_INITIAL_LEVEL, syncedLevel)
            : syncedLevel,
          joinedAt: acc.createdAt,
          role: acc.role,
          staffRoleTier: acc.staffRoleTier,
          serverRegion: acc.serverRegion ?? existingUsers[existingIdx].serverRegion,
          isVip: isVipAccount(acc) || Boolean(existingUsers[existingIdx].isVip),
          isPrimaryOwner: acc.isPrimaryOwner,
        };
      }
    }

    const isCurrentWorldSchema = parsed.catalogSchemaVersion === CATALOG_SCHEMA_VERSION;
    const filteredCustomClothes = Array.isArray(parsed.customClothingCatalog)
      ? parsed.customClothingCatalog.filter((c) => Boolean(c?.threeSpec))
      : [];
    const cleanedNewsPosts = Array.isArray(parsed.newsPosts)
      ? parsed.newsPosts.filter((p) => !p.id.startsWith('news_seed_'))
      : [];

    const savedLaunchTimestamps =
      parsed.legendaryLaunchTimestamps &&
      typeof parsed.legendaryLaunchTimestamps === 'object'
        ? parsed.legendaryLaunchTimestamps
        : undefined;
    const mergedLaunchTimestamps: Record<string, number> = {
      ...buildDefaultLegendaryLaunchMap(),
      ...(savedLaunchTimestamps ?? {}),
    };

    const migratedWorld: WorldModerationState = {
      catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
      globalNotice:
        typeof parsed.globalNotice === 'string' && parsed.globalNotice.trim()
          ? parsed.globalNotice
          : fallback.globalNotice,
      serverNotices: parsed.serverNotices ?? fallback.serverNotices,
      users: existingUsers,
      deletedItemIds: Array.isArray(parsed.deletedItemIds) ? parsed.deletedItemIds : [],
      soldOutItemIds: Array.isArray(parsed.soldOutItemIds) ? parsed.soldOutItemIds : [],
      legendaryLaunchTimestamps: mergedLaunchTimestamps,
      customClothingCatalog: filteredCustomClothes,
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
      newsPosts: cleanedNewsPosts,
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

    if (!isCurrentWorldSchema) {
      try {
        window.localStorage.setItem(WORLD_KEY, JSON.stringify(migratedWorld));
      } catch {
        // Silencioso
      }
    }
    return migratedWorld;
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
 * Atualiza o Nome Único do Personagem (displayName === username) aplicando
 * exclusividade global (case-insensitive e anti-cópia).
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
  const unifiedName = cleanCharacterName(input.displayName || input.username);
  const shouldChargeFee = input.chargeFee !== false;

  const formatErr = validateCharacterName(unifiedName);
  if (formatErr) {
    return { ok: false, error: formatErr };
  }

  const accounts = loadAccounts();
  const targetAccount = accounts.find((a) => a.id === accountId);
  if (!targetAccount) {
    return { ok: false, error: 'Conta não encontrada no armazenamento local.' };
  }

  const oldUsername = normalizeUsername(targetAccount.username);
  const oldCanonical = canonicalCharacterKey(targetAccount.displayName || targetAccount.username);
  const nextCanonical = canonicalCharacterKey(unifiedName);
  const hasChanged = nextCanonical !== oldCanonical || unifiedName !== targetAccount.displayName;

  if (shouldChargeFee && !hasChanged) {
    return {
      ok: false,
      error: 'Digite um novo nome diferente do atual para alterar o nome do personagem.',
    };
  }

  const world = loadWorldState();
  const conflictError = checkGlobalNameConflict({
    accounts,
    world,
    username: unifiedName,
    displayName: unifiedName,
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
      error: 'Não foi possível concluir a alteração de nome neste momento.',
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
    username: unifiedName,
    displayName: unifiedName,
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
            username: unifiedName,
            displayName: unifiedName,
            starcoins: nextProgress.starcoins,
          }
        : u,
    ),
  };
  saveWorldState(nextWorld);

  const nextUsername = normalizeUsername(unifiedName);

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
 * Cria um novo membro humano da Staff manualmente (exclusivo do Administrador).
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
  isVip?: boolean;
}):
  | { ok: true; account: UserAccount; world: WorldModerationState }
  | { ok: false; error: string } {
  const unifiedName = cleanCharacterName(input.displayName || input.username);
  const nameErr = validateCharacterName(unifiedName);
  if (nameErr) {
    return { ok: false, error: nameErr };
  }

  const accounts = loadAccounts();
  const world = loadWorldState();

  const conflictError = checkGlobalNameConflict({
    accounts,
    world,
    username: unifiedName,
    displayName: unifiedName,
  });

  if (conflictError) {
    return {
      ok: false,
      error: conflictError,
    };
  }

  const serverRegion = STAFF_ROLE_SERVER_MAP[input.staffRoleTier];
  const emailSlug = normalizeUsername(unifiedName).replace(/[^a-z0-9_]/g, '') || 'staff';
  const newAccount: UserAccount = {
    id: `acc_staff_human_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    username: unifiedName,
    displayName: unifiedName,
    email: `${emailSlug}_${Date.now()}@starlightatelier.com`,
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
    isBot: false,
    createdAt: new Date().toLocaleDateString('pt-BR'),
  };

  saveAccounts([...accounts, newAccount]);

  const baseProgress = createDefaultPlayerState(input.avatarGender, newAccount.id);
  const equippedIds = Object.values(input.equipped).filter((v): v is string => Boolean(v));
  const countryByServer = serverRegion === 'ES' ? 'ES' : serverRegion === 'EN' ? 'US' : 'BR';
  const countryMeta = getCountryMeta(countryByServer);

  const staffProgress: PlayerProgressState = {
    ...baseProgress,
    level: 1,
    xp: 0,
    starcoins: input.staffRoleTier === 'admin' ? 4000 : 2500,
    ownedItemIds: Array.from(new Set([...baseProgress.ownedItemIds, ...equippedIds])),
    equipped: { ...input.equipped },
    skinTone: input.skinTone,
    avatarGender: input.avatarGender,
    customAvatarUrl: input.customAvatarUrl,
    avatarDisplayMode:
      input.avatarDisplayMode === 'photo' && input.customAvatarUrl ? 'photo' : 'medoll',
    bio: input.bio.trim() || 'Integrante oficial da equipe Nocturne Vale Club.',
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
        level: 1,
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
 * Permite ao Administrador editar livremente qualquer perfil de membro da Staff.
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

  const updatedAccount: UserAccount = {
    ...target,
    avatarGender: input.avatarGender,
    role: 'admin',
    staffRoleTier: nextTier,
    staffRoleTitle: nextTitle,
    serverRegion: nextServer,
    isBot: false,
    isVip:
      input.isVip ??
      (isOwner || nextTier === 'designer_global' ? true : target.isVip),
  };

  saveAccounts(accounts.map((a) => (a.id === accountId ? updatedAccount : a)));

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
  const isLeg = Boolean(item.isLegendary || item.itemClass === 'legendary');
  const launchTs = item.launchedAt ?? item.customCreatedAt ?? Date.now();
  const normalizedItem: ClothingItem = isLeg
    ? {
        ...item,
        isLegendary: true,
        itemClass: 'legendary',
        launchedAt: launchTs,
        legendaryExpiresAt: item.legendaryExpiresAt ?? launchTs + 24 * 60 * 60 * 1000,
      }
    : item;
  const nextWorld: WorldModerationState = {
    ...world,
    customClothingCatalog: [normalizedItem, ...current.filter((c) => c.id !== normalizedItem.id)],
    legendaryLaunchTimestamps: isLeg
      ? {
          ...(world.legendaryLaunchTimestamps ?? {}),
          [normalizedItem.id]: launchTs,
        }
      : world.legendaryLaunchTimestamps,
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

/** Registra uma nova conta validando nome único de personagem (1 por conta) e 1 e-mail único por conta */
export function registerAccount(input: {
  username: string;
  displayName?: string;
  email: string;
  password: string;
  avatarGender: AvatarGender;
  serverRegion?: ServerRegion;
}): { ok: true; account: UserAccount } | { ok: false; error: string } {
  const unifiedName = cleanCharacterName(input.username || input.displayName || '');
  const nameErr = validateCharacterName(unifiedName);
  if (nameErr) {
    return { ok: false, error: nameErr };
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
      error: 'Este endereço de e-mail já foi utilizado em outra conta. Só é permitido 1 conta por e-mail.',
    };
  }
  if (input.password.length < 4) {
    return { ok: false, error: 'A senha deve ter pelo menos 4 caracteres.' };
  }

  const world = loadWorldState();
  const conflictError = checkGlobalNameConflict({
    accounts,
    world,
    username: unifiedName,
    displayName: unifiedName,
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
    username: unifiedName,
    displayName: unifiedName,
    email: cleanedEmail,
    password: input.password,
    avatarGender: input.avatarGender,
    role: 'player',
    serverRegion: chosenServer,
    createdAt: new Date().toLocaleDateString('pt-BR'),
  };

  saveAccounts([...accounts, newAccount]);

  const basePlayer = createDefaultPlayerState(input.avatarGender, newAccount.id);
  const initialPlayer: PlayerProgressState = {
    ...basePlayer,
    level: 1,
    xp: 0,
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

/** Realiza login verificando credenciais por nome do personagem ou e-mail e concede XP de login */
export function loginAccount(input: {
  username: string;
  password: string;
}):
  | {
      ok: true;
      account: UserAccount;
      loginXpAward?: ReturnType<typeof awardLoginXp>;
    }
  | { ok: false; error: string } {
  const rawInput = input.username.trim();
  const normKey = canonicalCharacterKey(rawInput);
  const rawEmail = rawInput.toLowerCase();
  if (!rawInput || !input.password) {
    return { ok: false, error: 'Preencha o nome do personagem (ou e-mail) e senha.' };
  }

  const accounts = loadAccounts();
  const found = accounts.find(
    (acc) =>
      canonicalCharacterKey(acc.username) === normKey ||
      canonicalCharacterKey(acc.displayName) === normKey ||
      acc.email.trim().toLowerCase() === rawEmail,
  );

  const cleanedPass = input.password.trim();
  const isAdminTarget =
    normKey === 'vitor' ||
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
    return { ok: false, error: 'Nome do personagem, e-mail ou senha incorretos.' };
  }

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

  const isPrimaryAdmin =
    Boolean(actualAccount.isPrimaryOwner) || actualAccount.id === 'acc_admin_owner';
  const currentProgress = loadPlayerProgress(
    actualAccount.id,
    actualAccount.avatarGender,
  );
  const xpRes = awardLoginXp(
    currentProgress.level,
    currentProgress.xp,
    LOGIN_XP_REWARD,
    isPrimaryAdmin,
  );
  savePlayerProgress(actualAccount.id, {
    ...currentProgress,
    level: xpRes.level,
    xp: xpRes.xp,
    lastLoginXpAt: Date.now(),
    lastLoginXpGained: xpRes.xpGained,
  });

  saveWorldState({
    ...world,
    users: world.users.map((u) =>
      u.id === actualAccount.id ? { ...u, level: xpRes.level } : u,
    ),
  });

  setSessionAccountId(actualAccount.id);
  return { ok: true, account: actualAccount, loginXpAward: xpRes };
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
    const resolvedGender: AvatarGender = parsed.avatarGender ?? fallbackGender;
    const genderFallback = createDefaultPlayerState(resolvedGender, accountId);
    // Preserva integralmente itens comprados/equipados em qualquer versão de catálogo
    const starterIds = STARTER_IDS_BY_GENDER[resolvedGender]?.owned ?? STARTER_IDS_BY_GENDER.feminino.owned;
    const starterFurnitureIds = FURNITURE_CATALOG.filter((f) => f.starter).map((f) => f.id);
    const starterRoomIds = PURCHASABLE_ROOMS_CATALOG.filter((r) => r.starter).map((r) => r.id);
    const starterWallpaperIds = PURCHASABLE_WALLPAPERS_CATALOG.filter((w) => w.starter).map(
      (w) => w.id,
    );
    const placedFurnitureIds = Array.isArray(parsed.suite?.items)
      ? parsed.suite.items.map((it) => it.furnitureId)
      : [];
    const validCatalogIds = new Set(INITIAL_CLOTHING_CATALOG.map((item) => item.id));
    try {
      const worldRaw = window.localStorage.getItem(WORLD_KEY);
      if (worldRaw) {
        const wParsed = JSON.parse(worldRaw) as Partial<WorldModerationState>;
        if (Array.isArray(wParsed.customClothingCatalog)) {
          wParsed.customClothingCatalog.forEach((c) => {
            if (c?.id) validCatalogIds.add(c.id);
          });
        }
      }
    } catch {
      // Silencioso
    }
    const isKnownOrCustomItem = (id: unknown): id is string =>
      typeof id === 'string' && id.trim().length > 0 && (validCatalogIds.has(id) || id.startsWith('custom_'));

    const cleanedOwnedItems = Array.isArray(parsed.ownedItemIds)
      ? Array.from(
          new Set([
            ...starterIds,
            ...parsed.ownedItemIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
          ]),
        )
      : [...starterIds];

    const rawEq = parsed.equipped ?? {};
    const cleanedEquipped: EquippedOutfit =
      parsed.equipped && typeof parsed.equipped === 'object'
        ? {
            cabelo: isKnownOrCustomItem(rawEq.cabelo) ? rawEq.cabelo : rawEq.cabelo || undefined,
            blusas: isKnownOrCustomItem(rawEq.blusas) ? rawEq.blusas : rawEq.blusas || undefined,
            casacos: isKnownOrCustomItem(rawEq.casacos) ? rawEq.casacos : rawEq.casacos || undefined,
            vestidos: isKnownOrCustomItem(rawEq.vestidos) ? rawEq.vestidos : rawEq.vestidos || undefined,
            calcas: isKnownOrCustomItem(rawEq.calcas) ? rawEq.calcas : rawEq.calcas || undefined,
            sapatos: isKnownOrCustomItem(rawEq.sapatos) ? rawEq.sapatos : rawEq.sapatos || undefined,
            acessorios: isKnownOrCustomItem(rawEq.acessorios)
              ? rawEq.acessorios
              : rawEq.acessorios || undefined,
            acessoriosSlots:
              rawEq.acessoriosSlots && typeof rawEq.acessoriosSlots === 'object'
                ? Object.fromEntries(
                    Object.entries(rawEq.acessoriosSlots).filter(
                      ([, id]) => typeof id === 'string' && id.trim().length > 0,
                    ),
                  )
                : undefined,
          }
        : { ...genderFallback.equipped };

    const countryMeta = getCountryMeta(parsed.countryCode ?? fallback.countryCode);
    const validPresence: PresenceStatus =
      parsed.presenceStatus === 'ausente' || parsed.presenceStatus === 'offline'
        ? parsed.presenceStatus
        : 'online';

    const isPrimaryAdmin = accountId === 'acc_admin_owner';
    const { level: normalizedLevel, xp: normalizedXp } = normalizeLevelAndXp(
      parsed.level,
      parsed.xp,
      isPrimaryAdmin,
    );

    const migratedState: PlayerProgressState = {
      catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
      level: normalizedLevel,
      xp: normalizedXp,
      lastLoginXpAt: typeof parsed.lastLoginXpAt === 'number' ? parsed.lastLoginXpAt : undefined,
      lastLoginXpGained:
        typeof parsed.lastLoginXpGained === 'number' ? parsed.lastLoginXpGained : undefined,
      starcoins: typeof parsed.starcoins === 'number' ? parsed.starcoins : fallback.starcoins,
      ownedItemIds: cleanedOwnedItems,
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
      equipped: cleanedEquipped,
      skinTone: parsed.skinTone ?? fallback.skinTone,
      avatarGender: resolvedGender,
      faceCustomization: parsed.faceCustomization ?? fallback.faceCustomization,
      profilePic: typeof parsed.profilePic === 'string' ? parsed.profilePic : undefined,
      customAvatarUrl:
        typeof parsed.customAvatarUrl === 'string' ? parsed.customAvatarUrl : undefined,
      avatarDisplayMode:
        parsed.avatarDisplayMode === 'photo' && (parsed.profilePic || parsed.customAvatarUrl)
          ? 'photo'
          : 'medoll',
      profileBanner: parsed.profileBanner?.presetId
        ? {
            presetId: parsed.profileBanner.presetId,
            customImageUrl:
              typeof parsed.profileBanner.customImageUrl === 'string'
                ? parsed.profileBanner.customImageUrl
                : undefined,
            motionSpeed:
              parsed.profileBanner.motionSpeed === 'medium' ? 'medium' : 'slow',
          }
        : fallback.profileBanner,
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

    const isCurrentSchema = parsed.catalogSchemaVersion === CATALOG_SCHEMA_VERSION;
    if (!isCurrentSchema) {
      try {
        window.localStorage.setItem(`${PLAYER_PREFIX}${accountId}`, JSON.stringify(migratedState));
      } catch {
        // Silencioso
      }
    }
    return migratedState;
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

  // Resolve progresso vivo salvo no localStorage (ou do usuário atual)
  let progress: PlayerProgressState;
  if (isSelf) {
    progress = currentPlayerState;
  } else if (accountMatch) {
    progress = loadPlayerProgress(accountMatch.id, accountMatch.avatarGender);
  } else {
    progress = getAccountLiveProgress(mockMatch?.id, cleanUsername, {
      skinTone: fallbackAppearance?.skinTone ?? 'pessego',
      avatarGender: fallbackAppearance?.avatarGender ?? 'feminino',
      equipped: fallbackAppearance?.equipped ?? {},
    });
  }

  const resolvedAccount = isSelf ? currentUser : accountMatch;
  const isPrimaryAdmin =
    Boolean(resolvedAccount?.isPrimaryOwner) ||
    resolvedAccount?.id === 'acc_admin_owner' ||
    mockMatch?.id === 'acc_admin_owner';
  const metrics = getLevelProgressMetrics(
    progress.level ?? mockMatch?.level,
    progress.xp ?? 0,
    isPrimaryAdmin,
  );
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

  const unifiedResolvedName =
    resolvedAccount?.displayName ||
    resolvedAccount?.username ||
    mockMatch?.displayName ||
    cleanUsername;

  return {
    accountId: resolvedAccount?.id ?? mockMatch?.id,
    username: unifiedResolvedName,
    displayName: unifiedResolvedName,
    createdAt: isPrimaryAdmin
      ? ADMIN_CREATED_AT
      : resolvedAccount?.createdAt ?? mockMatch?.joinedAt,
    role: resolvedRole,
    staffRoleTier: resolvedTier,
    staffRoleTitle: resolvedStaffTitle,
    serverRegion: resolvedServerRegion,
    isVip: isVipAccount(resolvedAccount) || Boolean(mockMatch?.isVip),
    level: metrics.level,
    xp: metrics.xp,
    xpRequired: metrics.xpRequired,
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
    profileBanner: isSelf
      ? currentPlayerState.profileBanner
      : progress.profileBanner,
    faceCustomization: isSelf
      ? currentPlayerState.faceCustomization
      : progress.faceCustomization,
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
