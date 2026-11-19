/**
 * Definição central de tipos do Nocturne Vale Club.
 * Todos os módulos (Perfil, MeDoll, Starplaza, Suíte, Salas e Moderação) compartilham estas interfaces.
 */

export type GameTab =
  | 'perfil'
  | 'medoll'
  | 'mercado'
  | 'starplaza'
  | 'suite'
  | 'salas'
  | 'noticias'
  | 'vip_loja'
  | 'modtools';

/** Categorias de vestuário suportadas pelo sistema de camadas da MeDoll */
export type ClothingCategory =
  | 'cabelo'
  | 'blusas'
  | 'casacos'
  | 'vestidos'
  | 'calcas'
  | 'sapatos'
  | 'acessorios';

/** Ordem fixa de empilhamento (z-index) para garantir encaixe perfeito sobre a boneca base */
export const LAYER_Z_INDEX: Record<ClothingCategory, number> = {
  sapatos: 20,
  calcas: 30,
  blusas: 40,
  vestidos: 42,
  casacos: 44,
  cabelo: 50,
  acessorios: 60,
};

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  cabelo: 'Cabelo',
  blusas: 'Blusas & Camisetas',
  casacos: 'Jaquetas & Casacos',
  vestidos: 'Vestidos',
  calcas: 'Calças & Saias',
  sapatos: 'Sapatos',
  acessorios: 'Acessórios',
};

/** Público/estilo principal da peça na Starplaza e Guarda-Roupa */
export type ItemGenderStyle = 'feminino' | 'masculino' | 'unissex';

/** Classe comercial e de raridade obrigatória para separação na Loja e Guarda-Roupa */
export type ItemClassTier = 'am' | 'vip' | 'legendary';

/** Estilo geométrico procedural 3D para peças de vestuário no motor Three.js */
export type Garment3DSilhouette =
  | 'tshirt'
  | 'silk_shirt'
  | 'cropped'
  | 'corset'
  | 'blazer'
  | 'leather_jacket'
  | 'hoodie'
  | 'turtleneck'
  | 'off_shoulder'
  | 'trench_coat'
  | 'vest_suit'
  | 'dress_slip'
  | 'dress_aline'
  | 'dress_mermaid'
  | 'dress_ballgown'
  | 'dress_blazer'
  | 'dress_mini_party'
  | 'pants_tailored'
  | 'pants_skinny'
  | 'pants_wide'
  | 'pants_cargo'
  | 'shorts'
  | 'skirt_mini'
  | 'skirt_midi'
  | 'skirt_pleated'
  | 'shoe_heels'
  | 'shoe_boots'
  | 'shoe_sneakers'
  | 'shoe_oxford'
  | 'shoe_loafers'
  | 'shoe_sandals'
  | 'acc_crown'
  | 'acc_sunglasses'
  | 'acc_necklace'
  | 'acc_bag'
  | 'acc_hat'
  | 'acc_earrings'
  | 'acc_watch'
  | 'acc_scepter'
  | 'acc_eyepatch'
  | 'acc_dragon'
  | 'acc_white_tiger';

/** Sub-local anatômico do corpo para permitir equipar múltiplos acessórios simultaneamente */
export type AccessoryBodySlot =
  | 'head'
  | 'ear'
  | 'face'
  | 'neck'
  | 'arm'
  | 'hand'
  | 'companion';

/** Estilo geométrico procedural 3D para cabelos no motor Three.js */
export type Hair3DSilhouette =
  | 'waves_long'
  | 'bob_classic'
  | 'high_bun'
  | 'ponytail_high'
  | 'straight_sleek'
  | 'curly_voluminous'
  | 'braids_twin'
  | 'pixie_chic'
  | 'layered_midi'
  | 'half_up'
  | 'executive_part'
  | 'undercut_fade'
  | 'quiff_textured'
  | 'curly_fade'
  | 'surfer_medium'
  | 'slick_back'
  | 'buzz_taper'
  | 'dreads_short'
  | 'wolf_cut'
  | 'pompadour'
  | 'base_swept'
  | 'base_chignon';

export type Material3DFinish =
  | 'cotton'
  | 'silk'
  | 'velvet'
  | 'denim'
  | 'leather'
  | 'metallic'
  | 'sequin'
  | 'crystal'
  | 'neon';

export interface ThreeItemSpec {
  garmentSilhouette?: Garment3DSilhouette;
  hairSilhouette?: Hair3DSilhouette;
  finish: Material3DFinish;
  /** Escala sutil de volume (0.92..1.18) para diferenciação única das 400 peças */
  volumeScale?: number;
  /** Comprimento relativo (0.75..1.3) para saias/vestidos/cabelos */
  lengthScale?: number;
  /** Brilho emissivo para peças Lendárias ou Neon */
  emissiveIntensity?: number;
  /** Detalhe metálico (botões, fivelas, joias, zíper) */
  metallicTrim?: boolean;
  /** Detalhe de mechas/ombre nos cabelos */
  highlightColor?: string;
}

/** Padrões têxteis e acabamentos visuais aplicados a roupas, móveis e papéis de parede */
export type DesignPattern =
  | 'solid'
  | 'striped'
  | 'plaid'
  | 'floral'
  | 'sequin'
  | 'denim'
  | 'neon';

/** Temáticas arquitetônicas de móveis, salas e papéis de parede */
export type RoomThemeCategory = 'geral' | 'boate' | 'casa' | 'bar' | 'hotel';

/** Identificadores anatômicos dos ossos do Esqueleto Modular v2.1 */
export type RigBoneId =
  | 'head'
  | 'neck'
  | 'torso'
  | 'pelvis'
  | 'left_upper_arm'
  | 'left_forearm'
  | 'right_upper_arm'
  | 'right_forearm'
  | 'left_thigh'
  | 'left_calf'
  | 'right_thigh'
  | 'right_calf'
  | 'left_foot'
  | 'right_foot';

