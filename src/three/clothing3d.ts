import * as THREE from 'three';
import type {
  AvatarGender,
  ClothingCategory,
  ClothingItem,
  EquippedOutfit,
  Garment3DSilhouette,
  Hair3DSilhouette,
} from '../types/game';
import {
  createSculptedHeadGeometry,
  getAvatarMetrics,
  sampleHeadSurfacePoint,
  type Avatar3DRig,
  type AvatarRigMetrics,
} from './avatar3d';
import type { LoadedAvatarGLTFResult } from './gltfAvatarLoader';
import { createFashionMaterial, disposeObject3D, getGraphicTeeTexture } from './studioEngine';
import { getEquippedAccessoriesList } from '../utils/storage';

function createHairMaterial(item: ClothingItem): THREE.MeshPhysicalMaterial {
  const base = item.swatchColor || '#2C221E';
  const hi = item.threeSpec?.highlightColor || item.secondaryColor || base;
  const finish = item.threeSpec?.finish || 'cotton';
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(base),
    roughness: finish === 'crystal' ? 0.2 : finish === 'silk' ? 0.3 : 0.42,
    metalness: finish === 'crystal' ? 0.28 : 0.05,
    sheen: 0.8,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color(hi),
    clearcoat: finish === 'crystal' ? 0.65 : 0.18,
  });
  if (item.threeSpec?.emissiveIntensity && item.threeSpec.emissiveIntensity > 0) {
    mat.emissive = new THREE.Color(hi);
    mat.emissiveIntensity = item.threeSpec.emissiveIntensity * 0.45;
  }
  return mat;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Gera uma calota capilar anatômica moldada exatamente sobre a superfície do crânio 3D
 * (com borda arredondada embutida na linha do cabelo para zero frestas e normais para fora).
 */
