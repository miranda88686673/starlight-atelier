import {
  ClothingCategory,
  ClothingItem,
  DesignPattern,
  Garment3DSilhouette,
  Hair3DSilhouette,
  LAYER_Z_INDEX,
  Material3DFinish,
} from '../types/game';

interface ColorPaletteEntry {
  label: string;
  primary: string;
  secondary: string;
  accent: string;
}

const FASHION_PALETTES: ColorPaletteEntry[] = [
  { label: 'Noite Ônix', primary: '#1C1D22', secondary: '#343844', accent: '#D4AF37' },
  { label: 'Marfim Clássico', primary: '#F3EFE6', secondary: '#D9CFC1', accent: '#B8894D' },
  { label: 'Azul Índigo', primary: '#253D5B', secondary: '#456896', accent: '#E2E8F0' },
  { label: 'Carmim Gala', primary: '#7F1D2C', secondary: '#4C101B', accent: '#FBBF24' },
  { label: 'Verde Oliva', primary: '#44543D', secondary: '#2A3625', accent: '#D9A760' },
  { label: 'Caramelo Milano', primary: '#965A38', secondary: '#5E341C', accent: '#F3D299' },
  { label: 'Lavanda Paris', primary: '#7C6FA6', secondary: '#54487A', accent: '#F8FAFC' },
  { label: 'Grafite Urbano', primary: '#4B505B', secondary: '#282C34', accent: '#94A3B8' },
  { label: 'Rosa Quartzo', primary: '#D8829D', secondary: '#9E4D68', accent: '#FCE7F3' },
  { label: 'Esmeralda Real', primary: '#1E5646', secondary: '#11362B', accent: '#EAB308' },
  { label: 'Bege Areia', primary: '#CDB89D', secondary: '#9C8468', accent: '#443627' },
  { label: 'Cobalto Studio', primary: '#244A9B', secondary: '#162E66', accent: '#BAE6FD' },
  { label: 'Bordeaux Vinho', primary: '#5B1A2B', secondary: '#380E1A', accent: '#FDE68A' },
  { label: 'Terracota Atelier', primary: '#B4533C', secondary: '#7B3422', accent: '#FDE047' },
  { label: 'Pérola Champagne', primary: '#E8DEC8', secondary: '#BFAF90', accent: '#D4AF37' },
];

const HAIR_PALETTES: Array<{ label: string; primary: string; secondary: string; accent: string }> = [
  { label: 'Expresso Escuro', primary: '#231814', secondary: '#3E2A22', accent: '#1A110E' },
  { label: 'Castanho Mel', primary: '#5A3A28', secondary: '#8A5D41', accent: '#3D2418' },
  { label: 'Loiro Dourado', primary: '#D8B26E', secondary: '#F2D89D', accent: '#B88D48' },
  { label: 'Preto Ônix', primary: '#151519', secondary: '#2D2E36', accent: '#0D0D10' },
  { label: 'Ruivo Cobre', primary: '#9A3D22', secondary: '#C9633B', accent: '#6B2512' },
  { label: 'Platinado Gelo', primary: '#E2E4E9', secondary: '#F8FAFC', accent: '#94A3B8' },
];

interface GarmentBlueprint {
  category: ClothingCategory;
  styleName: string;
  brand: string;
  tag: string;
  silhouette: Garment3DSilhouette;
  finish: Material3DFinish;
  pattern: DesignPattern;
  basePrice: number;
  volumeScale?: number;
  lengthScale?: number;
  metallicTrim?: boolean;
}

