/**
 * FXPipeline — Sistema de Iluminação Ambiente (AmbientLightLayer), Partículas ("Starlight dust")
 * e Pulsos de Luz na pista sincronizados com o estado ativo da Cabine de DJ.
 */

import type {
  AmbientLightingMode,
  DjLightSyncState,
  StarlightParticle,
} from './types.ts';

const MAX_PARTICLES = 110;

const LIGHT_PRESET_CONFIG: Record<
  AmbientLightingMode,
  {
    overlayTint: string;
    overlayAlpha: number;
    vignetteAlpha: number;
    spotlightColor: string;
    dustColors: string[];
  }
> = {
  daylight_plaza: {
    overlayTint: 'rgba(255, 250, 240, 1)',
    overlayAlpha: 0.06,
    vignetteAlpha: 0.08,
    spotlightColor: 'rgba(255, 244, 214, 0.16)',
    dustColors: ['#FDE68A', '#FFFBEB', '#F9A8D4'],
  },
  warm_atelier: {
    overlayTint: 'rgba(253, 232, 240, 1)',
    overlayAlpha: 0.1,
    vignetteAlpha: 0.14,
    spotlightColor: 'rgba(251, 207, 232, 0.22)',
    dustColors: ['#F472B6', '#FDE68A', '#FFFFFF'],
  },
  sunset_rooftop: {
    overlayTint: 'rgba(251, 146, 60, 1)',
    overlayAlpha: 0.13,
    vignetteAlpha: 0.2,
    spotlightColor: 'rgba(253, 186, 116, 0.24)',
    dustColors: ['#FBBF24', '#FB7185', '#FDE68A'],
  },
  nightclub_neon: {
    overlayTint: 'rgba(19, 15, 48, 1)',
    overlayAlpha: 0.34,
    vignetteAlpha: 0.38,
    spotlightColor: 'rgba(168, 85, 247, 0.32)',
    dustColors: ['#38BDF8', '#EC4899', '#A855F7', '#FDE68A'],
  },
  golden_vip: {
    overlayTint: 'rgba(42, 28, 14, 1)',
    overlayAlpha: 0.16,
    vignetteAlpha: 0.24,
    spotlightColor: 'rgba(212, 168, 83, 0.28)',
    dustColors: ['#FDE047', '#F59E0B', '#FFFBEB'],
  },
};

export class FXPipeline {
  private lightingMode: AmbientLightingMode = 'daylight_plaza';
  private djState: DjLightSyncState = { isPlaying: false, bpm: 122 };
  private particles: StarlightParticle[] = [];
  private ambientSpawnAccumulator = 0;

  setLightingMode(mode: AmbientLightingMode): void {
    this.lightingMode = mode;
  }

  getLightingMode(): AmbientLightingMode {
    return this.lightingMode;
  }

  setDjState(state: DjLightSyncState): void {
    this.djState = {
      bpm: 124,
      ...state,
    };
  }

  /** Emite uma explosão sutil de partículas estelares (ex: ao trocar de roupa ou clicar em item raro) */
  emitBurst(x: number, y: number, count = 16, radius = 26): void {
    const palette = LIGHT_PRESET_CONFIG[this.lightingMode].dustColors;
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= MAX_PARTICLES) {
        this.particles.shift();
      }
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 18 + Math.random() * 44;
      const maxLife = 0.7 + Math.random() * 0.7;

