import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Crosshair, RotateCw, ShieldCheck, Trash2 } from 'lucide-react';
import type {
  ClothingItem,
  PurchasableWallpaperItem,
  RoomAvatarPresence,
  RoomDef,
  RoomInteractiveProp,
  StaffRoleTier,
} from '../../types/game';
import {
  createStudioLighting,
  createStudioRenderer,
  disposeObject3D,
  flushSoftwareFrame,
} from '../../three/studioEngine';
import { createAvatar3DRig, updateAvatarPose, type Avatar3DRig } from '../../three/avatar3d';
import {
  animateAvatarCompanions,
  attachClothingAndHair3D,
} from '../../three/clothing3d';
import {
  buildRoomStage3D,
  roomPctToWorld,
  worldToRoomPct,
  type BuiltRoomStage3D,
} from '../../three/roomScenes3d';
import { DEFAULT_STAFF_ROLE_TITLES } from '../../utils/storage';

export interface ProjectedDjScreenRect {
  visible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Room3DViewportProps {
  room: RoomDef;
  wallpaper?: PurchasableWallpaperItem;
  presences: RoomAvatarPresence[];
  currentClientId: string;
  clothingCatalog: ClothingItem[];
  djPlaying: boolean;
  djHasTrack?: boolean;
  canEditProps?: boolean;
  onPropMoved?: (propId: string, xPct: number, yPct: number) => void;
  onPropRotated?: (propId: string, rotationY: number) => void;
  onPropDeleted?: (propId: string) => void;
  onProjectDjScreen?: (rect: ProjectedDjScreenRect | null) => void;
  onWalkTo: (xPct: number, yPct: number, facing: 'left' | 'right') => void;
  onClickProp: (prop: RoomInteractiveProp) => void;
  onClickDjBooth: () => void;
  onClickAvatar: (presence: RoomAvatarPresence) => void;
}

interface ProjectedLabel {
  clientId: string;
  username: string;
  level?: number;
  officialRoleLabel?: string;
  screenX: number;
  screenY: number;
  headScreenX: number;
  headScreenY: number;
  isMe: boolean;
  isVip?: boolean;
  isStaff: boolean;
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
  djHasTrack = false,
  canEditProps = false,
  onPropMoved,
  onPropRotated,
  onPropDeleted,
  onProjectDjScreen,
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
  const controlsRef = useRef<OrbitControls | null>(null);
  const customBgTextureRef = useRef<THREE.Texture | null>(null);
  const avatarsMapRef = useRef<Map<string, AvatarEntry>>(new Map());

  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [gizmoPos, setGizmoPos] = useState<{ x: number; y: number; visible: boolean } | null>(null);

  const presencesRef = useRef<RoomAvatarPresence[]>(presences);
  presencesRef.current = presences;

  const roomRef = useRef<RoomDef>(room);
  roomRef.current = room;

  const djPlayingRef = useRef<boolean>(djPlaying);
  djPlayingRef.current = djPlaying;

  const onProjectDjScreenRef = useRef(onProjectDjScreen);
  onProjectDjScreenRef.current = onProjectDjScreen;

  const canEditPropsRef = useRef(canEditProps);
  canEditPropsRef.current = canEditProps;

  const selectedPropIdRef = useRef<string | null>(selectedPropId);
  selectedPropIdRef.current = selectedPropId;

  const onPropMovedRef = useRef(onPropMoved);
  onPropMovedRef.current = onPropMoved;

  const onPropRotatedRef = useRef(onPropRotated);
  onPropRotatedRef.current = onPropRotated;

  const onPropDeletedRef = useRef(onPropDeleted);
  onPropDeletedRef.current = onPropDeleted;

  const callbacksRef = useRef({ onWalkTo, onClickProp, onClickDjBooth, onClickAvatar });
  callbacksRef.current = { onWalkTo, onClickProp, onClickDjBooth, onClickAvatar };

