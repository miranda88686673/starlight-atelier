import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  ClothingItem,
  PurchasableWallpaperItem,
  RoomAvatarPresence,
  RoomDef,
  RoomInteractiveProp,
} from '../../types/game';
import {
  createStudioLighting,
  createStudioRenderer,
  disposeObject3D,
  flushSoftwareFrame,
} from '../../three/studioEngine';
import { createAvatar3DRig, updateAvatarPose, type Avatar3DRig } from '../../three/avatar3d';
import { attachClothingAndHair3D } from '../../three/clothing3d';
import {
  buildRoomStage3D,
  roomPctToWorld,
  worldToRoomPct,
  type BuiltRoomStage3D,
} from '../../three/roomScenes3d';

interface Room3DViewportProps {
  room: RoomDef;
  wallpaper?: PurchasableWallpaperItem;
  presences: RoomAvatarPresence[];
  currentClientId: string;
  clothingCatalog: ClothingItem[];
  djPlaying: boolean;
  onWalkTo: (xPct: number, yPct: number, facing: 'left' | 'right') => void;
  onClickProp: (prop: RoomInteractiveProp) => void;
  onClickDjBooth: () => void;
  onClickAvatar: (presence: RoomAvatarPresence) => void;
}

interface ProjectedLabel {
  clientId: string;
  username: string;
  screenX: number;
  screenY: number;
  isMe: boolean;
  isVip?: boolean;
  staffRoleTier?: string;
  lastMessage?: string;
  showBubble: boolean;
}

interface AvatarEntry {
  rig: Avatar3DRig;
  signature: string;
  curX: number;
  curZ: number;
  tgtX: number;
  tgtZ: number;
  rotY: number;
  isSeated: boolean;
}

