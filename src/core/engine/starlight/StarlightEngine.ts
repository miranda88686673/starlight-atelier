/**
 * StarlightEngine — Super Motor Gráfico 2D/2.5D Modular (60 FPS) do Starlight Atelier.
 *
 * Integra:
 * 1. EngineCore (loop requestAnimationFrame com deltaTime, anti-aliasing, resize responsivo e Câmera 2D)
 * 2. AvatarRigAssembler (camadas rigorosas 0..8, bone anchors e animações Idle/Walk/Sit)
 * 3. DepthSorter (Y-Sorting dinâmico para sobreposição 2.5D entre avatares e móveis)
 * 4. FXPipeline (iluminação ambiente, partículas Starlight dust e pulsos sincronizados com Cabine de DJ)
 * 5. StarplazaThumbnailRenderer (renderItemThumbnail off-screen com bounding box automático)
 */

import type {
  ClothingItem,
  RoomAvatarPresence,
  RoomBackdropTheme,
  RoomDjTrack,
} from '../../../types/game';
import { AvatarRigAssembler } from './AvatarRigAssembler.ts';
import { DepthSorter } from './DepthSorter.ts';
import { EngineCore } from './EngineCore.ts';
import { FXPipeline } from './FXPipeline.ts';
import {
  renderItemThumbnail,
  StarplazaThumbnailRenderer,
} from './StarplazaThumbnailRenderer.ts';
import {
  type AmbientLightingMode,
  type AvatarRenderEntity,
  type DepthSortableEntity,
  type DjLightSyncState,
  type RoomPropEntity,
  type StarlightItemAsset,
  resolveLightingModeFromBackdrop,
} from './types.ts';

export type StarlightEngineRenderMode = 'full_scene' | 'fx_overlay' | 'wardrobe_stage';

export interface StarlightEngineOptions {
  logicalWidth?: number;
  logicalHeight?: number;
  mode?: StarlightEngineRenderMode;
  enableSmoothing?: boolean;
}

export class StarlightEngine {
  readonly core: EngineCore;
  readonly rigAssembler: AvatarRigAssembler;
  readonly depthSorter: DepthSorter;
  readonly fxPipeline: FXPipeline;
  readonly thumbnailRenderer: StarplazaThumbnailRenderer;

  private mode: StarlightEngineRenderMode;
  private localPlayerId: string | null = null;
  private avatars = new Map<string, AvatarRenderEntity>();
  private props: RoomPropEntity[] = [];
  private catalogMap = new Map<string, ClothingItem>();
  private autoCenterCamera = true;
  private danceFloorPos = { x: 500, y: 390 };

  constructor(canvas: HTMLCanvasElement, options: StarlightEngineOptions = {}) {
    this.mode = options.mode ?? 'full_scene';
    this.core = new EngineCore(canvas, {
      logicalWidth: options.logicalWidth ?? 1000,
      logicalHeight: options.logicalHeight ?? 580,
      enableSmoothing: options.enableSmoothing ?? true,
    });
    this.rigAssembler = new AvatarRigAssembler();
    this.depthSorter = new DepthSorter();
    this.fxPipeline = new FXPipeline();
    this.thumbnailRenderer = new StarplazaThumbnailRenderer();
  }

  /** Inicia o loop principal de renderização a 60 FPS */
  start(): void {
    this.core.start((deltaTime, elapsedTime, ctx) => {
      this.tickAndRender(deltaTime, elapsedTime, ctx);
    });
  }

  stop(): void {
    this.core.stop();
  }

  destroy(): void {
    this.core.destroy();
    this.avatars.clear();
    this.props = [];
  }

  setMode(mode: StarlightEngineRenderMode): void {
    this.mode = mode;
  }

  setCatalog(items: ClothingItem[]): void {
    this.catalogMap.clear();
    for (const item of items) {
      this.catalogMap.set(item.id, item);
    }
  }

  setLocalPlayerId(clientId: string | null): void {
    this.localPlayerId = clientId;
  }

  setCameraZoom(zoom: number, autoCenterOnPlayer = true): void {
    this.autoCenterCamera = autoCenterOnPlayer;
    this.core.setCameraZoom(zoom);
  }

