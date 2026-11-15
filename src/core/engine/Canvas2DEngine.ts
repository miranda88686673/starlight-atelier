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

  /** Desenha a silhueta base anatômica ancorada ao rig (idêntica à folha de referência Masculino / Feminino) */
  private drawBaseMannequin(ctx: CanvasRenderingContext2D): void {
    const palette = SKIN_PALETTES[this.options.skinTone];
    const isMasc = this.options.avatarGender === 'masculino';
    const layers = this.layerManager.getSortedLayers();
    const hasHair = layers.some((l) => l.category === 'cabelo');
    const hasTopOrDress = layers.some((l) => l.category === 'blusas' || l.category === 'vestidos');
    const hasBottomOrDress = layers.some((l) => l.category === 'calcas' || l.category === 'vestidos');
    const isFullMalhaBase = !hasTopOrDress && !hasBottomOrDress;

    const ink = '#2B231F';
    const limbFill = isFullMalhaBase ? '#8E9484' : palette.base;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (this.options.showShadow) {
      ctx.fillStyle = 'rgba(28, 25, 23, 0.14)';
      ctx.beginPath();
      ctx.ellipse(110, 396, 46, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const shoulderHalf = isMasc ? 34 : 24;
    const waistHalf = isMasc ? 22 : 17;
    const hipHalf = isMasc ? 23 : 26.5;

    // 1. Braços (esquerdo e direito) com pose anatômica diferenciada
    const drawArm = (side: -1 | 1) => {
      const shX = 110 + side * (shoulderHalf - 2);
      const shY = 134;
      const elbowX = 110 + side * (isMasc ? shoulderHalf + 5 : shoulderHalf + 11);
      const elbowY = 182;
      const wristX = 110 + side * (isMasc ? shoulderHalf + 8 : shoulderHalf + 21);
      const wristY = 228;
      const topW = isMasc ? 11 : 8;
      const wristW = isMasc ? 5.5 : 4.2;

      ctx.fillStyle = limbFill;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(shX - side * (topW * 0.45), shY);
      ctx.quadraticCurveTo(elbowX - side * (topW * 0.55), elbowY, wristX - side * (wristW * 0.5), wristY);
      ctx.lineTo(wristX + side * (wristW * 0.5), wristY);
      ctx.quadraticCurveTo(elbowX + side * (topW * 0.65), elbowY, shX + side * (topW * 0.55), shY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Mão articulada em pele com 5 dedos
      ctx.fillStyle = palette.base;
      ctx.beginPath();
      ctx.ellipse(wristX + side * 2, wristY + 11, isMasc ? 5.5 : 5, 10, side * (isMasc ? -0.05 : -0.18), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    drawArm(-1);
    drawArm(1);

    // 2. Pernas segmentadas (coxa, joelho, panturrilha, tornozelo) + Pés descalços
    const drawLeg = (side: -1 | 1) => {
      const hipX = 110 + side * (isMasc ? 13 : 14);
      const kneeX = 110 + side * (isMasc ? 12.5 : 12);
      const ankleX = 110 + side * (isMasc ? 12 : 11);
      const thighW = isMasc ? 10 : 10.5;
      const kneeW = isMasc ? 7.5 : 7;
      const ankleW = isMasc ? 5.2 : 4.5;

      ctx.fillStyle = limbFill;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(hipX - thighW, 236);
      ctx.quadraticCurveTo(kneeX - kneeW - 1, 305, ankleX - ankleW, 374);
      ctx.lineTo(ankleX + ankleW, 374);
      ctx.quadraticCurveTo(kneeX + kneeW + 1, 305, hipX + thighW, 236);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Contorno sutil do joelho
      ctx.strokeStyle = isFullMalhaBase ? '#53584B' : palette.shadow;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(kneeX - 4.5, 304);
      ctx.quadraticCurveTo(kneeX, 300, kneeX + 4.5, 304);
      ctx.stroke();

      // Pé descalço em pele com detalhe dos dedos
      ctx.fillStyle = palette.base;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.moveTo(ankleX - ankleW, 373);
      ctx.lineTo(ankleX + ankleW, 373);
      ctx.lineTo(ankleX + side * 4 + ankleW + 2, 392);
      ctx.quadraticCurveTo(ankleX + side * 2, 396, ankleX - ankleW - 2, 392);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    drawLeg(-1);
    drawLeg(1);

    // 3. Pescoço e Tronco anatômico
    ctx.fillStyle = palette.base;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(isMasc ? 101 : 103, 102, isMasc ? 18 : 14, 28, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFullMalhaBase ? '#8E9484' : palette.base;
    ctx.beginPath();
    ctx.moveTo(110 - shoulderHalf, 130);
    ctx.lineTo(110 + shoulderHalf, 130);
    ctx.quadraticCurveTo(110 + waistHalf + 4, 174, 110 + waistHalf, 196);
    ctx.quadraticCurveTo(110 + hipHalf + 1, 222, 110 + hipHalf - 2, 240);
    ctx.lineTo(110 - hipHalf + 2, 240);
    ctx.quadraticCurveTo(110 - hipHalf - 1, 222, 110 - waistHalf, 196);
    ctx.quadraticCurveTo(110 - waistHalf - 4, 174, 110 - shoulderHalf, 130);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Contornos musculares/peitorais na malha base ou pele
    ctx.strokeStyle = isFullMalhaBase ? '#53584B' : palette.shadow;
    ctx.lineWidth = 1.1;
    if (isMasc) {
      ctx.beginPath();
      ctx.moveTo(86, 154);
      ctx.quadraticCurveTo(98, 162, 109, 155);
      ctx.moveTo(134, 154);
      ctx.quadraticCurveTo(122, 162, 111, 155);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(91, 156);
      ctx.quadraticCurveTo(100, 163, 109, 157);
      ctx.moveTo(129, 156);
      ctx.quadraticCurveTo(120, 163, 111, 157);
      ctx.stroke();
    }

    // 4. Cabeça esculpida (mandíbula quadrada masculina vs oval feminina)
    ctx.fillStyle = palette.base;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (isMasc) {
      ctx.moveTo(88, 68);
      ctx.quadraticCurveTo(88, 46, 110, 46);
      ctx.quadraticCurveTo(132, 46, 132, 68);
      ctx.quadraticCurveTo(132, 90, 121, 99);
      ctx.lineTo(110, 102);
      ctx.lineTo(99, 99);
      ctx.quadraticCurveTo(88, 90, 88, 68);
    } else {
      ctx.ellipse(110, 74, 20.5, 26, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Olhos, sobrancelhas e lábios
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(102, 72, 4.2, 2.8, 0, 0, Math.PI * 2);
    ctx.ellipse(118, 72, 4.2, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2A221E';
    ctx.beginPath();
    ctx.arc(102, 72, 2.3, 0, Math.PI * 2);
    ctx.arc(118, 72, 2.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2A1D17';
    ctx.lineWidth = isMasc ? 2.1 : 1.3;
    ctx.beginPath();
    ctx.moveTo(97, 66);
    ctx.quadraticCurveTo(102, 63.5, 107, 66);
    ctx.moveTo(113, 66);
    ctx.quadraticCurveTo(118, 63.5, 123, 66);
    ctx.stroke();

    ctx.strokeStyle = isMasc ? palette.shadow : '#C95A73';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(104.5, 87);
    ctx.quadraticCurveTo(110, 90, 115.5, 87);
    ctx.stroke();

    // 5. Cabelo Base Padrão (quando nenhum cabelo da loja está equipado)
    if (!hasHair) {
      ctx.fillStyle = '#332119';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      if (isMasc) {
        ctx.moveTo(88, 66);
        ctx.quadraticCurveTo(86, 43, 110, 41);
        ctx.quadraticCurveTo(134, 43, 132, 66);
        ctx.quadraticCurveTo(128, 54, 110, 56);
        ctx.quadraticCurveTo(93, 54, 88, 66);
      } else {
        ctx.moveTo(88, 76);
        ctx.quadraticCurveTo(86, 44, 110, 44);
        ctx.quadraticCurveTo(134, 44, 132, 76);
        ctx.quadraticCurveTo(127, 56, 110, 56);
        ctx.quadraticCurveTo(93, 56, 88, 76);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

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
