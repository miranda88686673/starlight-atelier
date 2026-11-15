import * as THREE from 'three';
import type { AvatarGender, SkinToneId } from '../types/game';
import { SKIN_TONES } from '../data/catalog';
import { getRadialShadowTexture } from './studioEngine';

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
  headRadius: number;
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
    leftFoot: THREE.Group;
    rightFoot: THREE.Group;
  };
  metrics: AvatarRigMetrics;
  skinTone: SkinToneId;
}

export function getAvatarMetrics(gender: AvatarGender): AvatarRigMetrics {
  if (gender === 'masculino') {
    return {
      gender,
      totalHeight: 1.82,
      shoulderHalfW: 0.215,
      chestW: 0.175,
      chestDepth: 0.118,
      waistW: 0.145,
      hipW: 0.152,
      hipX: 0.098,
      torsoH: 0.47,
      thighLen: 0.42,
      calfLen: 0.41,
      upperArmLen: 0.29,
      forearmLen: 0.26,
      headRadius: 0.112,
    };
  }
  if (gender === 'neutro') {
    return {
      gender,
      totalHeight: 1.77,
      shoulderHalfW: 0.188,
      chestW: 0.155,
      chestDepth: 0.11,
      waistW: 0.128,
      hipW: 0.156,
      hipX: 0.094,
      torsoH: 0.45,
      thighLen: 0.41,
      calfLen: 0.4,
      upperArmLen: 0.275,
      forearmLen: 0.245,
      headRadius: 0.109,
    };
  }
  // Feminino: ombros estreitos, cintura fina, busto & quadril proporcionais
  return {
    gender: 'feminino',
    totalHeight: 1.74,
    shoulderHalfW: 0.168,
    chestW: 0.146,
    chestDepth: 0.116,
    waistW: 0.11,
    hipW: 0.162,
    hipX: 0.092,
    torsoH: 0.44,
    thighLen: 0.405,
    calfLen: 0.395,
    upperArmLen: 0.265,
    forearmLen: 0.235,
    headRadius: 0.107,
  };
}

/**
 * Constrói o esqueleto 3D articulado e anatomia base diferenciada (feminino vs masculino vs neutro)
 * com rosto expressivo, juntas modulares e soquetes exatos para vestuário.
 */
