import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { DesignPattern, Material3DFinish } from '../types/game';

let cachedSoftwareFlag: boolean | null = null;

/**
 * Detecta WebGL em modo software (SwiftShader, llvmpipe, softpipe) usando probe seguro.
 */
export function isSoftwareWebGL(): boolean {
  if (cachedSoftwareFlag !== null) return cachedSoftwareFlag;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) {
      cachedSoftwareFlag = true;
      return true;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSw = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(renderer);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareFlag = isSw;
    return isSw;
  } catch {
    cachedSoftwareFlag = true;
    return true;
  }
}

export interface StudioRendererBundle {
  renderer: THREE.WebGLRenderer;
  pmremGenerator: THREE.PMREMGenerator;
  envTarget: THREE.WebGLRenderTarget;
  isSoftware: boolean;
  dispose: () => void;
}

/**
 * Inicializa WebGLRenderer seguindo padrão de estúdio (ACESFilmic + SRGB + RoomEnvironment PMREM).
 */
export function createStudioRenderer(
  canvas: HTMLCanvasElement,
  opts: { alpha?: boolean; antialias?: boolean; preserveDrawingBuffer?: boolean } = {}
): StudioRendererBundle {
  const isSoftware = isSoftwareWebGL();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: isSoftware ? false : (opts.antialias ?? true),
    alpha: opts.alpha ?? false,
    powerPreference: isSoftware ? 'low-power' : 'high-performance',
    preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
  });

  const dpr = isSoftware ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !isSoftware;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const roomEnv = new RoomEnvironment();
  const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
  roomEnv.dispose();

  return {
    renderer,
    pmremGenerator,
    envTarget,
    isSoftware,
    dispose: () => {
      envTarget.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    },
  };
}

/**
 * Iluminação de estúdio 3 pontos (key shadow, hemisphere warm/cool, rim backlight).
 */
export function createStudioLighting(
  scene: THREE.Scene,
  opts: { isSoftware?: boolean; intensityScale?: number; warmKey?: number; rimColor?: number } = {}
): { keyLight: THREE.DirectionalLight; rimLight: THREE.DirectionalLight; hemi: THREE.HemisphereLight } {
  const scale = opts.intensityScale ?? 1;
  const hemi = new THREE.HemisphereLight(0xfff8f0, 0x3b2f35, 0.85 * scale);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(opts.warmKey ?? 0xfff3e2, 1.85 * scale);
  keyLight.position.set(2.8, 4.6, 3.6);
  if (!opts.isSoftware) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 18;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
  }
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xdce8ff, 0.65 * scale);
  fillLight.position.set(-3.2, 2.2, 2.4);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(opts.rimColor ?? 0xffe4d6, 0.9 * scale);
  rimLight.position.set(-1.5, 3.4, -3.5);
  scene.add(rimLight);

  return { keyLight, rimLight, hemi };
}

/**
 * Pacing seguro para renderização em SwiftShader/software GL.
 */
export function flushSoftwareFrame(renderer: THREE.WebGLRenderer, isSoftware: boolean): void {
  if (!isSoftware) return;
  const gl = renderer.getContext();
  if ('fenceSync' in gl && typeof (gl as WebGL2RenderingContext).fenceSync === 'function') {
    const gl2 = gl as WebGL2RenderingContext;
    const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (sync) {
      gl2.flush();
      gl2.deleteSync(sync);
    }
  } else {
    gl.flush();
  }
}

// ---------------------------------------------------------------------------
// Cache de Texturas Procedurais PBR (SRGBColorSpace + Anisotropy <= 4)
// ---------------------------------------------------------------------------
const textureCache = new Map<string, THREE.CanvasTexture>();