const MALE_BLUEPRINTS: GarmentBlueprint[] = [
  // Blusas (22 variantes via paletas)
  { category: 'blusas', styleName: 'Camisa Social Oxford', brand: 'Monza Uomo', tag: 'Alfaiataria', silhouette: 'silk_shirt', finish: 'cotton', pattern: 'solid', basePrice: 140, metallicTrim: true },
  { category: 'blusas', styleName: 'Camiseta Streetwear Prisma', brand: 'District Zero', tag: 'Streetwear', silhouette: 'tshirt', finish: 'cotton', pattern: 'striped', basePrice: 95 },
  { category: 'blusas', styleName: 'Moletom Hoodie Essential', brand: 'Urban Loft', tag: 'Casual Chic', silhouette: 'hoodie', finish: 'cotton', pattern: 'solid', basePrice: 165, volumeScale: 1.05 },
  { category: 'blusas', styleName: 'Suéter Gola Alta Milano', brand: 'Casa Vittorio', tag: 'Alfaiataria', silhouette: 'turtleneck', finish: 'velvet', pattern: 'solid', basePrice: 155 },
  { category: 'blusas', styleName: 'Colete Executivo Slim', brand: 'Monza Uomo', tag: 'Gala', silhouette: 'vest_suit', finish: 'silk', pattern: 'plaid', basePrice: 185, metallicTrim: true },
  // Casacos em sobreposição (18)
  { category: 'casacos', styleName: 'Jaqueta Bomber Couro Studio', brand: 'District Zero', tag: 'Streetwear', silhouette: 'leather_jacket', finish: 'leather', pattern: 'solid', basePrice: 280, metallicTrim: true },
  { category: 'casacos', styleName: 'Blazer Estruturado Savile', brand: 'Casa Vittorio', tag: 'Alfaiataria', silhouette: 'blazer', finish: 'cotton', pattern: 'plaid', basePrice: 310, metallicTrim: true },
  { category: 'casacos', styleName: 'Sobretudo Trench Noturno', brand: 'Atelier du Nord', tag: 'Passarela', silhouette: 'trench_coat', finish: 'velvet', pattern: 'solid', basePrice: 340, metallicTrim: true },
  { category: 'casacos', styleName: 'Jaqueta Denim Biker', brand: 'District Zero', tag: 'Urbano', silhouette: 'leather_jacket', finish: 'denim', pattern: 'denim', basePrice: 245, metallicTrim: true },
  // Calças (22)
  { category: 'calcas', styleName: 'Calça Alfaiataria Vinco', brand: 'Monza Uomo', tag: 'Alfaiataria', silhouette: 'pants_tailored', finish: 'cotton', pattern: 'solid', basePrice: 160, metallicTrim: true },
  { category: 'calcas', styleName: 'Calça Cargo Tática Utilitária', brand: 'District Zero', tag: 'Streetwear', silhouette: 'pants_cargo', finish: 'cotton', pattern: 'solid', basePrice: 195, metallicTrim: true },
  { category: 'calcas', styleName: 'Jeans Skinny Destruído', brand: 'Urban Loft', tag: 'Urbano', silhouette: 'pants_skinny', finish: 'denim', pattern: 'denim', basePrice: 150 },
  { category: 'calcas', styleName: 'Calça Wide Leg Sarja', brand: 'Atelier du Nord', tag: 'Tendência', silhouette: 'pants_wide', finish: 'cotton', pattern: 'striped', basePrice: 175 },
  { category: 'calcas', styleName: 'Bermuda Chino Resort', brand: 'Casa Vittorio', tag: 'Resort', silhouette: 'shorts', finish: 'cotton', pattern: 'plaid', basePrice: 115 },
  // Sapatos (16)
  { category: 'sapatos', styleName: 'Tênis High-Top Urbano', brand: 'District Zero', tag: 'Streetwear', silhouette: 'shoe_sneakers', finish: 'leather', pattern: 'solid', basePrice: 170 },
  { category: 'sapatos', styleName: 'Bota Chelsea Couro', brand: 'Casa Vittorio', tag: 'Alfaiataria', silhouette: 'shoe_boots', finish: 'leather', pattern: 'solid', basePrice: 230, metallicTrim: true },
  { category: 'sapatos', styleName: 'Mocassim Metropolitano', brand: 'Monza Uomo', tag: 'Gala', silhouette: 'shoe_sneakers', finish: 'leather', pattern: 'solid', basePrice: 190, metallicTrim: true },
  // Acessórios (10)
  { category: 'acessorios', styleName: 'Óculos Aviador Solar', brand: 'Optica Sol', tag: 'Editorial', silhouette: 'acc_sunglasses', finish: 'metallic', pattern: 'solid', basePrice: 120, metallicTrim: true },
  { category: 'acessorios', styleName: 'Corrente Dog-Tag Prata', brand: 'Atelier Lux', tag: 'Urbano', silhouette: 'acc_necklace', finish: 'metallic', pattern: 'solid', basePrice: 135, metallicTrim: true },
  { category: 'acessorios', styleName: 'Relógio Cronógrafo & Pulseira', brand: 'Atelier Lux', tag: 'Luxo', silhouette: 'acc_watch', finish: 'metallic', pattern: 'solid', basePrice: 160, metallicTrim: true },
  { category: 'acessorios', styleName: 'Gorro Knit Inverno', brand: 'Urban Loft', tag: 'Urbano', silhouette: 'acc_hat', finish: 'cotton', pattern: 'striped', basePrice: 95 },
];

