import * as THREE from 'three';
import type {
  AvatarGender,
  ClothingItem,
  EquippedOutfit,
  Garment3DSilhouette,
  Hair3DSilhouette,
} from '../types/game';
import { getAvatarMetrics, type Avatar3DRig } from './avatar3d';
import { createFashionMaterial, disposeObject3D } from './studioEngine';

function createHairMaterial(item: ClothingItem): THREE.MeshPhysicalMaterial {
  const base = item.swatchColor || '#2C221E';
  const hi = item.threeSpec?.highlightColor || item.secondaryColor || base;
  const finish = item.threeSpec?.finish || 'cotton';
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(base),
    roughness: finish === 'crystal' ? 0.22 : finish === 'silk' ? 0.34 : 0.48,
    metalness: finish === 'crystal' ? 0.3 : 0.06,
    sheen: 0.75,
    sheenRoughness: 0.38,
    sheenColor: new THREE.Color(hi),
    clearcoat: finish === 'crystal' ? 0.65 : 0.12,
  });
  if (item.threeSpec?.emissiveIntensity && item.threeSpec.emissiveIntensity > 0) {
    mat.emissive = new THREE.Color(hi);
    mat.emissiveIntensity = item.threeSpec.emissiveIntensity * 0.45;
  }
  return mat;
}

