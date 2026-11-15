import * as THREE from 'three';
import type {
  PurchasableWallpaperItem,
  RoomBackdropTheme,
  RoomInteractiveProp,
  SuiteThemeId,
} from '../types/game';
import { getMarbleFloorTexture, getWoodTexture } from './studioEngine';

/**
 * Converte coordenadas percentuais de palco de Sala (x: 0..100, y: 0..100) para espaço 3D (metros).
 */
export function roomPctToWorld(xPct: number, yPct: number): { x: number; z: number } {
  const x = ((xPct - 50) / 50) * 6.2; // -6.2..6.2
  const z = ((yPct - 62) / 38) * 3.8; // -3.8..3.8
  return { x, z };
}

export function worldToRoomPct(wx: number, wz: number): { x: number; y: number } {
  const x = Math.max(8, Math.min(92, (wx / 6.2) * 50 + 50));
  const y = Math.max(30, Math.min(94, (wz / 3.8) * 38 + 62));
  return { x, y };
}

/**
 * Converte coordenadas da Suíte (base 920x520) para espaço 3D (metros).
 */
export function suitePxToWorld(px: number, py: number): { x: number; z: number } {
  const x = ((px - 460) / 460) * 5.2;
  const z = ((py - 330) / 190) * 2.9;
  return { x, z };
}

export function worldToSuitePx(wx: number, wz: number): { x: number; y: number } {
  const x = Math.round(Math.max(40, Math.min(880, (wx / 5.2) * 460 + 460)));
  const y = Math.round(Math.max(210, Math.min(485, (wz / 2.9) * 190 + 330)));
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
    case 'boate_neon':
      return {
        wallColor: '#1E1630',
        wainscotColor: '#2D1D46',
        floorColor: '#241B35',
        floorVein: '#4C1D95',
        accentColor: '#F59E0B',
        ambientSky: '#0F172A',
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

export interface BuiltRoomStage3D {
  group: THREE.Group;
  floorMesh: THREE.Mesh;
  djBoothGroup: THREE.Group | null;
  djDiscs: THREE.Mesh[];
  eqBars: THREE.Mesh[];
  propMeshes: Map<string, THREE.Group>;
}

/**
 * Constrói o palco arquitetônico 3D completo de uma sala (incluindo Lounge Party oficial)
 * com piso caminhável para raycast, cabine de DJ animada e mobília interativa.
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

  // Piso amplo com textura de mármore ou madeira
  const floorTex = pal.isNightClub
    ? getMarbleFloorTexture(pal.floorColor, pal.floorVein)
    : getWoodTexture(pal.floorColor, pal.floorVein);

  const floorGeo = new THREE.PlaneGeometry(15.5, 10.5);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: pal.isNightClub ? 0.28 : 0.48,
    metalness: pal.isNightClub ? 0.18 : 0.04,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.name = 'WalkableFloor';
  group.add(floorMesh);

  // Pista iluminada central no Lounge Party / Boates
  if (opts.theme === 'lounge_party' || pal.isNightClub) {
    const danceRing = new THREE.Mesh(
      new THREE.RingGeometry(1.75, 1.92, 48),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(pal.accentColor),
        emissive: new THREE.Color(pal.accentColor),
        emissiveIntensity: 0.7,
        side: THREE.DoubleSide,
      })
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
      })
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
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(pal.accentColor),
    roughness: 0.25,
    metalness: 0.8,
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

  // Paredes laterais
  for (const side of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.8, 10.5), wallMat);
    sideWall.position.set(side * 7.65, 2.4, 0.5);
    sideWall.receiveShadow = true;
    group.add(sideWall);

    // Colunas decorativas
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 4.6, 16), trimMat);
    col.position.set(side * 5.8, 2.3, -4.35);
    group.add(col);
  }

  // Janela panorâmica central com vista noturna/diurna
  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.5, 0.14), trimMat);
  windowFrame.position.set(0, 2.65, -4.48);
  const windowGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(4.15, 2.25),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.ambientSky) })
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
      })
    );
    bulb.position.set(Math.cos(a) * 0.85, -0.05, Math.sin(a) * 0.85);
    chandelier.add(bulb);
  }
  group.add(chandelier);

  // Cabine de DJ 3D interativa (Lounge Party e salas com DJ)
  let djBoothGroup: THREE.Group | null = null;
  const djDiscs: THREE.Mesh[] = [];
  const eqBars: THREE.Mesh[] = [];
  if (opts.includeDjBooth) {
    djBoothGroup = new THREE.Group();
    djBoothGroup.name = 'DJBooth3D';
    djBoothGroup.position.set(0, 0, -3.55);

    const boothBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 1.05, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x1e1b2e, roughness: 0.35, metalness: 0.3 })
    );
    boothBody.position.y = 0.525;
    boothBody.castShadow = true;
    djBoothGroup.add(boothBody);

    const neonBar = new THREE.Mesh(
      new THREE.BoxGeometry(2.36, 0.08, 0.88),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(pal.accentColor),
        emissive: new THREE.Color(pal.accentColor),
        emissiveIntensity: 0.9,
      })
    );
    neonBar.position.y = 1.05;
    djBoothGroup.add(neonBar);

    const vinylMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.25, metalness: 0.5 });
    for (const dx of [-0.55, 0.55]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 24), vinylMat);
      disc.position.set(dx, 1.11, 0);
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16), trimMat);
      disc.add(label);
      djBoothGroup.add(disc);
      djDiscs.push(disc);
    }

    // Equalizador 3D atrás da cabine
    for (let b = 0; b < 7; b++) {
      const barMat = new THREE.MeshStandardMaterial({
        color: b % 2 === 0 ? 0xf59e0b : 0xec4899,
        emissive: b % 2 === 0 ? 0xf59e0b : 0xec4899,
        emissiveIntensity: 0.8,
      });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.08), barMat);
      bar.position.set((b - 3) * 0.26, 1.35, -0.35);
      djBoothGroup.add(bar);
      eqBars.push(bar);
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
      pGroup.add(seat, back);
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
    } else {
      // chair
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

  return { group, floorMesh, djBoothGroup, djDiscs, eqBars, propMeshes };
}

/**
 * Converte tema da Suíte em RoomBackdropTheme equivalente.
 */
export function suiteThemeToBackdrop(theme: SuiteThemeId): RoomBackdropTheme {
  if (theme === 'noite_veludo') return 'cobertura_diamante_vip';
  if (theme === 'milan_sage') return 'casa_estar_moderna';
  return 'quarto_cozy';
}