  setRoomBackdropTheme(theme?: RoomBackdropTheme): void {
    const mode = resolveLightingModeFromBackdrop(theme);
    this.fxPipeline.setLightingMode(mode);
  }

  setAmbientLighting(mode: AmbientLightingMode): void {
    this.fxPipeline.setLightingMode(mode);
  }

  syncDjTrack(track?: RoomDjTrack | null): void {
    const djState: DjLightSyncState = track?.isPlaying
      ? { isPlaying: true, videoId: track.videoId, bpm: 124 }
      : { isPlaying: false };
    this.fxPipeline.setDjState(djState);
  }

  /** Define os objetos 2.5D da sala (mesas, cadeiras, cabine de DJ, plantas) para Y-Sorting */
  setRoomProps(props: RoomPropEntity[]): void {
    this.props = props;
    const djProp = props.find((p) => p.propType === 'dj_booth');
    if (djProp) {
      this.danceFloorPos = {
        x: Math.max(200, djProp.x - 180),
        y: Math.min(520, djProp.y + 30),
      };
    }
  }

  /** Sincroniza presenças vindas do Socket.io / GlobalStateManager para entidades suaves do motor */
  syncPresences(presences: RoomAvatarPresence[]): void {
    const { width, height } = this.core.getLogicalSize();
    const seenIds = new Set<string>();

    for (const p of presences) {
      seenIds.add(p.clientId);
      const px = (p.x / 100) * width;
      const py = (p.y / 100) * height;
      const existing = this.avatars.get(p.clientId);

      if (existing) {
        existing.targetX = px;
        existing.targetY = py;
        existing.facing = p.facing;
        existing.equipped = p.equipped;
        existing.skinTone = p.skinTone;
        existing.avatarGender = p.avatarGender;
        existing.isVip = p.isVip;
        existing.isLocalPlayer = p.clientId === this.localPlayerId;
      } else {
        this.avatars.set(p.clientId, {
          kind: 'avatar',
          id: p.clientId,
          username: p.username,
          x: px,
          y: py,
          targetX: px,
          targetY: py,
          facing: p.facing,
          pose: 'idle',
          walkSpeed: 190,
          walkCyclePhase: 0,
          idlePhase: Math.random() * Math.PI * 2,
          blinkTimer: Math.random() * 3.5,
          skinTone: p.skinTone,
          avatarGender: p.avatarGender,
          equipped: p.equipped,
          isLocalPlayer: p.clientId === this.localPlayerId,
          isVip: p.isVip,
        });
      }
    }

    for (const existingId of this.avatars.keys()) {
      if (!seenIds.has(existingId)) {
        this.avatars.delete(existingId);
      }
    }
  }

  /** Dispara partículas de poeira estelar ao redor de um avatar (ex: troca de roupa) */
  triggerOutfitSparkle(clientId?: string): void {
    const target =
      (clientId ? this.avatars.get(clientId) : undefined) ??
      (this.localPlayerId ? this.avatars.get(this.localPlayerId) : undefined);
    if (target) {
      this.fxPipeline.emitBurst(target.x, target.y - 68, 22, 34);
    } else {
      const { width, height } = this.core.getLogicalSize();
      this.fxPipeline.emitBurst(width / 2, height / 2, 22, 36);
    }
  }

  /** Emite poeira estelar em uma coordenada percentual da sala (0..100) */
  emitSparkleAtPercent(percentX: number, percentY: number, count = 18): void {
    const { width, height } = this.core.getLogicalSize();
    this.fxPipeline.emitBurst(
      (percentX / 100) * width,
      (percentY / 100) * height,
      count,
      28,
    );
  }

  /** Atalho estático e de instância para renderizar miniatura nítida off-screen na Starplaza */
  renderItemThumbnail(
    itemAsset: StarlightItemAsset | ClothingItem,
    width = 128,
    height = 128,
  ): string {
    return renderItemThumbnail(itemAsset, width, height);
  }

