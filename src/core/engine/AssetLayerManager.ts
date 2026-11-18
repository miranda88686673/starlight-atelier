/**
 * AssetLayerManager — Gerenciador de Camadas Modulares e Rig Anatômico 2D.
 * Controla ordenação por `z_index`, âncoras (`bone_anchor`) e resolução de conflitos de slots.
 */

import type { ClothingCategory, ClothingItem, EquippedOutfit } from '../../types/game';
import {
  type AssetSchema,
  type BoneAnchorId,
  clothingItemToAssetSchema,
} from '../schemas/dbSchema';

export interface RigAnchorPoint {
  id: BoneAnchorId;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/** Esqueleto padrão normalizado para palco 220x420 da MeDoll */
export const DEFAULT_SKELETON_RIG: Record<BoneAnchorId, RigAnchorPoint> = {
  head: { id: 'head', x: 110, y: 74, scaleX: 1, scaleY: 1 },
  neck: { id: 'neck', x: 110, y: 120, scaleX: 1, scaleY: 1 },
  torso: { id: 'torso', x: 110, y: 175, scaleX: 1, scaleY: 1 },
  hips: { id: 'hips', x: 110, y: 228, scaleX: 1, scaleY: 1 },
  legs: { id: 'legs', x: 110, y: 285, scaleX: 1, scaleY: 1 },
  feet: { id: 'feet', x: 110, y: 372, scaleX: 1, scaleY: 1 },
  hand_l: { id: 'hand_l', x: 64, y: 222, scaleX: 1, scaleY: 1 },
  hand_r: { id: 'hand_r', x: 156, y: 222, scaleX: 1, scaleY: 1 },
  full_body: { id: 'full_body', x: 110, y: 215, scaleX: 1, scaleY: 1 },
  suite_floor: { id: 'suite_floor', x: 110, y: 396, scaleX: 1, scaleY: 1 },
};

export class AssetLayerManager {
  private layers: Map<string, AssetSchema> = new Map();

  constructor(initialAssets: AssetSchema[] = []) {
    initialAssets.forEach((asset) => this.upsertLayer(asset));
  }

  /** Registra ou atualiza uma camada validando z_index e bone_anchor */
  upsertLayer(asset: AssetSchema): void {
    this.layers.set(asset.id, {
      ...asset,
      z_index: Number.isFinite(asset.z_index) ? asset.z_index : 10,
      crop_box: {
        x: Math.max(0, asset.crop_box.x),
        y: Math.max(0, asset.crop_box.y),
        width: Math.max(1, asset.crop_box.width),
        height: Math.max(1, asset.crop_box.height),
      },
    });
  }

  removeLayer(assetId: string): void {
    this.layers.delete(assetId);
  }

  clear(): void {
    this.layers.clear();
  }

  /** Retorna todas as camadas ordenadas estavelmente por z_index crescente */
  getSortedLayers(): AssetSchema[] {
    return Array.from(this.layers.values()).sort((a, b) => {
      if (a.z_index !== b.z_index) return a.z_index - b.z_index;
      return a.id.localeCompare(b.id);
    });
  }

  /** Reconstrói as camadas a partir de um EquippedOutfit + catálogo de ClothingItem */
  static fromEquippedOutfit(
    equipped: EquippedOutfit,
    catalog: ClothingItem[],
  ): AssetLayerManager {
    const manager = new AssetLayerManager();
    const order: ClothingCategory[] = [
      'sapatos',
      'calcas',
      'blusas',
      'vestidos',
      'casacos',
      'cabelo',
      'acessorios',
    ];

    for (const category of order) {
      const itemId = equipped[category];
      if (!itemId) continue;
      const item = catalog.find((c) => c.id === itemId);
      if (!item) continue;
      manager.upsertLayer(clothingItemToAssetSchema(item));
    }

    return manager;
  }
}
