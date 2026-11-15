import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AvatarGender, ClothingItem, EquippedOutfit, SkinToneId } from '../../types/game';
import {
  createStudioLighting,
  createStudioRenderer,
  disposeObject3D,
  flushSoftwareFrame,
} from '../../three/studioEngine';
import { createAvatar3DRig, updateAvatarPose, type Avatar3DPose, type Avatar3DRig } from '../../three/avatar3d';
import { attachClothingAndHair3D } from '../../three/clothing3d';

interface Avatar3DViewportProps {
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  catalog: ClothingItem[];
  focusMode?: 'body' | 'face';
  initialPose?: Avatar3DPose;
  showControls?: boolean;
  heightClassName?: string;
  backgroundHex?: string;
}

export const Avatar3DViewport: React.FC<Avatar3DViewportProps> = ({
  equipped,
  skinTone,
  avatarGender,
  catalog,
  focusMode = 'body',
  initialPose = 'idle',
  showControls = true,
  heightClassName = 'h-[430px]',
  backgroundHex = '#F6F1EA',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rigRef = useRef<Avatar3DRig | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [pose, setPose] = useState<Avatar3DPose>(initialPose);
  const [camView, setCamView] = useState<'body' | 'face'>(focusMode);
  const poseRef = useRef<Avatar3DPose>(initialPose);
  const camViewRef = useRef<'body' | 'face'>(focusMode);

  useEffect(() => {
    setCamView(focusMode);
    camViewRef.current = focusMode;
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
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.95;
    controls.maxDistance = 4.8;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.target.set(0, 0.92, 0);
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

    let rafId = 0;
    let lastDraw = 0;
    const clock = new THREE.Clock();
    const desiredTarget = new THREE.Vector3();
    const desiredCamPos = new THREE.Vector3();

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (bundle.isSoftware && now - lastDraw < 65) return;
      lastDraw = now;

      const t = clock.getElapsedTime();
      if (rigRef.current) {
        updateAvatarPose(rigRef.current, poseRef.current, t);
      }

      // Interpolação suave de enquadramento apenas quando muda de modo
      const isFace = camViewRef.current === 'face';
      desiredTarget.set(0, isFace ? 1.54 : 0.92, 0);
      controls.target.lerp(desiredTarget, 0.1);

      const curDist = camera.position.distanceTo(controls.target);
      const targetDist = isFace ? 1.18 : 3.25;
      if (Math.abs(curDist - targetDist) > 0.04) {
        desiredCamPos.copy(camera.position).sub(controls.target).normalize().multiplyScalar(THREE.MathUtils.lerp(curDist, targetDist, 0.08)).add(controls.target);
        camera.position.copy(desiredCamPos);
      }

      controls.update();
      bundle.renderer.render(scene, camera);
      flushSoftwareFrame(bundle.renderer, bundle.isSoftware);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      if (rigRef.current) {
        scene.remove(rigRef.current.root);
        disposeObject3D(rigRef.current.root);
        rigRef.current = null;
      }
      disposeObject3D(scene);
      bundle.dispose();
    };
  }, [backgroundHex]);

  // Reconstrói rig quando muda gênero ou tom de pele
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rigRef.current) {
      scene.remove(rigRef.current.root);
      disposeObject3D(rigRef.current.root);
      rigRef.current = null;
    }
    const rig = createAvatar3DRig({ avatarGender, skinTone, withShadowDisc: true });
    scene.add(rig.root);
    rigRef.current = rig;
    attachClothingAndHair3D(rig, equipped, catalog);
  }, [avatarGender, skinTone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reacopla peças quando look equipado ou catálogo muda
  useEffect(() => {
    if (!rigRef.current) return;
    attachClothingAndHair3D(rigRef.current, equipped, catalog);
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
              }}
              className={`px-2 py-1 text-[10px] font-bold rounded transition ${
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
              }}
              className={`px-2 py-1 text-[10px] font-bold rounded transition ${
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
                className={`px-2 py-1 text-[10px] font-bold rounded transition ${
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