  // Web Audio ambient sound for official rooms (Ocean & Seagulls for Island rooms, City Street for Lounge rooms)
  useEffect(() => {
    const roomId = room.id;
    const isIsland = roomId.includes('ilha');
    const isLounge = roomId.includes('lounge');
    if (!isIsland && !isLounge) return;

    let audioCtx: AudioContext | null = null;
    let noiseNode: AudioNode | null = null;
    let timer: number | null = null;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtx();

      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      const gainNode = audioCtx.createGain();

      if (isIsland) {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        whiteNoise.start();

        // Seagull chirps
        timer = window.setInterval(() => {
          if (!audioCtx || audioCtx.state === 'closed') return;
          const t = audioCtx.currentTime;
          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1300, t);
          osc.frequency.exponentialRampToValueAtTime(1750, t + 0.12);
          osc.frequency.exponentialRampToValueAtTime(950, t + 0.28);
          g.gain.setValueAtTime(0.012, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
          osc.connect(g);
          g.connect(audioCtx.destination);
          osc.start(t);
          osc.stop(t + 0.3);
        }, 5000);
      } else if (isLounge) {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(220, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        whiteNoise.start();
      }

      noiseNode = whiteNoise;
    } catch {
      // Audio restrictions
    }

    return () => {
      if (timer) clearInterval(timer);
      if (noiseNode) {
        try { (noiseNode as AudioBufferSourceNode).stop(); } catch {}
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, [room.id]);

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

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.2, 160);
    camera.position.set(0, 4.9, 9.6);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 1.05;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.4;
    controls.maxDistance = 36;
    controls.minPolarAngle = 0.02;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.target.set(0, 0.9, -0.4);
    controls.update();
    controlsRef.current = controls;

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
    const dragGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragGroundHit = new THREE.Vector3();
    let downX = 0;
    let downY = 0;
    let draggingPropId: string | null = null;
    let isDragging = false;
    let dragStartPointer = { x: 0, y: 0 };
    let currentDraggedMesh: THREE.Group | null = null;

    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
      dragStartPointer = { x: ev.clientX, y: ev.clientY };

      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      const stage = stageRef.current;
      if (canEditPropsRef.current && stage && stage.propMeshes.size > 0) {
        const propRoots = Array.from(stage.propMeshes.values());
        const hits = raycaster.intersectObjects(propRoots, true);
        if (hits.length > 0) {
          let cur: THREE.Object3D | null = hits[0].object;
          while (cur && !cur.userData.propId) cur = cur.parent;
          if (cur?.userData.propId) {
            const pid = String(cur.userData.propId);
            draggingPropId = pid;
            currentDraggedMesh = stage.propMeshes.get(pid) ?? null;
          }
        }
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;

      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

      // Se temos um prop selecionado e o cursor está arrastando
      if (draggingPropId && currentDraggedMesh && canEditPropsRef.current) {
        if (!isDragging && Math.hypot(ev.clientX - dragStartPointer.x, ev.clientY - dragStartPointer.y) > 4) {
          isDragging = true;
          controls.enabled = false;
          canvas.style.cursor = 'grabbing';
        }
        if (isDragging) {
          raycaster.setFromCamera(pointerNdc, camera);
          let pt: THREE.Vector3 | null = null;
          if (stage.floorMesh) {
            const floorHits = raycaster.intersectObject(stage.floorMesh, false);
            if (floorHits.length > 0) {
              pt = floorHits[0].point;
            }
          }
          if (!pt && raycaster.ray.intersectPlane(dragGroundPlane, dragGroundHit)) {
            pt = dragGroundHit;
          }
          if (pt) {
            const clampedX = Math.max(-7.55, Math.min(7.55, pt.x));
            const clampedZ = Math.max(-5.05, Math.min(5.05, pt.z));
            currentDraggedMesh.position.x = clampedX;
            currentDraggedMesh.position.z = clampedZ;
          }
          return;
        }
      }

      // Cursor hover feedback nos objetos
      if (canEditPropsRef.current && stage.propMeshes.size > 0 && !isDragging) {
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(Array.from(stage.propMeshes.values()), true);
        if (hits.length > 0) {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = 'default';
        }
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      const stage = stageRef.current;

      // 1. Se acabou de arrastar um objeto pelo chão com o mouse (sem limite de bordas)
      if (isDragging && draggingPropId && currentDraggedMesh) {
        controls.enabled = true;
        canvas.style.cursor = 'default';
        const pct = worldToRoomPct(currentDraggedMesh.position.x, currentDraggedMesh.position.z);
        const clampedPctX = Math.max(0, Math.min(100, pct.x));
        const clampedPctY = Math.max(0, Math.min(100, pct.y));
        onPropMovedRef.current?.(draggingPropId, clampedPctX, clampedPctY);
        setSelectedPropId(draggingPropId);
        isDragging = false;
        draggingPropId = null;
        currentDraggedMesh = null;
        return;
      }

      // 2. Se clicou em um objeto sem arrastar no modo de edição
      if (!isDragging && draggingPropId && canEditPropsRef.current && ev.button === 0) {
        setSelectedPropId(draggingPropId);
        const propObj = roomRef.current.interactiveProps?.find((p) => p.id === draggingPropId);
        if (propObj) {
          callbacksRef.current.onClickProp(propObj);
        }
        draggingPropId = null;
        currentDraggedMesh = null;
        return;
      }

      draggingPropId = null;
      currentDraggedMesh = null;
      isDragging = false;
      controls.enabled = true;

      // Ignora botão direito/do meio (usados para mover/ajustar câmera livremente)
      if (ev.button !== 0) return;

      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      // Desmarca o gizmo ao clicar fora de um objeto no chão
      setSelectedPropId(null);

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

      // 4. Clique no piso para caminhar livremente por toda a área da sala
      if (stage?.floorMesh) {
        const floorHits = raycaster.intersectObject(stage.floorMesh, false);
        if (floorHits.length > 0) {
          const pt = floorHits[0].point;
          const pct = worldToRoomPct(pt.x, pt.z);
          const me = presencesRef.current.find((p) => p.clientId === currentClientId);
          const curPctX = me?.x ?? 50;
          callbacksRef.current.onWalkTo(
            pct.x,
            pct.y,
            pct.x >= curPctX ? 'right' : 'left'
          );
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);

    let rafId = 0;
    let lastDraw = 0;
    let lastLabelSync = 0;
    const clock = new THREE.Clock();
    const projVec = new THREE.Vector3();
    const cornerTL = new THREE.Vector3();
    const cornerBR = new THREE.Vector3();
    const cornerCenter = new THREE.Vector3();
    const tempClubColor = new THREE.Color();

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (bundle.isSoftware && now - lastDraw < 65) return;
      lastDraw = now;

      const t = clock.getElapsedTime();

      // Anima cabine de DJ, discos e caixas de som
      const stage = stageRef.current;
      if (stage && djPlayingRef.current) {
        for (const disc of stage.djDiscs) {
          disc.rotation.y += 0.08;
        }
        stage.eqBars.forEach((bar, idx) => {
          bar.scale.y = 0.65 + Math.abs(Math.sin(t * 7.5 + idx * 0.9)) * 1.45;
        });
        stage.speakerCones.forEach((cone, idx) => {
          const pulse = 1 + Math.abs(Math.sin(t * 10 + idx * 0.7)) * 0.14;
          cone.scale.set(pulse, 1, pulse);
        });
      }

      // Anima peixes nadando e bolhas subindo nos aquários de luxo do terraço
      if (stage && stage.aquariumFish.length > 0) {
        for (const fish of stage.aquariumFish) {
          const span = (fish.maxCoord - fish.minCoord) * 0.5;
          const mid = (fish.maxCoord + fish.minCoord) * 0.5;
          const arg = t * fish.speed + fish.phase;
          const coord = mid + Math.sin(arg) * span;
          const vel = Math.cos(arg);

          if (fish.axis === 'x') {
            fish.group.position.x = coord;
            fish.group.position.z = fish.baseZ + Math.sin(arg * 1.7) * 0.04;
            fish.group.rotation.y = vel >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
          } else {
            fish.group.position.z = coord;
            fish.group.position.x = fish.baseX + Math.sin(arg * 1.7) * 0.04;
            fish.group.rotation.y = vel >= 0 ? 0 : Math.PI;
          }
          fish.group.position.y = fish.baseY + Math.sin(t * 1.8 + fish.phase) * fish.bobAmp;
          fish.tail.rotation.y = Math.sin(t * (7.5 + fish.speed * 4) + fish.phase) * 0.42;
        }
        for (const bubble of stage.aquariumBubbles) {
          const range = Math.max(0.2, bubble.maxY - bubble.minY);
          const prog = ((t * bubble.speed + bubble.phase) % range + range) % range;
          bubble.mesh.position.y = bubble.minY + prog;
          bubble.mesh.position.x = bubble.baseX + Math.sin(t * 2.5 + bubble.phase) * 0.015;
          bubble.mesh.position.z = bubble.baseZ + Math.cos(t * 2.2 + bubble.phase) * 0.015;
        }
      }

      // Anima peixes saltando na água (mar da ilha ou laguinho da floresta)
      if (stage && stage.jumpingFish.length > 0) {
        const fishHeadingOffset = 0;
        for (const jf of stage.jumpingFish) {
          const baseWaterY = jf.waterY ?? -0.22;
          const cycle = ((t * jf.speed + jf.phase) % 2.4 + 2.4) % 2.4;
          if (cycle <= 1.25) {
            const u = cycle / 1.25; // 0..1 salto parabólico
            const s = (u - 0.5) * jf.arcDistance;
            const dxDir = Math.cos(jf.dirAngle);
            const dzDir = Math.sin(jf.dirAngle);
            const fx = jf.centerX + dxDir * s;
            const fz = jf.centerZ + dzDir * s;
            const arcMax = jf.jumpHeight + 0.25;
            const fy = (baseWaterY - 0.23) + 4 * arcMax * u * (1 - u);

            jf.group.visible = true;
            jf.group.position.set(fx, fy, fz);
            jf.group.rotation.order = 'YXZ';
            jf.group.rotation.y = Math.atan2(dxDir, dzDir) + fishHeadingOffset;
            const dyDu = 4 * arcMax * (1 - 2 * u);
            jf.group.rotation.x = -Math.atan2(dyDu, jf.arcDistance * 1.35);
            jf.tail.rotation.y = Math.sin(t * 14 + jf.phase) * 0.48;

            // Anel de respingo na superfície exata da água (mar ou laguinho)
            const splashMat = jf.splashRing.material as THREE.MeshBasicMaterial;
            if (u < 0.35) {
              const p = u / 0.35;
              jf.splashRing.visible = true;
              jf.splashRing.position.set(
                jf.centerX - dxDir * jf.arcDistance * 0.36,
                baseWaterY + 0.015,
                jf.centerZ - dzDir * jf.arcDistance * 0.36,
              );
              jf.splashRing.scale.setScalar(0.8 + p * 2.6);
              splashMat.opacity = Math.max(0, 0.78 * (1 - p));
            } else if (u > 0.65) {
              const p = (u - 0.65) / 0.35;
              jf.splashRing.visible = true;
              jf.splashRing.position.set(
                jf.centerX + dxDir * jf.arcDistance * 0.36,
                baseWaterY + 0.015,
                jf.centerZ + dzDir * jf.arcDistance * 0.36,
              );
              jf.splashRing.scale.setScalar(0.8 + p * 2.8);
              splashMat.opacity = Math.max(0, 0.82 * (1 - p));
            } else {
              jf.splashRing.visible = false;
            }
          } else {
            jf.group.visible = false;
            jf.splashRing.visible = false;
          }
        }
      }

      // Anima coelhos pulando pelo gramado da floresta
      if (stage && stage.hoppingRabbits.length > 0) {
        for (const rb of stage.hoppingRabbits) {
          const arg = t * rb.speed * 0.55 + rb.phase;
          const rx = rb.centerX + Math.cos(arg) * rb.radiusX;
          const rz = rb.centerZ + Math.sin(arg) * rb.radiusZ;
          const vx = -Math.sin(arg) * rb.radiusX;
          const vz = Math.cos(arg) * rb.radiusZ;
          const hopWave = Math.abs(Math.sin(t * rb.speed * 2.4 + rb.phase));
          const hopY = Math.pow(hopWave, 1.35) * rb.hopHeight;

          rb.group.position.set(rx, hopY, rz);
          rb.group.rotation.y = Math.atan2(vx, vz);
          rb.group.rotation.x = -Math.cos(t * rb.speed * 2.4 + rb.phase) * 0.16;
          const earSwing = Math.sin(t * rb.speed * 4.8 + rb.phase) * 0.12;
          rb.earL.rotation.x = -0.1 + earSwing;
          rb.earR.rotation.x = -0.1 - earSwing;
        }
      }

      // Anima pista de dança que muda de cor, luzes giratórias multicoloridas e LEDs neon da Boate
      if (stage && stage.danceTiles.length > 0) {
        const beatBoost = djPlayingRef.current ? 1.5 : 1.0;
        for (const tile of stage.danceTiles) {
          const hue = (t * 0.22 * beatBoost + tile.col * 0.11 + tile.row * 0.14) % 1;
          tempClubColor.setHSL(hue, 0.94, 0.54);
          tile.material.color.copy(tempClubColor);
          tile.material.emissive.copy(tempClubColor);
          tile.material.emissiveIntensity =
            0.95 + Math.abs(Math.sin(t * 3.8 * beatBoost + tile.col + tile.row)) * 0.75;
        }
      }

      if (stage && stage.movingLights.length > 0) {
        for (const ml of stage.movingLights) {
          const hue = (t * 0.18 + ml.hueOffset) % 1;
          tempClubColor.setHSL(hue, 0.96, 0.56);
          ml.beamMat.color.copy(tempClubColor);
          ml.bulbMat.emissive.copy(tempClubColor);
          ml.pointLight.color.copy(tempClubColor);

          const pan = Math.sin(t * ml.speed + ml.phase) * 0.42;
          const tilt = Math.cos(t * ml.speed * 0.8 + ml.phase) * 0.34;
          ml.pivot.rotation.z = pan;
          ml.pivot.rotation.x = tilt;
          ml.pointLight.position.set(
            ml.baseX + Math.sin(pan) * 2.6,
            1.35,
            ml.baseZ + Math.sin(tilt) * 2.4 + 1.1,
          );
        }
      }

      if (stage && stage.neonPulseMaterials.length > 0) {
        stage.neonPulseMaterials.forEach((nMat, idx) => {
          const hue = (t * 0.12 + idx * 0.25) % 1;
          tempClubColor.setHSL(hue, 0.92, 0.56);
          nMat.color.copy(tempClubColor);
          nMat.emissive.copy(tempClubColor);
          nMat.emissiveIntensity = 1.25 + Math.sin(t * 3.0 + idx) * 0.35;
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
        animateAvatarCompanions(entry.rig.root, t);
      }

      controls.update();
      bundle.renderer.render(scene, camera);
      flushSoftwareFrame(bundle.renderer, bundle.isSoftware);

      // Projeta a tela 16:9 da Cabine de DJ diretamente em coordenadas de viewport (zero re-render React)
      const projectCb = onProjectDjScreenRef.current;
      if (projectCb) {
        const screenMesh = stage?.djScreenMesh;
        if (!screenMesh) {
          projectCb(null);
        } else {
          const vw = container.clientWidth || 920;
          const vh = container.clientHeight || 520;
          screenMesh.updateWorldMatrix(true, false);
          cornerTL.set(-1.48, 0.8325, 0).applyMatrix4(screenMesh.matrixWorld).project(camera);
          cornerBR.set(1.48, -0.8325, 0).applyMatrix4(screenMesh.matrixWorld).project(camera);
          cornerCenter.set(0, 0, 0).applyMatrix4(screenMesh.matrixWorld).project(camera);

          const tlx = (cornerTL.x * 0.5 + 0.5) * vw;
          const tly = (-cornerTL.y * 0.5 + 0.5) * vh;
          const brx = (cornerBR.x * 0.5 + 0.5) * vw;
          const bry = (-cornerBR.y * 0.5 + 0.5) * vh;
          const width = Math.max(0, brx - tlx);
          const height = Math.max(0, bry - tly);

          const isVisible =
            cornerCenter.z < 1 &&
            width >= 96 &&
            height >= 54 &&
            brx > 0 &&
            tlx < vw &&
            bry > 0 &&
            tly < vh;

          projectCb(
            isVisible
              ? { visible: true, left: tlx, top: tly, width, height }
              : { visible: false, left: 0, top: 0, width: 0, height: 0 },
          );
        }
      }

      // Atualiza tags HTML projetadas (~15Hz) para evitar re-render React em todo frame
      if (now - lastLabelSync > 66) {
        lastLabelSync = now;
        const vw = container.clientWidth || 920;
        const vh = container.clientHeight || 520;
        const nowMs = Date.now();
        const nextLabels: ProjectedLabel[] = [];
        const projHeadVec = new THREE.Vector3();
        const gizmoVec = new THREE.Vector3();

        for (const p of presencesRef.current) {
          const entry = avatarsMapRef.current.get(p.clientId);
          if (!entry) continue;

          // Posição no chão (pés) para a plaqueta / balão com Nome, Nível e Cargo
          projVec.set(entry.curX, 0, entry.curZ);
          projVec.project(camera);
          if (projVec.z > 1) continue;
          const sx = (projVec.x * 0.5 + 0.5) * vw;
          const sy = (-projVec.y * 0.5 + 0.5) * vh;

          // Posição na cabeça para balão de fala do chat
          projHeadVec.set(entry.curX, entry.rig.metrics.totalHeight + 0.15, entry.curZ);
          projHeadVec.project(camera);
          const headSx = (projHeadVec.x * 0.5 + 0.5) * vw;
          const headSy = (-projHeadVec.y * 0.5 + 0.5) * vh;

          const isStaff =
            p.role === 'admin' || (p.role as string) === 'moderator' || Boolean(p.staffRoleTier);
          const showBubble = Boolean(
            p.lastMessage && p.lastMessageAt && nowMs - p.lastMessageAt < 8500
          );
          nextLabels.push({
            clientId: p.clientId,
            username: p.username,
            level: p.level ?? 1,
            officialRoleLabel: p.officialRoleLabel,
            screenX: sx,
            screenY: sy,
            headScreenX: headSx,
            headScreenY: headSy,
            isMe: p.clientId === currentClientId,
            isVip: p.isVip,
            isStaff,
            staffRoleTier: p.staffRoleTier,
            lastMessage: p.lastMessage,
            showBubble,
          });
        }
        setLabels(nextLabels);

        // Atualiza posição do Gizmo de rotação do prop selecionado
        if (selectedPropIdRef.current && stage) {
          const pMesh = stage.propMeshes.get(selectedPropIdRef.current);
          if (pMesh) {
            gizmoVec.copy(pMesh.position);
            gizmoVec.y += 0.85;
            gizmoVec.project(camera);
            if (gizmoVec.z <= 1) {
              const gx = (gizmoVec.x * 0.5 + 0.5) * vw;
              const gy = (-gizmoVec.y * 0.5 + 0.5) * vh;
              setGizmoPos({ x: gx, y: gy, visible: true });
            } else {
              setGizmoPos(null);
            }
          } else {
            setGizmoPos(null);
          }
        } else {
          setGizmoPos(null);
        }
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      ro.disconnect();
      controls.dispose();
      controlsRef.current = null;
      if (customBgTextureRef.current) {
        customBgTextureRef.current.dispose();
        customBgTextureRef.current = null;
      }
      avatarsMapRef.current.clear();
      disposeObject3D(scene);
      bundle.dispose();
    };
  }, [currentClientId]);

  // Reconstrói palco da sala quando troca de sala, papel de parede ou plano de fundo do PC
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;

    if (stageRef.current) {
      scene.remove(stageRef.current.group);
      disposeObject3D(stageRef.current.group);
      stageRef.current = null;
    }
    if (customBgTextureRef.current) {
      customBgTextureRef.current.dispose();
      customBgTextureRef.current = null;
    }

    const shouldIncludeDjBooth =
      room.id === 'lounge_party' ||
      room.id === 'lounge_party_es' ||
      room.id === 'lounge_party_en' ||
      room.id === 'ilha_brasil' ||
      room.id === 'ilha_spanish' ||
      room.id === 'ilha_english' ||
      Boolean(room.isOfficial) ||
      room.backdropTheme === 'lounge_party' ||
      room.backdropTheme === 'lounge_party_natal' ||
      room.backdropTheme === 'lounge_party_halloween' ||
      room.backdropTheme === 'ilha_tropical' ||
      room.backdropTheme === 'ilha_coqueiro' ||
      room.backdropTheme === 'floresta_piquenique' ||
      room.backdropTheme === 'boate_neon' ||
      room.backdropTheme === 'bar_lounge' ||
      room.backdropTheme === 'estudio_3d_designer' ||
      djHasTrack;
    const built = buildRoomStage3D({
      theme: room.backdropTheme,
      wallpaper,
      interactiveProps: room.interactiveProps,
      includeDjBooth: shouldIncludeDjBooth,
    });
    scene.background = new THREE.Color(built.skyBackgroundHex || '#14101C');
    scene.fog = room.customBackgroundImageUrl
      ? null
      : built.fogColorHex
        ? new THREE.FogExp2(built.fogColorHex, 0.011)
        : null;

    if (room.customBackgroundImageUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        room.customBackgroundImageUrl,
        (tex) => {
          if (cancelled || sceneRef.current !== scene) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          customBgTextureRef.current = tex;
          scene.background = tex;
          scene.fog = null;
        },
        undefined,
        () => {
          // Mantém cor de fundo padrão se a imagem falhar
        },
      );
    }

    scene.add(built.group);
    stageRef.current = built;

    return () => {
      cancelled = true;
    };
  }, [
    room.id,
    room.isOfficial,
    room.backdropTheme,
    room.interactiveProps,
    room.customBackgroundImageUrl,
    wallpaper,
    djHasTrack,
  ]);

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
      const sig = `${p.avatarGender}|${p.skinTone}|${JSON.stringify(p.equipped || {})}|${JSON.stringify(p.faceCustomization || null)}`;
      const existing = avatarsMapRef.current.get(p.clientId);

      if (!existing || existing.signature !== sig) {
        if (existing) {
          scene.remove(existing.rig.root);
          disposeObject3D(existing.rig.root);
        }
        const rig = createAvatar3DRig({
          avatarGender: p.avatarGender || 'feminino',
          skinTone: p.skinTone || 'pessego',
          faceCustomization: p.faceCustomization,
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

  const handleFocusMyAvatar = () => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const meEntry = avatarsMapRef.current.get(currentClientId);
    if (!controls || !camera) return;
    if (meEntry) {
      const tx = meEntry.curX;
      const tz = meEntry.curZ;
      controls.target.set(tx, 1.0, tz);
      camera.position.set(tx, 3.6, tz + 5.8);
    } else {
      controls.target.set(0, 0.9, -0.4);
      camera.position.set(0, 4.9, 9.6);
    }
    controls.update();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[480px] sm:h-[520px] rounded-2xl overflow-hidden border border-stone-800 bg-[#14101C] select-none"
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

      {/* Controle rápido de Câmera Livre (Focar no Avatar sem travar a câmera) */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleFocusMyAvatar}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1C1917]/90 hover:bg-[#1C1917] text-white border border-white/20 text-[11px] font-semibold shadow-lg transition-colors cursor-pointer"
          title="Centralizar câmera no seu avatar (ou use botão direito/scroll para ajustar livremente)"
        >
          <Crosshair className="w-3.5 h-3.5 text-amber-400" />
          <span>Focar Avatar</span>
        </button>
      </div>

      {/* Tags 2D projetadas dos avatares e balões de chat */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* 1. Balões de fala do Chat (acima da cabeça do avatar) */}
        {labels.map((lbl) => {
          if (!lbl.showBubble || !lbl.lastMessage) return null;
          return (
            <div
              key={`bubble_${lbl.clientId}`}
              className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-auto select-text z-20"
              style={{ left: `${lbl.headScreenX}px`, top: `${lbl.headScreenY - 8}px` }}
            >
              <div
                className={`relative mb-2 max-w-[220px] sm:max-w-[260px] px-3.5 py-2 rounded-2xl bg-white text-stone-900 text-xs font-medium shadow-xl text-center leading-snug break-words animate-in fade-in zoom-in-95 duration-200 ${
                  lbl.isStaff
                    ? 'border-2 border-orange-500 shadow-[0_4px_18px_rgba(249,115,22,0.35)] ring-1 ring-orange-400/40'
                    : 'border border-stone-300'
                }`}
              >
                {lbl.isStaff && (
                  <span className="block text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-0.5">
                    Staff
                  </span>
                )}
                <span>{lbl.lastMessage}</span>
                <div
                  className={`absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-2.5 h-2.5 bg-white rotate-45 ${
                    lbl.isStaff
                      ? 'border-r-2 border-b-2 border-orange-500'
                      : 'border-r border-b border-stone-300'
                  }`}
                />
              </div>
            </div>
          );
        })}

        {/* 2. Plaqueta / Balão do Avatar EMBAIXO DO AVATAR com Nome, Nível ao lado e Cargo Oficial abaixo */}
        {labels.map((lbl) => (
          <div
            key={`name_${lbl.clientId}`}
            className="absolute -translate-x-1/2 flex flex-col items-center pointer-events-none z-10"
            style={{ left: `${lbl.screenX}px`, top: `${lbl.screenY + 4}px` }}
          >
            <div
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-lg border flex flex-col items-center gap-0.5 whitespace-nowrap transition-transform duration-100 ${
                lbl.isMe
                  ? 'bg-[#1C1917]/95 text-white border-amber-400/90 shadow-black/60 ring-1 ring-amber-400/30'
                  : lbl.isStaff
                    ? 'bg-[#1C1917]/95 text-white border-orange-400 shadow-black/60 ring-1 ring-orange-400/40'
                    : lbl.isVip
                      ? 'bg-[#1C1917]/90 text-amber-300 border-amber-400/60 shadow-black/60'
                      : 'bg-[#1C1917]/90 text-stone-100 border-white/20 shadow-black/60'
              }`}
            >
              {/* Linha 1: Nome do Avatar + Nível ao lado */}
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-bold tracking-tight text-[11px]">{lbl.username}</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Nv. {lbl.level ?? 1}
                </span>
                {lbl.isVip && !lbl.isStaff && (
                  <span className="text-[9px] font-bold text-amber-300">★ VIP</span>
                )}
              </div>

              {/* Linha 2: Caso tenha cargo oficial do jogo, exibido ABAIXO do nível e do nome */}
              {(lbl.officialRoleLabel || (lbl.staffRoleTier && DEFAULT_STAFF_ROLE_TITLES[lbl.staffRoleTier as keyof typeof DEFAULT_STAFF_ROLE_TITLES])) && (
                <div className="flex items-center gap-1 text-[9px] font-bold text-orange-300 tracking-wide pt-0.5 border-t border-white/10 w-full justify-center">
                  <ShieldCheck className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                  <span>
                    {lbl.officialRoleLabel ||
                      DEFAULT_STAFF_ROLE_TITLES[lbl.staffRoleTier as keyof typeof DEFAULT_STAFF_ROLE_TITLES]}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 3. Floating Gizmo de Rotação e Ações do Objeto Selecionado com Cursor */}
        {canEditProps && selectedPropId && gizmoPos?.visible && (() => {
          const propObj = roomRef.current.interactiveProps?.find((p) => p.id === selectedPropId);
          if (!propObj) return null;
          return (
            <div
              className="absolute -translate-x-1/2 -translate-y-full z-40 flex flex-col items-center pointer-events-auto select-none"
              style={{ left: `${gizmoPos.x}px`, top: `${gizmoPos.y - 10}px` }}
            >
              <div className="bg-[#1C1917]/95 border border-[#F59E0B]/70 shadow-2xl rounded-2xl p-2.5 text-white flex flex-col items-center gap-2 min-w-[200px] animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between w-full pb-1 border-b border-white/10 text-xs">
                  <span className="font-bold text-amber-300 truncate max-w-[140px]">
                    {propObj.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPropId(null)}
                    className="text-stone-400 hover:text-white cursor-pointer px-1 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center gap-1.5 w-full justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const next = ((propObj.rotationY ?? 0) + 45) % 360;
                      onPropRotated?.(selectedPropId, next);
                    }}
                    className="flex-1 py-1 px-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#1C1917] rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Girar 45 graus"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Girar +45°</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onPropDeleted?.(selectedPropId);
                      setSelectedPropId(null);
                    }}
                    className="p-1.5 bg-rose-900/70 hover:bg-rose-800 text-rose-200 border border-rose-500/40 rounded-lg transition-colors cursor-pointer"
                    title="Excluir este objeto da sala"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Ângulos rápidos: 0, 90, 180, 270 */}
                <div className="flex items-center gap-1 w-full">
                  {[0, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => onPropRotated?.(selectedPropId, deg)}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-md border transition-colors cursor-pointer ${
                        (propObj.rotationY ?? 0) === deg
                          ? 'bg-amber-400 text-stone-900 border-amber-400'
                          : 'bg-white/10 text-stone-200 border-white/15 hover:bg-white/20'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>

                <span className="text-[10px] text-stone-400 text-center">
                  🖱️ Arraste pelo chão com o mouse
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
