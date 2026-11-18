import * as THREE from 'three';
import type { AvatarFaceCustomization, AvatarGender, SkinToneId } from '../types/game';
import { DEFAULT_FACE_CUSTOMIZATION } from '../types/game';
import { SKIN_TONES } from '../data/catalog';
import { getIrisCanvasTexture, getRadialShadowTexture } from './studioEngine';

export type Avatar3DPose = 'idle' | 'walk' | 'runway' | 'sit';

export interface AvatarRigMetrics {
  gender: AvatarGender;
  totalHeight: number;
  shoulderHalfW: number;
  chestW: number;
  chestDepth: number;
  waistW: number;
  hipW: number;
  hipX: number;
  torsoH: number;
  thighLen: number;
  calfLen: number;
  upperArmLen: number;
  forearmLen: number;
  /** Semi-largura horizontal da cabeça (eixo X) proporcional ao modelo 2D */
  headRadius: number;
  /** Semi-altura vertical da cabeça (eixo Y) proporcional ao modelo 2D */
  headHalfH: number;
}

export interface AvatarEyeBlinkRig {
  leftLidPivot: THREE.Group;
  rightLidPivot: THREE.Group;
  leftEyeInner: THREE.Group;
  rightEyeInner: THREE.Group;
  blinkPhaseOffset: number;
}

export interface Avatar3DRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftUpperArm: THREE.Group;
  rightUpperArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftThigh: THREE.Group;
  rightThigh: THREE.Group;
  leftCalf: THREE.Group;
  rightCalf: THREE.Group;
  leftFoot: THREE.Group;
  rightFoot: THREE.Group;
  eyeBlink: AvatarEyeBlinkRig;
  clothingLayer: THREE.Group;
  attachedParts: THREE.Object3D[];
  sockets: {
    head: THREE.Group;
    eyes: THREE.Group;
    neck: THREE.Group;
    chest: THREE.Group;
    waist: THREE.Group;
    pelvis: THREE.Group;
    handR: THREE.Group;
    wristL: THREE.Group;
    wristR: THREE.Group;
    leftFoot: THREE.Group;
    rightFoot: THREE.Group;
  };
  metrics: AvatarRigMetrics;
  skinTone: SkinToneId;
}

/**
 * Proporções anatômicas idênticas ao avatar 2D (MeDollSvg viewBox 280x520):
 * - Cabeça oval esculpida (largura:altura ~ 0.70:1)
 * - Masculino: ombros largos em V, tórax definido, cintura média, braços paralelos
 * - Feminino: ombros delicados, cintura fina marcada, quadril curvilíneo e braços em A-frame
 * - Neutro: equilíbrio proporcional entre os dois
 */
export function getAvatarMetrics(gender: AvatarGender): AvatarRigMetrics {
  if (gender === 'masculino') {
    return {
      gender,
      totalHeight: 1.62,
      shoulderHalfW: 0.184,
      chestW: 0.164,
      chestDepth: 0.104,
      waistW: 0.122,
      hipW: 0.120,
      hipX: 0.078,
      torsoH: 0.405,
      thighLen: 0.355,
      calfLen: 0.315,
      upperArmLen: 0.192,
      forearmLen: 0.184,
      headRadius: 0.104,
      headHalfH: 0.144,
    };
  }
  if (gender === 'neutro') {
    return {
      gender,
      totalHeight: 1.60,
      shoulderHalfW: 0.158,
      chestW: 0.142,
      chestDepth: 0.098,
      waistW: 0.106,
      hipW: 0.134,
      hipX: 0.077,
      torsoH: 0.394,
      thighLen: 0.352,
      calfLen: 0.312,
      upperArmLen: 0.188,
      forearmLen: 0.180,
      headRadius: 0.098,
      headHalfH: 0.136,
    };
  }
  return {
    gender: 'feminino',
    totalHeight: 1.56,
    shoulderHalfW: 0.134,
    chestW: 0.119,
    chestDepth: 0.094,
    waistW: 0.087,
    hipW: 0.146,
    hipX: 0.076,
    torsoH: 0.382,
    thighLen: 0.348,
    calfLen: 0.308,
    upperArmLen: 0.184,
    forearmLen: 0.174,
    headRadius: 0.093,
    headHalfH: 0.130,
  };
}

const HEAD_PROFILE_NY = [-1.0, -0.94, -0.78, -0.52, -0.20, 0.12, 0.44, 0.74, 0.93, 1.0];
const HEAD_PROFILE_R_MALE = [0.0, 0.36, 0.68, 0.89, 0.98, 1.0, 0.98, 0.85, 0.56, 0.0];
const HEAD_PROFILE_R_FEM = [0.0, 0.28, 0.56, 0.80, 0.96, 1.0, 0.98, 0.85, 0.56, 0.0];

function sampleHeadProfileRadiusRatio(ny: number, gender: AvatarGender): number {
  const clamped = Math.max(-1, Math.min(1, ny));
  const table = gender === 'masculino' ? HEAD_PROFILE_R_MALE : HEAD_PROFILE_R_FEM;
  for (let i = 0; i < HEAD_PROFILE_NY.length - 1; i++) {
    const y0 = HEAD_PROFILE_NY[i];
    const y1 = HEAD_PROFILE_NY[i + 1];
    if (clamped >= y0 && clamped <= y1) {
      const t = (clamped - y0) / (y1 - y0);
      return THREE.MathUtils.lerp(table[i], table[i + 1], t);
    }
  }
  return 0;
}

/**
 * Calcula um ponto exato sobre (ou deslocado externamente da) superfície do crânio 3D.
 * phi = 0 é frente (+Z), ±PI/2 laterais (±X), ±PI nuca (-Z).
 * ny ∈ [-1, +1] vai do queixo (-1) ao topo do crânio (+1).
 */
export function sampleHeadSurfacePoint(
  ny: number,
  phi: number,
  headRadius: number,
  headHalfH: number,
  gender: AvatarGender,
  radialOffset = 0,
  target = new THREE.Vector3()
): THREE.Vector3 {
  const isMale = gender === 'masculino';
  const isNeutral = gender === 'neutro';
  const baseRatio = sampleHeadProfileRadiusRatio(ny, gender);
  const horizFactor = Math.sqrt(Math.max(0, 1 - ny * ny));
  const r = Math.max(0, baseRatio * headRadius + radialOffset * horizFactor);

  let x = r * Math.sin(phi);
  const y = ny * headHalfH + Math.max(0, ny) * radialOffset;
  let z = r * Math.cos(phi);

  if (z >= 0) {
    z *= 0.88;
    if (ny < -0.15 && ny > -0.95) {
      z += 0.005 * Math.max(0, 1 - Math.abs(x) / headRadius);
    }
  } else {
    z *= 1.02;
  }

  if (ny < -0.18 && ny > -0.78) {
    const jawFactor = isMale ? 1.06 : isNeutral ? 1.0 : 0.94;
    x *= jawFactor;
  }

  return target.set(x, y, z);
}