function createConformalHairCapGeometry(opts: {
  headRadius: number;
  headHalfH: number;
  gender: AvatarGender;
  hairlineNy: (phi: number) => number;
  thicknessAt: (ny: number, phi: number) => number;
  segPhi?: number;
  segV?: number;
}): THREE.BufferGeometry {
  const segPhi = opts.segPhi ?? 56;
  const segV = opts.segV ?? 22;
  const totalRows = segV + 2; // segV anéis da superfície + 1 anel interno na borda (bevel)
  const stride = segPhi + 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();

  for (let i = 0; i < totalRows; i++) {
    const isBevel = i === totalRows - 1;
    const t = isBevel ? 1 : i / segV;
    const vFactor = Math.pow(t, 0.92);

    for (let j = 0; j <= segPhi; j++) {
      const u = j / segPhi;
      const phi = -Math.PI + u * Math.PI * 2;
      const endNy = opts.hairlineNy(phi);
      const ny = THREE.MathUtils.lerp(1.0, endNy, vFactor);
      const offset = isBevel ? -0.0042 : opts.thicknessAt(ny, phi);

      sampleHeadSurfacePoint(ny, phi, opts.headRadius, opts.headHalfH, opts.gender, offset, p);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, 1 - t);
    }
  }

  for (let i = 0; i < totalRows - 1; i++) {
    for (let j = 0; j < segPhi; j++) {
      const v00 = i * stride + j;
      const v01 = v00 + 1;
      const v10 = (i + 1) * stride + j;
      const v11 = v10 + 1;
      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Gera uma mecha esculpida afunilada ao longo de uma curva 3D, alinhada à curvatura do crânio.
 */
function createTaperedStrandGeometry(
  points: THREE.Vector3[],
  radiusStart: number,
  radiusMid: number,
  radiusEnd: number,
  segments = 18,
  radialSegs = 8,
  widthAspect = 1.25,
  heightAspect = 0.72
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const stride = radialSegs + 1;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();

    // Vetor normal aproximado saindo do centro da cabeça para evitar torção
    const outward = new THREE.Vector3(pt.x, pt.y * 0.45, pt.z);
    if (outward.lengthSq() < 1e-6) outward.set(0, 1, 0);
    outward.normalize();

    const binormal = new THREE.Vector3().crossVectors(outward, tangent);
    if (binormal.lengthSq() < 1e-5) {
      binormal.set(1, 0, 0).cross(tangent);
    }
    binormal.normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, binormal).normalize();

    const baseR =
      t < 0.45
        ? THREE.MathUtils.lerp(radiusStart, radiusMid, smoothstep(0, 0.45, t))
        : THREE.MathUtils.lerp(radiusMid, radiusEnd, smoothstep(0.45, 1, t));

    for (let k = 0; k <= radialSegs; k++) {
      const u = k / radialSegs;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const vx = pt.x + binormal.x * cosT * baseR * widthAspect + normal.x * sinT * baseR * heightAspect;
      const vy = pt.y + binormal.y * cosT * baseR * widthAspect + normal.y * sinT * baseR * heightAspect;
      const vz = pt.z + binormal.z * cosT * baseR * widthAspect + normal.z * sinT * baseR * heightAspect;
      positions.push(vx, vy, vz);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let k = 0; k < radialSegs; k++) {
      const v00 = i * stride + k;
      const v01 = v00 + 1;
      const v10 = (i + 1) * stride + k;
      const v11 = v10 + 1;
      indices.push(v00, v01, v11);
      indices.push(v00, v11, v10);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Linha natural do cabelo masculina: limpa acima das sobrancelhas, contorno de orelha e nuca */
function maleHairlineNy(phi: number): number {
  const absP = Math.abs(phi);
  // Testa levemente assimétrica com entrada suave (phi ≈ -0.18π) deixando sobrancelhas (0.31) livres
  const sweepBias = Math.sin(phi * 1.4 - 0.35) * 0.045;
  const forehead = 0.48 + sweepBias;
  // Costeleta na frente da orelha (|phi| ~ 0.39π)
  const sideburnDip = -0.44 * Math.exp(-Math.pow((absP - Math.PI * 0.38) / (Math.PI * 0.08), 2));
  // Arco limpo ACIMA da orelha (|phi| ~ 0.52π) para nunca engolir a orelha
  const earArch = 0.22 * Math.exp(-Math.pow((absP - Math.PI * 0.52) / (Math.PI * 0.085), 2));
  // Queda natural na nuca atrás da orelha
  const backDrop = -1.02 * smoothstep(Math.PI * 0.56, Math.PI * 0.86, absP);
  return Math.max(-0.56, Math.min(0.68, forehead + sideburnDip + earArch + backDrop));
}

/** Linha natural do cabelo feminina/neutra: dividida ao meio ou em moldura limpa das têmporas */
function femaleHairlineNy(phi: number, centerPeak = 0.54): number {
  const absP = Math.abs(phi);
  // Bico central discreto na risca e curva suave até as têmporas
  const forehead =
    centerPeak - 0.18 * smoothstep(0.05, Math.PI * 0.34, absP);
  // Contorno elegante na frente/cima da orelha
  const templeDip = -0.26 * Math.exp(-Math.pow((absP - Math.PI * 0.39) / (Math.PI * 0.08), 2));
  const earClear = 0.16 * Math.exp(-Math.pow((absP - Math.PI * 0.52) / (Math.PI * 0.085), 2));
  // Descida na nuca atrás das orelhas
  const backDrop = -0.96 * smoothstep(Math.PI * 0.55, Math.PI * 0.86, absP);
  return Math.max(-0.62, Math.min(0.66, forehead + templeDip + earClear + backDrop));
}

function buildHairGroup(
  item: ClothingItem,
  headRadius: number,
  headHalfH: number,
  gender: AvatarGender
): THREE.Group {
  const g = new THREE.Group();
  const mat = createHairMaterial(item);
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(item.threeSpec?.highlightColor || item.secondaryColor || item.swatchColor),
    roughness: 0.34,
    metalness: 0.08,
    sheen: 0.85,
  });

  const sil: Hair3DSilhouette =
    item.threeSpec?.hairSilhouette ||
    (gender === 'masculino' ? 'base_swept' : 'base_chignon');
  const vol = item.threeSpec?.volumeScale ?? 1.0;
  const len = item.threeSpec?.lengthScale ?? 1.0;

  const surf = (ny: number, phi: number, offset: number) =>
    sampleHeadSurfacePoint(ny, phi, headRadius, headHalfH, gender, offset);

  // 1. Cabelo base masculino coerente com a cabeça (varrido assimétrico, contorno de orelha e nuca)
  if (sil === 'base_swept') {
    const capGeo = createConformalHairCapGeometry({
      headRadius,
      headHalfH,
      gender,
      hairlineNy: maleHairlineNy,
      thicknessAt: (ny, phi) => {
        const crown = 0.011 * vol;
        const topBoost = 0.012 * vol * smoothstep(0.24, 0.82, ny);
        const frontWave = 0.004 * vol * smoothstep(0.35, 0.85, ny) * smoothstep(Math.PI * 0.55, 0.1, Math.abs(phi));
        const strandRip = 0.0018 * Math.sin(phi * 5 + ny * 3);
        return crown + topBoost + frontWave + strandRip;
      },
    });
    const capMesh = new THREE.Mesh(capGeo, mat);
    capMesh.castShadow = true;
    capMesh.receiveShadow = true;
    g.add(capMesh);

    // Mechas varrendo suavemente a testa sem cobrir as sobrancelhas (todas ancoradas na superfície)
    const lockSpecs = [
      { phi0: -0.20 * Math.PI, ny0: 0.72, phi1: 0.04 * Math.PI, ny1: 0.45, r0: 0.014, r1: 0.003, hi: false },
      { phi0: -0.06 * Math.PI, ny0: 0.78, phi1: 0.22 * Math.PI, ny1: 0.46, r0: 0.015, r1: 0.003, hi: true },
      { phi0: 0.08 * Math.PI, ny0: 0.72, phi1: 0.34 * Math.PI, ny1: 0.42, r0: 0.013, r1: 0.0025, hi: false },
      { phi0: -0.26 * Math.PI, ny0: 0.58, phi1: -0.37 * Math.PI, ny1: 0.24, r0: 0.011, r1: 0.002, hi: false },
    ];
    for (const ls of lockSpecs) {
      const midPhi = THREE.MathUtils.lerp(ls.phi0, ls.phi1, 0.52);
      const midNy = THREE.MathUtils.lerp(ls.ny0, ls.ny1, 0.48) + 0.03;
      const strandGeo = createTaperedStrandGeometry(
        [
          surf(ls.ny0, ls.phi0, 0.014 * vol),
          surf(midNy, midPhi, 0.022 * vol),
          surf(ls.ny1, ls.phi1, 0.011 * vol),
        ],
        ls.r0 * vol,
        ls.r0 * 0.82 * vol,
        ls.r1,
        14,
        8,
        1.45,
        0.58
      );
      const lock = new THREE.Mesh(strandGeo, ls.hi ? accentMat : mat);
      lock.castShadow = true;
      g.add(lock);
    }

    // Onda suave de brilho no topo do penteado
    const waveHighlightGeo = createTaperedStrandGeometry(
      [
        surf(0.84, -0.18 * Math.PI, 0.024 * vol),
        surf(0.90, 0.03 * Math.PI, 0.026 * vol),
        surf(0.82, 0.24 * Math.PI, 0.022 * vol),
      ],
      0.005,
      0.0085,
      0.004,
      14,
      6,
      1.3,
      0.45
    );
    g.add(new THREE.Mesh(waveHighlightGeo, accentMat));

    return g;
  }

  // 2. Cabelo base feminino/neutro coerente com a cabeça (dividido ao meio em ondas + coque baixo)
  if (sil === 'base_chignon') {
    const capGeo = createConformalHairCapGeometry({
      headRadius,
      headHalfH,
      gender,
      hairlineNy: (phi) => femaleHairlineNy(phi, 0.54),
      thicknessAt: (ny, phi) => {
        const absP = Math.abs(phi);
        const base = 0.011 * vol;
        // Sulco discreto na risca central + volume suave nas têmporas
        const partDip = -0.0035 * Math.exp(-Math.pow(absP / 0.14, 2)) * smoothstep(0.45, 0.85, ny);
        const sideSwell = 0.0065 * vol * smoothstep(0.08, 0.45, absP) * smoothstep(0.85, 0.18, absP);
        return base + partDip + sideSwell;
      },
    });
    const capMesh = new THREE.Mesh(capGeo, mat);
    capMesh.castShadow = true;
    capMesh.receiveShadow = true;
    g.add(capMesh);

    // Ondas emoldurando as têmporas com fluidez sobre o crânio (atrás das orelhas até a nuca)
    for (const side of [-1, 1]) {
      const waveGeo = createTaperedStrandGeometry(
        [
          surf(0.86, side * 0.05 * Math.PI, 0.012 * vol),
          surf(0.54, side * 0.26 * Math.PI, 0.016 * vol),
          surf(0.14, side * 0.40 * Math.PI, 0.014 * vol),
          surf(-0.34, side * 0.68 * Math.PI, 0.011 * vol),
        ],
        0.010 * vol,
        0.015 * vol,
        0.007 * vol,
        20,
        8,
        1.42,
        0.60
      );
      const sideWave = new THREE.Mesh(waveGeo, mat);
      sideWave.castShadow = true;
      g.add(sideWave);

      // Mecha de reflexo sutil acompanhando a curva da onda
      const glossGeo = createTaperedStrandGeometry(
        [
          surf(0.82, side * 0.08 * Math.PI, 0.018 * vol),
          surf(0.64, side * 0.22 * Math.PI, 0.021 * vol),
          surf(0.38, side * 0.34 * Math.PI, 0.018 * vol),
        ],
        0.004,
        0.0065,
        0.003,
        12,
        6,
        1.25,
        0.42
      );
      g.add(new THREE.Mesh(glossGeo, accentMat));
    }

    // Risca central discreta exatamente sobre o couro cabeludo
    const partGeo = createTaperedStrandGeometry(
      [
        surf(0.55, 0, 0.010 * vol),
        surf(0.74, 0, 0.010 * vol),
        surf(0.92, 0, 0.011 * vol),
      ],
      0.0022,
      0.0024,
      0.0018,
      10,
      6,
      0.9,
      0.5
    );
    g.add(new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: 0x1e130f })));

    // Coque baixo traseiro acoplado diretamente na nuca (sem espaço flutuante nem colisão com o pescoço)
    const bunMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#2A1B15'),
      roughness: 0.45,
      sheen: 0.65,
      sheenColor: new THREE.Color(item.threeSpec?.highlightColor || '#614436'),
    });
    const napeAnchor = surf(-0.46, Math.PI, 0.011 * vol);
    const bunR = headRadius * 0.44 * vol;
    const lowBun = new THREE.Mesh(new THREE.SphereGeometry(bunR, 18, 14), bunMat);
    lowBun.position.set(0, napeAnchor.y + 0.004, napeAnchor.z - bunR * 0.44);
    lowBun.scale.set(1.12, 0.94, 0.80);
    lowBun.castShadow = true;
    g.add(lowBun);

    // Prendedor discreto na base do coque
    const bunTie = new THREE.Mesh(new THREE.TorusGeometry(bunR * 0.64, 0.0045, 8, 18), accentMat);
    bunTie.position.set(0, napeAnchor.y + 0.004, napeAnchor.z - bunR * 0.14);
    g.add(bunTie);

    return g;
  }

  // 3. Base anatômica comum para todos os estilos de catálogo (feminino / masculino)
  const isMaleStyle =
    sil === 'quiff_textured' ||
    sil === 'pompadour' ||
    sil === 'executive_part' ||
    sil === 'undercut_fade' ||
    sil === 'curly_fade' ||
    sil === 'dreads_short' ||
    sil === 'buzz_taper' ||
    sil === 'slick_back';

  const capGeo = createConformalHairCapGeometry({
    headRadius,
    headHalfH,
    gender,
    hairlineNy: isMaleStyle ? maleHairlineNy : (phi) => femaleHairlineNy(phi, 0.52),
    thicknessAt: (ny, phi) => {
      if (sil === 'buzz_taper') {
        return 0.0045 + 0.0055 * smoothstep(0.15, 0.78, ny);
      }
      const base = 0.011 * vol;
      const topHeight =
        sil === 'pompadour' || sil === 'quiff_textured' || sil === 'slick_back'
          ? 0.022 * vol * smoothstep(0.28, 0.88, ny)
          : 0.010 * vol * smoothstep(0.32, 0.85, ny);
      const sideVol = isMaleStyle
        ? 0.003 * smoothstep(0.30, 0.70, ny)
        : 0.007 * vol * smoothstep(0.10, 0.52, Math.abs(phi));
      return base + topHeight + sideVol;
    },
  });
  const capMesh = new THREE.Mesh(capGeo, mat);
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;
  g.add(capMesh);

  // Franja emoldurada sobre a testa (limpa acima dos olhos e ancorada no crânio)
  if (!isMaleStyle && sil !== 'ponytail_high' && sil !== 'high_bun') {
    for (const side of [-1, 1]) {
      const bangGeo = createTaperedStrandGeometry(
        [
          surf(0.84, side * 0.06 * Math.PI, 0.014 * vol),
          surf(0.56, side * 0.24 * Math.PI, 0.019 * vol),
          surf(0.18, side * 0.39 * Math.PI, 0.015 * vol),
        ],
        0.009 * vol,
        0.014 * vol,
        0.005 * vol,
        14,
        8,
        1.35,
        0.58
      );
      const bang = new THREE.Mesh(bangGeo, side === 1 ? accentMat : mat);
      bang.castShadow = true;
      g.add(bang);
    }
  }

  // Silhuetas de catálogo específicas usando coordenadas coerentes com o crânio
  if (
    sil === 'waves_long' ||
    sil === 'straight_sleek' ||
    sil === 'curly_voluminous' ||
    sil === 'layered_midi'
  ) {
    const dropLen = (sil === 'layered_midi' ? 0.21 : 0.31) * len;
    const waveR = sil === 'curly_voluminous' ? 0.032 : 0.024;
    const sway = sil === 'waves_long' || sil === 'curly_voluminous' ? 0.022 : 0.006;

    // Mechas laterais atrás das orelhas caindo sobre a clavícula/ombros
    for (const side of [-1, 1]) {
      const topA = surf(0.16, side * 0.44 * Math.PI, 0.016 * vol);
      const earBack = surf(-0.28, side * 0.62 * Math.PI, 0.018 * vol);
      const midDrop = new THREE.Vector3(
        earBack.x + side * (0.012 + sway),
        earBack.y - dropLen * 0.48,
        earBack.z - 0.022
      );
      const endDrop = new THREE.Vector3(
        earBack.x + side * (0.006 - sway * 0.4),
        earBack.y - dropLen,
        earBack.z - 0.018
      );
      const strand = new THREE.Mesh(
        createTaperedStrandGeometry([topA, earBack, midDrop, endDrop], waveR * 0.85 * vol, waveR * vol, 0.008, 18, 8, 1.35, 0.78),
        mat
      );
      strand.castShadow = true;
      g.add(strand);

      const frontLock = new THREE.Mesh(
        createTaperedStrandGeometry(
          [
            surf(0.32, side * 0.39 * Math.PI, 0.015 * vol),
            surf(-0.18, side * 0.44 * Math.PI, 0.017 * vol),
            new THREE.Vector3(side * headRadius * 0.94, -dropLen * 0.62, 0.015),
          ],
          0.014 * vol,
          0.016 * vol,
          0.005,
          14,
          7,
          1.2,
          0.7
        ),
        accentMat
      );
      g.add(frontLock);
    }

    // Cortina traseira contínua nascendo exatamente da nuca
    const backArcAngles = [0.66 * Math.PI, 0.84 * Math.PI, Math.PI, -0.84 * Math.PI, -0.66 * Math.PI];
    for (let b = 0; b < backArcAngles.length; b++) {
      const pAngle = backArcAngles[b];
      const topBack = surf(-0.34, pAngle, 0.016 * vol);
      const midBack = new THREE.Vector3(
        topBack.x * 1.08,
        topBack.y - dropLen * 0.50,
        topBack.z - 0.026
      );
      const endBack = new THREE.Vector3(
        topBack.x * 1.12,
        topBack.y - dropLen * 0.98,
        topBack.z - 0.036
      );
      const curtainStrand = new THREE.Mesh(
        createTaperedStrandGeometry([topBack, midBack, endBack], 0.028 * vol, 0.030 * vol, 0.012 * vol, 14, 8, 1.5, 0.68),
        b % 2 === 0 ? mat : accentMat
      );
      curtainStrand.castShadow = true;
      g.add(curtainStrand);
    }
  } else if (sil === 'bob_classic' || sil === 'pixie_chic') {
    const bobLen = sil === 'pixie_chic' ? 0.08 : 0.16 * len;
    for (const side of [-1, 1]) {
      const p0 = surf(0.34, side * 0.40 * Math.PI, 0.015 * vol);
      const p1 = surf(-0.20, side * 0.48 * Math.PI, 0.018 * vol);
      const p2 = new THREE.Vector3(side * headRadius * 0.86, -headHalfH * 0.65 - bobLen * 0.35, -0.008);
      const sideBob = new THREE.Mesh(
        createTaperedStrandGeometry([p0, p1, p2], 0.018 * vol, 0.024 * vol, 0.008, 14, 8, 1.35, 0.72),
        mat
      );
      sideBob.castShadow = true;
      g.add(sideBob);
    }
  } else if (sil === 'high_bun' || sil === 'ponytail_high' || sil === 'half_up') {
    if (sil === 'ponytail_high') {
      // Twin-tails / maria-chiquinhas onduladas estilizadas ancoradas no alto parietal da cabeça
      const tieMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(item.accentColor || '#F472B6'),
        roughness: 0.35,
      });
      for (const side of [-1, 1]) {
        const tieAnchor = surf(0.52, side * 0.46 * Math.PI, 0.018 * vol);
        const tie = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0075, 8, 16), tieMat);
        tie.position.copy(tieAnchor);
        tie.lookAt(tieAnchor.clone().multiplyScalar(2));
        g.add(tie);

        const tailLen = 0.28 * len;
        const p1 = new THREE.Vector3(tieAnchor.x + side * 0.055, tieAnchor.y + 0.022, tieAnchor.z - 0.018);
        const p2 = new THREE.Vector3(tieAnchor.x + side * 0.072, tieAnchor.y - tailLen * 0.44, tieAnchor.z - 0.028);
        const p3 = new THREE.Vector3(tieAnchor.x + side * 0.048, tieAnchor.y - tailLen * 0.96, tieAnchor.z - 0.016);
        const tailMesh = new THREE.Mesh(
          createTaperedStrandGeometry([tieAnchor, p1, p2, p3], 0.022 * vol, 0.036 * vol, 0.010, 20, 10, 1.15, 0.92),
          mat
        );
        tailMesh.castShadow = true;
        g.add(tailMesh);

        const tipAccent = new THREE.Mesh(
          createTaperedStrandGeometry([p2, p3], 0.024 * vol, 0.020 * vol, 0.006, 10, 8, 1.1, 0.9),
          accentMat
        );
        g.add(tipAccent);
      }
    } else {
      const bunAnchor = surf(0.76, Math.PI * 0.88, 0.016 * vol);
      const bunR = sil === 'high_bun' ? 0.062 * vol : 0.048 * vol;
      const bun = new THREE.Mesh(new THREE.SphereGeometry(bunR, 16, 14), accentMat);
      bun.position.set(0, bunAnchor.y + bunR * 0.42, bunAnchor.z - bunR * 0.38);
      bun.castShadow = true;
      g.add(bun);

      if (sil === 'half_up') {
        const tailLen = 0.24 * len;
        const t0 = new THREE.Vector3(0, bun.position.y - bunR * 0.4, bun.position.z);
        const t1 = surf(-0.35, Math.PI, 0.026 * vol);
        const t2 = new THREE.Vector3(0, t1.y - tailLen * 0.9, t1.z - 0.042);
        const tail = new THREE.Mesh(
          createTaperedStrandGeometry([t0, t1, t2], 0.026 * vol, 0.034 * vol, 0.010, 16, 8, 1.35, 0.72),
          mat
        );
        tail.castShadow = true;
        g.add(tail);
      }
    }
  } else if (sil === 'braids_twin') {
    for (const side of [-1, 1]) {
      const start = surf(-0.18, side * 0.56 * Math.PI, 0.016 * vol);
      for (let seg = 0; seg < 5; seg++) {
        const bead = new THREE.Mesh(
          new THREE.SphereGeometry((0.024 - seg * 0.0025) * vol, 12, 10),
          seg % 2 === 0 ? mat : accentMat
        );
        bead.position.set(
          start.x * 1.02 + side * seg * 0.003,
          start.y - seg * 0.046,
          start.z + seg * 0.012
        );
        g.add(bead);
      }
    }
  } else if (
    sil === 'quiff_textured' ||
    sil === 'pompadour' ||
    sil === 'executive_part' ||
    sil === 'undercut_fade' ||
    sil === 'slick_back'
  ) {
    // Franja & topete esculpidos acompanhando exatamente o contorno da testa
    for (let k = -2; k <= 2; k++) {
      const pStart = surf(0.76 - Math.abs(k) * 0.04, (k * 0.09 - 0.06) * Math.PI, 0.020 * vol);
      const pMid = surf(0.64 - Math.abs(k) * 0.04, (k * 0.11 + 0.04) * Math.PI, (sil === 'pompadour' ? 0.038 : 0.028) * vol);
      const pEnd = surf(0.46 - Math.abs(k) * 0.03, (k * 0.12 + 0.12) * Math.PI, 0.012 * vol);
      const lock = new THREE.Mesh(
        createTaperedStrandGeometry([pStart, pMid, pEnd], 0.014 * vol, 0.018 * vol, 0.003, 14, 8, 1.4, 0.65),
        k % 2 === 0 ? mat : accentMat
      );
      lock.castShadow = true;
      g.add(lock);
    }
    // Costeletas afuniladas atrás das têmporas sem tapar as orelhas
    for (const side of [-1, 1]) {
      const templeLock = new THREE.Mesh(
        createTaperedStrandGeometry(
          [
            surf(0.42, side * 0.36 * Math.PI, 0.014 * vol),
            surf(0.16, side * 0.40 * Math.PI, 0.013 * vol),
          ],
          0.011 * vol,
          0.009 * vol,
          0.0025,
          10,
          6,
          1.2,
          0.6
        ),
        mat
      );
      g.add(templeLock);
    }
  } else if (sil === 'curly_fade' || sil === 'dreads_short') {
    const count = 14;
    for (let k = 0; k < count; k++) {
      const ring = k < 8 ? 0 : 1;
      const ny = ring === 0 ? 0.64 : 0.86;
      const phi = ring === 0 ? -0.78 * Math.PI + (k / 7) * 1.56 * Math.PI : -0.5 * Math.PI + ((k - 8) / 5) * Math.PI;
      const anchor = surf(ny, phi, 0.018 * vol);
      const tuft = new THREE.Mesh(
        new THREE.SphereGeometry((sil === 'dreads_short' ? 0.022 : 0.028) * vol, 10, 8),
        k % 2 === 0 ? mat : accentMat
      );
      tuft.position.copy(anchor);
      if (sil === 'dreads_short') {
        tuft.scale.set(0.82, 1.45, 0.82);
      }
      g.add(tuft);
    }
  } else if (sil === 'surfer_medium' || sil === 'wolf_cut') {
    for (const side of [-1, 1]) {
      const lock = new THREE.Mesh(
        createTaperedStrandGeometry(
          [
            surf(0.55, side * 0.36 * Math.PI, 0.016 * vol),
            surf(0.08, side * 0.56 * Math.PI, 0.018 * vol),
            surf(-0.48, side * 0.68 * Math.PI, 0.016 * vol),
          ],
          0.016 * vol,
          0.020 * vol,
          0.006,
          14,
          8,
          1.35,
          0.65
        ),
        mat
      );
      g.add(lock);
    }
  }

  if (item.isLegendary) {
    const haloMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(item.threeSpec?.highlightColor || '#FBBF24'),
      emissive: new THREE.Color(item.threeSpec?.highlightColor || '#FBBF24'),
      emissiveIntensity: 0.7,
      roughness: 0.15,
      metalness: 0.85,
    });
    const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), haloMat);
    pin.position.copy(surf(0.68, 0.32 * Math.PI, 0.026 * vol));
    g.add(pin);
  }

  return g;
}

