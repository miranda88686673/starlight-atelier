import newsStreetwearUsImg from '../assets/images/news_streetwear_us_1794575515807.jpg';
import newsVipLegendaryImg from '../assets/images/news_vip_legendary_1794575516493.jpg';
import newsRunwayEventImg from '../assets/images/news_runway_event_1794575517773.jpg';
import newsAtelierFurnitureImg from '../assets/images/news_atelier_furniture_1794575518176.jpg';
import {
  ClothingItem,
  FurnitureDef,
  LAYER_Z_INDEX,
  MockUser,
  NewsPost,
  PlacedFurniture,
  PurchasableRoomItem,
  PurchasableWallpaperItem,
  RoomAvatarPresence,
  RoomDef,
  SkinToneOption,
  StaffMember,
} from '../types/game';

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

/** Versão do catálogo 3D: incrementa para zerar inventários e looks legados */
export const CATALOG_SCHEMA_VERSION = 3;

export const STARTER_IDS_BY_GENDER: Record<'feminino' | 'masculino' | 'neutro', {
  cabelo: string;
  blusas: string;
  calcas: string;
  sapatos: string;
  owned: string[];
}> = {
  feminino: {
    cabelo: 'f_hair_01',
    blusas: 'f_top_01',
    calcas: 'f_bottom_01',
    sapatos: 'f_shoes_01',
    owned: ['f_hair_01', 'f_hair_02', 'f_top_01', 'f_bottom_01', 'f_shoes_01'],
  },
  masculino: {
    cabelo: 'm_hair_01',
    blusas: 'm_top_01',
    calcas: 'm_bottom_01',
    sapatos: 'm_shoes_01',
    owned: ['m_hair_01', 'm_hair_02', 'm_top_01', 'm_bottom_01', 'm_shoes_01'],
  },
  neutro: {
    cabelo: 'f_hair_01',
    blusas: 'f_top_01',
    calcas: 'f_bottom_01',
    sapatos: 'f_shoes_01',
    owned: [
      'f_hair_01',
      'f_hair_02',
      'f_top_01',
      'f_bottom_01',
      'f_shoes_01',
      'm_hair_01',
      'm_top_01',
      'm_bottom_01',
      'm_shoes_01',
    ],
  },
};

interface PaletteSwatch {
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  pattern?: ClothingItem['pattern'];
}

const FASHION_PALETTES: PaletteSwatch[] = [
  { label: 'Obsidiana', primary: '#1E1D24', secondary: '#34323D', accent: '#D4AF37', pattern: 'solid' },
  { label: 'Marfim Imperial', primary: '#F4EDE2', secondary: '#DECBB0', accent: '#C59B4D', pattern: 'solid' },
  { label: 'Carmim Atelier', primary: '#8F1D3D', secondary: '#591025', accent: '#F3D08E', pattern: 'solid' },
  { label: 'Safira Noturna', primary: '#1D3557', secondary: '#2D4F7C', accent: '#E2E8F0', pattern: 'solid' },
  { label: 'Esmeralda Royale', primary: '#115E48', secondary: '#1B7A5E', accent: '#FBBF24', pattern: 'solid' },
  { label: 'Rosé Quartzo', primary: '#DDA0B1', secondary: '#BA768B', accent: '#FFF1F2', pattern: 'floral' },
  { label: 'Champagne Seda', primary: '#E6CFA8', secondary: '#C9AD7F', accent: '#FAF5EC', pattern: 'solid' },
  { label: 'Índigo Denim', primary: '#3A5A85', secondary: '#263E5E', accent: '#D97706', pattern: 'denim' },
  { label: 'Ametista Velvet', primary: '#5B2C6F', secondary: '#3E1C4D', accent: '#E9D5FF', pattern: 'solid' },
  { label: 'Terracota Milano', primary: '#A84B31', secondary: '#7B321F', accent: '#F5E1C8', pattern: 'plaid' },
  { label: 'Prata Lunar', primary: '#CBD5E1', secondary: '#94A3B8', accent: '#F8FAFC', pattern: 'sequin' },
  { label: 'Ciano Neon', primary: '#0EA5E9', secondary: '#0F172A', accent: '#38BDF8', pattern: 'neon' },
  { label: 'Verde Sálvia', primary: '#6E8875', secondary: '#4C6352', accent: '#EAE0D2', pattern: 'striped' },
  { label: 'Caramelo Couro', primary: '#8C5230', secondary: '#5C331A', accent: '#EAB308', pattern: 'solid' },
  { label: 'Ouro Solar', primary: '#D4A037', secondary: '#9E711C', accent: '#FEF3C7', pattern: 'sequin' },
  { label: 'Grafite Urbano', primary: '#3F444E', secondary: '#252930', accent: '#94A3B8', pattern: 'striped' },
];

interface HairColorDef {
  label: string;
  base: string;
  highlight: string;
}

