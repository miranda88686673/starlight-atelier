import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { clone as cloneSkinnedObject } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarFaceCustomization, AvatarGender, SkinToneId } from '../types/game';
import { SKIN_TONES } from '../data/catalog';
import {
  createAvatar3DRig,
  getAvatarMetrics,
  type Avatar3DRig,
  type AvatarRigMetrics,
} from './avatar3d';
import { disposeObject3D } from './studioEngine';

/**
 * Orientações comuns de exportação em ferramentas 3D (Blender, Maya, Mixamo, VRM)
 * convertidas para o sistema padrão do Three.js (+Y cima, +Z frente, +X direita).
 */
export type SourceAxisOrientation =
  | 'three_y_up'
  | 'z_up_blender'
  | 'facing_neg_z'
  | 'facing_pos_x'
  | 'facing_neg_x';

export type HumanoidBoneKey =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'leftUpperArm'
  | 'rightUpperArm'
  | 'leftForearm'
  | 'rightForearm'
  | 'leftHand'
  | 'rightHand'
  | 'leftThigh'
  | 'rightThigh'
  | 'leftCalf'
  | 'rightCalf'
  | 'leftFoot'
  | 'rightFoot';

export interface BaseAvatarGLTFSource {
  gender: AvatarGender;
  url: string;
  sourceOrientation?: SourceAxisOrientation;
  targetHeight?: number;
}

export interface LoadAvatarGLTFOptions {
  gender: AvatarGender;
  url: string;
  skinTone?: SkinToneId;
  sourceOrientation?: SourceAxisOrientation;
  targetHeight?: number;
  preserveScale?: boolean;
  groundOffsetY?: number;
  dracoDecoderPath?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  envMapIntensity?: number;
  onProgress?: (progressPct: number) => void;
}

export interface LoadedAvatarGLTFResult {
  gender: AvatarGender;
  /** Raiz pronta para scene.add(result.root), ancorada em (0, 0, 0) com +Y para cima e +Z para frente */
  root: THREE.Group;
  /** Grupo intermediário alinhado ao sistema de coordenadas padrão do Three.js */
  alignedModel: THREE.Group;
  /** Cena original clonada do arquivo GLTF/GLB */
  rawScene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  mixer: THREE.AnimationMixer | null;
  bones: Partial<Record<HumanoidBoneKey, THREE.Object3D>>;
  sockets: Avatar3DRig['sockets'];
  metrics: AvatarRigMetrics;
  boundingBox: THREE.Box3;
  scaleFactor: number;
  isProceduralFallback: boolean;
  dispose: () => void;
}

const DEFAULT_DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