export const Room3DViewport: React.FC<Room3DViewportProps> = ({
  room,
  wallpaper,
  presences,
  currentClientId,
  clothingCatalog,
  djPlaying,
  onWalkTo,
  onClickProp,
  onClickDjBooth,
  onClickAvatar,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const stageRef = useRef<BuiltRoomStage3D | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarsMapRef = useRef<Map<string, AvatarEntry>>(new Map());

  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const presencesRef = useRef<RoomAvatarPresence[]>(presences);
  presencesRef.current = presences;

  const roomRef = useRef<RoomDef>(room);
  roomRef.current = room;

  const djPlayingRef = useRef<boolean>(djPlaying);
  djPlayingRef.current = djPlaying;

  const callbacksRef = useRef({ onWalkTo, onClickProp, onClickDjBooth, onClickAvatar });
  callbacksRef.current = { onWalkTo, onClickProp, onClickDjBooth, onClickAvatar };

  // Inicialização WebGL + Cena + OrbitControls + Raycast
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const bundle = createStudioRenderer(canvas, { alpha: false, antialias: true });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#14101C');
    scene.environment = bundle.envTarget.texture;
    sceneRef.current = scene;

    createStudioLighting(scene, { isSoftware: bundle.isSoftware, intensityScale: 1.05 });

    const w = container.clientWidth || 920;
    const h = container.clientHeight || 520;
    bundle.renderer.setSize(w, h, false);

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.2, 50);
    camera.position.set(0, 4.8, 9.4);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4.6;
    controls.maxDistance = 14.2;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.minAzimuthAngle = -Math.PI * 0.38;
    controls.maxAzimuthAngle = Math.PI * 0.38;
    controls.target.set(0, 0.9, -0.4);
    controls.update();

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      bundle.renderer.setSize(rect.width, rect.height, false);
    });
    ro.observe(container);

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      const stage = stageRef.current;

      // 1. Clique em avatar
      const avatarRoots = Array.from(avatarsMapRef.current.values()).map((a) => a.rig.root);
      const avHits = raycaster.intersectObjects(avatarRoots, true);
      if (avHits.length > 0) {
        let cur: THREE.Object3D | null = avHits[0].object;
        while (cur && !cur.userData.clientId) cur = cur.parent;
        if (cur?.userData.clientId) {
          const found = presencesRef.current.find((p) => p.clientId === cur?.userData.clientId);
          if (found) {
            callbacksRef.current.onClickAvatar(found);
            return;
          }
        }
      }

      // 2. Clique na cabine de DJ 3D
      if (stage?.djBoothGroup) {
        const djHits = raycaster.intersectObject(stage.djBoothGroup, true);
        if (djHits.length > 0) {
          callbacksRef.current.onClickDjBooth();
          return;
        }
      }

      // 3. Clique em móvel interativo (cadeira/sofá)
      if (stage && stage.propMeshes.size > 0) {
        const propRoots = Array.from(stage.propMeshes.values());
        const propHits = raycaster.intersectObjects(propRoots, true);
        if (propHits.length > 0) {
          let cur: THREE.Object3D | null = propHits[0].object;
          while (cur && !cur.userData.propId) cur = cur.parent;
          const propObj = roomRef.current.interactiveProps?.find(
            (pr) => pr.id === cur?.userData.propId
          );
          if (propObj) {
            callbacksRef.current.onClickProp(propObj);
            return;
          }
        }
      }

      // 4. Clique no piso para caminhar
      if (stage?.floorMesh) {
        const floorHits = raycaster.intersectObject(stage.floorMesh, false);
        if (floorHits.length > 0) {
          const pt = floorHits[0].point;
          const pct = worldToRoomPct(pt.x, pt.z);
          const me = presencesRef.current.find((p) => p.clientId === currentClientId);
          const curPctX = me?.x ?? 50;
          const clampedY = Math.max(
            roomRef.current.walkMinY,
            Math.min(roomRef.current.walkMaxY, pct.y)
          );
          callbacksRef.current.onWalkTo(
            pct.x,
            clampedY,
            pct.x >= curPctX ? 'right' : 'left'
          );
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

    let rafId = 0;
    let lastDraw = 0;
    let lastLabelSync = 0;
    const clock = new THREE.Clock();
    const projVec = new THREE.Vector3();

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (bundle.isSoftware && now - lastDraw < 65) return;
      lastDraw = now;

      const t = clock.getElapsedTime();

      // Anima cabine de DJ
      const stage = stageRef.current;
      if (stage && djPlayingRef.current) {
        for (const disc of stage.djDiscs) {
          disc.rotation.y += 0.08;
        }
        stage.eqBars.forEach((bar, idx) => {
          bar.scale.y = 0.6 + Math.abs(Math.sin(t * 7.5 + idx * 0.9)) * 1.4;
        });
      }

      // Atualiza avatares 3D
      for (const entry of avatarsMapRef.current.values()) {
        const dx = entry.tgtX - entry.curX;
        const dz = entry.tgtZ - entry.curZ;
        const dist = Math.hypot(dx, dz);
        const isWalking = dist > 0.05 && !entry.isSeated;
        if (dist > 0.01) {
          entry.curX = THREE.MathUtils.lerp(entry.curX, entry.tgtX, 0.12);
          entry.curZ = THREE.MathUtils.lerp(entry.curZ, entry.tgtZ, 0.12);
          if (isWalking) {
            entry.rotY = Math.atan2(dx, dz);
          }
        }
        entry.rig.root.position.set(entry.curX, 0, entry.curZ);
        entry.rig.root.rotation.y = entry.rotY;
        updateAvatarPose(
          entry.rig,
          entry.isSeated ? 'sit' : isWalking ? 'walk' : 'idle',
          t
        );
      }

      controls.update();
      bundle.renderer.render(scene, camera);
      flushSoftwareFrame(bundle.renderer, bundle.isSoftware);

      // Atualiza tags HTML projetadas (~15Hz) para evitar re-render React em todo frame
      if (now - lastLabelSync > 66) {
        lastLabelSync = now;
        const vw = container.clientWidth || 920;
        const vh = container.clientHeight || 520;
        const nowMs = Date.now();
        const nextLabels: ProjectedLabel[] = [];

        for (const p of presencesRef.current) {
          const entry = avatarsMapRef.current.get(p.clientId);
          if (!entry) continue;
          projVec.set(entry.curX, entry.rig.metrics.totalHeight + 0.18, entry.curZ);
          projVec.project(camera);
          if (projVec.z > 1) continue;
          const sx = (projVec.x * 0.5 + 0.5) * vw;
          const sy = (-projVec.y * 0.5 + 0.5) * vh;
          const showBubble = Boolean(
            p.lastMessage && p.lastMessageAt && nowMs - p.lastMessageAt < 6500
          );
          nextLabels.push({
            clientId: p.clientId,
            username: p.username,
            screenX: sx,
            screenY: sy,
            isMe: p.clientId === currentClientId,
            isVip: p.isVip,
            staffRoleTier: p.staffRoleTier,
            lastMessage: p.lastMessage,
            showBubble,
          });
        }
        setLabels(nextLabels);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      ro.disconnect();
      controls.dispose();
      avatarsMapRef.current.clear();
      disposeObject3D(scene);
      bundle.dispose();
    };
  }, [currentClientId]);

  // Reconstrói palco da sala quando troca de sala ou papel de parede
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (stageRef.current) {
      scene.remove(stageRef.current.group);
      disposeObject3D(stageRef.current.group);
      stageRef.current = null;
    }
    const built = buildRoomStage3D({
      theme: room.backdropTheme,
      wallpaper,
      interactiveProps: room.interactiveProps,
      includeDjBooth: room.id === 'lounge_party' || room.backdropTheme === 'lounge_party' || room.backdropTheme === 'boate_neon',
    });
    scene.add(built.group);
    stageRef.current = built;
  }, [room.id, room.backdropTheme, room.interactiveProps, wallpaper]);

  // Sincroniza avatares 3D conectados na sala
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const activeIds = new Set(presences.map((p) => p.clientId));

    // Remove quem saiu da sala
    for (const [cid, entry] of avatarsMapRef.current.entries()) {
      if (!activeIds.has(cid)) {
        scene.remove(entry.rig.root);
        disposeObject3D(entry.rig.root);
        avatarsMapRef.current.delete(cid);
      }
    }

    // Adiciona ou atualiza avatares presentes
    for (const p of presences) {
      const world = roomPctToWorld(p.x, p.y);
      const sig = `${p.avatarGender}|${p.skinTone}|${JSON.stringify(p.equipped || {})}`;
      const existing = avatarsMapRef.current.get(p.clientId);

      if (!existing || existing.signature !== sig) {
        if (existing) {
          scene.remove(existing.rig.root);
          disposeObject3D(existing.rig.root);
        }
        const rig = createAvatar3DRig({
          avatarGender: p.avatarGender || 'feminino',
          skinTone: p.skinTone || 'pessego',
          withShadowDisc: true,
        });
        rig.root.userData.clientId = p.clientId;
        attachClothingAndHair3D(rig, p.equipped || {}, clothingCatalog);

        const curX = existing ? existing.curX : world.x;
        const curZ = existing ? existing.curZ : world.z;
        rig.root.position.set(curX, 0, curZ);
        scene.add(rig.root);

        avatarsMapRef.current.set(p.clientId, {
          rig,
          signature: sig,
          curX,
          curZ,
          tgtX: world.x,
          tgtZ: world.z,
          rotY: p.facing === 'left' ? -Math.PI * 0.15 : Math.PI * 0.15,
          isSeated: Boolean(p.isSeated),
        });
      } else {
        existing.tgtX = world.x;
        existing.tgtZ = world.z;
        existing.isSeated = Boolean(p.isSeated);
        if (existing.isSeated) {
          existing.rotY = 0;
        }
      }
    }
  }, [presences, clothingCatalog]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[480px] sm:h-[520px] rounded-2xl overflow-hidden border border-stone-800 bg-[#14101C] select-none"
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

      {/* Tags 2D projetadas dos avatares e balões de chat (sem backdrop-blur para performance WebGL) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {labels.map((lbl) => (
          <div
            key={lbl.clientId}
            className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center gap-1"
            style={{ left: `${lbl.screenX}px`, top: `${lbl.screenY}px` }}
          >
            {lbl.showBubble && lbl.lastMessage && (
              <div className="max-w-[200px] bg-white text-stone-900 text-[11px] font-medium px-2.5 py-1.5 rounded-xl shadow-lg border border-stone-300 text-center break-words">
                {lbl.lastMessage}
              </div>
            )}
            <div
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow border whitespace-nowrap ${
                lbl.isMe
                  ? 'bg-[#8B1538] text-white border-amber-300'
                  : lbl.staffRoleTier
                    ? 'bg-amber-600 text-white border-amber-200'
                    : lbl.isVip
                      ? 'bg-stone-900 text-amber-300 border-amber-400'
                      : 'bg-stone-900/90 text-white border-white/20'
              }`}
            >
              {lbl.username}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
