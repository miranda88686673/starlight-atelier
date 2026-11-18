import * as THREE from 'three';
import type {
  PurchasableWallpaperItem,
  RoomBackdropTheme,
  RoomInteractiveProp,
  SuiteThemeId,
} from '../types/game';
import {
  getMarbleFloorTexture,
  getSkyscraperWindowTexture,
  getWoodTexture,
  getWoodenDeckTexture,
} from './studioEngine';

/**
 * Converte coordenadas percentuais de palco de Sala (x: 0..100, y: 0..100) para espaço 3D (metros).
 */
export function roomPctToWorld(xPct: number, yPct: number): { x: number; z: number } {
  const x = ((xPct - 50) / 50) * 7.55; // -7.55..7.55 (alcance total até as bordas 15.5m)
  const z = ((yPct - 50) / 50) * 5.05; // -5.05..5.05 (alcance total até as bordas 10.5m)
  return { x, z };
}

export function worldToRoomPct(wx: number, wz: number): { x: number; y: number } {
  const x = Math.max(0, Math.min(100, (wx / 7.55) * 50 + 50));
  const y = Math.max(0, Math.min(100, (wz / 5.05) * 50 + 50));
  return { x, y };
}

/**
 * Converte coordenadas da Suíte (base 720x480) para espaço 3D (metros).
 */
export function suitePxToWorld(px: number, py: number): { x: number; z: number } {
  const x = ((px - 320) / 360) * 4.8;
  const z = ((py - 250) / 210) * 2.6;
  return { x, z };
}

export function worldToSuitePx(wx: number, wz: number): { x: number; y: number } {
  const x = Math.round(Math.max(24, Math.min(660, (wx / 4.8) * 360 + 320)));
  const y = Math.round(Math.max(120, Math.min(420, (wz / 2.6) * 210 + 250)));
  return { x, y };
}

export interface RoomThemePalette {
  wallColor: string;
  wainscotColor: string;
  floorColor: string;
  floorVein: string;
  accentColor: string;
  ambientSky: string;
  isNightClub: boolean;
}

export function getRoomThemePalette(
  theme: RoomBackdropTheme,
  wallpaper?: PurchasableWallpaperItem
): RoomThemePalette {
  if (wallpaper) {
    return {
      wallColor: wallpaper.wallTopColor,
      wainscotColor: wallpaper.wainscotColor,
      floorColor: wallpaper.floorTopColor,
      floorVein: wallpaper.floorBottomColor,
      accentColor: wallpaper.accentColor,
      ambientSky: wallpaper.wallBottomColor,
      isNightClub: wallpaper.themeTag === 'boate' || wallpaper.themeTag === 'bar',
    };
  }
  switch (theme) {
    case 'lounge_party':
      return {
        wallColor: '#0F172A',
        wainscotColor: '#1E293B',
        floorColor: '#8A5632',
        floorVein: '#3D2110',
        accentColor: '#F59E0B',
        ambientSky: '#38BDF8',
        isNightClub: true,
      };
    case 'lounge_party_natal':
      return {
        wallColor: '#0A1128',
        wainscotColor: '#14213D',
        floorColor: '#8A5632',
        floorVein: '#3D2110',
        accentColor: '#EF4444',
        ambientSky: '#0A1128',
        isNightClub: true,
      };
    case 'lounge_party_halloween':
      return {
        wallColor: '#180C26',
        wainscotColor: '#27103C',
        floorColor: '#6B4226',
        floorVein: '#2E1A0C',
        accentColor: '#F97316',
        ambientSky: '#180C26',
        isNightClub: true,
      };
    case 'ilha_tropical':
    case 'ilha_coqueiro':
      return {
        wallColor: '#0EA5E9',
        wainscotColor: '#0284C7',
        floorColor: '#F2D399',
        floorVein: '#D9AE68',
        accentColor: '#0EA5E9',
        ambientSky: '#38BDF8',
        isNightClub: false,
      };
    case 'floresta_piquenique':
      return {
        wallColor: '#15803D',
        wainscotColor: '#166534',
        floorColor: '#4ADE80',
        floorVein: '#16A34A',
        accentColor: '#22C55E',
        ambientSky: '#7DD3FC',
        isNightClub: false,
      };
    case 'boate_neon':
      return {
        wallColor: '#0D091A',
        wainscotColor: '#1A1130',
        floorColor: '#130F22',
        floorVein: '#6D28D9',
        accentColor: '#EC4899',
        ambientSky: '#090714',
        isNightClub: true,
      };
    case 'cobertura_diamante_vip':
    case 'hotel_royal_vip':
      return {
        wallColor: '#2A1E2E',
        wainscotColor: '#3E2B3E',
        floorColor: '#EDE0D1',
        floorVein: '#C4A77D',
        accentColor: '#EAB308',
        ambientSky: '#1E1B4B',
        isNightClub: false,
      };
    case 'bar_lounge':
      return {
        wallColor: '#2B1F1B',
        wainscotColor: '#422B22',
        floorColor: '#4F3524',
        floorVein: '#2D1C12',
        accentColor: '#D97706',
        ambientSky: '#1C1917',
        isNightClub: true,
      };
    case 'quarto_cozy':
    case 'casa_estar_moderna':
      return {
        wallColor: '#F6EDE2',
        wainscotColor: '#E4D3BE',
        floorColor: '#B9885C',
        floorVein: '#875A36',
        accentColor: '#C59B4D',
        ambientSky: '#DBEAFE',
        isNightClub: false,
      };
    case 'chao_plano_custom':
      return {
        wallColor: '#E2E8F0',
        wainscotColor: '#CBD5E1',
        floorColor: '#F1F5F9',
        floorVein: '#CBD5E1',
        accentColor: '#C8235D',
        ambientSky: '#CBD5E1',
        isNightClub: false,
      };
    default:
      return {
        wallColor: '#F7ECEE',
        wainscotColor: '#E8D5DB',
        floorColor: '#E8DDD2',
        floorVein: '#C4B19C',
        accentColor: '#B91C4D',
        ambientSky: '#E0F2FE',
        isNightClub: false,
      };
  }
}

export interface AnimatedAquariumFish {
  group: THREE.Group;
  tail: THREE.Mesh;
  axis: 'x' | 'z';
  minCoord: number;
  maxCoord: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  speed: number;
  phase: number;
  bobAmp: number;
}

export interface AnimatedAquariumBubble {
  mesh: THREE.Mesh;
  minY: number;
  maxY: number;
  speed: number;
  phase: number;
  baseX: number;
  baseZ: number;
}

export interface AnimatedJumpingFish {
  group: THREE.Group;
  tail: THREE.Mesh;
  splashRing: THREE.Mesh;
  centerX: number;
  centerZ: number;
  waterY?: number;
  dirAngle: number;
  arcDistance: number;
  jumpHeight: number;
  speed: number;
  phase: number;
}

export interface AnimatedHoppingRabbit {
  group: THREE.Group;
  earL: THREE.Mesh;
  earR: THREE.Mesh;
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  hopHeight: number;
  speed: number;
  phase: number;
}

export interface AnimatedDanceTile {
  material: THREE.MeshStandardMaterial;
  row: number;
  col: number;
}

export interface AnimatedMovingClubLight {
  pivot: THREE.Group;
  beamMat: THREE.MeshBasicMaterial;
  bulbMat: THREE.MeshStandardMaterial;
  pointLight: THREE.PointLight;
  baseX: number;
  baseZ: number;
  speed: number;
  phase: number;
  hueOffset: number;
}

export interface BuiltRoomStage3D {
  group: THREE.Group;
  floorMesh: THREE.Mesh;
  djBoothGroup: THREE.Group | null;
  djScreenMesh: THREE.Mesh | null;
  djDiscs: THREE.Mesh[];
  eqBars: THREE.Mesh[];
  speakerCones: THREE.Mesh[];
  propMeshes: Map<string, THREE.Group>;
  aquariumFish: AnimatedAquariumFish[];
  aquariumBubbles: AnimatedAquariumBubble[];
  jumpingFish: AnimatedJumpingFish[];
  hoppingRabbits: AnimatedHoppingRabbit[];
  danceTiles: AnimatedDanceTile[];
  movingLights: AnimatedMovingClubLight[];
  neonPulseMaterials: THREE.MeshStandardMaterial[];
  skyBackgroundHex?: string;
  fogColorHex?: string;
}

function createIdleDjScreenTexture(
  accentColor: string,
  titleText = 'CABINE DE DJ STARLIGHT',
  subtitleText = 'Clique na cabine para escolher música e vídeo do YouTube',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 640, 360);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(0.5, '#1E1B3A');
    grad.addColorStop(1, '#090D16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 360);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, 608, 328);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(titleText, 320, 162);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '20px sans-serif';
    ctx.fillText(subtitleText, 320, 206);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Cria um peixe tropical 3D articulado com corpo esculpido, nadadeira dorsal e cauda móvel.
 */
function buildTropicalFish3D(
  bodyHex: string,
  stripeHex: string,
  scale = 1,
): { group: THREE.Group; tail: THREE.Mesh } {
  const fishGroup = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(bodyHex),
    emissive: new THREE.Color(bodyHex),
    emissiveIntensity: 0.16,
    roughness: 0.25,
    metalness: 0.15,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(stripeHex),
    emissive: new THREE.Color(stripeHex),
    emissiveIntensity: 0.22,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });

  // Corpo alongado no eixo +Z (frente = +Z, cauda = -Z)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), bodyMat);
  body.scale.set(0.52, 0.78, 1.55);
  body.renderOrder = 2;
  fishGroup.add(body);

  // Faixa ornamental central
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.032, 12), finMat);
  band.rotation.x = Math.PI / 2;
  band.scale.set(0.88, 1.0, 1.18);
  band.position.z = 0.01;
  band.renderOrder = 2;
  fishGroup.add(band);

  // Nadadeira dorsal
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.065, 4), finMat);
  dorsal.rotation.x = -Math.PI * 0.18;
  dorsal.scale.set(0.35, 1, 1.2);
  dorsal.position.set(0, 0.056, -0.015);
  dorsal.renderOrder = 2;
  fishGroup.add(dorsal);

  // Olhos brilhantes laterais
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), eyeMat);
    eye.position.set(side * 0.028, 0.014, 0.068);
    eye.renderOrder = 2;
    fishGroup.add(eye);
  }

  // Cauda articulada na extremidade traseira (-Z)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.085, 4), finMat);
  tail.rotation.x = Math.PI / 2;
  tail.scale.set(0.28, 1.0, 1.15);
  tail.position.set(0, 0, -0.115);
  tail.renderOrder = 2;
  fishGroup.add(tail);

  fishGroup.scale.setScalar(scale);
  return { group: fishGroup, tail };
}

/**
 * Constrói um aquário de vidro arquitetônico de luxo integrado à parede de vidro do terraço.
 */
