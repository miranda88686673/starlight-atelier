/**
 * Canvas2DEngine — Motor base de renderização 2D em HTML5 Canvas.
 * Preparado para receber sprites modulares ordenados por z_index, ancorados em ossos
 * (bone_anchor) e com suporte a recorte automático de miniaturas via `crop_box`.
 */

import type { AvatarGender, SkinToneId } from '../../types/game';
import type { AssetSchema } from '../schemas/dbSchema';
import {
  AssetLayerManager,
  DEFAULT_SKELETON_RIG,
  type RigAnchorPoint,
} from './AssetLayerManager';

export interface CanvasRenderOptions {
  width?: number;
  height?: number;
  skinTone?: SkinToneId;
  avatarGender?: AvatarGender;
  showShadow?: boolean;
  backgroundColor?: string;
}

const SKIN_PALETTES: Record<SkinToneId, { base: string; shadow: string }> = {
  porcelana: { base: '#FCECE3', shadow: '#E7C8BA' },
  pessego: { base: '#F5D0B9', shadow: '#D8A689' },
  mel: { base: '#D49E73', shadow: '#AE764D' },
  cacau: { base: '#8B583B', shadow: '#653C25' },
};

export class Canvas2DEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private layerManager: AssetLayerManager;
  private imageCache = new Map<string, HTMLImageElement>();
  private rafId: number | null = null;
  private options: Required<CanvasRenderOptions>;
  private rig: Record<string, RigAnchorPoint> = { ...DEFAULT_SKELETON_RIG };

  constructor(
    canvas: HTMLCanvasElement,
    layerManager: AssetLayerManager = new AssetLayerManager(),
    options: CanvasRenderOptions = {},
  ) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas2DEngine: Contexto 2D indisponível neste navegador.');
    }
    this.canvas = canvas;
    this.ctx = context;
    this.layerManager = layerManager;
    this.options = {
      width: options.width ?? 220,
      height: options.height ?? 420,
      skinTone: options.skinTone ?? 'pessego',
      avatarGender: options.avatarGender ?? 'feminino',
      showShadow: options.showShadow ?? true,
      backgroundColor: options.backgroundColor ?? 'transparent',
    };
    this.configureCanvasResolution();
  }

  private configureCanvasResolution(): void {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.canvas.width = Math.round(this.options.width * dpr);
    this.canvas.height = Math.round(this.options.height * dpr);
    this.canvas.style.width = `${this.options.width}px`;
    this.canvas.style.height = `${this.options.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setLayerManager(manager: AssetLayerManager): void {
    this.layerManager = manager;
    this.renderFrame();
  }

  updateOptions(next: Partial<CanvasRenderOptions>): void {
    const sizeChanged =
      (next.width && next.width !== this.options.width) ||
      (next.height && next.height !== this.options.height);
    this.options = { ...this.options, ...next };
    if (sizeChanged) {
      this.configureCanvasResolution();
    }
    this.renderFrame();
  }

  /** Pré-carrega sprite externo em cache para desenho imediato sem flicker */
  preloadSprite(url: string): Promise<HTMLImageElement> {
    const cached = this.imageCache.get(url);
    if (cached && cached.complete) {
      return Promise.resolve(cached);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.imageCache.set(url, img);
        this.renderFrame();
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Falha ao carregar sprite: ${url}`));
      img.src = url;
    });
  }

  /** Desenha a silhueta base anatômica ancorada ao rig */
  private drawBaseMannequin(ctx: CanvasRenderingContext2D): void {
    const palette = SKIN_PALETTES[this.options.skinTone];
    const isMasc = this.options.avatarGender === 'masculino';

    ctx.save();
    if (this.options.showShadow) {
      ctx.fillStyle = 'rgba(28, 25, 23, 0.14)';
      ctx.beginPath();
      ctx.ellipse(110, 396, 46, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cabeça e pescoço
    ctx.fillStyle = palette.base;
    ctx.strokeStyle = palette.shadow;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(102, 105, 16, 22, 6);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(110, 74, isMasc ? 23 : 21, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tronco e quadris
    const shoulderHalf = isMasc ? 32 : 25;
    const waistHalf = isMasc ? 23 : 18;
    const hipHalf = isMasc ? 24 : 26;

    ctx.beginPath();
    ctx.moveTo(110 - shoulderHalf, 130);
    ctx.lineTo(110 + shoulderHalf, 130);
    ctx.quadraticCurveTo(110 + waistHalf + 4, 175, 110 + waistHalf, 195);
    ctx.quadraticCurveTo(110 + hipHalf, 220, 110 + hipHalf - 2, 240);
    ctx.lineTo(110 - hipHalf + 2, 240);
    ctx.quadraticCurveTo(110 - hipHalf, 220, 110 - waistHalf, 195);
    ctx.quadraticCurveTo(110 - waistHalf - 4, 175, 110 - shoulderHalf, 130);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pernas
    ctx.beginPath();
    ctx.roundRect(110 - hipHalf + 4, 236, 17, 148, 8);
    ctx.roundRect(110 + hipHalf - 21, 236, 17, 148, 8);
    ctx.fill();
    ctx.stroke();

    // Braços
    ctx.beginPath();
    ctx.roundRect(110 - shoulderHalf - 11, 132, 11, 104, 5);
    ctx.roundRect(110 + shoulderHalf, 132, 11, 104, 5);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /** Renderiza um único AssetSchema usando sprite externo ou fallback vetorial procedural */
  private drawAssetLayer(ctx: CanvasRenderingContext2D, asset: AssetSchema): void {
    const anchor = this.rig[asset.bone_anchor] ?? DEFAULT_SKELETON_RIG.torso;

    ctx.save();
    if (asset.spriteUrl) {
      const img = this.imageCache.get(asset.spriteUrl);
      if (img && img.complete) {
        ctx.drawImage(
          img,
          asset.crop_box.x,
          asset.crop_box.y,
          asset.crop_box.width,
          asset.crop_box.height,
        );
        ctx.restore();
        return;
      }
      void this.preloadSprite(asset.spriteUrl).catch(() => undefined);
    }

    // Fallback vetorial elegante alinhado à bone_anchor e crop_box
    const primary = asset.swatchColor ?? '#C8235D';
    const accent = asset.accentColor ?? '#D4A853';
    const box = asset.crop_box;

    ctx.translate(anchor.x, anchor.y);
    ctx.scale(anchor.scaleX, anchor.scaleY);
    ctx.translate(-anchor.x, -anchor.y);

    ctx.fillStyle = primary;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;

    if (asset.category === 'cabelo') {
      ctx.beginPath();
      ctx.ellipse(110, 62, 27, 25, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(136, 102);
      ctx.quadraticCurveTo(110, 110, 84, 102);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (asset.category === 'sapatos') {
      ctx.beginPath();
      ctx.roundRect(84, 372, 19, 14, 5);
      ctx.roundRect(117, 372, 19, 14, 5);
      ctx.fill();
      ctx.stroke();
    } else if (asset.category === 'acessorios') {
      ctx.beginPath();
      ctx.arc(box.x + box.width / 2, box.y + box.height / 2, 12, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(
        box.x + 8,
        box.y + 6,
        Math.max(24, box.width - 16),
        Math.max(24, box.height - 12),
        10,
      );
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Renderiza um quadro completo respeitando a ordem estrita de z_index */
  renderFrame(): void {
    const { width, height, backgroundColor } = this.options;
    this.ctx.clearRect(0, 0, width, height);

    if (backgroundColor !== 'transparent') {
      this.ctx.fillStyle = backgroundColor;
      this.ctx.fillRect(0, 0, width, height);
    }

    this.drawBaseMannequin(this.ctx);

    const sortedLayers = this.layerManager.getSortedLayers();
    for (const layer of sortedLayers) {
      this.drawAssetLayer(this.ctx, layer);
    }
  }

  startLoop(): void {
    if (this.rafId !== null) return;
    const tick = () => {
      this.renderFrame();
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.stopLoop();
    this.imageCache.clear();
  }

  /**
   * Gera miniatura recortada exatamente pela região `crop_box` do AssetSchema
   * para uso nos cards da Starplaza e do Guarda-Roupa.
   */
  static extractCropBoxThumbnail(
    asset: AssetSchema,
    sourceCanvas: HTMLCanvasElement,
    outputSize = 96,
  ): string {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = outputSize;
    thumbCanvas.height = outputSize;
    const thumbCtx = thumbCanvas.getContext('2d');
    if (!thumbCtx) return '';

    const { x, y, width, height } = asset.crop_box;
    const scale = Math.min(outputSize / width, outputSize / height);
    const drawW = width * scale;
    const drawH = height * scale;
    const offsetX = (outputSize - drawW) / 2;
    const offsetY = (outputSize - drawH) / 2;

    thumbCtx.drawImage(
      sourceCanvas,
      x,
      y,
      width,
      height,
      offsetX,
      offsetY,
      drawW,
      drawH,
    );

    return thumbCanvas.toDataURL('image/png');
  }
}