function createPleatedSkirtGeometry(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegs = 40,
  pleatDepth = 0.015,
  heightSegs = 12
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const stride = radialSegs + 1;

  for (let i = 0; i <= heightSegs; i++) {
    const v = i / heightSegs;
    const y = (0.5 - v) * height;
    const currentR = THREE.MathUtils.lerp(radiusTop, radiusBottom, Math.pow(v, 0.92));

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const pleatMod = Math.sin(theta * 18) * pleatDepth * (0.45 + v * 0.65);
      const softWave = Math.cos(theta * 5 + v * 2.2) * pleatDepth * 0.25 * v;
      const r = Math.max(0.01, currentR + pleatMod + softWave);

      positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
      uvs.push(u, 1 - v);
    }
  }

  for (let i = 0; i < heightSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const v00 = i * stride + j;
      const v01 = v00 + 1;
      const v10 = (i + 1) * stride + j;
      const v11 = v10 + 1;
      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Malha tubular de tronco com dobras orgânicas (pregas/caimento de tecido) e recorte frontal opcional para casacos abertos.
 */
function createDrapedTorsoGeometry(opts: {
  radiiY: Array<[number, number]>;
  zScale?: number;
  radialSegs?: number;
  foldAmplitude?: number;
  foldFrequency?: number;
  openFrontAngle?: number;
}): THREE.BufferGeometry {
  const segR = opts.radialSegs ?? 32;
  const zScale = opts.zScale ?? 0.72;
  const foldAmp = opts.foldAmplitude ?? 0.0028;
  const foldFreq = opts.foldFrequency ?? 10;
  const openGap = opts.openFrontAngle ?? 0;

  // Em Three.js, +Z é phi = PI/2 -> abertura frontal fica centrada em theta = 0 (convertido para +Z via sin/cos)
  const thetaStart = openGap * 0.5;
  const thetaLen = Math.PI * 2 - openGap;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const rows = opts.radiiY.length;
  const stride = segR + 1;

  for (let i = 0; i < rows; i++) {
    const v = i / Math.max(1, rows - 1);
    const [baseR, y] = opts.radiiY[i];
    for (let j = 0; j <= segR; j++) {
      const u = j / segR;
      const angle = thetaStart + u * thetaLen;
      // ângulo 0 aponta para frente (+Z), então x = sin(angle), z = cos(angle)
      const drape =
        Math.sin(angle * foldFreq + v * 2.4) * foldAmp * (0.4 + 0.6 * Math.sin(v * Math.PI));
      const r = Math.max(0.012, baseR + drape);
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r * zScale;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < segR; j++) {
      const v00 = i * stride + j;
      const v01 = v00 + 1;
      const v10 = (i + 1) * stride + j;
      const v11 = v10 + 1;
      indices.push(v00, v01, v11);
      indices.push(v00, v11, v10);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Lapela/gola chanfrada via extrusão e bevel */
function createBeveledLapelGeometry(width = 0.044, height = 0.19, depth = 0.01): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(width * 0.45, -height * 0.92);
  shape.lineTo(0, -height);
  shape.lineTo(-width * 0.55, -height * 0.25);
  shape.lineTo(-width * 0.22, -height * 0.14);
  shape.lineTo(-width * 0.52, 0.01);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.0035,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.center();
  return geo;
}

/** Bolso chanfrado com aba superior extrudada */
function createPocketFlapGeometry(w = 0.046, h = 0.056, depth = 0.012): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  shape.moveTo(-hw, hh);
  shape.lineTo(hw, hh);
  shape.lineTo(hw, -hh * 0.55);
  shape.quadraticCurveTo(0, -hh * 1.15, -hw, -hh * 0.55);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

/** Fivela metálica extrudada com vão central e bevel */
function createBeveledBuckleGeometry(w = 0.036, h = 0.026, depth = 0.007): THREE.ExtrudeGeometry {
  const outer = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  outer.moveTo(-hw, -hh);
  outer.lineTo(hw, -hh);
  outer.lineTo(hw, hh);
  outer.lineTo(-hw, hh);
  outer.closePath();

  const hole = new THREE.Path();
  const ihw = hw * 0.56;
  const ihh = hh * 0.52;
  hole.moveTo(-ihw, -ihh);
  hole.lineTo(ihw, -ihh);
  hole.lineTo(ihw, ihh);
  hole.lineTo(-ihw, ihh);
  hole.closePath();
  outer.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0022,
    bevelSize: 0.0022,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

/** Sola anatômica de calçado extrudada com curvatura suave */
function createSculptedSoleGeometry(width = 0.092, length = 0.21, thickness = 0.018): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const hw = width * 0.5;
  const hl = length * 0.5;
  shape.moveTo(-hw * 0.72, -hl);
  shape.quadraticCurveTo(0, -hl * 1.08, hw * 0.72, -hl);
  shape.bezierCurveTo(hw * 0.92, -hl * 0.3, hw * 1.04, hl * 0.35, hw * 0.85, hl * 0.84);
  shape.quadraticCurveTo(0, hl * 1.12, -hw * 0.85, hl * 0.84);
  shape.bezierCurveTo(-hw * 1.04, hl * 0.35, -hw * 0.92, -hl * 0.3, -hw * 0.72, -hl);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.0035,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}

/** Cria uma coroa real esculpida com arcos, florões chanfrados e gemas multifacetadas */
function buildOrnateCrownGroup(
  item: ClothingItem,
  mat: THREE.Material,
  trimMat: THREE.Material,
  baseRadius: number
): THREE.Group {
  const crown = new THREE.Group();
  const idLower = (item.id || '').toLowerCase();
  const yearVariant = idLower.includes('2026')
    ? 4
    : idLower.includes('2025')
      ? 3
      : idLower.includes('2024')
        ? 2
        : 1;

  // Anel principal chanfrado (base dupla)
  const band = new THREE.Mesh(new THREE.TorusGeometry(baseRadius, baseRadius * 0.13, 12, 32), trimMat);
  band.rotation.x = Math.PI / 2;
  band.castShadow = true;
  crown.add(band);

  const upperRing = new THREE.Mesh(
    new THREE.TorusGeometry(baseRadius * 1.04, baseRadius * 0.065, 10, 32),
    trimMat
  );
  upperRing.rotation.x = Math.PI / 2;
  upperRing.position.y = baseRadius * 0.16;
  crown.add(upperRing);

  // Forro interno de veludo real
  const velvetMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(item.secondaryColor || '#6D1431'),
    roughness: 0.85,
    sheen: 1,
    sheenColor: new THREE.Color(item.accentColor || '#FDE68A'),
  });
  const velvetCap = new THREE.Mesh(
    new THREE.SphereGeometry(baseRadius * 0.84, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
    velvetMat
  );
  velvetCap.position.y = baseRadius * 0.05;
  crown.add(velvetCap);

  // Florões / pontas chanfradas em extrusão ao redor da coroa
  const spireCount = 6 + (yearVariant % 3) * 2;
  const spireShape = new THREE.Shape();
  spireShape.moveTo(-baseRadius * 0.12, 0);
  spireShape.lineTo(0, baseRadius * (0.48 + yearVariant * 0.04));
  spireShape.lineTo(baseRadius * 0.12, 0);
  spireShape.closePath();
  const spireGeo = new THREE.ExtrudeGeometry(spireShape, {
    depth: baseRadius * 0.045,
    bevelEnabled: true,
    bevelThickness: baseRadius * 0.015,
    bevelSize: baseRadius * 0.014,
    bevelSegments: 2,
  });
  spireGeo.center();

  for (let i = 0; i < spireCount; i++) {
    const a = (i / spireCount) * Math.PI * 2;
    const isMajor = i % 2 === 0;
    const spire = new THREE.Mesh(spireGeo, trimMat);
    const sScale = isMajor ? 1.15 : 0.78;
    spire.scale.set(sScale, sScale, sScale);
    spire.position.set(
      Math.cos(a) * baseRadius * 0.99,
      baseRadius * (isMajor ? 0.34 : 0.26),
      Math.sin(a) * baseRadius * 0.99
    );
    spire.lookAt(Math.cos(a) * 4, spire.position.y, Math.sin(a) * 4);
    crown.add(spire);

    // Gema facetada na ponta e no cinturão frontal
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(baseRadius * (isMajor ? 0.13 : 0.085), 0),
      mat
    );
    gem.position.set(
      Math.cos(a) * baseRadius * 1.03,
      baseRadius * (isMajor ? 0.56 : 0.08),
      Math.sin(a) * baseRadius * 1.03
    );
    crown.add(gem);
  }

  // Arcos imperiais cruzados e orbe superior (destaque extra para Coroas 2024–2026)
  if (yearVariant >= 2) {
    const archCount = yearVariant >= 4 ? 4 : 2;
    for (let k = 0; k < archCount; k++) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(baseRadius * 0.92, baseRadius * 0.045, 8, 22, Math.PI),
        trimMat
      );
      arch.rotation.y = (k / archCount) * Math.PI;
      arch.position.y = baseRadius * 0.2;
      crown.add(arch);
    }
    const apexOrb = new THREE.Mesh(new THREE.OctahedronGeometry(baseRadius * 0.19, 1), mat);
    apexOrb.position.y = baseRadius * 1.18;
    crown.add(apexOrb);
  }

  return crown;
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
    roughness: 0.2,
    metalness: 0.9,
    clearcoat: 0.5,
    emissive: new THREE.Color(item.accentColor || '#D4AF37'),
    emissiveIntensity: item.isLegendary ? 0.35 : 0.06,
  });
}

const _invRootMat = new THREE.Matrix4();
const _relMat = new THREE.Matrix4();
const _syncPos = new THREE.Vector3();
const _syncQuat = new THREE.Quaternion();
const _syncScale = new THREE.Vector3();

type ClothingSlotCategory = Exclude<ClothingCategory, 'cabelo'>;

const CLOTHING_SLOT_CATEGORIES: readonly ClothingSlotCategory[] = [
  'sapatos',
  'calcas',
  'vestidos',
  'blusas',
  'casacos',
  'acessorios',
];

export interface AvatarAttachmentTargets {
  root: THREE.Object3D;
  head: THREE.Object3D;
  eyes: THREE.Object3D;
  neck: THREE.Object3D;
  pelvis: THREE.Object3D;
  torso: THREE.Object3D;
  leftUpperArm: THREE.Object3D;
  rightUpperArm: THREE.Object3D;
  leftForearm: THREE.Object3D;
  rightForearm: THREE.Object3D;
  leftThigh: THREE.Object3D;
  rightThigh: THREE.Object3D;
  leftCalf: THREE.Object3D;
  rightCalf: THREE.Object3D;
  leftFoot: THREE.Object3D;
  rightFoot: THREE.Object3D;
  handR: THREE.Object3D;
  wristL: THREE.Object3D;
  wristR: THREE.Object3D;
}