function buildHairGroup(item: ClothingItem, headRadius: number, gender: AvatarGender): THREE.Group {
  const g = new THREE.Group();
  const mat = createHairMaterial(item);
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(item.threeSpec?.highlightColor || item.secondaryColor || item.swatchColor),
    roughness: 0.35,
    metalness: 0.15,
    sheen: 0.9,
  });

  const sil: Hair3DSilhouette =
    item.threeSpec?.hairSilhouette ||
    (gender === 'masculino' ? 'executive_part' : 'waves_long');
  const vol = item.threeSpec?.volumeScale ?? 1.0;
  const len = item.threeSpec?.lengthScale ?? 1.0;

  // Calota capilar anatômica envolvendo crânio (nunca entra no rosto)
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius * 1.08 * vol, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    mat
  );
  cap.position.set(0, 0.015, -0.012);
  cap.rotation.x = -0.22;
  cap.scale.set(0.95, 1.05, 1.02);
  cap.castShadow = true;
  g.add(cap);

  const backDrop = new THREE.Mesh(
    new THREE.CylinderGeometry(headRadius * 1.02, headRadius * 1.06, 0.12, 16, 1, false, Math.PI * 0.45, Math.PI * 1.1),
    mat
  );
  backDrop.position.set(0, -0.045, -0.015);
  g.add(backDrop);

  // Silhuetas femininas
  if (sil === 'waves_long' || sil === 'straight_sleek' || sil === 'curly_voluminous' || sil === 'layered_midi') {
    const dropLen = (sil === 'layered_midi' ? 0.24 : 0.36) * len;
    const waveR = sil === 'curly_voluminous' ? 0.056 : 0.042;
    for (const side of [-1, 1]) {
      const strand = new THREE.Mesh(
        new THREE.CapsuleGeometry(waveR * vol, dropLen, 6, 10),
        mat
      );
      strand.position.set(side * (headRadius * 0.88), -dropLen * 0.48 - 0.02, -0.015);
      strand.rotation.z = side * -0.08;
      strand.castShadow = true;
      g.add(strand);

      const frontLock = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.024 * vol, dropLen * 0.72, 4, 8),
        accentMat
      );
      frontLock.position.set(side * (headRadius * 0.78), -dropLen * 0.32, 0.032);
      frontLock.rotation.z = side * -0.06;
      g.add(frontLock);
    }
    const backCurtain = new THREE.Mesh(
      new THREE.CylinderGeometry(headRadius * 0.96, headRadius * 1.12, dropLen, 16, 1, false, Math.PI * 0.55, Math.PI * 0.9),
      mat
    );
    backCurtain.position.set(0, -dropLen * 0.52 - 0.01, -0.022);
    backCurtain.castShadow = true;
    g.add(backCurtain);
  } else if (sil === 'bob_classic' || sil === 'pixie_chic') {
    const bobLen = sil === 'pixie_chic' ? 0.11 : 0.19 * len;
    for (const side of [-1, 1]) {
      const sideBob = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.036 * vol, bobLen, 5, 10),
        mat
      );
      sideBob.position.set(side * (headRadius * 0.9), -bobLen * 0.42, 0.005);
      sideBob.rotation.z = side * -0.1;
      g.add(sideBob);
    }
    const bangs = new THREE.Mesh(
      new THREE.TorusGeometry(headRadius * 0.85, 0.026, 8, 16, Math.PI * 0.75),
      accentMat
    );
    bangs.rotation.x = Math.PI * 0.45;
    bangs.rotation.z = Math.PI * 0.12;
    bangs.position.set(0, 0.065, 0.042);
    g.add(bangs);
  } else if (sil === 'high_bun' || sil === 'ponytail_high' || sil === 'half_up') {
    const bun = new THREE.Mesh(
      new THREE.SphereGeometry(sil === 'high_bun' ? 0.068 * vol : 0.052 * vol, 16, 14),
      accentMat
    );
    bun.position.set(0, 0.115, -0.055);
    bun.castShadow = true;
    g.add(bun);

    if (sil === 'ponytail_high' || sil === 'half_up') {
      const tailLen = (sil === 'ponytail_high' ? 0.32 : 0.25) * len;
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.036 * vol, tailLen, 6, 10), mat);
      tail.position.set(0, -tailLen * 0.35 + 0.06, -headRadius * 1.15);
      tail.rotation.x = 0.22;
      g.add(tail);
    }
  } else if (sil === 'braids_twin') {
    for (const side of [-1, 1]) {
      for (let seg = 0; seg < 4; seg++) {
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.032 - seg * 0.003, 10, 10), seg % 2 === 0 ? mat : accentMat);
        bead.position.set(side * (headRadius * 0.92), -0.04 - seg * 0.058, 0.015);
        g.add(bead);
      }
    }
  } else {
    // Silhuetas masculinas (executive_part, undercut_fade, quiff_textured, curly_fade, surfer_medium, slick_back, buzz_taper, dreads_short, wolf_cut, pompadour)
    if (sil === 'quiff_textured' || sil === 'pompadour') {
      const quiff = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.052 * vol, 0.095, 6, 12),
        accentMat
      );
      quiff.rotation.x = Math.PI * 0.42;
      quiff.position.set(0, headRadius * 0.98, 0.035);
      quiff.scale.set(1.15, 1, 0.95);
      g.add(quiff);
    } else if (sil === 'curly_fade' || sil === 'dreads_short') {
      for (let k = 0; k < 10; k++) {
        const angle = (k / 10) * Math.PI * 2;
        const r = headRadius * 0.68;
        const tuft = new THREE.Mesh(
          new THREE.SphereGeometry(sil === 'dreads_short' ? 0.028 : 0.035 * vol, 10, 10),
          k % 2 === 0 ? mat : accentMat
        );
        tuft.position.set(Math.cos(angle) * r, headRadius * 0.85, Math.sin(angle) * r * 0.85 - 0.01);
        g.add(tuft);
      }
    } else if (sil === 'surfer_medium' || sil === 'wolf_cut') {
      for (const side of [-1, 1]) {
        const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.14 * len, 5, 8), mat);
        lock.position.set(side * (headRadius * 0.88), -0.02, 0.015);
        lock.rotation.z = side * -0.14;
        g.add(lock);
      }
    } else if (sil !== 'buzz_taper') {
      // executive_part / undercut_fade / slick_back
      const crest = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 1.45, 0.055 * vol, headRadius * 1.5), accentMat);
      crest.position.set(sil === 'executive_part' ? 0.012 : 0, headRadius * 0.88, 0.008);
      crest.rotation.x = -0.15;
      g.add(crest);
    }
  }

  // Aura/cristal para cabelos Lendários
  if (item.isLegendary) {
    const haloMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(item.threeSpec?.highlightColor || '#FBBF24'),
      emissive: new THREE.Color(item.threeSpec?.highlightColor || '#FBBF24'),
      emissiveIntensity: 0.7,
      roughness: 0.15,
      metalness: 0.85,
    });
    const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.024, 0), haloMat);
    pin.position.set(headRadius * 0.72, headRadius * 0.82, 0.055);
    g.add(pin);
  }

  return g;
}

