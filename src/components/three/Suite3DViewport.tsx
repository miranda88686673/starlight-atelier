import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  AvatarGender,
  ClothingItem,
  EquippedOutfit,
  FurnitureDef,
  PlacedFurniture,
  PurchasableWallpaperItem,
  SkinToneId,
  SuiteAvatarPosition,
  SuiteThemeId,
} from '../../types/game';
import {
  createStudioLighting,
  createStudioRenderer,
  disposeObject3D,
  flushSoftwareFrame,
} from '../../three/studioEngine';
import { createAvatar3DRig, updateAvatarPose, type Avatar3DRig } from '../../three/avatar3d';
import { attachClothingAndHair3D } from '../../three/clothing3d';
import { buildFurniture3D } from '../../three/furniture3d';
import {
  buildRoomStage3D,
  suitePxToWorld,
  suiteThemeToBackdrop,
  worldToSuitePx,
} from '../../three/roomScenes3d';

interface Suite3DViewportProps {
  theme: SuiteThemeId;
  wallpaper?: PurchasableWallpaperItem;
  items: PlacedFurniture[];
  furnitureCatalog: FurnitureDef[];
  selectedInstanceId: string | null;
  onSelectFurniture: (instanceId: string | null) => void;
  onMoveFurniture: (instanceId: string, x: number, y: number) => void;
  avatarPos: SuiteAvatarPosition;
  onWalkAvatar: (x: number, y: number, facingRight: boolean) => void;
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  clothingCatalog: ClothingItem[];
}