      this.particles.push({
        x: x + (Math.random() - 0.5) * radius * 0.5,
        y: y + (Math.random() - 0.5) * radius * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        size: 2 + Math.random() * 3.5,
        alpha: 1,
        life: 0,
        maxLife,
        color: palette[i % palette.length],
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  /** Atualiza física das partículas e gera "Starlight dust" ambiente na pista/itens VIP */
  update(
    deltaTime: number,
    width: number,
    height: number,
    rareAnchors: Array<{ x: number; y: number }> = [],
  ): void {
    const palette = LIGHT_PRESET_CONFIG[this.lightingMode].dustColors;
    const spawnRate = this.djState.isPlaying ? 14 : 5;
    this.ambientSpawnAccumulator += deltaTime * spawnRate;

    while (this.ambientSpawnAccumulator >= 1) {
      this.ambientSpawnAccumulator -= 1;
      if (this.particles.length >= MAX_PARTICLES) break;

      const useRareAnchor = rareAnchors.length > 0 && Math.random() < 0.45;
      const anchor = useRareAnchor
        ? rareAnchors[Math.floor(Math.random() * rareAnchors.length)]
        : null;

      const px = anchor ? anchor.x + (Math.random() - 0.5) * 44 : Math.random() * width;
      const py = anchor
        ? anchor.y - 20 + (Math.random() - 0.5) * 56
        : height * (0.45 + Math.random() * 0.48);

      this.particles.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 14,
        vy: -12 - Math.random() * 20,
        size: 1.4 + Math.random() * 2.6,
        alpha: 0.85,
        life: 0,
        maxLife: 1.4 + Math.random() * 1.3,
        color: palette[Math.floor(Math.random() * palette.length)],
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    // Atualiza posições e remove expiradas
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life += deltaTime;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vx *= 0.985;
      p.twinklePhase += deltaTime * 8;
      const progress = p.life / p.maxLife;
      p.alpha = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
    }
  }

  /** Renderiza a pista de dança pulsando no ritmo do DJ (abaixo dos avatares) */
  renderDjDanceFloorPulse(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    elapsedTime: number,
  ): void {
    if (!this.djState.isPlaying) return;

    const bpm = this.djState.bpm ?? 124;
    const beatHz = bpm / 60;
    const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * Math.PI * 2 * beatHz);
    const radiusX = 138 + pulse * 18;
    const radiusY = 44 + pulse * 7;

    ctx.save();
    const grad = ctx.createRadialGradient(
      centerX,
      centerY,
      10,
      centerX,
      centerY,
      radiusX,
    );
    grad.addColorStop(0, `rgba(236, 72, 153, ${0.28 + pulse * 0.2})`);
    grad.addColorStop(0.55, `rgba(56, 189, 248, ${0.18 + pulse * 0.14})`);
    grad.addColorStop(1, 'rgba(168, 85, 247, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Anel rítmico pulsante
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.25 + pulse * 0.45})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX * 0.72, radiusY * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renderiza a camada final de atmosfera (`AmbientLightLayer`):
   * filtro de cor ambiente, holofotes de boate sincronizados com DJ e partículas Starlight dust.
   */
  renderAtmosphere(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    elapsedTime: number,
  ): void {
    const preset = LIGHT_PRESET_CONFIG[this.lightingMode];

    ctx.save();

    // 1. Filtro de cor ambiente
    ctx.globalAlpha = preset.overlayAlpha;
    ctx.fillStyle = preset.overlayTint;
    ctx.fillRect(0, 0, width, height);

    // 2. Holofotes cênicos superiores (intensificados quando Cabine de DJ está tocando)
    const djBoost = this.djState.isPlaying
      ? 0.5 + 0.5 * Math.sin(elapsedTime * ((this.djState.bpm ?? 124) / 60) * Math.PI * 2)
      : 0;

    if (this.lightingMode === 'nightclub_neon' || this.djState.isPlaying) {
      const beamSweep1 = Math.sin(elapsedTime * 1.1) * (width * 0.18);
      const beamSweep2 = Math.cos(elapsedTime * 0.9) * (width * 0.18);

      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.16 + djBoost * 0.16;

      this.drawSpotlightCone(ctx, width * 0.25, 0, width * 0.36 + beamSweep1, height * 0.88, '#38BDF8');
      this.drawSpotlightCone(ctx, width * 0.75, 0, width * 0.64 + beamSweep2, height * 0.88, '#EC4899');
    } else {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.25;
      const sunGrad = ctx.createRadialGradient(width * 0.5, height * 0.12, 20, width * 0.5, height * 0.4, width * 0.55);
      sunGrad.addColorStop(0, preset.spotlightColor);
      sunGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, width, height);
    }

    // 3. Vinheta perimetral suave
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.32,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, `rgba(15, 10, 20, ${preset.vignetteAlpha})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // 4. Partículas estelares ("Starlight dust")
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const twinkle = 0.55 + 0.45 * Math.sin(p.twinklePhase);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * twinkle));
      ctx.fillStyle = p.color;

      // Desenha brilho em estrela de 4 pontas + núcleo circular
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.65, 0, Math.PI * 2);
      ctx.fill();

      const arm = p.size * 1.9;
      ctx.beginPath();
      ctx.moveTo(p.x - arm, p.y);
      ctx.lineTo(p.x + arm, p.y);
      ctx.moveTo(p.x, p.y - arm);
      ctx.lineTo(p.x, p.y + arm);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.8, p.size * 0.35);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawSpotlightCone(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
    color: string,
  ): void {
    const grad = ctx.createLinearGradient(originX, originY, targetX, targetY);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(originX - 18, originY);
    ctx.lineTo(originX + 18, originY);
    ctx.lineTo(targetX + 125, targetY);
    ctx.lineTo(targetX - 125, targetY);
    ctx.closePath();
    ctx.fill();
  }
}