function makeGarmentMat(item: ClothingItem, useSecondary = false): THREE.MeshPhysicalMaterial {
  return createFashionMaterial({
    color: useSecondary ? item.secondaryColor || item.swatchColor : item.swatchColor,
    secondaryColor: item.secondaryColor || item.swatchColor,
    accentColor: item.accentColor || '#D4AF37',
    pattern: item.pattern || 'solid',
    finish: item.threeSpec?.finish || 'cotton',
    emissiveIntensity: item.threeSpec?.emissiveIntensity ?? (item.isLegendary ? 0.35 : 0),
  });
}

function makeTrimMat(item: ClothingItem): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(item.accentColor || '#D4AF37'),
    roughness: 0.22,
    metalness: 0.88,
    clearcoat: 0.45,
    emissive: new THREE.Color(item.accentColor || '#D4AF37'),
    emissiveIntensity: item.isLegendary ? 0.35 : 0.05,
  });
}

/**
 * Remove todas as roupas e cabelos acoplados anteriormente ao esqueleto 3D com descarte de GPU.
 */
export function clearAvatarClothing3D(rig: Avatar3DRig): void {
  for (const part of rig.attachedParts) {
    part.parent?.remove(part);
    disposeObject3D(part);
  }
  rig.attachedParts.length = 0;
}

/**
 * Modela e acopla todas as peças equipadas (cabelo, sapatos, calças/saias, blusas, vestidos e acessórios)
 * diretamente aos ossos e soquetes anatômicos do avatar 3D.
 */