const MALE_HAIR_BLUEPRINTS: Array<{ styleName: string; silhouette: Hair3DSilhouette; price: number }> = [
  { styleName: 'Topete Texturizado Quiff', silhouette: 'quiff_textured', price: 145 },
  { styleName: 'Pompadour Clássico', silhouette: 'pompadour', price: 165 },
  { styleName: 'Corte Executivo Lateral', silhouette: 'executive_part', price: 135 },
  { styleName: 'Undercut Fade Moderno', silhouette: 'undercut_fade', price: 155 },
  { styleName: 'Cachos Fade Definidos', silhouette: 'curly_fade', price: 150 },
  { styleName: 'Slick Back Noturno', silhouette: 'slick_back', price: 160 },
];

const FEMALE_BLUEPRINTS: GarmentBlueprint[] = [
  // Blusas (16)
  { category: 'blusas', styleName: 'Camisa Seda Fluida', brand: 'Maison Rosé', tag: 'Casual Chic', silhouette: 'silk_shirt', finish: 'silk', pattern: 'solid', basePrice: 155, metallicTrim: true },
  { category: 'blusas', styleName: 'Corset Estruturado Atelier', brand: 'Velours Paris', tag: 'Alta Costura', silhouette: 'corset', finish: 'velvet', pattern: 'solid', basePrice: 210, metallicTrim: true },
  { category: 'blusas', styleName: 'Cropped Ombro a Ombro', brand: 'Luna Bloom', tag: 'Y2K', silhouette: 'off_shoulder', finish: 'silk', pattern: 'floral', basePrice: 130 },
  { category: 'blusas', styleName: 'Moletom Cropped Lounge', brand: 'Urban Loft', tag: 'Streetwear', silhouette: 'cropped', finish: 'cotton', pattern: 'solid', basePrice: 145 },
  { category: 'blusas', styleName: 'Gola Alta Cashmere', brand: 'Atelier du Nord', tag: 'Clássico', silhouette: 'turtleneck', finish: 'cotton', pattern: 'striped', basePrice: 150 },
  // Casacos em sobreposição (16)
  { category: 'casacos', styleName: 'Blazer Cropped Chanel', brand: 'Maison Rosé', tag: 'Alfaiataria', silhouette: 'blazer', finish: 'cotton', pattern: 'plaid', basePrice: 290, metallicTrim: true },
  { category: 'casacos', styleName: 'Jaqueta Couro Moto Chic', brand: 'District Zero', tag: 'Streetwear', silhouette: 'leather_jacket', finish: 'leather', pattern: 'solid', basePrice: 275, metallicTrim: true },
  { category: 'casacos', styleName: 'Sobretudo Parisien Longo', brand: 'Velours Paris', tag: 'Inverno', silhouette: 'trench_coat', finish: 'velvet', pattern: 'solid', basePrice: 345, metallicTrim: true },
  { category: 'casacos', styleName: 'Jaqueta Jeans Cropped', brand: 'Luna Bloom', tag: 'Urbano', silhouette: 'leather_jacket', finish: 'denim', pattern: 'denim', basePrice: 230, metallicTrim: true },
  // Vestidos (18)
  { category: 'vestidos', styleName: 'Vestido Evasê Seda', brand: 'Maison Rosé', tag: 'Romântico', silhouette: 'dress_aline', finish: 'silk', pattern: 'floral', basePrice: 260, lengthScale: 1.0, metallicTrim: true },
  { category: 'vestidos', styleName: 'Vestido Festa Mini Paetê', brand: 'Velours Paris', tag: 'Festa', silhouette: 'dress_mini_party', finish: 'sequin', pattern: 'sequin', basePrice: 310, lengthScale: 0.95, metallicTrim: true },
  { category: 'vestidos', styleName: 'Vestido Sereia Gala', brand: 'Atelier Lux', tag: 'Alta Costura', silhouette: 'dress_mermaid', finish: 'silk', pattern: 'solid', basePrice: 410, lengthScale: 1.08, metallicTrim: true },
  { category: 'vestidos', styleName: 'Vestido Baile Princesa', brand: 'Atelier Lux', tag: 'Gala', silhouette: 'dress_ballgown', finish: 'velvet', pattern: 'solid', basePrice: 460, lengthScale: 1.05, metallicTrim: true },
  { category: 'vestidos', styleName: 'Vestido Blazer Passarela', brand: 'Maison Rosé', tag: 'Alfaiataria', silhouette: 'dress_blazer', finish: 'cotton', pattern: 'plaid', basePrice: 285, metallicTrim: true },
  // Calças & Saias (20)
  { category: 'calcas', styleName: 'Saia Plissada Colegial', brand: 'Luna Bloom', tag: 'Y2K', silhouette: 'skirt_pleated', finish: 'cotton', pattern: 'plaid', basePrice: 145 },
  { category: 'calcas', styleName: 'Saia Midi Seda Fluida', brand: 'Maison Rosé', tag: 'Casual Chic', silhouette: 'skirt_midi', finish: 'silk', pattern: 'floral', basePrice: 175 },
  { category: 'calcas', styleName: 'Minissaia Couro Cintura Alta', brand: 'District Zero', tag: 'Urbano', silhouette: 'skirt_mini', finish: 'leather', pattern: 'solid', basePrice: 155, metallicTrim: true },
  { category: 'calcas', styleName: 'Calça Wide Leg Pantalona', brand: 'Maison Rosé', tag: 'Alfaiataria', silhouette: 'pants_wide', finish: 'cotton', pattern: 'solid', basePrice: 185, metallicTrim: true },
  { category: 'calcas', styleName: 'Jeans Skinny Vintage', brand: 'Luna Bloom', tag: 'Casual', silhouette: 'pants_skinny', finish: 'denim', pattern: 'denim', basePrice: 160 },
  // Sapatos (12)
  { category: 'sapatos', styleName: 'Scarpin Salto Fino Verniz', brand: 'Velours Paris', tag: 'Gala', silhouette: 'shoe_heels', finish: 'leather', pattern: 'solid', basePrice: 195, metallicTrim: true },
  { category: 'sapatos', styleName: 'Bota Cano Alto Couro', brand: 'Atelier du Nord', tag: 'Inverno', silhouette: 'shoe_boots', finish: 'leather', pattern: 'solid', basePrice: 245, metallicTrim: true },
  { category: 'sapatos', styleName: 'Sandália Tiras Cristal', brand: 'Atelier Lux', tag: 'Festa', silhouette: 'shoe_sandals', finish: 'silk', pattern: 'solid', basePrice: 175, metallicTrim: true },
  { category: 'sapatos', styleName: 'Tênis Plataforma Branco', brand: 'Luna Bloom', tag: 'Streetwear', silhouette: 'shoe_sneakers', finish: 'leather', pattern: 'solid', basePrice: 165 },
  // Acessórios (6)
  { category: 'acessorios', styleName: 'Bolsa Matelassê Alça Dourada', brand: 'Maison Rosé', tag: 'Luxo', silhouette: 'acc_bag', finish: 'leather', pattern: 'solid', basePrice: 220, metallicTrim: true },
  { category: 'acessorios', styleName: 'Óculos Gatinho Retrô', brand: 'Optica Sol', tag: 'Editorial', silhouette: 'acc_sunglasses', finish: 'metallic', pattern: 'solid', basePrice: 125, metallicTrim: true },
  { category: 'acessorios', styleName: 'Brincos Gota Cristal', brand: 'Atelier Lux', tag: 'Gala', silhouette: 'acc_earrings', finish: 'crystal', pattern: 'solid', basePrice: 140, metallicTrim: true },
];