/** Zonas oficiais de sobreposição de camadas da folha anatômica v2.1 */
export type OverlapZoneId =
  | 'zone_hair_crown'
  | 'zone_face_accessories'
  | 'zone_upper_garment'
  | 'zone_full_dress'
  | 'zone_lower_garment'
  | 'zone_footwear'
  | 'zone_hand_wrist_accessory';

/** Metadados de indexação anatômica vinculados ao esqueleto modular v2.1 */
export interface ClothingRigMetadata {
  rigSpecVersion: '2.1';
  primaryBone: RigBoneId;
  attachedBones: RigBoneId[];
  overlapZone: OverlapZoneId;
  overlapZoneLabel: string;
  anchorOrigin: { x: number; y: number };
  bounds280x520: { x: number; y: number; width: number; height: number };
}

/** Representa uma peça de roupa ou acessório do catálogo */
export interface ClothingItem {
  id: string;
  name: string;
  brand: string;
  category: ClothingCategory;
  /** Gênero obrigatório da peça para filtragem e compatibilidade anatômica */
  gender: ItemGenderStyle;
  /** Alias mantido para compatibilidade retroativa com referências legadas */
  genderStyle?: ItemGenderStyle;
  /** Classe do item: Livre (AM), Exclusivo VIP ou Lendário */
  itemClass?: ItemClassTier;
  price: number;
  zIndex: number;
  /** Define se a peça já vem desbloqueada no guarda-roupa inicial */
  starter?: boolean;
  /** Define se a peça é exclusiva da Boutique VIP */
  isVipOnly?: boolean;
  /** Define se a peça pertence à classe Lendária */
  isLegendary?: boolean;
  /** Timestamp UTC (ms) de lançamento na Starplaza (usado para janela de 24h em itens lendários) */
  launchedAt?: number;
  /** Timestamp UTC (ms) de expiração da janela de 24h na Starplaza */
  legendaryExpiresAt?: number;
  /** Especificação procedural Three.js 3D para modelagem e materiais PBR */
  threeSpec?: ThreeItemSpec;
  /** Modelo visual usado para peças criadas pelo Ateliê / Designer Global */
  templateId?: string;
  /** Coleção ou tendência de moda (ex: Streetwear, Alta Costura, Y2K, Casual Chic) */
  collectionTag?: string;
  /** Cor principal de destaque usada na miniatura e renderização */
  swatchColor: string;
  /** Cor secundária (lapelas, punhos, detalhes de acabamento) */
  secondaryColor?: string;
  /** Cor de destaque metálico, neon ou costura */
  accentColor?: string;
  /** Padrão visual de tecido */
  pattern?: DesignPattern;
  /** Descrição editorial ou de material da peça */
  description?: string;
  /** Indica se a peça foi criada por clonagem de foto real via Gemini Vision */
  aiGeneratedFromPhoto?: boolean;
  /** Data URL / caminho de imagem PNG transparente modular */
  customLayerPngUrl?: string;
  /** Ajuste horizontal (px no viewBox 280x520) da camada PNG sobre o manequim */
  layerOffsetX?: number;
  /** Ajuste vertical (px no viewBox 280x520) da camada PNG sobre o manequim */
  layerOffsetY?: number;
  /** Fator de escala da camada PNG (padrão 1.0) */
  layerScale?: number;
  /** Caixa de recorte dedicada para vitrines da Starplaza e Guarda-Roupa */
  crop_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** URL ou DataURL dedicada de miniatura isolada para vitrine */
  thumbnail_url?: string;
  /** Indexação vinculada aos ossos e zonas de sobreposição do esqueleto modular v2.1 */
  rigMetadata?: ClothingRigMetadata;
  /** Sub-slot anatômico quando category === 'acessorios' (cabeça, rosto, pescoço, braço, mão, mascote) */
  accessorySlot?: AccessoryBodySlot;
  /** Metadados opcionais de autoria/edição do Designer Global */
  collection?: string;
  vip?: boolean;
  badge?: string;
  createdBy?: string;
  customCreatedAt?: number;
}

/** Mapa de peças atualmente vestidas na MeDoll (1 peça por categoria + múltiplos acessórios por parte do corpo) */
export type EquippedOutfit = Partial<Record<ClothingCategory, string>> & {
  acessoriosSlots?: Partial<Record<AccessoryBodySlot, string>>;
};

/** Tons de pele disponíveis para personalização da MeDoll base */
export type SkinToneId = 'porcelana' | 'pessego' | 'mel' | 'cacau';

export interface SkinToneOption {
  id: SkinToneId;
  label: string;
  base: string;
  shadow: string;
  blush: string;
}

export type EyeStyleId = 'amendoado' | 'grande' | 'marcado' | 'suave';
export type EyebrowStyleId = 'fina' | 'arqueada' | 'reta' | 'grossa';
export type NoseStyleId = 'fino' | 'reto' | 'delicado' | 'arredondado';
export type MouthStyleId = 'cupido' | 'natural' | 'cheia' | 'delicada';

export interface AvatarFaceCustomization {
  // Olhos
  eyeStyle: EyeStyleId;
  eyeColor: string;
  eyesPosX?: number; // Deslocamento horizontal (-15 a +15, default 0)
  eyesPosY?: number; // Deslocamento vertical (-15 a +15, default 0)
  eyesScale?: number; // Multiplicador de escala (0.7 a 1.4, default 1.0)