/**
 * Gera geometria de cabeça esculpida fiel ao contorno 2D de MeDollSvg:
 * - Masculino: fronte firme, mandíbula angular na metade inferior e queixo definido
 * - Feminino/Neutro: oval delicado com afunilamento suave até o queixo
 */
export function createSculptedHeadGeometry(
  headRadius: number,
  headHalfH: number,
  gender: AvatarGender
): THREE.BufferGeometry {
  const isMale = gender === 'masculino';
  const isNeutral = gender === 'neutro';
  const rTable = isMale ? HEAD_PROFILE_R_MALE : HEAD_PROFILE_R_FEM;

  // Perfil vertical de baixo (queixo) para cima (topo do crânio)
  const profile: THREE.Vector2[] = HEAD_PROFILE_NY.map(
    (ny, idx) => new THREE.Vector2(headRadius * rTable[idx], headHalfH * ny)
  );

  const geo = new THREE.LatheGeometry(profile, 32);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);

    const ny = y / headHalfH; // -1 (queixo) a +1 (topo)

    // Profundidade antero-posterior natural do crânio (Z ligeiramente mais longo na parte de trás, face levemente plana)
    if (z >= 0) {
      z *= 0.88;
      // Leve projeção suave do plano facial médio (maçãs do rosto e queixo)
      if (ny < -0.15 && ny > -0.95) {
        z += 0.005 * Math.max(0, 1 - Math.abs(x) / headRadius);
      }
    } else {
      z *= 1.02;
    }

    // Mandíbula masculina levemente mais angulosa nos lados inferiores; feminina oval suave
    if (ny < -0.18 && ny > -0.78) {
      const jawFactor = isMale ? 1.06 : isNeutral ? 1.0 : 0.94;
      x *= jawFactor;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Cria geometria 3D para lábios idêntica ao desenho 2D (arco do cupido feminino / lábio fechado masculino).
 */
function createLipsMesh(
  isMale: boolean,
  isNeutral: boolean,
  lipMat: THREE.Material,
  creaseMat: THREE.Material,
  headHalfH: number
): THREE.Group {
  const grp = new THREE.Group();
  const w = isMale ? 0.0245 : 0.024;

  const lipShape = new THREE.Shape();
  if (isMale) {
    // M132.5,107.5 Q140,105.5 147.5,107.5 Q144,111.5 140,111.5 Q136,111.5 132.5,107.5 Z
    lipShape.moveTo(-w, 0);
    lipShape.quadraticCurveTo(0, 0.0048, w, 0);
    lipShape.quadraticCurveTo(w * 0.52, -0.0075, 0, -0.0078);
    lipShape.quadraticCurveTo(-w * 0.52, -0.0075, -w, 0);
  } else {
    // Arco do cupido acentuado + lábio inferior cheio: M132,107 Q136,104.2 140,106.2 Q144,104.2 148,107 Q144,112.4 140,112.4 Q136,112.4 132,107 Z
    lipShape.moveTo(-w, 0);
    lipShape.quadraticCurveTo(-w * 0.5, 0.0075, 0, 0.0028);
    lipShape.quadraticCurveTo(w * 0.5, 0.0075, w, 0);
    lipShape.quadraticCurveTo(w * 0.52, -0.0098, 0, -0.0102);
    lipShape.quadraticCurveTo(-w * 0.52, -0.0098, -w, 0);
  }

  const lipGeo = new THREE.ExtrudeGeometry(lipShape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.0018,
    bevelSegments: 3,
    curveSegments: 14,
  });
  lipGeo.center();
  const lipMesh = new THREE.Mesh(lipGeo, lipMat);
  grp.add(lipMesh);

  // Linha sutil de encontro dos lábios (M133,107.5 Q140,109 147,107.5)
  const creaseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-w * 0.92, 0.0004, 0.0034),
    new THREE.Vector3(0, -0.0018, 0.0046),
    new THREE.Vector3(w * 0.92, 0.0004, 0.0034),
  ]);
  const creaseMesh = new THREE.Mesh(new THREE.TubeGeometry(creaseCurve, 12, 0.00085, 6, false), creaseMat);
  grp.add(creaseMesh);

  // Ponto de brilho suave no lábio inferior feminino/neutro
  if (!isMale) {
    const sheenMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.0036, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: isNeutral ? 0.35 : 0.5 })
    );
    sheenMesh.scale.set(2.1, 0.55, 0.45);
    sheenMesh.position.set(0, -0.0048, 0.0038);
    grp.add(sheenMesh);
  }

  // Posiciona na curvatura facial exata de y ≈ 108/520 no 2D (-0.54 * headHalfH)
  grp.position.set(0, -headHalfH * 0.52, 0);
  return grp;
}

/**
 * Constrói o avatar 3D idêntico ao modelo 2D (MeDollSvg), com olhos amendoados,
 * pálpebras com animação contínua de piscar, nariz fino, lábios com arco do cupido,
 * orelhas esculpidas, mãos de 5 dedos, pés descalços com dedos e cueca/biquíni padrão.
 */
