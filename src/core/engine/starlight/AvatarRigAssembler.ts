/**
 * AvatarRigAssembler — Montador Modular de MeDolls em HTML5 Canvas.
 * Implementa:
 * - Ordem rigorosa de camadas (0..8):
 *   0: Sombra no chão -> 1: Base do Corpo -> 2: Roupas Íntimas/Pele -> 3: Calças/Saias ->
 *   4: Sapatos -> 5: Blusas/Casacos (e Vestidos) -> 6: Cabeça/Rosto -> 7: Cabelos -> 8: Acessórios/Chapéus
 * - Pontos de ancoragem dinâmicos (Bone Anchors: head, torso, left_arm, right_arm, legs, feet)
 * - Animação Procedural Suave (Idle: respiração, Walk: interpolação XY + balanço, Sit: ajuste Y + rotação de pernas)
 */

import type { ClothingItem, SkinToneId } from '../../../types/game';
import {
  AVATAR_STRICT_LAYER_ORDER,
  type AvatarRenderEntity,
  type AvatarStrictLayerIndex,
  type BoneAnchors,
  type StarlightItemAsset,
  toStarlightItemAsset,
} from './types.ts';

const SKIN_PALETTES: Record<
  SkinToneId,
  { base: string; shadow: string; blush: string; lip: string }
> = {
  porcelana: { base: '#FCECE3', shadow: '#E5C3B4', blush: '#F4A9BA', lip: '#D86C86' },
  pessego: { base: '#F5D0B9', shadow: '#D8A689', blush: '#EC99A6', lip: '#C95A73' },
  mel: { base: '#D49E73', shadow: '#AD744B', blush: '#CE7875', lip: '#9E464D' },
  cacau: { base: '#8B583B', shadow: '#633A23', blush: '#9D4D4A', lip: '#712F34' },
};

export class AvatarRigAssembler {
  private spriteCache = new Map<string, HTMLImageElement>();

  /** Pré-carrega sprite externo em cache caso um item use textura PNG/SVG externa */
  preloadSprite(url: string): HTMLImageElement | null {
    const existing = this.spriteCache.get(url);
    if (existing) {
      return existing.complete && existing.naturalWidth > 0 ? existing : null;
    }
    if (typeof Image === 'undefined') return null;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    this.spriteCache.set(url, img);
    return null;
  }

  /**
   * Atualiza interpolação de movimento (X, Y) e fases procedurais do avatar usando deltaTime.
   * Garante velocidade idêntica em qualquer taxa de atualização de monitor (60Hz / 120Hz / 144Hz).
   */
  stepAvatarAnimation(avatar: AvatarRenderEntity, deltaTime: number): void {
    const dx = avatar.targetX - avatar.x;
    const dy = avatar.targetY - avatar.y;
    const dist = Math.hypot(dx, dy);
    const speed = avatar.walkSpeed ?? 165;

    if (dist > 1.2) {
      const step = Math.min(dist, speed * deltaTime);
      avatar.x += (dx / dist) * step;
      avatar.y += (dy / dist) * step;
      if (Math.abs(dx) > 0.5) {
        avatar.facing = dx >= 0 ? 'right' : 'left';
      }
      if (avatar.pose !== 'sit') {
        avatar.pose = 'walk';
      }
      avatar.walkCyclePhase += deltaTime * 8.5;
    } else {
      avatar.x = avatar.targetX;
      avatar.y = avatar.targetY;
      if (avatar.pose === 'walk') {
        avatar.pose = 'idle';
      }
    }

    avatar.idlePhase += deltaTime * 2.4;
    avatar.blinkTimer = (avatar.blinkTimer + deltaTime) % 4.2;
  }