const BONE_NAME_CANDIDATES: Record<HumanoidBoneKey, string[]> = {
  hips: ['hips', 'pelvis', 'mixamorig:hips', 'mixamorighips', 'root_hips', 'j_bip_c_hips'],
  spine: ['spine', 'spine1', 'mixamorig:spine', 'mixamorigspine', 'j_bip_c_spine'],
  chest: ['chest', 'upperchest', 'spine2', 'torso', 'mixamorig:spine2', 'mixamorigspine2', 'j_bip_c_chest'],
  neck: ['neck', 'mixamorig:neck', 'mixamorigneck', 'j_bip_c_neck'],
  head: ['head', 'mixamorig:head', 'mixamorighead', 'j_bip_c_head'],
  leftUpperArm: ['leftupperarm', 'leftarm', 'upper_arm_l', 'mixamorig:leftarm', 'mixamorigleftarm', 'j_bip_l_upperarm'],
  rightUpperArm: ['rightupperarm', 'rightarm', 'upper_arm_r', 'mixamorig:rightarm', 'mixamorigrightarm', 'j_bip_r_upperarm'],
  leftForearm: ['leftforearm', 'leftlowerarm', 'forearm_l', 'mixamorig:leftforearm', 'mixamorigleftforearm', 'j_bip_l_lowerarm'],
  rightForearm: ['rightforearm', 'rightlowerarm', 'forearm_r', 'mixamorig:rightforearm', 'mixamorigrightforearm', 'j_bip_r_lowerarm'],
  leftHand: ['lefthand', 'hand_l', 'mixamorig:lefthand', 'mixamoriglefthand', 'j_bip_l_hand'],
  rightHand: ['righthand', 'hand_r', 'mixamorig:righthand', 'mixamorigrighthand', 'j_bip_r_hand'],
  leftThigh: ['leftupleg', 'leftthigh', 'thigh_l', 'mixamorig:leftupleg', 'mixamorigleftupleg', 'j_bip_l_upperleg'],
  rightThigh: ['rightupleg', 'rightthigh', 'thigh_r', 'mixamorig:rightupleg', 'mixamorigrightupleg', 'j_bip_r_upperleg'],
  leftCalf: ['leftleg', 'leftcalf', 'leftlowerleg', 'shin_l', 'mixamorig:leftleg', 'mixamorigleftleg', 'j_bip_l_lowerleg'],
  rightCalf: ['rightleg', 'rightcalf', 'rightlowerleg', 'shin_r', 'mixamorig:rightleg', 'mixamorigrightleg', 'j_bip_r_lowerleg'],
  leftFoot: ['leftfoot', 'foot_l', 'mixamorig:leftfoot', 'mixamorigleftfoot', 'j_bip_l_foot'],
  rightFoot: ['rightfoot', 'foot_r', 'mixamorig:rightfoot', 'mixamorigrightfoot', 'j_bip_r_foot'],
};

const gltfAssetCache = new Map<string, Promise<GLTF>>();
let sharedDracoLoader: DRACOLoader | null = null;
let sharedDracoPath = DEFAULT_DRACO_DECODER_PATH;

function getSharedGLTFManagerAndLoader(dracoDecoderPath?: string): {
  loader: GLTFLoader;
  manager: THREE.LoadingManager;
} {
  const manager = new THREE.LoadingManager();
  const targetDracoPath = dracoDecoderPath || DEFAULT_DRACO_DECODER_PATH;
  if (!sharedDracoLoader || sharedDracoPath !== targetDracoPath) {
    sharedDracoLoader?.dispose();
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath(targetDracoPath);
    sharedDracoPath = targetDracoPath;
  }
  const loader = new GLTFLoader(manager);
  loader.setDRACOLoader(sharedDracoLoader);
  return { loader, manager };
}

function normalizeBoneToken(name: string): string {
  return name.trim().toLowerCase().replace(/[\s.-]+/g, '');
}

/**
 * Converte a rotação inicial do modelo importado para o sistema padrão do Three.js:
 * +Y para cima, +Z para frente e +X lateral.
 */
function applySourceOrientationEuler(
  target: THREE.Object3D,
  orientation: SourceAxisOrientation = 'three_y_up'
): void {
  target.rotation.set(0, 0, 0);
  switch (orientation) {
    case 'z_up_blender':
      target.rotation.x = -Math.PI / 2;
      break;
    case 'facing_neg_z':
      target.rotation.y = Math.PI;
      break;
    case 'facing_pos_x':
      target.rotation.y = -Math.PI / 2;
      break;
    case 'facing_neg_x':
      target.rotation.y = Math.PI / 2;
      break;
    case 'three_y_up':
    default:
      break;
  }
}

/**
 * Alinha qualquer modelo GLTF/GLB ao sistema de coordenadas padrão do Three.js:
 * - Eixo vertical +Y, frente +Z
 * - Escala uniforme ajustada à altura do gênero (1.62m masc / 1.56m fem / 1.60m neutro)
 * - Centralizado em X = 0, Z = 0 e com a sola dos pés apoiada exatamente em Y = 0
 */