export function createAvatar3DRig(opts: {
  avatarGender: AvatarGender;
  skinTone: SkinToneId;
  faceCustomization?: AvatarFaceCustomization;
  withShadowDisc?: boolean;
}): Avatar3DRig {
  const m = getAvatarMetrics(opts.avatarGender);
  const skinInfo = SKIN_TONES.find((s) => s.id === opts.skinTone) || SKIN_TONES[1];
  const fc = opts.faceCustomization || DEFAULT_FACE_CUSTOMIZATION;
  const isMale = opts.avatarGender === 'masculino';
  const isFemale = opts.avatarGender === 'feminino';
  const isNeutral = opts.avatarGender === 'neutro';

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(skinInfo.base),
    roughness: 0.54,
    metalness: 0.0,
    sheen: 0.32,
    sheenRoughness: 0.48,
    sheenColor: new THREE.Color(skinInfo.blush),
  });

  const skinShadowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skinInfo.shadow),
    roughness: 0.62,
    metalness: 0.0,
  });

  const underwearMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#232732'),
    roughness: 0.68,
    metalness: 0.04,
  });

  const waistbandMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E5E7EB'),
    roughness: 0.5,
    metalness: 0.06,
  });

  const bikiniTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3B4252'),
    roughness: 0.54,
    metalness: 0.08,
  });

  const root = new THREE.Group();
  root.name = 'Avatar3DRoot';

  if (opts.withShadowDisc !== false) {
    const shadowGeo = new THREE.PlaneGeometry(0.68, 0.68);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: getRadialShadowTexture(),
      transparent: true,
      depthWrite: false,
    });
    const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.004;
    root.add(shadowDisc);
  }

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const footH = 0.056;
  const legHipY = m.calfLen + m.thighLen + footH;

  // =========================================================================
  // 1. PÉLVIS + CUECA PADRÃO (Masculino) / CALCINHA DE BIQUÍNI (Feminino/Neutro)
  // =========================================================================
  const pelvis = new THREE.Group();
  pelvis.position.set(0, legHipY, 0);
  bodyPivot.add(pelvis);

  if (isMale) {
    const pelvisSkinTop = new THREE.Mesh(
      new THREE.CylinderGeometry(m.waistW * 0.96, m.waistW * 0.98, 0.036, 22),
      skinMat
    );
    pelvisSkinTop.scale.set(1, 1, 0.66);
    pelvisSkinTop.position.y = 0.092;
    pelvis.add(pelvisSkinTop);

    const cuecaPts = [
      new THREE.Vector2(m.hipW * 0.78, -0.025),
      new THREE.Vector2(m.hipW * 0.97, 0.015),
      new THREE.Vector2(m.waistW * 0.99, 0.085),
    ];
    const cuecaGeo = new THREE.LatheGeometry(cuecaPts, 24);
    cuecaGeo.scale(1, 1, 0.68);
    const cuecaMesh = new THREE.Mesh(cuecaGeo, underwearMat);
    cuecaMesh.castShadow = true;
    pelvis.add(cuecaMesh);

    const cuecaWaistband = new THREE.Mesh(
      new THREE.CylinderGeometry(m.waistW * 1.01, m.waistW * 1.01, 0.024, 24),
      waistbandMat
    );
    cuecaWaistband.scale.set(1, 1, 0.69);
    cuecaWaistband.position.y = 0.078;
    pelvis.add(cuecaWaistband);
  } else {
    // Cintura alta em pele + calcinha cavada do biquíni (#232732 + #3B4252)
    const pelvisPts = [
      new THREE.Vector2(m.hipW * 0.72, -0.02),
      new THREE.Vector2(m.hipW * 0.98, 0.018),
      new THREE.Vector2(m.waistW * 1.01, 0.092),
    ];
    const pelvisGeo = new THREE.LatheGeometry(pelvisPts, 24);
    pelvisGeo.scale(1, 1, 0.67);
    const pelvisSkin = new THREE.Mesh(pelvisGeo, skinMat);
    pelvisSkin.castShadow = true;
    pelvis.add(pelvisSkin);

    const bikiniBottomPts = [
      new THREE.Vector2(m.hipW * 0.75, -0.022),
      new THREE.Vector2(m.hipW * 0.995, 0.016),
      new THREE.Vector2(m.hipW * 0.96, 0.048),
    ];
    const bikiniBottomGeo = new THREE.LatheGeometry(bikiniBottomPts, 24);
    bikiniBottomGeo.scale(1, 1, 0.69);
    const bikiniBottom = new THREE.Mesh(bikiniBottomGeo, underwearMat);
    bikiniBottom.castShadow = true;
    pelvis.add(bikiniBottom);

    const bikiniHipStrap = new THREE.Mesh(
      new THREE.CylinderGeometry(m.hipW * 0.975, m.hipW * 0.975, 0.012, 24),
      bikiniTrimMat
    );
    bikiniHipStrap.scale.set(1, 1, 0.70);
    bikiniHipStrap.position.y = 0.048;
    pelvis.add(bikiniHipStrap);
  }

  // =========================================================================
  // 2. TORSO ANATÔMICO (V-Taper Masculino / Ampulheta Feminina) + BIQUÍNI TOP
  // =========================================================================
  const torso = new THREE.Group();
  torso.position.set(0, 0.085, 0);
  pelvis.add(torso);

  const torsoPts: THREE.Vector2[] = isMale
    ? [
        new THREE.Vector2(m.waistW * 0.96, 0.0),
        new THREE.Vector2(m.waistW * 0.99, m.torsoH * 0.24),
        new THREE.Vector2(m.chestW * 0.98, m.torsoH * 0.58),
        new THREE.Vector2(m.shoulderHalfW * 0.89, m.torsoH * 0.88),
        new THREE.Vector2(0.052, m.torsoH),
      ]
    : isNeutral
      ? [
          new THREE.Vector2(m.waistW * 1.0, 0.0),
          new THREE.Vector2(m.waistW * 0.95, m.torsoH * 0.22),
          new THREE.Vector2(m.chestW * 1.0, m.torsoH * 0.60),
          new THREE.Vector2(m.shoulderHalfW * 0.86, m.torsoH * 0.88),
          new THREE.Vector2(0.042, m.torsoH),
        ]
      : [
          new THREE.Vector2(m.waistW * 1.01, 0.0),
          new THREE.Vector2(m.waistW * 0.92, m.torsoH * 0.22),
          new THREE.Vector2(m.chestW * 1.01, m.torsoH * 0.60),
          new THREE.Vector2(m.shoulderHalfW * 0.86, m.torsoH * 0.88),
          new THREE.Vector2(0.034, m.torsoH),
        ];

  const torsoGeo = new THREE.LatheGeometry(torsoPts, 26);
  torsoGeo.scale(1, 1, isMale ? 0.64 : 0.66);
  const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torso.add(torsoMesh);

  // Clavículas suaves marcadas como no 2D (M112,146 Q128,151 138,147)
  for (const side of [-1, 1]) {
    const clavCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.015, m.torsoH * 0.91, m.chestDepth * 0.44),
      new THREE.Vector3(side * m.shoulderHalfW * 0.42, m.torsoH * 0.90, m.chestDepth * 0.36),
      new THREE.Vector3(side * m.shoulderHalfW * 0.72, m.torsoH * 0.92, m.chestDepth * 0.22),
    ]);
    const clav = new THREE.Mesh(
      new THREE.TubeGeometry(clavCurve, 10, 0.0022, 6, false),
      skinShadowMat
    );
    torso.add(clav);
  }

  if (isMale) {
    // Peitoral masculino sutil em pele natural (como linhas Q123,182 no 2D)
    const pecL = new THREE.Mesh(new THREE.SphereGeometry(0.046, 16, 12), skinMat);
    pecL.position.set(-0.050, m.torsoH * 0.65, m.chestDepth * 0.43);
    pecL.scale.set(1.16, 0.82, 0.54);
    const pecR = pecL.clone();
    pecR.position.x = 0.050;
    torso.add(pecL, pecR);
  } else {
    // Parte superior do biquíni idêntica ao 2D (bojos triangulares + faixa dorsal + alças finas até os ombros)
    if (isFemale) {
      const bustSkinL = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 14), skinMat);
      bustSkinL.position.set(-0.040, m.torsoH * 0.59, m.chestDepth * 0.42);
      bustSkinL.scale.set(1, 0.88, 0.82);
      const bustSkinR = bustSkinL.clone();
      bustSkinR.position.x = 0.040;
      torso.add(bustSkinL, bustSkinR);
    }

    const bikiniCupL = new THREE.Mesh(new THREE.SphereGeometry(0.0445, 16, 14), underwearMat);
    bikiniCupL.position.set(-0.040, m.torsoH * 0.59, m.chestDepth * 0.45);
    bikiniCupL.scale.set(0.98, 0.90, 0.84);
    const bikiniCupR = bikiniCupL.clone();
    bikiniCupR.position.x = 0.040;

    const bikiniChestBand = new THREE.Mesh(
      new THREE.CylinderGeometry(m.chestW * 0.99, m.chestW * 0.97, 0.032, 24),
      underwearMat
    );
    bikiniChestBand.scale.set(1, 1, 0.69);
    bikiniChestBand.position.set(0, m.torsoH * 0.55, 0);

    const strapLen = m.torsoH * 0.36;
    const strapL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, strapLen, 8),
      bikiniTrimMat
    );
    strapL.position.set(-0.040, m.torsoH * 0.77, m.chestDepth * 0.32);
    strapL.rotation.x = -0.24;
    strapL.rotation.z = -0.14;
    const strapR = strapL.clone();
    strapR.position.x = 0.040;
    strapR.rotation.z = 0.14;

    torso.add(bikiniCupL, bikiniCupR, bikiniChestBand, strapL, strapR);
  }

  // Ombros em pele
  const shoulderCapR = isMale ? 0.042 : isNeutral ? 0.035 : 0.030;
  const shoulderCapL = new THREE.Mesh(new THREE.SphereGeometry(shoulderCapR, 14, 12), skinMat);
  shoulderCapL.position.set(-m.shoulderHalfW * 0.92, m.torsoH * 0.87, 0);
  const shoulderCapRMesh = shoulderCapL.clone();
  shoulderCapRMesh.position.x = m.shoulderHalfW * 0.92;
  torso.add(shoulderCapL, shoulderCapRMesh);

  // =========================================================================
  // 3. PESCOÇO & CABEÇA ESCULPIDA (PROPORÇÃO IDÊNTICA AO MODELO 2D)
  // =========================================================================
  const neck = new THREE.Group();
  neck.position.set(0, m.torsoH - 0.008, 0);
  torso.add(neck);

  const neckR = isMale ? 0.046 : isNeutral ? 0.036 : 0.029;
  const neckH = isMale ? 0.070 : 0.074;
  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(neckR * 0.92, neckR * 1.06, neckH, 18),
    skinMat
  );
  neckMesh.position.y = neckH * 0.48;
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.set(0, m.headHalfH * 0.95 + neckH * 0.62, 0.004);
  neck.add(head);

  const headGeo = createSculptedHeadGeometry(m.headRadius, m.headHalfH, opts.avatarGender);
  const skull = new THREE.Mesh(headGeo, skinMat);
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);

  // Orelhas esculpidas na altura média da cabeça (cy = 89/520 no 2D)
  const earL = new THREE.Mesh(new THREE.SphereGeometry(m.headRadius * 0.19, 14, 12), skinMat);
  earL.scale.set(0.42, 1.38, 0.68);
  earL.position.set(-m.headRadius * 0.96, -m.headHalfH * 0.06, -0.008);
  earL.rotation.y = 0.22;
  const earR = earL.clone();
  earR.position.x = m.headRadius * 0.96;
  earR.rotation.y = -0.22;
  head.add(earL, earR);

  // =========================================================================
  // 4. ROSTO 3D IDÊNTICO AO 2D (Olhos amendoados + Piscar, Nariz fino, Boca com Arco do Cupido)
  // =========================================================================
  const faceZ = m.headRadius * 0.77;
  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, 0, faceZ);
  head.add(faceGroup);

  const scleraMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.14,
    clearcoat: 0.6,
  });
  const irisMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(fc.eyeColor),
    map: getIrisCanvasTexture(opts.avatarGender),
    roughness: 0.12,
    clearcoat: 0.95,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x141210 });
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x181412, roughness: 0.55 });
  const browMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(fc.eyebrowColor || '#2a1d17'),
    roughness: 0.65,
  });
  const creaseMat = new THREE.MeshStandardMaterial({ color: 0x2b231f, roughness: 0.72 });

  const blushMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(skinInfo.blush),
    transparent: true,
    opacity: isFemale ? 0.34 : isNeutral ? 0.25 : 0.16,
    depthWrite: false,
  });

  // Cor labial idêntica ao 2D ou customizada pelo jogador
  const lipColor = fc.mouthColor || (isMale ? skinInfo.shadow : isNeutral ? '#BC707B' : '#C65B6F');
  const lipMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(lipColor),
    roughness: isMale ? 0.55 : 0.24,
    clearcoat: isMale ? 0.12 : 0.68,
    clearcoatRoughness: 0.18,
  });

  // Posição & tamanho dos olhos com ajustes de espaçamento (X), altura (Y) e escala
  const eyeSpacing = m.headRadius * (isMale ? 0.45 : 0.48);
  const eyeOffsetX = (fc.eyesPosX ?? 0) * 0.00075;
  const eyeOffsetY = (fc.eyesPosY ?? 0) * 0.00075;
  const eyeScaleFactor = Math.max(0.5, Math.min(1.8, fc.eyesScale ?? 1.0));
  const adjustedEyeSpacing = Math.max(0.015, eyeSpacing + eyeOffsetX);
  const eyeY = m.headHalfH * 0.08 + eyeOffsetY;
  const eyeBaseR = m.headRadius * 0.21;

  const buildEyeWithBlink = (side: -1 | 1) => {
    const eyeAssembly = new THREE.Group();
    eyeAssembly.position.set(side * adjustedEyeSpacing, eyeY, -0.002);
    eyeAssembly.scale.set(eyeScaleFactor, eyeScaleFactor, eyeScaleFactor);
    eyeAssembly.rotation.y = side * (fc.eyeStyle === 'marcado' ? 0.22 : 0.16);

    // Grupo interno da esclera + íris + pupila + brilho (pressiona levemente no piscar)
    const eyeInner = new THREE.Group();
    eyeAssembly.add(eyeInner);

    // Esclera em formato amendoado (larga na horizontal, delicada na vertical)
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(eyeBaseR, 20, 14), scleraMat);
    if (fc.eyeStyle === 'grande') sclera.scale.set(1.35, 0.88, 0.44);
    else if (fc.eyeStyle === 'marcado') sclera.scale.set(1.26, 0.64, 0.42);
    else if (fc.eyeStyle === 'suave') sclera.scale.set(1.18, 0.78, 0.42);
    else sclera.scale.set(1.22, 0.72, 0.42);
    eyeInner.add(sclera);

    // Íris texturizada fiel ao gradiente radial 2D
    const iris = new THREE.Mesh(new THREE.SphereGeometry(eyeBaseR * 0.62, 18, 12), irisMat);
    iris.scale.set(1.0, 1.02, 0.38);
    iris.position.set(-side * 0.0005, 0, eyeBaseR * 0.30);
    eyeInner.add(iris);

    // Pupila escura (#141210)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeBaseR * 0.30, 14, 10), pupilMat);
    pupil.scale.set(1, 1, 0.36);
    pupil.position.set(-side * 0.0005, 0, eyeBaseR * 0.41);
    eyeInner.add(pupil);

    // Reflexo branco característico superior direito (cx=128.7, cy=81.6)
    const glint = new THREE.Mesh(new THREE.SphereGeometry(eyeBaseR * 0.19, 8, 8), highlightMat);
    glint.scale.set(1, 1, 0.45);
    glint.position.set(eyeBaseR * 0.24, eyeBaseR * 0.22, eyeBaseR * 0.45);
    eyeInner.add(glint);

    // Contorno sutil inferior da pálpebra
    const lowerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-eyeBaseR * 1.15, -0.0005, eyeBaseR * 0.16),
      new THREE.Vector3(0, -eyeBaseR * 0.56, eyeBaseR * 0.40),
      new THREE.Vector3(eyeBaseR * 1.15, -0.0005, eyeBaseR * 0.16),
    ]);
    const lowerRim = new THREE.Mesh(
      new THREE.TubeGeometry(lowerCurve, 14, 0.00075, 6, false),
      creaseMat
    );
    eyeAssembly.add(lowerRim);

    // Dobra da pálpebra superior acima do olho (M121,79.5 Q127,76.8 133,79.8)
    const creaseArc = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-eyeBaseR * 1.04, eyeBaseR * 0.62, eyeBaseR * 0.20),
      new THREE.Vector3(0, eyeBaseR * 0.94, eyeBaseR * 0.42),
      new THREE.Vector3(eyeBaseR * 1.04, eyeBaseR * 0.62, eyeBaseR * 0.20),
    ]);
    const eyeCrease = new THREE.Mesh(
      new THREE.TubeGeometry(creaseArc, 14, 0.0008, 6, false),
      skinShadowMat
    );
    eyeAssembly.add(eyeCrease);

    // Pivô da Pálpebra Superior Animada (Piscar realista em 3D)
    const upperLidPivot = new THREE.Group();
    eyeAssembly.add(upperLidPivot);

    // Concha cutânea curva da pálpebra superior (hemisfério frontal limpo)
    const upperLidCap = new THREE.Mesh(
      new THREE.SphereGeometry(eyeBaseR * 1.09, 18, 12, 0, Math.PI, 0, Math.PI * 0.50),
      skinMat
    );
    upperLidCap.scale.set(1.24, 0.78, 0.47);
    upperLidCap.rotation.x = Math.PI * 0.04;
    upperLidPivot.add(upperLidCap);

    // Delineado / Cílio superior acompanhando a borda inferior da pálpebra móvel
    const lashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-eyeBaseR * 1.18, 0.001, eyeBaseR * 0.18),
      new THREE.Vector3(0, eyeBaseR * 0.24, eyeBaseR * 0.47),
      new THREE.Vector3(eyeBaseR * 1.18, 0.001, eyeBaseR * 0.18),
    ]);
    const upperLash = new THREE.Mesh(
      new THREE.TubeGeometry(lashCurve, 16, isMale ? 0.0016 : 0.0021, 6, false),
      lashMat
    );
    upperLidPivot.add(upperLash);

    // Cílios externos delicados femininos / neutros (M120,82.2 L117.8,79.8)
    if (!isMale) {
      for (let w = 0; w < 2; w++) {
        const lashFlick = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.00075, 0.0055, 3, 5),
          lashMat
        );
        lashFlick.position.set(
          side * (eyeBaseR * (1.14 - w * 0.22)),
          eyeBaseR * (0.16 + w * 0.18),
          eyeBaseR * 0.24
        );
        lashFlick.rotation.z = side * -(0.65 + w * 0.2);
        upperLidPivot.add(lashFlick);
      }
    }

    // Posição aberta padrão da pálpebra superior
    upperLidPivot.rotation.x = -0.62;
    faceGroup.add(eyeAssembly);

    // Sobrancelha estilizada acompanhando o estilo escolhido e transformações
    const browOffsetX = (fc.eyebrowsPosX ?? 0) * 0.00075;
    const browOffsetY = (fc.eyebrowsPosY ?? 0) * 0.00075;
    const browScaleFactor = Math.max(0.5, Math.min(1.8, fc.eyebrowsScale ?? 1.0));

    const browRadius =
      (fc.eyebrowStyle === 'fina'
        ? 0.0014
        : fc.eyebrowStyle === 'grossa'
          ? 0.0035
          : fc.eyebrowStyle === 'reta'
            ? 0.0020
            : isMale
              ? 0.0032
              : 0.0020) * browScaleFactor;

    const browBaseY = m.headHalfH * (isMale ? 0.31 : 0.34);
    const browY = browBaseY + browOffsetY;
    const browX = adjustedEyeSpacing + browOffsetX;
    const browHalfWidth = 0.018 * browScaleFactor;

    const browPoints =
      fc.eyebrowStyle === 'reta'
        ? [
            new THREE.Vector3(side * (browX - browHalfWidth), browY, -0.002),
            new THREE.Vector3(side * browX, browY, 0.004),
            new THREE.Vector3(side * (browX + browHalfWidth), browY, -0.004),
          ]
        : [
            new THREE.Vector3(side * (browX - browHalfWidth), browY - 0.003 * browScaleFactor, -0.002),
            new THREE.Vector3(side * browX, browY + (isMale ? 0.004 : 0.006) * browScaleFactor, 0.004),
            new THREE.Vector3(side * (browX + browHalfWidth), browY - 0.003 * browScaleFactor, -0.006),
          ];
    const browArc = new THREE.CatmullRomCurve3(browPoints);
    const brow = new THREE.Mesh(new THREE.TubeGeometry(browArc, 14, browRadius, 6, false), browMat);
    faceGroup.add(brow);

    // Blush suave nas maçãs do rosto (cy=95 -> -0.21 * headHalfH)
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), blushMat);
    cheek.scale.set(1.25, 0.68, 0.28);
    cheek.position.set(side * (m.headRadius * 0.56), -m.headHalfH * 0.20, -0.008);
    cheek.rotation.y = side * 0.28;
    faceGroup.add(cheek);

    return { upperLidPivot, eyeInner };
  };

  const leftEyeRig = buildEyeWithBlink(-1);
  const rightEyeRig = buildEyeWithBlink(1);

  // Nariz delicado idêntico ao 2D com estilo personalizado e ajustes posicionais/escala
  const noseOffsetX = (fc.nosePosX ?? 0) * 0.0006;
  const noseOffsetY = (fc.nosePosY ?? 0) * 0.00075;
  const noseScaleFactor = Math.max(0.5, Math.min(1.8, fc.noseScale ?? 1.0));

  const noseGroup = new THREE.Group();
  noseGroup.position.set(noseOffsetX, -m.headHalfH * 0.08 + noseOffsetY, 0.011);
  noseGroup.scale.set(noseScaleFactor, noseScaleFactor, noseScaleFactor);

  const noseBridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, m.headHalfH * 0.12, 0.001),
    new THREE.Vector3(0, 0, 0.0065),
    new THREE.Vector3(0, -m.headHalfH * 0.13, 0.0105),
  ]);
  const noseBridge = new THREE.Mesh(
    new THREE.TubeGeometry(noseBridgeCurve, 10, 0.0032, 8, false),
    skinMat
  );
  if (fc.noseStyle === 'delicado') {
    noseBridge.scale.set(0.68, 0.95, 0.95);
  } else if (fc.noseStyle === 'reto') {
    noseBridge.scale.set(0.85, 1.05, 1.15);
  } else if (fc.noseStyle === 'arredondado') {
    noseBridge.scale.set(0.98, 1.0, 1.20);
  } else {
    noseBridge.scale.set(0.75, 1, 1.05);
  }

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 12, 10), skinMat);
  if (fc.noseStyle === 'delicado') {
    noseTip.scale.set(0.95, 0.70, 0.90);
  } else if (fc.noseStyle === 'arredondado') {
    noseTip.scale.set(1.35, 0.92, 1.15);
  } else {
    noseTip.scale.set(1.16, 0.80, 1.02);
  }
  noseTip.position.set(0, -m.headHalfH * 0.145, 0.010);

  // Sombra delicada sob a ponta do nariz (M137.5,96.2 Q140,97.4 142.8,96)
  const noseShadowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0048, -m.headHalfH * 0.165, 0.0065),
    new THREE.Vector3(0, -m.headHalfH * 0.178, 0.0092),
    new THREE.Vector3(0.0048, -m.headHalfH * 0.165, 0.0065),
  ]);
  const noseUnderShadow = new THREE.Mesh(
    new THREE.TubeGeometry(noseShadowCurve, 8, 0.00085, 6, false),
    skinShadowMat
  );
  noseGroup.add(noseBridge, noseTip, noseUnderShadow);
  faceGroup.add(noseGroup);

  // Lábios esculpidos com estilo personalizado e ajustes posicionais/escala
  const mouthOffsetX = (fc.mouthPosX ?? 0) * 0.0006;
  const mouthOffsetY = (fc.mouthPosY ?? 0) * 0.00075;
  const mouthScaleFactor = Math.max(0.5, Math.min(1.8, fc.mouthScale ?? 1.0));

  const lipsGroup = createLipsMesh(isMale, isNeutral, lipMat, creaseMat, m.headHalfH);
  if (fc.mouthStyle === 'cheia') lipsGroup.scale.set(1, 1.22, 1);
  else if (fc.mouthStyle === 'delicada') lipsGroup.scale.set(0.90, 0.78, 0.90);
  else if (fc.mouthStyle === 'natural') lipsGroup.scale.set(0.98, 0.92, 0.95);
  else lipsGroup.scale.set(1, 1, 1);

  lipsGroup.scale.multiplyScalar(mouthScaleFactor);
  lipsGroup.position.x += mouthOffsetX;
  lipsGroup.position.y += mouthOffsetY;
  lipsGroup.position.z = isMale ? -0.001 : -0.0055;
  faceGroup.add(lipsGroup);

  // =========================================================================
  // 5. BRAÇOS E MÃOS ARTICULADAS COM 5 DEDOS (Pose paralela Masc / A-frame Fem)
  // =========================================================================
  const armR = isMale ? 0.036 : isNeutral ? 0.030 : 0.025;
  const buildArm = (side: -1 | 1) => {
    const upper = new THREE.Group();
    upper.position.set(side * (m.shoulderHalfW + 0.004), m.torsoH * 0.87, 0);
    torso.add(upper);

    // Perfil cônico natural do braço (deltoide -> cotovelo)
    const upperGeo = new THREE.CylinderGeometry(armR, armR * 0.82, m.upperArmLen, 14);
    const upperMesh = new THREE.Mesh(upperGeo, skinMat);
    upperMesh.position.y = -m.upperArmLen * 0.5;
    upperMesh.castShadow = true;
    upper.add(upperMesh);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(armR * 0.82, 10, 10), skinMat);
    elbow.position.y = -m.upperArmLen;
    upper.add(elbow);

    const forearm = new THREE.Group();
    forearm.position.set(0, -m.upperArmLen, 0);
    upper.add(forearm);

    const foreMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(armR * 0.82, armR * 0.62, m.forearmLen, 14),
      skinMat
    );
    foreMesh.position.y = -m.forearmLen * 0.5;
    foreMesh.castShadow = true;
    forearm.add(foreMesh);

    // Mão estilizada com palma + polegar + 4 dedos alongados (igual aos 5 dedos do 2D)
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -m.forearmLen - 0.015, 0.002);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(armR * 0.72, 12, 10), skinMat);
    palm.scale.set(0.86, 1.15, 0.52);
    handGroup.add(palm);

    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(armR * 0.18, 0.020, 4, 6),
      skinMat
    );
    thumb.position.set(-side * armR * 0.62, 0.002, 0.010);
    thumb.rotation.z = side * 0.52;
    handGroup.add(thumb);

    const fingerOffsets = [-1.35, -0.45, 0.45, 1.35];
    const fingerLengths = [0.024, 0.028, 0.026, 0.021];
    fingerOffsets.forEach((f, idx) => {
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(armR * 0.13, fingerLengths[idx], 4, 6),
        skinMat
      );
      finger.position.set(f * armR * 0.24, -armR * 0.94 - fingerLengths[idx] * 0.3, 0.002);
      finger.rotation.x = 0.14;
      finger.rotation.z = f * -0.05;
      handGroup.add(finger);
    });

    forearm.add(handGroup);
    return { upper, forearm };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // =========================================================================
  // 6. PERNAS ESCULPIDAS (Coxa + Panturrilha anatômica + Pés descalços com 5 dedos)
  // =========================================================================
  const thighTopR = isMale ? 0.060 : isNeutral ? 0.061 : 0.062;
  const buildLeg = (side: -1 | 1) => {
    const thigh = new THREE.Group();
    thigh.position.set(side * m.hipX, -0.01, 0);
    pelvis.add(thigh);

    // Coxa esculpida com LatheGeometry acompanhando a silhueta curvilínea 2D
    const thighPts = [
      new THREE.Vector2(thighTopR * 0.70, -m.thighLen),
      new THREE.Vector2(thighTopR * 0.80, -m.thighLen * 0.68),
      new THREE.Vector2(thighTopR * 0.96, -m.thighLen * 0.28),
      new THREE.Vector2(thighTopR * 1.0, 0),
    ];
    const thighGeo = new THREE.LatheGeometry(thighPts, 18);
    const thighMesh = new THREE.Mesh(thighGeo, skinMat);
    thighMesh.castShadow = true;
    thigh.add(thighMesh);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(thighTopR * 0.70, 12, 10), skinMat);
    knee.position.y = -m.thighLen;
    thigh.add(knee);

    const calf = new THREE.Group();
    calf.position.set(0, -m.thighLen, 0);
    thigh.add(calf);

    // Panturrilha com curva muscular natural até o tornozelo fino
    const calfPts = [
      new THREE.Vector2(thighTopR * 0.44, -m.calfLen),
      new THREE.Vector2(thighTopR * 0.56, -m.calfLen * 0.66),
      new THREE.Vector2(thighTopR * 0.74, -m.calfLen * 0.30),
      new THREE.Vector2(thighTopR * 0.69, 0),
    ];
    const calfGeo = new THREE.LatheGeometry(calfPts, 18);
    const calfMesh = new THREE.Mesh(calfGeo, skinMat);
    calfMesh.castShadow = true;
    calf.add(calfMesh);

    const foot = new THREE.Group();
    foot.position.set(0, -m.calfLen, 0);
    calf.add(foot);

    // Pé descalço anatômico encostado perfeitamente no chão (Y = -footH + 0.01)
    const heelAnkle = new THREE.Mesh(
      new THREE.CylinderGeometry(thighTopR * 0.44, thighTopR * 0.50, 0.042, 14),
      skinMat
    );
    heelAnkle.position.set(0, -0.020, -0.004);

    const footBridge = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.026, 0.088, 6, 12),
      skinMat
    );
    footBridge.rotation.x = Math.PI * 0.45;
    footBridge.scale.set(1.18, 1.0, 0.68);
    footBridge.position.set(0, -0.032, 0.042);
    footBridge.castShadow = true;

    foot.add(heelAnkle, footBridge);

    // 5 dedos do pé descalço alinhados para frente
    for (let t = 0; t < 5; t++) {
      const isInner = t === 0;
      const offsetNorm = (t - 2) * 0.011 * -side;
      const toeR = isInner ? 0.0075 : 0.0058 - t * 0.0005;
      const toe = new THREE.Mesh(new THREE.SphereGeometry(toeR, 8, 8), skinMat);
      toe.scale.set(0.95, 0.75, 1.35);
      toe.position.set(offsetNorm, -0.040, 0.098 - t * 0.0025);
      foot.add(toe);
    }

    return { thigh, calf, foot };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // =========================================================================
  // 7. SOQUETES DE ANEXAÇÃO PARA ROUPAS E ACESSÓRIOS
  // =========================================================================
  const eyesSocket = new THREE.Group();
  eyesSocket.position.set(0, eyeY, faceZ + 0.012);
  head.add(eyesSocket);

  const neckSocket = new THREE.Group();
  neckSocket.position.set(0, 0.022, 0);
  neck.add(neckSocket);

  const chestSocket = new THREE.Group();
  chestSocket.position.set(0, m.torsoH * 0.64, 0);
  torso.add(chestSocket);

  const waistSocket = new THREE.Group();
  waistSocket.position.set(0, 0.015, 0);
  torso.add(waistSocket);

  const handRSocket = new THREE.Group();
  handRSocket.position.set(0, -m.forearmLen - 0.025, 0.02);
  rightArm.forearm.add(handRSocket);

  const wristLSocket = new THREE.Group();
  wristLSocket.position.set(0, -m.forearmLen + 0.022, 0);
  leftArm.forearm.add(wristLSocket);

  const wristRSocket = new THREE.Group();
  wristRSocket.position.set(0, -m.forearmLen + 0.022, 0);
  rightArm.forearm.add(wristRSocket);

  const clothingLayer = new THREE.Group();
  clothingLayer.name = 'ClothingLayer';
  root.add(clothingLayer);

  const rig: Avatar3DRig = {
    root,
    bodyPivot,
    pelvis,
    torso,
    neck,
    head,
    leftUpperArm: leftArm.upper,
    rightUpperArm: rightArm.upper,
    leftForearm: leftArm.forearm,
    rightForearm: rightArm.forearm,
    leftThigh: leftLeg.thigh,
    rightThigh: rightLeg.thigh,
    leftCalf: leftLeg.calf,
    rightCalf: rightLeg.calf,
    leftFoot: leftLeg.foot,
    rightFoot: rightLeg.foot,
    eyeBlink: {
      leftLidPivot: leftEyeRig.upperLidPivot,
      rightLidPivot: rightEyeRig.upperLidPivot,
      leftEyeInner: leftEyeRig.eyeInner,
      rightEyeInner: rightEyeRig.eyeInner,
      blinkPhaseOffset: Math.random() * 4.6,
    },
    clothingLayer,
    attachedParts: [],
    sockets: {
      head,
      eyes: eyesSocket,
      neck: neckSocket,
      chest: chestSocket,
      waist: waistSocket,
      pelvis,
      handR: handRSocket,
      wristL: wristLSocket,
      wristR: wristRSocket,
      leftFoot: leftLeg.foot,
      rightFoot: rightLeg.foot,
    },
    metrics: m,
    skinTone: opts.skinTone,
  };

  updateAvatarPose(rig, 'idle', 0);
  return rig;
}