export function attachClothingAndHair3D(
  rig: Avatar3DRig,
  equipped: EquippedOutfit,
  catalog: ClothingItem[]
): void {
  clearAvatarClothing3D(rig);
  const m = rig.metrics;
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const attachTo = (socket: THREE.Object3D, obj: THREE.Object3D) => {
    socket.add(obj);
    rig.attachedParts.push(obj);
  };

  // 1. Cabelo
  const hairItem = equipped.cabelo ? byId.get(equipped.cabelo) : undefined;
  if (hairItem) {
    const hairGrp = buildHairGroup(hairItem, m.headRadius, m.gender);
    attachTo(rig.sockets.head, hairGrp);
  }

  // 2. Sapatos
  const shoeItem = equipped.sapatos ? byId.get(equipped.sapatos) : undefined;
  if (shoeItem) {
    const mat = makeGarmentMat(shoeItem);
    const soleMat = makeGarmentMat(shoeItem, true);
    const trimMat = makeTrimMat(shoeItem);
    const sil: Garment3DSilhouette = shoeItem.threeSpec?.garmentSilhouette || 'shoe_oxford';

    const buildShoeSide = (isLeft: boolean) => {
      const sg = new THREE.Group();
      const vamp = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.052, 0.185), mat);
      vamp.position.set(0, -0.025, 0.044);
      vamp.castShadow = true;
      sg.add(vamp);

      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.016, 0.19), soleMat);
      sole.position.set(0, -0.048, 0.044);
      sg.add(sole);

      if (sil === 'shoe_heels' || sil === 'shoe_sandals') {
        const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.07, 10), trimMat);
        heel.position.set(0, -0.022, -0.036);
        sg.add(heel);
      } else if (sil === 'shoe_boots') {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.048, 0.19, 14), mat);
        shaft.position.set(0, 0.085, -0.002);
        sg.add(shaft);
      }
      if (shoeItem.threeSpec?.metallicTrim) {
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.018), trimMat);
        buckle.position.set(isLeft ? 0 : 0, 0.006, 0.075);
        sg.add(buckle);
      }
      return sg;
    };

    attachTo(rig.sockets.leftFoot, buildShoeSide(true));
    attachTo(rig.sockets.rightFoot, buildShoeSide(false));
  }

  // 3. Calças & Saias (se não houver vestido longo bloqueando completamente, ou por baixo)
  const bottomItem = equipped.calcas ? byId.get(equipped.calcas) : undefined;
  const dressItem = equipped.vestidos ? byId.get(equipped.vestidos) : undefined;

  if (bottomItem && !dressItem) {
    const mat = makeGarmentMat(bottomItem);
    const secMat = makeGarmentMat(bottomItem, true);
    const trimMat = makeTrimMat(bottomItem);
    const sil: Garment3DSilhouette = bottomItem.threeSpec?.garmentSilhouette || 'pants_tailored';
    const isSkirt = sil === 'skirt_mini' || sil === 'skirt_midi' || sil === 'skirt_pleated';

    // Cós na pélvis
    const waistBand = new THREE.Mesh(
      new THREE.CylinderGeometry(m.waistW * 1.07, m.hipW * 1.06, 0.15, 20),
      mat
    );
    waistBand.scale.set(1, 1, 0.71);
    waistBand.position.y = 0.045;
    waistBand.castShadow = true;
    attachTo(rig.sockets.pelvis, waistBand);

    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(m.waistW * 1.09, m.waistW * 1.09, 0.03, 20),
      trimMat
    );
    belt.scale.set(1, 1, 0.72);
    belt.position.y = 0.105;
    attachTo(rig.sockets.pelvis, belt);

    if (isSkirt) {
      const skirtH = sil === 'skirt_mini' ? 0.28 : 0.48;
      const skirtFlare = sil === 'skirt_pleated' ? 1.55 : sil === 'skirt_midi' ? 1.38 : 1.18;
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(m.hipW * 1.02, m.hipW * skirtFlare, skirtH, 22, 1, true),
        mat
      );
      skirt.material.side = THREE.DoubleSide;
      skirt.scale.set(1, 1, 0.74);
      skirt.position.y = -skirtH * 0.42;
      skirt.castShadow = true;
      attachTo(rig.sockets.pelvis, skirt);
    } else {
      const legScale = sil === 'pants_wide' ? 1.38 : sil === 'pants_cargo' ? 1.24 : sil === 'pants_skinny' ? 1.05 : 1.14;
      const baseR = (m.gender === 'masculino' ? 0.075 : 0.077) * legScale;

      const buildLegCloth = (thighSocket: THREE.Object3D, calfSocket: THREE.Object3D) => {
        const upper = new THREE.Mesh(
          new THREE.CylinderGeometry(baseR, baseR * 0.82, m.thighLen * 1.02, 16),
          mat
        );
        upper.position.y = -m.thighLen * 0.5;
        upper.castShadow = true;
        attachTo(thighSocket, upper);

        if (sil === 'pants_cargo') {
          const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.09), secMat);
          pocket.position.set(0.055, -m.thighLen * 0.55, 0);
          attachTo(thighSocket, pocket);
        }

        if (sil !== 'shorts') {
          const lower = new THREE.Mesh(
            new THREE.CylinderGeometry(baseR * 0.8, baseR * (sil === 'pants_wide' ? 0.92 : 0.62), m.calfLen * 0.96, 16),
            mat
          );
          lower.position.y = -m.calfLen * 0.48;
          lower.castShadow = true;
          attachTo(calfSocket, lower);
        }
      };

      buildLegCloth(rig.leftThigh, rig.leftCalf);
      buildLegCloth(rig.rightThigh, rig.rightCalf);
    }
  }

  // 4. Vestidos (ocupam tronco + saia contínua)
  if (dressItem) {
    const mat = makeGarmentMat(dressItem);
    const secMat = makeGarmentMat(dressItem, true);
    const trimMat = makeTrimMat(dressItem);
    const sil: Garment3DSilhouette = dressItem.threeSpec?.garmentSilhouette || 'dress_aline';
    const lenScale = dressItem.threeSpec?.lengthScale ?? 1.0;

    // Corpete no torso
    const bodicePts = [
      new THREE.Vector2(m.waistW * 1.06, -0.02),
      new THREE.Vector2(m.waistW * 0.98, m.torsoH * 0.24),
      new THREE.Vector2(m.chestW * 1.08, m.torsoH * 0.64),
      new THREE.Vector2(m.shoulderHalfW * 0.72, m.torsoH * 0.86),
    ];
    const bodiceGeo = new THREE.LatheGeometry(bodicePts, 24);
    bodiceGeo.scale(1, 1, 0.7);
    const bodice = new THREE.Mesh(bodiceGeo, mat);
    bodice.castShadow = true;
    attachTo(rig.torso, bodice);

    // Cintura dourada/detalhe
    const sash = new THREE.Mesh(
      new THREE.CylinderGeometry(m.waistW * 1.09, m.waistW * 1.09, 0.04, 22),
      trimMat
    );
    sash.scale.set(1, 1, 0.71);
    sash.position.y = 0.02;
    attachTo(rig.torso, sash);

    // Saia do vestido na pélvis
    const isLong = sil === 'dress_mermaid' || sil === 'dress_ballgown';
    const skirtH = (isLong ? 0.82 : sil === 'dress_mini_party' ? 0.34 : 0.56) * lenScale;
    const bottomR =
      sil === 'dress_ballgown'
        ? m.hipW * 2.25
        : sil === 'dress_mermaid'
          ? m.hipW * 1.45
          : sil === 'dress_aline'
            ? m.hipW * 1.65
            : m.hipW * 1.18;

    const dressSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(m.waistW * 1.05, bottomR, skirtH, 26, 1, true),
      mat
    );
    dressSkirt.material.side = THREE.DoubleSide;
    dressSkirt.scale.set(1, 1, 0.76);
    dressSkirt.position.y = -skirtH * 0.5 + 0.1;
    dressSkirt.castShadow = true;
    attachTo(rig.sockets.pelvis, dressSkirt);

    if (sil === 'dress_blazer') {
      const sleeveR = 0.044;
      for (const arm of [rig.leftUpperArm, rig.rightUpperArm]) {
        const sl = new THREE.Mesh(new THREE.CylinderGeometry(sleeveR, sleeveR * 0.85, m.upperArmLen, 12), secMat);
        sl.position.y = -m.upperArmLen * 0.5;
        attachTo(arm, sl);
      }
    }
  }

  // 5. Blusas, Camisas, Blazers & Jaquetas (se não houver vestido, ou blazer sobreposto)
  const topItem = equipped.blusas ? byId.get(equipped.blusas) : undefined;
  if (topItem && !dressItem) {
    const mat = makeGarmentMat(topItem);
    const secMat = makeGarmentMat(topItem, true);
    const trimMat = makeTrimMat(topItem);
    const sil: Garment3DSilhouette = topItem.threeSpec?.garmentSilhouette || 'silk_shirt';
    const vol = topItem.threeSpec?.volumeScale ?? 1.0;

    const isCropped = sil === 'cropped' || sil === 'corset';
    const startY = isCropped ? m.torsoH * 0.28 : -0.04;
    const topPts = [
      new THREE.Vector2(m.waistW * (sil === 'blazer' || sil === 'trench_coat' || sil === 'hoodie' ? 1.15 : 1.06) * vol, startY),
      new THREE.Vector2(m.chestW * 1.1 * vol, m.torsoH * 0.64),
      new THREE.Vector2(m.shoulderHalfW * 0.94 * vol, m.torsoH * 0.9),
      new THREE.Vector2(0.072, m.torsoH * 1.01),
    ];
    const topGeo = new THREE.LatheGeometry(topPts, 24);
    topGeo.scale(1, 1, 0.71);
    const torsoCloth = new THREE.Mesh(topGeo, mat);
    torsoCloth.castShadow = true;
    attachTo(rig.torso, torsoCloth);

    // Gola / Lapela para Blazer, Smoking, Trench Coat ou Camisa
    if (sil === 'blazer' || sil === 'trench_coat' || sil === 'vest_suit' || sil === 'silk_shirt') {
      for (const side of [-1, 1]) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.025), secMat);
        lapel.position.set(side * 0.048, m.torsoH * 0.72, m.chestDepth * 0.72);
        lapel.rotation.z = side * -0.22;
        attachTo(rig.torso, lapel);
      }
      if (topItem.threeSpec?.metallicTrim) {
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 10), trimMat);
        btn.rotation.x = Math.PI / 2;
        btn.position.set(0, m.torsoH * 0.35, m.chestDepth * 0.75);
        attachTo(rig.torso, btn);
      }
    }

    // Mangas acopladas diretamente aos braços articulados
    const hasLongSleeves =
      sil === 'silk_shirt' ||
      sil === 'blazer' ||
      sil === 'leather_jacket' ||
      sil === 'hoodie' ||
      sil === 'turtleneck' ||
      sil === 'trench_coat';
    const hasShortSleeves = sil === 'tshirt' || sil === 'off_shoulder';
    const sleeveR = (m.gender === 'masculino' ? 0.052 : 0.042) * vol;

    if (hasLongSleeves || hasShortSleeves) {
      for (const [upper, fore] of [
        [rig.leftUpperArm, rig.leftForearm],
        [rig.rightUpperArm, rig.rightForearm],
      ] as const) {
        const upLen = hasShortSleeves ? m.upperArmLen * 0.55 : m.upperArmLen * 1.02;
        const upMesh = new THREE.Mesh(new THREE.CylinderGeometry(sleeveR, sleeveR * 0.86, upLen, 14), mat);
        upMesh.position.y = -upLen * 0.5;
        upMesh.castShadow = true;
        attachTo(upper, upMesh);

        if (hasLongSleeves) {
          const foreMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(sleeveR * 0.85, sleeveR * 0.7, m.forearmLen * 0.92, 14),
            mat
          );
          foreMesh.position.y = -m.forearmLen * 0.45;
          foreMesh.castShadow = true;
          attachTo(fore, foreMesh);
        }
      }
    }
  }

  // 6. Acessórios
  const accItem = equipped.acessorios ? byId.get(equipped.acessorios) : undefined;
  if (accItem) {
    const mat = makeGarmentMat(accItem);
    const trimMat = makeTrimMat(accItem);
    const sil: Garment3DSilhouette = accItem.threeSpec?.garmentSilhouette || 'acc_crown';

    if (sil === 'acc_crown') {
      const crown = new THREE.Group();
      const band = new THREE.Mesh(new THREE.TorusGeometry(m.headRadius * 0.88, 0.012, 8, 22), trimMat);
      band.rotation.x = Math.PI / 2;
      crown.add(band);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const gem = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.042, 4), i % 2 === 0 ? mat : trimMat);
        gem.position.set(Math.cos(a) * m.headRadius * 0.85, 0.025, Math.sin(a) * m.headRadius * 0.85);
        crown.add(gem);
      }
      crown.position.set(0, m.headRadius * 1.02, 0);
      attachTo(rig.sockets.head, crown);
    } else if (sil === 'acc_hat') {
      const hat = new THREE.Group();
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(m.headRadius * 1.45, m.headRadius * 1.45, 0.012, 22), mat);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(m.headRadius * 0.92, m.headRadius * 1.02, 0.075, 20), mat);
      top.position.y = 0.04;
      hat.add(brim, top);
      hat.position.set(0, m.headRadius * 0.95, 0);
      hat.rotation.x = -0.12;
      attachTo(rig.sockets.head, hat);
    } else if (sil === 'acc_sunglasses') {
      const glasses = new THREE.Group();
      const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x111118, roughness: 0.1, metalness: 0.5, clearcoat: 1 });
      for (const side of [-1, 1]) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.024, 0.008), trimMat);
        frame.position.set(side * 0.036, 0, 0.008);
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.018, 0.009), lensMat);
        lens.position.set(side * 0.036, 0, 0.009);
        glasses.add(frame, lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.005, 0.006), trimMat);
      bridge.position.set(0, 0.005, 0.008);
      glasses.add(bridge);
      attachTo(rig.sockets.eyes, glasses);
    } else if (sil === 'acc_necklace') {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.008, 8, 22), trimMat);
      collar.rotation.x = Math.PI * 0.55;
      collar.position.set(0, -0.01, 0.008);
      const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.018, 0), mat);
      pendant.position.set(0, -0.035, 0.064);
      const grp = new THREE.Group();
      grp.add(collar, pendant);
      attachTo(rig.sockets.neck, grp);
    } else if (sil === 'acc_bag') {
      const bag = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.055), mat);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.007, 8, 16, Math.PI), trimMat);
      handle.position.y = 0.065;
      bag.add(body, handle);
      bag.position.set(0.02, -0.07, 0);
      bag.rotation.y = Math.PI / 2;
      attachTo(rig.sockets.handR, bag);
    } else if (sil === 'acc_scepter') {
      const scepter = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.65, 10), trimMat);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), mat);
      orb.position.y = 0.34;
      scepter.add(rod, orb);
      scepter.rotation.x = 0.25;
      attachTo(rig.sockets.handR, scepter);
    } else {
      // acc_watch / acc_earrings
      const watch = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.009, 8, 16), trimMat);
      watch.rotation.x = Math.PI / 2;
      attachTo(rig.sockets.wristL, watch);
    }
  }
}

