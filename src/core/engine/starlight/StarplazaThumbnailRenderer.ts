/**
 * StarplazaThumbnailRenderer — Renderizador Off-Screen para Vitrines da Starplaza e Guarda-Roupa.
 * Desenha a peça isolada em um <canvas> invisível, calcula automaticamente a Bounding Box
 * dos pixels visíveis, centraliza perfeitamente e aplica escala proporcional para gerar um DataURL nítido.
 */

import type { ClothingItem } from '../../../types/game';
import { AvatarRigAssembler } from './AvatarRigAssembler.ts';
import { type BoneAnchors, type StarlightItemAsset, toStarlightItemAsset } from './types.ts';

const THUMBNAIL_CACHE = new Map<string, string>();
const SHARED_ASSEMBLER = new AvatarRigAssembler();

const NEUTRAL_THUMBNAIL_BONES: BoneAnchors = {
  head: { x: 0, y: -124, rotation: 0, scaleX: 1, scaleY: 1 },
  torso: { x: 0, y: -84, rotation: 0, scaleX: 1, scaleY: 1 },
  left_arm: { x: -16, y: -96, rotation: 0.06, scaleX: 1, scaleY: 1 },
  right_arm: { x: 16, y: -96, rotation: -0.06, scaleX: 1, scaleY: 1 },
  legs: { x: 0, y: -52, rotation: 0, scaleX: 1, scaleY: 1 },
  feet: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
};

export interface PixelBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Escaneia os pixels alfa do canvas off-screen para encontrar a caixa delimitadora exata
 * do item desenhado, eliminando espaços vazios ou cortes nas bordas.
 */
function computeVisiblePixelBoundingBox(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): PixelBoundingBox | null {
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const { data } = imageData;

  let minX = canvasWidth;
  let minY = canvasHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvasHeight; y += 1) {
    const rowOffset = y * canvasWidth * 4;
    for (let x = 0; x < canvasWidth; x += 1) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Função dedicada exigida para vitrines:
 * renderItemThumbnail(itemAsset, width, height) -> DataURL PNG centralizado e sem cortes.
 */
export function renderItemThumbnail(
  itemInput: StarlightItemAsset | ClothingItem,
  width = 128,
  height = 128,
): string {
  if ('thumbnail_url' in itemInput && itemInput.thumbnail_url) {
    return itemInput.thumbnail_url;
  }
  if ('customLayerPngUrl' in itemInput && itemInput.customLayerPngUrl) {
    return itemInput.customLayerPngUrl;
  }
  if (typeof document === 'undefined') return '';

  const asset: StarlightItemAsset =
    'price' in itemInput ? toStarlightItemAsset(itemInput) : itemInput;

  const cacheKey = `${asset.id}_${asset.swatchColor}_${asset.secondaryColor ?? ''}_${asset.accentColor ?? ''}_${asset.pattern ?? ''}_${width}x${height}`;
  const cached = THUMBNAIL_CACHE.get(cacheKey);
  if (cached) return cached;

  // 1. Canvas de trabalho off-screen amplo para garantir zero corte antes do recorte
  const scratchSize = 240;
  const scratchCanvas = document.createElement('canvas');
  scratchCanvas.width = scratchSize;
  scratchCanvas.height = scratchSize;
  const scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true });
  if (!scratchCtx) return '';

  scratchCtx.imageSmoothingEnabled = true;
  scratchCtx.imageSmoothingQuality = 'high';

  // Desenha a peça isolada centrada no espaço do rig (y=195 posiciona corpo inteiro dentro de 240px)
  scratchCtx.save();
  scratchCtx.translate(scratchSize / 2, 196);
  SHARED_ASSEMBLER.drawProceduralGarment(
    scratchCtx,
    asset,
    NEUTRAL_THUMBNAIL_BONES,
    asset.gender === 'masculino',
    false,
  );
  scratchCtx.restore();

  // 2. Calcula Bounding Box automático dos pixels visíveis
  const bbox = computeVisiblePixelBoundingBox(scratchCtx, scratchSize, scratchSize);

  // 3. Canvas final de saída com proporção e centralização perfeitas
  const outCanvas = document.createElement('canvas');
  outCanvas.width = Math.max(16, Math.round(width));
  outCanvas.height = Math.max(16, Math.round(height));
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return '';

  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';

  if (bbox) {
    const paddingRatio = 0.14;
    const targetW = outCanvas.width * (1 - paddingRatio * 2);
    const targetH = outCanvas.height * (1 - paddingRatio * 2);
    const scale = Math.min(targetW / bbox.width, targetH / bbox.height);

    const drawW = bbox.width * scale;
    const drawH = bbox.height * scale;
    const destX = (outCanvas.width - drawW) / 2;
    const destY = (outCanvas.height - drawH) / 2;

    outCtx.drawImage(
      scratchCanvas,
      bbox.minX,
      bbox.minY,
      bbox.width,
      bbox.height,
      destX,
      destY,
      drawW,
      drawH,
    );
  }

  const dataUrl = outCanvas.toDataURL('image/png');
  if (THUMBNAIL_CACHE.size > 300) {
    const firstKey = THUMBNAIL_CACHE.keys().next().value;
    if (firstKey) THUMBNAIL_CACHE.delete(firstKey);
  }
  THUMBNAIL_CACHE.set(cacheKey, dataUrl);
  return dataUrl;
}

export class StarplazaThumbnailRenderer {
  render(
    itemAsset: StarlightItemAsset | ClothingItem,
    width = 128,
    height = 128,
  ): string {
    return renderItemThumbnail(itemAsset, width, height);
  }

  clearCache(): void {
    THUMBNAIL_CACHE.clear();
  }
}