  /**
   * Calcula todos os Bone Anchors (`head`, `torso`, `left_arm`, `right_arm`, `legs`, `feet`)
   * relativos ao ponto dos pés `(0, 0)` no espaço local do avatar.
   */
  computeBoneAnchors(avatar: AvatarRenderEntity): BoneAnchors {
    const isWalk = avatar.pose === 'walk';
    const isSit = avatar.pose === 'sit';

    // Idle: leve movimento de respiração vertical no tronco e cabeça
    const breathY = Math.sin(avatar.idlePhase) * 1.4;
    const walkBob = isWalk ? Math.abs(Math.sin(avatar.walkCyclePhase)) * -3.2 : 0;
    const sitDropY = isSit ? (avatar.seatOffsetY ?? 18) : 0;

    const legSwing = isWalk ? Math.sin(avatar.walkCyclePhase) * 0.34 : 0;
    const armSwing = isWalk ? Math.sin(avatar.walkCyclePhase) * 0.32 : 0;

    const isMasc = avatar.avatarGender === 'masculino';
    const armX = isMasc ? 19 : 14.5;
    const armSpread = isMasc ? 0.08 : 0.14;

    return {
      torso: {
        x: 0,
        y: -84 + breathY + walkBob + sitDropY,
        rotation: isWalk ? Math.sin(avatar.walkCyclePhase) * 0.025 : 0,
        scaleX: 1,
        scaleY: 1,
      },
      head: {
        x: 0,
        y: -124 + breathY * 1.15 + walkBob + sitDropY,
        rotation: isWalk ? Math.sin(avatar.walkCyclePhase) * 0.02 : Math.sin(avatar.idlePhase * 0.5) * 0.015,
        scaleX: 1,
        scaleY: 1,
      },
      left_arm: {
        x: -armX,
        y: -96 + breathY + walkBob + sitDropY,
        rotation: armSwing + (isSit ? -0.18 : armSpread),
        scaleX: 1,
        scaleY: 1,
      },
      right_arm: {
        x: armX,
        y: -96 + breathY + walkBob + sitDropY,
        rotation: -armSwing + (isSit ? 0.18 : -armSpread),
        scaleX: 1,
        scaleY: 1,
      },
      legs: {
        x: 0,
        y: -52 + walkBob * 0.5 + sitDropY,
        // Sit: rotação das pernas simulando posição sentada em cadeira/sofá
        rotation: isSit ? -0.45 : legSwing,
        scaleX: 1,
        scaleY: isSit ? 0.78 : 1,
      },
      feet: {
        x: 0,
        y: (isSit ? -14 : 0) + sitDropY * 0.4,
        rotation: isSit ? 0.18 : legSwing * 0.85,
        scaleX: 1,
        scaleY: 1,
      },
    };
  }

