import newsStreetwearUsImg from '../assets/images/news_streetwear_us_1794575515807.jpg';
import newsVipLegendaryImg from '../assets/images/news_vip_legendary_1794575516493.jpg';
import newsRunwayEventImg from '../assets/images/news_runway_event_1794575517773.jpg';
import newsAtelierFurnitureImg from '../assets/images/news_atelier_furniture_1794575518176.jpg';
import {
  ClothingItem,
  FurnitureDef,
  MockUser,
  NewsPost,
  PlacedFurniture,
  PurchasableRoomItem,
  PurchasableWallpaperItem,
  RoomAvatarPresence,
  RoomDef,
  RoomInteractiveProp,
  SkinToneOption,
  StaffMember,
  WorldModerationState,
} from '../types/game';
import {
  FEMALE_AM_CLOTHING_100,
  LEGENDARY_CROWNS_4,
  MALE_AM_CLOTHING_100,
  SPECIAL_ACCESSORIES_NEW,
} from './generatedCatalog';

export const NEWS_PHOTO_ASSETS = [
  {
    id: 'streetwear_us',
    label: 'Editorial Streetwear & Y2K (EUA)',
    url: newsStreetwearUsImg,
  },
  {
    id: 'vip_legendary',
    label: 'Coleção Lendária Boutique VIP',
    url: newsVipLegendaryImg,
  },
  {
    id: 'runway_event',
    label: 'Desfile & Encontro da Comunidade',
    url: newsRunwayEventImg,
  },
  {
    id: 'atelier_furniture',
    label: 'Suíte & Arquitetura de Móveis',
    url: newsAtelierFurnitureImg,
  },
] as const;

/**
 * Passo 1: Paletas de tons de pele da MeDoll base com cor principal, sombra anatômica e blush.
 */
export const SKIN_TONES: SkinToneOption[] = [
  { id: 'porcelana', label: 'Porcelana', base: '#F9DFD2', shadow: '#E8BEB0', blush: '#F29C9B' },
  { id: 'pessego', label: 'Pêssego Quente', base: '#F1C6AA', shadow: '#D9A183', blush: '#E78B84' },
  { id: 'mel', label: 'Dourado Mel', base: '#D49A6E', shadow: '#B5784D', blush: '#D8756C' },
  { id: 'cacau', label: 'Cacau Profundo', base: '#8B563E', shadow: '#683C28', blush: '#B85A56' },
];

/** Versão do catálogo 3D: v4 remove todas as roupas antigas e deixa personagens em traje íntimo padrão */
export const CATALOG_SCHEMA_VERSION = 4;

export const STARTER_IDS_BY_GENDER: Record<'feminino' | 'masculino' | 'neutro', {
  cabelo?: string;
  blusas?: string;
  calcas?: string;
  sapatos?: string;
  acessorios?: string;
  owned: string[];
}> = {
  feminino: {
    owned: [],
  },
  masculino: {
    owned: [],
  },
  neutro: {
    owned: [],
  },
};

/**
 * Catálogo oficial v4: 100 peças masculinas (Livres AM), 100 peças femininas (Livres AM) + 4 Coroas Lendárias (2023–2026).
 */
export const INITIAL_CLOTHING_CATALOG: ClothingItem[] = [
  ...SPECIAL_ACCESSORIES_NEW,
  ...LEGENDARY_CROWNS_4,
  ...FEMALE_AM_CLOTHING_100,
  ...MALE_AM_CLOTHING_100,
];

export function resolveItemClass(item: Pick<ClothingItem, 'itemClass' | 'isVipOnly' | 'isLegendary'>): 'am' | 'vip' | 'legendary' {
  if (item.itemClass) return item.itemClass;
  if (item.isLegendary) return 'legendary';
  if (item.isVipOnly) return 'vip';
  return 'am';
}

/** Janela padrão de venda por tempo limitado para itens Lendários: 24 horas reais */
export const LEGENDARY_AVAILABILITY_MS = 24 * 60 * 60 * 1000;

export interface LegendarySaleStatus {
  isSoldOut: boolean;
  reason: 'none' | 'admin_sold_out' | 'expired_24h';
  launchedAt?: number;
  expiresAt?: number;
  remainingMs: number;
}

/**
 * Resolve em tempo real (pelo relógio da vida real) se um item pode ser comprado na Starplaza:
 * - Marcado manualmente como "Vendido" pelo Admin (`soldOutItemIds`) -> bloqueado (`admin_sold_out`)
 * - Item Lendário fora da janela de 24h reais -> automaticamente status "Vendido" (`expired_24h`)
 */