  // Sobrancelhas
  eyebrowStyle: EyebrowStyleId;
  eyebrowColor?: string;
  eyebrowsPosX?: number; // (-15 a +15, default 0)
  eyebrowsPosY?: number; // (-15 a +15, default 0)
  eyebrowsScale?: number; // (0.7 a 1.4, default 1.0)

  // Nariz
  noseStyle: NoseStyleId;
  nosePosX?: number; // (-12 a +12, default 0)
  nosePosY?: number; // (-15 a +15, default 0)
  noseScale?: number; // (0.7 a 1.4, default 1.0)

  // Boca & Lábios
  mouthStyle: MouthStyleId;
  mouthColor?: string;
  mouthPosX?: number; // (-12 a +12, default 0)
  mouthPosY?: number; // (-15 a +15, default 0)
  mouthScale?: number; // (0.7 a 1.4, default 1.0)
}

export interface ColorPaletteOption {
  id: string;
  label: string;
  hex: string;
}

export type EyeColorOption = ColorPaletteOption;

export interface FacePreset {
  id: string;
  name: string;
  description?: string;
  isBuiltIn?: boolean;
  config: AvatarFaceCustomization;
  createdAt?: string;
}

export const EYE_COLOR_PALETTE: ColorPaletteOption[] = [
  { id: 'cyan', label: 'Azul Ciano', hex: '#38BDF8' },
  { id: 'emerald', label: 'Verde Esmeralda', hex: '#10B981' },
  { id: 'hazel', label: 'Castanho Mel', hex: '#92400E' },
  { id: 'indigo', label: 'Azul Profundo', hex: '#6366F1' },
  { id: 'violet', label: 'Violeta Místico', hex: '#8B5CF6' },
  { id: 'amber', label: 'Âmbar Ouro', hex: '#D97706' },
  { id: 'dark', label: 'Castanho Noite', hex: '#27272A' },
  { id: 'ruby', label: 'Rubi Intenso', hex: '#E11D48' },
  { id: 'ocean', label: 'Azul Safira', hex: '#0284C7' },
];

export const EYEBROW_COLOR_PALETTE: ColorPaletteOption[] = [
  { id: 'black', label: 'Preto Noite', hex: '#181412' },
  { id: 'ebony', label: 'Ébano Profundo', hex: '#2A1D17' },
  { id: 'dark_brown', label: 'Castanho Escuro', hex: '#4A2E1B' },
  { id: 'chestnut', label: 'Castanho Chocolate', hex: '#6B4226' },
  { id: 'honey', label: 'Castanho Mel', hex: '#92400E' },
  { id: 'blonde', label: 'Loiro Dourado', hex: '#D97706' },
  { id: 'copper', label: 'Ruivo Cobre', hex: '#B45309' },
  { id: 'silver', label: 'Platina / Grisalho', hex: '#94A3B8' },
  { id: 'pink', label: 'Rosa Pastel', hex: '#F472B6' },
];

export const LIP_COLOR_PALETTE: ColorPaletteOption[] = [
  { id: 'natural', label: 'Natural Suave', hex: '#BC707B' },
  { id: 'cupid_rose', label: 'Rosa Cupido', hex: '#C65B6F' },
  { id: 'nude', label: 'Nude Aveludado', hex: '#D49B8E' },
  { id: 'chic_pink', label: 'Rosa Chic', hex: '#EC4899' },
  { id: 'red_diva', label: 'Vermelho Diva', hex: '#DC2626' },
  { id: 'wine', label: 'Vinho Nobre', hex: '#881337' },
  { id: 'cherry', label: 'Cereja Pop', hex: '#9F1239' },
  { id: 'coral', label: 'Coral Verão', hex: '#F97316' },
  { id: 'chocolate', label: 'Chocolate Velvet', hex: '#713F12' },
];

export const DEFAULT_FACE_CUSTOMIZATION: AvatarFaceCustomization = {
  eyeStyle: 'amendoado',
  eyeColor: '#92400E',
  eyesPosX: 0,
  eyesPosY: 0,
  eyesScale: 1.0,

  eyebrowStyle: 'arqueada',
  eyebrowColor: '#2A1D17',
  eyebrowsPosX: 0,
  eyebrowsPosY: 0,
  eyebrowsScale: 1.0,

  noseStyle: 'fino',
  nosePosX: 0,
  nosePosY: 0,
  noseScale: 1.0,

  mouthStyle: 'cupido',
  mouthColor: '#C65B6F',
  mouthPosX: 0,
  mouthPosY: 0,
  mouthScale: 1.0,
};