const HAIR_COLORS: HairColorDef[] = [
  { label: 'Ébano Noturno', base: '#1E1B1F', highlight: '#3B343D' },
  { label: 'Castanho Expresso', base: '#3F281E', highlight: '#634131' },
  { label: 'Caramelo Mel', base: '#9B6538', highlight: '#C98E55' },
  { label: 'Loiro Champagne', base: '#DFC088', highlight: '#F4DFB4' },
  { label: 'Platinado Gelo', base: '#EAECEF', highlight: '#FFFFFF' },
  { label: 'Ruivo Acobreado', base: '#9E3D28', highlight: '#CC6246' },
  { label: 'Borgonha Vinho', base: '#5E1A2D', highlight: '#8E2D47' },
  { label: 'Avelã Dourado', base: '#754D32', highlight: '#A8744E' },
  { label: 'Rosa Pastel', base: '#E59BB6', highlight: '#F8C8DC' },
  { label: 'Prata Glacial', base: '#9CA3AF', highlight: '#E5E7EB' },
];

const BRANDS_AM = ['Atelier Lumière', 'Studio Rivoli', 'Urban District', 'Côté Mer', 'Homme Atelier', 'Rouge Couture'];
const BRANDS_VIP = ['Maison Royale VIP', 'Atelier Impérial VIP', 'Palais Doré VIP'];
const BRANDS_LEG = ['Celestial Couture', 'Mythos Atelier 3D', 'Sovereign Prism'];

function resolveClassTier(index: number, isStarter: boolean): {
  itemClass: 'am' | 'vip' | 'legendary';
  isVipOnly: boolean;
  isLegendary: boolean;
} {
  if (isStarter) {
    return { itemClass: 'am', isVipOnly: false, isLegendary: false };
  }
  const mod = index % 10;
  // ~17% Lendário, ~28% VIP, ~55% Livre AM
  if (mod === 8 || (mod === 9 && index % 3 === 0)) {
    return { itemClass: 'legendary', isVipOnly: false, isLegendary: true };
  }
  if (mod === 3 || mod === 6 || mod === 9) {
    return { itemClass: 'vip', isVipOnly: true, isLegendary: false };
  }
  return { itemClass: 'am', isVipOnly: false, isLegendary: false };
}

function buildFinish(
  itemClass: 'am' | 'vip' | 'legendary',
  index: number,
  category: ClothingCategory,
  silhouette: string
): ClothingItem['threeSpec'] extends infer T ? T extends { finish: infer F } ? F : never : never {
  if (itemClass === 'legendary') {
    const legFinishes = ['crystal', 'sequin', 'metallic', 'neon'] as const;
    return legFinishes[index % legFinishes.length];
  }
  if (itemClass === 'vip') {
    const vipFinishes = ['silk', 'velvet', 'metallic', 'sequin'] as const;
    return vipFinishes[index % vipFinishes.length];
  }
  if (silhouette.includes('leather') || silhouette === 'shoe_boots' || silhouette === 'shoe_oxford' || silhouette === 'acc_bag') {
    return 'leather';
  }
  if (silhouette.includes('cargo') || silhouette === 'pants_wide' || silhouette === 'pants_skinny') {
    return index % 2 === 0 ? 'denim' : 'cotton';
  }
  if (category === 'vestidos') return index % 2 === 0 ? 'silk' : 'velvet';
  if (category === 'sapatos') return index % 3 === 0 ? 'cotton' : 'leather';
  if (category === 'acessorios') return 'metallic';
  return index % 3 === 0 ? 'silk' : 'cotton';
}