/**
 * Calcula o fator de fechamento das pálpebras [0 = aberto, 1 = fechado] em ciclo natural de 4.6s
 * (fiel ao `.avatar-eye-blink` 2D, com piscada dupla ocasional para realismo orgânico).
 */
function computeEyeBlinkFactor(timeSec: number, phaseOffset: number): number {
  const cyclePeriod = 4.6;
  const total = timeSec + phaseOffset;
  const cycleIndex = Math.floor(total / cyclePeriod);
  const localT = (total % cyclePeriod) / cyclePeriod; // [0..1)

  // Piscada principal suave entre 90% e 96% do ciclo (~270ms)
  let blink = 0;
  if (localT >= 0.90 && localT <= 0.96) {
    const u = (localT - 0.90) / 0.06;
    blink = Math.sin(u * Math.PI);
  } else if (cycleIndex % 3 === 1 && localT >= 0.81 && localT <= 0.865) {
    // Piscada dupla natural a cada 3 ciclos
    const u = (localT - 0.81) / 0.055;
    blink = Math.sin(u * Math.PI) * 0.95;
  }

  // Curva rápida de fechamento e abertura suave
  return Math.pow(blink, 0.82);
}

/**
 * Atualiza articulações do esqueleto 3D + animação contínua de piscar os olhos sem alocações por frame.
 */