export const BUILTIN_FACE_PRESETS: FacePreset[] = [
  {
    id: 'preset_glamour',
    name: 'Glamour Atelier',
    description: 'Olhar marcante com delineado expressivo, lábios cheios em tom vinho e sobrancelha arqueada.',
    isBuiltIn: true,
    config: {
      eyeStyle: 'marcado',
      eyeColor: '#38BDF8',
      eyesPosX: 2,
      eyesPosY: 1,
      eyesScale: 1.15,
      eyebrowStyle: 'arqueada',
      eyebrowColor: '#181412',
      eyebrowsPosX: 1,
      eyebrowsPosY: 3,
      eyebrowsScale: 1.1,
      noseStyle: 'delicado',
      nosePosX: 0,
      nosePosY: 1,
      noseScale: 0.9,
      mouthStyle: 'cheia',
      mouthColor: '#881337',
      mouthPosX: 0,
      mouthPosY: -1,
      mouthScale: 1.15,
    },
  },
  {
    id: 'preset_natural',
    name: 'Natural Chic',
    description: 'Proporções clássicas equilibradas, olhos amendoados cor de mel e boca em arco suave.',
    isBuiltIn: true,
    config: {
      eyeStyle: 'amendoado',
      eyeColor: '#92400E',
      eyesPosX: 0,
      eyesPosY: 0,
      eyesScale: 1.0,
      eyebrowStyle: 'fina',
      eyebrowColor: '#4A2E1B',
      eyebrowsPosX: 0,
      eyebrowsPosY: 0,
      eyebrowsScale: 1.0,
      noseStyle: 'fino',
      nosePosX: 0,
      nosePosY: 0,
      noseScale: 1.0,
      mouthStyle: 'natural',
      mouthColor: '#BC707B',
      mouthPosX: 0,
      mouthPosY: 0,
      mouthScale: 1.0,
    },
  },
  {
    id: 'preset_anime',
    name: 'Anime Doll',
    description: 'Olhos grandes violeta aumentados e espaçados, nariz miniatura e boca delicada rosada.',
    isBuiltIn: true,
    config: {
      eyeStyle: 'grande',
      eyeColor: '#8B5CF6',
      eyesPosX: 3,
      eyesPosY: 2,
      eyesScale: 1.3,
      eyebrowStyle: 'fina',
      eyebrowColor: '#2A1D17',
      eyebrowsPosX: 2,
      eyebrowsPosY: 5,
      eyebrowsScale: 0.9,
      noseStyle: 'delicado',
      nosePosX: 0,
      nosePosY: 3,
      noseScale: 0.75,
      mouthStyle: 'delicada',
      mouthColor: '#EC4899',
      mouthPosX: 0,
      mouthPosY: 1,
      mouthScale: 0.85,
    },
  },
  {
    id: 'preset_striking',
    name: 'Olhar Marcado',
    description: 'Olhos noite profundos, sobrancelhas grossas escuras e lábios com arco definido.',
    isBuiltIn: true,
    config: {
      eyeStyle: 'marcado',
      eyeColor: '#27272A',
      eyesPosX: -1,
      eyesPosY: -1,
      eyesScale: 1.1,
      eyebrowStyle: 'grossa',
      eyebrowColor: '#181412',
      eyebrowsPosX: 0,
      eyebrowsPosY: -2,
      eyebrowsScale: 1.2,
      noseStyle: 'reto',
      nosePosX: 0,
      nosePosY: 0,
      noseScale: 1.05,
      mouthStyle: 'cupido',
      mouthColor: '#DC2626',
      mouthPosX: 0,
      mouthPosY: -2,
      mouthScale: 1.08,
    },
  },
  {
    id: 'preset_elegant',
    name: 'Elegante & Suave',
    description: 'Feições finas e harmoniosas com olhos esmeralda, nariz reto estilizado e lábio nude.',
    isBuiltIn: true,
    config: {
      eyeStyle: 'suave',
      eyeColor: '#10B981',
      eyesPosX: 0,
      eyesPosY: 1,
      eyesScale: 1.05,
      eyebrowStyle: 'reta',
      eyebrowColor: '#6B4226',
      eyebrowsPosX: 0,
      eyebrowsPosY: 1,
      eyebrowsScale: 1.0,
      noseStyle: 'delicado',
      nosePosX: 0,
      nosePosY: -1,
      noseScale: 0.92,
      mouthStyle: 'cupido',
      mouthColor: '#D49B8E',
      mouthPosX: 0,
      mouthPosY: 0,
      mouthScale: 1.0,
    },
  },
  {
    id: 'preset_vamp',
    name: 'Vamp Romântico',
    description: 'Estética gótica refinada com olhos rubi intensos, sobrancelhas arqueadas e lábios cereja escuro.',
    isBuiltIn: true,
    config: {
      eyeStyle: 'marcado',
      eyeColor: '#E11D48',
      eyesPosX: 1,
      eyesPosY: 0,
      eyesScale: 1.12,
      eyebrowStyle: 'arqueada',
      eyebrowColor: '#181412',
      eyebrowsPosX: 1,
      eyebrowsPosY: 2,
      eyebrowsScale: 1.05,
      noseStyle: 'fino',
      nosePosX: 0,
      nosePosY: 0,
      noseScale: 0.95,
      mouthStyle: 'cheia',
      mouthColor: '#9F1239',
      mouthPosX: 0,
      mouthPosY: -1,
      mouthScale: 1.12,
    },
  },
];

export type FurnitureTemplateId =
  | 'tpl_sofa'
  | 'tpl_mesa'
  | 'tpl_decoracao'
  | 'tpl_dj'
  | 'tpl_pista'
  | 'tpl_bar'
  | 'tpl_banqueta'
  | 'tpl_cama'
  | 'tpl_cozinha'
  | 'tpl_banheira'
  | 'tpl_lustre';

/** Definição de um móvel disponível para decorar a Suíte 2D */
export interface FurnitureDef {
  id: string;
  name: string;
  category: 'Assentos' | 'Superfícies' | 'Decoração';
  /** Tema arquitetônico (Boate, Casa, Bar, Hotel ou Geral) */
  themeTag?: RoomThemeCategory;
  width: number;
  height: number;
  /** Preço em Starcoins */
  price: number;
  /** Ordem padrão sugerida ao inserir na sala */
  defaultZ: number;
  /** Define se o móvel faz parte do conjunto inicial da Suíte */
  starter?: boolean;
  /** Define se o móvel é exclusivo para contas VIP */
  isVipOnly?: boolean;
  /** Define se o móvel pertence à coleção Lendária VIP */
  isLegendary?: boolean;
  /** Cor de destaque para móveis */
  swatchColor?: string;
  /** Cor secundária estrutural */
  secondaryColor?: string;
  /** Cor de brilho/metais */
  accentColor?: string;
  /** Padrão decorativo */
  pattern?: DesignPattern;
  /** Descrição do móvel */
  description?: string;
  /** Modelo estrutural usado para renderização dinâmica */
  templateId?: FurnitureTemplateId;
  /** Indica se foi criado a partir de foto real via Gemini Vision */
  aiGeneratedFromPhoto?: boolean;
}