const FEMALE_HAIR_BLUEPRINTS: Array<{ styleName: string; silhouette: Hair3DSilhouette; price: number }> = [
  { styleName: 'Ondas Longas Sereia', silhouette: 'waves_long', price: 180 },
  { styleName: 'Liso Espelhado Passarela', silhouette: 'straight_sleek', price: 175 },
  { styleName: 'Bob Francês Clássico', silhouette: 'bob_classic', price: 155 },
  { styleName: 'Coque Alto Baile Real', silhouette: 'high_bun', price: 170 },
  { styleName: 'Rabo de Cavalo Duplo Pop', silhouette: 'ponytail_high', price: 165 },
  { styleName: 'Cachos Volumosos Diva', silhouette: 'curly_voluminous', price: 185 },
];

function buildMaleAmCatalog100(): ClothingItem[] {
  const items: ClothingItem[] = [];
  let index = 0;

  // 12 Cabelos masculinos (6 estilos x 2 cores)
  for (let i = 0; i < MALE_HAIR_BLUEPRINTS.length; i++) {
    const hb = MALE_HAIR_BLUEPRINTS[i];
    for (let c = 0; c < 2; c++) {
      const hp = HAIR_PALETTES[(i * 2 + c) % HAIR_PALETTES.length];
      index++;
      items.push({
        id: `am_m_${String(index).padStart(3, '0')}`,
        name: `${hb.styleName} · ${hp.label}`,
        brand: 'Salon Atelier',
        category: 'cabelo',
        gender: 'masculino',
        genderStyle: 'masculino',
        itemClass: 'am',
        price: hb.price + c * 15,
        zIndex: LAYER_Z_INDEX.cabelo,
        isVipOnly: false,
        isLegendary: false,
        collectionTag: 'Hair Studio',
        swatchColor: hp.primary,
        secondaryColor: hp.secondary,
        accentColor: hp.accent,
        pattern: 'solid',
        description: `Penteado masculino 3D esculpido com fios anatômicos (${hp.label}).`,
        threeSpec: {
          hairSilhouette: hb.silhouette,
          finish: 'silk',
          highlightColor: hp.secondary,
          volumeScale: 1.0,
          lengthScale: 1.0,
        },
      });
    }
  }

  // 88 peças distribuídas pelos 21 blueprints masculinos (total = 100 exato)
  let bpIdx = 0;
  let palIdx = 0;
  while (items.length < 100) {
    const bp = MALE_BLUEPRINTS[bpIdx % MALE_BLUEPRINTS.length];
    const pal = FASHION_PALETTES[palIdx % FASHION_PALETTES.length];
    const cycle = Math.floor(palIdx / FASHION_PALETTES.length);
    index++;
    items.push({
      id: `am_m_${String(index).padStart(3, '0')}`,
      name: cycle > 0 ? `${bp.styleName} ${pal.label} II` : `${bp.styleName} ${pal.label}`,
      brand: bp.brand,
      category: bp.category,
      gender: 'masculino',
      genderStyle: 'masculino',
      itemClass: 'am',
      price: bp.basePrice + ((palIdx % 5) * 15),
      zIndex: LAYER_Z_INDEX[bp.category],
      isVipOnly: false,
      isLegendary: false,
      collectionTag: bp.tag,
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      pattern: bp.pattern,
      description: `Modelagem 3D procedural em ${bp.finish} com costuras, dobras e encaixe anatômico (${pal.label}).`,
      threeSpec: {
        garmentSilhouette: bp.silhouette,
        finish: bp.finish,
        volumeScale: bp.volumeScale ?? 1.0,
        lengthScale: bp.lengthScale ?? 1.0,
        metallicTrim: bp.metallicTrim ?? false,
      },
    });
    bpIdx++;
    palIdx += (bpIdx % MALE_BLUEPRINTS.length === 0) ? 1 : 3;
  }

  return items;
}