export function createAvatar3DRig(opts: {
  avatarGender: AvatarGender;
  skinTone: SkinToneId;
  withShadowDisc?: boolean;
}): Avatar3DRig {
  const m = getAvatarMetrics(opts.avatarGender);
  const skinInfo = SKIN_TONES.find((s) => s.id === opts.skinTone) || SKIN_TONES[1];
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(skinInfo.base),
    roughness: 0.56,
    metalness: 0.0,
    sheen: 0.25,
    sheenColor: new THREE.Color(skinInfo.blush),
  });
  const baseBodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#7C817A'),
    roughness: 0.72,
    metalness: 0.04,
  });

  const root = new THREE.Group();
  root.name = 'Avatar3DRoot';

  if (opts.withShadowDisc !== false) {
    const shadowGeo = new THREE.PlaneGeometry(0.75, 0.75);
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

  const legHipY = m.calfLen + m.thighLen + 0.095; // ~0.905..0.925

  // Pélvis
  const pelvis = new THREE.Group();
  pelvis.position.set(0, legHipY, 0);
  bodyPivot.add(pelvis);

  const pelvisMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(m.waistW * 0.96, m.hipW * 0.94, 0.16, 18),
    baseBodyMat
  );
  pelvisMesh.scale.set(1, 1, 0.68);
  pelvisMesh.position.y = 0.04;
  pelvisMesh.castShadow = true;
  pelvis.add(pelvisMesh);

  // Torso (Lathe anatômico com V-taper masculino ou ampulheta feminina)
  const torso = new THREE.Group();
  torso.position.set(0, 0.1, 0);
  pelvis.add(torso);

  const pts: THREE.Vector2[] =
    opts.avatarGender === 'masculino'
      ? [
          new THREE.Vector2(m.waistW * 0.95, 0.0),
          new THREE.Vector2(m.waistW * 0.98, m.torsoH * 0.25),
          new THREE.Vector2(m.chestW * 0.98, m.torsoH * 0.62),
          new THREE.Vector2(m.shoulderHalfW * 0.88, m.torsoH * 0.88),
          new THREE.Vector2(0.068, m.torsoH),
        ]
      : [
          new THREE.Vector2(m.waistW * 1.02, 0.0),
          new THREE.Vector2(m.waistW * 0.9, m.torsoH * 0.22),
          new THREE.Vector2(m.chestW * 1.02, m.torsoH * 0.6),
          new THREE.Vector2(m.shoulderHalfW * 0.86, m.torsoH * 0.88),
          new THREE.Vector2(0.056, m.torsoH),
        ];

  const torsoGeo = new THREE.LatheGeometry(pts, 22);
  torsoGeo.scale(1, 1, opts.avatarGender === 'masculino' ? 0.64 : 0.66);
  const torsoMesh = new THREE.Mesh(torsoGeo, baseBodyMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torso.add(torsoMesh);

  if (opts.avatarGender === 'feminino') {
    // Contorno anatômico sutil do busto para que blusas e vestidos tenham caimento fiel
    const bustMat = baseBodyMat;
    const bustL = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 14), bustMat);
    bustL.position.set(-0.052, m.torsoH * 0.62, 0.052);
    bustL.scale.set(1, 0.9, 0.85);
    const bustR = bustL.clone();
    bustR.position.x = 0.052;
    torso.add(bustL, bustR);
  } else if (opts.avatarGender === 'masculino') {
    // Peitoral definido
    const pecL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.085, 0.055), baseBodyMat);
    pecL.position.set(-0.062, m.torsoH * 0.68, 0.068);
    pecL.rotation.z = -0.05;
    const pecR = pecL.clone();
    pecR.position.x = 0.062;
    pecR.rotation.z = 0.05;
    torso.add(pecL, pecR);
  }

  // Ombros / Deltoides suaves
  const shoulderCapL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), baseBodyMat);
  shoulderCapL.position.set(-m.shoulderHalfW * 0.9, m.torsoH * 0.88, 0);
  const shoulderCapR = shoulderCapL.clone();
  shoulderCapR.position.x = m.shoulderHalfW * 0.9;
  torso.add(shoulderCapL, shoulderCapR);

  // Pescoço & Cabeça
  const neck = new THREE.Group();
  neck.position.set(0, m.torsoH + 0.005, 0);
  torso.add(neck);

  const neckR = opts.avatarGender === 'masculino' ? 0.05 : 0.041;
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(neckR * 0.92, neckR, 0.1, 14), skinMat);
  neckMesh.position.y = 0.045;
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.set(0, 0.165, 0.006);
  neck.add(head);

  // Crânio + Mandíbula diferenciada
  const skull = new THREE.Mesh(new THREE.SphereGeometry(m.headRadius, 24, 20), skinMat);
  skull.scale.set(0.92, 1.12, 0.98);
  skull.castShadow = true;
  head.add(skull);

  if (opts.avatarGender === 'masculino') {
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(m.headRadius * 1.15, 0.068, 0.092), skinMat);
    jaw.position.set(0, -0.065, 0.025);
    head.add(jaw);
  } else {
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 12), skinMat);
    chin.position.set(0, -0.074, 0.045);
    chin.scale.set(0.95, 0.85, 0.9);
    head.add(chin);
  }

  // Orelhas
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), skinMat);
  earL.scale.set(0.45, 1.15, 0.75);
  earL.position.set(-m.headRadius * 0.92, -0.005, -0.005);
  const earR = earL.clone();
  earR.position.x = m.headRadius * 0.92;
  head.add(earL, earR);

  // Rosto expressivo 3D (olhos, íris, brilho, sobrancelhas, nariz, lábios, blush)
  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, 0, m.headRadius * 0.9);
  head.add(faceGroup);

  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const irisMat = new THREE.MeshStandardMaterial({
    color: opts.avatarGender === 'masculino' ? '#3B2B23' : '#4C3327',
    roughness: 0.15,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111115 });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x2a1d19, roughness: 0.75 });
  const lipColor = opts.avatarGender === 'masculino' ? '#C07A71' : '#C95A6E';
  const lipMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(lipColor),
    roughness: opts.avatarGender === 'masculino' ? 0.55 : 0.3,
    clearcoat: opts.avatarGender === 'masculino' ? 0.1 : 0.45,
  });

  for (const side of [-1, 1]) {
    const eyeX = side * 0.038;
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 10), scleraMat);
    sclera.scale.set(1.2, 0.78, 0.55);
    sclera.position.set(eyeX, 0.014, 0.003);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 10), irisMat);
    iris.scale.set(1, 1, 0.5);
    iris.position.set(eyeX, 0.014, 0.009);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), pupilMat);
    pupil.position.set(eyeX, 0.014, 0.012);

    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, opts.avatarGender === 'masculino' ? 0.009 : 0.0055, 0.007),
      browMat
    );
    brow.position.set(eyeX, 0.036, 0.008);
    brow.rotation.z = side * (opts.avatarGender === 'masculino' ? -0.05 : -0.1);

    faceGroup.add(sclera, iris, pupil, brow);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.032, 8), skinMat);
  nose.rotation.x = Math.PI * 0.18;
  nose.position.set(0, -0.012, 0.012);
  faceGroup.add(nose);

  const lips = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.005, 8, 16, Math.PI), lipMat);
  lips.rotation.x = Math.PI;
  lips.rotation.z = 0;
  lips.position.set(0, -0.044, 0.007);
  faceGroup.add(lips);

  // Braços
  const armR = opts.avatarGender === 'masculino' ? 0.043 : 0.034;
  const buildArm = (side: -1 | 1) => {
    const upper = new THREE.Group();
    upper.position.set(side * (m.shoulderHalfW + 0.012), m.torsoH * 0.88, 0);
    torso.add(upper);

    const upperMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(armR, armR * 0.82, m.upperArmLen, 12),
      baseBodyMat
    );
    upperMesh.position.y = -m.upperArmLen * 0.5;
    upperMesh.castShadow = true;
    upper.add(upperMesh);

    const forearm = new THREE.Group();
    forearm.position.set(0, -m.upperArmLen, 0);
    upper.add(forearm);

    const foreMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(armR * 0.82, armR * 0.65, m.forearmLen, 12),
      skinMat
    );
    foreMesh.position.y = -m.forearmLen * 0.5;
    foreMesh.castShadow = true;
    forearm.add(foreMesh);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(armR * 0.72, 10, 10), skinMat);
    hand.scale.set(0.85, 1.35, 0.6);
    hand.position.y = -m.forearmLen - 0.025;
    forearm.add(hand);

    return { upper, forearm };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Pernas
  const thighTopR = opts.avatarGender === 'masculino' ? 0.072 : 0.075;
  const buildLeg = (side: -1 | 1) => {
    const thigh = new THREE.Group();
    thigh.position.set(side * m.hipX, -0.02, 0);
    pelvis.add(thigh);

    const thighMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(thighTopR, thighTopR * 0.72, m.thighLen, 14),
      baseBodyMat
    );
    thighMesh.position.y = -m.thighLen * 0.5;
    thighMesh.castShadow = true;
    thigh.add(thighMesh);

    const calf = new THREE.Group();
    calf.position.set(0, -m.thighLen, 0);
    thigh.add(calf);

    const calfMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(thighTopR * 0.7, thighTopR * 0.48, m.calfLen, 14),
      skinMat
    );
    calfMesh.position.y = -m.calfLen * 0.5;
    calfMesh.castShadow = true;
    calf.add(calfMesh);

    const foot = new THREE.Group();
    foot.position.set(0, -m.calfLen, 0);
    calf.add(foot);

    const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.045, 0.165), skinMat);
    footMesh.position.set(0, -0.028, 0.042);
    footMesh.castShadow = true;
    foot.add(footMesh);

    return { thigh, calf, foot };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Soquetes de encaixe anatômico
  const eyesSocket = new THREE.Group();
  eyesSocket.position.set(0, 0.014, m.headRadius * 0.96);
  head.add(eyesSocket);

  const neckSocket = new THREE.Group();
  neckSocket.position.set(0, 0.025, 0);
  neck.add(neckSocket);

  const chestSocket = new THREE.Group();
  chestSocket.position.set(0, m.torsoH * 0.65, 0);
  torso.add(chestSocket);

  const waistSocket = new THREE.Group();
  waistSocket.position.set(0, 0.02, 0);
  torso.add(waistSocket);

  const handRSocket = new THREE.Group();
  handRSocket.position.set(0, -m.forearmLen - 0.03, 0.02);
  rightArm.forearm.add(handRSocket);

  const wristLSocket = new THREE.Group();
  wristLSocket.position.set(0, -m.forearmLen + 0.025, 0);
  leftArm.forearm.add(wristLSocket);

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
 * Atualiza articulações do esqueleto 3D sem alocação de objetos por frame.
 */