  private tickAndRender(
    deltaTime: number,
    elapsedTime: number,
    ctx: CanvasRenderingContext2D,
  ): void {
    const { width, height } = this.core.getLogicalSize();
    const rareAnchors: Array<{ x: number; y: number }> = [];

    // 1. Atualiza animações procedurais e interpolação de cada avatar
    let localAvatar: AvatarRenderEntity | null = null;
    for (const avatar of this.avatars.values()) {
      this.rigAssembler.stepAvatarAnimation(avatar, deltaTime);
      if (avatar.isLocalPlayer) {
        localAvatar = avatar;
      }
      if (avatar.isVip) {
        rareAnchors.push({ x: avatar.x, y: avatar.y - 54 });
      }
    }

    // 2. Centralização suave da Câmera 2D no jogador local quando zoom > 1
    if (this.autoCenterCamera && localAvatar && this.core.getCamera().targetZoom > 1.01) {
      this.core.setCameraTarget(localAvatar.x, localAvatar.y - 45);
    } else {
      this.core.setCameraTarget(width / 2, height / 2);
    }

    // 3. Atualiza partículas Starlight dust
    this.fxPipeline.update(deltaTime, width, height, rareAnchors);

    // 4. Pulso da pista de dança sincronizado com a Cabine de DJ
    this.fxPipeline.renderDjDanceFloorPulse(
      ctx,
      this.danceFloorPos.x,
      this.danceFloorPos.y,
      elapsedTime,
    );

    // 5. Renderiza entidades ordenadas por Y-Sorting (exceto no modo leve fx_overlay)
    if (this.mode !== 'fx_overlay') {
      const sortable: DepthSortableEntity[] = [
        ...this.props,
        ...Array.from(this.avatars.values()),
      ];
      const sorted = this.depthSorter.sortEntities(sortable);

      for (const entity of sorted) {
        if (entity.kind === 'prop') {
          this.drawRoomProp(ctx, entity);
        } else {
          this.rigAssembler.renderAvatar(ctx, entity, this.catalogMap);
        }
      }
    }

    // 6. Camada de atmosfera, holofotes e partículas estelares
    this.fxPipeline.renderAtmosphere(ctx, width, height, elapsedTime);
  }

  /** Renderiza objetos 2.5D básicos da sala (mesas, cadeiras, sofás, plantas, cabine de DJ) */
  private drawRoomProp(ctx: CanvasRenderingContext2D, prop: RoomPropEntity): void {
    const primary = prop.primaryColor ?? '#D6CFC7';
    const secondary = prop.secondaryColor ?? '#44403C';
    const accent = prop.accentColor ?? '#D4A853';

    ctx.save();
    ctx.translate(prop.x, prop.y);

    // Sombra de contato no piso
    ctx.fillStyle = 'rgba(28, 25, 23, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, 2, prop.width * 0.45, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (prop.propType === 'table') {
      ctx.fillStyle = secondary;
      ctx.fillRect(-prop.width * 0.34, -prop.height * 0.5, 6, prop.height * 0.5);
      ctx.fillRect(prop.width * 0.34 - 6, -prop.height * 0.5, 6, prop.height * 0.5);

      ctx.fillStyle = primary;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-prop.width / 2, -prop.height * 0.65, prop.width, 18, 6);
      ctx.fill();
      ctx.stroke();
    } else if (prop.propType === 'chair' || prop.propType === 'sofa') {
      ctx.fillStyle = primary;
      ctx.strokeStyle = secondary;
      ctx.lineWidth = 1.5;
      // Encosto
      ctx.beginPath();
      ctx.roundRect(-prop.width / 2, -prop.height, prop.width, prop.height * 0.62, 8);
      ctx.fill();
      ctx.stroke();
      // Assento
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(-prop.width / 2, -prop.height * 0.45, prop.width, prop.height * 0.36, 6);
      ctx.fill();
      ctx.stroke();
    } else if (prop.propType === 'plant') {
      // Vaso
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.moveTo(-16, -26);
      ctx.lineTo(16, -26);
      ctx.lineTo(12, 0);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      // Folhagem
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.ellipse(-8, -42, 12, 20, -0.3, 0, Math.PI * 2);
      ctx.ellipse(8, -42, 12, 20, 0.3, 0, Math.PI * 2);
      ctx.ellipse(0, -50, 11, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.propType === 'dj_booth') {
      ctx.fillStyle = '#1C1917';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-prop.width / 2, -prop.height, prop.width, prop.height, 8);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}
