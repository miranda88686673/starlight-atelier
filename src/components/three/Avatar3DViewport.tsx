import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  AvatarFaceCustomization,
  AvatarGender,
  ClothingItem,
  EquippedOutfit,
  SkinToneId,
} from '../../types/game';
import {
  createStudioLighting,
  createStudioRenderer,
  disposeObject3D,
} from '../../three/studioEngine';
import { updateAvatarPose, type Avatar3DPose } from '../../three/avatar3d';
import {
  animateAvatarCompanions,
  createAvatarAssemblyGroup,
  syncAvatarAssemblyTransforms,
  updateAvatarAssemblyEquipment,
  type AvatarAssemblyGroup,
} from '../../three/clothing3d';
import {
  loadBaseAvatarWithFallback,
  type SourceAxisOrientation,
} from '../../three/gltfAvatarLoader';

interface Avatar3DViewportProps {
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  catalog: ClothingItem[];
  faceCustomization?: AvatarFaceCustomization;
  focusMode?: 'body' | 'face';
  initialPose?: Avatar3DPose;
  showControls?: boolean;
  heightClassName?: string;
  backgroundHex?: string;
  baseGlbUrl?: string;
  sourceOrientation?: SourceAxisOrientation;
}

const _desiredTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();

export const Avatar3DViewport: React.FC<Avatar3DViewportProps> = ({
  equipped,
  skinTone,
  avatarGender,
  catalog,
  faceCustomization,
  focusMode = 'body',
  initialPose = 'idle',
  showControls = true,
  heightClassName = 'h-[430px]',
  backgroundHex = '#F6F1EA',
  baseGlbUrl,
  sourceOrientation,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const assemblyRef = useRef<AvatarAssemblyGroup | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sparkTriggerRef = useRef<(() => void) | null>(null);

  const equippedRef = useRef<EquippedOutfit>(equipped);
  const catalogRef = useRef<ClothingItem[]>(catalog);
  const equippedSnapRef = useRef<string>(JSON.stringify(equipped));

  equippedRef.current = equipped;
  catalogRef.current = catalog;

  const [pose, setPose] = useState<Avatar3DPose>(initialPose);
  const [camView, setCamView] = useState<'body' | 'face'>(focusMode);
  const poseRef = useRef<Avatar3DPose>(initialPose);
  const camViewRef = useRef<'body' | 'face'>(focusMode);
  const camTransitionActiveRef = useRef<boolean>(focusMode === 'face');

  useEffect(() => {
    setCamView(focusMode);
    camViewRef.current = focusMode;
    camTransitionActiveRef.current = true;
  }, [focusMode]);

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  // Inicialização única do contexto WebGL + Cena + OrbitControls
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const bundle = createStudioRenderer(canvas, { alpha: false, antialias: true });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundHex);
    scene.environment = bundle.envTarget.texture;
    sceneRef.current = scene;

    createStudioLighting(scene, { isSoftware: bundle.isSoftware });

    // Pedestal discreto de boutique ancorado no chão (y = 0)
    const pedestalGeo = new THREE.CylinderGeometry(0.68, 0.74, 0.05, 36);
    const pedestalMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#EBE1D4'),
      roughness: 0.35,
      metalness: 0.08,
      clearcoat: 0.3,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.025;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.012, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.85 })
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.002;
    scene.add(rimRing);

    const w = container.clientWidth || 320;
    const h = container.clientHeight || 430;
    bundle.renderer.setSize(w, h, false);

    const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 30);
    camera.position.set(0, 1.15, 3.25);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = !bundle.isSoftware;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.95;
    controls.maxDistance = 4.8;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.target.set(0, 0.92, 0);
    controls.update();
    controlsRef.current = controls;

    const handleControlStart = () => {
      camTransitionActiveRef.current = false;
    };
    controls.addEventListener('start', handleControlStart);

    // Sistema de partículas 3D (THREE.Points) ao vestir peças
    const SPARK_COUNT = 24;
    const sparkPositions = new Float32Array(SPARK_COUNT * 3);
    const sparkVelocities = new Float32Array(SPARK_COUNT * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.045,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    sparkPoints.frustumCulled = false;
    sparkPoints.visible = false;
    scene.add(sparkPoints);

    let sparkLife = 0;
    const triggerSparkBurst = () => {
      sparkLife = 1.0;
      sparkPoints.visible = true;
      for (let i = 0; i < SPARK_COUNT; i++) {
        const angle = (i / SPARK_COUNT) * Math.PI * 2 + Math.random() * 0.3;
        const r = 0.16 + Math.random() * 0.25;
        sparkPositions[i * 3] = Math.cos(angle) * r;
        sparkPositions[i * 3 + 1] = 0.45 + Math.random() * 0.95;
        sparkPositions[i * 3 + 2] = Math.sin(angle) * r;
        sparkVelocities[i * 3] = Math.cos(angle) * (0.25 + Math.random() * 0.35);
        sparkVelocities[i * 3 + 1] = 0.35 + Math.random() * 0.45;
        sparkVelocities[i * 3 + 2] = Math.sin(angle) * (0.25 + Math.random() * 0.35);
      }
      sparkGeo.attributes.position.needsUpdate = true;
    };
    sparkTriggerRef.current = triggerSparkBurst;

    if (!bundle.isSoftware) {
      bundle.renderer.compile(scene, camera);
    }

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      bundle.renderer.setSize(rect.width, rect.height, false);
    });
    ro.observe(container);

    let rafId = 0;
    let pollTimerId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const afterDraw = (cb: () => void) => {
      const gl = bundle.renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            pollTimerId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            pollTimerId = window.setTimeout(cb, 80);
          }
        };
        pollTimerId = window.setTimeout(poll, 5);
      } else {
        gl.flush();
        pollTimerId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;
      const assembly = assemblyRef.current;

      if (assembly) {
        if (assembly.gltfResult?.mixer) {
          assembly.gltfResult.mixer.update(dt);
        } else if (assembly.proceduralRig) {
          updateAvatarPose(assembly.proceduralRig, poseRef.current, t);
        }
        animateAvatarCompanions(assembly.rootGroup, t);
        syncAvatarAssemblyTransforms(assembly);
      }

      if (sparkLife > 0) {
        sparkLife = Math.max(0, sparkLife - dt * 1.45);
        sparkMat.opacity = sparkLife * 0.9;
        for (let i = 0; i < SPARK_COUNT; i++) {
          sparkPositions[i * 3] += sparkVelocities[i * 3] * dt;
          sparkPositions[i * 3 + 1] += sparkVelocities[i * 3 + 1] * dt;
          sparkPositions[i * 3 + 2] += sparkVelocities[i * 3 + 2] * dt;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        if (sparkLife <= 0) {
          sparkPoints.visible = false;
        }
      }

      if (camTransitionActiveRef.current) {
        const isFace = camViewRef.current === 'face';
        const totalH = assembly ? assembly.metrics.totalHeight : 1.6;
        const headHalfH = assembly ? assembly.metrics.headHalfH : 0.135;
        const targetY = isFace ? totalH - headHalfH * 1.12 : totalH * 0.51;
        const targetDist = isFace ? 1.02 : 2.95;

        _desiredTarget.set(0, THREE.MathUtils.damp(controls.target.y, targetY, 6, dt), 0);
        controls.target.set(
          THREE.MathUtils.damp(controls.target.x, _desiredTarget.x, 6, dt),
          _desiredTarget.y,
          THREE.MathUtils.damp(controls.target.z, _desiredTarget.z, 6, dt)
        );

        const curDist = camera.position.distanceTo(controls.target);
        _desiredCamPos
          .copy(camera.position)
          .sub(controls.target)
          .normalize()
          .multiplyScalar(THREE.MathUtils.damp(curDist, targetDist, 5, dt))
          .add(controls.target);
        camera.position.copy(_desiredCamPos);

        if (
          Math.abs(controls.target.y - targetY) < 0.005 &&
          Math.abs(curDist - targetDist) < 0.015
        ) {
          camTransitionActiveRef.current = false;
        }
      }

      controls.update();
      bundle.renderer.render(scene, camera);
      if (bundle.isSoftware) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(pollTimerId);
      sparkTriggerRef.current = null;
      controls.removeEventListener('start', handleControlStart);
      ro.disconnect();
      controls.dispose();
      if (assemblyRef.current) {
        scene.remove(assemblyRef.current.rootGroup);
        assemblyRef.current.dispose();
        assemblyRef.current = null;
      }
      disposeObject3D(scene);
      bundle.dispose();
    };
  }, [backgroundHex]);

  // Reconstrói AvatarAssemblyGroup via loadBaseAvatarWithFallback quando muda gênero, tom de pele ou URL base
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;

    const cleanupCurrentAvatar = () => {
      if (assemblyRef.current) {
        scene.remove(assemblyRef.current.rootGroup);
        assemblyRef.current.dispose();
        assemblyRef.current = null;
      }
    };

    loadBaseAvatarWithFallback({
      gender: avatarGender,
      skinTone,
      faceCustomization,
      url: baseGlbUrl,
      sourceOrientation,
      withShadowDisc: true,
    }).then((loaded) => {
      if (cancelled) {
        loaded.gltfResult?.dispose();
        if (loaded.proceduralRig) disposeObject3D(loaded.proceduralRig.root);
        return;
      }
      cleanupCurrentAvatar();

      const assembly = createAvatarAssemblyGroup(loaded);
      if (assembly.gltfResult?.mixer && assembly.gltfResult.animations[0]) {
        assembly.gltfResult.mixer.clipAction(assembly.gltfResult.animations[0]).play();
      } else if (assembly.proceduralRig) {
        updateAvatarPose(assembly.proceduralRig, poseRef.current, 0);
      }
      scene.add(assembly.rootGroup);
      assemblyRef.current = assembly;

      updateAvatarAssemblyEquipment(assembly, equippedRef.current, catalogRef.current);
      syncAvatarAssemblyTransforms(assembly);
    });

    return () => {
      cancelled = true;
    };
  }, [avatarGender, skinTone, faceCustomization, baseGlbUrl, sourceOrientation]);

  // Atualiza nós filhos (clothingNode e hairNode) quando look equipado ou catálogo muda
  useEffect(() => {
    const assembly = assemblyRef.current;
    if (!assembly) return;
    updateAvatarAssemblyEquipment(assembly, equipped, catalog);
    syncAvatarAssemblyTransforms(assembly);
    const serialized = JSON.stringify(equipped);
    if (serialized !== equippedSnapRef.current) {
      equippedSnapRef.current = serialized;
      sparkTriggerRef.current?.();
    }
  }, [equipped, catalog]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${heightClassName} rounded-2xl overflow-hidden border border-[#E5D7C6] bg-[#F6F1EA] select-none`}
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {showControls && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center gap-1 bg-[#1C1917]/90 text-white rounded-lg p-1 pointer-events-auto border border-white/15 shadow-md">
            <button
              type="button"
              onClick={() => {
                setCamView('body');
                camViewRef.current = 'body';
                camTransitionActiveRef.current = true;
              }}
              className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                camView === 'body' ? 'bg-[#8B1538] text-white' : 'text-stone-300 hover:text-white'
              }`}
            >
              Corpo 3D
            </button>
            <button
              type="button"
              onClick={() => {
                setCamView('face');
                camViewRef.current = 'face';
                camTransitionActiveRef.current = true;
              }}
              className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                camView === 'face' ? 'bg-[#8B1538] text-white' : 'text-stone-300 hover:text-white'
              }`}
            >
              Rosto & Cabelo
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#1C1917]/90 text-white rounded-lg p-1 pointer-events-auto border border-white/15 shadow-md">
            {(['idle', 'runway', 'sit'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPose(p)}
                className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                  pose === p ? 'bg-amber-600 text-white' : 'text-stone-300 hover:text-white'
                }`}
              >
                {p === 'idle' ? 'Natural' : p === 'runway' ? 'Desfile' : 'Sentado'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