function buildFemaleAmCatalog100(): ClothingItem[] {
  const items: ClothingItem[] = [];
  let index = 0;

  // 12 Cabelos femininos (6 estilos x 2 cores)
  for (let i = 0; i < FEMALE_HAIR_BLUEPRINTS.length; i++) {
    const hb = FEMALE_HAIR_BLUEPRINTS[i];
    for (let c = 0; c < 2; c++) {
      const hp = HAIR_PALETTES[(i * 2 + c + 1) % HAIR_PALETTES.length];
      index++;
      items.push({
        id: `am_f_${String(index).padStart(3, '0')}`,
        name: `${hb.styleName} · ${hp.label}`,
        brand: 'Salon Atelier',
        category: 'cabelo',
        gender: 'feminino',
        genderStyle: 'feminino',
        itemClass: 'am',
        price: hb.price + c * 15,
        zIndex: LAYER_Z_INDEX.cabelo,
        isVipOnly: false,
        isLegendary: false,
        collectionTag: 'Hair Studio',
        swatchColor: hp.primary,
        secondaryColor: hp.secondary,
        accentColor: hp.accent,
        pattern: 'solid',
        description: `Penteado feminino 3D com volume esculpido e reflexos naturais (${hp.label}).`,
        threeSpec: {
          hairSilhouette: hb.silhouette,
          finish: 'silk',
          highlightColor: hp.secondary,
          volumeScale: 1.0,
          lengthScale: 1.0,
        },
      });
    }
  }

  // 88 peças distribuídas pelos blueprints femininos (total = 100 exato)
  let bpIdx = 0;
  let palIdx = 2;
  while (items.length < 100) {
    const bp = FEMALE_BLUEPRINTS[bpIdx % FEMALE_BLUEPRINTS.length];
    const pal = FASHION_PALETTES[palIdx % FASHION_PALETTES.length];
    const cycle = Math.floor(palIdx / FASHION_PALETTES.length);
    index++;
    items.push({
      id: `am_f_${String(index).padStart(3, '0')}`,
      name: cycle > 0 ? `${bp.styleName} ${pal.label} II` : `${bp.styleName} ${pal.label}`,
      brand: bp.brand,
      category: bp.category,
      gender: 'feminino',
      genderStyle: 'feminino',
      itemClass: 'am',
      price: bp.basePrice + ((palIdx % 5) * 15),
      zIndex: LAYER_Z_INDEX[bp.category],
      isVipOnly: false,
      isLegendary: false,
      collectionTag: bp.tag,
      swatchColor: pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      pattern: bp.pattern,
      description: `Peça 3D com pregas, extrusão chanfrada e tecido ${bp.finish} (${pal.label}).`,
      threeSpec: {
        garmentSilhouette: bp.silhouette,
        finish: bp.finish,
        volumeScale: bp.volumeScale ?? 1.0,
        lengthScale: bp.lengthScale ?? 1.0,
        metallicTrim: bp.metallicTrim ?? false,
      },
    });
    bpIdx++;
    palIdx += (bpIdx % FEMALE_BLUEPRINTS.length === 0) ? 1 : 3;
  }

  return items;
}