function buildLuxuryAquarium3D(opts: {
  x: number;
  z: number;
  length: number;
  depth: number;
  height: number;
  axis: 'x' | 'z';
  goldMat: THREE.Material;
  fishList: AnimatedAquariumFish[];
  bubblesList: AnimatedAquariumBubble[];
  seedOffset: number;
}): THREE.Group {
  const aqGroup = new THREE.Group();
  aqGroup.position.set(opts.x, 0, opts.z);

  const w = opts.axis === 'x' ? opts.length : opts.depth;
  const d = opts.axis === 'x' ? opts.depth : opts.length;
  const plinthH = 0.4;
  const tankH = opts.height;

  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0x10141f,
    roughness: 0.28,
    metalness: 0.4,
  });

  // Base de mármore escuro com filete dourado
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, plinthH, d + 0.08), marbleMat);
  plinth.position.y = plinthH * 0.5;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  aqGroup.add(plinth);

  const plinthGold = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.1, 0.045, d + 0.1),
    opts.goldMat,
  );
  plinthGold.position.y = plinthH + 0.015;
  aqGroup.add(plinthGold);

  // Tampa superior de luxo
  const topCapY = plinthH + tankH + 0.05;
  const topCap = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.1, 0.07, d + 0.1),
    marbleMat,
  );
  topCap.position.y = topCapY;
  aqGroup.add(topCap);

  const topGoldTrim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.12, 0.028, d + 0.12),
    opts.goldMat,
  );
  topGoldTrim.position.y = topCapY - 0.035;
  aqGroup.add(topGoldTrim);

  // Cantoneiras verticais metálicas do aquário
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, tankH, 0.045),
        opts.goldMat,
      );
      post.position.set(sx * (w * 0.5), plinthH + tankH * 0.5 + 0.02, sz * (d * 0.5));
      aqGroup.add(post);
    }
  }

  // Fundo de areia dourada + faixa LED subaquática azul-turquesa
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xd9be8c, roughness: 0.9 });
  const sandBed = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.08, d - 0.06), sandMat);
  sandBed.position.y = plinthH + 0.06;
  sandBed.renderOrder = 1;
  aqGroup.add(sandBed);

  const aquaLedMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.35,
  });
  const topGlowBar = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.1, 0.025, d - 0.1),
    aquaLedMat,
  );
  topGlowBar.position.y = plinthH + tankH - 0.01;
  aqGroup.add(topGlowBar);

  // Corais, pedras e vegetação aquática decorativa
  const coralColors = [0xf43f5e, 0xfb923c, 0x10b981, 0xa855f7, 0x22d3ee];
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const decorCount = 7;
  for (let i = 0; i < decorCount; i++) {
    const frac = (i + 0.5) / decorCount - 0.5;
    const spanPos = frac * (opts.length - 0.45);
    const crossOffset = ((i % 3) - 1) * ((opts.depth - 0.18) * 0.22);
    const dx = opts.axis === 'x' ? spanPos : crossOffset;
    const dz = opts.axis === 'x' ? crossOffset : spanPos;

    if (i % 2 === 0) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08 + (i % 3) * 0.02, 0), rockMat);
      rock.scale.set(1.2, 0.65, 1.0);
      rock.position.set(dx, plinthH + 0.11, dz);
      rock.renderOrder = 1;
      aqGroup.add(rock);
    }

    const coralColor = coralColors[(i + opts.seedOffset) % coralColors.length];
    const coralMat = new THREE.MeshStandardMaterial({
      color: coralColor,
      emissive: coralColor,
      emissiveIntensity: 0.25,
      roughness: 0.55,
    });
    const coralH = 0.18 + ((i * 17) % 5) * 0.045;
    const coral = new THREE.Mesh(new THREE.ConeGeometry(0.052, coralH, 6), coralMat);
    coral.position.set(dx, plinthH + 0.08 + coralH * 0.5, dz);
    coral.rotation.z = ((i % 2) * 2 - 1) * 0.12;
    coral.renderOrder = 1;
    aqGroup.add(coral);
  }

  // Peixes tropicais 3D nadando continuamente dentro do aquário
  const fishPalettes: Array<[string, string]> = [
    ['#FF6B2B', '#FFFFFF'], // Peixe-palhaço
    ['#2563EB', '#FACC15'], // Cirurgião-patela
    ['#F59E0B', '#FEF3C7'], // Acará dourado
    ['#EC4899', '#FDE047'], // Disco coral
    ['#06B6D4', '#E0F2FE'], // Neon turquesa
    ['#10B981', '#A7F3D0'], // Donzela esmeralda
    ['#FB7185', '#FFF1F2'], // Betta rosê
  ];

  const fishCount = opts.length > 3.5 ? 7 : 6;
  const halfSpan = opts.length * 0.5 - 0.34;
  for (let f = 0; f < fishCount; f++) {
    const [bodyCol, finCol] = fishPalettes[(f + opts.seedOffset) % fishPalettes.length];
    const fishObj = buildTropicalFish3D(bodyCol, finCol, 0.85 + (f % 3) * 0.14);

    const localY = plinthH + 0.3 + ((f + 0.5) / fishCount) * (tankH - 0.52);
    const crossPos = ((f % 3) - 1) * Math.max(0.05, opts.depth * 0.2);
    const localX = opts.axis === 'x' ? 0 : crossPos;
    const localZ = opts.axis === 'x' ? crossPos : 0;

    fishObj.group.position.set(localX, localY, localZ);
    aqGroup.add(fishObj.group);

    opts.fishList.push({
      group: fishObj.group,
      tail: fishObj.tail,
      axis: opts.axis,
      minCoord: -halfSpan,
      maxCoord: halfSpan,
      baseX: localX,
      baseY: localY,
      baseZ: localZ,
      speed: 0.32 + ((f * 13 + opts.seedOffset) % 5) * 0.08,
      phase: f * 1.35 + opts.seedOffset * 0.9,
      bobAmp: 0.035 + (f % 3) * 0.015,
    });
  }

  // Bolhas subindo na água
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x7dd3fc,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const bubbleCount = 8;
  for (let b = 0; b < bubbleCount; b++) {
    const bPos = (((b + 0.5) / bubbleCount) - 0.5) * (opts.length - 0.55);
    const bx = opts.axis === 'x' ? bPos : ((b % 2) * 2 - 1) * 0.06;
    const bz = opts.axis === 'x' ? ((b % 2) * 2 - 1) * 0.06 : bPos;
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.018 + (b % 2) * 0.008, 7, 7), bubbleMat);
    const minY = plinthH + 0.14;
    const maxY = plinthH + tankH - 0.08;
    bubble.position.set(bx, minY, bz);
    bubble.renderOrder = 3;
    aqGroup.add(bubble);
    opts.bubblesList.push({
      mesh: bubble,
      minY,
      maxY,
      speed: 0.28 + (b % 4) * 0.07,
      phase: b * 0.8 + opts.seedOffset,
      baseX: bx,
      baseZ: bz,
    });
  }

  // Volume de vidro + água transparente azulada (renderOrder alto + depthWrite false para ver os peixes nitidamente)
  const waterGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.12,
    transparent: true,
    opacity: 0.24,
    roughness: 0.06,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const tankBox = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.02, tankH, d - 0.02),
    waterGlassMat,
  );
  tankBox.position.y = plinthH + tankH * 0.5 + 0.02;
  tankBox.renderOrder = 4;
  aqGroup.add(tankBox);

  return aqGroup;
}

/**
 * Constrói o ambiente completo de Terraço de Prédio de Luxo para as Salas Oficiais:
 * - Piso do terraço inteiro em madeira nobre (deck)
 * - Paredes panorâmicas de vidro temperado ao redor
 * - 4 aquários de luxo com peixes nadando continuamente
 * - Horizonte noturno denso com dezenas de prédios iluminados ao redor
 */