export function alignAvatarModelToThreeCoords(
  rawScene: THREE.Object3D,
  opts: {
    gender: AvatarGender;
    sourceOrientation?: SourceAxisOrientation;
    targetHeight?: number;
    preserveScale?: boolean;
    groundOffsetY?: number;
    castShadow?: boolean;
    receiveShadow?: boolean;
    envMapIntensity?: number;
  }
): {
  root: THREE.Group;
  alignedModel: THREE.Group;
  boundingBox: THREE.Box3;
  scaleFactor: number;
} {
  const metrics = getAvatarMetrics(opts.gender);
  const desiredHeight = opts.targetHeight ?? metrics.totalHeight;

  const root = new THREE.Group();
  root.name = `AvatarGLBRoot_${opts.gender}`;

  // Wrapper intermediário preserva animação original nos ossos internos do rawScene
  const alignedModel = new THREE.Group();
  alignedModel.name = 'AlignedAvatarPivot';
  applySourceOrientationEuler(rawScene, opts.sourceOrientation ?? 'three_y_up');
  alignedModel.add(rawScene);
  root.add(alignedModel);

  const castShadow = opts.castShadow ?? true;
  const receiveShadow = opts.receiveShadow ?? true;
  const envMapIntensity = opts.envMapIntensity ?? 0.9;

  rawScene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.frustumCulled = false;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (typeof stdMat.envMapIntensity === 'number') {
        stdMat.envMapIntensity = envMapIntensity;
      }
      if (stdMat.map instanceof THREE.Texture) {
        stdMat.map.colorSpace = THREE.SRGBColorSpace;
        stdMat.map.needsUpdate = true;
      }
      if (stdMat.emissiveMap instanceof THREE.Texture) {
        stdMat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        stdMat.emissiveMap.needsUpdate = true;
      }
    }
  });

  root.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(alignedModel);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);

  let scaleFactor = 1;
  if (!opts.preserveScale && rawSize.y > 0.0001) {
    scaleFactor = desiredHeight / rawSize.y;
    alignedModel.scale.setScalar(scaleFactor);
  }

  root.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(alignedModel);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  // Centraliza horizontalmente (X = 0, Z = 0) e apoia os pés em Y = 0
  alignedModel.position.x -= scaledCenter.x;
  alignedModel.position.z -= scaledCenter.z;
  alignedModel.position.y -= scaledBox.min.y - (opts.groundOffsetY ?? 0);

  root.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(alignedModel);

  return {
    root,
    alignedModel,
    boundingBox: finalBox,
    scaleFactor,
  };
}

/**
 * Mapeia os ossos do esqueleto humanoide do GLB e cria soquetes compatíveis com os acessórios 3D.
 */