export const MALE_AM_CLOTHING_100: ClothingItem[] = buildMaleAmCatalog100();
export const FEMALE_AM_CLOTHING_100: ClothingItem[] = buildFemaleAmCatalog100();

export const LEGENDARY_CROWNS_4: ClothingItem[] = [
  {
    id: 'legendary_coroa_2023',
    name: 'Coroa 2023',
    brand: 'Casa Real Starlight',
    category: 'acessorios',
    gender: 'unissex',
    genderStyle: 'unissex',
    itemClass: 'legendary',
    price: 25000,
    zIndex: LAYER_Z_INDEX.acessorios,
    isVipOnly: false,
    isLegendary: true,
    collectionTag: 'Relíquia Lendária 2023',
    swatchColor: '#E11D48',
    secondaryColor: '#581C2F',
    accentColor: '#F59E0B',
    pattern: 'solid',
    description:
      'Relíquia Lendária edição 2023 em ouro imperial e rubis lapidados. Edição limitada de 24h na Starplaza.',
    threeSpec: {
      garmentSilhouette: 'acc_crown',
      finish: 'crystal',
      metallicTrim: true,
      emissiveIntensity: 0.42,
      highlightColor: '#FBBF24',
    },
  },
  {
    id: 'legendary_coroa_2024',
    name: 'Coroa 2024',
    brand: 'Casa Real Starlight',
    category: 'acessorios',
    gender: 'unissex',
    genderStyle: 'unissex',
    itemClass: 'legendary',
    price: 35000,
    zIndex: LAYER_Z_INDEX.acessorios,
    isVipOnly: false,
    isLegendary: true,
    collectionTag: 'Relíquia Lendária 2024',
    swatchColor: '#2563EB',
    secondaryColor: '#1E293B',
    accentColor: '#E2E8F0',
    pattern: 'solid',
    description:
      'Relíquia Lendária edição 2024 em platina real, arcos cruzados e safiras imperiais.',
    threeSpec: {
      garmentSilhouette: 'acc_crown',
      finish: 'crystal',
      metallicTrim: true,
      emissiveIntensity: 0.46,
      highlightColor: '#93C5FD',
    },
  },
  {
    id: 'legendary_coroa_2025',
    name: 'Coroa 2025',
    brand: 'Casa Real Starlight',
    category: 'acessorios',
    gender: 'unissex',
    genderStyle: 'unissex',
    itemClass: 'legendary',
    price: 45000,
    zIndex: LAYER_Z_INDEX.acessorios,
    isVipOnly: false,
    isLegendary: true,
    collectionTag: 'Relíquia Lendária 2025',
    swatchColor: '#10B981',
    secondaryColor: '#14382E',
    accentColor: '#FDE047',
    pattern: 'solid',
    description:
      'Relíquia Lendária edição 2025 esculpida em ouro 24k e esmeraldas da coroa.',
    threeSpec: {
      garmentSilhouette: 'acc_crown',
      finish: 'crystal',
      metallicTrim: true,
      emissiveIntensity: 0.5,
      highlightColor: '#6EE7B7',
    },
  },
  {
    id: 'legendary_coroa_2026',
    name: 'Coroa 2026',
    brand: 'Casa Real Starlight',
    category: 'acessorios',
    gender: 'unissex',
    genderStyle: 'unissex',
    itemClass: 'legendary',
    price: 60000,
    zIndex: LAYER_Z_INDEX.acessorios,
    isVipOnly: false,
    isLegendary: true,
    collectionTag: 'Relíquia Lendária 2026',
    swatchColor: '#A855F7',
    secondaryColor: '#3B0764',
    accentColor: '#FBBF24',
    pattern: 'solid',
    description:
      'Coroa Suprema 2026 com quatro arcos imperiais, orbe de ametista prismática e ouro astral.',
    threeSpec: {
      garmentSilhouette: 'acc_crown',
      finish: 'crystal',
      metallicTrim: true,
      emissiveIntensity: 0.56,
      highlightColor: '#E9D5FF',
    },
  },
];

