/**
 * Esquemas centrais da Fundação Integrada do Starlight Atelier.
 * Define contratos tipados compartilhados entre Backend (Node.js + Socket.io)
 * e Frontend (GlobalStateManager, Motor 2D, DJMediaSyncController e Auditoria).
 */

import type {
  AiMaintenanceLogEntry,
  BanReviewRequest,
  ClothingCategory,
  ClothingItem,
  DesignPattern,
  ItemGenderStyle,
  PlayerProgressState,
  PremiumOrder,
  PremiumPixConfig,
  PrivateMessage,
  RoomDef,
  RoomDjQueuedTrack,
  RoomDjTrack,
  RoomHealthMetric,
  RoomId,
  ServerRegion,
  SupportTicket,
  UserAccount,
  WorldModerationState,
} from '../../types/game';
import type { SharedRoomsSnapshot } from '../../utils/realtime';

/** Papéis padronizados reconhecidos pelo RoleGuard */
export type CoreStaffRole = 'admin' | 'cm' | 'moderator' | 'designer';

/** Âncoras anatômicas do esqueleto 2D da MeDoll e palco */
export type BoneAnchorId =
  | 'head'
  | 'neck'
  | 'torso'
  | 'hips'
  | 'legs'
  | 'feet'
  | 'hand_l'
  | 'hand_r'
  | 'full_body'
  | 'suite_floor';

/** Caixa de recorte padronizada para miniaturas em Loja e Guarda-Roupa */
export interface AssetCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Contrato obrigatório de metadados visuais para o Motor de Renderização 2D.
 * Todo sprite modular, roupa ou item segue esta interface padronizada.
 */
export interface AssetSchema {
  id: string;
  name: string;
  category: ClothingCategory | 'furniture' | 'body_part';
  bone_anchor: BoneAnchorId;
  z_index: number;
  crop_box: AssetCropBox;
  thumbnail_url?: string;
  spriteUrl?: string;
  layerOffsetX?: number;
  layerOffsetY?: number;
  layerScale?: number;
  templateId?: string;
  gender?: ItemGenderStyle;
  swatchColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  pattern?: DesignPattern;
}

/** Estado de presença de ciclo de vida exigido pelo Heartbeat */
export type HeartbeatLifecycleStatus = 'online' | 'away' | 'offline';

/** Registro de presença em tempo real gerenciado pelo servidor */
export interface PresenceHeartbeatRecord {
  accountId: string;
  username: string;
  displayName?: string;
  status: HeartbeatLifecycleStatus;
  lastInteractionAt: number;
  lastHeartbeatAt: number;
  socketConnected: boolean;
  serverRegion?: ServerRegion;
}

/** Entrada protegida na coleção/tabela `staff_audit_logs` */
export interface StaffAuditLogEntry {
  id: string;
  timestamp: number;
  actor_id: string;
  actor_username?: string;
  role: CoreStaffRole;
  action_type: string;
  target_id: string;
  details: string;
}

/** Token temporário de recuperação de senha persistido no servidor */
export interface PasswordResetTokenRecord {
  email: string;
  accountId: string;
  token: string;
  expiresAt: number;
  used: boolean;
}

/** Payload de sincronização de mídia externa (YouTube IFrame API) */
export interface DjMediaSyncPayload {
  roomId: RoomId;
  video_id: string;
  started_at: number;
  is_playing: boolean;
  title?: string;
  youtubeUrl?: string;
  addedBy?: string;
  queue?: RoomDjQueuedTrack[];
}

/** Documento raiz persistido no banco centralizado do servidor */
export interface ServerDatabaseDocument {
  version: number;
  catalogSchemaVersion?: number;
  updatedAt: number;
  accounts: UserAccount[];
  worldState: WorldModerationState | null;
  playersById: Record<string, PlayerProgressState>;
  aiLogs: AiMaintenanceLogEntry[];
  dms: PrivateMessage[];
  roomsSnapshot: SharedRoomsSnapshot | null;
  staff_audit_logs: StaffAuditLogEntry[];
  presences: Record<string, PresenceHeartbeatRecord>;
  support_tickets: SupportTicket[];
  ban_reviews: BanReviewRequest[];
  premium_orders?: PremiumOrder[];
  premium_pix_config?: PremiumPixConfig;
  room_health: Record<string, RoomHealthMetric>;
  password_reset_tokens?: PasswordResetTokenRecord[];
}

/** Subconjunto sincronizável via patch em tempo real */
export interface StateSyncPatchPayload {
  accounts?: UserAccount[];
  worldState?: WorldModerationState;
  playerPatch?: {
    accountId: string;
    progress: PlayerProgressState;
  };
  aiLogs?: AiMaintenanceLogEntry[];
  dms?: PrivateMessage[];
  roomsSnapshot?: SharedRoomsSnapshot;
  support_tickets?: SupportTicket[];
  ban_reviews?: BanReviewRequest[];
  premium_orders?: PremiumOrder[];
  premium_pix_config?: PremiumPixConfig;
  djTrackUpdate?: {
    roomId: RoomId;
    track: RoomDjTrack | null;
  };
  customRoom?: RoomDef;
  updatedAt?: number;
}

/** Mapeamento padrão de categoria -> âncora corporal e crop_box na MeDoll (220x420 canvas base) */
export const DEFAULT_CLOTHING_ASSET_RIG: Record<
  ClothingCategory,
  { bone_anchor: BoneAnchorId; z_index: number; crop_box: AssetCropBox }
> = {
  sapatos: {
    bone_anchor: 'feet',
    z_index: 20,
    crop_box: { x: 64, y: 332, width: 92, height: 80 },
  },
  calcas: {
    bone_anchor: 'legs',
    z_index: 30,
    crop_box: { x: 62, y: 214, width: 96, height: 145 },
  },
  blusas: {
    bone_anchor: 'torso',
    z_index: 40,
    crop_box: { x: 52, y: 122, width: 116, height: 114 },
  },
  vestidos: {
    bone_anchor: 'full_body',
    z_index: 42,
    crop_box: { x: 48, y: 122, width: 124, height: 215 },
  },
  cabelo: {
    bone_anchor: 'head',
    z_index: 50,
    crop_box: { x: 56, y: 22, width: 108, height: 112 },
  },
  acessorios: {
    bone_anchor: 'head',
    z_index: 60,
    crop_box: { x: 58, y: 40, width: 104, height: 110 },
  },
};

/** Converte um ClothingItem existente para o contrato estrito AssetSchema */
export function clothingItemToAssetSchema(item: ClothingItem): AssetSchema {
  const rig = DEFAULT_CLOTHING_ASSET_RIG[item.category];
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    bone_anchor: rig.bone_anchor,
    z_index: typeof item.zIndex === 'number' ? item.zIndex : rig.z_index,
    crop_box: item.crop_box ?? rig.crop_box,
    thumbnail_url: item.thumbnail_url,
    spriteUrl: item.customLayerPngUrl,
    layerOffsetX: item.layerOffsetX,
    layerOffsetY: item.layerOffsetY,
    layerScale: item.layerScale,
    templateId: item.templateId,
    gender: item.gender ?? item.genderStyle ?? 'unissex',
    swatchColor: item.swatchColor,
    secondaryColor: item.secondaryColor,
    accentColor: item.accentColor,
    pattern: item.pattern,
  };
}