function build3DCatalog400(): ClothingItem[] {
  const items: ClothingItem[] = [];

  // =========================================================================
  // 1) 100 ROUPAS FEMININAS (24 blusas + 26 vestidos + 20 calças + 16 sapatos + 14 acessórios)
  // =========================================================================
  const fTopSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['garmentSilhouette']; label: string }[] = [
    { sil: 'silk_shirt', label: 'Camisa de Seda' },
    { sil: 'cropped', label: 'Cropped Estruturado' },
    { sil: 'corset', label: 'Corset Esculpido' },
    { sil: 'blazer', label: 'Blazer Acinturado' },
    { sil: 'off_shoulder', label: 'Blusa Ombro a Ombro' },
    { sil: 'leather_jacket', label: 'Jaqueta Biker' },
    { sil: 'turtleneck', label: 'Gola Alta Cashmere' },
    { sil: 'trench_coat', label: 'Sobretudo Atelier' },
  ];
  for (let i = 1; i <= 24; i++) {
    const id = `f_top_${String(i).padStart(2, '0')}`;
    const starter = i === 1;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i, starter);
    const tpl = fTopSilhouettes[(i - 1) % fTopSilhouettes.length];
    const pal = starter ? FASHION_PALETTES[1] : FASHION_PALETTES[(i * 3) % FASHION_PALETTES.length];
    const finish = buildFinish(itemClass, i, 'blusas', tpl.sil || 'silk_shirt');
    items.push({
      id,
      name: starter ? 'Camisa de Seda Marfim 3D' : `${tpl.label} ${pal.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : BRANDS_AM[i % BRANDS_AM.length],
      category: 'blusas',
      gender: 'feminino',
      itemClass,
      price: starter ? 0 : itemClass === 'legendary' ? 920 + (i % 5) * 110 : itemClass === 'vip' ? 420 + (i % 5) * 55 : 160 + (i % 6) * 45,
      zIndex: LAYER_Z_INDEX.blusas,
      starter,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Coleção AM 3D',
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      pattern: pal.pattern,
      threeSpec: {
        garmentSilhouette: tpl.sil,
        finish,
        volumeScale: 0.96 + (i % 5) * 0.03,
        emissiveIntensity: itemClass === 'legendary' ? 0.35 : 0,
        metallicTrim: itemClass !== 'am' || i % 2 === 0,
      },
    });
  }

  const fDressSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['garmentSilhouette']; label: string }[] = [
    { sil: 'dress_slip', label: 'Slip Dress Cetim' },
    { sil: 'dress_aline', label: 'Vestido Evasê' },
    { sil: 'dress_mermaid', label: 'Vestido Sereia Gala' },
    { sil: 'dress_ballgown', label: 'Vestido Baile Real' },
    { sil: 'dress_blazer', label: 'Vestido Blazer' },
    { sil: 'dress_mini_party', label: 'Mini Dress Cocktail' },
  ];
  for (let i = 1; i <= 26; i++) {
    const id = `f_dress_${String(i).padStart(2, '0')}`;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i + 24, false);
    const tpl = fDressSilhouettes[(i - 1) % fDressSilhouettes.length];
    const pal = FASHION_PALETTES[(i * 5 + 2) % FASHION_PALETTES.length];
    const finish = buildFinish(itemClass, i, 'vestidos', tpl.sil || 'dress_aline');
    items.push({
      id,
      name: `${tpl.label} ${pal.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : BRANDS_AM[i % BRANDS_AM.length],
      category: 'vestidos',
      gender: 'feminino',
      itemClass,
      price: itemClass === 'legendary' ? 1050 + (i % 6) * 100 : itemClass === 'vip' ? 490 + (i % 5) * 60 : 240 + (i % 6) * 45,
      zIndex: LAYER_Z_INDEX.vestidos,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Coleção AM 3D',
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      pattern: pal.pattern,
      threeSpec: {
        garmentSilhouette: tpl.sil,
        finish,
        volumeScale: 0.97 + (i % 4) * 0.03,
        lengthScale: 0.85 + (i % 5) * 0.08,
        emissiveIntensity: itemClass === 'legendary' ? 0.38 : 0,
        metallicTrim: true,
      },
    });
  }

  const fBottomSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['garmentSilhouette']; label: string }[] = [
    { sil: 'skirt_midi', label: 'Saia Midi Plissada' },
    { sil: 'skirt_mini', label: 'Minissaia Estruturada' },
    { sil: 'skirt_pleated', label: 'Saia Colegial Pregas' },
    { sil: 'pants_tailored', label: 'Calça Alfaiataria Slim' },
    { sil: 'pants_wide', label: 'Pantalona Fluida' },
    { sil: 'pants_skinny', label: 'Calça Sculpt Skinny' },
  ];
  for (let i = 1; i <= 20; i++) {
    const id = `f_bottom_${String(i).padStart(2, '0')}`;
    const starter = i === 1;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i + 50, starter);
    const tpl = fBottomSilhouettes[(i - 1) % fBottomSilhouettes.length];
    const pal = starter ? FASHION_PALETTES[5] : FASHION_PALETTES[(i * 7 + 1) % FASHION_PALETTES.length];
    const finish = buildFinish(itemClass, i, 'calcas', tpl.sil || 'skirt_midi');
    items.push({
      id,
      name: starter ? 'Saia Midi Rosé Atelier 3D' : `${tpl.label} ${pal.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : BRANDS_AM[i % BRANDS_AM.length],
      category: 'calcas',
      gender: 'feminino',
      itemClass,
      price: starter ? 0 : itemClass === 'legendary' ? 880 + (i % 4) * 95 : itemClass === 'vip' ? 390 + (i % 5) * 45 : 150 + (i % 6) * 40,
      zIndex: LAYER_Z_INDEX.calcas,
      starter,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Coleção AM 3D',
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      pattern: pal.pattern,
      threeSpec: {
        garmentSilhouette: tpl.sil,
        finish,
        volumeScale: 0.96 + (i % 4) * 0.03,
        emissiveIntensity: itemClass === 'legendary' ? 0.3 : 0,
        metallicTrim: itemClass !== 'am',
      },
    });
  }

  const fShoeSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['garmentSilhouette']; label: string }[] = [
    { sil: 'shoe_heels', label: 'Scarpin Stiletto' },
    { sil: 'shoe_sandals', label: 'Sandália Tiras Finas' },
    { sil: 'shoe_boots', label: 'Bota Cano Alto' },
    { sil: 'shoe_sneakers', label: 'Sneaker Plataforma' },
  ];
  for (let i = 1; i <= 16; i++) {
    const id = `f_shoes_${String(i).padStart(2, '0')}`;
    const starter = i === 1;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i + 70, starter);
    const tpl = fShoeSilhouettes[(i - 1) % fShoeSilhouettes.length];
    const pal = starter ? FASHION_PALETTES[0] : FASHION_PALETTES[(i * 3 + 4) % FASHION_PALETTES.length];
    const finish = buildFinish(itemClass, i, 'sapatos', tpl.sil || 'shoe_heels');
    items.push({
      id,
      name: starter ? 'Scarpin Clássico Noir 3D' : `${tpl.label} ${pal.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : BRANDS_AM[i % BRANDS_AM.length],
      category: 'sapatos',
      gender: 'feminino',
      itemClass,
      price: starter ? 0 : itemClass === 'legendary' ? 860 + (i % 4) * 80 : itemClass === 'vip' ? 380 + (i % 4) * 45 : 140 + (i % 5) * 35,
      zIndex: LAYER_Z_INDEX.sapatos,
      starter,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Coleção AM 3D',
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      threeSpec: {
        garmentSilhouette: tpl.sil,
        finish,
        emissiveIntensity: itemClass === 'legendary' ? 0.35 : 0,
        metallicTrim: true,
      },
    });
  }

  const fAccSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['garmentSilhouette']; label: string }[] = [
    { sil: 'acc_crown', label: 'Tiara Imperial' },
    { sil: 'acc_necklace', label: 'Colar Choker Cristal' },
    { sil: 'acc_bag', label: 'Bolsa Couture' },
    { sil: 'acc_sunglasses', label: 'Óculos Gatinho' },
    { sil: 'acc_earrings', label: 'Brincos Gota' },
    { sil: 'acc_hat', label: 'Boina Francesa' },
    { sil: 'acc_scepter', label: 'Cetro Estelar' },
  ];
  for (let i = 1; i <= 14; i++) {
    const id = `f_acc_${String(i).padStart(2, '0')}`;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i + 86, false);
    const tpl = fAccSilhouettes[(i - 1) % fAccSilhouettes.length];
    const pal = FASHION_PALETTES[(i * 4 + 6) % FASHION_PALETTES.length];
    const finish = buildFinish(itemClass, i, 'acessorios', tpl.sil || 'acc_bag');
    items.push({
      id,
      name: `${tpl.label} ${pal.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : BRANDS_AM[i % BRANDS_AM.length],
      category: 'acessorios',
      gender: 'feminino',
      itemClass,
      price: itemClass === 'legendary' ? 950 + (i % 5) * 120 : itemClass === 'vip' ? 410 + (i % 4) * 55 : 130 + (i % 5) * 40,
      zIndex: LAYER_Z_INDEX.acessorios,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Coleção AM 3D',
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      threeSpec: {
        garmentSilhouette: tpl.sil,
        finish,
        emissiveIntensity: itemClass === 'legendary' ? 0.45 : 0,
        metallicTrim: true,
      },
    });
  }

  // =========================================================================
  // 2) 100 ROUPAS MASCULINAS (32 blusas + 28 calças + 22 sapatos + 18 acessórios)
  // =========================================================================
  const mTopSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['garmentSilhouette']; label: string }[] = [
    { sil: 'silk_shirt', label: 'Camisa Social Slim' },
    { sil: 'blazer', label: 'Blazer Estruturado' },
    { sil: 'vest_suit', label: 'Colete & Alfaiataria' },
    { sil: 'leather_jacket', label: 'Jaqueta Biker Couro' },
    { sil: 'hoodie', label: 'Hoodie Streetwear' },
    { sil: 'tshirt', label: 'T-Shirt Heavyweight' },
    { sil: 'turtleneck', label: 'Suéter Gola Alta' },
    { sil: 'trench_coat', label: 'Trench Coat Galã' },
  ];
  for (let i = 1; i <= 32; i++) {
    const id = `m_top_${String(i).padStart(2, '0')}`;
    const starter = i === 1;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i + 100, starter);
    const tpl = mTopSilhouettes[(i - 1) % mTopSilhouettes.length];
    const pal = starter ? FASHION_PALETTES[3] : FASHION_PALETTES[(i * 3 + 2) % FASHION_PALETTES.length];
    const finish = buildFinish(itemClass, i, 'blusas', tpl.sil || 'blazer');
    items.push({
      id,
      name: starter ? 'Camisa & Blazer Safira 3D' : `${tpl.label} ${pal.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : BRANDS_AM[i % BRANDS_AM.length],
      category: 'blusas',
      gender: 'masculino',
      itemClass,
      price: starter ? 0 : itemClass === 'legendary' ? 940 + (i % 5) * 110 : itemClass === 'vip' ? 430 + (i % 5) * 55 : 170 + (i % 6) * 45,
      zIndex: LAYER_Z_INDEX.blusas,
      starter,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Coleção AM 3D',
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      pattern: pal.pattern,
      threeSpec: {
        garmentSilhouette: starter ? 'blazer' : tpl.sil,
        finish,
        volumeScale: 0.98 + (i % 4) * 0.03,
        emissiveIntensity: itemClass === 'legendary' ? 0.35 : 0,
        metallicTrim: itemClass !== 'am' || i % 2 === 0,
      },
    });
  }

  const mBottomSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['garmentSilhouette']; label: string }[] = [
    { sil: 'pants_tailored', label: 'Calça Alfaiataria Galã' },
    { sil: 'pants_skinny', label: 'Calça Slim Fit' },
    { sil: 'pants_cargo', label: 'Calça Cargo Street' },
    { sil: 'pants_wide', label: 'Calça Baggy Skate' },
    { sil: 'shorts', label: 'Bermuda Chino Resort' },
  ];
  for (let i = 1; i <= 28; i++) {
    const id = `m_bottom_${String(i).padStart(2, '0')}`;
    const starter = i === 1;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i + 132, starter);
    const tpl = mBottomSilhouettes[(i - 1) % mBottomSilhouettes.length];
    const pal = starter ? FASHION_PALETTES[15] : FASHION_PALETTES[(i * 5 + 3) % FASHION_PALETTES.length];
    const finish = buildFinish(itemClass, i, 'calcas', tpl.sil || 'pants_tailored');
    items.push({
      id,
      name: starter ? 'Calça Alfaiataria Grafite 3D' : `${tpl.label} ${pal.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : BRANDS_AM[i % BRANDS_AM.length],
      category: 'calcas',
      gender: 'masculino',
      itemClass,
      price: starter ? 0 : itemClass === 'legendary' ? 890 + (i % 4) * 90 : itemClass === 'vip' ? 395 + (i % 5) * 45 : 155 + (i % 6) * 40,
      zIndex: LAYER_Z_INDEX.calcas,
      starter,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Coleção AM 3D',
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      pattern: pal.pattern,
      threeSpec: {
        garmentSilhouette: tpl.sil,
        finish,
        volumeScale: 0.97 + (i % 4) * 0.03,
        emissiveIntensity: itemClass === 'legendary' ? 0.3 : 0,
        metallicTrim: itemClass !== 'am',
      },
    });
  }

  const mShoeSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['garmentSilhouette']; label: string }[] = [
    { sil: 'shoe_oxford', label: 'Sapato Oxford Couro' },
    { sil: 'shoe_loafers', label: 'Mocassim Verniz' },
    { sil: 'shoe_boots', label: 'Coturno Chelsea' },
    { sil: 'shoe_sneakers', label: 'Tênis Urban Low' },
  ];
  for (let i = 1; i <= 22; i++) {
    const id = `m_shoes_${String(i).padStart(2, '0')}`;
    const starter = i === 1;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i + 160, starter);
    const tpl = mShoeSilhouettes[(i - 1) % mShoeSilhouettes.length];
    const pal = starter ? FASHION_PALETTES[13] : FASHION_PALETTES[(i * 4 + 5) % FASHION_PALETTES.length];
    const finish = buildFinish(itemClass, i, 'sapatos', tpl.sil || 'shoe_oxford');
    items.push({
      id,
      name: starter ? 'Oxford Couro Clássico 3D' : `${tpl.label} ${pal.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : BRANDS_AM[i % BRANDS_AM.length],
      category: 'sapatos',
      gender: 'masculino',
      itemClass,
      price: starter ? 0 : itemClass === 'legendary' ? 870 + (i % 4) * 85 : itemClass === 'vip' ? 385 + (i % 4) * 45 : 145 + (i % 5) * 35,
      zIndex: LAYER_Z_INDEX.sapatos,
      starter,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Coleção AM 3D',
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      threeSpec: {
        garmentSilhouette: tpl.sil,
        finish,
        emissiveIntensity: itemClass === 'legendary' ? 0.35 : 0,
        metallicTrim: true,
      },
    });
  }

  const mAccSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['garmentSilhouette']; label: string }[] = [
    { sil: 'acc_watch', label: 'Cronógrafo Executivo' },
    { sil: 'acc_sunglasses', label: 'Óculos Aviador' },
    { sil: 'acc_hat', label: 'Chapéu Fedora' },
    { sil: 'acc_necklace', label: 'Corrente Elo Real' },
    { sil: 'acc_crown', label: 'Coroa Soberana' },
    { sil: 'acc_scepter', label: 'Cetro Imperial' },
  ];
  for (let i = 1; i <= 18; i++) {
    const id = `m_acc_${String(i).padStart(2, '0')}`;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i + 182, false);
    const tpl = mAccSilhouettes[(i - 1) % mAccSilhouettes.length];
    const pal = FASHION_PALETTES[(i * 3 + 7) % FASHION_PALETTES.length];
    const finish = buildFinish(itemClass, i, 'acessorios', tpl.sil || 'acc_watch');
    items.push({
      id,
      name: `${tpl.label} ${pal.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : BRANDS_AM[i % BRANDS_AM.length],
      category: 'acessorios',
      gender: 'masculino',
      itemClass,
      price: itemClass === 'legendary' ? 960 + (i % 5) * 120 : itemClass === 'vip' ? 420 + (i % 4) * 55 : 135 + (i % 5) * 40,
      zIndex: LAYER_Z_INDEX.acessorios,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Coleção AM 3D',
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      threeSpec: {
        garmentSilhouette: tpl.sil,
        finish,
        emissiveIntensity: itemClass === 'legendary' ? 0.45 : 0,
        metallicTrim: true,
      },
    });
  }

  // =========================================================================
  // 3) 100 CABELOS FEMININOS
  // =========================================================================
  const fHairSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['hairSilhouette']; label: string }[] = [
    { sil: 'waves_long', label: 'Ondas Longas Glamour' },
    { sil: 'bob_classic', label: 'Chanel Parisiense' },
    { sil: 'high_bun', label: 'Coque Alto Editorial' },
    { sil: 'ponytail_high', label: 'Rabo de Cavalo Seda' },
    { sil: 'straight_sleek', label: 'Liso Espelhado' },
    { sil: 'curly_voluminous', label: 'Cachos Volumosos' },
    { sil: 'braids_twin', label: 'Tranças Atelier' },
    { sil: 'pixie_chic', label: 'Pixie Chic' },
    { sil: 'layered_midi', label: 'Repicado Midi' },
    { sil: 'half_up', label: 'Meio Preso Imperial' },
  ];
  for (let i = 1; i <= 100; i++) {
    const id = `f_hair_${String(i).padStart(2, '0')}`;
    const starter = i <= 2;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i + 200, starter);
    const tpl = fHairSilhouettes[(i - 1) % fHairSilhouettes.length];
    const col = HAIR_COLORS[(Math.floor((i - 1) / 10) + (i % 3)) % HAIR_COLORS.length];
    const finish = itemClass === 'legendary' ? 'crystal' : itemClass === 'vip' ? 'silk' : 'cotton';
    items.push({
      id,
      name:
        i === 1
          ? 'Ondas Clássicas Castanho 3D'
          : i === 2
            ? 'Coque Baixo Parisiense 3D'
            : `${tpl.label} ${col.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : 'Atelier Hair 3D',
      category: 'cabelo',
      gender: 'feminino',
      itemClass,
      price: starter ? 0 : itemClass === 'legendary' ? 880 + (i % 5) * 95 : itemClass === 'vip' ? 400 + (i % 5) * 45 : 150 + (i % 6) * 35,
      zIndex: LAYER_Z_INDEX.cabelo,
      starter,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Atelier Capilar 3D',
      swatchColor: col.base,
      secondaryColor: col.highlight,
      threeSpec: {
        hairSilhouette: i === 2 ? 'high_bun' : tpl.sil,
        finish,
        volumeScale: 0.94 + (i % 5) * 0.04,
        lengthScale: 0.88 + (i % 4) * 0.09,
        emissiveIntensity: itemClass === 'legendary' ? 0.25 : 0,
        highlightColor: col.highlight,
      },
    });
  }

  // =========================================================================
  // 4) 100 CABELOS MASCULINOS
  // =========================================================================
  const mHairSilhouettes: { sil: NonNullable<ClothingItem['threeSpec']>['hairSilhouette']; label: string }[] = [
    { sil: 'executive_part', label: 'Corte Executivo' },
    { sil: 'undercut_fade', label: 'Undercut Fade' },
    { sil: 'quiff_textured', label: 'Topete Texturizado' },
    { sil: 'curly_fade', label: 'Cachos Taper Fade' },
    { sil: 'surfer_medium', label: 'Repartido Médio' },
    { sil: 'slick_back', label: 'Slick Back Galã' },
    { sil: 'buzz_taper', label: 'Buzz Cut Militar' },
    { sil: 'dreads_short', label: 'Locs Urbanos' },
    { sil: 'wolf_cut', label: 'Wolf Cut Moderno' },
    { sil: 'pompadour', label: 'Pompadour Clássico' },
  ];
  for (let i = 1; i <= 100; i++) {
    const id = `m_hair_${String(i).padStart(2, '0')}`;
    const starter = i <= 2;
    const { itemClass, isVipOnly, isLegendary } = resolveClassTier(i + 300, starter);
    const tpl = mHairSilhouettes[(i - 1) % mHairSilhouettes.length];
    const col = HAIR_COLORS[(Math.floor((i - 1) / 10) + (i % 3)) % HAIR_COLORS.length];
    const finish = itemClass === 'legendary' ? 'crystal' : itemClass === 'vip' ? 'silk' : 'cotton';
    items.push({
      id,
      name:
        i === 1
          ? 'Corte Executivo Ébano 3D'
          : i === 2
            ? 'Undercut Fade Expresso 3D'
            : `${tpl.label} ${col.label}`,
      brand: itemClass === 'legendary' ? BRANDS_LEG[i % BRANDS_LEG.length] : itemClass === 'vip' ? BRANDS_VIP[i % BRANDS_VIP.length] : 'Homme Hair 3D',
      category: 'cabelo',
      gender: 'masculino',
      itemClass,
      price: starter ? 0 : itemClass === 'legendary' ? 880 + (i % 5) * 95 : itemClass === 'vip' ? 400 + (i % 5) * 45 : 150 + (i % 6) * 35,
      zIndex: LAYER_Z_INDEX.cabelo,
      starter,
      isVipOnly,
      isLegendary,
      collectionTag: itemClass === 'legendary' ? 'Lendário Celestial 3D' : itemClass === 'vip' ? 'Boutique VIP 3D' : 'Homme Capilar 3D',
      swatchColor: col.base,
      secondaryColor: col.highlight,
      threeSpec: {
        hairSilhouette: tpl.sil,
        finish,
        volumeScale: 0.94 + (i % 5) * 0.04,
        lengthScale: 0.9 + (i % 4) * 0.07,
        emissiveIntensity: itemClass === 'legendary' ? 0.25 : 0,
        highlightColor: col.highlight,
      },
    });
  }

  return items;
}