/**
 * Constrói miniatura isolada 3D de alta qualidade para cards da Starplaza & Guarda-Roupa.
 */
export function buildStandaloneItem3D(item: ClothingItem, genderHint: AvatarGender = 'feminino'): THREE.Group {
  const grp = new THREE.Group();
  const gender: AvatarGender = item.gender === 'unissex' ? genderHint : item.gender;
  const m = getAvatarMetrics(gender);

  if (item.category === 'cabelo') {
    const bustMat = new THREE.MeshStandardMaterial({ color: 0xe8d9ce, roughness: 0.72 });
    const headBase = new THREE.Mesh(new THREE.SphereGeometry(m.headRadius * 0.96, 18, 16), bustMat);
    headBase.scale.set(0.92, 1.1, 0.98);
    grp.add(headBase);
    const hair = buildHairGroup(item, m.headRadius, gender);
    grp.add(hair);
    return grp;
  }

  const mat = makeGarmentMat(item);
  const secMat = makeGarmentMat(item, true);
  const trimMat = makeTrimMat(item);
  const sil = item.threeSpec?.garmentSilhouette || 'silk_shirt';

  if (item.category === 'sapatos') {
    for (const side of [-1, 1]) {
      const shoe = new THREE.Group();
      const vamp = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.22), mat);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.225), secMat);
      sole.position.y = -0.034;
      shoe.add(vamp, sole);
      if (sil === 'shoe_heels' || sil === 'shoe_sandals') {
        const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.008, 0.08, 10), trimMat);
        heel.position.set(0, -0.04, -0.08);
        shoe.add(heel);
      } else if (sil === 'shoe_boots') {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.048, 0.2, 14), mat);
        shaft.position.set(0, 0.09, -0.04);
        shoe.add(shaft);
      }
      shoe.position.set(side * 0.072, 0.04, 0);
      shoe.rotation.y = side * -0.15;
      grp.add(shoe);
    }
    return grp;
  }

  if (item.category === 'acessorios') {
    if (sil === 'acc_bag') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.11), mat);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.265, 0.09, 0.116), secMat);
      flap.position.y = 0.055;
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), trimMat);
      clasp.position.set(0, 0.01, 0.06);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 18, Math.PI), trimMat);
      handle.position.y = 0.105;
      grp.add(body, flap, clasp, handle);
    } else if (sil === 'acc_crown') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 10, 24), trimMat);
      band.rotation.x = Math.PI / 2;
      grp.add(band);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const gem = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.065, 4), i % 2 === 0 ? mat : trimMat);
        gem.position.set(Math.cos(a) * 0.115, 0.04, Math.sin(a) * 0.115);
        grp.add(gem);
      }
    } else if (sil === 'acc_scepter') {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.48, 12), trimMat);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), mat);
      orb.position.y = 0.26;
      grp.add(rod, orb);
      grp.rotation.z = -0.35;
    } else if (sil === 'acc_hat') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.018, 24), mat);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.09, 24), mat);
      top.position.y = 0.05;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.132, 0.02, 24), trimMat);
      band.position.y = 0.018;
      grp.add(brim, top, band);
    } else {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 10, 24), trimMat);
      const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), mat);
      jewel.position.set(0, -0.11, 0.02);
      grp.add(ring, jewel);
    }
    return grp;
  }

  if (item.category === 'calcas') {
    const isSkirt = sil === 'skirt_mini' || sil === 'skirt_midi' || sil === 'skirt_pleated';
    if (isSkirt) {
      const h = sil === 'skirt_mini' ? 0.3 : 0.44;
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, sil === 'skirt_pleated' ? 0.24 : 0.21, h, 24, 1, true),
        mat
      );
      skirt.material.side = THREE.DoubleSide;
      skirt.scale.set(1, 1, 0.74);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.045, 24), trimMat);
      band.scale.set(1, 1, 0.74);
      band.position.y = h * 0.5;
      grp.add(skirt, band);
    } else {
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.08, 20), trimMat);
      belt.scale.set(1, 1, 0.72);
      belt.position.y = 0.22;
      grp.add(belt);
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.072, sil === 'pants_wide' ? 0.082 : 0.054, sil === 'shorts' ? 0.24 : 0.48, 14),
          mat
        );
        leg.position.set(side * 0.078, sil === 'shorts' ? 0.08 : -0.02, 0);
        grp.add(leg);
      }
    }
    return grp;
  }

  // Blusas & Vestidos em forma escultural de busto couture
  const isDress = item.category === 'vestidos';
  const pts = isDress
    ? [
        new THREE.Vector2(0.24, -0.34),
        new THREE.Vector2(0.11, -0.02),
        new THREE.Vector2(0.15, 0.18),
        new THREE.Vector2(0.16, 0.32),
        new THREE.Vector2(0.07, 0.37),
      ]
    : [
        new THREE.Vector2(0.125, -0.05),
        new THREE.Vector2(0.115, 0.05),
        new THREE.Vector2(0.155, 0.24),
        new THREE.Vector2(0.18, 0.34),
        new THREE.Vector2(0.072, 0.39),
      ];
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.scale(1, 1, 0.7);
  const body = new THREE.Mesh(geo, mat);
  grp.add(body);

  if (!isDress || sil === 'dress_blazer') {
    for (const side of [-1, 1]) {
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.034, 0.28, 12), mat);
      sl.position.set(side * 0.19, 0.18, 0);
      sl.rotation.z = side * -0.18;
      grp.add(sl);
    }
  }
  if (item.threeSpec?.metallicTrim) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 8, 20), trimMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.37;
    grp.add(collar);
  }
  return grp;
}