/** Modelo de Sala Comum ou Sala Exclusiva VIP vendida na Starplaza */
export interface PurchasableRoomItem {
  id: string;
  name: string;
  subtitle: string;
  themeTag: RoomThemeCategory;
  backdropTheme: RoomBackdropTheme;
  price: number;
  isVipOnly?: boolean;
  isLegendary?: boolean;
  starter?: boolean;
  accentColor: string;
  secondaryColor: string;
  walkMinY: number;
  walkMaxY: number;
}

/** Papel de parede / Plano de fundo arquitetônico aplicável em Suítes e Salas */
export interface PurchasableWallpaperItem {
  id: string;
  name: string;
  subtitle: string;
  themeTag: RoomThemeCategory;
  price: number;
  isVipOnly?: boolean;
  starter?: boolean;
  wallTopColor: string;
  wallBottomColor: string;
  wainscotColor: string;
  floorTopColor: string;
  floorBottomColor: string;
  accentColor: string;
  pattern?: DesignPattern;
  description?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

/** Instância de um móvel posicionado dentro da Suíte (salvo no localStorage) */
export interface PlacedFurniture {
  instanceId: string;
  furnitureId: string;
  /** Posição horizontal em pixels dentro do palco da Suíte */
  x: number;
  /** Posição vertical em pixels dentro do palco da Suíte */
  y: number;
  /** Rotação 3D no eixo Y em graus (0..360) */
  rotationY?: number;
  /** Ordem de sobreposição na sala */
  zIndex: number;
  /** Espelhamento horizontal para ajustar orientação do móvel */
  flipped: boolean;
}

export type SuiteThemeId = 'paris_marfim' | 'milan_sage' | 'noite_veludo';

/** Posição da MeDoll dentro do palco 2D da Suíte */
export interface SuiteAvatarPosition {
  x: number;
  y: number;
  zIndex: number;
  flipped?: boolean;
}

export interface SuiteLayoutState {
  theme: SuiteThemeId;
  /** ID opcional de papel de parede adquirido na Starplaza aplicado à Suíte */
  wallpaperId?: string;
  items: PlacedFurniture[];
  avatarPos?: SuiteAvatarPosition;
  lastSavedAt: string;
}

/** Gênero / Estilo de base do avatar escolhido no cadastro */
export type AvatarGender = 'feminino' | 'masculino' | 'neutro';

/** Status de presença em tempo real selecionável pelo jogador no Meu Perfil */
export type PresenceStatus = 'online' | 'ausente' | 'offline';

/** Definição de País e Fuso Horário configurável na conta */
export interface AccountCountryOption {
  code: string;
  name: string;
  cityLabel: string;
  timezone: string;
  ipPrefix: string;
}

/** Servidores regionais/idioma disponíveis no Starlight Atelier */
export type ServerRegion = 'BR' | 'ES' | 'EN';

/** Papel do usuário para controle de acesso ao painel Mod Tools */
export type UserRole = 'admin' | 'player';

/** Categoria visual e funcional do crachá de cargo na Equipe / Staff */
export type StaffRoleTier =
  | 'admin'
  | 'mod_br'
  | 'mod_es'
  | 'mod_en'
  | 'cm_br'
  | 'cm_es'
  | 'cm_en'
  | 'designer_global';

/** Especialidade autônoma de Inteligência Artificial atribuída a um Bot da Staff */
export type BotAiSpecialty = 'maintenance' | 'moderation' | 'hybrid' | 'designer';

/** Registro persistido no Log de Manutenção e Moderação Autônoma da IA */
export interface AiMaintenanceLogEntry {
  id: string;
  timestamp: number;
  botId: string;
  botName: string;
  botUsername: string;
  serverRegion?: ServerRegion;
  category: 'maintenance' | 'moderation' | 'design';
  issueDetected: string;
  actionTaken: string;
  status: 'repaired' | 'banned' | 'healthy' | 'warning' | 'muted' | 'created';
}

/** Conta de usuário salva no localStorage (Fonte Única de Verdade) */
export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  email: string;
  password: string;
  /** Hash criptográfico scrypt armazenado no banco central do servidor */
  password_hash?: string;
  avatarGender: AvatarGender;
  role: UserRole;
  staffRoleTier?: StaffRoleTier;
  staffRoleTitle?: string;
  /** Servidor de atuação para moderadores e gerentes regionais (BR, ES, EN) */
  serverRegion?: ServerRegion;
  /** Indica se a conta possui assinatura VIP para itens dourados exclusivos */
  isVip?: boolean;
  /** Indica perfil automático/bot gerenciado pelo Administrador */
  isBot?: boolean;
  /** Especialidade de IA autônoma do Bot */
  botAiSpecialty?: BotAiSpecialty;
  /** Define se o módulo de IA do bot está ligado em tempo real */
  botActive?: boolean;
  /** Define se o bot circula livremente pelas salas públicas (true) ou fica fora das salas (false) */
  botRoamRooms?: boolean;
  isPrimaryOwner?: boolean;
  createdAt: string;
  /** Foto de perfil isolada por UID exclusivo no banco de dados */
  profilePic?: string;
}

/** Usuário ou conta registrada exibida no painel de Moderação (Mod Tools) */
export interface MockUser {
  id: string;
  username: string;
  displayName?: string;
  level: number;
  starcoins: number;
  status: 'active' | 'banned';
  banReason?: string;
  joinedAt: string;
  role?: UserRole;
  staffRoleTier?: StaffRoleTier;
  serverRegion?: ServerRegion;
  isVip?: boolean;
  isPrimaryOwner?: boolean;
  simulatedIp?: string;
  countryCode?: string;
}