/**
 * Catálogo oficial 3D Three.js (400 peças exclusivas: 100 roupas F + 100 roupas M + 100 cabelos F + 100 cabelos M).
 */
export const INITIAL_CLOTHING_CATALOG: ClothingItem[] = build3DCatalog400();

export function resolveItemClass(item: Pick<ClothingItem, 'itemClass' | 'isVipOnly' | 'isLegendary'>): 'am' | 'vip' | 'legendary' {
  if (item.itemClass) return item.itemClass;
  if (item.isLegendary) return 'legendary';
  if (item.isVipOnly) return 'vip';
  return 'am';
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
    id: 'room_tpl_atelier_padrao',
    name: 'Salão Atelier Clássico',
    subtitle: 'Ambiente acolhedor padrão em madeira clara e painéis rosés',
    themeTag: 'casa',
    backdropTheme: 'atelier_rosa',
    price: 0,
    starter: true,
    accentColor: '#C8235D',
    secondaryColor: '#FAF5F7',
    walkMinY: 56,
    walkMaxY: 88,
  },
  {
    id: 'room_tpl_casa_moderna',
    name: 'Casa Moderna Living & Jardim',
    subtitle: 'Sala ampla residencial com janelão panorâmico e piso carvalho',
    themeTag: 'casa',
    backdropTheme: 'casa_estar_moderna',
    price: 450,
    accentColor: '#467A5B',
    secondaryColor: '#EAE2D6',
    walkMinY: 56,
    walkMaxY: 89,
  },
  {
    id: 'room_tpl_bar_lounge',
    name: 'Bar Lounge Coquetelaria',
    subtitle: 'Bistrô noturno com luzes âmbar, prateleira iluminada e madeira escura',
    themeTag: 'bar',
    backdropTheme: 'bar_lounge',
    price: 580,
    accentColor: '#D97706',
    secondaryColor: '#291D19',
    walkMinY: 56,
    walkMaxY: 88,
  },
  {
    id: 'room_tpl_boate_neon',
    name: 'Boate Neon Starlight Club',
    subtitle: 'Pista noturna com holofotes, equalizador de palco e atmosfera clubber',
    themeTag: 'boate',
    backdropTheme: 'boate_neon',
    price: 720,
    accentColor: '#A855F7',
    secondaryColor: '#130F26',
    walkMinY: 55,
    walkMaxY: 89,
  },
  {
    id: 'room_tpl_hotel_royal_vip',
    name: 'Suíte Palace Hotel 5 Estrelas VIP',
    subtitle: 'Lobby & suíte de hotel palaciano em mármore e lustres dourados',
    themeTag: 'hotel',
    backdropTheme: 'hotel_royal_vip',
    price: 1150,
    isVipOnly: true,
    accentColor: '#D4A853',
    secondaryColor: '#1F1B24',
    walkMinY: 55,
    walkMaxY: 88,
  },
  {
    id: 'room_tpl_cobertura_diamante_vip',
    name: 'Cobertura Diamante VIP',
    subtitle: 'Terraço exclusivo de luxo absoluto com skyline estrelado e detalhes em ouro',
    themeTag: 'hotel',
    backdropTheme: 'cobertura_diamante_vip',
    price: 1550,
    isVipOnly: true,
    isLegendary: true,
    accentColor: '#38BDF8',
    secondaryColor: '#0F172A',
    walkMinY: 54,
    walkMaxY: 88,
  },
  {
    id: 'room_tpl_estudio_3d_designer',
    name: 'Estúdio 3D Designer de Alta-Costura',
    subtitle: 'Ambiente futurista com passarela 3D, perspectiva volumétrica e iluminação de passarela',
    themeTag: 'hotel',
    backdropTheme: 'estudio_3d_designer',
    price: 650,
    accentColor: '#38BDF8',
    secondaryColor: '#111827',
    walkMinY: 56,
    walkMaxY: 88,
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

const LOUNGE_PARTY_PROPS = [
  { id: 'party_sofa_vip_l', label: 'Sofá Lounge VIP Esquerdo', kind: 'sofa' as const, x: 22, y: 64, seatX: 22, seatY: 64, collidable: false, primaryColor: '#9E1646', accentColor: '#D4A853' },
  { id: 'party_sofa_vip_r', label: 'Sofá Lounge VIP Direito', kind: 'sofa' as const, x: 64, y: 64, seatX: 64, seatY: 64, collidable: false, primaryColor: '#1E1B24', accentColor: '#D4A853' },
  { id: 'party_table_champagne', label: 'Mesa Central Champagne', kind: 'table' as const, x: 43, y: 70, collidable: true, collisionRadius: 7, primaryColor: '#FAF6F0', accentColor: '#D4A853' },
  { id: 'party_chair_l', label: 'Poltrona Pista Esquerda', kind: 'chair' as const, x: 30, y: 80, seatX: 30, seatY: 80, collidable: false },
  { id: 'party_chair_r', label: 'Poltrona Pista Direita', kind: 'chair' as const, x: 56, y: 80, seatX: 56, seatY: 80, collidable: false },
];

/**
 * Salas Principais Oficiais do Starlight Atelier:
 * Apenas "Lounge Party", identificada como criada pelo Starlight Atelier com emblema Oficial.
 */
export const GLOBAL_ROOMS: RoomDef[] = [
  {
    id: 'lounge_party',
    name: 'Lounge Party',
    subtitle: 'Salão principal oficial 3D com pista iluminada, lounges VIP e Cabine de DJ ao vivo · Criada pelo Starlight Atelier',
    backdropTheme: 'lounge_party',
    walkMinY: 54,
    walkMaxY: 88,
    visibility: 'public',
    serverRegion: 'BR',
    ownerId: 'acc_admin_owner',
    creatorUsername: 'Starlight Atelier',
    isOfficial: true,
    interactiveProps: LOUNGE_PARTY_PROPS,
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
    code: 'FR',
    name: 'França',
    cityLabel: 'Paris/FR',
    timezone: 'Europe/Paris',
    ipPrefix: '176.158',
  },
  {
    code: 'JP',
    name: 'Japão',
    cityLabel: 'Tóquio/JP',
    timezone: 'Asia/Tokyo',
    ipPrefix: '126.205',
  },
];

/** Notícias editoriais iniciais do Starlight Atelier */
export const INITIAL_NEWS_POSTS: NewsPost[] = [
  {
    id: 'news_seed_1',
    title: 'Streetwear SoHo & Tendências Y2K chegam à Starplaza!',
    summary:
      'A coleção inspirada na juventude americana acaba de aterrissar nas araras: hoodies varsity, jeans baggy skater e sneakers chunky com visual contemporâneo.',
    body:
      'Olá estilistas do Servidor BR! Nosso ateliê recebeu peças assinadas com inspiração direta nas ruas de Nova York e Los Angeles. Aproveitem para caminhar pelas salas clicando livremente no piso e testar combinações Streetwear, Y2K e Casual Chic com seus amigos. Lembrem-se sempre de manter o respeito no chat público!',
    imageUrl: newsStreetwearUsImg,
    imageCaption: 'Lookbook Streetwear & Y2K · Edição Nova York & Los Angeles',
    category: 'Lançamentos',
    serverRegion: 'BR',
    authorAccountId: 'acc_admin_owner',
    authorUsername: 'vitor',
    authorDisplayName: 'Vitor',
    authorRoleTier: 'admin',
    createdAt: Date.now() - 1000 * 60 * 65,
  },
  {
    id: 'news_seed_2',
    title: 'Coleción Lendária VIP: Coroas, Cetros e Joias de Alta Costura',
    summary:
      'Peças de altíssimo luxo como a Tiara Soberana Safira, Cetro Real Ouro & Diamante e Cronógrafo 24k já podem ser visualizadas na Boutique VIP.',
    body:
      '¡Bienvenidos estilistas del Servidor ES! Presentamos los artículos Lendários VIP diseñados para quienes brillan en cada pasarela. Todos pueden inspeccionar los detalles de cada pieza en la Starplaza, y los miembros VIP ya pueden equiparlas en sus avatares. ¡Participen con respeto y compartan sus looks en el Salón Principal ES!',
    imageUrl: newsVipLegendaryImg,
    imageCaption: 'Vitrine Alta Costura · Joias Lendárias Maison Royale VIP',
    category: 'Coleção VIP',
    serverRegion: 'ES',
    authorAccountId: 'acc_admin_owner',
    authorUsername: 'vitor',
    authorDisplayName: 'Vitor',
    authorRoleTier: 'admin',
    createdAt: Date.now() - 1000 * 60 * 140,
  },
  {
    id: 'news_seed_3',
    title: 'Smooth Point-and-Click Walking & Real-Time Community Guidelines',
    summary:
      'Explore Public Lounges and Suites by clicking anywhere on the floor. Plus: curated VIP drops and community etiquette reminders for EN Server stylists.',
    body:
      'Hey stylists on the English Server! You can now walk effortlessly across every public room and personal suite simply by clicking on the floor. Keep conversations welcoming, open a Ticket whenever you need Community Manager assistance, and report any misconduct via /report.',
    imageUrl: newsRunwayEventImg,
    imageCaption: 'Evening Rooftop Fashion Meetup · Global Community Spotlight',
    category: 'Comunidade & Conduta',
    serverRegion: 'EN',
    authorAccountId: 'acc_admin_owner',
    authorUsername: 'vitor',
    authorDisplayName: 'Vitor',
    authorRoleTier: 'admin',
    createdAt: Date.now() - 1000 * 60 * 220,
  },
  {
    id: 'news_seed_4',
    title: 'Anatomia Modular & Novos Móveis de Suíte',
    summary:
      'O estúdio garante encaixe perfeito entre silhuetas feminina, masculina e neutra, além de novas peças de decoração exclusivas na Starplaza.',
    body:
      'Para garantir que todo estilista brilhe com peças perfeitamente ajustadas nas salas, nosso departamento de design prepara novos vestuários e mobiliários para sua Suíte 2D. Confira também a nova aba Loja Premium para adquirir moedas AM e status VIP!',
    imageUrl: newsAtelierFurnitureImg,
    imageCaption: 'Atelier de Arquitetura 2D · Interiores & Estilo Impecável',
    category: 'Atualizações',
    serverRegion: 'BR',
    authorAccountId: 'acc_admin_owner',
    authorUsername: 'vitor',
    authorDisplayName: 'Vitor',
    authorRoleTier: 'admin',
    createdAt: Date.now() - 1000 * 60 * 310,
  },
];