function buildOfficialRooftopTerrace(opts: {
  group: THREE.Group;
  pal: RoomThemePalette;
  theme: RoomBackdropTheme;
  fishList: AnimatedAquariumFish[];
  bubblesList: AnimatedAquariumBubble[];
}): THREE.Mesh {
  const { group, pal, theme, fishList, bubblesList } = opts;

  // 1. Piso do terraço de madeira nobre (caminhável para raycast)
  const deckTex = getWoodenDeckTexture('#8A5632', '#3D2110');
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(15.5, 10.5),
    new THREE.MeshStandardMaterial({
      map: deckTex,
      roughness: 0.46,
      metalness: 0.05,
    }),
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.name = 'WalkableFloor';
  group.add(floorMesh);

  // Laje arquitetônica espessa do terraço + corpo do prédio descendo abaixo
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x1e2433,
    roughness: 0.55,
    metalness: 0.35,
  });
  const deckTrimMat = new THREE.MeshStandardMaterial({
    color: 0x5c361c,
    roughness: 0.5,
    metalness: 0.08,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.22,
    metalness: 0.85,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(pal.accentColor || '#D4A853'),
    roughness: 0.24,
    metalness: 0.86,
  });

  // Borda de madeira elevada do deck + laje estrutural do topo do arranha-céu
  const woodBorder = new THREE.Mesh(new THREE.BoxGeometry(15.8, 0.12, 10.8), deckTrimMat);
  woodBorder.position.set(0, -0.065, 0);
  woodBorder.receiveShadow = true;
  group.add(woodBorder);

  const rooftopSlab = new THREE.Mesh(new THREE.BoxGeometry(16.3, 0.58, 11.3), slabMat);
  rooftopSlab.position.set(0, -0.41, 0);
  group.add(rooftopSlab);

  // Corpo do prédio de luxo descendo para a cidade abaixo
  const hostBuildingTex = getSkyscraperWindowTexture('gold');
  const hostBuildingShaft = new THREE.Mesh(
    new THREE.BoxGeometry(15.4, 16, 10.4),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      map: hostBuildingTex,
      emissiveMap: hostBuildingTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.55,
    }),
  );
  hostBuildingShaft.position.set(0, -8.7, 0);
  group.add(hostBuildingShaft);

  // Medalhão central iluminado embutido sobre o deck de madeira
  const danceRing = new THREE.Mesh(
    new THREE.RingGeometry(1.78, 1.94, 48),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(pal.accentColor),
      emissive: new THREE.Color(pal.accentColor),
      emissiveIntensity: 0.65,
      side: THREE.DoubleSide,
    }),
  );
  danceRing.rotation.x = -Math.PI / 2;
  danceRing.position.set(0, 0.009, 0.72);
  group.add(danceRing);

  const danceCore = new THREE.Mesh(
    new THREE.CircleGeometry(1.77, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0x2a1b12,
      roughness: 0.22,
      metalness: 0.25,
      clearcoat: 0.85,
      transparent: true,
      opacity: 0.76,
    }),
  );
  danceCore.rotation.x = -Math.PI / 2;
  danceCore.position.set(0, 0.006, 0.72);
  danceCore.receiveShadow = true;
  group.add(danceCore);

  const isNatal = opts.theme === 'lounge_party_natal';
  const isHalloween = opts.theme === 'lounge_party_halloween';

  if (isNatal) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(5.2, 0, -3.8);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 0.8, 12),
      new THREE.MeshStandardMaterial({ color: 0x5c3a21 }),
    );
    trunk.position.y = 0.4;
    treeGroup.add(trunk);
    const cone1 = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 1.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 }),
    );
    cone1.position.y = 1.2;
    const cone2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 1.1, 16),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 }),
    );
    cone2.position.y = 2.1;
    const cone3 = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4 }),
    );
    cone3.position.y = 2.8;
    treeGroup.add(cone1, cone2, cone3);
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22),
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xfacc15,
        emissiveIntensity: 1.2,
      }),
    );
    star.position.y = 3.35;
    treeGroup.add(star);
    group.add(treeGroup);
  } else if (isHalloween) {
    const pumpkinGroup = new THREE.Group();
    pumpkinGroup.position.set(5.2, 0, -3.8);
    const pMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xc2410c,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x15803d });
    for (const off of [
      [0, 0, 0.6],
      [0.5, 0, -0.4],
      [-0.5, 0, 0],
    ]) {
      const pum = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), pMat);
      pum.scale.set(1.2, 0.85, 1.2);
      pum.position.set(off[0], 0.28, off[2]);
      const st = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.18, 8),
        stemMat,
      );
      st.position.set(off[0], 0.65, off[2]);
      pumpkinGroup.add(pum, st);
    }
    group.add(pumpkinGroup);
  }

  // 2. Paredes panorâmicas de vidro ao redor do terraço (fundo + laterais esquerda e direita)
  const glassWallMat = new THREE.MeshPhysicalMaterial({
    color: 0xbfe7ff,
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    metalness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const wallHeight = 2.45;
  // Parede de vidro traseira (z = -5.12)
  const backGlass = new THREE.Mesh(new THREE.PlaneGeometry(15.3, wallHeight), glassWallMat);
  backGlass.position.set(0, wallHeight * 0.5, -5.12);
  backGlass.renderOrder = 3;
  group.add(backGlass);

  // Corrimão / travessa superior e rodapé metálico traseiro
  const backTopRail = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.08, 0.1), titaniumMat);
  backTopRail.position.set(0, wallHeight, -5.12);
  const backBaseRail = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.12, 0.12), slabMat);
  backBaseRail.position.set(0, 0.06, -5.12);
  group.add(backTopRail, backBaseRail);

  // Montantes verticais na parede de vidro traseira
  for (const mx of [-7.65, -5.1, -2.55, 0, 2.55, 5.1, 7.65]) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, 0.1), titaniumMat);
    mullion.position.set(mx, wallHeight * 0.5, -5.12);
    group.add(mullion);
  }

  // Paredes de vidro laterais (esquerda x = -7.65, direita x = +7.65)
  for (const side of [-1, 1]) {
    const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(10.36, wallHeight), glassWallMat);
    sideGlass.rotation.y = Math.PI / 2;
    sideGlass.position.set(side * 7.65, wallHeight * 0.5, 0.06);
    sideGlass.renderOrder = 3;
    group.add(sideGlass);

    const sideTopRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 10.5), titaniumMat);
    sideTopRail.position.set(side * 7.65, wallHeight, 0.06);
    const sideBaseRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 10.5), slabMat);
    sideBaseRail.position.set(side * 7.65, 0.06, 0.06);
    group.add(sideTopRail, sideBaseRail);

    for (const mz of [-2.55, 0, 2.55, 5.18]) {
      const sMullion = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallHeight, 0.08), titaniumMat);
      sMullion.position.set(side * 7.65, wallHeight * 0.5, mz);
      group.add(sMullion);
    }

    // Coluna cilíndrica estrutural nos cantos do terraço
    const backCol = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.6, 16), titaniumMat);
    backCol.position.set(side * 7.58, 1.8, -5.06);
    const frontCol = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.4, 16), titaniumMat);
    frontCol.position.set(side * 7.58, 1.7, 5.12);
    group.add(backCol, frontCol);
  }

  // Pontos de LED decorativos (vermelho, amarelo, azul) ao longo da base das paredes de vidro
  const ledHexes = [0xef4444, 0xfacc15, 0x38bdf8];
  for (let i = 0; i < 6; i++) {
    const zPos = -4.2 + i * 1.7;
    const cHex = ledHexes[i % ledHexes.length];
    const ledMat = new THREE.MeshStandardMaterial({
      color: cHex,
      emissive: cHex,
      emissiveIntensity: 1.4,
    });
    for (const side of [-1, 1]) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), ledMat);
      orb.position.set(side * 7.52, 0.18, zPos);
      group.add(orb);
    }
  }

  // Vasos geométricos modernos com folhagem tropical nos cantos do terraço
  const potColors = [0xd4a853, 0xcbd5e1, 0xa855f7];
  const plantLeafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 });
  const plantSpots: Array<[number, number]> = [
    [-6.55, -4.45],
    [6.55, -4.45],
    [-6.7, 4.15],
    [6.7, 4.15],
  ];
  plantSpots.forEach(([px, pz], idx) => {
    const pGroup = new THREE.Group();
    pGroup.position.set(px, 0, pz);
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.17, 0.42, 7),
      new THREE.MeshStandardMaterial({
        color: potColors[idx % potColors.length],
        roughness: 0.35,
        metalness: 0.4,
      }),
    );
    pot.position.y = 0.21;
    pGroup.add(pot);
    for (let l = 0; l < 6; l++) {
      const angle = (l / 6) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.42, 4), plantLeafMat);
      leaf.position.set(Math.cos(angle) * 0.11, 0.54, Math.sin(angle) * 0.11);
      leaf.rotation.z = -Math.cos(angle) * 0.48;
      leaf.rotation.x = Math.sin(angle) * 0.48;
      pGroup.add(leaf);
    }
    group.add(pGroup);
  });

  // 3. Quatro aquários panorâmicos de luxo ao redor das paredes de vidro com peixes nadando
  group.add(
    buildLuxuryAquarium3D({
      x: -4.4,
      z: -4.74,
      length: 3.15,
      depth: 0.56,
      height: 1.5,
      axis: 'x',
      goldMat: goldTrimMat,
      fishList,
      bubblesList,
      seedOffset: 1,
    }),
  );
  group.add(
    buildLuxuryAquarium3D({
      x: 4.4,
      z: -4.74,
      length: 3.15,
      depth: 0.56,
      height: 1.5,
      axis: 'x',
      goldMat: goldTrimMat,
      fishList,
      bubblesList,
      seedOffset: 4,
    }),
  );
  group.add(
    buildLuxuryAquarium3D({
      x: -7.24,
      z: -0.1,
      length: 4.1,
      depth: 0.56,
      height: 1.5,
      axis: 'z',
      goldMat: goldTrimMat,
      fishList,
      bubblesList,
      seedOffset: 7,
    }),
  );
  group.add(
    buildLuxuryAquarium3D({
      x: 7.24,
      z: -0.1,
      length: 4.1,
      depth: 0.56,
      height: 1.5,
      axis: 'z',
      goldMat: goldTrimMat,
      fishList,
      bubblesList,
      seedOffset: 10,
    }),
  );

  // 4. Plano de fundo urbano denso com um monte de outros prédios iluminados ao redor
  const skylineGroup = new THREE.Group();
  skylineGroup.name = 'CitySkyline3D';

  const winTexGold = getSkyscraperWindowTexture('gold');
  const winTexCyan = getSkyscraperWindowTexture('cyan');
  const winTexIvory = getSkyscraperWindowTexture('ivory');
  const texChoices = [winTexGold, winTexCyan, winTexIvory];

  const roofAccentColors = [0xf59e0b, 0x38bdf8, 0xf43f5e, 0xa855f7, 0x22d3ee];

  const buildingSpecs: Array<{
    x: number;
    z: number;
    w: number;
    d: number;
    topY: number;
    texIdx: number;
    accentIdx: number;
    hasSpire?: boolean;
  }> = [
    // Fileira próxima atrás do terraço (visão imediata através do vidro traseiro)
    { x: -12.5, z: -9.5, w: 3.2, d: 3.0, topY: 7.5, texIdx: 0, accentIdx: 0, hasSpire: true },
    { x: -8.6, z: -10.8, w: 2.8, d: 2.8, topY: 5.2, texIdx: 1, accentIdx: 1 },
    { x: -5.2, z: -9.2, w: 2.5, d: 2.4, topY: 3.6, topTex: 0 } as never,
    { x: -1.8, z: -11.4, w: 3.4, d: 3.2, topY: 8.8, texIdx: 2, accentIdx: 4, hasSpire: true },
    { x: 2.1, z: -9.8, w: 2.6, d: 2.6, topY: 4.8, texIdx: 0, accentIdx: 0 },
    { x: 5.8, z: -10.6, w: 3.1, d: 2.9, topY: 6.9, texIdx: 1, accentIdx: 1, hasSpire: true },
    { x: 9.8, z: -9.4, w: 2.9, d: 2.8, topY: 5.8, texIdx: 2, accentIdx: 2 },
    { x: 13.6, z: -10.2, w: 3.4, d: 3.0, topY: 8.2, texIdx: 0, accentIdx: 0 },

    // Fileira intermediária densa
    { x: -19.5, z: -15.5, w: 4.2, d: 3.8, topY: 11.4, texIdx: 1, accentIdx: 1, hasSpire: true },
    { x: -14.8, z: -16.8, w: 3.6, d: 3.4, topY: 9.2, texIdx: 2, accentIdx: 3 },
    { x: -10.4, z: -15.2, w: 3.4, d: 3.4, topY: 12.6, texIdx: 0, accentIdx: 0, hasSpire: true },
    { x: -6.4, z: -17.5, w: 3.8, d: 3.6, topY: 10.5, texIdx: 1, accentIdx: 4 },
    { x: -2.4, z: -16.2, w: 3.2, d: 3.0, topY: 7.4, texIdx: 0, accentIdx: 0 },
    { x: 1.4, z: -18.4, w: 4.0, d: 3.8, topY: 13.8, texIdx: 2, accentIdx: 1, hasSpire: true },
    { x: 5.9, z: -16.6, w: 3.2, d: 3.2, topY: 9.8, texIdx: 0, accentIdx: 2 },
    { x: 10.2, z: -15.4, w: 3.7, d: 3.5, topY: 11.8, texIdx: 1, accentIdx: 1, hasSpire: true },
    { x: 15.1, z: -17.2, w: 3.8, d: 3.4, topY: 9.4, texIdx: 2, accentIdx: 0 },
    { x: 19.8, z: -15.8, w: 4.2, d: 3.8, topY: 12.4, texIdx: 0, accentIdx: 3, hasSpire: true },

    // Fileira profunda de arranha-céus altos ao fundo
    { x: -26.0, z: -24.5, w: 4.8, d: 4.4, topY: 15.2, texIdx: 0, accentIdx: 0, hasSpire: true },
    { x: -20.0, z: -26.5, w: 4.4, d: 4.0, topY: 14.0, texIdx: 2, accentIdx: 1 },
    { x: -13.5, z: -25.0, w: 4.6, d: 4.2, topY: 17.5, texIdx: 1, accentIdx: 4, hasSpire: true },
    { x: -7.5, z: -27.5, w: 4.2, d: 4.0, topY: 15.0, texIdx: 0, accentIdx: 0 },
    { x: -1.5, z: -26.0, w: 4.6, d: 4.4, topY: 18.8, texIdx: 1, accentIdx: 1, hasSpire: true },
    { x: 4.8, z: -28.0, w: 4.4, d: 4.0, topY: 14.6, texIdx: 2, accentIdx: 2 },
    { x: 11.2, z: -25.5, w: 4.8, d: 4.2, topY: 16.8, texIdx: 0, accentIdx: 0, hasSpire: true },
    { x: 17.6, z: -27.0, w: 4.2, d: 4.0, topY: 13.5, texIdx: 1, accentIdx: 3 },
    { x: 24.5, z: -24.8, w: 4.8, d: 4.4, topY: 16.0, texIdx: 2, accentIdx: 1, hasSpire: true },

    // Torres laterais esquerda e direita vistas através das paredes de vidro laterais
    { x: -12.6, z: -4.2, w: 3.1, d: 3.2, topY: 6.4, texIdx: 1, accentIdx: 1 },
    { x: -13.4, z: 0.4, w: 3.2, d: 3.2, topY: 8.1, texIdx: 0, accentIdx: 0, hasSpire: true },
    { x: -12.8, z: 4.8, w: 3.0, d: 3.0, topY: 5.5, texIdx: 2, accentIdx: 4 },
    { x: -18.2, z: -7.0, w: 3.8, d: 3.8, topY: 10.6, texIdx: 0, accentIdx: 0 },
    { x: -18.8, z: -1.6, w: 4.0, d: 3.6, topY: 12.2, texIdx: 1, accentIdx: 1, hasSpire: true },
    { x: -17.6, z: 3.8, w: 3.6, d: 3.5, topY: 9.0, texIdx: 2, accentIdx: 2 },

    { x: 12.6, z: -4.2, w: 3.1, d: 3.2, topY: 7.2, texIdx: 0, accentIdx: 0 },
    { x: 13.4, z: 0.4, w: 3.2, d: 3.2, topY: 9.2, texIdx: 1, accentIdx: 1, hasSpire: true },
    { x: 12.8, z: 4.8, w: 3.0, d: 3.0, topY: 5.8, texIdx: 2, accentIdx: 3 },
    { x: 18.2, z: -7.0, w: 3.8, d: 3.8, topY: 11.4, texIdx: 2, accentIdx: 4 },
    { x: 18.8, z: -1.6, w: 4.0, d: 3.6, topY: 13.0, texIdx: 0, accentIdx: 0, hasSpire: true },
    { x: 17.6, z: 3.8, w: 3.6, d: 3.5, topY: 9.6, texIdx: 1, accentIdx: 1 },
  ];

  // Corrige entrada com typo eventual no array acima
  buildingSpecs[2] = { x: -5.2, z: -9.2, w: 2.7, d: 2.5, topY: 4.2, texIdx: 0, accentIdx: 2 };

  for (const spec of buildingSpecs) {
    const baseY = -14;
    const totalH = spec.topY - baseY;
    const tex = texChoices[spec.texIdx % texChoices.length];
    const bMat = new THREE.MeshStandardMaterial({
      color: 0x0b1224,
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.78,
      roughness: 0.3,
      metalness: 0.45,
    });

    const tower = new THREE.Mesh(new THREE.BoxGeometry(spec.w, totalH, spec.d), bMat);
    tower.position.set(spec.x, baseY + totalH * 0.5, spec.z);
    skylineGroup.add(tower);

    // Coroa / cobertura iluminada no topo do prédio
    const accentCol = roofAccentColors[spec.accentIdx % roofAccentColors.length];
    const crownGlow = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w * 0.84, 0.24, spec.d * 0.84),
      new THREE.MeshStandardMaterial({
        color: accentCol,
        emissive: accentCol,
        emissiveIntensity: 1.0,
        roughness: 0.25,
      }),
    );
    crownGlow.position.set(spec.x, spec.topY + 0.12, spec.z);
    skylineGroup.add(crownGlow);

    if (spec.hasSpire) {
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.09, 2.2, 8),
        titaniumMat,
      );
      spire.position.set(spec.x, spec.topY + 1.3, spec.z);
      skylineGroup.add(spire);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
      );
      beacon.position.set(spec.x, spec.topY + 2.42, spec.z);
      skylineGroup.add(beacon);
    }
  }

  if (isNatal) {
    // Lua de inverno / noite estrelada festiva de natal
    const moonDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff8db }),
    );
    moonDisc.position.set(13.5, 17.5, -36);
    skylineGroup.add(moonDisc);

    // Estrelas cintilantes no céu noturno
    const starGeo = new THREE.BufferGeometry();
    const starCount = 90;
    const starPos = new Float32Array(starCount * 3);
    for (let s = 0; s < starCount; s++) {
      starPos[s * 3] = (Math.random() - 0.5) * 55;
      starPos[s * 3 + 1] = 6 + Math.random() * 20;
      starPos[s * 3 + 2] = -20 - Math.random() * 18;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.25,
      transparent: true,
      opacity: 0.85,
    });
    const stars = new THREE.Points(starGeo, starMat);
    skylineGroup.add(stars);
  } else if (isHalloween) {
    // Lua macabra de Halloween alaranjada com halo místico púrpura
    const bloodMoon = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 32),
      new THREE.MeshBasicMaterial({ color: 0xf97316 }),
    );
    bloodMoon.position.set(13.5, 17.5, -36);
    skylineGroup.add(bloodMoon);

    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(3.0, 32),
      new THREE.MeshBasicMaterial({
        color: 0x9333ea,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    halo.position.set(13.5, 17.5, -36.2);
    skylineGroup.add(halo);
  } else {
    // Sol radiante diurno + nuvens fofas brancas no céu azul limpo
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32),
      new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
    );
    sunDisc.position.set(13.5, 17.5, -36);
    skylineGroup.add(sunDisc);

    const sunGlow = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    sunGlow.position.set(13.5, 17.5, -36.2);
    skylineGroup.add(sunGlow);

    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    for (let c = 0; c < 5; c++) {
      const cloudGrp = new THREE.Group();
      const cx = -18 + c * 9.5;
      const cy = 14 + (c % 2) * 2.5;
      const cz = -32 - (c % 3) * 3;
      cloudGrp.position.set(cx, cy, cz);
      for (let p = 0; p < 4; p++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(0.9 + (p % 2) * 0.4, 8, 8),
          cloudMat,
        );
        puff.position.set((p - 1.5) * 1.1, (p % 2) * 0.3, 0);
        cloudGrp.add(puff);
      }
      skylineGroup.add(cloudGrp);
    }
  }

  group.add(skylineGroup);
  return floorMesh;
}

function getTropicalSandTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#F2D296';
    ctx.fillRect(0, 0, 512, 512);

    // Ondulações suaves de areia da praia
    for (let y = 0; y < 512; y += 16) {
      ctx.strokeStyle = y % 32 === 0 ? 'rgba(217, 174, 104, 0.25)' : 'rgba(255, 246, 224, 0.22)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 32) {
        const yy = y + Math.sin((x / 512) * Math.PI * 4) * 5;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // Grãos finos de areia
    for (let i = 0; i < 3600; i++) {
      const rx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const ry = (Math.sin(i * 78.233) * 43758.5453) % 1;
      const px = Math.abs(rx) * 512;
      const py = Math.abs(ry) * 512;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(180, 130, 70, 0.22)' : 'rgba(255, 250, 235, 0.35)';
      ctx.fillRect(px, py, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 4;
  return tex;
}

function getTropicalOceanTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#0284C7');
    grad.addColorStop(0.5, '#06B6D4');
    grad.addColorStop(1, '#0EA5E9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Reflexos solares e cáusticas marinhas
    for (let i = 0; i < 180; i++) {
      const rx = Math.abs((Math.sin(i * 23.14) * 19283.4) % 1) * 512;
      const ry = Math.abs((Math.cos(i * 41.77) * 29384.1) % 1) * 512;
      const r = 10 + (i % 24);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(186, 230, 253, 0.24)' : 'rgba(103, 232, 249, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(rx, ry, r * 1.4, r * 0.65, (i % 5) * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Constrói um coqueiro tropical grande e realista com tronco segmentado curvado,
 * cacho de cocos e copa com folhas arqueadas.
 */
function buildCoconutPalmTree3D(opts: {
  scale: number;
  leanX: number;
  leanZ: number;
  seed: number;
}): THREE.Group {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x7c5333,
    roughness: 0.88,
    metalness: 0.02,
  });
  const trunkRingMat = new THREE.MeshStandardMaterial({
    color: 0x5b3b22,
    roughness: 0.92,
  });
  const coconutMat = new THREE.MeshStandardMaterial({
    color: 0x4b2c15,
    roughness: 0.72,
    metalness: 0.05,
  });
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.46,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const frondLightMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });

  // Base arenosa na raiz do coqueiro
  const rootMound = new THREE.Mesh(
    new THREE.ConeGeometry(0.48, 0.24, 14),
    new THREE.MeshStandardMaterial({ color: 0xe6c17e, roughness: 0.92 }),
  );
  rootMound.position.y = 0.1;
  tree.add(rootMound);

  // Tronco curvado em 8 anéis segmentados
  const segments = 8;
  const segH = 0.56;
  let curX = 0;
  let curY = 0;
  let curZ = 0;
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    const nextT = (i + 1) / segments;
    const rBottom = 0.23 * (1 - t * 0.48);
    const rTop = 0.23 * (1 - nextT * 0.48);
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom, segH * 1.08, 10),
      i % 2 === 0 ? trunkMat : trunkRingMat,
    );
    const stepX = opts.leanX * (0.12 + t * 0.18);
    const stepZ = opts.leanZ * (0.12 + t * 0.18);
    seg.position.set(curX + stepX * 0.5, curY + segH * 0.5, curZ + stepZ * 0.5);
    seg.rotation.z = -stepX * 1.1;
    seg.rotation.x = stepZ * 1.1;
    seg.castShadow = true;
    tree.add(seg);

    curX += stepX;
    curY += segH * 0.96;
    curZ += stepZ;
  }

  // Topo da copa com cacho de cocos e folhas arqueadas
  const crown = new THREE.Group();
  crown.position.set(curX, curY, curZ);

  // Cacho de 5 cocos grandes bem visíveis abaixo das folhas
  for (let c = 0; c < 5; c++) {
    const angle = (c / 5) * Math.PI * 2 + opts.seed * 0.7;
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 10), coconutMat);
    coco.scale.set(0.95, 1.18, 0.95);
    coco.position.set(
      Math.cos(angle) * 0.22,
      -0.12 - (c % 2) * 0.08,
      Math.sin(angle) * 0.22,
    );
    coco.castShadow = true;
    crown.add(coco);
  }

  // 9 folhas de palmeira arqueadas em 360 graus
  const frondCount = 9;
  for (let f = 0; f < frondCount; f++) {
    const az = (f / frondCount) * Math.PI * 2 + (opts.seed % 3) * 0.35;
    const frondPivot = new THREE.Group();
    frondPivot.rotation.y = az;

    const spineMat = f % 2 === 0 ? frondMat : frondLightMat;
    // 4 segmentos arqueados por folha para formar a curvatura clássica do coqueiro
    let fx = 0;
    let fy = 0.06;
    for (let s = 0; s < 4; s++) {
      const segLen = 0.58;
      const segW = 0.42 - s * 0.085;
      const droop = 0.22 - s * 0.34;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(segLen, 0.035, segW),
        spineMat,
      );
      blade.position.set(fx + segLen * 0.48, fy + droop * 0.22, 0);
      blade.rotation.z = droop;
      blade.castShadow = true;
      frondPivot.add(blade);
      fx += segLen * 0.88;
      fy += Math.sin(droop) * segLen * 0.85;
    }

    // Folhas secundárias superiores no centro da copa
    if (f % 2 === 0) {
      const innerFrond = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.95, 5),
        frondLightMat,
      );
      innerFrond.rotation.z = -Math.PI * 0.28;
      innerFrond.position.set(0.42, 0.36, 0);
      frondPivot.add(innerFrond);
    }

    crown.add(frondPivot);
  }

  tree.add(crown);
  tree.scale.setScalar(opts.scale);
  return tree;
}

/**
 * Constrói o cenário 3D oficial da Ilha Tropical (Ilha Brasil / Spanish / English)
 * rodeada de água azul-turquesa, areia dourada, grandes coqueiros com cocos,
 * peixes saltando na água e espaço para 3 Cabines de DJ funcionais.
 */
function buildTropicalIslandStage(opts: {
  group: THREE.Group;
  pal: RoomThemePalette;
  jumpingFishList: AnimatedJumpingFish[];
}): THREE.Mesh {
  const { group, jumpingFishList } = opts;
  const sandTex = getTropicalSandTexture();
  const oceanTex = getTropicalOceanTexture();

  // 1. Mar tropical amplo em 360 graus ao redor da ilha
  const oceanGeo = new THREE.CircleGeometry(68, 64);
  const oceanMat = new THREE.MeshPhysicalMaterial({
    map: oceanTex,
    color: 0x22d3ee,
    roughness: 0.18,
    metalness: 0.08,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
  });
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.y = -0.24;
  oceanMesh.receiveShadow = true;
  group.add(oceanMesh);

  // Lagoa rasa turquesa + espuma branca ao redor da orla da ilha
  const lagoonRing = new THREE.Mesh(
    new THREE.RingGeometry(7.2, 10.6, 64),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  lagoonRing.rotation.x = -Math.PI / 2;
  lagoonRing.scale.set(1.12, 0.88, 1);
  lagoonRing.position.y = -0.22;
  group.add(lagoonRing);

  const seaFoamRing = new THREE.Mesh(
    new THREE.RingGeometry(7.35, 7.72, 64),
    new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  seaFoamRing.rotation.x = -Math.PI / 2;
  seaFoamRing.scale.set(1.12, 0.88, 1);
  seaFoamRing.position.y = -0.21;
  group.add(seaFoamRing);

  // 2. Banco de areia inclinado submerso + porção de terra caminhável da ilha
  const beachSlope = new THREE.Mesh(
    new THREE.CylinderGeometry(7.05, 8.35, 0.36, 56),
    new THREE.MeshStandardMaterial({
      map: sandTex,
      color: 0xebd096,
      roughness: 0.9,
      metalness: 0.02,
    }),
  );
  beachSlope.scale.set(1.12, 1, 0.88);
  beachSlope.position.y = -0.185;
  beachSlope.receiveShadow = true;
  group.add(beachSlope);

  const floorGeo = new THREE.CircleGeometry(7.05, 56);
  const floorMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.scale.set(1.12, 0.88, 1);
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  floorMesh.name = 'WalkableFloor';
  group.add(floorMesh);

  // Vegetação tropical suave + deck de madeira central para a praia
  const grassPatch = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 36),
    new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  grassPatch.rotation.x = -Math.PI / 2;
  grassPatch.scale.set(1.45, 0.78, 1);
  grassPatch.position.set(0, 0.008, -2.55);
  grassPatch.receiveShadow = true;
  group.add(grassPatch);

  // Pedras costeiras naturais ao redor da praia
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x78716c,
    roughness: 0.86,
    metalness: 0.05,
  });
  const rockAngles = [0.42, 1.15, 2.08, 2.85, 3.65, 4.45, 5.15, 5.88];
  rockAngles.forEach((ang, idx) => {
    const rx = Math.cos(ang) * 7.65;
    const rz = Math.sin(ang) * 6.0;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38 + (idx % 3) * 0.14, 0), rockMat);
    rock.scale.set(1.3, 0.65, 1.1);
    rock.position.set(rx, -0.1, rz);
    rock.rotation.y = ang * 1.7;
    rock.receiveShadow = true;
    rock.castShadow = true;
    group.add(rock);
  });

  // 3. Coqueiros grandes com cocos ao redor da ilha
  const palmPlacements = [
    { x: -6.35, z: -2.4, scale: 1.25, leanX: -0.35, leanZ: -0.15, seed: 1 },
    { x: -5.8, z: 2.35, scale: 1.12, leanX: -0.45, leanZ: 0.25, seed: 2 },
    { x: -3.2, z: -4.45, scale: 1.32, leanX: -0.25, leanZ: -0.35, seed: 3 },
    { x: 3.2, z: -4.45, scale: 1.3, leanX: 0.25, leanZ: -0.35, seed: 4 },
    { x: 6.35, z: -2.4, scale: 1.22, leanX: 0.35, leanZ: -0.15, seed: 5 },
    { x: 5.8, z: 2.35, scale: 1.14, leanX: 0.45, leanZ: 0.25, seed: 6 },
    { x: -6.7, z: 0.15, scale: 1.05, leanX: -0.5, leanZ: 0.05, seed: 7 },
    { x: 6.7, z: 0.15, scale: 1.08, leanX: 0.5, leanZ: 0.05, seed: 8 },
  ];
  for (const p of palmPlacements) {
    const palm = buildCoconutPalmTree3D({
      scale: p.scale,
      leanX: p.leanX,
      leanZ: p.leanZ,
      seed: p.seed,
    });
    palm.position.set(p.x, -0.02, p.z);
    group.add(palm);
  }

  // 4. Peixes tropicais saltando na água ao redor da ilha
  const jumpingConfigs = [
    { angle: 0.35, dist: 9.2, body: '#FF6B2B', stripe: '#FFFFFF', scale: 2.6, speed: 0.72, phase: 0.0 },
    { angle: 0.92, dist: 10.6, body: '#0EA5E9', stripe: '#FEF08A', scale: 2.4, speed: 0.65, phase: 1.4 },
    { angle: 1.52, dist: 8.6, body: '#FACC15', stripe: '#0F172A', scale: 2.7, speed: 0.78, phase: 2.7 },
    { angle: 2.15, dist: 10.1, body: '#EC4899', stripe: '#FDF2F8', scale: 2.3, speed: 0.68, phase: 0.8 },
    { angle: 2.78, dist: 9.4, body: '#22D3EE', stripe: '#FFFFFF', scale: 2.5, speed: 0.74, phase: 3.9 },
    { angle: 3.45, dist: 10.8, body: '#F97316', stripe: '#FEF3C7', scale: 2.8, speed: 0.62, phase: 2.1 },
    { angle: 4.15, dist: 9.8, body: '#38BDF8', stripe: '#FDE047', scale: 2.5, speed: 0.76, phase: 4.5 },
    { angle: 4.82, dist: 10.5, body: '#FB7185', stripe: '#FFFFFF', scale: 2.4, speed: 0.7, phase: 1.1 },
    { angle: 5.45, dist: 9.0, body: '#FBBF24', stripe: '#1E293B', scale: 2.6, speed: 0.8, phase: 3.2 },
    { angle: 5.95, dist: 10.2, body: '#34D399', stripe: '#FEF9C3', scale: 2.4, speed: 0.66, phase: 5.0 },
  ];

  for (const cfg of jumpingConfigs) {
    const cx = Math.cos(cfg.angle) * cfg.dist * 1.12;
    const cz = Math.sin(cfg.angle) * cfg.dist * 0.88;
    const builtFish = buildTropicalFish3D(cfg.body, cfg.stripe, cfg.scale);
    builtFish.group.position.set(cx, -0.5, cz);
    group.add(builtFish.group);

    const splashRing = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.34, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    splashRing.rotation.x = -Math.PI / 2;
    splashRing.position.set(cx, -0.2, cz);
    group.add(splashRing);

    jumpingFishList.push({
      group: builtFish.group,
      tail: builtFish.tail,
      splashRing,
      centerX: cx,
      centerZ: cz,
      dirAngle: cfg.angle + Math.PI * 0.5,
      arcDistance: 2.1,
      jumpHeight: 1.45,
      speed: cfg.speed,
      phase: cfg.phase,
    });
  }

  // 5. Céu tropical ensolarado, sol dourado, nuvens e ilhotas distantes no horizonte
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.8, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfef08a }),
  );
  sun.position.set(22, 22, -38);
  group.add(sun);

  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  for (let c = 0; c < 6; c++) {
    const cloudGrp = new THREE.Group();
    const cx = -24 + c * 9.5;
    const cy = 14 + (c % 2) * 2.8;
    const cz = -34 - (c % 3) * 4;
    cloudGrp.position.set(cx, cy, cz);
    for (let p = 0; p < 4; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.1 + (p % 2) * 0.45, 8, 8), cloudMat);
      puff.position.set((p - 1.5) * 1.25, (p % 2) * 0.35, 0);
      cloudGrp.add(puff);
    }
    group.add(cloudGrp);
  }

  // Ilhotas distantes ao fundo para profundidade natural
  const distantIsleMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    const isle = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.2, 16), distantIsleMat);
    isle.scale.set(1.6, 0.7, 1.2);
    isle.position.set(Math.cos(a) * 38, 0.4, Math.sin(a) * 34);
    group.add(isle);
  }

  return floorMesh;
}

/**
 * Ilha do Coqueiro & Mar (Starplaza):
 * Ilha rodeada de água do mar azul-turquesa, exatamente 1 coqueiro com cocos,
 * 1 Cabine de DJ funcional e peixes saltando na água do mar.
 */