export const Suite3DViewport: React.FC<Suite3DViewportProps> = ({
  theme,
  wallpaper,
  items,
  furnitureCatalog,
  selectedInstanceId,
  onSelectFurniture,
  onMoveFurniture,
  avatarPos,
  onWalkAvatar,
  equipped,
  skinTone,
  avatarGender,
  clothingCatalog,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const stageGroupRef = useRef<THREE.Group | null>(null);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const avatarRigRef = useRef<Avatar3DRig | null>(null);
  const furnGroupMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const selectionRingRef = useRef<THREE.Mesh | null>(null);

  const targetAvatarWorldRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const currentAvatarWorldRef = useRef<{ x: number; z: number; rotY: number }>({
    x: 0,
    z: 0,
    rotY: 0,
  });

  const callbacksRef = useRef({
    onSelectFurniture,
    onMoveFurniture,
    onWalkAvatar,
  });
  callbacksRef.current = { onSelectFurniture, onMoveFurniture, onWalkAvatar };

  const selectedRef = useRef<string | null>(selectedInstanceId);
  selectedRef.current = selectedInstanceId;

  // Atualiza posição-alvo do avatar
  useEffect(() => {
    const w = suitePxToWorld(avatarPos.x, avatarPos.y);
    targetAvatarWorldRef.current = w;
  }, [avatarPos.x, avatarPos.y]);

  // Inicialização WebGL + Cena + OrbitControls + Raycast
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const bundle = createStudioRenderer(canvas, { alpha: false, antialias: true });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#201A1E');
    scene.environment = bundle.envTarget.texture;
    sceneRef.current = scene;

    createStudioLighting(scene, { isSoftware: bundle.isSoftware, intensityScale: 1.05 });

    const w = container.clientWidth || 880;
    const h = container.clientHeight || 520;
    bundle.renderer.setSize(w, h, false);

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.2, 45);
    camera.position.set(0, 4.4, 8.2);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4.2;
    controls.maxDistance = 12.5;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.minAzimuthAngle = -Math.PI * 0.36;
    controls.maxAzimuthAngle = Math.PI * 0.36;
    controls.target.set(0, 0.85, -0.35);
    controls.update();
    controlsRef.current = controls;

    // Anel seletor de móveis 3D
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.72, 32),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    ring.visible = false;
    scene.add(ring);
    selectionRingRef.current = ring;

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      bundle.renderer.setSize(rect.width, rect.height, false);
    });
    ro.observe(container);

    // Interação de ponteiro (arrastar móvel no piso OU clicar no piso para caminhar)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();

    let draggingInstanceId: string | null = null;
    let downX = 0;
    let downY = 0;
    let moved = false;

    const getNdc = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
      moved = false;
      getNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);

      const furnRoots = Array.from(furnGroupMapRef.current.values());
      const hits = raycaster.intersectObjects(furnRoots, true);
      if (hits.length > 0) {
        let cur: THREE.Object3D | null = hits[0].object;
        while (cur && !cur.userData.instanceId) {
          cur = cur.parent;
        }
        if (cur?.userData.instanceId) {
          draggingInstanceId = String(cur.userData.instanceId);
          callbacksRef.current.onSelectFurniture(draggingInstanceId);
          controls.enabled = false;
        }
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 4) {
        moved = true;
      }
      if (!draggingInstanceId) return;
      getNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);
      if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
        const clampedX = Math.max(-5.0, Math.min(5.0, hitPoint.x));
        const clampedZ = Math.max(-2.6, Math.min(2.8, hitPoint.z));
        const grp = furnGroupMapRef.current.get(draggingInstanceId);
        if (grp) {
          grp.position.set(clampedX, 0, clampedZ);
        }
        if (selectionRingRef.current && selectedRef.current === draggingInstanceId) {
          selectionRingRef.current.position.set(clampedX, 0.015, clampedZ);
        }
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (draggingInstanceId) {
        const grp = furnGroupMapRef.current.get(draggingInstanceId);
        if (grp && moved) {
          const px = worldToSuitePx(grp.position.x, grp.position.z);
          callbacksRef.current.onMoveFurniture(draggingInstanceId, px.x, px.y);
        }
        draggingInstanceId = null;
        controls.enabled = true;
        return;
      }

      if (!moved && floorMeshRef.current) {
        getNdc(ev);
        raycaster.setFromCamera(pointerNdc, camera);
        const floorHit = raycaster.intersectObject(floorMeshRef.current, false);
        if (floorHit.length > 0) {
          const pt = floorHit[0].point;
          const clampedX = Math.max(-5.0, Math.min(5.0, pt.x));
          const clampedZ = Math.max(-2.5, Math.min(2.8, pt.z));
          const px = worldToSuitePx(clampedX, clampedZ);
          callbacksRef.current.onSelectFurniture(null);
          callbacksRef.current.onWalkAvatar(
            px.x,
            px.y,
            clampedX >= currentAvatarWorldRef.current.x
          );
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    let rafId = 0;
    let lastDraw = 0;
    const clock = new THREE.Clock();

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (bundle.isSoftware && now - lastDraw < 65) return;
      lastDraw = now;

      const t = clock.getElapsedTime();
      const rig = avatarRigRef.current;
      if (rig) {
        const cur = currentAvatarWorldRef.current;
        const tgt = targetAvatarWorldRef.current;
        const dx = tgt.x - cur.x;
        const dz = tgt.z - cur.z;
        const dist = Math.hypot(dx, dz);
        const isWalking = dist > 0.06;

        if (isWalking) {
          cur.x = THREE.MathUtils.lerp(cur.x, tgt.x, 0.09);
          cur.z = THREE.MathUtils.lerp(cur.z, tgt.z, 0.09);
          const targetRot = Math.atan2(dx, dz);
          cur.rotY = targetRot;
        }
        rig.root.position.set(cur.x, 0, cur.z);
        rig.root.rotation.y = cur.rotY;
        updateAvatarPose(rig, isWalking ? 'walk' : 'idle', t);
      }

      controls.update();
      bundle.renderer.render(scene, camera);
      flushSoftwareFrame(bundle.renderer, bundle.isSoftware);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      ro.disconnect();
      controls.dispose();
      furnGroupMapRef.current.clear();
      disposeObject3D(scene);
      bundle.dispose();
    };
  }, []);

  // Reconstrói palco da Suíte ao trocar tema ou papel de parede
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (stageGroupRef.current) {
      scene.remove(stageGroupRef.current);
      disposeObject3D(stageGroupRef.current);
      stageGroupRef.current = null;
    }
    const built = buildRoomStage3D({
      theme: suiteThemeToBackdrop(theme),
      wallpaper,
      includeDjBooth: false,
    });
    scene.add(built.group);
    stageGroupRef.current = built.group;
    floorMeshRef.current = built.floorMesh;
  }, [theme, wallpaper]);

  // Reconstrói avatar da dona/dono da Suíte
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (avatarRigRef.current) {
      scene.remove(avatarRigRef.current.root);
      disposeObject3D(avatarRigRef.current.root);
      avatarRigRef.current = null;
    }
    const rig = createAvatar3DRig({ avatarGender, skinTone, withShadowDisc: true });
    const startW = suitePxToWorld(avatarPos.x, avatarPos.y);
    currentAvatarWorldRef.current.x = startW.x;
    currentAvatarWorldRef.current.z = startW.z;
    targetAvatarWorldRef.current = startW;
    rig.root.position.set(startW.x, 0, startW.z);
    scene.add(rig.root);
    avatarRigRef.current = rig;
    attachClothingAndHair3D(rig, equipped, clothingCatalog);
  }, [avatarGender, skinTone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!avatarRigRef.current) return;
    attachClothingAndHair3D(avatarRigRef.current, equipped, clothingCatalog);
  }, [equipped, clothingCatalog]);

  // Sincroniza móveis 3D posicionados na Suíte
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    for (const grp of furnGroupMapRef.current.values()) {
      scene.remove(grp);
      disposeObject3D(grp);
    }
    furnGroupMapRef.current.clear();

    const byId = new Map(furnitureCatalog.map((f) => [f.id, f]));
    for (const placed of items) {
      const def = byId.get(placed.furnitureId);
      if (!def) continue;
      const grp = buildFurniture3D(def);
      grp.userData.instanceId = placed.instanceId;
      const w = suitePxToWorld(placed.x, placed.y);
      grp.position.set(w.x, 0, w.z);
      const rotDeg = placed.rotationY ?? (placed.flipped ? 180 : 0);
      grp.rotation.y = (rotDeg * Math.PI) / 180;
      scene.add(grp);
      furnGroupMapRef.current.set(placed.instanceId, grp);
    }

    if (selectionRingRef.current) {
      const selGrp = selectedInstanceId ? furnGroupMapRef.current.get(selectedInstanceId) : undefined;
      if (selGrp) {
        selectionRingRef.current.visible = true;
        selectionRingRef.current.position.set(selGrp.position.x, 0.015, selGrp.position.z);
      } else {
        selectionRingRef.current.visible = false;
      }
    }
  }, [items, furnitureCatalog, selectedInstanceId]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[500px] rounded-2xl overflow-hidden border border-[#E5D7C6] bg-[#1C1917] select-none"
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />
      <div className="absolute top-3 left-3 bg-[#1C1917]/90 text-amber-100 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/15 pointer-events-none">
        Suíte 3D Interativa · Arraste móveis pelo piso, clique para caminhar ou gire a câmera
      </div>
    </div>
  );
};