/** Modo de exibição do ícone oficial de perfil do jogador */
export type AvatarDisplayMode = 'medoll' | 'photo';

/** Temas animados disponíveis para o banner em movimento do perfil */
export type ProfileBannerPresetId =
  | 'atelier_aurora'
  | 'runway_gold'
  | 'midnight_velvet'
  | 'botanical_silk'
  | 'sunset_rose'
  | 'custom_image';

/** Configuração persistida do banner animado exibido atrás e acima do perfil */
export interface ProfileBannerConfig {
  presetId: ProfileBannerPresetId;
  customImageUrl?: string;
  motionSpeed?: 'slow' | 'medium';
}

/** Estado individual de progresso salvo por conta de usuário */
export interface PlayerProgressState {
  catalogSchemaVersion?: number;
  /** Nível atual da conta (1..1000; Admin Geral inicia em 874) */
  level?: number;
  /** Pontos de XP acumulados dentro do nível atual */
  xp?: number;
  /** Timestamp do último ganho de XP por entrada (login) */
  lastLoginXpAt?: number;
  /** Último valor de XP ganho no login */
  lastLoginXpGained?: number;
  starcoins: number;
  ownedItemIds: string[];
  /** Móveis desbloqueados/comprados pelo jogador para decorar a Suíte */
  ownedFurnitureIds?: string[];
  /** Modelos de Sala (comuns e VIP) comprados na Starplaza para criar salas personalizadas */
  ownedRoomTemplateIds?: string[];
  /** Planos de fundo / papéis de parede comprados na Starplaza */
  ownedWallpaperIds?: string[];
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  /** Imagem customizada enviada do computador (Data URL) */
  customAvatarUrl?: string;
  /** Foto de perfil isolada por UID exclusivo */
  profilePic?: string;
  /** Define se o ícone oficial usa a MeDoll ao vivo ou a foto enviada */
  avatarDisplayMode: AvatarDisplayMode;
  /** Banner animado exibido acima e por trás do avatar e informações da conta */
  profileBanner?: ProfileBannerConfig;
  /** Biografia / Recado livre exibido e editado na aba Meu Perfil */
  bio: string;
  /** Status de presença em tempo real (Online / Ausente / Offline) */
  presenceStatus: PresenceStatus;
  /** Código do país de origem da conta */
  countryCode: string;
  /** Fuso horário IANA sincronizado com o relógio local */
  timezone: string;
  /** Endereço IP simulado de conexão para exibição técnica e moderação */
  simulatedIp: string;
  /** Lista de nomes de usuário (normalizados) adicionados como amigos */
  friendUsernames?: string[];
  suite: SuiteLayoutState;
  faceCustomization?: AvatarFaceCustomization;
}

/** Mensagem privada entre jogadores salva no localStorage */
export interface PrivateMessage {
  id: string;
  fromUsername: string;
  toUsername: string;
  text: string;
  createdAt: number;
}

/** Dados consolidados para exibir o modal de Perfil Público Visitante de qualquer jogador ou Staff */
export interface PublicProfileSummary {
  accountId?: string;
  username: string;
  displayName: string;
  createdAt?: string;
  role: UserRole;
  staffRoleTier?: StaffRoleTier;
  staffRoleTitle?: string;
  serverRegion?: ServerRegion;
  isVip?: boolean;
  level: number;
  xp?: number;
  xpRequired?: number;
  starcoins: number;
  presenceStatus: PresenceStatus;
  staffStatus?: StaffStatus;
  bio: string;
  countryCode: string;
  timezone: string;
  simulatedIp: string;
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  customAvatarUrl?: string;
  avatarDisplayMode: AvatarDisplayMode;
  profileBanner?: ProfileBannerConfig;
  suite: SuiteLayoutState;
  faceCustomization?: AvatarFaceCustomization;
}

/** Status em tempo real exibido no card da Equipe de Moderação */
export type StaffStatus = 'online' | 'ausente' | 'em_ronda';

/** Membro oficial da Equipe de Moderação / Staff exibido na aba Moderação */
export interface StaffMember {
  id: string;
  /** ID da conta de usuário vinculada no localStorage para sincronização em tempo real */
  accountId?: string;
  username: string;
  roleTitle: string;
  roleTier: StaffRoleTier;
  status: StaffStatus;
  bio: string;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  equipped: EquippedOutfit;
  isPrimaryOwner?: boolean;
}

/** Identificador de sala global (salas padrão ou criadas por jogadores) */
export type RoomId = string;

/** Fundos arquitetônicos disponíveis para salas padrão e criadas por jogadores */
export type RoomBackdropTheme =
  | 'lounge_party'
  | 'quarto_cozy'
  | 'lounge_principal'
  | 'cafe_starlight'
  | 'festa_cobertura'
  | 'atelier_rosa'
  | 'boate_neon'
  | 'hotel_royal_vip'
  | 'bar_lounge'
  | 'cobertura_diamante_vip'
  | 'casa_estar_moderna'
  | 'estudio_3d_designer'
  | 'lounge_party_natal'
  | 'lounge_party_halloween'
  | 'ilha_tropical'
  | 'floresta_piquenique'
  | 'ilha_coqueiro'
  | 'chao_plano_custom';

/** Item na fila de músicas da Cabine de DJ */
export interface RoomDjQueuedTrack {
  id: string;
  videoId: string;
  youtubeUrl: string;
  title: string;
  addedBy: string;
}

/** Estado sincronizado de música da Cabine de DJ por sala (via YouTube) */
export interface RoomDjTrack {
  videoId: string;
  youtubeUrl: string;
  title: string;
  addedBy: string;
  startedAt: number;
  isPlaying: boolean;
  queue?: RoomDjQueuedTrack[];
}