  /**
   * Renderiza a MeDoll completa respeitando rigorosamente a ordem de camadas 0..8.
   */
  renderAvatar(
    ctx: CanvasRenderingContext2D,
    avatar: AvatarRenderEntity,
    catalogMap: Map<string, ClothingItem>,
  ): void {
    const bones = this.computeBoneAnchors(avatar);
    const palette = SKIN_PALETTES[avatar.skinTone] ?? SKIN_PALETTES.pessego;
    const isMasc = avatar.avatarGender === 'masculino';
    const isSit = avatar.pose === 'sit';
    const isBlinking = avatar.blinkTimer > 4.02;

    const getAsset = (itemId?: string): StarlightItemAsset | null => {
      if (!itemId) return null;
      const found = catalogMap.get(itemId);
      return found ? toStarlightItemAsset(found) : null;
    };

    const bottomAsset = getAsset(avatar.equipped.calcas);
    const shoesAsset = getAsset(avatar.equipped.sapatos);
    const dressAsset = getAsset(avatar.equipped.vestidos);
    const topAsset = dressAsset ? null : getAsset(avatar.equipped.blusas);
    const hairAsset = getAsset(avatar.equipped.cabelo);
    const accAsset = getAsset(avatar.equipped.acessorios);

    ctx.save();
    ctx.translate(avatar.x, avatar.y);
    if (avatar.facing === 'left') {
      ctx.scale(-1, 1);
    }

    const hasTopOrDress = Boolean(dressAsset || topAsset);
    const hasBottomOrDress = Boolean(dressAsset || bottomAsset);
    const isFullMalhaBase = !hasTopOrDress && !hasBottomOrDress;

    // Pipeline estrito de camadas 0 -> 8
    for (let layer = 0 as AvatarStrictLayerIndex; layer <= 8; layer = (layer + 1) as AvatarStrictLayerIndex) {
      switch (layer) {
        case AVATAR_STRICT_LAYER_ORDER.GROUND_SHADOW: {
          ctx.save();
          ctx.fillStyle = 'rgba(28, 25, 23, 0.22)';
          ctx.beginPath();
          ctx.ellipse(0, 2, isSit ? 26 : 22, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }

        case AVATAR_STRICT_LAYER_ORDER.BODY_BASE: {
          this.drawBodyBase(ctx, bones, palette, isMasc, isSit, isFullMalhaBase);
          break;
        }

        case AVATAR_STRICT_LAYER_ORDER.UNDERWEAR_SKIN: {
          this.drawUnderwearAndSkinShading(
            ctx,
            bones,
            palette,
            isMasc,
            isSit,
            hasTopOrDress,
            hasBottomOrDress,
          );
          break;
        }

        case AVATAR_STRICT_LAYER_ORDER.BOTTOMS: {
          if (bottomAsset) {
            this.drawGarmentOnRig(ctx, bottomAsset, bones, isMasc, isSit);
          }
          break;
        }

        case AVATAR_STRICT_LAYER_ORDER.SHOES: {
          if (shoesAsset) {
            this.drawGarmentOnRig(ctx, shoesAsset, bones, isMasc, isSit);
          }
          break;
        }

        case AVATAR_STRICT_LAYER_ORDER.TOPS: {
          if (dressAsset) {
            this.drawGarmentOnRig(ctx, dressAsset, bones, isMasc, isSit);
          } else if (topAsset) {
            this.drawGarmentOnRig(ctx, topAsset, bones, isMasc, isSit);
          }
          break;
        }

        case AVATAR_STRICT_LAYER_ORDER.HEAD_FACE: {
          this.drawHeadAndFace(ctx, bones, palette, isMasc, isBlinking, !hairAsset);
          break;
        }

        case AVATAR_STRICT_LAYER_ORDER.HAIR: {
          if (hairAsset) {
            this.drawGarmentOnRig(ctx, hairAsset, bones, isMasc, isSit);
          }
          break;
        }

        case AVATAR_STRICT_LAYER_ORDER.ACCESSORIES: {
          if (accAsset) {
            this.drawGarmentOnRig(ctx, accAsset, bones, isMasc, isSit);
          }
          break;
        }
      }
    }

    ctx.restore();

    // Etiqueta discreta com nome do avatar acima da cabeça (não espelhada)
    this.drawAvatarNameplate(ctx, avatar, bones.head.y - 28);
  }

  private drawAvatarNameplate(
    ctx: CanvasRenderingContext2D,
    avatar: AvatarRenderEntity,
    topY: number,
  ): void {
    ctx.save();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    const label = avatar.isVip ? `★ ${avatar.username}` : avatar.username;
    const textW = ctx.measureText(label).width;
    const padX = 8;
    const pillW = textW + padX * 2;
    const pillH = 18;
    const rx = avatar.x - pillW / 2;
    const ry = avatar.y + topY - 12;

    ctx.fillStyle = avatar.isLocalPlayer
      ? 'rgba(200, 35, 93, 0.9)'
      : 'rgba(28, 25, 23, 0.78)';
    ctx.beginPath();
    ctx.roundRect(rx, ry, pillW, pillH, 9);
    ctx.fill();

    if (avatar.isVip) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.fillStyle = avatar.isVip ? '#FEF3C7' : '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, avatar.x, ry + pillH / 2 + 0.5);
    ctx.restore();
  }

  /** Camada 1: Esqueleto base anatômico (proporções fiéis ao Sheet Masculino / Feminino) */
  private drawBodyBase(
    ctx: CanvasRenderingContext2D,
    bones: BoneAnchors,
    palette: { base: string; shadow: string },
    isMasc: boolean,
    isSit: boolean,
    isFullMalhaBase: boolean,
  ): void {
    ctx.save();
    const ink = '#2B231F';
    const limbFill = isFullMalhaBase ? '#8E9484' : palette.base;
    ctx.lineWidth = 1.25;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const drawArm = (anchor: typeof bones.left_arm, widthTop: number) => {
      ctx.save();
      ctx.translate(anchor.x, anchor.y);
      ctx.rotate(anchor.rotation);
      // Braço + antebraço afilado
      ctx.fillStyle = limbFill;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(-widthTop / 2, 0);
      ctx.quadraticCurveTo(-widthTop / 2 - 1.5, 16, -widthTop * 0.38, 36);
      ctx.lineTo(widthTop * 0.38, 36);
      ctx.quadraticCurveTo(widthTop / 2 + 1.5, 16, widthTop / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Mão articulada em pele
      ctx.fillStyle = palette.base;
      ctx.beginPath();
      ctx.ellipse(0, 41, widthTop * 0.42, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // Braço esquerdo (atrás)
    drawArm(bones.left_arm, isMasc ? 9.5 : 7.5);

    // Perna esquerda e direita ancoradas em `legs`
    const legAngle = bones.legs.rotation;
    const drawLeg = (offsetX: number, phaseSign: number) => {
      ctx.save();
      ctx.translate(bones.legs.x + offsetX, bones.legs.y);
      ctx.rotate(isSit ? legAngle : legAngle * phaseSign);
      ctx.scale(1, bones.legs.scaleY);

      const thighW = isMasc ? 6.5 : 6.2;
      const ankleW = isMasc ? 4.2 : 3.6;

      ctx.fillStyle = limbFill;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(-thighW, 0);
      ctx.quadraticCurveTo(-thighW - 0.5, 22, -ankleW, 44);
      ctx.lineTo(ankleW, 44);
      ctx.quadraticCurveTo(thighW + 0.5, 22, thighW, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Contorno sutil do joelho
      ctx.strokeStyle = isFullMalhaBase ? '#53584B' : palette.shadow;
      ctx.beginPath();
      ctx.moveTo(-3.2, 23);
      ctx.quadraticCurveTo(0, 21, 3.2, 23);
      ctx.stroke();

      // Pé descalço em pele
      ctx.fillStyle = palette.base;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.roundRect(-ankleW - 1, 43, ankleW * 2 + 2, 8.5, 3.5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    drawLeg(isMasc ? -7.5 : -7, 1);
    drawLeg(isMasc ? 7.5 : 7, -1);

    // Tronco ancorado em `torso`
    ctx.save();
    ctx.translate(bones.torso.x, bones.torso.y);
    ctx.rotate(bones.torso.rotation);
    const shoulderW = isMasc ? 19 : 14.5;
    const waistW = isMasc ? 13 : 10;
    const hipW = isMasc ? 13.5 : 16.5;

    // Pescoço
    ctx.fillStyle = palette.base;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.roundRect(isMasc ? -5 : -4, -24, isMasc ? 10 : 8, 12, 4);
    ctx.fill();
    ctx.stroke();

    // Torso anatômico
    ctx.fillStyle = isFullMalhaBase ? '#8E9484' : palette.base;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(-shoulderW, -14);
    ctx.lineTo(shoulderW, -14);
    ctx.quadraticCurveTo(waistW + 2, 8, waistW, 18);
    ctx.quadraticCurveTo(hipW + 0.5, 28, hipW - 1, 35);
    ctx.lineTo(-hipW + 1, 35);
    ctx.quadraticCurveTo(-hipW - 0.5, 28, -waistW, 18);
    ctx.quadraticCurveTo(-waistW - 2, 8, -shoulderW, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Braço direito (frente)
    drawArm(bones.right_arm, isMasc ? 9.5 : 7.5);

    ctx.restore();
  }

  /** Camada 2: Malha base verde-oliva ou pele/clavículas quando vestido */
  private drawUnderwearAndSkinShading(
    ctx: CanvasRenderingContext2D,
    bones: BoneAnchors,
    palette: { base: string; shadow: string },
    isMasc: boolean,
    _isSit: boolean,
    hasTopOrDress: boolean,
    hasBottomOrDress: boolean,
  ): void {
    ctx.save();
    ctx.translate(bones.torso.x, bones.torso.y);
    ctx.rotate(bones.torso.rotation);

    if (!hasTopOrDress) {
      ctx.fillStyle = '#8E9484';
      ctx.strokeStyle = '#4F5548';
      ctx.lineWidth = 1;
      if (isMasc) {
        ctx.beginPath();
        ctx.moveTo(-14, -7);
        ctx.quadraticCurveTo(-7, -3, -0.5, -6);
        ctx.moveTo(14, -7);
        ctx.quadraticCurveTo(7, -3, 0.5, -6);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.quadraticCurveTo(-5, -1, -0.5, -4);
        ctx.moveTo(10, -5);
        ctx.quadraticCurveTo(5, -1, 0.5, -4);
        ctx.stroke();
      }
    }

    if (!hasBottomOrDress && hasTopOrDress) {
      ctx.fillStyle = '#8E9484';
      ctx.strokeStyle = '#2B231F';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-13.5, 22, 27, 13, 5);
      ctx.fill();
      ctx.stroke();
    }

    // Clavículas sobre a pele do decote
    ctx.strokeStyle = palette.shadow;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-7, -11);
    ctx.quadraticCurveTo(0, -8, 7, -11);
    ctx.stroke();

    ctx.restore();
  }

  /** Camada 6: Cabeça, mandíbula esculpida, olhos com piscar procedural e cabelo base padrão */
  private drawHeadAndFace(
    ctx: CanvasRenderingContext2D,
    bones: BoneAnchors,
    palette: { base: string; shadow: string; blush: string; lip: string },
    isMasc: boolean,
    isBlinking: boolean,
    showDefaultBaseHair: boolean,
  ): void {
    ctx.save();
    ctx.translate(bones.head.x, bones.head.y);
    ctx.rotate(bones.head.rotation);

    const ink = '#2B231F';
    ctx.fillStyle = palette.base;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.25;

    // Cabeça com mandíbula masculina mais quadrada e feminina oval refinada
    ctx.beginPath();
    if (isMasc) {
      ctx.moveTo(-14.5, -4);
      ctx.quadraticCurveTo(-15, -17, 0, -17.5);
      ctx.quadraticCurveTo(15, -17, 14.5, -4);
      ctx.quadraticCurveTo(14.5, 10, 7, 15.5);
      ctx.lineTo(0, 17.5);
      ctx.lineTo(-7, 15.5);
      ctx.quadraticCurveTo(-14.5, 10, -14.5, -4);
    } else {
      ctx.ellipse(0, 0, 13.8, 17, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Blush sutil
    ctx.fillStyle = palette.blush;
    ctx.globalAlpha = isMasc ? 0.16 : 0.34;
    ctx.beginPath();
    ctx.ellipse(-7, 4.5, 3, 1.7, 0, 0, Math.PI * 2);
    ctx.ellipse(7, 4.5, 3, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Olhos
    if (isBlinking) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-7.5, -1);
      ctx.lineTo(-2.5, -1);
      ctx.moveTo(2.5, -1);
      ctx.lineTo(7.5, -1);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(-5, -1.2, 2.8, 1.9, 0, 0, Math.PI * 2);
      ctx.ellipse(5, -1.2, 2.8, 1.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#2A221E';
      ctx.beginPath();
      ctx.arc(-5, -1.2, 1.65, 0, Math.PI * 2);
      ctx.arc(5, -1.2, 1.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-4.3, -1.8, 0.65, 0, Math.PI * 2);
      ctx.arc(5.7, -1.8, 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sobrancelhas definidas
    ctx.strokeStyle = '#2A1D17';
    ctx.lineWidth = isMasc ? 1.8 : 1.15;
    ctx.beginPath();
    ctx.moveTo(-8.2, -5.2);
    ctx.quadraticCurveTo(-5, -6.8, -2, -5.2);
    ctx.moveTo(2, -5.2);
    ctx.quadraticCurveTo(5, -6.8, 8.2, -5.2);
    ctx.stroke();

    // Boca definida
    ctx.strokeStyle = isMasc ? palette.shadow : palette.lip;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(-3.4, 8.2);
    ctx.quadraticCurveTo(0, 10.1, 3.4, 8.2);
    ctx.stroke();

    // Cabelo Base Padrão (Estrutura Facial e Cabelo Padrão da imagem de referência)
    if (showDefaultBaseHair) {
      ctx.fillStyle = '#332119';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.1;
      if (isMasc) {
        ctx.beginPath();
        ctx.arc(0, -4, 15.5, Math.PI * 0.96, Math.PI * 2.04);
        ctx.quadraticCurveTo(8, -13, 0, -10.5);
        ctx.quadraticCurveTo(-9, -13.5, -15.5, -3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Coque baixo traseiro + repartição ao meio
        ctx.beginPath();
        ctx.arc(0, 6, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -4, 14.8, Math.PI * 0.94, Math.PI * 2.06);
        ctx.quadraticCurveTo(8, -11, 0, -13);
        ctx.quadraticCurveTo(-8, -11, -14.8, -1.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Desenha uma peça individual ancorada ao Bone Anchor correspondente do avatar.
   */
  drawGarmentOnRig(
    ctx: CanvasRenderingContext2D,
    asset: StarlightItemAsset,
    bones: BoneAnchors,
    isMasc: boolean,
    isSit: boolean,
  ): void {
    if (asset.spriteUrl) {
      const img = this.preloadSprite(asset.spriteUrl);
      if (img) {
        const anchor =
          asset.category === 'cabelo' || asset.category === 'acessorios'
            ? bones.head
            : asset.category === 'sapatos'
              ? bones.feet
              : asset.category === 'calcas'
                ? bones.legs
                : bones.torso;
        const ox = (asset.layerOffsetX ?? 0) * 0.35;
        const oy = (asset.layerOffsetY ?? 0) * 0.35;
        const sc = asset.layerScale ?? 1;
        ctx.save();
        ctx.translate(anchor.x + ox, anchor.y + oy);
        ctx.rotate(anchor.rotation);
        ctx.scale(sc, sc);
        ctx.drawImage(img, -28, -28, 56, 56);
        ctx.restore();
        return;
      }
    }

    this.drawProceduralGarment(ctx, asset, bones, isMasc, isSit);
  }

  /**
   * Desenho vetorial procedural reutilizado tanto pelo avatar quanto pelo
   * StarplazaThumbnailRenderer (renderização isolada off-screen).
   */
  drawProceduralGarment(
    ctx: CanvasRenderingContext2D,
    asset: StarlightItemAsset,
    bones: BoneAnchors,
    isMasc = false,
    isSit = false,
  ): void {
    const primary = asset.swatchColor || '#C8235D';
    const secondary = asset.secondaryColor || '#27232A';
    const accent = asset.accentColor || '#D4A853';

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    switch (asset.category) {
      case 'calcas': {
        const isSkirt =
          asset.id.includes('saia') || asset.templateId === 'tpl_saia';
        const legRot = bones.legs.rotation;

        if (isSkirt) {
          ctx.translate(bones.torso.x, bones.torso.y + 24);
          ctx.rotate(bones.torso.rotation * 0.6);
          ctx.fillStyle = primary;
          ctx.strokeStyle = secondary;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-13, 0);
          ctx.lineTo(13, 0);
          ctx.lineTo(22, isSit ? 26 : 36);
          ctx.quadraticCurveTo(0, isSit ? 30 : 40, -22, isSit ? 26 : 36);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          this.applyPatternAccent(ctx, asset.pattern, -16, 4, 32, 26, accent);
        } else {
          const drawPantLeg = (offsetX: number, sign: number) => {
            ctx.save();
            ctx.translate(bones.legs.x + offsetX, bones.legs.y - 4);
            ctx.rotate(isSit ? legRot : legRot * sign);
            ctx.scale(1, bones.legs.scaleY);
            ctx.fillStyle = primary;
            ctx.strokeStyle = secondary;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.roundRect(-7, 0, 14, 46, 4);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          };
          drawPantLeg(-7, 1);
          drawPantLeg(7, -1);

          // Cós da calça
          ctx.save();
          ctx.translate(bones.torso.x, bones.torso.y + 24);
          ctx.fillStyle = primary;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(-14.5, 0, 29, 11, 3);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        break;
      }

      case 'sapatos': {
        const drawShoe = (offsetX: number, sign: number) => {
          ctx.save();
          ctx.translate(bones.feet.x + offsetX, bones.feet.y - 6);
          ctx.rotate(isSit ? bones.feet.rotation : bones.feet.rotation * sign);
          ctx.fillStyle = primary;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.roundRect(-7, -3, 15, 9, 4);
          ctx.fill();
          ctx.stroke();
          // Sola
          ctx.fillStyle = secondary;
          ctx.fillRect(-7, 4, 15, 2.4);
          ctx.restore();
        };
        drawShoe(-7.5, 1);
        drawShoe(7.5, -1);
        break;
      }

      case 'blusas': {
        ctx.translate(bones.torso.x, bones.torso.y);
        ctx.rotate(bones.torso.rotation);
        const wTop = isMasc ? 18.5 : 16;
        const wBot = isMasc ? 14.5 : 13.5;

        ctx.fillStyle = primary;
        ctx.strokeStyle = secondary;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-wTop, -14);
        ctx.lineTo(-5, -15);
        ctx.quadraticCurveTo(0, -10, 5, -15);
        ctx.lineTo(wTop, -14);
        ctx.lineTo(wTop + 4, 14);
        ctx.lineTo(wBot, 14);
        ctx.lineTo(wBot, 27);
        ctx.lineTo(-wBot, 27);
        ctx.lineTo(-wBot, 14);
        ctx.lineTo(-wTop - 4, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Lapela / detalhe
        this.applyPatternAccent(ctx, asset.pattern, -12, -8, 24, 30, accent);
        break;
      }

      case 'vestidos': {
        ctx.translate(bones.torso.x, bones.torso.y);
        ctx.rotate(bones.torso.rotation);

        ctx.fillStyle = primary;
        ctx.strokeStyle = secondary;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-14, -13);
        ctx.quadraticCurveTo(0, -7, 14, -13);
        ctx.lineTo(13, 18);
        ctx.lineTo(25, isSit ? 52 : 68);
        ctx.quadraticCurveTo(0, isSit ? 58 : 74, -25, isSit ? 52 : 68);
        ctx.lineTo(-13, 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cinto dourado/acento na cintura
        ctx.fillStyle = accent;
        ctx.fillRect(-13.5, 16, 27, 4);
        this.applyPatternAccent(ctx, asset.pattern, -14, 24, 28, 36, accent);
        break;
      }

      case 'cabelo': {
        ctx.translate(bones.head.x, bones.head.y);
        ctx.rotate(bones.head.rotation);

        ctx.fillStyle = primary;
        ctx.strokeStyle = secondary;
        ctx.lineWidth = 1.4;

        const isShort =
          isMasc ||
          asset.id.includes('executivo') ||
          asset.id.includes('fade');

        if (isShort) {
          ctx.beginPath();
          ctx.arc(0, -4, 17, Math.PI * 0.92, Math.PI * 2.08);
          ctx.quadraticCurveTo(10, -14, 0, -11);
          ctx.quadraticCurveTo(-10, -15, -17, -2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Cabelo longo / ondulado volumoso
          ctx.beginPath();
          ctx.arc(0, -4, 17.5, Math.PI, Math.PI * 2);
          ctx.quadraticCurveTo(22, 10, 19, 32);
          ctx.quadraticCurveTo(12, 28, 13, 12);
          ctx.quadraticCurveTo(0, -14, -13, 12);
          ctx.quadraticCurveTo(-12, 28, -19, 32);
          ctx.quadraticCurveTo(-22, 10, -17.5, -4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        break;
      }

      case 'acessorios': {
        const isHatOrCrown =
          asset.id.includes('coroa') ||
          asset.id.includes('boina') ||
          asset.id.includes('bone') ||
          asset.id.includes('chapeu') ||
          asset.id.includes('tiara') ||
          asset.templateId === 'tpl_coroa';
        const isGlasses =
          asset.id.includes('oculos') || asset.templateId === 'tpl_oculos';

        if (isHatOrCrown) {
          ctx.translate(bones.head.x, bones.head.y - 16);
          ctx.rotate(bones.head.rotation);
          ctx.fillStyle = primary;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-13, 3);
          ctx.lineTo(-10, -9);
          ctx.lineTo(-4, -2);
          ctx.lineTo(0, -12);
          ctx.lineTo(4, -2);
          ctx.lineTo(10, -9);
          ctx.lineTo(13, 3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (isGlasses) {
          ctx.translate(bones.head.x, bones.head.y - 1);
          ctx.rotate(bones.head.rotation);
          ctx.fillStyle = primary;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(-11, -3.5, 9, 6.5, 2.5);
          ctx.roundRect(2, -3.5, 9, 6.5, 2.5);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-2, -1);
          ctx.lineTo(2, -1);
          ctx.stroke();
        } else {
          // Bolsa ou joia na mão direita / pescoço
          ctx.translate(bones.right_arm.x + 2, bones.right_arm.y + 34);
          ctx.rotate(bones.right_arm.rotation);
          ctx.fillStyle = primary;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.roundRect(-8, 0, 16, 13, 3);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 5, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
    }

    ctx.restore();
  }

  private applyPatternAccent(
    ctx: CanvasRenderingContext2D,
    pattern: StarlightItemAsset['pattern'],
    x: number,
    y: number,
    w: number,
    h: number,
    accent: string,
  ): void {
    if (!pattern || pattern === 'solid') return;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.globalAlpha = pattern === 'neon' ? 0.85 : 0.45;
    ctx.lineWidth = 1.2;

    if (pattern === 'striped' || pattern === 'plaid') {
      for (let py = y + 4; py < y + h; py += 6) {
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x + w, py);
        ctx.stroke();
      }
      if (pattern === 'plaid') {
        for (let px = x + 5; px < x + w; px += 7) {
          ctx.beginPath();
          ctx.moveTo(px, y);
          ctx.lineTo(px, y + h);
          ctx.stroke();
        }
      }
    } else if (pattern === 'sequin' || pattern === 'floral') {
      for (let i = 0; i < 6; i += 1) {
        const sx = x + ((i * 7 + 4) % Math.max(8, w));
        const sy = y + ((i * 9 + 4) % Math.max(8, h));
        ctx.beginPath();
        ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pattern === 'neon') {
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    }

    ctx.restore();
  }
}