export function resolveLegendarySaleStatus(
  item: Pick<
    ClothingItem,
    'id' | 'itemClass' | 'isVipOnly' | 'isLegendary' | 'launchedAt' | 'legendaryExpiresAt' | 'customCreatedAt'
  >,
  worldState?: Pick<WorldModerationState, 'soldOutItemIds' | 'legendaryLaunchTimestamps'>,
  nowMs: number = Date.now(),
): LegendarySaleStatus {
  const manualSoldOut = Boolean(worldState?.soldOutItemIds?.includes(item.id));
  const isLegendary = resolveItemClass(item) === 'legendary';

  if (!isLegendary) {
    return {
      isSoldOut: manualSoldOut,
      reason: manualSoldOut ? 'admin_sold_out' : 'none',
      remainingMs: 0,
    };
  }

  const worldLaunchTs = worldState?.legendaryLaunchTimestamps?.[item.id];
  const launchedAt = worldLaunchTs ?? item.launchedAt ?? item.customCreatedAt;
  const expiresAt =
    worldLaunchTs !== undefined
      ? worldLaunchTs + LEGENDARY_AVAILABILITY_MS
      : item.legendaryExpiresAt ??
        (launchedAt !== undefined ? launchedAt + LEGENDARY_AVAILABILITY_MS : undefined);

  if (manualSoldOut) {
    return {
      isSoldOut: true,
      reason: 'admin_sold_out',
      launchedAt,
      expiresAt,
      remainingMs: 0,
    };
  }

  if (expiresAt !== undefined) {
    const remainingMs = Math.max(0, expiresAt - nowMs);
    if (remainingMs <= 0) {
      return {
        isSoldOut: true,
        reason: 'expired_24h',
        launchedAt,
        expiresAt,
        remainingMs: 0,
      };
    }
    return {
      isSoldOut: false,
      reason: 'none',
      launchedAt,
      expiresAt,
      remainingMs,
    };
  }

  return {
    isSoldOut: false,
    reason: 'none',
    launchedAt,
    expiresAt,
    remainingMs: LEGENDARY_AVAILABILITY_MS,
  };
}