/** Mobília interativa e obstáculos de colisão em salas 2D */
export interface RoomInteractiveProp {
  id: string;
  kind: 'chair' | 'sofa' | 'table' | 'decor';
  label: string;
  /** Coordenadas percentuais (0..100) no palco da sala */
  x: number;
  y: number;
  /** Rotação 3D no eixo Y em graus (0..360) */
  rotationY?: number;
  /** Tipo opcional de decoração 3D quando kind === 'decor' */
  decorType?: 'tree' | 'pumpkin' | 'gift' | 'crystal' | 'generic';
  /** Estilo opcional da cadeira quando kind === 'chair' */
  chairStyle?: 'standard' | 'wooden_beach';
  /** Ponto de assento em % quando clicável (chair/sofa) */
  seatX?: number;
  seatY?: number;
  /** Raio de colisão em % para mesas/obstáculos sólidos */
  collisionRadius?: number;
  collidable?: boolean;
  primaryColor?: string;
  accentColor?: string;
}

/** Definição de uma Sala Global no Lobby */
export interface RoomDef {
  id: RoomId;
  name: string;
  subtitle: string;
  backdropTheme: RoomBackdropTheme;
  /** UID do proprietário oficial (salas oficiais pertencem ao Admin Geral) */
  ownerId?: string;
  isOfficial?: boolean;
  /** Móveis interativos (cadeiras sentáveis e mesas com colisão) */
  interactiveProps?: RoomInteractiveProp[];
  /** Papel de parede personalizado aplicado à sala */
  wallpaperId?: string;
  /** Imagem de plano de fundo carregada do PC do jogador (Data URL comprimida) */
  customBackgroundImageUrl?: string;
  /** Limite superior e inferior do piso caminhável em coordenadas percentuais (0..100) */
  walkMinY: number;
  walkMaxY: number;
  visibility: 'public' | 'private';
  serverRegion?: ServerRegion;
  password?: string;
  inviteCode?: string;
  creatorUsername?: string;
  /** Aviso local exibido dentro da sala e editável pelo dono da sala */
  roomNotice?: string;
  isCustom?: boolean;
  employees?: Array<{
    userId: string;
    username: string;
    jobTitle: string;
    wage: number;
    period: 'hora' | 'semana' | 'mes';
    lastPaidAt?: number;
  }>;
  supportStaff?: string[];
}

/** Estado sincronizado de um avatar conectado em uma sala */
export interface RoomAvatarPresence {
  clientId: string;
  username: string;
  role: UserRole;
  staffRoleTier?: StaffRoleTier;
  isVip?: boolean;
  level?: number;
  officialRoleLabel?: string;
  /** Cargo atribuído na sala customizada atual (apenas exibido dentro desta sala, sem emblema) */
  roomJobTitle?: string;
  /** Cargo oficial de Suporte na sala oficial atual (recebe emblema S dourado brilhante) */
  isRoomSupport?: boolean;
  roomId: RoomId;
  /** Coordenada horizontal em percentual da largura do palco (8..92) */
  x: number;
  /** Coordenada vertical em percentual da altura do palco (walkMinY..walkMaxY) */
  y: number;
  facing: 'left' | 'right';
  isSeated?: boolean;
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  faceCustomization?: AvatarFaceCustomization;
  customAvatarUrl?: string;
  avatarDisplayMode?: AvatarDisplayMode;
  lastSeen: number;
  isBot?: boolean;
  /** Última mensagem enviada para balão de fala sobre a cabeça */
  lastMessage?: string;
  lastMessageAt?: number;
}

/** Snapshot de avatar anexado a uma mensagem para exibir foto oficial no chat */
export interface ChatSenderAvatar {
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  customAvatarUrl?: string;
  avatarDisplayMode?: AvatarDisplayMode;
}

/** Mensagem de chat em tempo real dentro de uma sala */
export interface RoomChatMessage {
  id: string;
  roomId: RoomId;
  senderUsername: string;
  senderRole: UserRole | 'system';
  senderStaffTier?: StaffRoleTier;
  senderIsVip?: boolean;
  text: string;
  createdAt: number;
  senderAvatar?: ChatSenderAvatar;
}

/** Registro de mute temporário (5 min) aplicado pela moderação progressiva */
export interface MutedUserEntry {
  until: number;
  reason: string;
  by: string;
  server: ServerRegion;
}

/** Denúncia enviada via /report nas salas */
export interface RoomReportEntry {
  id: string;
  reporter: string;
  target: string;
  reason: string;
  server: ServerRegion;
  roomId: RoomId;
  createdAt: number;
  handledByBot?: string;
}

export type NewsCategory =
  | 'Lançamentos'
  | 'Coleção VIP'
  | 'Comunidade & Conduta'
  | 'Atualizações';

/** Post editorial da aba Notícias publicado pela Staff */
export interface NewsPost {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
  imageCaption?: string;
  category: NewsCategory;
  serverRegion: ServerRegion;
  authorAccountId?: string;
  authorUsername: string;
  authorDisplayName: string;
  authorRoleTier: StaffRoleTier;
  createdAt: number;
  featuredItemIds?: string[];
}