/**
 * Hierarquia Three.js unificada por nós pai-filho para MeDollStudio e Viewports 3D:
 * - rootGroup -> [ baseNode, clothingNode (com sub-nós por categoria), hairNode ]
 */
export interface AvatarAssemblyGroup {
  rootGroup: THREE.Group;
  baseNode: THREE.Group;
  clothingNode: THREE.Group;
  hairNode: THREE.Group;
  clothingSlots: Record<ClothingSlotCategory, THREE.Group>;
  metrics: AvatarRigMetrics;
  targets: AvatarAttachmentTargets;
  proceduralRig?: Avatar3DRig;
  gltfResult?: LoadedAvatarGLTFResult;
  syncTargets: Array<{ follower: THREE.Group; target: THREE.Object3D }>;
  dispose: () => void;
}

function buildTargetsFromLoadedModel(loaded: {
  gltfResult?: LoadedAvatarGLTFResult;
  proceduralRig?: Avatar3DRig;
  root?: THREE.Group;
  sockets: Avatar3DRig['sockets'];
}): AvatarAttachmentTargets {
  if (loaded.proceduralRig) {
    const r = loaded.proceduralRig;
    return {
      root: r.root,
      head: r.sockets.head,
      eyes: r.sockets.eyes,
      neck: r.sockets.neck,
      pelvis: r.sockets.pelvis,
      torso: r.torso,
      leftUpperArm: r.leftUpperArm,
      rightUpperArm: r.rightUpperArm,
      leftForearm: r.leftForearm,
      rightForearm: r.rightForearm,
      leftThigh: r.leftThigh,
      rightThigh: r.rightThigh,
      leftCalf: r.leftCalf,
      rightCalf: r.rightCalf,
      leftFoot: r.sockets.leftFoot,
      rightFoot: r.sockets.rightFoot,
      handR: r.sockets.handR,
      wristL: r.sockets.wristL,
      wristR: r.sockets.wristR,
    };
  }

  const s = loaded.sockets;
  const b = loaded.gltfResult?.bones ?? {};
  return {
    root: loaded.root ?? loaded.gltfResult?.root ?? s.pelvis,
    head: s.head,
    eyes: s.eyes,
    neck: s.neck,
    pelvis: s.pelvis,
    torso: b.spine ?? s.waist,
    leftUpperArm: b.leftUpperArm ?? s.wristL,
    rightUpperArm: b.rightUpperArm ?? s.wristR,
    leftForearm: b.leftForearm ?? s.wristL,
    rightForearm: b.rightForearm ?? s.wristR,
    leftThigh: b.leftThigh ?? s.pelvis,
    rightThigh: b.rightThigh ?? s.pelvis,
    leftCalf: b.leftCalf ?? s.leftFoot,
    rightCalf: b.rightCalf ?? s.rightFoot,
    leftFoot: s.leftFoot,
    rightFoot: s.rightFoot,
    handR: s.handR,
    wristL: s.wristL,
    wristR: s.wristR,
  };
}

/**
 * Cria o Group Three.js raiz que gerencia o avatar base, as malhas de roupa e o cabelo como nós pai-filho.
 */
export function createAvatarAssemblyGroup(loaded: {
  gltfResult?: LoadedAvatarGLTFResult;
  proceduralRig?: Avatar3DRig;
  root: THREE.Group;
  sockets: Avatar3DRig['sockets'];
  metrics: AvatarRigMetrics;
}): AvatarAssemblyGroup {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'MeDoll_AvatarAssemblyRoot';

  const baseNode = new THREE.Group();
  baseNode.name = 'AvatarBaseNode';
  baseNode.add(loaded.root);

  const clothingNode = new THREE.Group();
  clothingNode.name = 'AvatarClothingNode';

  const clothingSlots = {} as Record<ClothingSlotCategory, THREE.Group>;
  for (const cat of CLOTHING_SLOT_CATEGORIES) {
    const slotGrp = new THREE.Group();
    slotGrp.name = `ClothingSlot_${cat}`;
    clothingSlots[cat] = slotGrp;
    clothingNode.add(slotGrp);
  }

  const hairNode = new THREE.Group();
  hairNode.name = 'AvatarHairNode';

  rootGroup.add(baseNode, clothingNode, hairNode);

  const targets = buildTargetsFromLoadedModel(loaded);
  const syncTargets: Array<{ follower: THREE.Group; target: THREE.Object3D }> = [];

  const assembly: AvatarAssemblyGroup = {
    rootGroup,
    baseNode,
    clothingNode,
    hairNode,
    clothingSlots,
    metrics: loaded.metrics,
    targets,
    proceduralRig: loaded.proceduralRig,
    gltfResult: loaded.gltfResult,
    syncTargets,
    dispose: () => {
      syncTargets.length = 0;
      disposeObject3D(clothingNode);
      disposeObject3D(hairNode);
      if (loaded.gltfResult) {
        loaded.gltfResult.dispose();
      } else {
        disposeObject3D(baseNode);
      }
      rootGroup.removeFromParent();
    },
  };

  return assembly;
}

/**
 * Sincroniza as matrizes dos nós filhos de roupa e cabelo com os ossos/soquetes animados do avatar base
 * usando objetos scratch em escopo de módulo (zero alocação de memória no loop de renderização).
 */
export function syncAvatarAssemblyTransforms(assembly: AvatarAssemblyGroup): void {
  assembly.rootGroup.updateMatrixWorld(true);
  _invRootMat.copy(assembly.rootGroup.matrixWorld).invert();

  for (let i = 0; i < assembly.syncTargets.length; i++) {
    const { follower, target } = assembly.syncTargets[i];
    _relMat.multiplyMatrices(_invRootMat, target.matrixWorld);
    _relMat.decompose(_syncPos, _syncQuat, _syncScale);
    follower.position.copy(_syncPos);
    follower.quaternion.copy(_syncQuat);
  }
}

/**
 * Atualiza os nós filhos de cabelo e vestuário dentro de um AvatarAssemblyGroup mantendo o avatar base intacto.
 */