export const SPECIAL_ACCESSORIES_NEW: ClothingItem[] = [
  {
    id: 'legendary_tapa_olho',
    name: 'Tapa-Olho Lendário',
    brand: 'Casa Real Starlight',
    category: 'acessorios',
    accessorySlot: 'face',
    gender: 'unissex',
    genderStyle: 'unissex',
    itemClass: 'legendary',
    price: 18000,
    zIndex: LAYER_Z_INDEX.acessorios,
    isVipOnly: false,
    isLegendary: true,
    collectionTag: 'Relíquia Lendária',
    swatchColor: '#18181B',
    secondaryColor: '#D4A853',
    accentColor: '#E11D48',
    pattern: 'solid',
    description:
      'Relíquia Lendária de couro escuro com moldura em ouro 24k, alça dupla e rubi central incrustado.',
    threeSpec: {
      garmentSilhouette: 'acc_eyepatch',
      finish: 'leather',
      metallicTrim: true,
      emissiveIntensity: 0.35,
      highlightColor: '#F59E0B',
    },
  },
  {
    id: 'acc_relogio_ouro_atelier',
    name: 'Relógio de Ouro',
    brand: 'Atelier Chronos',
    category: 'acessorios',
    accessorySlot: 'arm',
    gender: 'unissex',
    genderStyle: 'unissex',
    itemClass: 'am',
    price: 850,
    zIndex: LAYER_Z_INDEX.acessorios,
    isVipOnly: false,
    collectionTag: 'Joalheria Clássica',
    swatchColor: '#FBBF24',
    secondaryColor: '#B45309',
    accentColor: '#FEF3C7',
    pattern: 'solid',
    description:
      'Relógio de pulso em ouro maciço com elos polidos, caixa canelada e mostrador marfim de alta relojoaria.',
    threeSpec: {
      garmentSilhouette: 'acc_watch',
      finish: 'metallic',
      metallicTrim: true,
      emissiveIntensity: 0.12,
      highlightColor: '#FDE68A',
    },
  },
  {
    id: 'legendary_dragaozinho',
    name: 'Dragãozinho Lendário',
    brand: 'Santuário Místico Starlight',
    category: 'acessorios',
    accessorySlot: 'companion',
    gender: 'unissex',
    genderStyle: 'unissex',
    itemClass: 'legendary',
    price: 50000,
    zIndex: LAYER_Z_INDEX.acessorios + 4,
    isVipOnly: false,
    isLegendary: true,
    collectionTag: 'Companheiro Lendário',
    swatchColor: '#DC2626',
    secondaryColor: '#F59E0B',
    accentColor: '#38BDF8',
    pattern: 'solid',
    description:
      'Companheiro Lendário vivo: dragãozinho encantado com escamas rubi, chifres dourados e asas móveis que voa ao lado do avatar.',
    threeSpec: {
      garmentSilhouette: 'acc_dragon',
      finish: 'crystal',
      metallicTrim: true,
      emissiveIntensity: 0.48,
      highlightColor: '#FDE047',
    },
  },
  {
    id: 'legendary_tigre_branco',
    name: 'Tigre Branco Listrado Lendário',
    brand: 'Santuário Místico Starlight',
    category: 'acessorios',
    accessorySlot: 'companion',
    gender: 'unissex',
    genderStyle: 'unissex',
    itemClass: 'legendary',
    price: 55000,
    zIndex: LAYER_Z_INDEX.acessorios + 5,
    isVipOnly: false,
    isLegendary: true,
    collectionTag: 'Companheiro Lendário',
    swatchColor: '#F8FAFC',
    secondaryColor: '#18181B',
    accentColor: '#38BDF8',
    pattern: 'striped',
    description:
      'Companheiro Lendário vivo: tigre branco majestoso com listras negras nítidas e olhos azul-gelo que caminha continuamente ao redor do avatar.',
    threeSpec: {
      garmentSilhouette: 'acc_white_tiger',
      finish: 'silk',
      metallicTrim: false,
      emissiveIntensity: 0.14,
      highlightColor: '#E2E8F0',
    },
  },
];