function buildSinglePalmIslandStage(opts: {
  group: THREE.Group;
  jumpingFishList: AnimatedJumpingFish[];
}): THREE.Mesh {
  const { group, jumpingFishList } = opts;
  const sandTex = getTropicalSandTexture();
  const oceanTex = getTropicalOceanTexture();

  // 1. Mar azul-turquesa em 360 graus ao redor da ilha
  const oceanMesh = new THREE.Mesh(
    new THREE.CircleGeometry(68, 64),
    new THREE.MeshPhysicalMaterial({
      map: oceanTex,
      color: 0x06b6d4,
      roughness: 0.16,
      metalness: 0.08,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    }),
  );
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.y = -0.24;
  oceanMesh.receiveShadow = true;
  group.add(oceanMesh);

  // Lagoa rasa + anel de espuma branca na orla
  const lagoonRing = new THREE.Mesh(
    new THREE.RingGeometry(6.9, 10.4, 64),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  lagoonRing.rotation.x = -Math.PI / 2;
  lagoonRing.scale.set(1.12, 0.88, 1);
  lagoonRing.position.y = -0.22;
  group.add(lagoonRing);

  const seaFoamRing = new THREE.Mesh(
    new THREE.RingGeometry(7.15, 7.52, 64),
    new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  seaFoamRing.rotation.x = -Math.PI / 2;
  seaFoamRing.scale.set(1.12, 0.88, 1);
  seaFoamRing.position.y = -0.21;
  group.add(seaFoamRing);

  // 2. Banco de areia inclinado + porção de areia caminhável da ilha
  const beachSlope = new THREE.Mesh(
    new THREE.CylinderGeometry(6.85, 8.15, 0.36, 56),
    new THREE.MeshStandardMaterial({
      map: sandTex,
      color: 0xebd096,
      roughness: 0.9,
      metalness: 0.02,
    }),
  );
  beachSlope.scale.set(1.12, 1, 0.88);
  beachSlope.position.y = -0.185;
  beachSlope.receiveShadow = true;
  group.add(beachSlope);

  const floorMesh = new THREE.Mesh(
    new THREE.CircleGeometry(6.85, 56),
    new THREE.MeshStandardMaterial({
      map: sandTex,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.scale.set(1.12, 0.88, 1);
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  floorMesh.name = 'WalkableFloor';
  group.add(floorMesh);

  // Pedras naturais costeiras
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.86 });
  for (const ang of [0.55, 1.85, 3.05, 4.3, 5.45]) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), rockMat);
    rock.scale.set(1.3, 0.65, 1.1);
    rock.position.set(Math.cos(ang) * 7.45, -0.1, Math.sin(ang) * 5.85);
    rock.rotation.y = ang * 1.4;
    rock.castShadow = true;
    group.add(rock);
  }

  // 3. EXATAMENTE 1 coqueiro grande com cocos na ilha
  const singlePalm = buildCoconutPalmTree3D({
    scale: 1.42,
    leanX: 0.28,
    leanZ: 0.14,
    seed: 3,
  });
  singlePalm.position.set(-4.3, -0.02, -1.95);
  group.add(singlePalm);

  // 4. Peixes pulando na água do mar ao redor da ilha
  const seaFishConfigs = [
    { angle: 0.38, dist: 9.0, body: '#FF6B2B', stripe: '#FFFFFF', scale: 2.6, speed: 0.75, phase: 0.0 },
    { angle: 1.15, dist: 10.2, body: '#0EA5E9', stripe: '#FEF08A', scale: 2.5, speed: 0.68, phase: 1.3 },
    { angle: 1.95, dist: 8.8, body: '#FACC15', stripe: '#0F172A', scale: 2.7, speed: 0.78, phase: 2.5 },
    { angle: 2.75, dist: 9.8, body: '#EC4899', stripe: '#FDF2F8', scale: 2.4, speed: 0.72, phase: 0.9 },
    { angle: 3.55, dist: 10.5, body: '#22D3EE', stripe: '#FFFFFF', scale: 2.6, speed: 0.64, phase: 3.4 },
    { angle: 4.35, dist: 9.4, body: '#F97316', stripe: '#FEF3C7', scale: 2.8, speed: 0.76, phase: 1.8 },
    { angle: 5.15, dist: 10.1, body: '#34D399', stripe: '#FEF9C3', scale: 2.5, speed: 0.7, phase: 4.2 },
    { angle: 5.88, dist: 9.1, body: '#FB7185', stripe: '#FFFFFF', scale: 2.5, speed: 0.8, phase: 2.9 },
  ];

  for (const cfg of seaFishConfigs) {
    const cx = Math.cos(cfg.angle) * cfg.dist * 1.12;
    const cz = Math.sin(cfg.angle) * cfg.dist * 0.88;
    const builtFish = buildTropicalFish3D(cfg.body, cfg.stripe, cfg.scale);
    builtFish.group.position.set(cx, -0.5, cz);
    group.add(builtFish.group);

    const splashRing = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.34, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    splashRing.rotation.x = -Math.PI / 2;
    splashRing.position.set(cx, -0.2, cz);
    group.add(splashRing);

    jumpingFishList.push({
      group: builtFish.group,
      tail: builtFish.tail,
      splashRing,
      centerX: cx,
      centerZ: cz,
      waterY: -0.22,
      dirAngle: cfg.angle + Math.PI * 0.5,
      arcDistance: 2.1,
      jumpHeight: 1.45,
      speed: cfg.speed,
      phase: cfg.phase,
    });
  }

  // 5. Sol e nuvens no céu limpo tropical
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfef08a }),
  );
  sun.position.set(22, 22, -38);
  group.add(sun);

  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  for (let c = 0; c < 5; c++) {
    const cloudGrp = new THREE.Group();
    cloudGrp.position.set(-22 + c * 11, 14 + (c % 2) * 2.5, -34 - (c % 3) * 4);
    for (let p = 0; p < 4; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.05 + (p % 2) * 0.4, 8, 8), cloudMat);
      puff.position.set((p - 1.5) * 1.2, (p % 2) * 0.3, 0);
      cloudGrp.add(puff);
    }
    group.add(cloudGrp);
  }

  return floorMesh;
}

function getForestGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#4ADE80';
    ctx.fillRect(0, 0, 512, 512);

    // Manchas orgânicas de musgo e sol no gramado
    for (let i = 0; i < 42; i++) {
      const rx = Math.abs((Math.sin(i * 19.31) * 43758.54) % 1) * 512;
      const ry = Math.abs((Math.cos(i * 47.17) * 29381.2) % 1) * 512;
      const r = 24 + (i % 5) * 14;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(34, 197, 94, 0.34)' : 'rgba(134, 239, 172, 0.25)';
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fios de grama e trevos
    for (let i = 0; i < 2400; i++) {
      const rx = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1) * 512;
      const ry = Math.abs((Math.sin(i * 78.233) * 43758.5453) % 1) * 512;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(21, 128, 61, 0.36)' : 'rgba(187, 247, 208, 0.32)';
      ctx.fillRect(rx, ry, 2, 5);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = 4;
  return tex;
}

function getGinghamTexture(primaryHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 256, 256);
    const step = 32;
    ctx.fillStyle = primaryHex;
    ctx.globalAlpha = 0.42;
    for (let x = 0; x < 256; x += step * 2) {
      ctx.fillRect(x, 0, step, 256);
    }
    for (let y = 0; y < 256; y += step * 2) {
      ctx.fillRect(0, y, 256, step);
    }
    ctx.globalAlpha = 0.85;
    for (let x = 0; x < 256; x += step * 2) {
      for (let y = 0; y < 256; y += step * 2) {
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function buildForestTree3D(variant: 'oak' | 'pine', scale: number, seed: number): THREE.Group {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
  const leafDark = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72 });
  const leafMid = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.68 });
  const leafBright = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 });

  // Sombra de contato na base da árvore
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 16),
    new THREE.MeshBasicMaterial({
      color: 0x052e16,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  tree.add(shadow);

  if (variant === 'pine') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 1.35, 10), trunkMat);
    trunk.position.y = 0.675;
    trunk.castShadow = true;
    tree.add(trunk);

    const tiers = [
      { y: 1.55, r: 1.18, h: 1.45, mat: leafDark },
      { y: 2.45, r: 0.92, h: 1.25, mat: leafMid },
      { y: 3.2, r: 0.62, h: 1.05, mat: leafBright },
    ];
    for (const tier of tiers) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(tier.r, tier.h, 10), tier.mat);
      cone.position.y = tier.y;
      cone.castShadow = true;
      tree.add(cone);
    }
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.29, 1.75, 10), trunkMat);
    trunk.position.y = 0.875;
    trunk.castShadow = true;
    tree.add(trunk);

    const puffs = [
      { x: 0, y: 2.35, z: 0, r: 1.05, mat: leafMid },
      { x: 0.62, y: 2.05, z: 0.35, r: 0.72, mat: leafDark },
      { x: -0.58, y: 2.12, z: -0.32, r: 0.76, mat: leafBright },
      { x: 0.15, y: 2.88, z: -0.22, r: 0.68, mat: leafBright },
    ];
    puffs.forEach((pf, idx) => {
      const crown = new THREE.Mesh(
        new THREE.DodecahedronGeometry(pf.r, 1),
        pf.mat,
      );
      crown.position.set(pf.x, pf.y, pf.z);
      crown.rotation.y = seed + idx;
      crown.castShadow = true;
      tree.add(crown);
    });
  }

  tree.scale.setScalar(scale);
  return tree;
}

function buildRabbit3D(
  furHex: string,
  earInnerHex: string,
  scale = 1,
): { group: THREE.Group; earL: THREE.Mesh; earR: THREE.Mesh } {
  const rabbit = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(furHex), roughness: 0.8 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const earInnerMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(earInnerHex), roughness: 0.7 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

  // Sombra suave no gramado
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 12),
    new THREE.MeshBasicMaterial({ color: 0x064e3b, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  rabbit.add(shadow);

  // Corpo arredondado
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), furMat);
  body.scale.set(0.88, 0.9, 1.24);
  body.position.set(0, 0.17, -0.02);
  body.castShadow = true;
  rabbit.add(body);

  // Rabinho fofo
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), tailMat);
  tail.position.set(0, 0.16, -0.22);
  rabbit.add(tail);

  // Cabeça + focinho + olhos
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), furMat);
  head.position.set(0, 0.3, 0.15);
  head.castShadow = true;
  rabbit.add(head);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), earInnerMat);
  nose.position.set(0, 0.29, 0.27);
  rabbit.add(nose);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 6), eyeMat);
    eye.position.set(side * 0.065, 0.33, 0.245);
    rabbit.add(eye);

    const hindFoot = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.04, 0.14), furMat);
    hindFoot.position.set(side * 0.095, 0.02, -0.04);
    rabbit.add(hindFoot);

    const frontPaw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.08), furMat);
    frontPaw.position.set(side * 0.065, 0.02, 0.13);
    rabbit.add(frontPaw);
  }

  // Orelhas compridas articuladas
  const buildEar = (side: -1 | 1): THREE.Mesh => {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.036, 0.19, 8), furMat);
    ear.scale.set(0.75, 1, 0.45);
    ear.position.set(side * 0.055, 0.46, 0.13);
    ear.rotation.z = -side * 0.14;
    ear.rotation.x = -0.1;
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.13, 0.015), earInnerMat);
    inner.position.set(0, 0, 0.016);
    ear.add(inner);
    rabbit.add(ear);
    return ear;
  };

  const earL = buildEar(-1);
  const earR = buildEar(1);

  rabbit.scale.setScalar(scale);
  return { group: rabbit, earL, earR };
}

function buildPicnicBlanket3D(opts: {
  primaryColor: string;
  rotY: number;
}): THREE.Group {
  const picnic = new THREE.Group();
  picnic.rotation.y = opts.rotY;

  const clothTex = getGinghamTexture(opts.primaryColor);
  const cloth = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.022, 1.32),
    new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.85 }),
  );
  cloth.position.y = 0.014;
  cloth.receiveShadow = true;
  picnic.add(cloth);

  // Cesta de piquenique em vime trançado
  const wickerMat = new THREE.MeshStandardMaterial({ color: 0xa1622b, roughness: 0.82 });
  const wickerTrimMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
  const basket = new THREE.Group();
  basket.position.set(-0.46, 0.025, -0.3);
  const bBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.34), wickerMat);
  bBody.position.y = 0.12;
  bBody.castShadow = true;
  const bLid = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.05, 0.37), wickerTrimMat);
  bLid.position.y = 0.255;
  bLid.rotation.x = -0.14;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 8, 16, Math.PI), wickerTrimMat);
  handle.position.set(0, 0.26, 0);
  basket.add(bBody, bLid, handle);
  picnic.add(basket);

  // Pratos de porcelana branca com comidas e frutas
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
  for (const [px, pz] of [
    [0.24, -0.22],
    [0.34, 0.26],
    [-0.28, 0.28],
  ]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.02, 18), plateMat);
    plate.position.set(px, 0.035, pz);
    picnic.add(plate);
  }

  // Maçãs vermelhas brilhantes
  const appleMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
  for (const [ax, az] of [
    [0.21, -0.24],
    [0.29, -0.19],
    [-0.12, -0.05],
  ]) {
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), appleMat);
    apple.position.set(ax, 0.08, az);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 6), stemMat);
    stem.position.set(ax, 0.14, az);
    picnic.add(apple, stem);
  }

  // Cacho de uvas roxas
  const grapeMat = new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.35 });
  for (let g = 0; g < 6; g++) {
    const grape = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), grapeMat);
    grape.position.set(0.32 + (g % 3) * 0.032, 0.065 + Math.floor(g / 3) * 0.025, 0.24 + (g % 2) * 0.03);
    picnic.add(grape);
  }

  // Fatias de melancia (verde + polpa vermelha)
  const rindMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 });
  const melonMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.45 });
  for (const [wx, wz, rot] of [
    [0.02, 0.14, 0.4],
    [0.14, 0.24, -0.3],
  ]) {
    const slice = new THREE.Group();
    slice.position.set(wx, 0.045, wz);
    slice.rotation.y = rot;
    const pulp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10, 1, false, 0, Math.PI), melonMat);
    pulp.rotation.z = Math.PI / 2;
    const rind = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.034, 10, 1, false, 0, Math.PI), rindMat);
    rind.rotation.z = Math.PI / 2;
    rind.position.y = -0.005;
    slice.add(rind, pulp);
    picnic.add(slice);
  }

  // Laranjas + baguete de pão / sanduíche + cupcakes
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 });
  for (const [ox, oz] of [
    [-0.31, 0.26],
    [-0.24, 0.31],
  ]) {
    const orange = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), orangeMat);
    orange.position.set(ox, 0.075, oz);
    picnic.add(orange);
  }

  // Baguete / pão dourado + queijo
  const bread = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.042, 0.18, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 }),
  );
  bread.rotation.z = Math.PI / 2;
  bread.rotation.y = 0.5;
  bread.position.set(0.04, 0.065, -0.18);
  picnic.add(bread);

  // Cupcakes coloridos com cobertura
  const cakeBaseMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
  const frostingMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 });
  for (const [cx, cz] of [
    [-0.08, 0.34],
    [0.52, -0.02],
  ]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.05, 10), cakeBaseMat);
    cup.position.set(cx, 0.05, cz);
    const frost = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), frostingMat);
    frost.position.set(cx, 0.082, cz);
    picnic.add(cup, frost);
  }

  // Jarra de suco e copinhos
  const pitcherMat = new THREE.MeshPhysicalMaterial({
    color: 0xfb923c,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const pitcher = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.22, 12), pitcherMat);
  pitcher.position.set(0.46, 0.135, -0.26);
  picnic.add(pitcher);

  for (const [gx, gz] of [
    [0.55, -0.15],
    [0.58, -0.34],
  ]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.08, 10), pitcherMat);
    cup.position.set(gx, 0.065, gz);
    picnic.add(cup);
  }

  return picnic;
}

/**
 * Constrói o cenário 3D da Floresta do Laguinho & Piquenique:
 * - Gramado verde cercado por várias árvores
 * - Laguinho cristalino com peixes saltando
 * - Coelhos pulando pelo gramado
 * - Toalhas de piquenique decoradas com cestas, frutas e comidas
 * - Espaço para 1 Cabine de DJ funcional
 */