export function updateAvatarAssemblyEquipment(
  assembly: AvatarAssemblyGroup,
  equipped: EquippedOutfit,
  catalog: ClothingItem[]
): void {
  // Limpa nós anteriores de cabelo e vestuário com descarte limpo de GPU
  while (assembly.hairNode.children.length > 0) {
    const child = assembly.hairNode.children[0];
    assembly.hairNode.remove(child);
    disposeObject3D(child);
  }
  for (const cat of CLOTHING_SLOT_CATEGORIES) {
    const slotGrp = assembly.clothingSlots[cat];
    while (slotGrp.children.length > 0) {
      const child = slotGrp.children[0];
      slotGrp.remove(child);
      disposeObject3D(child);
    }
  }
  assembly.syncTargets.length = 0;

  // Mapeia sub-grupos seguidores por (categoria, alvo esquelético) dentro de clothingNode
  const followerBySlotTarget = new Map<string, THREE.Group>();
  const getFollowerFor = (category: ClothingSlotCategory, target: THREE.Object3D): THREE.Group => {
    const key = `${category}:${target.uuid}`;
    let follower = followerBySlotTarget.get(key);
    if (!follower) {
      follower = new THREE.Group();
      follower.name = `Node_${category}_${target.name || 'socket'}`;
      assembly.clothingSlots[category].add(follower);
      assembly.syncTargets.push({ follower, target });
      followerBySlotTarget.set(key, follower);
    }
    return follower;
  };

  attachOutfitNodes({
    metrics: assembly.metrics,
    targets: assembly.targets,
    equipped,
    catalog,
    attachHair: (hairObj) => {
      assembly.hairNode.add(hairObj);
      assembly.syncTargets.push({ follower: assembly.hairNode, target: assembly.targets.head });
    },
    attachClothing: (category, target, obj) => {
      getFollowerFor(category, target).add(obj);
    },
  });

  syncAvatarAssemblyTransforms(assembly);
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
 * Modela e acopla todas as peças equipadas perfeitamente sobre o novo corpo 3D estilizado (masculino e feminino).
 */
export function attachClothingAndHair3D(
  rig: Avatar3DRig,
  equipped: EquippedOutfit,
  catalog: ClothingItem[]
): void {
  clearAvatarClothing3D(rig);
  const targets = buildTargetsFromLoadedModel({
    proceduralRig: rig,
    sockets: rig.sockets,
  });
  attachOutfitNodes({
    metrics: rig.metrics,
    targets,
    equipped,
    catalog,
    attachHair: (hairObj) => {
      targets.head.add(hairObj);
      rig.attachedParts.push(hairObj);
    },
    attachClothing: (_category, target, obj) => {
      target.add(obj);
      rig.attachedParts.push(obj);
    },
  });
}

function attachOutfitNodes(params: {
  metrics: AvatarRigMetrics;
  targets: AvatarAttachmentTargets;
  equipped: EquippedOutfit;
  catalog: ClothingItem[];
  attachHair: (hairObj: THREE.Object3D) => void;
  attachClothing: (
    category: ClothingSlotCategory,
    target: THREE.Object3D,
    obj: THREE.Object3D
  ) => void;
}): void {
  const { metrics: m, targets, equipped, catalog, attachHair, attachClothing } = params;
  const isMale = m.gender === 'masculino';
  const byId = new Map(catalog.map((c) => [c.id, c]));

  // 1. Cabelo (usa cabelo base padrão idêntico ao 2D quando nenhuma peça de cabelo está equipada)
  const hairItem = equipped.cabelo ? byId.get(equipped.cabelo) : undefined;
  const resolvedHairItem: ClothingItem = hairItem ?? {
    id: '__default_base_hair__',
    name: 'Cabelo Base',
    brand: 'Nocturne Vale Club',
    category: 'cabelo',
    price: 0,
    zIndex: 50,
    gender: isMale ? 'masculino' : 'feminino',
    genderStyle: isMale ? 'masculino' : 'feminino',
    itemClass: 'am',
    swatchColor: isMale ? '#332119' : '#35231B',
    secondaryColor: isMale ? '#5B3F31' : '#614436',
    accentColor: '#2A1B15',
    pattern: 'solid',
    description: '',
    threeSpec: {
      hairSilhouette: isMale ? 'base_swept' : 'base_chignon',
      finish: 'cotton',
      highlightColor: isMale ? '#5B3F31' : '#614436',
      volumeScale: 1.0,
      lengthScale: 1.0,
    },
  };
  const hairGrp = buildHairGroup(resolvedHairItem, m.headRadius, m.headHalfH, m.gender);
  attachHair(hairGrp);

  // 2. Sapatos estilizados (sola extrudada chanfrada, gáspea esculpida, salto/cano e cadarços/fivelas)
  const shoeItem = equipped.sapatos ? byId.get(equipped.sapatos) : undefined;
  if (shoeItem) {
    const mat = makeGarmentMat(shoeItem);
    const soleMat = makeGarmentMat(shoeItem, true);
    const trimMat = makeTrimMat(shoeItem);
    const sil: Garment3DSilhouette = shoeItem.threeSpec?.garmentSilhouette || 'shoe_sneakers';
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f5f8, roughness: 0.4 });
    const darkDetailMat = new THREE.MeshStandardMaterial({ color: 0x1e222b, roughness: 0.5 });

    const buildShoeSide = () => {
      const sg = new THREE.Group();
      const vamp = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.044, 0.095, 8, 14),
        mat
      );
      vamp.rotation.x = Math.PI / 2;
      vamp.scale.set(1.02, 1.08, 0.62);
      vamp.position.set(0, -0.016, 0.054);
      vamp.castShadow = true;
      sg.add(vamp);

      const sole = new THREE.Mesh(
        createSculptedSoleGeometry(0.095, 0.214, 0.02),
        sil === 'shoe_sneakers' ? whiteMat : soleMat
      );
      sole.position.set(0, -0.045, 0.056);
      sole.castShadow = true;
      sg.add(sole);

      // Costura decorativa na vira da sola
      const weltSeam = new THREE.Mesh(
        new THREE.TorusGeometry(0.052, 0.0032, 6, 20),
        trimMat
      );
      weltSeam.rotation.x = Math.PI / 2;
      weltSeam.scale.set(0.92, 1.92, 1);
      weltSeam.position.set(0, -0.033, 0.056);
      sg.add(weltSeam);

      if (sil === 'shoe_heels' || sil === 'shoe_sandals') {
        const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.008, 0.068, 12), trimMat);
        heel.position.set(0, -0.024, -0.032);
        sg.add(heel);
      } else if (sil === 'shoe_boots') {
        const shaft = new THREE.Mesh(
          createDrapedTorsoGeometry({
            radiiY: [
              [0.048, -0.08],
              [0.047, 0.0],
              [0.055, 0.085],
            ],
            zScale: 1.0,
            radialSegs: 18,
            foldAmplitude: 0.0028,
            foldFrequency: 8,
          }),
          mat
        );
        shaft.material.side = THREE.DoubleSide;
        shaft.position.set(0, 0.072, -0.002);
        sg.add(shaft);
      } else {
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.048, 0.082, 16), mat);
        collar.position.set(0, 0.034, -0.002);
        const sidePanel = new THREE.Mesh(createPocketFlapGeometry(0.072, 0.042, 0.01), soleMat);
        sidePanel.rotation.y = Math.PI / 2;
        sidePanel.position.set(0.046, -0.012, 0.038);
        const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.065, 0.014), darkDetailMat);
        tongue.position.set(0, 0.044, 0.046);
        tongue.rotation.x = -0.22;
        const crest = new THREE.Mesh(createBeveledBuckleGeometry(0.022, 0.016, 0.005), trimMat);
        crest.position.set(0, 0.062, 0.053);
        sg.add(collar, sidePanel, tongue, crest);

        for (let l = 0; l < 4; l++) {
          const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.054, 6), whiteMat);
          lace.rotation.z = Math.PI / 2;
          lace.position.set(0, 0.002 + l * 0.013, 0.084 - l * 0.011);
          sg.add(lace);
        }
      }

      if (shoeItem.threeSpec?.metallicTrim && sil !== 'shoe_sneakers') {
        const buckle = new THREE.Mesh(createBeveledBuckleGeometry(0.034, 0.02, 0.006), trimMat);
        buckle.rotation.x = -0.45;
        buckle.position.set(0, 0.012, 0.08);
        sg.add(buckle);
      }
      return sg;
    };

    attachClothing('sapatos', targets.leftFoot, buildShoeSide());
    attachClothing('sapatos', targets.rightFoot, buildShoeSide());
  }

  // 3. Calças & Saias com cós anatômico, fivela extrudada, bolsos chanfrados e costuras/dobras
  const bottomItem = equipped.calcas ? byId.get(equipped.calcas) : undefined;
  const dressItem = equipped.vestidos ? byId.get(equipped.vestidos) : undefined;

  if (bottomItem && !dressItem) {
    const mat = makeGarmentMat(bottomItem);
    const secMat = makeGarmentMat(bottomItem, true);
    const trimMat = makeTrimMat(bottomItem);
    const sil: Garment3DSilhouette = bottomItem.threeSpec?.garmentSilhouette || 'pants_tailored';
    const isSkirt = sil === 'skirt_mini' || sil === 'skirt_midi' || sil === 'skirt_pleated';

    const waistGeo = createDrapedTorsoGeometry({
      radiiY: [
        [m.hipW * 1.07, -0.072],
        [m.hipW * 1.08, -0.01],
        [m.waistW * 1.08, 0.072],
      ],
      zScale: 0.73,
      radialSegs: 28,
      foldAmplitude: 0.0018,
      foldFrequency: 10,
    });
    const waistBand = new THREE.Mesh(waistGeo, mat);
    waistBand.material.side = THREE.DoubleSide;
    waistBand.position.y = 0.036;
    waistBand.castShadow = true;
    attachClothing('calcas', targets.pelvis, waistBand);

    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(m.waistW * 1.1, m.waistW * 1.1, 0.026, 24),
      trimMat
    );
    belt.scale.set(1, 1, 0.74);
    belt.position.y = 0.095;
    attachClothing('calcas', targets.pelvis, belt);

    // Fivela frontal em extrusão chanfrada
    const buckle = new THREE.Mesh(createBeveledBuckleGeometry(0.034, 0.028, 0.008), trimMat);
    buckle.position.set(0, 0.095, m.waistW * 0.77);
    attachClothing('calcas', targets.pelvis, buckle);

    if (isSkirt) {
      const skirtH = sil === 'skirt_mini' ? 0.24 : sil === 'skirt_pleated' ? 0.26 : 0.43;
      const skirtFlare = sil === 'skirt_pleated' ? 1.68 : sil === 'skirt_midi' ? 1.44 : 1.26;
      const skirtGeo = createPleatedSkirtGeometry(
        m.hipW * 1.02,
        m.hipW * skirtFlare,
        skirtH,
        40,
        sil === 'skirt_pleated' ? 0.017 : 0.007,
        12
      );
      const skirt = new THREE.Mesh(skirtGeo, mat);
      skirt.material.side = THREE.DoubleSide;
      skirt.scale.set(1, 1, 0.77);
      skirt.position.y = -skirtH * 0.42 + 0.025;
      skirt.castShadow = true;
      attachClothing('calcas', targets.pelvis, skirt);

      if (sil === 'skirt_pleated') {
        const stripe = new THREE.Mesh(
          new THREE.CylinderGeometry(
            m.hipW * skirtFlare * 0.96,
            m.hipW * skirtFlare * 1.01,
            0.022,
            32,
            1,
            true
          ),
          secMat
        );
        stripe.material.side = THREE.DoubleSide;
        stripe.scale.set(1, 1, 0.77);
        stripe.position.y = -skirtH * 0.86 + 0.025;
        attachClothing('calcas', targets.pelvis, stripe);
      }
    } else {
      const legScale =
        sil === 'pants_wide'
          ? 1.38
          : sil === 'pants_cargo'
            ? 1.24
            : sil === 'pants_skinny'
              ? 1.07
              : 1.16;
      const baseR = (isMale ? 0.068 : 0.066) * legScale;

      const buildLegCloth = (
        thighSocket: THREE.Object3D,
        calfSocket: THREE.Object3D,
        legSide: -1 | 1
      ) => {
        const upperGeo = createDrapedTorsoGeometry({
          radiiY: [
            [baseR * 0.82, -m.thighLen * 0.51],
            [baseR * 0.92, 0],
            [baseR * 1.02, m.thighLen * 0.51],
          ],
          zScale: 0.96,
          radialSegs: 20,
          foldAmplitude: sil === 'pants_skinny' ? 0.0012 : 0.0032,
          foldFrequency: 6,
        });
        const upper = new THREE.Mesh(upperGeo, mat);
        upper.position.y = -m.thighLen * 0.5;
        upper.castShadow = true;
        attachClothing('calcas', thighSocket, upper);

        // Costura lateral pespontada na coxa
        const sideSeam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0032, 0.0032, m.thighLen * 0.96, 6),
          secMat
        );
        sideSeam.position.set(legSide * baseR * 0.92, -m.thighLen * 0.5, 0);
        attachClothing('calcas', thighSocket, sideSeam);

        if (sil === 'pants_cargo') {
          const pocket = new THREE.Mesh(createPocketFlapGeometry(0.056, 0.088, 0.018), secMat);
          pocket.rotation.y = legSide * (Math.PI / 2);
          pocket.position.set(legSide * (baseR * 0.95), -m.thighLen * 0.54, 0);
          attachClothing('calcas', thighSocket, pocket);

          const pBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 8), trimMat);
          pBtn.rotation.z = Math.PI / 2;
          pBtn.position.set(legSide * (baseR * 1.08), -m.thighLen * 0.48, 0);
          attachClothing('calcas', thighSocket, pBtn);
        }

        if (sil === 'pants_skinny') {
          const ripSkinMat = new THREE.MeshStandardMaterial({ color: 0xe6b99c, roughness: 0.65 });
          const kneeRip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.022, 0.018), ripSkinMat);
          kneeRip.position.set(0, -m.thighLen * 0.94, baseR * 0.72);
          attachClothing('calcas', thighSocket, kneeRip);

          if (legSide === 1) {
            const thighRip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.012, 0.018), ripSkinMat);
            thighRip.position.set(0.008, -m.thighLen * 0.42, baseR * 0.86);
            attachClothing('calcas', thighSocket, thighRip);
          }
        }

        if (sil !== 'shorts') {
          const lowerGeo = createDrapedTorsoGeometry({
            radiiY: [
              [baseR * (sil === 'pants_wide' ? 0.95 : 0.65), -m.calfLen * 0.48],
              [baseR * 0.76, 0],
              [baseR * 0.81, m.calfLen * 0.48],
            ],
            zScale: 0.96,
            radialSegs: 18,
            foldAmplitude: 0.0024,
            foldFrequency: 6,
          });
          const lower = new THREE.Mesh(lowerGeo, mat);
          lower.position.y = -m.calfLen * 0.48;
          lower.castShadow = true;
          attachClothing('calcas', calfSocket, lower);

          // Barra dobrada da calça
          const hemCuff = new THREE.Mesh(
            new THREE.TorusGeometry(baseR * (sil === 'pants_wide' ? 0.96 : 0.66), 0.0085, 8, 18),
            secMat
          );
          hemCuff.rotation.x = Math.PI / 2;
          hemCuff.position.y = -m.calfLen * 0.94;
          attachClothing('calcas', calfSocket, hemCuff);
        }
      };

      buildLegCloth(targets.leftThigh, targets.leftCalf, -1);
      buildLegCloth(targets.rightThigh, targets.rightCalf, 1);
    }
  }

  // 4. Vestidos com corpete esculpido/dobrado, cinto com broche chanfrado e saia plissada fluida
  if (dressItem) {
    const mat = makeGarmentMat(dressItem);
    const secMat = makeGarmentMat(dressItem, true);
    const trimMat = makeTrimMat(dressItem);
    const sil: Garment3DSilhouette = dressItem.threeSpec?.garmentSilhouette || 'dress_aline';
    const lenScale = dressItem.threeSpec?.lengthScale ?? 1.0;

    const bodiceGeo = createDrapedTorsoGeometry({
      radiiY: [
        [m.waistW * 1.08, -0.02],
        [m.waistW * 1.03, m.torsoH * 0.25],
        [m.chestW * 1.11, m.torsoH * 0.64],
        [m.shoulderHalfW * 0.74, m.torsoH * 0.88],
      ],
      zScale: 0.72,
      radialSegs: 28,
      foldAmplitude: 0.003,
      foldFrequency: 10,
    });
    const bodice = new THREE.Mesh(bodiceGeo, mat);
    bodice.material.side = THREE.DoubleSide;
    bodice.castShadow = true;
    attachClothing('vestidos', targets.torso, bodice);

    const sash = new THREE.Mesh(
      new THREE.CylinderGeometry(m.waistW * 1.11, m.waistW * 1.11, 0.036, 24),
      trimMat
    );
    sash.scale.set(1, 1, 0.73);
    sash.position.y = 0.015;
    attachClothing('vestidos', targets.torso, sash);

    const brooch = new THREE.Mesh(createBeveledBuckleGeometry(0.028, 0.024, 0.007), trimMat);
    brooch.position.set(0, 0.015, m.waistW * 0.78);
    attachClothing('vestidos', targets.torso, brooch);

    const isLong = sil === 'dress_mermaid' || sil === 'dress_ballgown';
    const skirtH = (isLong ? 0.68 : sil === 'dress_mini_party' ? 0.28 : 0.46) * lenScale;
    const bottomR =
      sil === 'dress_ballgown'
        ? m.hipW * 2.15
        : sil === 'dress_mermaid'
          ? m.hipW * 1.42
          : sil === 'dress_aline'
            ? m.hipW * 1.62
            : m.hipW * 1.22;

    const dressSkirtGeo = createPleatedSkirtGeometry(
      m.waistW * 1.07,
      bottomR,
      skirtH,
      40,
      sil === 'dress_ballgown' ? 0.019 : 0.01,
      14
    );
    const dressSkirt = new THREE.Mesh(dressSkirtGeo, mat);
    dressSkirt.material.side = THREE.DoubleSide;
    dressSkirt.scale.set(1, 1, 0.77);
    dressSkirt.position.y = -skirtH * 0.5 + 0.085;
    dressSkirt.castShadow = true;
    attachClothing('vestidos', targets.pelvis, dressSkirt);

    if (sil === 'dress_blazer') {
      for (const side of [-1, 1]) {
        const lapel = new THREE.Mesh(createBeveledLapelGeometry(0.036, 0.16, 0.009), secMat);
        lapel.position.set(side * 0.044, m.torsoH * 0.66, m.chestDepth * 0.73);
        lapel.rotation.z = side * 0.16;
        attachClothing('vestidos', targets.torso, lapel);
      }
      const sleeveR = isMale ? 0.044 : 0.036;
      for (const arm of [targets.leftUpperArm, targets.rightUpperArm]) {
        const sl = new THREE.Mesh(
          new THREE.CylinderGeometry(sleeveR, sleeveR * 0.86, m.upperArmLen, 14),
          secMat
        );
        sl.position.y = -m.upperArmLen * 0.5;
        attachClothing('vestidos', arm, sl);
      }
    }
  }

  // Função auxiliar compartilhada para construir Blusas ('blusas') e Sobreposições ('casacos')
  const renderUpperGarment = (
    slotCategory: 'blusas' | 'casacos',
    item: ClothingItem,
    layerOffset: number,
    forceOpenLayer: boolean
  ) => {
    const mat = makeGarmentMat(item);
    const secMat = makeGarmentMat(item, true);
    const trimMat = makeTrimMat(item);
    const sil: Garment3DSilhouette = item.threeSpec?.garmentSilhouette || (slotCategory === 'casacos' ? 'blazer' : 'silk_shirt');
    const vol = (item.threeSpec?.volumeScale ?? 1.0) * (1 + layerOffset);

    const isCropped = !forceOpenLayer && (sil === 'cropped' || sil === 'corset');
    const startY = isCropped ? m.torsoH * 0.24 : slotCategory === 'casacos' && sil === 'trench_coat' ? -0.16 : -0.04;
    const isOuterwear = slotCategory === 'casacos' || sil === 'blazer' || sil === 'trench_coat' || sil === 'hoodie' || sil === 'leather_jacket';
    const isOpenJacket = forceOpenLayer || sil === 'leather_jacket' || sil === 'blazer';

    if (isOpenJacket) {
      // Se for apenas blusas (sem camada por baixo), cria camiseta gráfica interna
      if (slotCategory === 'blusas') {
        const teeGeo = createDrapedTorsoGeometry({
          radiiY: [
            [m.waistW * 1.06, -0.042],
            [m.chestW * 1.06, m.torsoH * 0.62],
            [m.shoulderHalfW * 0.84, m.torsoH * 0.91],
            [0.058, m.torsoH * 0.99],
          ],
          zScale: 0.69,
          radialSegs: 26,
          foldAmplitude: 0.002,
        });
        const teeMat = new THREE.MeshPhysicalMaterial({
          map: getGraphicTeeTexture(item.secondaryColor || '#1A1C22'),
          roughness: 0.72,
        });
        const teeMesh = new THREE.Mesh(teeGeo, teeMat);
        teeMesh.material.side = THREE.DoubleSide;
        teeMesh.castShadow = true;
        attachClothing(slotCategory, targets.torso, teeMesh);
      }

      // Painel frontal aberto com dobras, lapelas extrudadas chanfradas, bolsos e zíper
      const jacketGeo = createDrapedTorsoGeometry({
        radiiY: [
          [m.waistW * 1.2 * vol, startY],
          [m.chestW * 1.19 * vol, m.torsoH * 0.62],
          [m.shoulderHalfW * 0.99 * vol, m.torsoH * 0.9],
          [0.068 * (1 + layerOffset * 0.6), m.torsoH * 0.98],
        ],
        zScale: 0.76,
        radialSegs: 28,
        foldAmplitude: 0.0032,
        foldFrequency: 10,
        openFrontAngle: 0.72,
      });
      const jacketMesh = new THREE.Mesh(jacketGeo, mat);
      jacketMesh.material.side = THREE.DoubleSide;
      jacketMesh.castShadow = true;
      attachClothing(slotCategory, targets.torso, jacketMesh);

      const ribCollar = new THREE.Mesh(
        new THREE.TorusGeometry(0.066 * (1 + layerOffset * 0.5), 0.015, 10, 24, Math.PI * 1.55),
        secMat
      );
      ribCollar.rotation.x = Math.PI * 0.5;
      ribCollar.rotation.z = Math.PI * 0.72;
      ribCollar.position.set(0, m.torsoH * 0.96, 0.005);
      attachClothing(slotCategory, targets.torso, ribCollar);

      // Lapelas extrudadas com bevel e botões metálicos
      for (const side of [-1, 1]) {
        const lapel = new THREE.Mesh(createBeveledLapelGeometry(0.04, 0.175, 0.01), secMat);
        lapel.position.set(side * 0.056, m.torsoH * 0.68, m.chestDepth * (0.86 + layerOffset));
        lapel.rotation.z = side * 0.14;
        lapel.rotation.y = side * 0.25;
        attachClothing(slotCategory, targets.torso, lapel);

        const zipRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.007, m.torsoH * 0.84, 0.012),
          trimMat
        );
        zipRail.position.set(side * 0.048, m.torsoH * 0.45, m.chestDepth * (0.87 + layerOffset));
        zipRail.rotation.z = side * -0.04;
        attachClothing(slotCategory, targets.torso, zipRail);

        const pocket = new THREE.Mesh(createPocketFlapGeometry(0.046, 0.042, 0.009), secMat);
        pocket.position.set(side * 0.088, m.torsoH * 0.22, m.chestDepth * (0.84 + layerOffset));
        pocket.rotation.y = side * 0.35;
        attachClothing(slotCategory, targets.torso, pocket);

        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.007, 10), trimMat);
        btn.rotation.x = Math.PI / 2;
        btn.position.set(side * 0.054, m.torsoH * (0.28 + (side > 0 ? 0.1 : 0)), m.chestDepth * (0.9 + layerOffset));
        attachClothing(slotCategory, targets.torso, btn);
      }

      const ribWaist = new THREE.Mesh(
        new THREE.CylinderGeometry(
          m.waistW * 1.2 * vol,
          m.waistW * 1.16 * vol,
          0.04,
          24,
          1,
          true,
          0.36,
          Math.PI * 2 - 0.72
        ),
        secMat
      );
      ribWaist.material.side = THREE.DoubleSide;
      ribWaist.scale.set(1, 1, 0.76);
      ribWaist.position.y = startY + 0.02;
      attachClothing(slotCategory, targets.torso, ribWaist);
    } else {
      const topGeo = createDrapedTorsoGeometry({
        radiiY: [
          [m.waistW * (isOuterwear ? 1.18 : 1.09) * vol, startY],
          [m.chestW * (isOuterwear ? 1.16 : 1.11) * vol, m.torsoH * 0.62],
          [m.shoulderHalfW * 0.97 * vol, m.torsoH * 0.9],
          [0.064 * (1 + layerOffset * 0.5), m.torsoH * 1.01],
        ],
        zScale: 0.73,
        radialSegs: 28,
        foldAmplitude: 0.0032,
        foldFrequency: 10,
      });
      const torsoCloth = new THREE.Mesh(topGeo, mat);
      torsoCloth.material.side = THREE.DoubleSide;
      torsoCloth.castShadow = true;
      attachClothing(slotCategory, targets.torso, torsoCloth);

      // Costura central + fileira de botões & bolsos
      const centerPlacket = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, m.torsoH * 0.76, 0.01),
        secMat
      );
      centerPlacket.position.set(0, m.torsoH * 0.48, m.chestDepth * (0.81 + layerOffset));
      attachClothing(slotCategory, targets.torso, centerPlacket);

      if (item.threeSpec?.metallicTrim || sil === 'silk_shirt' || sil === 'vest_suit' || sil === 'trench_coat') {
        for (let b = 0; b < 3; b++) {
          const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 10), trimMat);
          btn.rotation.x = Math.PI / 2;
          btn.position.set(0, m.torsoH * (0.24 + b * 0.19), m.chestDepth * (0.83 + layerOffset));
          attachClothing(slotCategory, targets.torso, btn);
        }
      }
    }

    if (sil === 'hoodie') {
      const hoodRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.068 * (1 + layerOffset * 0.5), 0.025, 10, 22),
        secMat
      );
      hoodRing.rotation.x = Math.PI * 0.45;
      hoodRing.position.set(0, m.torsoH * 0.98, -0.014);
      attachClothing(slotCategory, targets.torso, hoodRing);
    }

    if (sil === 'trench_coat' || sil === 'vest_suit' || sil === 'silk_shirt') {
      for (const side of [-1, 1]) {
        const lapel = new THREE.Mesh(createBeveledLapelGeometry(0.036, 0.165, 0.009), secMat);
        lapel.position.set(side * 0.044, m.torsoH * 0.7, m.chestDepth * (0.78 + layerOffset));
        lapel.rotation.z = side * -0.16;
        attachClothing(slotCategory, targets.torso, lapel);
      }
    }

    const hasLongSleeves =
      slotCategory === 'casacos' ||
      sil === 'silk_shirt' ||
      sil === 'blazer' ||
      sil === 'leather_jacket' ||
      sil === 'hoodie' ||
      sil === 'turtleneck' ||
      sil === 'trench_coat';
    const hasShortSleeves = !hasLongSleeves && (sil === 'tshirt' || sil === 'off_shoulder');
    const sleeveR = (isMale ? 0.051 : 0.041) * vol;

    if (hasLongSleeves || hasShortSleeves) {
      const armPairs = [
        { upper: targets.leftUpperArm, fore: targets.leftForearm, side: -1 },
        { upper: targets.rightUpperArm, fore: targets.rightForearm, side: 1 },
      ] as const;

      for (const { upper, fore, side } of armPairs) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(sleeveR * 1.02, 14, 12), mat);
        attachClothing(slotCategory, upper, cap);

        const upLen = hasShortSleeves ? m.upperArmLen * 0.56 : m.upperArmLen * 1.03;
        const upGeo = createDrapedTorsoGeometry({
          radiiY: [
            [sleeveR * 0.88, -upLen * 0.5],
            [sleeveR * 0.95, 0],
            [sleeveR, upLen * 0.5],
          ],
          zScale: 1.0,
          radialSegs: 16,
          foldAmplitude: 0.002,
          foldFrequency: 6,
        });
        const upMesh = new THREE.Mesh(upGeo, mat);
        upMesh.position.y = -upLen * 0.5;
        upMesh.castShadow = true;
        attachClothing(slotCategory, upper, upMesh);

        if (isOpenJacket && side === 1) {
          const armPocket = new THREE.Mesh(createPocketFlapGeometry(0.038, 0.056, 0.014), secMat);
          armPocket.rotation.y = Math.PI / 2;
          armPocket.position.set(sleeveR * 0.96, -upLen * 0.5, 0);
          attachClothing(slotCategory, upper, armPocket);
        }

        if (hasLongSleeves) {
          const foreGeo = createDrapedTorsoGeometry({
            radiiY: [
              [sleeveR * 0.74, -m.forearmLen * 0.43],
              [sleeveR * 0.82, 0],
              [sleeveR * 0.88, m.forearmLen * 0.43],
            ],
            zScale: 1.0,
            radialSegs: 16,
            foldAmplitude: 0.0022,
            foldFrequency: 6,
          });
          const foreMesh = new THREE.Mesh(foreGeo, mat);
          foreMesh.position.y = -m.forearmLen * 0.42;
          foreMesh.castShadow = true;
          attachClothing(slotCategory, fore, foreMesh);

          const cuff = new THREE.Mesh(
            new THREE.CylinderGeometry(sleeveR * 0.79, sleeveR * 0.73, 0.034, 16),
            secMat
          );
          cuff.position.y = -m.forearmLen * 0.84;
          attachClothing(slotCategory, fore, cuff);
        }
      }
    }
  };

  // 5A. Blusas / Camisas / Moletom ('blusas')
  const topItem = equipped.blusas ? byId.get(equipped.blusas) : undefined;
  if (topItem && !dressItem) {
    renderUpperGarment('blusas', topItem, 0, false);
  }

  // 5B. Jaquetas & Casacos em sobreposição sobre camisetas ou vestidos ('casacos')
  const coatItem = equipped.casacos ? byId.get(equipped.casacos) : undefined;
  if (coatItem) {
    renderUpperGarment('casacos', coatItem, topItem || dressItem ? 0.11 : 0.02, Boolean(topItem || dressItem));
  }

  // 6. Acessórios (múltiplos itens simultâneos por parte anatômica: cabeça, rosto, pescoço, braço, mão e mascote voador)
  const equippedAccList = getEquippedAccessoriesList(equipped, byId);
  for (const { item: accItem } of equippedAccList) {
    const mat = makeGarmentMat(accItem);
    const trimMat = makeTrimMat(accItem);
    const secMat = makeGarmentMat(accItem, true);
    const sil: Garment3DSilhouette = accItem.threeSpec?.garmentSilhouette || 'acc_crown';

    if (sil === 'acc_crown') {
      const crown = buildOrnateCrownGroup(accItem, mat, trimMat, m.headRadius * 0.74);
      crown.position.set(0, m.headHalfH * 0.96, -0.006);
      attachClothing('acessorios', targets.head, crown);
    } else if (sil === 'acc_hat') {
      const hat = new THREE.Group();
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(m.headRadius * 1.15, m.headRadius * 1.18, 0.042, 24),
        trimMat
      );
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(m.headRadius * 1.14, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
        mat
      );
      dome.position.y = 0.016;
      const patch = new THREE.Mesh(createPocketFlapGeometry(0.024, 0.022, 0.008), trimMat);
      patch.rotation.y = Math.PI / 2;
      patch.position.set(m.headRadius * 1.15, 0, 0.02);
      hat.add(brim, dome, patch);
      hat.position.set(0, m.headHalfH * 0.44, -0.022);
      hat.rotation.x = -0.32;
      attachClothing('acessorios', targets.head, hat);
    } else if (sil === 'acc_eyepatch') {
      const patchGrp = buildEyepatch3DGroup(mat, trimMat, m.headRadius, isMale);
      attachClothing('acessorios', targets.eyes, patchGrp);
    } else if (sil === 'acc_sunglasses') {
      const glasses = new THREE.Group();
      const lensMat = new THREE.MeshPhysicalMaterial({
        color: 0x111118,
        roughness: 0.1,
        metalness: 0.5,
        clearcoat: 1,
      });
      const eyeX = m.headRadius * (isMale ? 0.45 : 0.48);
      for (const side of [-1, 1]) {
        const frame = new THREE.Mesh(createBeveledBuckleGeometry(0.046, 0.032, 0.007), trimMat);
        frame.position.set(side * eyeX, 0.002, 0.012);
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.022, 0.006), lensMat);
        lens.position.set(side * eyeX, 0.002, 0.013);
        glasses.add(frame, lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.005, 0.006), trimMat);
      bridge.position.set(0, 0.008, 0.012);
      glasses.add(bridge);
      attachClothing('acessorios', targets.eyes, glasses);
    } else if (sil === 'acc_necklace') {
      const grp = new THREE.Group();
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0045, 8, 22), trimMat);
      collar.rotation.x = Math.PI * 0.58;
      collar.position.set(0, -0.01, 0.012);
      const dogTag = new THREE.Mesh(createPocketFlapGeometry(0.022, 0.032, 0.005), trimMat);
      dogTag.position.set(0, -0.055, 0.068);
      grp.add(collar, dogTag);
      attachClothing('acessorios', targets.neck, grp);
    } else if (sil === 'acc_bag') {
      const bag = new THREE.Group();
      const body = new THREE.Mesh(createPocketFlapGeometry(0.13, 0.11, 0.045), mat);
      const clasp = new THREE.Mesh(createBeveledBuckleGeometry(0.026, 0.018, 0.008), trimMat);
      clasp.position.set(0, 0.01, 0.028);
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.04, 0.007, 8, 16, Math.PI),
        trimMat
      );
      handle.position.y = 0.06;
      bag.add(body, clasp, handle);
      bag.position.set(0.02, -0.06, 0);
      bag.rotation.y = Math.PI / 2;
      attachClothing('acessorios', targets.handR, bag);
    } else if (sil === 'acc_scepter') {
      const scepter = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.58, 10), trimMat);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.034, 0), mat);
      orb.position.y = 0.3;
      scepter.add(rod, orb);
      scepter.rotation.x = 0.25;
      attachClothing('acessorios', targets.handR, scepter);
    } else if (sil === 'acc_earrings') {
      const earGroup = new THREE.Group();
      for (const side of [-1, 1]) {
        const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), trimMat);
        drop.position.set(side * m.headRadius * 0.98, -m.headHalfH * 0.16, -0.008);
        earGroup.add(drop);
      }
      attachClothing('acessorios', targets.head, earGroup);
    } else if (sil === 'acc_dragon') {
      const dragon = buildFlyingDragon3DGroup(accItem, mat, secMat, trimMat);
      dragon.userData.isFlyingCompanion = true;
      dragon.userData.baseX = m.shoulderHalfW * 1.95 + 0.18;
      dragon.userData.baseY = m.torsoH * 0.85;
      dragon.userData.baseZ = 0.08;
      dragon.position.set(
        dragon.userData.baseX,
        dragon.userData.baseY,
        dragon.userData.baseZ,
      );
      attachClothing('acessorios', targets.torso, dragon);
    } else if (sil === 'acc_white_tiger') {
      const tiger = buildWhiteTiger3DGroup(accItem, mat, secMat, trimMat);
      tiger.userData.isWalkingCompanion = true;
      tiger.userData.orbitRadius = 0.62;
      tiger.userData.orbitSpeed = 0.88;
      tiger.position.set(0.62, 0, 0);
      attachClothing('acessorios', targets.root, tiger);
    } else {
      const watchGrp = buildGoldWatchWristGroup(mat, secMat, trimMat);
      attachClothing('acessorios', targets.wristL, watchGrp);
    }
  }
}