export function extractAvatarRigSockets(
  root: THREE.Group,
  alignedModel: THREE.Object3D,
  gender: AvatarGender
): {
  bones: Partial<Record<HumanoidBoneKey, THREE.Object3D>>;
  sockets: Avatar3DRig['sockets'];
} {
  const metrics = getAvatarMetrics(gender);
  const bones: Partial<Record<HumanoidBoneKey, THREE.Object3D>> = {};

  const boneEntries = Object.entries(BONE_NAME_CANDIDATES) as Array<
    [HumanoidBoneKey, string[]]
  >;

  alignedModel.traverse((obj) => {
    if (!obj.name) return;
    const token = normalizeBoneToken(obj.name);
    for (const [key, candidates] of boneEntries) {
      if (bones[key]) continue;
      if (candidates.some((cand) => token === cand || token.endsWith(cand))) {
        bones[key] = obj;
      }
    }
  });

  const makeFallbackSocket = (name: string, x: number, y: number, z: number): THREE.Group => {
    const grp = new THREE.Group();
    grp.name = name;
    grp.position.set(x, y, z);
    root.add(grp);
    return grp;
  };

  const legHeight = metrics.calfLen + metrics.thighLen + 0.056;
  const headCenterY = legHeight + metrics.torsoH + metrics.headHalfH + 0.12;

  const ensureSocketOnBone = (
    bone: THREE.Object3D | undefined,
    name: string,
    fallbackPos: [number, number, number],
    localOffset: [number, number, number] = [0, 0, 0]
  ): THREE.Group => {
    if (bone) {
      const sock = new THREE.Group();
      sock.name = name;
      sock.position.set(localOffset[0], localOffset[1], localOffset[2]);
      bone.add(sock);
      return sock;
    }
    return makeFallbackSocket(name, fallbackPos[0], fallbackPos[1], fallbackPos[2]);
  };

  const headSocket = ensureSocketOnBone(bones.head, 'Socket_Head', [0, headCenterY, 0]);
  const eyesSocket = ensureSocketOnBone(
    bones.head,
    'Socket_Eyes',
    [0, headCenterY + 0.010, metrics.headRadius * 0.88],
    [0, 0.010, metrics.headRadius * 0.88]
  );
  const neckSocket = ensureSocketOnBone(bones.neck, 'Socket_Neck', [0, legHeight + metrics.torsoH + 0.09, 0]);
  const chestSocket = ensureSocketOnBone(bones.chest ?? bones.spine, 'Socket_Chest', [0, legHeight + metrics.torsoH * 0.72, 0]);
  const waistSocket = ensureSocketOnBone(bones.spine ?? bones.hips, 'Socket_Waist', [0, legHeight + 0.1, 0]);
  const pelvisSocket = ensureSocketOnBone(bones.hips, 'Socket_Pelvis', [0, legHeight, 0]);
  const handRSocket = ensureSocketOnBone(bones.rightHand, 'Socket_HandR', [metrics.shoulderHalfW, legHeight + 0.1, 0.04]);
  const wristLSocket = ensureSocketOnBone(bones.leftForearm ?? bones.leftHand, 'Socket_WristL', [-metrics.shoulderHalfW, legHeight + 0.16, 0]);
  const wristRSocket = ensureSocketOnBone(bones.rightForearm ?? bones.rightHand, 'Socket_WristR', [metrics.shoulderHalfW, legHeight + 0.16, 0]);
  const leftFootSocket = ensureSocketOnBone(bones.leftFoot, 'Socket_FootL', [-metrics.hipX, 0.04, 0.04]);
  const rightFootSocket = ensureSocketOnBone(bones.rightFoot, 'Socket_FootR', [metrics.hipX, 0.04, 0.04]);

  return {
    bones,
    sockets: {
      head: headSocket,
      eyes: eyesSocket,
      neck: neckSocket,
      chest: chestSocket,
      waist: waistSocket,
      pelvis: pelvisSocket,
      handR: handRSocket,
      wristL: wristLSocket,
      wristR: wristRSocket,
      leftFoot: leftFootSocket,
      rightFoot: rightFootSocket,
    },
  };
}

/**
 * Aplica o tom de pele selecionado aos materiais de pele do modelo GLB sem sobrescrever cueca/biquíni/cabelo.
 */
export function applySkinToneToGLB(target: THREE.Object3D, skinTone: SkinToneId): void {
  const skinInfo = SKIN_TONES.find((s) => s.id === skinTone) || SKIN_TONES[1];
  const skinColor = new THREE.Color(skinInfo.base);

  target.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const isArray = Array.isArray(mesh.material);
    const mats: THREE.Material[] = Array.isArray(mesh.material)
      ? [...mesh.material]
      : mesh.material
        ? [mesh.material]
        : [];
    let mutated = false;

    for (let i = 0; i < mats.length; i++) {
      const mat = mats[i];
      if (!mat || !('color' in mat)) continue;
      const matName = (mat.name || mesh.name || '').toLowerCase();
      const looksLikeSkin =
        /skin|pele|body|torso|face|head|arm|leg|hand|foot|avatar_base/.test(matName) &&
        !/underwear|cueca|bikini|biquini|brief|bra|swim|hair|eye|sclera|iris|pupil|teeth/.test(
          matName
        );
      if (looksLikeSkin) {
        const clonedMat = mat.clone() as THREE.MeshStandardMaterial;
        clonedMat.color.copy(skinColor);
        clonedMat.userData = { ...clonedMat.userData, __avatarClonedMat: true };
        mats[i] = clonedMat;
        mutated = true;
      }
    }

    if (mutated && mats.length > 0) {
      mesh.material = isArray ? mats : mats[0];
    }
  });
}