export function updateAvatarPose(rig: Avatar3DRig, pose: Avatar3DPose, timeSec: number): void {
  const breathe = Math.sin(timeSec * 2.1) * 0.012;

  // Reset base
  rig.bodyPivot.position.set(0, 0, 0);
  rig.pelvis.rotation.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.head.rotation.set(0, 0, 0);
  rig.leftThigh.rotation.set(0, 0, 0);
  rig.rightThigh.rotation.set(0, 0, 0);
  rig.leftCalf.rotation.set(0, 0, 0);
  rig.rightCalf.rotation.set(0, 0, 0);
  rig.leftUpperArm.rotation.set(0, 0, -0.1);
  rig.rightUpperArm.rotation.set(0, 0, 0.1);
  rig.leftForearm.rotation.set(-0.12, 0, 0);
  rig.rightForearm.rotation.set(-0.12, 0, 0);

  if (pose === 'walk') {
    const phase = timeSec * 6.5;
    const swing = Math.sin(phase) * 0.45;
    rig.bodyPivot.position.y = Math.abs(Math.cos(phase)) * 0.032;
    rig.leftThigh.rotation.x = swing;
    rig.rightThigh.rotation.x = -swing;
    rig.leftCalf.rotation.x = Math.max(0, -swing * 0.75);
    rig.rightCalf.rotation.x = Math.max(0, swing * 0.75);
    rig.leftUpperArm.rotation.x = -swing * 0.65;
    rig.rightUpperArm.rotation.x = swing * 0.65;
    rig.torso.rotation.y = Math.sin(phase) * 0.06;
  } else if (pose === 'sit') {
    rig.bodyPivot.position.y = -0.34;
    rig.leftThigh.rotation.x = -Math.PI * 0.47;
    rig.rightThigh.rotation.x = -Math.PI * 0.47;
    rig.leftCalf.rotation.x = Math.PI * 0.45;
    rig.rightCalf.rotation.x = Math.PI * 0.45;
    rig.leftUpperArm.rotation.x = -0.38;
    rig.rightUpperArm.rotation.x = -0.38;
    rig.leftForearm.rotation.x = -0.45;
    rig.rightForearm.rotation.x = -0.45;
    rig.torso.rotation.x = 0.05 + breathe * 0.5;
  } else if (pose === 'runway') {
    rig.pelvis.rotation.z = 0.06;
    rig.torso.rotation.z = -0.04;
    rig.leftThigh.rotation.z = 0.04;
    rig.rightThigh.rotation.x = -0.14;
    rig.rightCalf.rotation.x = 0.2;
    rig.leftUpperArm.rotation.z = -0.22;
    rig.leftForearm.rotation.z = 0.48;
    rig.rightUpperArm.rotation.z = 0.18 + breathe;
    rig.head.rotation.y = Math.sin(timeSec * 0.9) * 0.08;
  } else {
    // Idle elegante
    rig.torso.rotation.x = breathe * 0.4;
    rig.leftUpperArm.rotation.z = -0.11 - breathe * 0.5;
    rig.rightUpperArm.rotation.z = 0.11 + breathe * 0.5;
    rig.head.rotation.y = Math.sin(timeSec * 0.7) * 0.045;
  }
}