function buildEyepatch3DGroup(
  mat: THREE.Material,
  trimMat: THREE.Material,
  headRadius: number,
  isMale: boolean
): THREE.Group {
  const grp = new THREE.Group();
  const eyeX = headRadius * (isMale ? 0.44 : 0.46);

  // Concha anatômica do tapa-olho no olho esquerdo (ou direito na visão frontal)
  const cup = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
    mat
  );
  cup.rotation.x = Math.PI / 2;
  cup.scale.set(1.08, 0.92, 0.52);
  cup.position.set(-eyeX, 0.002, 0.008);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.0038, 8, 22), trimMat);
  rim.scale.set(1.08, 0.92, 1);
  rim.position.set(-eyeX, 0.002, 0.011);

  const jewelMat = new THREE.MeshPhysicalMaterial({
    color: 0xe11d48,
    emissive: 0x9f1239,
    emissiveIntensity: 0.45,
    roughness: 0.12,
    metalness: 0.25,
    clearcoat: 1,
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.007, 0), jewelMat);
  gem.position.set(-eyeX, 0.002, 0.019);

  // Alça oblíqua contornando a cabeça
  const strap = new THREE.Mesh(
    new THREE.TorusGeometry(headRadius * 1.03, 0.0042, 6, 36),
    mat
  );
  strap.rotation.x = Math.PI * 0.5;
  strap.rotation.y = 0.28;
  strap.position.set(0, 0.012, -headRadius * 0.94);

  grp.add(cup, rim, gem, strap);
  return grp;
}