function finalizeLoadedGLTF(
  gltf: GLTF,
  options: Omit<LoadAvatarGLTFOptions, 'url'>,
  isSharedCache = false
): LoadedAvatarGLTFResult {
  const clonedScene = cloneSkinnedObject(gltf.scene);
  const aligned = alignAvatarModelToThreeCoords(clonedScene, {
    gender: options.gender,
    sourceOrientation: options.sourceOrientation,
    targetHeight: options.targetHeight,
    preserveScale: options.preserveScale,
    groundOffsetY: options.groundOffsetY,
    castShadow: options.castShadow,
    receiveShadow: options.receiveShadow,
    envMapIntensity: options.envMapIntensity,
  });

  if (options.skinTone) {
    applySkinToneToGLB(aligned.alignedModel, options.skinTone);
  }

  const { bones, sockets } = extractAvatarRigSockets(
    aligned.root,
    aligned.alignedModel,
    options.gender
  );

  const animations = gltf.animations ? [...gltf.animations] : [];
  const mixer = animations.length > 0 ? new THREE.AnimationMixer(clonedScene) : null;

  return {
    gender: options.gender,
    root: aligned.root,
    alignedModel: aligned.alignedModel,
    rawScene: clonedScene,
    animations,
    mixer,
    bones,
    sockets,
    metrics: getAvatarMetrics(options.gender),
    boundingBox: aligned.boundingBox,
    scaleFactor: aligned.scaleFactor,
    isProceduralFallback: false,
    dispose: () => {
      mixer?.stopAllAction();
      mixer?.uncacheRoot(clonedScene);
      aligned.root.removeFromParent();
      if (isSharedCache) {
        aligned.root.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh || !mesh.material) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (m.userData?.__avatarClonedMat) {
              m.dispose();
            }
          }
        });
      } else {
        disposeObject3D(aligned.root);
      }
    },
  };
}

/**
 * Carrega e alinha um modelo GLTF/GLB de avatar masculino ou feminino no sistema padrão Three.js.
 * Reutiliza cache de assets em memória e clona o esqueleto com SkeletonUtils para múltiplas instâncias.
 */
export async function loadBaseAvatarGLTF(
  options: LoadAvatarGLTFOptions
): Promise<LoadedAvatarGLTFResult> {
  const gltf = await fetchOrGetCachedGLTF(options.url, options.dracoDecoderPath, options.onProgress);
  return finalizeLoadedGLTF(gltf, options, true);
}

function fetchOrGetCachedGLTF(
  url: string,
  dracoDecoderPath?: string,
  onProgress?: (progressPct: number) => void
): Promise<GLTF> {
  const cacheKey = `${url}`;
  let pending = gltfAssetCache.get(cacheKey);

  if (!pending) {
    const { loader } = getSharedGLTFManagerAndLoader(dracoDecoderPath);
    pending = new Promise<GLTF>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => resolve(gltf),
        (xhr) => {
          if (onProgress && xhr.total > 0) {
            onProgress(Math.min(100, (xhr.loaded / xhr.total) * 100));
          }
        },
        (error) => {
          gltfAssetCache.delete(cacheKey);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      );
    });
    gltfAssetCache.set(cacheKey, pending);
  }

  return pending;
}

/**
 * Faz o parse de um buffer binário GLB/GLTF (ex.: upload local de arquivo .glb) já alinhado ao Three.js.
 */
export async function parseBaseAvatarGLTFBuffer(
  buffer: ArrayBuffer,
  options: Omit<LoadAvatarGLTFOptions, 'url'>
): Promise<LoadedAvatarGLTFResult> {
  const { loader } = getSharedGLTFManagerAndLoader(options.dracoDecoderPath);
  const gltf = await new Promise<GLTF>((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (parsed) => resolve(parsed),
      (error) => reject(error instanceof Error ? error : new Error(String(error)))
    );
  });
  return finalizeLoadedGLTF(gltf, options);
}

