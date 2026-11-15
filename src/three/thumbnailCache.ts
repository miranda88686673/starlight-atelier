import * as THREE from 'three';
import type { AvatarGender, ClothingItem, FurnitureDef } from '../types/game';
import { createStudioLighting, createStudioRenderer, disposeObject3D, flushSoftwareFrame, type StudioRendererBundle } from './studioEngine';
import { buildStandaloneItem3D } from './clothing3d';
import { buildFurniture3D } from './furniture3d';

const dataUrlCache = new Map<string, string>();
const listeners = new Map<string, Array<(url: string) => void>>();

interface QueueJob {
  key: string;
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

    sharedCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
  }
  return { bundle: sharedBundle, scene: sharedScene!, camera: sharedCamera! };
}

function frameAndRender(obj: THREE.Object3D): string {
  const { bundle, scene, camera } = ensureSnapshotRig();

  // Centraliza objeto pela bounding box
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  obj.position.sub(center);
  const holder = new THREE.Group();
  holder.add(obj);
  holder.rotation.y = 0.35;
  scene.add(holder);

  const maxDim = Math.max(size.x, size.y, size.z, 0.28);
  const dist = (maxDim / 2) / Math.tan((camera.fov * Math.PI) / 360) * 1.48;
  camera.position.set(0, maxDim * 0.14, dist);
  camera.lookAt(0, 0, 0);

  bundle.renderer.render(scene, camera);
  flushSoftwareFrame(bundle.renderer, bundle.isSoftware);
  const dataUrl = bundle.renderer.domElement.toDataURL('image/png');

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
        const url = frameAndRender(obj);
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