function buildGoldWatchWristGroup(
  mat: THREE.Material,
  secMat: THREE.Material,
  trimMat: THREE.Material
): THREE.Group {
  const watchGrp = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 8, 20), mat);
  band.rotation.x = Math.PI / 2;

  const caseOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.01, 18), trimMat);
  caseOuter.rotation.z = Math.PI / 2;
  caseOuter.position.set(-0.036, 0, 0);

  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfde68a,
    emissiveIntensity: 0.14,
    roughness: 0.2,
  });
  const dialFace = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.011, 16), faceMat);
  dialFace.rotation.z = Math.PI / 2;
  dialFace.position.set(-0.0365, 0, 0);

  const crownKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.006, 8), secMat);
  crownKnob.position.set(-0.036, 0, 0.019);
  crownKnob.rotation.x = Math.PI / 2;

  watchGrp.add(band, caseOuter, dialFace, crownKnob);
  return watchGrp;
}

function buildFlyingDragon3DGroup(
  item: ClothingItem,
  mat: THREE.Material,
  secMat: THREE.Material,
  trimMat: THREE.Material
): THREE.Group {
  const dragon = new THREE.Group();
  dragon.name = 'FlyingDragonCompanion';

  const bodyMat = mat;
  const wingMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(item.accentColor || '#F59E0B'),
    emissive: new THREE.Color(item.secondaryColor || '#F59E0B'),
    emissiveIntensity: 0.3,
    roughness: 0.25,
    metalness: 0.2,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.85,
  });

  // Torso escultural do dragãozinho
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.058, 18, 16), bodyMat);
  torso.scale.set(0.88, 0.95, 1.38);
  dragon.add(torso);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 12), trimMat);
  belly.scale.set(0.75, 0.78, 1.25);
  belly.position.set(0, -0.014, 0.01);
  dragon.add(belly);

  // Pescoço e cabeça fofa com focinho, chifres dourados e olhos brilhantes
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.068, 12), bodyMat);
  neck.position.set(0, 0.058, 0.056);
  neck.rotation.x = 0.45;
  dragon.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 14), bodyMat);
  head.scale.set(0.95, 0.88, 1.15);
  head.position.set(0, 0.092, 0.088);
  dragon.add(head);

  const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.024, 6, 12), bodyMat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.084, 0.13);
  dragon.add(snout);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 10), eyeMat);
    eye.position.set(side * 0.024, 0.098, 0.122);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.042, 8), secMat);
    horn.position.set(side * 0.02, 0.126, 0.072);
    horn.rotation.x = -0.45;
    horn.rotation.z = side * -0.32;
    dragon.add(eye, horn);
  }

  // Cauda curva com ponta de lança dourada
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.14, 10), bodyMat);
  tail.rotation.x = -Math.PI * 0.42;
  tail.position.set(0, -0.016, -0.115);
  const tailTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.016, 0), trimMat);
  tailTip.position.set(0, -0.032, -0.185);
  dragon.add(tail, tailTip);

  // Cristas nas costas
  for (let c = 0; c < 3; c++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.026, 6), trimMat);
    spike.position.set(0, 0.056 - c * 0.012, 0.015 - c * 0.036);
    spike.rotation.x = -0.3;
    dragon.add(spike);
  }

  // Asas articuladas esquerda e direita para baterem continuamente
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.quadraticCurveTo(0.09, 0.075, 0.18, 0.05);
  wingShape.quadraticCurveTo(0.14, -0.015, 0.12, -0.055);
  wingShape.quadraticCurveTo(0.065, -0.025, 0, -0.04);
  wingShape.closePath();
  const wingGeo = new THREE.ShapeGeometry(wingShape);

  for (const side of [-1, 1]) {
    const wingPivot = new THREE.Group();
    wingPivot.userData.isFlyingDragonWing = side;
    wingPivot.position.set(side * 0.034, 0.038, -0.005);

    const wingMembrane = new THREE.Mesh(wingGeo, wingMat);
    if (side === -1) {
      wingMembrane.scale.x = -1;
    }
    wingMembrane.rotation.x = -0.28;
    const wingSpar = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.16, 8), secMat);
    wingSpar.rotation.z = side * -Math.PI * 0.36;
    wingSpar.position.set(side * 0.072, 0.028, 0.004);
    wingPivot.add(wingMembrane, wingSpar);
    dragon.add(wingPivot);
  }

  // Aura sutil mágica
  dragon.rotation.y = -0.25;
  return dragon;
}

function buildWhiteTiger3DGroup(
  item: ClothingItem,
  mat: THREE.Material,
  secMat: THREE.Material,
  _trimMat: THREE.Material
): THREE.Group {
  const tiger = new THREE.Group();
  tiger.name = 'WhiteTigerCompanion';

  const whiteFurMat =
    mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial
      ? mat
      : new THREE.MeshStandardMaterial({
          color: new THREE.Color(item.swatchColor || '#F8FAFC'),
          roughness: 0.55,
          metalness: 0.04,
        });
  const stripeMat =
    secMat instanceof THREE.MeshStandardMaterial || secMat instanceof THREE.MeshPhysicalMaterial
      ? secMat
      : new THREE.MeshStandardMaterial({
          color: new THREE.Color(item.secondaryColor || '#18181B'),
          roughness: 0.6,
        });
  const creamBellyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.45 });
  const iceEyeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(item.accentColor || '#38BDF8'),
    emissive: new THREE.Color(item.accentColor || '#0EA5E9'),
    emissiveIntensity: 0.65,
    roughness: 0.15,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });

  // Torso felino musculoso (frente em +Z)
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), whiteFurMat);
  torso.scale.set(0.76, 0.84, 1.52);
  torso.position.set(0, 0.21, 0);
  torso.castShadow = true;
  tiger.add(torso);

  // Juba/peito fofo frontal
  const chestRuff = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 14), creamBellyMat);
  chestRuff.scale.set(0.84, 0.92, 0.85);
  chestRuff.position.set(0, 0.215, 0.11);
  tiger.add(chestRuff);

  // Listras negras curvadas ao longo do dorso e flancos
  const stripeOffsetsZ = [-0.11, -0.068, -0.025, 0.018, 0.06, 0.1];
  for (const sz of stripeOffsetsZ) {
    const normZ = sz / 0.175;
    const radAtZ = Math.max(0.045, Math.sqrt(Math.max(0.15, 1 - normZ * normZ)) * 0.095);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(radAtZ, 0.0085, 6, 20, Math.PI * 1.25),
      stripeMat
    );
    band.rotation.z = -Math.PI * 0.125;
    band.scale.set(0.9, 1.04, 0.85);
    band.position.set(0, 0.215, sz);
    tiger.add(band);
  }

  // Cabeça articulada com focinho, olhos azul-gelo, orelhas listradas e bochechas
  const headPivot = new THREE.Group();
  headPivot.userData.isTigerHead = true;
  headPivot.position.set(0, 0.265, 0.165);
  tiger.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.082, 18, 16), whiteFurMat);
  head.scale.set(1.04, 0.94, 1.02);
  head.castShadow = true;
  headPivot.add(head);

  // Focinho branco e nariz rosado
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 12), creamBellyMat);
  muzzle.scale.set(1.08, 0.78, 1.05);
  muzzle.position.set(0, -0.02, 0.068);
  headPivot.add(muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), pinkMat);
  nose.scale.set(1.25, 0.85, 0.8);
  nose.position.set(0, -0.006, 0.11);
  headPivot.add(nose);

  // Listras na testa e laterais da face
  for (let s = -1; s <= 1; s++) {
    const browStripe = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.007, 0.045), stripeMat);
    browStripe.position.set(s * 0.022, 0.056, 0.042);
    browStripe.rotation.x = 0.4;
    browStripe.rotation.y = s * -0.18;
    headPivot.add(browStripe);
  }

  for (const side of [-1, 1]) {
    // Orelhas felinas arredondadas
    const earOuter = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), whiteFurMat);
    earOuter.scale.set(0.95, 1.08, 0.55);
    earOuter.position.set(side * 0.058, 0.066, -0.006);
    earOuter.rotation.z = side * -0.35;
    const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), pinkMat);
    earInner.scale.set(0.9, 1.0, 0.4);
    earInner.position.set(side * 0.058, 0.065, 0.004);
    earInner.rotation.z = side * -0.35;
    const earBackStripe = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), stripeMat);
    earBackStripe.scale.set(0.85, 0.92, 0.42);
    earBackStripe.position.set(side * 0.058, 0.067, -0.014);
    earBackStripe.rotation.z = side * -0.35;
    headPivot.add(earOuter, earInner, earBackStripe);

    // Olhos azul-gelo brilhantes + pupila vertical
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 10), iceEyeMat);
    eye.position.set(side * 0.035, 0.015, 0.072);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 8), pupilMat);
    pupil.scale.set(0.65, 1.2, 0.7);
    pupil.position.set(side * 0.036, 0.015, 0.084);
    headPivot.add(eye, pupil);

    // Listras nas bochechas
    for (let c = 0; c < 2; c++) {
      const cheekStripe = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.008, 0.01), stripeMat);
      cheekStripe.position.set(side * 0.068, 0.005 - c * 0.02, 0.032);
      cheekStripe.rotation.y = side * 0.8;
      cheekStripe.rotation.z = side * -0.25;
      headPivot.add(cheekStripe);
    }
  }

  // 4 Patas articuladas com listras e almofadas (toque exato no solo y = 0)
  const legConfigs: Array<{ x: number; z: number; phase: number }> = [
    { x: -0.052, z: 0.1, phase: 0 },
    { x: 0.052, z: 0.1, phase: Math.PI },
    { x: -0.054, z: -0.1, phase: Math.PI },
    { x: 0.054, z: -0.1, phase: 0 },
  ];

  for (const cfg of legConfigs) {
    const legPivot = new THREE.Group();
    legPivot.userData.isTigerLegPhase = cfg.phase;
    legPivot.position.set(cfg.x, 0.165, cfg.z);

    const upperLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.021, 0.145, 12),
      whiteFurMat
    );
    upperLeg.position.y = -0.075;
    upperLeg.castShadow = true;

    const legBand1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.023, 0.005, 6, 14),
      stripeMat
    );
    legBand1.rotation.x = Math.PI / 2;
    legBand1.position.y = -0.048;

    const legBand2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.021, 0.005, 6, 14),
      stripeMat
    );
    legBand2.rotation.x = Math.PI / 2;
    legBand2.position.y = -0.098;

    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), whiteFurMat);
    paw.scale.set(1.0, 0.72, 1.25);
    paw.position.set(0, -0.148, 0.01);
    paw.castShadow = true;

    legPivot.add(upperLeg, legBand1, legBand2, paw);
    tiger.add(legPivot);
  }

  // Cauda anelada branca e preta
  const tailPivot = new THREE.Group();
  tailPivot.userData.isTigerTail = true;
  tailPivot.position.set(0, 0.22, -0.16);
  tailPivot.rotation.x = 0.35;
  tiger.add(tailPivot);

  for (let i = 0; i < 6; i++) {
    const segMat = i % 2 === 0 ? whiteFurMat : stripeMat;
    const radius = 0.018 - i * 0.0014;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.92, radius, 0.044, 10),
      segMat
    );
    seg.rotation.x = -Math.PI * 0.36 - i * 0.07;
    seg.position.set(0, -i * 0.014, -0.02 - i * 0.036);
    tailPivot.add(seg);
  }

  return tiger;
}