/** Estado compartilhado da sala e moderação (aplicado a todos os perfis) */
export interface WorldModerationState {
  catalogSchemaVersion?: number;
  globalNotice: string;
  /** Avisos comunitários e de eventos por servidor regional (geridos pelo Admin ou Gerente da Comunidade) */
  serverNotices?: Partial<Record<ServerRegion, string>>;
  users: MockUser[];
  deletedItemIds: string[];
  /** IDs de itens marcados pelo Administrador como "Vendido" na Starplaza (bloqueia novas compras na loja) */
  soldOutItemIds?: string[];
  /** Timestamp real (ms) do lançamento de itens lendários na Starplaza (duração de 24h reais) */
  legendaryLaunchTimestamps?: Record<string, number>;
  /** Peças de vestuário adicionadas pelo Designer Global ou Ateliê de Criação do Admin */
  customClothingCatalog?: ClothingItem[];
  /** Móveis adicionados pelo Designer Global ou Ateliê de Criação do Admin */
  customFurnitureCatalog?: FurnitureDef[];
  /** Modelos de Sala (comuns/VIP) adicionados dinamicamente */
  customRoomCatalog?: PurchasableRoomItem[];
  /** Papéis de parede / planos de fundo adicionados dinamicamente */
  customWallpaperCatalog?: PurchasableWallpaperItem[];
  /** Postagens editoriais e anúncios com fotos exibidos na aba Notícias */
  newsPosts?: NewsPost[];
  /** Registro de relógio real para ciclo autônomo de 2 horas do Designer Global */
  lastDesignerCreationAt?: number;
  /** Registro de relógio real para lançamentos semanais VIP (7 dias) */
  lastWeeklyVipReleaseAt?: number;
  /** Registro da última auditoria de roupas executada pelo Designer Global */
  lastDesignerAuditAt?: number;
  /** Usuários com mute temporário indexados por username normalizado */
  mutedUsers?: Record<string, MutedUserEntry>;
  /** Contagem de advertências progressivas indexada por username normalizado */
  warningCounts?: Record<string, number>;
  /** Registro de denúncias feitas pelos jogadores via /report */
  reports?: RoomReportEntry[];
  /** Campo legado mantido apenas opcional para compatibilidade na leitura inicial; a Staff é filtrada dinamicamente das contas */
  staffMembers?: StaffMember[];
  bannedWords: string[];
}

/** Estado global legado/unificado usado em memória pelo App */
export interface PersistedGameState extends PlayerProgressState, WorldModerationState {}

/** Mensagem dentro de um Ticket salvo entre jogador e Community Manager */
export interface SupportChatMessage {
  id: string;
  senderRole: 'player' | 'cm' | 'admin' | 'moderator';
  sender?: 'user' | 'staff' | 'moderator';
  senderName: string;
  text: string;
  createdAt: number;
}

/** Ticket de atendimento salvo na tela inicial ou dentro do jogo */
export interface SupportTicket {
  id: string;
  requesterAccountId?: string;
  requesterUsername: string;
  requesterId?: string;
  email?: string;
  category?: 'login' | 'ban_review' | 'economia' | 'bug' | 'geral';
  serverRegion?: ServerRegion;
  subject: string;
  messages: SupportChatMessage[];
  status: 'open' | 'answered' | 'resolved';
  assignedModeratorUsername?: string;
  assignedCmUsername?: string;
  createdAt: number;
  updatedAt: number;
}

export type PremiumOrderType = 'am_pack' | 'vip';
export type PremiumOrderStatus = 'pending' | 'credited' | 'rejected';

export interface PremiumOrderMessage {
  id: string;
  senderRole: 'player' | 'cm' | 'admin';
  senderName: string;
  text: string;
  attachmentImageUrl?: string;
  createdAt: number;
}

export interface PremiumOrder {
  id: string;
  requesterAccountId: string;
  requesterUsername: string;
  requesterDisplayName?: string;
  packId: string;
  packTitle: string;
  priceLabel: string;
  orderType: PremiumOrderType;
  amAmount: number;
  bonusAmAmount?: number;
  pixKeyUsed: string;
  receiptImageUrl?: string;
  messages: PremiumOrderMessage[];
  status: PremiumOrderStatus;
  creditedByUsername?: string;
  creditedAt?: number;
  decisionNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PremiumPixConfig {
  pixKey: string;
  updatedBy?: string;
  updatedAt?: number;
}

/** Solicitação / Revisão de banimento na fila do Moderador */
export interface BanReviewRequest {
  id: string;
  targetAccountId?: string;
  targetUserId?: string;
  targetUsername: string;
  reason: string;
  appealMessage?: string;
  moderatorNote?: string;
  serverRegion?: ServerRegion;
  status: 'pending' | 'approved_unban' | 'upheld';
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt?: number;
}

/** Métrica em tempo real da saúde de uma sala multiplayer */
export interface RoomHealthMetric {
  roomId: RoomId;
  roomName: string;
  serverRegion?: ServerRegion;
  status: 'Estável' | 'Crítica';
  latencyMs: number;
  packetDrops?: number;
  packetDropRate?: number;
  wsErrorsPerMin: number;
  activePlayers?: number;
  activeClients?: number;
  simulatedSpike?: boolean;
  lastCheckedAt: number;
  lastTerminatedAt?: number;
  terminatedAt?: number;
}

/** Identificadores das 4 Mesas de Trabalho interativas nas salas da Staff */
export type StaffWorkDeskType =
  | 'admin_desk'
  | 'cm_control_desk'
  | 'moderator_desk'
  | 'designer_workbench';

/** Anúncio de item no Mercado P2P entre jogadores */
export interface MarketListing {
  id: string;
  itemId: string;
  sellerAccountId: string;
  sellerUsername: string;
  sellerDisplayName?: string;
  price: number;
  createdAt: number;
  status: 'active' | 'sold' | 'cancelled';
  buyerAccountId?: string;
  buyerUsername?: string;
  soldAt?: number;
}

/** Mensagem no canal direto entre Suporte Oficial e Equipe de Moderadores na aba Moderação */
export interface SupportModMessage {
  id: string;
  senderAccountId: string;
  senderUsername: string;
  senderRoleLabel: string;
  isSupport: boolean;
  text: string;
  createdAt: number;
}

