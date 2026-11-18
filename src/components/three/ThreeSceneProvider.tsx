import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createStudioLighting,
  createStudioRenderer,
  disposeObject3D,
  type StudioRendererBundle,
} from '../../three/studioEngine';

export interface ViewportCameraConfig {
  backgroundHex?: string;
  lightingIntensityScale?: number;
  fov?: number;
  near?: number;
  far?: number;
  position?: [number, number, number];
  target?: [number, number, number];
  enablePan?: boolean;
  enableRotate?: boolean;
  enableZoom?: boolean;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  minAzimuthAngle?: number;
  maxAzimuthAngle?: number;
  cursorClassName?: string;
}

export type ThreeFrameUpdater = (dt: number, elapsedTime: number) => void;

export interface ThreeSceneContextValue {
  /** Verdadeiro assim que WebGLRenderer, Scene, Camera e OrbitControls estiverem prontos. */
  isReady: boolean;
  isSoftware: boolean;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: OrbitControls | null;
  canvas: HTMLCanvasElement | null;
  /** Grupos raiz gerenciados pela cena centralizada */
  avatarsGroup: THREE.Group | null;
  furnitureGroup: THREE.Group | null;
  environmentGroup: THREE.Group | null;
  /** Injeta ou substitui um avatar 3D identificado na cena centralizada */
  injectAvatar: (id: string, object: THREE.Object3D, disposePrevious?: boolean) => void;
  removeAvatar: (id: string, dispose?: boolean) => void;
  clearAvatars: (dispose?: boolean) => void;
  /** Injeta ou substitui um modelo 3D de móvel na cena centralizada */
  injectFurniture: (id: string, object: THREE.Object3D, disposePrevious?: boolean) => void;
  removeFurniture: (id: string, dispose?: boolean) => void;
  clearFurniture: (dispose?: boolean) => void;
  /** Injeta ou substitui elementos de cenário/palco (pedestal, sala, partículas) */
  setEnvironmentProp: (
    id: string,
    object: THREE.Object3D | null,
    disposePrevious?: boolean
  ) => void;
  clearEnvironment: (dispose?: boolean) => void;
  /** Registra função de animação por frame dentro do loop unificado do provider */
  registerFrameTick: (id: string, updater: ThreeFrameUpdater) => () => void;
  /** Acopla o canvas WebGL persistente em um container React e aplica configuração de câmera/controles */
  mountViewport: (hostEl: HTMLElement | null, config?: ViewportCameraConfig) => () => void;
}

const ThreeSceneContext = createContext<ThreeSceneContextValue | null>(null);

interface EngineState {
  bundle: StudioRendererBundle;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  canvas: HTMLCanvasElement;
  avatarsGroup: THREE.Group;
  furnitureGroup: THREE.Group;
  environmentGroup: THREE.Group;
  lighting: ReturnType<typeof createStudioLighting>;
  startLoop: () => void;
  stopLoop: () => void;
}

/**
 * Provider centralizado de WebGL/Three.js.
 * Inicializa um único WebGLRenderer, Scene, PerspectiveCamera, iluminação PBR e OrbitControls,
 * gerenciando o ciclo de vida 3D e permitindo que MeDollStudio e SuiteRoom injetem avatares e móveis.
 */