export function getRadialShadowTexture(): THREE.CanvasTexture {
  const key = 'radial_shadow_v1';
  const existing = textureCache.get(key);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, 'rgba(18, 12, 16, 0.42)');
    grad.addColorStop(0.55, 'rgba(18, 12, 16, 0.16)');
    grad.addColorStop(1, 'rgba(18, 12, 16, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

export function getFabricCanvasTexture(
  primaryHex: string,
  secondaryHex: string,
  pattern: DesignPattern = 'solid',
  accentHex = '#D4AF37'
): THREE.CanvasTexture {
  const key = `fabric_${primaryHex}_${secondaryHex}_${pattern}_${accentHex}`;
  const existing = textureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 256, 256);

    if (pattern === 'striped') {
      ctx.fillStyle = secondaryHex;
      for (let x = 0; x < 256; x += 28) {
        ctx.fillRect(x, 0, 10, 256);
      }
      ctx.fillStyle = accentHex;
      ctx.globalAlpha = 0.35;
      for (let x = 14; x < 256; x += 28) {
        ctx.fillRect(x, 0, 2, 256);
      }
      ctx.globalAlpha = 1;
    } else if (pattern === 'plaid') {
      ctx.fillStyle = secondaryHex;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 256; i += 44) {
        ctx.fillRect(i, 0, 14, 256);
        ctx.fillRect(0, i, 256, 14);
      }
      ctx.fillStyle = accentHex;
      ctx.globalAlpha = 0.4;
      for (let i = 22; i < 256; i += 44) {
        ctx.fillRect(i, 0, 3, 256);
        ctx.fillRect(0, i, 256, 3);
      }
      ctx.globalAlpha = 1;
    } else if (pattern === 'floral') {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const cx = col * 64 + (row % 2 === 0 ? 22 : 46);
          const cy = row * 64 + 26;
          ctx.fillStyle = accentHex;
          ctx.globalAlpha = 0.72;
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 5.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = secondaryHex;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } else if (pattern === 'denim') {
      ctx.strokeStyle = secondaryHex;
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1.5;
      for (let i = -256; i < 512; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 256, 256);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (pattern === 'sequin') {
      for (let y = 8; y < 256; y += 16) {
        for (let x = 8; x < 256; x += 16) {
          ctx.fillStyle = (x + y) % 32 === 0 ? accentHex : secondaryHex;
          ctx.globalAlpha = 0.65;
          ctx.beginPath();
          ctx.arc(x + ((y / 16) % 2) * 8, y, 5.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } else if (pattern === 'neon') {
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, primaryHex);
      grad.addColorStop(0.5, secondaryHex);
      grad.addColorStop(1, accentHex);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, 236, 236);
    } else {
      // Micro trama têxtil sutil para evitar aparência plástica lisa
      ctx.fillStyle = secondaryHex;
      ctx.globalAlpha = 0.14;
      for (let y = 0; y < 256; y += 8) {
        ctx.fillRect(0, y, 256, 2);
      }
      for (let x = 0; x < 256; x += 8) {
        ctx.fillRect(x, 0, 2, 256);
      }
      ctx.globalAlpha = 1;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

export function getWoodTexture(baseHex = '#8C5E3C', grainHex = '#623D22'): THREE.CanvasTexture {
  const key = `wood_${baseHex}_${grainHex}`;
  const existing = textureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = grainHex;
    ctx.globalAlpha = 0.28;
    for (let y = 0; y < 256; y += 32) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
      for (let g = 4; g < 28; g += 7) {
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + g);
        ctx.bezierCurveTo(85, y + g + 2, 170, y + g - 2, 256, y + g);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

export function getMarbleFloorTexture(baseHex = '#EDE4D7', veinHex = '#C6B39A'): THREE.CanvasTexture {
  const key = `marble_${baseHex}_${veinHex}`;
  const existing = textureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = veinHex;
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 6; i++) {
      ctx.lineWidth = i % 2 === 0 ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(0, i * 42);
      ctx.bezierCurveTo(80, i * 42 + 24, 170, i * 42 - 18, 256, i * 42 + 12);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 128, 128);
    ctx.strokeRect(128, 128, 128, 128);
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Cria Material PBR físico de alta fidelidade conforme o acabamento da peça.
 */
export function createFashionMaterial(opts: {
  color: string;
  secondaryColor?: string;
  accentColor?: string;
  pattern?: DesignPattern;
  finish?: Material3DFinish;
  emissiveIntensity?: number;
}): THREE.MeshPhysicalMaterial {
  const finish = opts.finish || 'cotton';
  const map = getFabricCanvasTexture(
    opts.color,
    opts.secondaryColor || opts.color,
    opts.pattern || 'solid',
    opts.accentColor || '#D4AF37'
  );

  switch (finish) {
    case 'silk':
      return new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.26,
        metalness: 0.08,
        sheen: 0.85,
        sheenRoughness: 0.28,
        sheenColor: new THREE.Color(opts.accentColor || '#FFFFFF'),
      });
    case 'velvet':
      return new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.86,
        metalness: 0.02,
        sheen: 1.0,
        sheenRoughness: 0.55,
        sheenColor: new THREE.Color(opts.secondaryColor || opts.color).lerp(new THREE.Color('#FFFFFF'), 0.35),
      });
    case 'leather':
      return new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.34,
        metalness: 0.06,
        clearcoat: 0.42,
        clearcoatRoughness: 0.32,
      });
    case 'metallic':
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(opts.color),
        roughness: 0.22,
        metalness: 0.88,
        clearcoat: 0.4,
        emissive: new THREE.Color(opts.color),
        emissiveIntensity: opts.emissiveIntensity ?? 0.08,
      });
    case 'sequin':
      return new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.18,
        metalness: 0.72,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
        emissive: new THREE.Color(opts.accentColor || opts.color),
        emissiveIntensity: opts.emissiveIntensity ?? 0.14,
      });
    case 'crystal':
      return new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.12,
        metalness: 0.25,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        iridescence: 0.75,
        emissive: new THREE.Color(opts.accentColor || opts.color),
        emissiveIntensity: opts.emissiveIntensity ?? 0.26,
      });
    case 'neon':
      return new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.25,
        metalness: 0.2,
        emissive: new THREE.Color(opts.accentColor || opts.color),
        emissiveIntensity: Math.max(0.45, opts.emissiveIntensity ?? 0.5),
      });
    case 'denim':
      return new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.88,
        metalness: 0.0,
      });
    default:
      return new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.76,
        metalness: 0.02,
      });
  }
}

/**
 * Libera geometrias e materiais próprios de um subgrafo sem destruir texturas cacheadas compartilhadas.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  const sharedTextures = new Set(textureCache.values());
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
    if (mat) {
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        const anyMat = m as unknown as Record<string, unknown>;
        for (const k of ['map', 'roughnessMap', 'normalMap', 'emissiveMap']) {
          const tex = anyMat[k];
          if (tex instanceof THREE.Texture && !sharedTextures.has(tex)) {
            tex.dispose();
          }
        }
        m.dispose();
      }
    }
  });
}