/**
 * Anima mascotes voadores e terrestres (Dragãozinho e Tigre Branco Lendário) sem alocações por frame.
 */
export function animateAvatarCompanions(root: THREE.Object3D, timeSec: number): void {
  root.traverse((obj) => {
    if (obj.userData?.isFlyingCompanion) {
      const bx = typeof obj.userData.baseX === 'number' ? obj.userData.baseX : 0.34;
      const by = typeof obj.userData.baseY === 'number' ? obj.userData.baseY : 0.24;
      const bz = typeof obj.userData.baseZ === 'number' ? obj.userData.baseZ : 0.08;
      obj.position.set(
        bx + Math.sin(timeSec * 1.8) * 0.028,
        by + Math.sin(timeSec * 3.2) * 0.055,
        bz + Math.cos(timeSec * 1.5) * 0.03,
      );
      obj.rotation.y = -0.25 + Math.sin(timeSec * 1.4) * 0.14;
      obj.rotation.z = Math.sin(timeSec * 2.4) * 0.08;
    } else if (obj.userData?.isFlyingDragonWing) {
      const side = obj.userData.isFlyingDragonWing as number;
      const flap = Math.sin(timeSec * 11.5) * 0.62;
      obj.rotation.z = side * flap;
      obj.rotation.y = side * Math.cos(timeSec * 11.5) * 0.18;
    } else if (obj.userData?.isWalkingCompanion) {
      const r = typeof obj.userData.orbitRadius === 'number' ? obj.userData.orbitRadius : 0.62;
      const speed = typeof obj.userData.orbitSpeed === 'number' ? obj.userData.orbitSpeed : 0.88;
      const angle = timeSec * speed;
      const strideBob = Math.abs(Math.sin(timeSec * 6.8)) * 0.014;
      obj.position.set(Math.cos(angle) * r, strideBob, Math.sin(angle) * r);
      obj.rotation.y = -angle;
    } else if (typeof obj.userData?.isTigerLegPhase === 'number') {
      obj.rotation.x = Math.sin(timeSec * 6.8 + obj.userData.isTigerLegPhase) * 0.42;
    } else if (obj.userData?.isTigerTail) {
      obj.rotation.y = Math.sin(timeSec * 4.2) * 0.34;
      obj.rotation.x = 0.35 + Math.cos(timeSec * 3.1) * 0.1;
    } else if (obj.userData?.isTigerHead) {
      obj.rotation.y = Math.sin(timeSec * 2.2) * 0.08;
      obj.rotation.x = Math.sin(timeSec * 6.8) * 0.05;
    }
  });
}

/**
 * Constrói miniatura isolada 3D de alta qualidade para cards da Starplaza, Mercado & Guarda-Roupa.
 */
export function buildStandaloneItem3D(
  item: ClothingItem,
  genderHint: AvatarGender = 'feminino'
): THREE.Group {
  const grp = new THREE.Group();
  const gender: AvatarGender = item.gender === 'unissex' ? genderHint : item.gender;
  const m = getAvatarMetrics(gender);

  if (item.category === 'cabelo') {
    const bustMat = new THREE.MeshStandardMaterial({ color: 0xebd8cb, roughness: 0.65 });
    const headBase = new THREE.Mesh(
      createSculptedHeadGeometry(m.headRadius, m.headHalfH, gender),
      bustMat
    );
    grp.add(headBase);
    const hair = buildHairGroup(item, m.headRadius, m.headHalfH, gender);
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
      const vamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.1, 8, 12), mat);
      vamp.rotation.x = Math.PI / 2;
      vamp.scale.set(1.05, 1.08, 0.65);
      vamp.position.set(0, -0.008, 0.01);
      const sole = new THREE.Mesh(createSculptedSoleGeometry(0.098, 0.21, 0.02), secMat);
      sole.position.y = -0.036;
      shoe.add(vamp, sole);
      if (sil === 'shoe_heels' || sil === 'shoe_sandals') {
        const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.008, 0.075, 10), trimMat);
        heel.position.set(0, -0.04, -0.075);
        shoe.add(heel);
      } else if (sil === 'shoe_boots') {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.046, 0.18, 16), mat);
        shaft.position.set(0, 0.08, -0.035);
        shoe.add(shaft);
      } else {
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.046, 0.07, 16), mat);
        collar.position.set(0, 0.035, -0.04);
        shoe.add(collar);
      }
      shoe.position.set(side * 0.072, 0.04, 0);
      shoe.rotation.y = side * -0.15;
      grp.add(shoe);
    }
    return grp;
  }

  if (item.category === 'acessorios') {
    if (sil === 'acc_bag') {
      const body = new THREE.Mesh(createPocketFlapGeometry(0.26, 0.2, 0.11), mat);
      const flap = new THREE.Mesh(createPocketFlapGeometry(0.265, 0.09, 0.116), secMat);
      flap.position.y = 0.055;
      const clasp = new THREE.Mesh(createBeveledBuckleGeometry(0.042, 0.032, 0.014), trimMat);
      clasp.position.set(0, 0.01, 0.065);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 18, Math.PI), trimMat);
      handle.position.y = 0.105;
      grp.add(body, flap, clasp, handle);
    } else if (sil === 'acc_crown') {
      const crown = buildOrnateCrownGroup(item, mat, trimMat, 0.13);
      crown.position.y = -0.025;
      grp.add(crown);
    } else if (sil === 'acc_scepter') {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.48, 12), trimMat);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), mat);
      orb.position.y = 0.26;
      grp.add(rod, orb);
      grp.rotation.z = -0.35;
    } else if (sil === 'acc_eyepatch') {
      const cup = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 18, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
        mat
      );
      cup.rotation.x = Math.PI / 2;
      cup.scale.set(1.1, 0.92, 0.52);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.012, 8, 26), trimMat);
      rim.scale.set(1.1, 0.92, 1);
      rim.position.z = 0.01;
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.026, 0),
        new THREE.MeshPhysicalMaterial({
          color: 0xe11d48,
          emissive: 0x9f1239,
          emissiveIntensity: 0.45,
          roughness: 0.12,
        })
      );
      gem.position.z = 0.036;
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.008, 6, 30, Math.PI), trimMat);
      strap.rotation.z = Math.PI * 0.15;
      strap.position.set(0.02, 0.04, -0.04);
      grp.add(cup, rim, gem, strap);
    } else if (sil === 'acc_watch') {
      const watch = buildGoldWatchWristGroup(mat, secMat, trimMat);
      watch.scale.setScalar(3.4);
      watch.rotation.y = Math.PI * 0.42;
      watch.rotation.x = 0.25;
      grp.add(watch);
    } else if (sil === 'acc_dragon') {
      const dragon = buildFlyingDragon3DGroup(item, mat, secMat, trimMat);
      dragon.scale.setScalar(1.45);
      dragon.rotation.y = 0.35;
      grp.add(dragon);
    } else if (sil === 'acc_white_tiger') {
      const tiger = buildWhiteTiger3DGroup(item, mat, secMat, trimMat);
      tiger.scale.setScalar(1.3);
      tiger.position.y = -0.18;
      tiger.rotation.y = 0.55;
      grp.add(tiger);
    } else if (sil === 'acc_hat') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.165, 0.04, 24), trimMat);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.155, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
        mat
      );
      dome.position.y = 0.018;
      grp.add(brim, dome);
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
      const h = sil === 'skirt_mini' ? 0.26 : sil === 'skirt_pleated' ? 0.28 : 0.42;
      const skirtGeo = createPleatedSkirtGeometry(
        0.12,
        sil === 'skirt_midi' ? 0.22 : 0.23,
        h,
        36,
        sil === 'skirt_pleated' ? 0.016 : 0.008
      );
      const skirt = new THREE.Mesh(skirtGeo, mat);
      skirt.material.side = THREE.DoubleSide;
      skirt.scale.set(1, 1, 0.77);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.04, 24), trimMat);
      band.scale.set(1, 1, 0.76);
      band.position.y = h * 0.5;
      grp.add(skirt, band);
    } else {
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.075, 20), trimMat);
      belt.scale.set(1, 1, 0.72);
      belt.position.y = 0.2;
      const buckle = new THREE.Mesh(createBeveledBuckleGeometry(0.044, 0.036, 0.01), trimMat);
      buckle.position.set(0, 0.2, 0.105);
      grp.add(belt, buckle);
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.068,
            sil === 'pants_wide' ? 0.078 : 0.05,
            sil === 'shorts' ? 0.22 : 0.44,
            16
          ),
          mat
        );
        leg.position.set(side * 0.072, sil === 'shorts' ? 0.07 : -0.02, 0);
        grp.add(leg);
      }
    }
    return grp;
  }

  // Blusas, Casacos & Vestidos em forma escultural estilizada com lapelas/botões
  const isDress = item.category === 'vestidos';
  const isCoat = item.category === 'casacos';
  const geo = createDrapedTorsoGeometry({
    radiiY: isDress
      ? [
          [0.22, -0.32],
          [0.1, -0.02],
          [0.14, 0.16],
          [0.15, 0.28],
          [0.065, 0.34],
        ]
      : [
          [isCoat ? 0.128 : 0.115, isCoat ? -0.1 : -0.04],
          [isCoat ? 0.118 : 0.105, 0.05],
          [isCoat ? 0.158 : 0.145, 0.22],
          [isCoat ? 0.18 : 0.17, 0.31],
          [0.07, 0.35],
        ],
    zScale: 0.74,
    radialSegs: 28,
    foldAmplitude: 0.0032,
    foldFrequency: 10,
    openFrontAngle: isCoat ? 0.62 : 0,
  });
  const body = new THREE.Mesh(geo, mat);
  body.material.side = THREE.DoubleSide;
  grp.add(body);

  if (isCoat) {
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(createBeveledLapelGeometry(0.052, 0.18, 0.012), secMat);
      lapel.position.set(side * 0.064, 0.21, 0.125);
      lapel.rotation.z = side * 0.14;
      grp.add(lapel);
    }
  }

  if (!isDress || sil === 'dress_blazer') {
    for (const side of [-1, 1]) {
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.034, 0.24, 14), mat);
      sl.position.set(side * 0.175, 0.16, 0);
      sl.rotation.z = side * -0.18;
      grp.add(sl);
    }
  }
  if (item.threeSpec?.metallicTrim || isCoat) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.012, 8, 22), trimMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.33;
    grp.add(collar);
  }
  return grp;
}
