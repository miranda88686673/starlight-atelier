/**
 * EngineCore — Loop principal (60 FPS com deltaTime), gerenciador de Viewport responsivo,
 * anti-aliasing de pixels e Câmera 2D com zoom suave e centralização no jogador local.
 */

import type { Camera2DState, EngineViewportConfig } from './types.ts';

export type EngineFrameCallback = (
  deltaTime: number,
  elapsedTime: number,
  ctx: CanvasRenderingContext2D,
) => void;

export class EngineCore {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: Required<EngineViewportConfig>;
  private camera: Camera2DState;

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private elapsedTime = 0;
  private resizeObserver: ResizeObserver | null = null;
  private onFrame: EngineFrameCallback | null = null;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, config: EngineViewportConfig) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('EngineCore: Contexto Canvas 2D indisponível.');
    }

    this.canvas = canvas;
    this.ctx = context;
    this.config = {
      logicalWidth: config.logicalWidth,
      logicalHeight: config.logicalHeight,
      maxDpr: config.maxDpr ?? 2,
      enableSmoothing: config.enableSmoothing ?? true,
    };

    this.camera = {
      x: this.config.logicalWidth / 2,
      y: this.config.logicalHeight / 2,
      targetX: this.config.logicalWidth / 2,
      targetY: this.config.logicalHeight / 2,
      zoom: 1,
      targetZoom: 1,
      smoothing: 6.5,
    };

    this.handleResize();
    this.observeContainerResize();
  }

  private observeContainerResize(): void {
    if (typeof window === 'undefined') return;
    const parent = this.canvas.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(parent);
    }
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Ajusta resolução física com devicePixelRatio mantendo proporção nítida
   * tanto em desktop quanto em dispositivos móveis.
   */
  readonly handleResize = (): void => {
    const dprRaw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.dpr = Math.min(this.config.maxDpr, Math.max(1, dprRaw));

    const parent = this.canvas.parentElement;
    const displayW = parent?.clientWidth || this.config.logicalWidth;
    const displayH = parent?.clientHeight || this.config.logicalHeight;

    const targetW = Math.max(1, Math.round(displayW * this.dpr));
    const targetH = Math.max(1, Math.round(displayH * this.dpr));

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    this.applyPixelSmoothing();
  };

  /** Ativa suavização de pixels de alta qualidade (anti-aliasing) */
  private applyPixelSmoothing(): void {
    this.ctx.imageSmoothingEnabled = this.config.enableSmoothing;
    if (this.config.enableSmoothing) {
      this.ctx.imageSmoothingQuality = 'high';
    }
  }

  /** Atualiza alvo da câmera 2D (ex: posição do avatar do jogador local) */
  setCameraTarget(x: number, y: number): void {
    this.camera.targetX = x;
    this.camera.targetY = y;
  }

  /** Define zoom desejado da câmera (interpolado suavemente a cada frame) */
  setCameraZoom(zoom: number): void {
    this.camera.targetZoom = Math.max(0.75, Math.min(2.2, zoom));
  }

  getCamera(): Readonly<Camera2DState> {
    return this.camera;
  }

  getLogicalSize(): { width: number; height: number } {
    return {
      width: this.config.logicalWidth,
      height: this.config.logicalHeight,
    };
  }

  /** Interpola posição e zoom da câmera usando deltaTime independente do FPS */
  private updateCamera(deltaTime: number): void {
    const t = 1 - Math.exp(-this.camera.smoothing * deltaTime);
    this.camera.x += (this.camera.targetX - this.camera.x) * t;
    this.camera.y += (this.camera.targetY - this.camera.y) * t;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * t;

    // Clamping suave quando com zoom para evitar bordas vazias excessivas
    const halfViewW = this.config.logicalWidth / (2 * this.camera.zoom);
    const halfViewH = this.config.logicalHeight / (2 * this.camera.zoom);

    if (halfViewW * 2 <= this.config.logicalWidth) {
      this.camera.x = Math.max(
        halfViewW,
        Math.min(this.config.logicalWidth - halfViewW, this.camera.x),
      );
    } else {
      this.camera.x = this.config.logicalWidth / 2;
    }

    if (halfViewH * 2 <= this.config.logicalHeight) {
      this.camera.y = Math.max(
        halfViewH,
        Math.min(this.config.logicalHeight - halfViewH, this.camera.y),
      );
    } else {
      this.camera.y = this.config.logicalHeight / 2;
    }
  }

  /**
   * Aplica a matriz de projeção responsiva + transformação da Câmera 2D
   * preservando a proporção exata da sala no Canvas.
   */
  beginWorldTransform(): void {
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const scaleX = canvasW / this.config.logicalWidth;
    const scaleY = canvasH / this.config.logicalHeight;
    const fitScale = Math.min(scaleX, scaleY);

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, canvasW, canvasH);
    this.applyPixelSmoothing();

    // Centraliza o viewport lógico dentro do canvas físico e aplica câmera 2D
    this.ctx.save();
    this.ctx.translate(canvasW / 2, canvasH / 2);
    this.ctx.scale(fitScale * this.camera.zoom, fitScale * this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);
  }

  endWorldTransform(): void {
    this.ctx.restore();
  }

  /** Converte coordenada de tela (ex: clique do mouse) para coordenada lógica da sala */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * this.dpr;
    const py = (clientY - rect.top) * this.dpr;

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const fitScale = Math.min(
      canvasW / this.config.logicalWidth,
      canvasH / this.config.logicalHeight,
    );
    const totalScale = fitScale * this.camera.zoom;

    return {
      x: (px - canvasW / 2) / totalScale + this.camera.x,
      y: (py - canvasH / 2) / totalScale + this.camera.y,
    };
  }

  /** Inicia o loop principal de 60 FPS baseado em requestAnimationFrame */
  start(onFrame: EngineFrameCallback): void {
    this.onFrame = onFrame;
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();

    const loop = (now: number) => {
      // Limita deltaTime a 50ms para evitar saltos bruscos ao trocar de aba
      const rawDelta = (now - this.lastTimestamp) / 1000;
      const deltaTime = Math.min(0.05, Math.max(0.0001, rawDelta));
      this.lastTimestamp = now;
      this.elapsedTime += deltaTime;

      this.updateCamera(deltaTime);
      this.beginWorldTransform();
      this.onFrame?.(deltaTime, this.elapsedTime, this.ctx);
      this.endWorldTransform();

      this.rafId = window.requestAnimationFrame(loop);
    };

    this.rafId = window.requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }
  }
}