function buildForestPicnicStage(opts: {
  group: THREE.Group;
  jumpingFishList: AnimatedJumpingFish[];
  hoppingRabbitsList: AnimatedHoppingRabbit[];
}): THREE.Mesh {
  const { group, jumpingFishList, hoppingRabbitsList } = opts;
  const grassTex = getForestGrassTexture();

  // 1. Terreno contínuo de floresta ao redor + clareira caminhável (WalkableFloor)
  const outerMeadow = new THREE.Mesh(
    new THREE.CircleGeometry(64, 48),
    new THREE.MeshStandardMaterial({
      map: grassTex,
      color: 0x22c55e,
      roughness: 0.9,
      metalness: 0.02,
    }),
  );
  outerMeadow.rotation.x = -Math.PI / 2;
  outerMeadow.position.y = -0.04;
  outerMeadow.receiveShadow = true;
  group.add(outerMeadow);

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(16.5, 11.5),
    new THREE.MeshStandardMaterial({
      map: grassTex,
      color: 0x86efac,
      roughness: 0.85,
      metalness: 0.02,
    }),
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  floorMesh.name = 'WalkableFloor';
  group.add(floorMesh);

  // 2. Laguinho com pedras ao redor, nenúfares e peixes saltando
  const pondX = -4.25;
  const pondZ = 0.85;
  const pondGroup = new THREE.Group();
  pondGroup.position.set(pondX, 0, pondZ);

  const bankRing = new THREE.Mesh(
    new THREE.CircleGeometry(2.15, 36),
    new THREE.MeshStandardMaterial({ color: 0xd6b88d, roughness: 0.9 }),
  );
  bankRing.rotation.x = -Math.PI / 2;
  bankRing.scale.set(1.08, 0.82, 1);
  bankRing.position.y = 0.015;
  pondGroup.add(bankRing);

  const pondWater = new THREE.Mesh(
    new THREE.CircleGeometry(1.88, 36),
    new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.16,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
    }),
  );
  pondWater.rotation.x = -Math.PI / 2;
  pondWater.scale.set(1.08, 0.82, 1);
  pondWater.position.y = 0.032;
  pondGroup.add(pondWater);

  // Pedras naturais na borda do laguinho
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.85 });
  for (let r = 0; r < 16; r++) {
    const a = (r / 16) * Math.PI * 2;
    const stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.18 + (r % 3) * 0.06, 0),
      stoneMat,
    );
    stone.scale.set(1.25, 0.65, 1.05);
    stone.position.set(Math.cos(a) * 2.15, 0.06, Math.sin(a) * 1.62);
    stone.rotation.y = a * 2;
    stone.castShadow = true;
    pondGroup.add(stone);
  }

  // Vitórias-régias e taboas no laguinho
  const padMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
  for (const [lx, lz, lr] of [
    [-0.95, -0.45, 0.24],
    [0.88, 0.42, 0.2],
    [-0.35, 0.72, 0.18],
  ]) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(lr, 16, 0.2, Math.PI * 1.8), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(lx, 0.04, lz);
    pondGroup.add(pad);
  }

  // Taboas decorativas na margem
  const reedStemMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 });
  const reedTipMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  for (const [rx, rz] of [
    [-1.85, -0.75],
    [-1.65, -0.95],
    [1.75, -0.65],
  ]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.78, 6), reedStemMat);
    stem.position.set(rx, 0.39, rz);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.18, 8), reedTipMat);
    tip.position.set(rx, 0.68, rz);
    pondGroup.add(stem, tip);
  }

  group.add(pondGroup);

  // Peixes saltando dentro do laguinho
  const pondFishConfigs = [
    { ox: -0.4, oz: -0.1, angle: 0.4, body: '#FF6B2B', stripe: '#FFFFFF', scale: 1.55, speed: 0.85, phase: 0.0 },
    { ox: 0.45, oz: 0.15, angle: 2.2, body: '#FACC15', stripe: '#0F172A', scale: 1.45, speed: 0.78, phase: 1.1 },
    { ox: 0.0, oz: -0.42, angle: 3.9, body: '#FB7185', stripe: '#FFFFFF', scale: 1.4, speed: 0.9, phase: 2.2 },
    { ox: -0.55, oz: 0.35, angle: 5.1, body: '#38BDF8', stripe: '#FEF08A', scale: 1.5, speed: 0.82, phase: 3.1 },
  ];
  for (const cfg of pondFishConfigs) {
    const fx = pondX + cfg.ox;
    const fz = pondZ + cfg.oz;
    const builtFish = buildTropicalFish3D(cfg.body, cfg.stripe, cfg.scale);
    builtFish.group.position.set(fx, -0.3, fz);
    group.add(builtFish.group);

    const splashRing = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.22, 18),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    splashRing.rotation.x = -Math.PI / 2;
    splashRing.position.set(fx, 0.045, fz);
    group.add(splashRing);

    jumpingFishList.push({
      group: builtFish.group,
      tail: builtFish.tail,
      splashRing,
      centerX: fx,
      centerZ: fz,
      waterY: 0.035,
      dirAngle: cfg.angle,
      arcDistance: 1.05,
      jumpHeight: 0.88,
      speed: cfg.speed,
      phase: cfg.phase,
    });
  }

  // 3. Coelhos pulando pelo gramado
  const rabbitConfigs = [
    { x: 1.85, z: 1.8, rx: 0.9, rz: 0.65, fur: '#FFFBEB', ear: '#F9A8D4', scale: 1.05, speed: 1.35, phase: 0.0 },
    { x: -1.45, z: 2.3, rx: 0.75, rz: 0.55, fur: '#E7E5E4', ear: '#FDA4AF', scale: 0.95, speed: 1.5, phase: 1.4 },
    { x: 4.5, z: -0.45, rx: 0.65, rz: 0.85, fur: '#D6A87C', ear: '#FBCFE8', scale: 1.0, speed: 1.25, phase: 2.6 },
    { x: -2.2, z: -1.55, rx: 0.8, rz: 0.5, fur: '#FFFFFF', ear: '#F472B6', scale: 0.92, speed: 1.42, phase: 3.7 },
    { x: 0.3, z: 3.1, rx: 0.95, rz: 0.45, fur: '#FDE68A', ear: '#FB7185', scale: 0.98, speed: 1.3, phase: 4.8 },
  ];
  for (const rc of rabbitConfigs) {
    const rb = buildRabbit3D(rc.fur, rc.ear, rc.scale);
    rb.group.position.set(rc.x, 0, rc.z);
    group.add(rb.group);
    hoppingRabbitsList.push({
      group: rb.group,
      earL: rb.earL,
      earR: rb.earR,
      centerX: rc.x,
      centerZ: rc.z,
      radiusX: rc.rx,
      radiusZ: rc.rz,
      hopHeight: 0.28,
      speed: rc.speed,
      phase: rc.phase,
    });
  }

  // 4. Toalhas de piquenique decoradas com frutas e comidas
  const blankets = [
    { x: 3.55, z: 1.35, color: '#EF4444', rot: -0.22 },
    { x: 0.65, z: 1.95, color: '#F59E0B', rot: 0.16 },
    { x: -1.55, z: -0.85, color: '#0EA5E9', rot: 0.35 },
  ];
  for (const bl of blankets) {
    const pGroup = buildPicnicBlanket3D({ primaryColor: bl.color, rotY: bl.rot });
    pGroup.position.set(bl.x, 0, bl.z);
    group.add(pGroup);
  }

  // 5. Várias árvores ao redor da clareira e floresta ao fundo
  const treeCoords: Array<{ x: number; z: number; v: 'oak' | 'pine'; s: number }> = [
    { x: -7.2, z: -4.2, v: 'pine', s: 1.25 },
    { x: -5.4, z: -4.8, v: 'oak', s: 1.15 },
    { x: -3.4, z: -5.2, v: 'pine', s: 1.3 },
    { x: 3.4, z: -5.2, v: 'oak', s: 1.22 },
    { x: 5.5, z: -4.7, v: 'pine', s: 1.28 },
    { x: 7.3, z: -4.0, v: 'oak', s: 1.18 },
    { x: -7.8, z: -1.2, v: 'oak', s: 1.25 },
    { x: -7.6, z: 2.1, v: 'pine', s: 1.2 },
    { x: -6.8, z: 4.6, v: 'oak', s: 1.12 },
    { x: 7.6, z: -1.3, v: 'pine', s: 1.26 },
    { x: 7.5, z: 2.2, v: 'oak', s: 1.2 },
    { x: 6.7, z: 4.5, v: 'pine', s: 1.14 },
    { x: -4.6, z: 5.3, v: 'pine', s: 1.1 },
    { x: 4.8, z: 5.2, v: 'oak', s: 1.15 },
  ];
  treeCoords.forEach((tc, idx) => {
    const tree = buildForestTree3D(tc.v, tc.s, idx + 1);
    tree.position.set(tc.x, 0, tc.z);
    group.add(tree);
  });

  // Anel externo de árvores da floresta para profundidade natural
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.15;
    const dist = 12.2 + (i % 3) * 2.4;
    const tree = buildForestTree3D(i % 2 === 0 ? 'pine' : 'oak', 1.3 + (i % 3) * 0.2, i + 20);
    tree.position.set(Math.cos(a) * dist * 1.15, -0.04, Math.sin(a) * dist * 0.85);
    group.add(tree);
  }

  // Flores silvestres coloridas espalhadas pelo gramado
  const flowerColors = [0xf43f5e, 0xfacc15, 0xa855f7, 0xfb923c, 0xf8fafc];
  for (let f = 0; f < 22; f++) {
    const fx = Math.sin(f * 3.7) * 6.4;
    const fz = Math.cos(f * 5.1) * 4.2;
    if (Math.hypot(fx - pondX, fz - pondZ) < 2.35) continue;
    const fl = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.065, 0),
      new THREE.MeshStandardMaterial({ color: flowerColors[f % flowerColors.length], roughness: 0.5 }),
    );
    fl.position.set(fx, 0.04, fz);
    group.add(fl);
  }

  // 6. Sol e nuvens no céu da floresta
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfef08a }),
  );
  sun.position.set(20, 22, -36);
  group.add(sun);

  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
  });
  for (let c = 0; c < 5; c++) {
    const cloudGrp = new THREE.Group();
    cloudGrp.position.set(-22 + c * 11, 14 + (c % 2) * 2.4, -34 - (c % 3) * 3);
    for (let p = 0; p < 4; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.0 + (p % 2) * 0.4, 8, 8), cloudMat);
      puff.position.set((p - 1.5) * 1.15, (p % 2) * 0.3, 0);
      cloudGrp.add(puff);
    }
    group.add(cloudGrp);
  }

  return floorMesh;
}

/**
 * Constrói a Boate Neon Pista LED:
 * - Pista de dança multicolorida em grade de LEDs que mudam de cor
 * - Estrutura superior com luzes móveis giratórias que mudam de cor
 * - Barras e painéis LED neon pelas paredes e colunas
 */