/**
 * Carrega em paralelo os modelos base masculino e feminino garantindo o mesmo padrão espacial Three.js.
 */
export async function loadMaleAndFemaleBaseAvatars(params: {
  masculino: Omit<BaseAvatarGLTFSource, 'gender'>;
  feminino: Omit<BaseAvatarGLTFSource, 'gender'>;
  skinTone?: SkinToneId;
  dracoDecoderPath?: string;
}): Promise<{
  masculino: LoadedAvatarGLTFResult;
  feminino: LoadedAvatarGLTFResult;
}> {
  const [masculino, feminino] = await Promise.all([
    loadBaseAvatarGLTF({
      gender: 'masculino',
      url: params.masculino.url,
      sourceOrientation: params.masculino.sourceOrientation,
      targetHeight: params.masculino.targetHeight,
      skinTone: params.skinTone,
      dracoDecoderPath: params.dracoDecoderPath,
    }),
    loadBaseAvatarGLTF({
      gender: 'feminino',
      url: params.feminino.url,
      sourceOrientation: params.feminino.sourceOrientation,
      targetHeight: params.feminino.targetHeight,
      skinTone: params.skinTone,
      dracoDecoderPath: params.dracoDecoderPath,
    }),
  ]);

  return { masculino, feminino };
}

/**
 * Carrega um avatar base GLTF/GLB quando houver URL válida; caso não exista ou falhe,
 * retorna o avatar procedural padrão (masculino de cueca / feminino de biquíni) no mesmo alinhamento Three.js.
 */
export async function loadBaseAvatarWithFallback(params: {
  gender: AvatarGender;
  skinTone: SkinToneId;
  faceCustomization?: AvatarFaceCustomization;
  url?: string;
  sourceOrientation?: SourceAxisOrientation;
  targetHeight?: number;
  withShadowDisc?: boolean;
}): Promise<{
  gltfResult?: LoadedAvatarGLTFResult;
  proceduralRig?: Avatar3DRig;
  root: THREE.Group;
  sockets: Avatar3DRig['sockets'];
  metrics: AvatarRigMetrics;
}> {
  if (params.url) {
    try {
      const gltfResult = await loadBaseAvatarGLTF({
        gender: params.gender,
        url: params.url,
        skinTone: params.skinTone,
        sourceOrientation: params.sourceOrientation,
        targetHeight: params.targetHeight,
      });
      return {
        gltfResult,
        root: gltfResult.root,
        sockets: gltfResult.sockets,
        metrics: gltfResult.metrics,
      };
    } catch (err) {
      console.warn(
        `[gltfAvatarLoader] Falha ao carregar GLB (${params.url}), usando avatar procedural padrão:`,
        err
      );
    }
  }

  const proceduralRig = createAvatar3DRig({
    avatarGender: params.gender,
    skinTone: params.skinTone,
    faceCustomization: params.faceCustomization,
    withShadowDisc: params.withShadowDisc,
  });

  return {
    proceduralRig,
    root: proceduralRig.root,
    sockets: proceduralRig.sockets,
    metrics: proceduralRig.metrics,
  };
}

/**
 * Pré-carrega URLs GLTF/GLB no cache sem instanciar na cena.
 */
export async function preloadBaseAvatarGLTF(
  sources: BaseAvatarGLTFSource[],
  dracoDecoderPath?: string
): Promise<void> {
  await Promise.all(
    sources.map((src) => fetchOrGetCachedGLTF(src.url, dracoDecoderPath))
  );
}

/**
 * Limpa o cache de GLTF e libera o decoder Draco compartilhado.
 */
export function clearAvatarGLTFCache(): void {
  gltfAssetCache.clear();
  sharedDracoLoader?.dispose();
  sharedDracoLoader = null;
}