export const ThreeSceneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  const engineRef = useRef<EngineState | null>(null);
  const avatarEntriesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const furnitureEntriesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const environmentEntriesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const frameUpdatersRef = useRef<Map<string, ThreeFrameUpdater>>(new Map());
  const activeHostRef = useRef<HTMLElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'w-full h-full block';

    const bundle = createStudioRenderer(canvas, { alpha: false, antialias: true });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F6F1EA');
    scene.environment = bundle.envTarget.texture;

    const lighting = createStudioLighting(scene, { isSoftware: bundle.isSoftware });

    const environmentGroup = new THREE.Group();
    environmentGroup.name = 'ThreeScene_EnvironmentGroup';
    const furnitureGroup = new THREE.Group();
    furnitureGroup.name = 'ThreeScene_FurnitureGroup';
    const avatarsGroup = new THREE.Group();
    avatarsGroup.name = 'ThreeScene_AvatarsGroup';
    scene.add(environmentGroup, furnitureGroup, avatarsGroup);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 45);
    camera.position.set(0, 1.15, 3.15);

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = !bundle.isSoftware;
    controls.dampingFactor = 0.08;

    let disposed = false;
    let loopToken = 0;
    let rafId = 0;
    let pollTimerId = 0;
    const clock = new THREE.Clock();

    const afterDraw = (token: number, cb: () => void) => {
      const gl = bundle.renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed || token !== loopToken) {
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

    const stopLoop = () => {
      loopToken++;
      cancelAnimationFrame(rafId);
      clearTimeout(pollTimerId);
    };

    const startLoop = () => {
      const token = ++loopToken;
      cancelAnimationFrame(rafId);
      clearTimeout(pollTimerId);
      clock.getDelta();

      const tick = () => {
        if (disposed || token !== loopToken) return;
        const dt = Math.min(clock.getDelta(), 0.1);
        const t = clock.elapsedTime;

        for (const updater of frameUpdatersRef.current.values()) {
          updater(dt, t);
        }

        controls.update();
        bundle.renderer.render(scene, camera);

        if (bundle.isSoftware) {
          afterDraw(token, tick);
        } else {
          rafId = requestAnimationFrame(tick);
        }
      };

      rafId = requestAnimationFrame(tick);
    };

    const avatarMap = avatarEntriesRef.current;
    const furnitureMap = furnitureEntriesRef.current;
    const envMap = environmentEntriesRef.current;
    const updaterMap = frameUpdatersRef.current;

    engineRef.current = {
      bundle,
      scene,
      camera,
      controls,
      canvas,
      avatarsGroup,
      furnitureGroup,
      environmentGroup,
      lighting,
      startLoop,
      stopLoop,
    };

    setIsReady(true);

    return () => {
      disposed = true;
      stopLoop();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      activeHostRef.current = null;

      avatarMap.clear();
      furnitureMap.clear();
      envMap.clear();
      updaterMap.clear();

      controls.dispose();
      disposeObject3D(scene);
      bundle.dispose();
      canvas.remove();
      engineRef.current = null;
      setIsReady(false);
    };
  }, []);

  const injectAvatar = useCallback(
    (id: string, object: THREE.Object3D, disposePrevious = true) => {
      const engine = engineRef.current;
      if (!engine) return;
      const prev = avatarEntriesRef.current.get(id);
      if (prev && prev !== object) {
        engine.avatarsGroup.remove(prev);
        if (disposePrevious) disposeObject3D(prev);
      }
      if (!engine.avatarsGroup.children.includes(object)) {
        engine.avatarsGroup.add(object);
      }
      avatarEntriesRef.current.set(id, object);
    },
    []
  );

  const removeAvatar = useCallback((id: string, dispose = true) => {
    const engine = engineRef.current;
    const prev = avatarEntriesRef.current.get(id);
    if (!prev) return;
    engine?.avatarsGroup.remove(prev);
    avatarEntriesRef.current.delete(id);
    if (dispose) disposeObject3D(prev);
  }, []);

  const clearAvatars = useCallback((dispose = true) => {
    const engine = engineRef.current;
    for (const [id, obj] of avatarEntriesRef.current.entries()) {
      engine?.avatarsGroup.remove(obj);
      if (dispose) disposeObject3D(obj);
      avatarEntriesRef.current.delete(id);
    }
  }, []);

  const injectFurniture = useCallback(
    (id: string, object: THREE.Object3D, disposePrevious = true) => {
      const engine = engineRef.current;
      if (!engine) return;
      const prev = furnitureEntriesRef.current.get(id);
      if (prev && prev !== object) {
        engine.furnitureGroup.remove(prev);
        if (disposePrevious) disposeObject3D(prev);
      }
      if (!engine.furnitureGroup.children.includes(object)) {
        engine.furnitureGroup.add(object);
      }
      furnitureEntriesRef.current.set(id, object);
    },
    []
  );

  const removeFurniture = useCallback((id: string, dispose = true) => {
    const engine = engineRef.current;
    const prev = furnitureEntriesRef.current.get(id);
    if (!prev) return;
    engine?.furnitureGroup.remove(prev);
    furnitureEntriesRef.current.delete(id);
    if (dispose) disposeObject3D(prev);
  }, []);

  const clearFurniture = useCallback((dispose = true) => {
    const engine = engineRef.current;
    for (const [id, obj] of furnitureEntriesRef.current.entries()) {
      engine?.furnitureGroup.remove(obj);
      if (dispose) disposeObject3D(obj);
      furnitureEntriesRef.current.delete(id);
    }
  }, []);

  const setEnvironmentProp = useCallback(
    (id: string, object: THREE.Object3D | null, disposePrevious = true) => {
      const engine = engineRef.current;
      if (!engine) return;
      const prev = environmentEntriesRef.current.get(id);
      if (prev && prev !== object) {
        engine.environmentGroup.remove(prev);
        if (disposePrevious) disposeObject3D(prev);
        environmentEntriesRef.current.delete(id);
      }
      if (object) {
        if (!engine.environmentGroup.children.includes(object)) {
          engine.environmentGroup.add(object);
        }
        environmentEntriesRef.current.set(id, object);
      }
    },
    []
  );

  const clearEnvironment = useCallback((dispose = true) => {
    const engine = engineRef.current;
    for (const [id, obj] of environmentEntriesRef.current.entries()) {
      engine?.environmentGroup.remove(obj);
      if (dispose) disposeObject3D(obj);
      environmentEntriesRef.current.delete(id);
    }
  }, []);

  const registerFrameTick = useCallback((id: string, updater: ThreeFrameUpdater) => {
    frameUpdatersRef.current.set(id, updater);
    return () => {
      if (frameUpdatersRef.current.get(id) === updater) {
        frameUpdatersRef.current.delete(id);
      }
    };
  }, []);

  const mountViewport = useCallback(
    (hostEl: HTMLElement | null, config: ViewportCameraConfig = {}) => {
      const engine = engineRef.current;
      if (!engine || !hostEl) return () => {};

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      activeHostRef.current = hostEl;

      const { canvas, bundle, scene, camera, controls, lighting, startLoop, stopLoop } = engine;
      canvas.className = config.cursorClassName
        ? `w-full h-full block ${config.cursorClassName}`
        : 'w-full h-full block';

      if (canvas.parentElement !== hostEl) {
        hostEl.appendChild(canvas);
      }

      if (config.backgroundHex) {
        scene.background = new THREE.Color(config.backgroundHex);
      }

      const scale = config.lightingIntensityScale ?? 1;
      lighting.hemi.intensity = 0.85 * scale;
      lighting.keyLight.intensity = 1.85 * scale;
      lighting.rimLight.intensity = 0.9 * scale;

      const w = hostEl.clientWidth || 640;
      const h = hostEl.clientHeight || 420;
      bundle.renderer.setSize(w, h, false);

      camera.fov = config.fov ?? 34;
      camera.near = config.near ?? 0.1;
      camera.far = config.far ?? 45;
      camera.aspect = w / h;
      if (config.position) {
        camera.position.set(config.position[0], config.position[1], config.position[2]);
      }
      camera.updateProjectionMatrix();

      controls.enabled = true;
      controls.enablePan = config.enablePan ?? false;
      controls.enableRotate = config.enableRotate ?? true;
      controls.enableZoom = config.enableZoom ?? true;
      controls.enableDamping = !bundle.isSoftware;
      controls.dampingFactor = 0.08;
      controls.minDistance = config.minDistance ?? 0.95;
      controls.maxDistance = config.maxDistance ?? 12.5;
      controls.minPolarAngle = config.minPolarAngle ?? 0.35;
      controls.maxPolarAngle = config.maxPolarAngle ?? Math.PI * 0.52;
      controls.minAzimuthAngle = config.minAzimuthAngle ?? -Infinity;
      controls.maxAzimuthAngle = config.maxAzimuthAngle ?? Infinity;

      if (config.target) {
        controls.target.set(config.target[0], config.target[1], config.target[2]);
      }
      controls.update();

      if (!bundle.isSoftware) {
        bundle.renderer.compile(scene, camera);
      }

      const ro = new ResizeObserver((entries) => {
        if (activeHostRef.current !== hostEl) return;
        const rect = entries[0]?.contentRect;
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        bundle.renderer.setSize(rect.width, rect.height, false);
      });
      ro.observe(hostEl);
      resizeObserverRef.current = ro;

      startLoop();

      return () => {
        ro.disconnect();
        if (resizeObserverRef.current === ro) {
          resizeObserverRef.current = null;
        }
        if (activeHostRef.current === hostEl) {
          activeHostRef.current = null;
          stopLoop();
          if (canvas.parentElement === hostEl) {
            hostEl.removeChild(canvas);
          }
        }
      };
    },
    []
  );

  const contextValue = useMemo<ThreeSceneContextValue>(() => {
    const engine = engineRef.current;
    return {
      isReady,
      isSoftware: engine?.bundle.isSoftware ?? false,
      scene: engine?.scene ?? null,
      camera: engine?.camera ?? null,
      renderer: engine?.bundle.renderer ?? null,
      controls: engine?.controls ?? null,
      canvas: engine?.canvas ?? null,
      avatarsGroup: engine?.avatarsGroup ?? null,
      furnitureGroup: engine?.furnitureGroup ?? null,
      environmentGroup: engine?.environmentGroup ?? null,
      injectAvatar,
      removeAvatar,
      clearAvatars,
      injectFurniture,
      removeFurniture,
      clearFurniture,
      setEnvironmentProp,
      clearEnvironment,
      registerFrameTick,
      mountViewport,
    };
  }, [
    isReady,
    injectAvatar,
    removeAvatar,
    clearAvatars,
    injectFurniture,
    removeFurniture,
    clearFurniture,
    setEnvironmentProp,
    clearEnvironment,
    registerFrameTick,
    mountViewport,
  ]);

  return <ThreeSceneContext.Provider value={contextValue}>{children}</ThreeSceneContext.Provider>;
};

export function useThreeScene(): ThreeSceneContextValue {
  const ctx = useContext(ThreeSceneContext);
  if (!ctx) {
    throw new Error('useThreeScene deve ser utilizado dentro de <ThreeSceneProvider>.');
  }
  return ctx;
}