export function formatCountdown24h(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

/**
 * Passo 3: Catálogo de móveis disponíveis para o módulo Suíte 2D e Starplaza.
 * Móveis iniciais vêm com `starter: true`; novos sets temáticos (Boate, Casa, Bares, Hotel) são comprados com SC.
 */
export const FURNITURE_CATALOG: FurnitureDef[] = [
  // --- INICIAIS DA SUÍTE ---
  {
    id: 'furn_tapete_persa',
    name: 'Tapete Geométrico Marfim',
    category: 'Decoração',
    themeTag: 'casa',
    width: 240,
    height: 88,
    price: 120,
    defaultZ: 1,
    starter: true,
  },
  {
    id: 'furn_sofa_veludo',
    name: 'Sofá Veludo Rosé',
    category: 'Assentos',
    themeTag: 'casa',
    width: 195,
    height: 112,
    price: 350,
    defaultZ: 4,
    starter: true,
  },
  {
    id: 'furn_mesa_centro',
    name: 'Mesa de Centro Mármore',
    category: 'Superfícies',
    themeTag: 'casa',
    width: 128,
    height: 76,
    price: 180,
    defaultZ: 5,
    starter: true,
  },
  {
    id: 'furn_quadro_editorial',
    name: 'Quadro Editorial Atelier',
    category: 'Decoração',
    themeTag: 'geral',
    width: 92,
    height: 118,
    price: 95,
    defaultZ: 2,
    starter: true,
  },
  {
    id: 'furn_luminaria_arco',
    name: 'Luminária Arco Dourada',
    category: 'Decoração',
    themeTag: 'casa',
    width: 100,
    height: 172,
    price: 210,
    defaultZ: 6,
    starter: true,
  },
  {
    id: 'furn_planta_monstera',
    name: 'Vaso Costela-de-Adão',
    category: 'Decoração',
    themeTag: 'casa',
    width: 90,
    height: 138,
    price: 110,
    defaultZ: 6,
    starter: true,
  },
  {
    id: 'furn_penteadeira',
    name: 'Penteadeira com Espelho',
    category: 'Superfícies',
    themeTag: 'casa',
    width: 136,
    height: 162,
    price: 280,
    defaultZ: 3,
    starter: true,
  },
  {
    id: 'furn_cama_dossel',
    name: 'Cama Estofada Boutique',
    category: 'Assentos',
    themeTag: 'casa',
    width: 215,
    height: 145,
    price: 420,
    defaultZ: 3,
    starter: true,
  },
  {
    id: 'furn_sofa_ouro_vip',
    name: 'Divã Imperial Veludo & Ouro VIP',
    category: 'Assentos',
    themeTag: 'hotel',
    width: 205,
    height: 118,
    price: 690,
    defaultZ: 4,
    isVipOnly: true,
    swatchColor: '#D4A853',
    templateId: 'tpl_sofa',
  },

  // --- TEMA BOATE & CLUB ---
  {
    id: 'furn_boate_cabine_dj',
    name: 'Cabine de DJ Neon Club',
    category: 'Superfícies',
    themeTag: 'boate',
    width: 184,
    height: 122,
    price: 460,
    defaultZ: 4,
    swatchColor: '#1E1B2E',
    secondaryColor: '#312E81',
    accentColor: '#38BDF8',
    pattern: 'neon',
    templateId: 'tpl_dj',
    description: 'Mesa dupla com controladora iluminada, equalizador LED e fone de estúdio.',
  },
  {
    id: 'furn_boate_pista_led',
    name: 'Pista de Dança Quadriculada LED',
    category: 'Decoração',
    themeTag: 'boate',
    width: 256,
    height: 96,
    price: 390,
    defaultZ: 1,
    swatchColor: '#3B0764',
    secondaryColor: '#0F172A',
    accentColor: '#F472B6',
    pattern: 'neon',
    templateId: 'tpl_pista',
    description: 'Piso modular luminoso perfeito para festas e desfiles noturnos.',
  },
  {
    id: 'furn_boate_lounge_vip',
    name: 'Sofá Lounge Curvo Club VIP',
    category: 'Assentos',
    themeTag: 'boate',
    width: 210,
    height: 116,
    price: 580,
    defaultZ: 4,
    isVipOnly: true,
    swatchColor: '#18181B',
    secondaryColor: '#581C87',
    accentColor: '#FBBF24',
    templateId: 'tpl_sofa',
    description: 'Estofado semicircular em couro preto com filete dourado iluminado.',
  },
  {
    id: 'furn_cabine_dj_ouro_vip',
    name: 'Cabine de DJ Imperial Ouro VIP',
    category: 'Superfícies',
    themeTag: 'hotel',
    width: 190,
    height: 126,
    price: 680,
    defaultZ: 4,
    isVipOnly: true,
    swatchColor: '#2A2231',
    secondaryColor: '#18181B',
    accentColor: '#F59E0B',
    templateId: 'tpl_dj',
    description: 'Controladora dourada de alta-fidelidade com mesa de som e equalizador luminoso para sua Suíte e Salas.',
  },

  // --- TEMA CASA POR CÔMODO ---
  {
    id: 'furn_casa_ilha_cozinha',
    name: 'Ilha Gourmet Cozinha Mármore',
    category: 'Superfícies',
    themeTag: 'casa',
    width: 204,
    height: 120,
    price: 440,
    defaultZ: 4,
    swatchColor: '#F5F0E8',
    secondaryColor: '#5C4033',
    accentColor: '#C49A48',
    templateId: 'tpl_cozinha',
    description: 'Bancada gourmet completa com cooktop de indução, panela de cobre e banquetas.',
  },
  {
    id: 'furn_casa_banheira_vitoriana',
    name: 'Banheira Vitoriana Spa (Banheiro)',
    category: 'Decoração',
    themeTag: 'casa',
    width: 192,
    height: 116,
    price: 410,
    defaultZ: 3,
    swatchColor: '#FAF7F2',
    secondaryColor: '#E5DDD3',
    accentColor: '#C49A48',
    templateId: 'tpl_banheira',
    description: 'Banheira clássica com pés garra dourados, espuma e torneira vintage.',
  },
  {
    id: 'furn_casa_mesa_jantar',
    name: 'Mesa de Jantar Madeira Nobre',
    category: 'Superfícies',
    themeTag: 'casa',
    width: 196,
    height: 108,
    price: 360,
    defaultZ: 4,
    swatchColor: '#6D452D',
    secondaryColor: '#EDE5D8',
    accentColor: '#C49A48',
    templateId: 'tpl_mesa',
    description: 'Mesa para sala de jantar com castiçal dourado e centro floral.',
  },

  // --- TEMA BARES & BISTRÔ ---
  {
    id: 'furn_bar_balcao_coquetel',
    name: 'Balcão de Bar Coquetelaria',
    category: 'Superfícies',
    themeTag: 'bar',
    width: 210,
    height: 132,
    price: 490,
    defaultZ: 4,
    swatchColor: '#3B2318',
    secondaryColor: '#1E1B1E',
    accentColor: '#F59E0B',
    templateId: 'tpl_bar',
    description: 'Bar completo com prateleira retroiluminada, taças de cristal e coqueteleira.',
  },
  {
    id: 'furn_bar_banqueta_couro',
    name: 'Banqueta Alta Couro Conhaque',
    category: 'Assentos',
    themeTag: 'bar',
    width: 78,
    height: 116,
    price: 165,
    defaultZ: 5,
    swatchColor: '#9A512B',
    secondaryColor: '#27272A',
    accentColor: '#D4A853',
    templateId: 'tpl_banqueta',
    description: 'Banqueta giratória estofada com apoio de pés em latão escovado.',
  },

  // --- TEMA HOTEL DE LUXO ---
  {
    id: 'furn_hotel_cama_presidencial',
    name: 'Cama King Presidencial VIP',
    category: 'Assentos',
    themeTag: 'hotel',
    width: 228,
    height: 152,
    price: 820,
    defaultZ: 3,
    isVipOnly: true,
    isLegendary: true,
    swatchColor: '#FAF5EB',
    secondaryColor: '#2A2229',
    accentColor: '#D4A853',
    templateId: 'tpl_cama',
    description: 'Suíte presidencial com cabeceira capitonê alta, dossel e enxoval egípcio.',
  },
  {
    id: 'furn_hotel_concierge',
    name: 'Recepção Concierge Palace Hotel',
    category: 'Superfícies',
    themeTag: 'hotel',
    width: 205,
    height: 126,
    price: 530,
    defaultZ: 4,
    swatchColor: '#231F24',
    secondaryColor: '#EFE8DC',
    accentColor: '#D4A853',
    templateId: 'tpl_bar',
    description: 'Balcão em mármore Nero Marquina com sineta dourada e livro de hóspedes.',
  },
  {
    id: 'furn_hotel_lustre_imperial',
    name: 'Lustre Cristal Imperial VIP',
    category: 'Decoração',
    themeTag: 'hotel',
    width: 126,
    height: 138,
    price: 640,
    defaultZ: 7,
    isVipOnly: true,
    swatchColor: '#E0F2FE',
    secondaryColor: '#FEF3C7',
    accentColor: '#D4A853',
    templateId: 'tpl_lustre',
    description: 'Candelabro suspenso com cascatas de cristal lapidado e brilho âmbar.',
  },
];

/**
 * Modelos de Salas Comuns e Exclusivas VIP disponíveis para desbloqueio/compra na Starplaza.
 */
export const PURCHASABLE_ROOMS_CATALOG: PurchasableRoomItem[] = [
  {
    id: 'room_tpl_floresta_piquenique',
    name: 'Floresta do Laguinho & Piquenique',
    subtitle: 'Floresta com laguinho de peixes saltando, coelhos pelo gramado, árvores, toalhas de piquenique com frutas e 1 Cabine de DJ',
    themeTag: 'casa',
    backdropTheme: 'floresta_piquenique',
    price: 420,
    accentColor: '#22C55E',
    secondaryColor: '#DCFCE7',
    walkMinY: 53,
    walkMaxY: 89,
  },
  {
    id: 'room_tpl_boate_neon_club',
    name: 'Boate Neon Pista LED',
    subtitle: 'Boate noturna com 1 Cabine de DJ, pista de dança que muda de cor, luzes giratórias multicoloridas e LED neon',
    themeTag: 'boate',
    backdropTheme: 'boate_neon',
    price: 580,
    accentColor: '#EC4899',
    secondaryColor: '#130F26',
    walkMinY: 55,
    walkMaxY: 89,
  },
  {
    id: 'room_tpl_ilha_coqueiro',
    name: 'Ilha do Coqueiro & Mar',
    subtitle: 'Ilha cercada pela água do mar com 1 coqueiro, 1 Cabine de DJ funcional e peixes saltando na água',
    themeTag: 'geral',
    backdropTheme: 'ilha_coqueiro',
    price: 750,
    accentColor: '#0EA5E9',
    secondaryColor: '#F2D296',
    walkMinY: 53,
    walkMaxY: 89,
  },
];

/**
 * Papéis de parede e planos de fundo personalizáveis para Suíte 2D e Salas.
 */
export const PURCHASABLE_WALLPAPERS_CATALOG: PurchasableWallpaperItem[] = [
  {
    id: 'wp_boiserie_marfim',
    name: 'Boiserie Paris Marfim',
    subtitle: 'Revestimento clássico padrão de ateliê com molduras suaves',
    themeTag: 'casa',
    price: 0,
    starter: true,
    wallTopColor: '#FBF8F4',
    wallBottomColor: '#F1E9DE',
    wainscotColor: '#E8DED0',
    floorTopColor: '#DFCBB4',
    floorBottomColor: '#CCA987',
    accentColor: '#C49A48',
    pattern: 'solid',
  },
  {
    id: 'wp_listrado_boutique',
    name: 'Listrado Chanel Rosé',
    subtitle: 'Listras verticais elegantes em rosa poeira e marfim acetinado',
    themeTag: 'casa',
    price: 220,
    wallTopColor: '#FCF2F5',
    wallBottomColor: '#F3DDE4',
    wainscotColor: '#FAF6F0',
    floorTopColor: '#D8C2AE',
    floorBottomColor: '#B8987D',
    accentColor: '#C8235D',
    pattern: 'striped',
  },
  {
    id: 'wp_boate_violeta',
    name: 'Painel Neon Club Noturno',
    subtitle: 'Fundo roxo profundo com feixes de luz azul e magenta',
    themeTag: 'boate',
    price: 340,
    wallTopColor: '#150F2B',
    wallBottomColor: '#251447',
    wainscotColor: '#0F0A1E',
    floorTopColor: '#1E1B2E',
    floorBottomColor: '#09090B',
    accentColor: '#EC4899',
    pattern: 'neon',
  },
  {
    id: 'wp_bar_madeira_ambar',
    name: 'Painel Mogno & Latão Bistrô',
    subtitle: 'Revestimento acolhedor de bar clássico com iluminação âmbar',
    themeTag: 'bar',
    price: 290,
    wallTopColor: '#36211A',
    wallBottomColor: '#231510',
    wainscotColor: '#4A2E23',
    floorTopColor: '#6A4430',
    floorBottomColor: '#442A1D',
    accentColor: '#F59E0B',
    pattern: 'plaid',
  },
  {
    id: 'wp_hotel_marmore_ouro_vip',
    name: 'Mármore Nero & Ouro Palace VIP',
    subtitle: 'Parede palaciana em mármore escuro com veios dourados exclusivos VIP',
    themeTag: 'hotel',
    price: 540,
    isVipOnly: true,
    wallTopColor: '#1B1821',
    wallBottomColor: '#2C2634',
    wainscotColor: '#141118',
    floorTopColor: '#EAE1D5',
    floorBottomColor: '#C8B8A2',
    accentColor: '#D4A853',
    pattern: 'sequin',
  },
];

/** Disposição inicial acolhedora para a primeira visita na Suíte */
export const DEFAULT_SUITE_ITEMS: PlacedFurniture[] = [
  {
    instanceId: 'init_rug_1',
    furnitureId: 'furn_tapete_persa',
    x: 245,
    y: 342,
    zIndex: 1,
    flipped: false,
  },
  {
    instanceId: 'init_frame_1',
    furnitureId: 'furn_quadro_editorial',
    x: 295,
    y: 92,
    zIndex: 2,
    flipped: false,
  },
  {
    instanceId: 'init_sofa_1',
    furnitureId: 'furn_sofa_veludo',
    x: 248,
    y: 238,
    zIndex: 4,
    flipped: false,
  },
  {
    instanceId: 'init_table_1',
    furnitureId: 'furn_mesa_centro',
    x: 295,
    y: 332,
    zIndex: 5,
    flipped: false,
  },
  {
    instanceId: 'init_plant_1',
    furnitureId: 'furn_planta_monstera',
    x: 92,
    y: 230,
    zIndex: 6,
    flipped: false,
  },
  {
    instanceId: 'init_lamp_1',
    furnitureId: 'furn_luminaria_arco',
    x: 492,
    y: 190,
    zIndex: 6,
    flipped: false,
  },
];

/** Nenhum player fantasma pré-criado: apenas contas reais registradas */
export const DEFAULT_MOCK_USERS: MockUser[] = [];

/** Nenhuma conta Staff bot/seed pré-criada além do Administrador Geral real */
export const DEFAULT_STAFF_MEMBERS: StaffMember[] = [];

export const LOUNGE_PARTY_PROPS: RoomInteractiveProp[] = [
  { id: 'party_sofa_magenta_l', label: 'Sofá Magenta VIP Esquerdo', kind: 'sofa', x: 18, y: 64, seatX: 18, seatY: 64, collidable: false, primaryColor: '#BE185D', accentColor: '#D4A853' },
  { id: 'party_sofa_black_r', label: 'Sofá Ônix Central Direito', kind: 'sofa', x: 72, y: 68, seatX: 72, seatY: 68, collidable: false, primaryColor: '#171717', accentColor: '#D4A853' },
  { id: 'party_sofa_blue_front', label: 'Sofá Azul Coquetel', kind: 'sofa', x: 84, y: 82, seatX: 84, seatY: 82, collidable: false, primaryColor: '#2563EB', accentColor: '#D4A853' },
  { id: 'party_table_center', label: 'Mesa Redonda Pista Central', kind: 'table', x: 40, y: 72, collidable: true, collisionRadius: 6, primaryColor: '#FAF6F0', accentColor: '#D4A853' },
  { id: 'party_table_vip_l', label: 'Mesa Lounge Esquerdo', kind: 'table', x: 22, y: 46, collidable: true, collisionRadius: 6, primaryColor: '#FAF6F0', accentColor: '#D4A853' },
  { id: 'party_table_vip_r', label: 'Mesa Lounge Direito', kind: 'table', x: 82, y: 52, collidable: true, collisionRadius: 6, primaryColor: '#FAF6F0', accentColor: '#D4A853' },
  { id: 'party_table_blue_front', label: 'Mesa Coquetel Azul', kind: 'table', x: 80, y: 72, collidable: true, collisionRadius: 6, primaryColor: '#FAF6F0', accentColor: '#D4A853' },
  { id: 'party_chair_magenta', label: 'Poltrona Magenta Pista', kind: 'chair', x: 19, y: 80, seatX: 19, seatY: 80, collidable: false, primaryColor: '#E11D48', accentColor: '#D4A853' },
  { id: 'party_chair_center', label: 'Assento Pista Circular', kind: 'chair', x: 58, y: 78, seatX: 58, seatY: 78, collidable: false, primaryColor: '#1C1917', accentColor: '#D4A853' },
];

export const LOUNGE_PARTY_NATAL_PROPS: RoomInteractiveProp[] = [
  { id: 'natal_sofa_red_l', label: 'Sofá Veludo Vermelho Noel', kind: 'sofa', x: 18, y: 64, seatX: 18, seatY: 64, collidable: false, primaryColor: '#B91C1C', accentColor: '#F59E0B' },
  { id: 'natal_sofa_green_r', label: 'Sofá Verde Pinheiro Imperial', kind: 'sofa', x: 72, y: 68, seatX: 72, seatY: 68, collidable: false, primaryColor: '#166534', accentColor: '#FDE047' },
  { id: 'natal_sofa_gold_front', label: 'Sofá Dourado Ceia de Natal', kind: 'sofa', x: 84, y: 82, seatX: 84, seatY: 82, collidable: false, primaryColor: '#D97706', accentColor: '#FEF08A' },
  { id: 'natal_table_center', label: 'Mesa de Banquete Natalino', kind: 'table', x: 40, y: 72, collidable: true, collisionRadius: 6, primaryColor: '#FEF3C7', accentColor: '#DC2626' },
  { id: 'natal_table_vip_l', label: 'Mesa Bistrô Natal Esquerda', kind: 'table', x: 22, y: 46, collidable: true, collisionRadius: 6, primaryColor: '#FEF3C7', accentColor: '#15803D' },
  { id: 'natal_table_vip_r', label: 'Mesa Bistrô Natal Direita', kind: 'table', x: 82, y: 52, collidable: true, collisionRadius: 6, primaryColor: '#FEF3C7', accentColor: '#DC2626' },
  { id: 'natal_table_gold_front', label: 'Mesa Dourada de Presentes', kind: 'table', x: 80, y: 72, collidable: true, collisionRadius: 6, primaryColor: '#FEF3C7', accentColor: '#F59E0B' },
  { id: 'natal_chair_ruby', label: 'Poltrona Vermelha Festiva', kind: 'chair', x: 19, y: 80, seatX: 19, seatY: 80, collidable: false, primaryColor: '#DC2626', accentColor: '#FEF08A' },
  { id: 'natal_chair_center', label: 'Assento Estrela de Natal', kind: 'chair', x: 58, y: 78, seatX: 58, seatY: 78, collidable: false, primaryColor: '#166534', accentColor: '#FBBF24' },
  { id: 'natal_tree_decor', label: 'Árvore de Natal Encantada', kind: 'decor', decorType: 'tree', x: 88, y: 45, collidable: true, collisionRadius: 7, primaryColor: '#15803D', accentColor: '#FACC15' },
];

export const LOUNGE_PARTY_HALLOWEEN_PROPS: RoomInteractiveProp[] = [
  { id: 'hal_sofa_black_l', label: 'Sofá Gótico Vampírico', kind: 'sofa', x: 18, y: 64, seatX: 18, seatY: 64, collidable: false, primaryColor: '#18181B', accentColor: '#7C3AED' },
  { id: 'hal_sofa_purple_r', label: 'Sofá Púrpura Feitiço', kind: 'sofa', x: 72, y: 68, seatX: 72, seatY: 68, collidable: false, primaryColor: '#6B21A8', accentColor: '#F97316' },
  { id: 'hal_sofa_orange_front', label: 'Sofá Abóbora das Bruxas', kind: 'sofa', x: 84, y: 82, seatX: 84, seatY: 82, collidable: false, primaryColor: '#EA580C', accentColor: '#FEF08A' },
  { id: 'hal_table_center', label: 'Mesa do Caldeirão Central', kind: 'table', x: 40, y: 72, collidable: true, collisionRadius: 6, primaryColor: '#27272A', accentColor: '#F97316' },
  { id: 'hal_table_vip_l', label: 'Mesa Mística Esquerda', kind: 'table', x: 22, y: 46, collidable: true, collisionRadius: 6, primaryColor: '#27272A', accentColor: '#A855F7' },
  { id: 'hal_table_vip_r', label: 'Mesa das Sombras Direita', kind: 'table', x: 82, y: 52, collidable: true, collisionRadius: 6, primaryColor: '#27272A', accentColor: '#EA580C' },
  { id: 'hal_table_orange_front', label: 'Mesa Poção Mágica', kind: 'table', x: 80, y: 72, collidable: true, collisionRadius: 6, primaryColor: '#27272A', accentColor: '#A855F7' },
  { id: 'hal_chair_purple', label: 'Poltrona Púrpura Encantada', kind: 'chair', x: 19, y: 80, seatX: 19, seatY: 80, collidable: false, primaryColor: '#7E22CE', accentColor: '#F97316' },
  { id: 'hal_chair_center', label: 'Assento Jack-o-Lantern', kind: 'chair', x: 58, y: 78, seatX: 58, seatY: 78, collidable: false, primaryColor: '#C2410C', accentColor: '#18181B' },
  { id: 'hal_pumpkin_decor', label: 'Abóboras de Halloween', kind: 'decor', decorType: 'pumpkin', x: 88, y: 45, collidable: true, collisionRadius: 7, primaryColor: '#EA580C', accentColor: '#15803D' },
];

export const ILHA_TROPICAL_PROPS: RoomInteractiveProp[] = [
  { id: 'ilha_beach_chair_1', label: 'Cadeirinha de Praia Madeira 1', kind: 'chair', chairStyle: 'wooden_beach', x: 24, y: 66, seatX: 24, seatY: 66, rotationY: 25, collidable: false, primaryColor: '#A1622B', accentColor: '#F59E0B' },
  { id: 'ilha_beach_chair_2', label: 'Cadeirinha de Praia Madeira 2', kind: 'chair', chairStyle: 'wooden_beach', x: 35, y: 74, seatX: 35, seatY: 74, rotationY: 12, collidable: false, primaryColor: '#B45309', accentColor: '#38BDF8' },
  { id: 'ilha_beach_chair_3', label: 'Cadeirinha de Praia Madeira 3', kind: 'chair', chairStyle: 'wooden_beach', x: 50, y: 78, seatX: 50, seatY: 78, rotationY: 0, collidable: false, primaryColor: '#92400E', accentColor: '#10B981' },
  { id: 'ilha_beach_chair_4', label: 'Cadeirinha de Praia Madeira 4', kind: 'chair', chairStyle: 'wooden_beach', x: 65, y: 74, seatX: 65, seatY: 74, rotationY: 348, collidable: false, primaryColor: '#B45309', accentColor: '#F43F5E' },
  { id: 'ilha_beach_chair_5', label: 'Cadeirinha de Praia Madeira 5', kind: 'chair', chairStyle: 'wooden_beach', x: 76, y: 66, seatX: 76, seatY: 66, rotationY: 335, collidable: false, primaryColor: '#A1622B', accentColor: '#FACC15' },
  { id: 'ilha_beach_chair_6', label: 'Cadeirinha de Praia Madeira 6', kind: 'chair', chairStyle: 'wooden_beach', x: 28, y: 84, seatX: 28, seatY: 84, rotationY: 35, collidable: false, primaryColor: '#92400E', accentColor: '#0EA5E9' },
  { id: 'ilha_beach_chair_7', label: 'Cadeirinha de Praia Madeira 7', kind: 'chair', chairStyle: 'wooden_beach', x: 72, y: 84, seatX: 72, seatY: 84, rotationY: 325, collidable: false, primaryColor: '#92400E', accentColor: '#F59E0B' },
  { id: 'ilha_table_wood_1', label: 'Mesa de Madeira Tropical Oeste', kind: 'table', x: 30, y: 69, collidable: true, collisionRadius: 5, primaryColor: '#92400E', accentColor: '#F59E0B' },
  { id: 'ilha_table_wood_2', label: 'Mesa de Madeira Tropical Leste', kind: 'table', x: 70, y: 69, collidable: true, collisionRadius: 5, primaryColor: '#92400E', accentColor: '#38BDF8' },
];

/**
 * Salas Principais Oficiais do Starlight Atelier:
 * Lounge Party e Ilhas Tropicais (BR / ES / EN) identificadas com emblema Oficial.
 */
export const GLOBAL_ROOMS: RoomDef[] = [
  {
    id: 'lounge_party',
    name: 'Lounge Party (BR)',
    subtitle: 'Salão principal oficial 3D com pista iluminada, lounges VIP e Cabine de DJ ao vivo · Criada pelo Nocturne Vale Club',
    backdropTheme: 'lounge_party',
    walkMinY: 54,
    walkMaxY: 88,
    visibility: 'public',
    serverRegion: 'BR',
    ownerId: 'acc_admin_owner',
    creatorUsername: 'Nocturne Vale Club',
    isOfficial: true,
    interactiveProps: LOUNGE_PARTY_PROPS,
  },
  {
    id: 'ilha_brasil',
    name: 'Ilha Brasil',
    subtitle: 'Ilha tropical oficial cercada pelo mar com cadeirinhas de madeira, coqueiros, peixes saltando e 3 Cabines de DJ · Nocturne Vale Club',
    backdropTheme: 'ilha_tropical',
    walkMinY: 48,
    walkMaxY: 88,
    visibility: 'public',
    serverRegion: 'BR',
    ownerId: 'acc_admin_owner',
    creatorUsername: 'Nocturne Vale Club',
    isOfficial: true,
    interactiveProps: ILHA_TROPICAL_PROPS,
  },
  {
    id: 'lounge_party_es',
    name: 'Lounge Party (ES)',
    subtitle: 'Salón principal oficial 3D con pista iluminada, zona VIP y Cabina de DJ · Nocturne Vale Club',
    backdropTheme: 'lounge_party',
    walkMinY: 54,
    walkMaxY: 88,
    visibility: 'public',
    serverRegion: 'ES',
    ownerId: 'acc_admin_owner',
    creatorUsername: 'Nocturne Vale Club',
    isOfficial: true,
    interactiveProps: LOUNGE_PARTY_PROPS,
  },
  {
    id: 'ilha_spanish',
    name: 'Ilha Spanish',
    subtitle: 'Isla tropical oficial rodeada de agua con sillas de playa de madera, palmeras, peces saltando y 3 Cabinas de DJ · Nocturne Vale Club',
    backdropTheme: 'ilha_tropical',
    walkMinY: 48,
    walkMaxY: 88,
    visibility: 'public',
    serverRegion: 'ES',
    ownerId: 'acc_admin_owner',
    creatorUsername: 'Nocturne Vale Club',
    isOfficial: true,
    interactiveProps: ILHA_TROPICAL_PROPS,
  },
  {
    id: 'lounge_party_en',
    name: 'Lounge Party (EN)',
    subtitle: 'Official 3D rooftop lounge with illuminated dancefloor, VIP booths & live DJ booth · Nocturne Vale Club',
    backdropTheme: 'lounge_party',
    walkMinY: 54,
    walkMaxY: 88,
    visibility: 'public',
    serverRegion: 'EN',
    ownerId: 'acc_admin_owner',
    creatorUsername: 'Nocturne Vale Club',
    isOfficial: true,
    interactiveProps: LOUNGE_PARTY_PROPS,
  },
  {
    id: 'ilha_english',
    name: 'Ilha English',
    subtitle: 'Official tropical island surrounded by ocean with wooden beach chairs, coconut palms, jumping fish & 3 DJ Booths · Nocturne Vale Club',
    backdropTheme: 'ilha_tropical',
    walkMinY: 48,
    walkMaxY: 88,
    visibility: 'public',
    serverRegion: 'EN',
    ownerId: 'acc_admin_owner',
    creatorUsername: 'Nocturne Vale Club',
    isOfficial: true,
    interactiveProps: ILHA_TROPICAL_PROPS,
  },
];

/** Lista inicial de palavras bloqueadas pelo filtro de moderação do chat */
export const DEFAULT_BANNED_WORDS: string[] = [
  'palavrao',
  'ofensa',
  'golpe',
  'scam',
  'hack',
  'spam',
];

/** Sem figurantes estáticos: apenas jogadores conectados e Bots oficiais configurados pelo Admin ocupam as salas */
export const AMBIENT_ROOM_AVATARS: RoomAvatarPresence[] = [];

/** Países e fusos horários configuráveis na tela Meu Perfil / Conta */
export const ACCOUNT_COUNTRIES: Array<{
  code: string;
  name: string;
  cityLabel: string;
  timezone: string;
  ipPrefix: string;
}> = [
  {
    code: 'BR',
    name: 'Brasil (Bahia / Sudeste)',
    cityLabel: 'Salvador/BR',
    timezone: 'America/Sao_Paulo',
    ipPrefix: '189.42',
  },
  {
    code: 'BR-SP',
    name: 'Brasil (São Paulo)',
    cityLabel: 'São Paulo/BR',
    timezone: 'America/Sao_Paulo',
    ipPrefix: '177.84',
  },
  {
    code: 'BR-AM',
    name: 'Brasil (Amazonas)',
    cityLabel: 'Manaus/BR',
    timezone: 'America/Manaus',
    ipPrefix: '191.54',
  },
  {
    code: 'PT',
    name: 'Portugal',
    cityLabel: 'Lisboa/PT',
    timezone: 'Europe/Lisbon',
    ipPrefix: '193.136',
  },
  {
    code: 'ES',
    name: 'Espanha',
    cityLabel: 'Madrid/ES',
    timezone: 'Europe/Madrid',
    ipPrefix: '88.14',
  },
  {
    code: 'AR',
    name: 'Argentina',
    cityLabel: 'Buenos Aires/AR',
    timezone: 'America/Argentina/Buenos_Aires',
    ipPrefix: '181.46',
  },
  {
    code: 'US',
    name: 'Estados Unidos',
    cityLabel: 'Nova York/US',
    timezone: 'America/New_York',
    ipPrefix: '172.58',
  },
  {
    code: 'GB',
    name: 'Reino Unido',
    cityLabel: 'Londres/GB',
    timezone: 'Europe/London',
    ipPrefix: '81.149',
  },
  {
    code: 'FR',
    name: 'França',
    cityLabel: 'Paris/FR',
    timezone: 'Europe/Paris',
    ipPrefix: '176.158',
  },
  {
    code: 'IT',
    name: 'Itália',
    cityLabel: 'Milão/IT',
    timezone: 'Europe/Rome',
    ipPrefix: '93.44',
  },
  {
    code: 'DE',
    name: 'Alemanha',
    cityLabel: 'Berlim/DE',
    timezone: 'Europe/Berlin',
    ipPrefix: '91.64',
  },
  {
    code: 'MX',
    name: 'México',
    cityLabel: 'Cidade do México/MX',
    timezone: 'America/Mexico_City',
    ipPrefix: '187.188',
  },
  {
    code: 'CA',
    name: 'Canadá',
    cityLabel: 'Toronto/CA',
    timezone: 'America/Toronto',
    ipPrefix: '99.224',
  },
  {
    code: 'JP',
    name: 'Japão',
    cityLabel: 'Tóquio/JP',
    timezone: 'Asia/Tokyo',
    ipPrefix: '126.205',
  },
];

/** Notícias editoriais iniciais do Nocturne Vale Club (vazio por padrão) */
export const INITIAL_NEWS_POSTS: NewsPost[] = [];
