/**
 * Tipos e contratos do Super Motor Gráfico 2D/2.5D `StarlightEngine`.
 * Compartilhados entre EngineCore, AvatarRigAssembler, DepthSorter, FXPipeline e StarplazaThumbnailRenderer.
 */

import type {
  AvatarGender,
  ClothingCategory,
  ClothingItem,
  DesignPattern,
  EquippedOutfit,
  RoomBackdropTheme,
  SkinToneId,
} from '../../../types/game';

/** Modos de animação procedural suportados pelo AvatarRigAssembler */
export type ProceduralAvatarPose = 'idle' | 'walk' | 'sit';

/** Âncoras anatômicas dinâmicas calculadas por frame para o esqueleto 2D */
export interface RigBoneAnchor {
  x: number;
  y: number;
  rotation: number; // em radianos
  scaleX: number;
  scaleY: number;
}

export interface BoneAnchors {
  head: RigBoneAnchor;
  torso: RigBoneAnchor;
  left_arm: RigBoneAnchor;
  right_arm: RigBoneAnchor;
  legs: RigBoneAnchor;
  feet: RigBoneAnchor;
}

/**
 * Ordem rigorosa de camadas hierárquicas (Z-Index) do montador de MeDolls:
 * 0: Sombra no chão
 * 1: Base do Corpo
 * 2: Roupas Íntimas/Pele
 * 3: Calças/Saias
 * 4: Sapatos
 * 5: Blusas/Casacos (e Vestidos)
 * 6: Cabeça/Rosto
 * 7: Cabelos
 * 8: Acessórios/Chapéus
 */
export const AVATAR_STRICT_LAYER_ORDER = {
  GROUND_SHADOW: 0,
  BODY_BASE: 1,
  UNDERWEAR_SKIN: 2,
  BOTTOMS: 3,
  SHOES: 4,
  TOPS: 5,
  HEAD_FACE: 6,
  HAIR: 7,
  ACCESSORIES: 8,
} as const;

export type AvatarStrictLayerIndex =
  (typeof AVATAR_STRICT_LAYER_ORDER)[keyof typeof AVATAR_STRICT_LAYER_ORDER];

/** Mapeia categoria de vestuário do jogo para a camada rigorosa 0..8 */
export const CLOTHING_TO_STRICT_LAYER: Record<ClothingCategory, AvatarStrictLayerIndex> = {
  calcas: AVATAR_STRICT_LAYER_ORDER.BOTTOMS,
  sapatos: AVATAR_STRICT_LAYER_ORDER.SHOES,
  blusas: AVATAR_STRICT_LAYER_ORDER.TOPS,
  vestidos: AVATAR_STRICT_LAYER_ORDER.TOPS,
  casacos: AVATAR_STRICT_LAYER_ORDER.TOPS,
  cabelo: AVATAR_STRICT_LAYER_ORDER.HAIR,
  acessorios: AVATAR_STRICT_LAYER_ORDER.ACCESSORIES,
};

/** Estado de câmera 2D com zoom suave e rastreamento do jogador */
export interface Camera2DState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  zoom: number;
  targetZoom: number;
  smoothing: number;
}

/** Configuração inicial do viewport lógico do motor */
export interface EngineViewportConfig {
  logicalWidth: number;
  logicalHeight: number;
  maxDpr?: number;
  enableSmoothing?: boolean;
}

/** Item de sprite ou roupa preparado para o montador e renderizador de vitrine */
export interface StarlightItemAsset {
  id: string;
  name: string;
  category: ClothingCategory;
  gender?: AvatarGender | 'unissex';
  swatchColor: string;
  secondaryColor?: string;
  accentColor?: string;
  pattern?: DesignPattern;
  templateId?: string;
  isVipOnly?: boolean;
  isLegendary?: boolean;
  spriteUrl?: string;
  layerOffsetX?: number;
  layerOffsetY?: number;
  layerScale?: number;
}

/** Entidade de Avatar controlada pelo motor dentro de uma sala ou provador */
export interface AvatarRenderEntity {
  kind: 'avatar';
  id: string;
  username: string;
  x: number; // posição X em coordenadas lógicas da sala
  y: number; // coordenada Y dos pés (usada no Y-Sorting)
  targetX: number;
  targetY: number;
  facing: 'left' | 'right';
  pose: ProceduralAvatarPose;
  walkSpeed?: number; // px lógicos por segundo
  walkCyclePhase: number;
  idlePhase: number;
  blinkTimer: number;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  equipped: EquippedOutfit;
  isLocalPlayer?: boolean;
  isVip?: boolean;
  seatOffsetY?: number;
}

/** Entidade de objeto/mobília 2.5D participando do Y-Sorting dinâmico */
export interface RoomPropEntity {
  kind: 'prop';
  id: string;
  propType: 'table' | 'chair' | 'sofa' | 'dj_booth' | 'plant' | 'dance_floor';
  label?: string;
  x: number;
  y: number; // coordenada Y da base/pés na sala (para Y-Sorting)
  width: number;
  height: number;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  subZ?: number;
  spriteUrl?: string;
}

/** União de qualquer entidade ordenável pelo DepthSorter */
export type DepthSortableEntity = AvatarRenderEntity | RoomPropEntity;

/** Filtros de iluminação ambiente por temática de sala */
export type AmbientLightingMode =
  | 'daylight_plaza'
  | 'warm_atelier'
  | 'sunset_rooftop'
  | 'nightclub_neon'
  | 'golden_vip';

/** Partícula leve de poeira estelar ("Starlight dust") */
export interface StarlightParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  twinklePhase: number;
}

/** Estado sincronizado da Cabine de DJ para pulsar luzes na pista */
export interface DjLightSyncState {
  isPlaying: boolean;
  videoId?: string;
  bpm?: number;
  pulseIntensity?: number;
}

/** Mapeia temas de sala do Starlight Atelier para o preset de iluminação ambiente */
export function resolveLightingModeFromBackdrop(
  theme?: RoomBackdropTheme,
): AmbientLightingMode {
  switch (theme) {
    case 'boate_neon':
    case 'estudio_3d_designer':
      return 'nightclub_neon';
    case 'hotel_royal_vip':
    case 'cobertura_diamante_vip':
      return 'golden_vip';
    case 'festa_cobertura':
    case 'bar_lounge':
      return 'sunset_rooftop';
    case 'atelier_rosa':
    case 'quarto_cozy':
    case 'cafe_starlight':
      return 'warm_atelier';
    case 'lounge_principal':
    case 'casa_estar_moderna':
    case 'floresta_piquenique':
    case 'ilha_coqueiro':
    case 'ilha_tropical':
    default:
      return 'daylight_plaza';
  }
}

/** Converte um ClothingItem padrão do jogo para StarlightItemAsset */
export function toStarlightItemAsset(item: ClothingItem): StarlightItemAsset {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    gender: item.gender ?? item.genderStyle ?? 'unissex',
    swatchColor: item.swatchColor,
    secondaryColor: item.secondaryColor,
    accentColor: item.accentColor,
    pattern: item.pattern,
    templateId: item.templateId,
    isVipOnly: item.isVipOnly,
    isLegendary: item.isLegendary,
  };
}
