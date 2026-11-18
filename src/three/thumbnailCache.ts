import * as THREE from 'three';
import type {
  AvatarGender,
  ClothingItem,
  FurnitureDef,
  PurchasableWallpaperItem,
  RoomBackdropTheme,
} from '../types/game';
import { createStudioLighting, createStudioRenderer, disposeObject3D, flushSoftwareFrame, type StudioRendererBundle } from './studioEngine';
import { buildStandaloneItem3D } from './clothing3d';
import { buildFurniture3D } from './furniture3d';
import { buildRoomStage3D } from './roomScenes3d';

const dataUrlCache = new Map<string, string>();
const listeners = new Map<string, Array<(url: string) => void>>();

interface QueueJob {
  key: string;
  mode?: 'item' | 'room';
  backgroundHex?: string;
  build: () => THREE.Object3D;
}

const jobQueue: QueueJob[] = [];
const queuedKeys = new Set<string>();
let processing = false;

let sharedBundle: StudioRendererBundle | null = null;
let sharedScene: THREE.Scene | null = null;
let sharedCamera: THREE.PerspectiveCamera | null = null;

function ensureSnapshotRig() {
  if (!sharedBundle) {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 220;
    sharedBundle = createStudioRenderer(canvas, {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    sharedBundle.renderer.setSize(220, 220, false);

    sharedScene = new THREE.Scene();
    sharedScene.environment = sharedBundle.envTarget.texture;
    createStudioLighting(sharedScene, { isSoftware: sharedBundle.isSoftware, intensityScale: 1.05 });

    sharedCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 90);
  }
  return { bundle: sharedBundle, scene: sharedScene!, camera: sharedCamera! };
}

function frameAndRender(
  obj: THREE.Object3D,
  mode: 'item' | 'room' = 'item',
  backgroundHex?: string,
): string {
  const { bundle, scene, camera } = ensureSnapshotRig();

  const prevBg = scene.background;
  if (mode === 'room' && backgroundHex) {
    scene.background = new THREE.Color(backgroundHex);
  } else {
    scene.background = null;
  }

  const holder = new THREE.Group();
  if (mode === 'room') {
    holder.add(obj);
    scene.add(holder);
    camera.fov = 42;
    camera.updateProjectionMatrix();
    camera.position.set(0, 4.1, 8.2);
    camera.lookAt(0, 0.9, -0.8);
  } else {
    // Centraliza objeto pela bounding box
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    obj.position.sub(center);
    holder.add(obj);
    holder.rotation.y = 0.35;
    scene.add(holder);

    camera.fov = 34;
    camera.updateProjectionMatrix();
    const maxDim = Math.max(size.x, size.y, size.z, 0.28);
    const dist = (maxDim / 2) / Math.tan((camera.fov * Math.PI) / 360) * 1.48;
    camera.position.set(0, maxDim * 0.14, dist);
    camera.lookAt(0, 0, 0);
  }

  bundle.renderer.render(scene, camera);
  flushSoftwareFrame(bundle.renderer, bundle.isSoftware);
  const dataUrl = bundle.renderer.domElement.toDataURL('image/png');

  scene.background = prevBg;
  scene.remove(holder);
  disposeObject3D(holder);
  return dataUrl;
}

function processQueue() {
  if (processing) return;
  const next = jobQueue.shift();
  if (!next) return;

  processing = true;
  requestAnimationFrame(() => {
    try {
      queuedKeys.delete(next.key);
      if (!dataUrlCache.has(next.key)) {
        const obj = next.build();
        const url = frameAndRender(obj, next.mode ?? 'item', next.backgroundHex);
        dataUrlCache.set(next.key, url);
        const cbs = listeners.get(next.key);
        if (cbs) {
          listeners.delete(next.key);
          for (const cb of cbs) cb(url);
        }
      }
    } catch {
      listeners.delete(next.key);
    } finally {
      processing = false;
      if (jobQueue.length > 0) {
        processQueue();
      }
    }
  });
}

export function getCachedThumbnail(key: string): string | undefined {
  return dataUrlCache.get(key);
}

export function requestClothingThumbnail(
  item: ClothingItem,
  genderHint: AvatarGender,
  onReady: (url: string) => void
): () => void {
  const key = `cloth_${item.id}_${item.swatchColor}_${genderHint}`;
  const hit = dataUrlCache.get(key);
  if (hit) {
    onReady(hit);
    return () => {};
  }

  const list = listeners.get(key) || [];
  list.push(onReady);
  listeners.set(key, list);

  if (!queuedKeys.has(key)) {
    queuedKeys.add(key);
    jobQueue.push({
      key,
      build: () => buildStandaloneItem3D(item, genderHint),
    });
    processQueue();
  }

  return () => {
    const arr = listeners.get(key);
    if (!arr) return;
    const filtered = arr.filter((fn) => fn !== onReady);
    if (filtered.length === 0) {
      listeners.delete(key);
    } else {
      listeners.set(key, filtered);
    }
  };
}

export function requestFurnitureThumbnail(
  def: FurnitureDef,
  onReady: (url: string) => void
): () => void {
  const key = `furn_${def.id}_${def.swatchColor || ''}`;
  const hit = dataUrlCache.get(key);
  if (hit) {
    onReady(hit);
    return () => {};
  }

  const list = listeners.get(key) || [];
  list.push(onReady);
  listeners.set(key, list);

  if (!queuedKeys.has(key)) {
    queuedKeys.add(key);
    jobQueue.push({
      key,
      build: () => buildFurniture3D(def),
    });
    processQueue();
  }

  return () => {
    const arr = listeners.get(key);
    if (!arr) return;
    const filtered = arr.filter((fn) => fn !== onReady);
    if (filtered.length === 0) {
      listeners.delete(key);
    } else {
      listeners.set(key, filtered);
    }
  };
}

export function requestRoomStageThumbnail(
  theme: RoomBackdropTheme,
  wallpaper: PurchasableWallpaperItem | undefined,
  onReady: (url: string) => void
): () => void {
  const key = `room_${theme}_${wallpaper?.id || 'base'}`;
  const hit = dataUrlCache.get(key);
  if (hit) {
    onReady(hit);
    return () => {};
  }

  const list = listeners.get(key) || [];
  list.push(onReady);
  listeners.set(key, list);

  if (!queuedKeys.has(key)) {
    queuedKeys.add(key);
    const bgHex =
      theme === 'floresta_piquenique'
        ? '#7DD3FC'
        : theme === 'ilha_coqueiro' || theme === 'ilha_tropical'
          ? '#38BDF8'
          : theme === 'boate_neon'
            ? '#07040F'
            : theme === 'chao_plano_custom'
              ? '#E2E8F0'
              : undefined;
    jobQueue.push({
      key,
      mode: 'room',
      backgroundHex: bgHex,
      build: () =>
        buildRoomStage3D({
          theme,
          wallpaper,
          includeDjBooth:
            theme === 'lounge_party' ||
            theme === 'boate_neon' ||
            theme === 'ilha_tropical' ||
            theme === 'ilha_coqueiro' ||
            theme === 'floresta_piquenique',
        }).group,
    });
    processQueue();
  }

  return () => {
    const arr = listeners.get(key);
    if (!arr) return;
    const filtered = arr.filter((fn) => fn !== onReady);
    if (filtered.length === 0) {
      listeners.delete(key);
    } else {
      listeners.set(key, filtered);
    }
  };
}