function buildNeonNightclubStage(opts: {
  group: THREE.Group;
  pal: RoomThemePalette;
  danceTiles: AnimatedDanceTile[];
  movingLights: AnimatedMovingClubLight[];
  neonPulseMaterials: THREE.MeshStandardMaterial[];
}): THREE.Mesh {
  const { group, pal, danceTiles, movingLights, neonPulseMaterials } = opts;

  const floorTex = getMarbleFloorTexture(pal.floorColor, pal.floorVein);
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(15.5, 10.5),
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.22,
      metalness: 0.28,
    }),
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.name = 'WalkableFloor';
  group.add(floorMesh);

  // 1. Pista de dança de LED que muda de cor (6 colunas x 4 linhas)
  const tileCols = 6;
  const tileRows = 4;
  const tileSize = 0.74;
  const gap = 0.08;
  const dfWidth = tileCols * (tileSize + gap) + 0.24;
  const dfDepth = tileRows * (tileSize + gap) + 0.24;
  const dfCenterZ = 0.72;

  const dfFrame = new THREE.Mesh(
    new THREE.BoxGeometry(dfWidth, 0.02, dfDepth),
    new THREE.MeshStandardMaterial({ color: 0x090812, roughness: 0.25, metalness: 0.8 }),
  );
  dfFrame.position.set(0, 0.01, dfCenterZ);
  dfFrame.receiveShadow = true;
  group.add(dfFrame);

  const neonFrameMat = new THREE.MeshStandardMaterial({
    color: 0xec4899,
    emissive: 0xec4899,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  neonPulseMaterials.push(neonFrameMat);

  for (const sz of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(dfWidth + 0.06, 0.032, 0.05), neonFrameMat);
    bar.position.set(0, 0.02, dfCenterZ + sz * (dfDepth * 0.5));
    group.add(bar);
  }
  for (const sx of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.032, dfDepth + 0.06), neonFrameMat);
    bar.position.set(sx * (dfWidth * 0.5), 0.02, dfCenterZ);
    group.add(bar);
  }

  for (let r = 0; r < tileRows; r++) {
    for (let c = 0; c < tileCols; c++) {
      const tileMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0xa855f7,
        emissiveIntensity: 1.15,
        roughness: 0.16,
        metalness: 0.35,
      });
      const tile = new THREE.Mesh(new THREE.BoxGeometry(tileSize, 0.024, tileSize), tileMat);
      const tx = (c - (tileCols - 1) * 0.5) * (tileSize + gap);
      const tz = dfCenterZ + (r - (tileRows - 1) * 0.5) * (tileSize + gap);
      tile.position.set(tx, 0.022, tz);
      tile.receiveShadow = true;
      group.add(tile);
      danceTiles.push({ material: tileMat, row: r, col: c });
    }
  }

  // 2. Paredes escuras de boate + LEDs Neon por toda a sala
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0b0816,
    roughness: 0.55,
    metalness: 0.22,
  });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(15.5, 4.9, 0.2), wallMat);
  backWall.position.set(0, 2.45, -4.6);
  backWall.receiveShadow = true;
  group.add(backWall);

  for (const side of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.9, 10.5), wallMat);
    sideWall.position.set(side * 7.65, 2.45, 0.5);
    sideWall.receiveShadow = true;
    group.add(sideWall);
  }

  const ledCyanMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.6,
  });
  const ledMagentaMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xec4899,
    emissiveIntensity: 1.6,
  });
  const ledVioletMat = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: 0xa855f7,
    emissiveIntensity: 1.5,
  });
  neonPulseMaterials.push(ledCyanMat, ledMagentaMat, ledVioletMat);

  // Rodapé e sanca superior LED neon na parede traseira e laterais
  const backTopLed = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.08, 0.08), ledCyanMat);
  backTopLed.position.set(0, 4.65, -4.46);
  const backLowLed = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.08, 0.08), ledMagentaMat);
  backLowLed.position.set(0, 0.22, -4.46);
  group.add(backTopLed, backLowLed);

  // Barras verticais de LED neon nas paredes
  for (const bx of [-6.4, -4.5, 4.5, 6.4]) {
    const vBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 4.2, 10),
      Math.abs(bx) > 5 ? ledCyanMat : ledMagentaMat,
    );
    vBar.position.set(bx, 2.35, -4.44);
    group.add(vBar);
  }
  for (const side of [-1, 1]) {
    for (const sz of [-2.8, -0.5, 1.8, 4.0]) {
      const sideLed = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 4.1, 10),
        sz % 2 === 0 ? ledVioletMat : ledCyanMat,
      );
      sideLed.position.set(side * 7.46, 2.35, sz);
      group.add(sideLed);
    }
    const sideHorizLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 10.1), ledMagentaMat);
    sideHorizLed.position.set(side * 7.46, 4.6, 0.5);
    group.add(sideHorizLed);
  }

  // Letreiro / aro LED neon geométrico na parede de fundo acima do DJ
  const neonHalo = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.05, 10, 42), ledCyanMat);
  neonHalo.position.set(0, 3.05, -4.42);
  const neonInnerDiamond = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.04, 8, 4), ledMagentaMat);
  neonInnerDiamond.position.set(0, 3.05, -4.38);
  group.add(neonHalo, neonInnerDiamond);

  // 3. Estrutura superior (Truss) e 4 luzes móveis que ficam se movendo mudando de cor
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
  const trussBeam = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.16, 0.22), trussMat);
  trussBeam.position.set(0, 4.35, -0.8);
  const trussCrossL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 6.2), trussMat);
  trussCrossL.position.set(-5.2, 4.35, -1.5);
  const trussCrossR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 6.2), trussMat);
  trussCrossR.position.set(5.2, 4.35, -1.5);
  group.add(trussBeam, trussCrossL, trussCrossR);

  const lightSpots = [
    { x: -4.2, z: -0.8, hue: 0.0, speed: 1.35, phase: 0.0 },
    { x: -1.45, z: -0.8, hue: 0.28, speed: 1.65, phase: 1.4 },
    { x: 1.45, z: -0.8, hue: 0.55, speed: 1.5, phase: 2.8 },
    { x: 4.2, z: -0.8, hue: 0.82, speed: 1.25, phase: 4.1 },
  ];

  for (const ls of lightSpots) {
    const pivot = new THREE.Group();
    pivot.position.set(ls.x, 4.24, ls.z);

    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.34, 12), trussMat);
    housing.position.y = -0.15;
    pivot.add(housing);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xec4899,
      emissiveIntensity: 2.0,
    });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), bulbMat);
    lens.position.y = -0.32;
    pivot.add(lens);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xec4899,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beamCone = new THREE.Mesh(new THREE.ConeGeometry(1.15, 4.5, 20, 1, true), beamMat);
    beamCone.position.y = -2.55;
    pivot.add(beamCone);

    group.add(pivot);

    const pointLight = new THREE.PointLight(0xec4899, 3.8, 9.5, 1.5);
    pointLight.position.set(ls.x, 1.4, 0.72);
    group.add(pointLight);

    movingLights.push({
      pivot,
      beamMat,
      bulbMat,
      pointLight,
      baseX: ls.x,
      baseZ: ls.z,
      speed: ls.speed,
      phase: ls.phase,
      hueOffset: ls.hue,
    });
  }

  return floorMesh;
}

function buildSingleDjBooth3D(opts: {
  trimMat: THREE.Material;
  accentColor: string;
  isOfficialRooftop: boolean;
  isTropicalWood?: boolean;
  boothIndex?: number;
  titleText?: string;
  subtitleText?: string;
}): {
  boothGroup: THREE.Group;
  screenMesh: THREE.Mesh;
  discs: THREE.Mesh[];
  eqBars: THREE.Mesh[];
  speakerCones: THREE.Mesh[];
} {
  const { trimMat, accentColor, isOfficialRooftop, isTropicalWood } = opts;
  const boothGroup = new THREE.Group();
  if (opts.boothIndex !== undefined) {
    boothGroup.userData.djBoothIndex = opts.boothIndex;
  }

  const discs: THREE.Mesh[] = [];
  const eqBars: THREE.Mesh[] = [];
  const speakerCones: THREE.Mesh[] = [];

  if (isOfficialRooftop || isTropicalWood) {
    const stageRiser = new THREE.Mesh(
      new THREE.BoxGeometry(isTropicalWood ? 3.5 : 4.35, 0.16, 1.45),
      new THREE.MeshStandardMaterial({
        color: isTropicalWood ? 0x7c4a21 : 0x18181b,
        roughness: isTropicalWood ? 0.7 : 0.35,
        metalness: isTropicalWood ? 0.08 : 0.4,
      }),
    );
    stageRiser.position.set(0, 0.08, -0.1);
    stageRiser.receiveShadow = true;
    boothGroup.add(stageRiser);
  }

  const boothBody = new THREE.Mesh(
    new THREE.BoxGeometry(isTropicalWood ? 2.05 : 2.35, 1.05, 0.85),
    new THREE.MeshStandardMaterial({
      color: isTropicalWood ? 0x92400e : 0x1e1b2e,
      roughness: isTropicalWood ? 0.65 : 0.35,
      metalness: isTropicalWood ? 0.08 : 0.3,
    }),
  );
  boothBody.position.y = 0.525;
  boothBody.castShadow = true;
  boothGroup.add(boothBody);

  const neonBar = new THREE.Mesh(
    new THREE.BoxGeometry(isTropicalWood ? 2.12 : 2.42, 0.08, 0.88),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentColor),
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 0.9,
    }),
  );
  neonBar.position.y = 1.05;
  boothGroup.add(neonBar);

  const vinylMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.25, metalness: 0.5 });
  for (const dx of [-0.52, 0.52]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 24), vinylMat);
    disc.position.set(dx, 1.11, 0);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16), trimMat);
    disc.add(label);
    boothGroup.add(disc);
    discs.push(disc);
  }

  // Torres de Caixas de Som esquerda & direita
  const speakerMat = new THREE.MeshStandardMaterial({
    color: isTropicalWood ? 0x292524 : 0x11131c,
    roughness: 0.45,
    metalness: 0.25,
  });
  const coneRingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentColor),
    emissive: new THREE.Color(accentColor),
    emissiveIntensity: 0.75,
  });
  const speakerOffsetX = isTropicalWood ? 1.46 : 1.72;
  for (const sx of [-speakerOffsetX, speakerOffsetX]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.95, 0.58), speakerMat);
    tower.position.set(sx, 0.975, -0.18);
    tower.castShadow = true;
    boothGroup.add(tower);

    for (const cy of [0.5, 1.2, 1.66]) {
      const radius = cy < 1 ? 0.2 : 0.15;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.02, 10, 24), coneRingMat);
      rim.position.set(sx, cy, 0.12);
      boothGroup.add(rim);

      const cone = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.85, radius * 0.45, 0.06, 20),
        new THREE.MeshStandardMaterial({ color: 0x1f2433, roughness: 0.35, metalness: 0.4 }),
      );
      cone.rotation.x = Math.PI / 2;
      cone.position.set(sx, cy, 0.1);
      boothGroup.add(cone);
      speakerCones.push(cone);
    }
  }

  for (let b = 0; b < 9; b++) {
    const barMat = new THREE.MeshStandardMaterial({
      color: b % 2 === 0 ? 0xf59e0b : 0xec4899,
      emissive: b % 2 === 0 ? 0xf59e0b : 0xec4899,
      emissiveIntensity: 0.85,
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.06), barMat);
    bar.position.set((b - 4) * 0.22, 1.22, -0.32);
    boothGroup.add(bar);
    eqBars.push(bar);
  }

  const housingW = isTropicalWood ? 2.65 : 3.16;
  const housingH = isTropicalWood ? 1.56 : 1.84;
  const screenHousing = new THREE.Mesh(
    new THREE.BoxGeometry(housingW, housingH, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 0.3, metalness: 0.6 }),
  );
  screenHousing.position.set(0, 2.26, -0.36);
  boothGroup.add(screenHousing);

  const screenBezel = new THREE.Mesh(
    new THREE.BoxGeometry(housingW + 0.06, housingH + 0.06, 0.06),
    trimMat,
  );
  screenBezel.position.set(0, 2.26, -0.39);
  boothGroup.add(screenBezel);

  for (const px of [-1.0, 1.0]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.05, 12), trimMat);
    post.position.set(px, 1.4, -0.36);
    boothGroup.add(post);
  }

  const idleTex = createIdleDjScreenTexture(
    accentColor,
    opts.titleText || 'CABINE DE DJ STARLIGHT',
    opts.subtitleText || 'Clique na cabine para escolher música e vídeo do YouTube',
  );
  const screenW = isTropicalWood ? 2.48 : 2.96;
  const screenH = isTropicalWood ? 1.395 : 1.665;
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({ map: idleTex }),
  );
  screenMesh.name = 'DJBoothScreenPlane';
  screenMesh.position.set(0, 2.26, -0.295);
  boothGroup.add(screenMesh);

  return { boothGroup, screenMesh, discs, eqBars, speakerCones };
}

/**
 * Constrói o palco arquitetônico 3D completo de uma sala (incluindo Lounge Party oficial e Ilha Tropical)
 * com piso caminhável para raycast, cabine(s) de DJ animada(s) e mobília interativa.
 */
