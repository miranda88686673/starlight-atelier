import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SuiteAvatarPosition } from '../../types/game';
import { updateAvatarPose } from '../../three/avatar3d';
import {
  animateAvatarCompanions,
  syncAvatarAssemblyTransforms,
  type AvatarAssemblyGroup,
} from '../../three/clothing3d';
import { suitePxToWorld, worldToSuitePx } from '../../three/roomScenes3d';
import { useThreeScene } from './ThreeSceneProvider';

interface Suite3DViewportProps {
  selectedInstanceId: string | null;
  onSelectFurniture: (instanceId: string | null) => void;
  onMoveFurniture: (instanceId: string, x: number, y: number) => void;
  avatarPos: SuiteAvatarPosition;
  onWalkAvatar: (x: number, y: number, facingRight: boolean) => void;
  /** Referências aos objetos 3D injetados por SuiteRoom no ThreeSceneProvider */
  avatarAssemblyRef: React.MutableRefObject<AvatarAssemblyGroup | null>;
  furnitureMapRef: React.MutableRefObject<Map<string, THREE.Group>>;
  floorMeshRef: React.MutableRefObject<THREE.Mesh | null>;
  selectionRingRef: React.MutableRefObject<THREE.Mesh | null>;
  currentAvatarWorldRef: React.MutableRefObject<{
    x: number;
    z: number;
    rotY: number;
    initialized: boolean;
  }>;
}

/**
 * Viewport 3D interativa da Suíte conectada ao ThreeSceneProvider centralizado.
 * Acopla o canvas WebGL compartilhado, executa raycasting de móveis/piso e anima a caminhada do avatar injetado.
 */
export const Suite3DViewport: React.FC<Suite3DViewportProps> = ({
  selectedInstanceId,
  onSelectFurniture,
  onMoveFurniture,
  avatarPos,
  onWalkAvatar,
  avatarAssemblyRef,
  furnitureMapRef,
  floorMeshRef,
  selectionRingRef,
  currentAvatarWorldRef,
}) => {
  const three = useThreeScene();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const targetAvatarWorldRef = useRef<{ x: number; z: number }>(
    suitePxToWorld(avatarPos.x, avatarPos.y)
  );

  const callbacksRef = useRef({
    onSelectFurniture,
    onMoveFurniture,
    onWalkAvatar,
  });
  callbacksRef.current = { onSelectFurniture, onMoveFurniture, onWalkAvatar };

  const selectedRef = useRef<string | null>(selectedInstanceId);
  selectedRef.current = selectedInstanceId;

  useEffect(() => {
    targetAvatarWorldRef.current = suitePxToWorld(avatarPos.x, avatarPos.y);
  }, [avatarPos.x, avatarPos.y]);

  useEffect(() => {
    if (!three.isReady || !containerRef.current || !three.canvas || !three.camera || !three.controls) {
      return;
    }

    const canvas = three.canvas;
    const camera = three.camera;
    const controls = three.controls;

    const unmountViewport = three.mountViewport(containerRef.current, {
      backgroundHex: '#201A1E',
      lightingIntensityScale: 1.05,
      fov: 40,
      near: 0.2,
      far: 45,
      position: [0, 4.4, 8.2],
      target: [0, 0.85, -0.35],
      enablePan: false,
      minDistance: 4.2,
      maxDistance: 12.5,
      minPolarAngle: 0.35,
      maxPolarAngle: Math.PI * 0.44,
      minAzimuthAngle: -Infinity,
      maxAzimuthAngle: Infinity,
      cursorClassName: 'cursor-pointer',
    });

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

      const furnRoots = Array.from(furnitureMapRef.current.values());
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
        const grp = furnitureMapRef.current.get(draggingInstanceId);
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
        const grp = furnitureMapRef.current.get(draggingInstanceId);
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

    const unregisterTick = three.registerFrameTick('suite-viewport', (dt, t) => {
      const assembly = avatarAssemblyRef.current;
      if (!assembly) return;

      const cur = currentAvatarWorldRef.current;
      const tgt = targetAvatarWorldRef.current;
      const dx = tgt.x - cur.x;
      const dz = tgt.z - cur.z;
      const dist = Math.hypot(dx, dz);
      const isWalking = dist > 0.06;

      if (isWalking) {
        cur.x = THREE.MathUtils.damp(cur.x, tgt.x, 5.5, dt);
        cur.z = THREE.MathUtils.damp(cur.z, tgt.z, 5.5, dt);
        cur.rotY = Math.atan2(dx, dz);
      }
      assembly.rootGroup.position.set(cur.x, 0, cur.z);
      assembly.rootGroup.rotation.y = cur.rotY;

      if (assembly.gltfResult?.mixer) {
        assembly.gltfResult.mixer.update(dt);
      } else if (assembly.proceduralRig) {
        updateAvatarPose(assembly.proceduralRig, isWalking ? 'walk' : 'idle', t);
      }
      animateAvatarCompanions(assembly.rootGroup, t);
      syncAvatarAssemblyTransforms(assembly);
    });

    return () => {
      unregisterTick();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      controls.enabled = true;
      unmountViewport();
    };
  }, [
    three,
    three.isReady,
    avatarAssemblyRef,
    furnitureMapRef,
    floorMeshRef,
    selectionRingRef,
    currentAvatarWorldRef,
  ]);

  return (
    <div className="relative w-full h-[500px] rounded-2xl overflow-hidden border border-[#E5D7C6] bg-[#1C1917] select-none">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-3 left-3 bg-[#1C1917]/90 text-amber-100 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/15 pointer-events-none">
        Suíte 3D Interativa · Arraste móveis pelo piso, clique para caminhar ou gire a câmera
      </div>
    </div>
  );
};
