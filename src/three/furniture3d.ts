import * as THREE from 'three';
import type { FurnitureDef } from '../types/game';
import { createFashionMaterial, getWoodTexture } from './studioEngine';

/**
 * Constrói modelo 3D composto para móveis da Suíte e Starplaza, aterrado exatamente em min.y = 0.
 */
export function buildFurniture3D(def: FurnitureDef): THREE.Group {
  const grp = new THREE.Group();
  grp.name = `Furn3D_${def.id}`;

  const primary = def.swatchColor || '#8C5230';
  const secondary = def.secondaryColor || '#5C331A';
  const accent = def.accentColor || '#D4AF37';

  const upholsteryMat = createFashionMaterial({
    color: primary,
    secondaryColor: secondary,
    accentColor: accent,
    pattern: def.pattern || 'solid',
    finish: def.isLegendary ? 'crystal' : def.isVipOnly ? 'velvet' : 'cotton',
    emissiveIntensity: def.isLegendary ? 0.25 : 0,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: getWoodTexture(secondary, '#2C1B12'),
    roughness: 0.45,
    metalness: 0.08,
  });

  const metalMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accent),
    roughness: 0.2,
    metalness: 0.9,
    clearcoat: 0.4,
  });

  const w = Math.max(0.6, Math.min(2.6, def.width / 110));
  const tpl = def.templateId || (def.category === 'Assentos' ? 'tpl_sofa' : def.category === 'Superfícies' ? 'tpl_mesa' : 'tpl_decoracao');

  if (tpl === 'tpl_sofa') {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.24, 0.72), upholsteryMat);
    seat.position.y = 0.24;
    seat.castShadow = true;
    seat.receiveShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, 0.44, 0.16), upholsteryMat);
    back.position.set(0, 0.52, -0.28);
    back.castShadow = true;
    grp.add(seat, back);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.72), upholsteryMat);
      arm.position.set(side * (w * 0.5 - 0.07), 0.36, 0);
      arm.castShadow = true;
      grp.add(arm);

      for (const fz of [-0.26, 0.26]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.022, 0.12, 10), metalMat);
        leg.position.set(side * (w * 0.44), 0.06, fz);
        grp.add(leg);
      }
    }
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.1), metalMat);
    pillow.position.set(-w * 0.24, 0.44, -0.13);
    pillow.rotation.z = 0.15;
    grp.add(pillow);
  } else if (tpl === 'tpl_cama') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 1.45), woodMat);
    frame.position.y = 0.18;
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.18, 1.36), upholsteryMat);
    mattress.position.y = 0.38;
    const head = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.72, 0.1), upholsteryMat);
    head.position.set(0, 0.56, -0.7);
    const pillowL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.26), metalMat);
    pillowL.position.set(-0.24, 0.5, -0.48);
    const pillowR = pillowL.clone();
    pillowR.position.x = 0.24;
    grp.add(frame, mattress, head, pillowL, pillowR);
  } else if (tpl === 'tpl_mesa' || tpl === 'tpl_bar' || tpl === 'tpl_cozinha') {
    const topH = tpl === 'tpl_bar' ? 0.96 : 0.74;
    const top = new THREE.Mesh(
      tpl === 'tpl_mesa'
        ? new THREE.CylinderGeometry(w * 0.52, w * 0.5, 0.06, 24)
        : new THREE.BoxGeometry(w, 0.08, 0.65),
      tpl === 'tpl_bar' ? upholsteryMat : woodMat
    );
    top.position.y = topH;
    top.castShadow = true;
    top.receiveShadow = true;
    grp.add(top);

    const trim = new THREE.Mesh(
      tpl === 'tpl_mesa'
        ? new THREE.TorusGeometry(w * 0.51, 0.015, 8, 24)
        : new THREE.BoxGeometry(w * 1.02, 0.025, 0.67),
      metalMat
    );
    if (tpl === 'tpl_mesa') trim.rotation.x = Math.PI / 2;
    trim.position.y = topH;
    grp.add(trim);

    if (tpl === 'tpl_mesa') {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, topH, 14), metalMat);
      col.position.y = topH * 0.5;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.04, 18), metalMat);
      base.position.y = 0.02;
      grp.add(col, base);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, topH - 0.04, 0.56), woodMat);
      body.position.y = (topH - 0.04) * 0.5;
      body.castShadow = true;
      grp.add(body);
    }
  } else if (tpl === 'tpl_banqueta') {
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 18), upholsteryMat);
    cushion.position.y = 0.72;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.68, 12), metalMat);
    stem.position.y = 0.34;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.035, 18), metalMat);
    base.position.y = 0.018;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 8, 18), metalMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.26;
    grp.add(cushion, stem, base, ring);
  } else if (tpl === 'tpl_dj') {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.92, 0.62), upholsteryMat);
    desk.position.y = 0.46;
    desk.castShadow = true;
    const neonTrim = new THREE.Mesh(
      new THREE.BoxGeometry(1.58, 0.06, 0.64),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(accent),
        emissive: new THREE.Color(accent),
        emissiveIntensity: 0.85,
      })
    );
    neonTrim.position.y = 0.92;
    grp.add(desk, neonTrim);
    for (const side of [-0.42, 0.42]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 20), metalMat);
      disc.position.set(side, 0.97, 0);
      grp.add(disc);
    }
  } else if (tpl === 'tpl_pista') {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, w * 0.8), upholsteryMat);
    tile.position.y = 0.025;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, 0.04, w * 0.83), metalMat);
    frame.position.y = 0.02;
    grp.add(frame, tile);
  } else if (tpl === 'tpl_banheira') {
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 0.48, 20), upholsteryMat);
    tub.scale.set(1.4, 1, 0.85);
    tub.position.y = 0.26;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 10, 24), metalMat);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1.4, 0.85, 1);
    rim.position.y = 0.5;
    grp.add(tub, rim);
  } else if (tpl === 'tpl_lustre') {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 10), metalMat);
    stand.position.y = 0.68;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.04, 16), metalMat);
    base.position.y = 0.02;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 14),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(accent),
        emissive: new THREE.Color(accent),
        emissiveIntensity: 0.65,
        roughness: 0.15,
      })
    );
    globe.position.y = 1.38;
    grp.add(stand, base, globe);
  } else {
    // tpl_decoracao (tapetes, espelhos, aparadores, esculturas)
    const isRug = def.name.toLowerCase().includes('tapete');
    if (isRug) {
      const rug = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, w * 0.56), upholsteryMat);
      rug.position.y = 0.011;
      rug.receiveShadow = true;
      grp.add(rug);
    } else {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.72, 16), woodMat);
      ped.position.y = 0.36;
      const sculpture = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 1), metalMat);
      sculpture.position.y = 0.92;
      grp.add(ped, sculpture);
    }
  }

  // Garante aterramento rigoroso em min.y = 0
  const box = new THREE.Box3().setFromObject(grp);
  if (Number.isFinite(box.min.y)) {
    grp.position.y -= box.min.y;
  }

  return grp;
}