export function buildRoomStage3D(opts: {
  theme: RoomBackdropTheme;
  wallpaper?: PurchasableWallpaperItem;
  interactiveProps?: RoomInteractiveProp[];
  includeDjBooth?: boolean;
}): BuiltRoomStage3D {
  const pal = getRoomThemePalette(opts.theme, opts.wallpaper);
  const group = new THREE.Group();
  group.name = 'RoomStage3D';

  const aquariumFish: AnimatedAquariumFish[] = [];
  const aquariumBubbles: AnimatedAquariumBubble[] = [];
  const jumpingFish: AnimatedJumpingFish[] = [];
  const hoppingRabbits: AnimatedHoppingRabbit[] = [];
  const danceTiles: AnimatedDanceTile[] = [];
  const movingLights: AnimatedMovingClubLight[] = [];
  const neonPulseMaterials: THREE.MeshStandardMaterial[] = [];

  const isOfficialRooftop =
    opts.theme === 'lounge_party' ||
    opts.theme === 'lounge_party_natal' ||
    opts.theme === 'lounge_party_halloween';
  const isTropicalIsland = opts.theme === 'ilha_tropical';
  const isSinglePalmIsland = opts.theme === 'ilha_coqueiro';
  const isForestPicnic = opts.theme === 'floresta_piquenique';
  const isNeonClub = opts.theme === 'boate_neon';
  const isFlatCustomFloor = opts.theme === 'chao_plano_custom';
  let floorMesh: THREE.Mesh;

  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(pal.accentColor),
    roughness: 0.25,
    metalness: 0.8,
  });

  if (isFlatCustomFloor) {
    // Chão plano aberto sem paredes para exibir livremente o plano de fundo enviado do PC
    const floorTex = opts.wallpaper
      ? getMarbleFloorTexture(pal.floorColor, pal.floorVein)
      : getWoodTexture('#F3EFEA', '#DFD6CC');
    const floorGeo = new THREE.PlaneGeometry(15.5, 10.5);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.42,
      metalness: 0.06,
    });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    floorMesh.name = 'WalkableFloor';
    group.add(floorMesh);

    // Moldura discreta ao redor do chão plano + grade leve para referência espacial
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0xd6cfc7,
      roughness: 0.5,
      metalness: 0.2,
    });
    const edgeN = new THREE.Mesh(new THREE.BoxGeometry(15.66, 0.06, 0.08), borderMat);
    edgeN.position.set(0, 0.03, -5.29);
    const edgeS = new THREE.Mesh(new THREE.BoxGeometry(15.66, 0.06, 0.08), borderMat);
    edgeS.position.set(0, 0.03, 5.29);
    const edgeW = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 10.66), borderMat);
    edgeW.position.set(-7.79, 0.03, 0);
    const edgeE = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 10.66), borderMat);
    edgeE.position.set(7.79, 0.03, 0);
    group.add(edgeN, edgeS, edgeW, edgeE);
  } else if (isTropicalIsland) {
    floorMesh = buildTropicalIslandStage({
      group,
      pal,
      jumpingFishList: jumpingFish,
    });
  } else if (isSinglePalmIsland) {
    floorMesh = buildSinglePalmIslandStage({
      group,
      jumpingFishList: jumpingFish,
    });
  } else if (isForestPicnic) {
    floorMesh = buildForestPicnicStage({
      group,
      jumpingFishList: jumpingFish,
      hoppingRabbitsList: hoppingRabbits,
    });
  } else if (isNeonClub) {
    floorMesh = buildNeonNightclubStage({
      group,
      pal,
      danceTiles,
      movingLights,
      neonPulseMaterials,
    });
  } else if (isOfficialRooftop) {
    floorMesh = buildOfficialRooftopTerrace({
      group,
      pal,
      theme: opts.theme,
      fishList: aquariumFish,
      bubblesList: aquariumBubbles,
    });
  } else {
    // Piso amplo com textura de mármore ou madeira para as demais salas
    const floorTex = pal.isNightClub
      ? getMarbleFloorTexture(pal.floorColor, pal.floorVein)
      : getWoodTexture(pal.floorColor, pal.floorVein);

    const floorGeo = new THREE.PlaneGeometry(15.5, 10.5);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: pal.isNightClub ? 0.28 : 0.48,
      metalness: pal.isNightClub ? 0.18 : 0.04,
    });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    floorMesh.name = 'WalkableFloor';
    group.add(floorMesh);

    // Pista iluminada central em Boates
    if (pal.isNightClub) {
      const danceRing = new THREE.Mesh(
        new THREE.RingGeometry(1.75, 1.92, 48),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(pal.accentColor),
          emissive: new THREE.Color(pal.accentColor),
          emissiveIntensity: 0.7,
          side: THREE.DoubleSide,
        }),
      );
      danceRing.rotation.x = -Math.PI / 2;
      danceRing.position.set(0, 0.008, 0.6);
      group.add(danceRing);

      const danceCore = new THREE.Mesh(
        new THREE.CircleGeometry(1.74, 48),
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color('#1B132B'),
          roughness: 0.14,
          metalness: 0.35,
          clearcoat: 0.9,
        }),
      );
      danceCore.rotation.x = -Math.PI / 2;
      danceCore.position.set(0, 0.006, 0.6);
      danceCore.receiveShadow = true;
      group.add(danceCore);
    }

    // Paredes traseira e laterais com rodapé e boiserie
    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(pal.wallColor),
      roughness: 0.78,
    });
    const wainscotMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(pal.wainscotColor),
      roughness: 0.62,
    });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(15.5, 4.8, 0.2), wallMat);
    backWall.position.set(0, 2.4, -4.6);
    backWall.receiveShadow = true;
    group.add(backWall);

    const wainscot = new THREE.Mesh(new THREE.BoxGeometry(15.5, 1.1, 0.24), wainscotMat);
    wainscot.position.set(0, 0.55, -4.58);
    group.add(wainscot);

    const crown = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.09, 0.28), trimMat);
    crown.position.set(0, 1.12, -4.56);
    group.add(crown);

    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.8, 10.5), wallMat);
      sideWall.position.set(side * 7.65, 2.4, 0.5);
      sideWall.receiveShadow = true;
      group.add(sideWall);

      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 4.6, 16), trimMat);
      col.position.set(side * 5.8, 2.3, -4.35);
      group.add(col);
    }

    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.5, 0.14), trimMat);
    windowFrame.position.set(0, 2.65, -4.48);
    const windowGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(4.15, 2.25),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.ambientSky) }),
    );
    windowGlass.position.set(0, 2.65, -4.4);
    group.add(windowFrame, windowGlass);

    // Lustre estelar suspenso
    const chandelier = new THREE.Group();
    chandelier.position.set(0, 4.2, -0.8);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 10, 28), trimMat);
    ring.rotation.x = Math.PI / 2;
    chandelier.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 10, 10),
        new THREE.MeshStandardMaterial({
          color: 0xfffbeb,
          emissive: new THREE.Color(pal.accentColor),
          emissiveIntensity: 0.9,
        }),
      );
      bulb.position.set(Math.cos(a) * 0.85, -0.05, Math.sin(a) * 0.85);
      chandelier.add(bulb);
    }
    group.add(chandelier);
  }

  // Cabine(s) de DJ 3D interativa(s) com Caixas de Som e Tela 16:9 de Vídeo
  let djBoothGroup: THREE.Group | null = null;
  let djScreenMesh: THREE.Mesh | null = null;
  const djDiscs: THREE.Mesh[] = [];
  const eqBars: THREE.Mesh[] = [];
  const speakerCones: THREE.Mesh[] = [];
  if (opts.includeDjBooth) {
    djBoothGroup = new THREE.Group();
    djBoothGroup.name = 'DJBooth3D';

    if (isTropicalIsland) {
      // 3 Cabines de DJ funcionais na Ilha (Centro, Praia Oeste e Praia Leste)
      const islandBoothConfigs = [
        {
          x: 0,
          z: -3.15,
          rotY: 0,
          scale: 0.96,
          idx: 1,
          title: 'CABINE DE DJ 1 · ILHA CENTRAL',
          subtitle: 'Clique em qualquer cabine para tocar música e vídeo',
          accent: '#F59E0B',
        },
        {
          x: -4.2,
          z: -1.35,
          rotY: 0.56,
          scale: 0.82,
          idx: 2,
          title: 'CABINE DE DJ 2 · PRAIA OESTE',
          subtitle: 'Cabine funcional da Ilha — Clique para escolher música',
          accent: '#0EA5E9',
        },
        {
          x: 4.2,
          z: -1.35,
          rotY: -0.56,
          scale: 0.82,
          idx: 3,
          title: 'CABINE DE DJ 3 · PRAIA LESTE',
          subtitle: 'Cabine funcional da Ilha — Clique para escolher música',
          accent: '#10B981',
        },
      ];

      islandBoothConfigs.forEach((cfg, i) => {
        const built = buildSingleDjBooth3D({
          trimMat,
          accentColor: cfg.accent,
          isOfficialRooftop: false,
          isTropicalWood: true,
          boothIndex: cfg.idx,
          titleText: cfg.title,
          subtitleText: cfg.subtitle,
        });
        built.boothGroup.position.set(cfg.x, 0, cfg.z);
        built.boothGroup.rotation.y = cfg.rotY;
        built.boothGroup.scale.setScalar(cfg.scale);
        djBoothGroup!.add(built.boothGroup);

        if (i === 0) {
          djScreenMesh = built.screenMesh;
        }
        djDiscs.push(...built.discs);
        eqBars.push(...built.eqBars);
        speakerCones.push(...built.speakerCones);
      });
    } else {
      const built = buildSingleDjBooth3D({
        trimMat,
        accentColor: pal.accentColor,
        isOfficialRooftop,
        isTropicalWood: isSinglePalmIsland || isForestPicnic,
        boothIndex: 1,
      });
      built.boothGroup.position.set(
        0,
        0,
        isOfficialRooftop ? -3.68 : isSinglePalmIsland ? -3.2 : -3.55,
      );
      djBoothGroup.add(built.boothGroup);
      djScreenMesh = built.screenMesh;
      djDiscs.push(...built.discs);
      eqBars.push(...built.eqBars);
      speakerCones.push(...built.speakerCones);
    }

    group.add(djBoothGroup);
  }

  // Mobília interativa (cadeiras, sofás, mesas) mapeada para 3D
  const propMeshes = new Map<string, THREE.Group>();
  for (const prop of opts.interactiveProps || []) {
    const pGroup = new THREE.Group();
    pGroup.name = `Prop_${prop.id}`;
    pGroup.userData.propId = prop.id;
    const { x, z } = roomPctToWorld(prop.x, prop.y);
    pGroup.position.set(x, 0, z);
    pGroup.rotation.y = (((prop.rotationY ?? 0) % 360) * Math.PI) / 180;

    const pMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(prop.primaryColor || '#7C1D3A'),
      roughness: 0.52,
      sheen: 0.7,
    });
    const aMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(prop.accentColor || '#D4AF37'),
      roughness: 0.25,
      metalness: 0.85,
    });

    if (prop.kind === 'sofa') {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 0.65), pMat);
      seat.position.y = 0.24;
      seat.castShadow = true;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 0.14), pMat);
      back.position.set(0, 0.5, -0.25);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.65), aMat);
      armL.position.set(-0.72, 0.3, 0);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.65), aMat);
      armR.position.set(0.72, 0.3, 0);
      pGroup.add(seat, back, armL, armR);
    } else if (prop.kind === 'table') {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.4, 0.05, 20), pMat);
      top.position.y = 0.72;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.015, 8, 22), aMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.72;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.72, 12), aMat);
      stem.position.y = 0.36;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.03, 16), aMat);
      base.position.y = 0.015;
      pGroup.add(top, rim, stem, base);
    } else if (prop.kind === 'decor') {
      if (prop.decorType === 'tree') {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.11, 0.4, 10),
          new THREE.MeshStandardMaterial({ color: 0x5c3a21 }),
        );
        trunk.position.y = 0.2;
        const c1 = new THREE.Mesh(
          new THREE.ConeGeometry(0.68, 0.8, 14),
          new THREE.MeshStandardMaterial({ color: 0x15803d }),
        );
        c1.position.y = 0.7;
        const c2 = new THREE.Mesh(
          new THREE.ConeGeometry(0.52, 0.65, 14),
          new THREE.MeshStandardMaterial({ color: 0x16a34a }),
        );
        c2.position.y = 1.25;
        const star = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.14),
          new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            emissive: 0xfacc15,
            emissiveIntensity: 1.0,
          }),
        );
        star.position.y = 1.62;
        pGroup.add(trunk, c1, c2, star);
      } else if (prop.decorType === 'pumpkin') {
        const pum = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 12, 10),
          new THREE.MeshStandardMaterial({
            color: 0xf97316,
            emissive: 0xc2410c,
            emissiveIntensity: 0.7,
            roughness: 0.4,
          }),
        );
        pum.scale.set(1.2, 0.9, 1.2);
        pum.position.y = 0.3;
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.05, 0.14, 8),
          new THREE.MeshStandardMaterial({ color: 0x15803d }),
        );
        stem.position.y = 0.62;
        pGroup.add(pum, stem);
      } else if (prop.decorType === 'gift') {
        const box1 = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, 0.4, 0.48),
          pMat,
        );
        box1.position.y = 0.2;
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.42, 0.12),
          aMat,
        );
        rib.position.y = 0.2;
        const bow = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.09),
          aMat,
        );
        bow.position.y = 0.45;
        pGroup.add(box1, rib, bow);
      } else if (prop.decorType === 'crystal') {
        const ped = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.24, 0.6, 12),
          aMat,
        );
        ped.position.y = 0.3;
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.2),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 1.1,
            metalness: 0.9,
            roughness: 0.1,
          }),
        );
        gem.position.y = 0.85;
        pGroup.add(ped, gem);
      } else {
        const ped = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.25, 0.5, 12),
          aMat,
        );
        ped.position.y = 0.25;
        const top = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 10, 10),
          pMat,
        );
        top.position.y = 0.65;
        pGroup.add(ped, top);
      }
    } else if (prop.chairStyle === 'wooden_beach' || prop.id.includes('beach_chair')) {
      // Cadeirinha de madeira de praia com ripas inclinadas, braços e almofada listrada
      const woodMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(prop.primaryColor || '#A1622B'),
        roughness: 0.78,
        metalness: 0.04,
      });
      const cushionMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(prop.accentColor || '#F59E0B'),
        roughness: 0.55,
        sheen: 0.5,
      });

      // Estrutura lateral esquerda e direita + pés de madeira
      for (const sx of [-0.27, 0.27]) {
        const legFront = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.38, 0.055), woodMat);
        legFront.position.set(sx, 0.19, 0.22);
        const legBack = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.055), woodMat);
        legBack.position.set(sx, 0.17, -0.22);
        const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.58), woodMat);
        sideRail.position.set(sx, 0.34, 0);
        sideRail.rotation.x = 0.08;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.04, 0.5), woodMat);
        arm.position.set(sx, 0.52, -0.02);
        const armPost = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.05), woodMat);
        armPost.position.set(sx, 0.43, 0.16);
        pGroup.add(legFront, legBack, sideRail, arm, armPost);
      }

      // Ripas horizontais de madeira no assento
      for (let s = 0; s < 4; s++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.032, 0.095), woodMat);
        slat.position.set(0, 0.36 - s * 0.012, 0.2 - s * 0.125);
        slat.castShadow = true;
        pGroup.add(slat);
      }

      // Encosto de madeira inclinado com ripas
      const backGroup = new THREE.Group();
      backGroup.position.set(0, 0.35, -0.22);
      backGroup.rotation.x = -0.34;
      for (const sx of [-0.24, 0.24]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.58, 0.05), woodMat);
        post.position.set(sx, 0.28, 0);
        backGroup.add(post);
      }
      for (let r = 0; r < 4; r++) {
        const bSlat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.085, 0.032), woodMat);
        bSlat.position.set(0, 0.12 + r * 0.125, 0.02);
        backGroup.add(bSlat);
      }
      // Almofada de praia no encosto
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.06), cushionMat);
      pillow.position.set(0, 0.46, 0.05);
      backGroup.add(pillow);
      pGroup.add(backGroup);
    } else {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16), pMat);
      seat.position.y = 0.46;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.08), pMat);
      back.position.set(0, 0.68, -0.18);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 10), aMat);
      leg.position.y = 0.22;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.025, 16), aMat);
      foot.position.y = 0.012;
      pGroup.add(seat, back, leg, foot);
    }

    group.add(pGroup);
    propMeshes.set(prop.id, pGroup);
  }

  return {
    group,
    floorMesh,
    djBoothGroup,
    djScreenMesh,
    djDiscs,
    eqBars,
    speakerCones,
    propMeshes,
    aquariumFish,
    aquariumBubbles,
    jumpingFish,
    hoppingRabbits,
    danceTiles,
    movingLights,
    neonPulseMaterials,
    skyBackgroundHex: isTropicalIsland || isSinglePalmIsland
      ? '#38BDF8'
      : isForestPicnic
        ? '#7DD3FC'
        : isNeonClub
          ? '#07040F'
          : isOfficialRooftop
            ? opts.theme === 'lounge_party_natal'
              ? '#0A1128'
              : opts.theme === 'lounge_party_halloween'
                ? '#180C26'
                : '#38BDF8'
            : undefined,
    fogColorHex: isTropicalIsland || isSinglePalmIsland
      ? '#BAE6FD'
      : isForestPicnic
        ? '#BBF7D0'
        : isOfficialRooftop
          ? opts.theme === 'lounge_party_natal'
            ? '#1E293B'
            : opts.theme === 'lounge_party_halloween'
              ? '#2E1065'
              : '#BAE6FD'
          : undefined,
  };
}

/**
 * Converte tema da Suíte em RoomBackdropTheme equivalente.
 */
export function suiteThemeToBackdrop(theme: SuiteThemeId): RoomBackdropTheme {
  if (theme === 'noite_veludo') return 'cobertura_diamante_vip';
  if (theme === 'milan_sage') return 'casa_estar_moderna';
  return 'quarto_cozy';
}