export function updateAvatarPose(rig: Avatar3DRig, pose: Avatar3DPose, timeSec: number): void {
  const breathe = Math.sin(timeSec * 2.1) * 0.011;
  const isMale = rig.metrics.gender === 'masculino';
  const isNeutral = rig.metrics.gender === 'neutro';

  // Ângulo A-frame característico do modelo feminino 2D vs braços mais paralelos no masculino
  const restArmZ = isMale ? 0.095 : isNeutral ? 0.165 : 0.245;

  // Reset base
  rig.bodyPivot.position.set(0, 0, 0);
  rig.pelvis.rotation.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.head.rotation.set(0, 0, 0);
  rig.leftThigh.rotation.set(0, 0, 0);
  rig.rightThigh.rotation.set(0, 0, 0);
  rig.leftCalf.rotation.set(0, 0, 0);
  rig.rightCalf.rotation.set(0, 0, 0);
  rig.leftUpperArm.rotation.set(0, 0, -restArmZ);
  rig.rightUpperArm.rotation.set(0, 0, restArmZ);
  rig.leftForearm.rotation.set(-0.08, 0, 0);
  rig.rightForearm.rotation.set(-0.08, 0, 0);

  if (pose === 'walk') {
    const phase = timeSec * 6.5;
    const swing = Math.sin(phase) * 0.44;
    rig.bodyPivot.position.y = Math.abs(Math.cos(phase)) * 0.028;
    rig.leftThigh.rotation.x = swing;
    rig.rightThigh.rotation.x = -swing;
    rig.leftCalf.rotation.x = Math.max(0, -swing * 0.72);
    rig.rightCalf.rotation.x = Math.max(0, swing * 0.72);
    rig.leftUpperArm.rotation.x = -swing * 0.60;
    rig.rightUpperArm.rotation.x = swing * 0.60;
    rig.torso.rotation.y = Math.sin(phase) * 0.06;
  } else if (pose === 'sit') {
    rig.bodyPivot.position.y = -0.3;
    rig.leftThigh.rotation.x = -Math.PI * 0.46;
    rig.rightThigh.rotation.x = -Math.PI * 0.46;
    rig.leftCalf.rotation.x = Math.PI * 0.44;
    rig.rightCalf.rotation.x = Math.PI * 0.44;
    rig.leftUpperArm.rotation.x = -0.34;
    rig.rightUpperArm.rotation.x = -0.34;
    rig.leftForearm.rotation.x = -0.42;
    rig.rightForearm.rotation.x = -0.42;
    rig.torso.rotation.x = 0.05 + breathe * 0.5;
  } else if (pose === 'runway') {
    rig.pelvis.rotation.z = 0.05;
    rig.torso.rotation.z = -0.035;
    rig.leftThigh.rotation.z = 0.04;
    rig.rightThigh.rotation.x = -0.15;
    rig.rightCalf.rotation.x = 0.22;
    rig.leftUpperArm.rotation.z = -(restArmZ + 0.08);
    rig.leftForearm.rotation.z = 0.42;
    rig.rightUpperArm.rotation.z = restArmZ + 0.06 + breathe;
    rig.head.rotation.y = Math.sin(timeSec * 0.9) * 0.08;
  } else {
    rig.torso.rotation.x = breathe * 0.4;
    rig.leftThigh.rotation.z = isMale ? -0.025 : -0.015;
    rig.rightThigh.rotation.z = isMale ? 0.025 : 0.015;
    rig.leftUpperArm.rotation.z = -restArmZ - breathe * 0.45;
    rig.rightUpperArm.rotation.z = restArmZ + breathe * 0.45;
    rig.head.rotation.y = Math.sin(timeSec * 0.7) * 0.042;
  }

  // Animação contínua de piscar os olhos (pálpebras + compressão ocular natural)
  const blink = computeEyeBlinkFactor(timeSec, rig.eyeBlink.blinkPhaseOffset);
  const lidRotX = THREE.MathUtils.lerp(-0.62, 0.36, blink);
  const eyeScaleY = THREE.MathUtils.lerp(1.0, 0.24, blink);

  rig.eyeBlink.leftLidPivot.rotation.x = lidRotX;
  rig.eyeBlink.rightLidPivot.rotation.x = lidRotX;
  rig.eyeBlink.leftEyeInner.scale.y = eyeScaleY;
  rig.eyeBlink.rightEyeInner.scale.y = eyeScaleY;
}
