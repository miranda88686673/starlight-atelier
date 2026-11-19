import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Armchair,
  ArrowLeft,
  FlipHorizontal2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Shirt,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { DEFAULT_SUITE_ITEMS, SKIN_TONES } from '../data/catalog';
import {
  AvatarFaceCustomization,
  AvatarGender,
  CATEGORY_LABELS,
  ClothingCategory,
  ClothingItem,
  EquippedOutfit,
  FurnitureDef,
  ItemGenderStyle,
  PlacedFurniture,
  PublicProfileSummary,
  PurchasableWallpaperItem,
  SkinToneId,
  SuiteAvatarPosition,
  SuiteLayoutState,
  SuiteThemeId,
} from '../types/game';
import {
  getFullFurnitureCatalog,
  getFullWallpaperCatalog,
  isClothingItemEquipped,
  isItemCompatibleWithGender,
} from '../utils/storage';
import { ProfileAvatar } from './ProfileAvatar';
import { StaffRoleBadge, VipBadge } from './StaffDirectory';
import { Suite3DViewport } from './three/Suite3DViewport';
import { ThreeClothingThumbnail, ThreeFurnitureThumbnail } from './three/ThreeItemThumbnail';
import { useThreeScene } from './three/ThreeSceneProvider';
import { disposeObject3D } from '../three/studioEngine';
import { updateAvatarPose } from '../three/avatar3d';
import {
  createAvatarAssemblyGroup,
  syncAvatarAssemblyTransforms,
  updateAvatarAssemblyEquipment,
  type AvatarAssemblyGroup,
} from '../three/clothing3d';
import { loadBaseAvatarWithFallback } from '../three/gltfAvatarLoader';
import { buildFurniture3D } from '../three/furniture3d';
import {
  buildRoomStage3D,
  suitePxToWorld,
  suiteThemeToBackdrop,
} from '../three/roomScenes3d';

interface SuiteRoomProps {
  username: string;
  suite: SuiteLayoutState;
  catalog: ClothingItem[];
  furnitureCatalog?: FurnitureDef[];
  ownedFurnitureIds?: string[];
  wallpaperCatalog?: PurchasableWallpaperItem[];
  ownedWallpaperIds?: string[];
  ownedItemIds: string[];
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  faceCustomization?: AvatarFaceCustomization;
  deletedItemIds: string[];
  isAccountVip?: boolean;
  visitingProfile?: PublicProfileSummary | null;
  onExitVisit?: () => void;
  onOpenHostProfile?: (profile: PublicProfileSummary) => void;
  onUpdateSuite: (nextSuite: SuiteLayoutState, explicitSave?: boolean) => void;
  onToggleEquip: (item: ClothingItem) => void;
  onChangeSkinTone: (tone: SkinToneId) => void;
  onClearOutfit: () => void;
  onGoToShop: () => void;
}

const ROOM_THEMES: Record<
  SuiteThemeId,
  {
    label: string;
    wallBg: string;
    wainscotBg: string;
    floorBg: string;
    floorLine: string;
  }
> = {
  paris_marfim: {
    label: 'Paris Marfim',
    wallBg: '#F6F1EA',
    wainscotBg: '#EBE2D5',
    floorBg: '#DFC7A9',
    floorLine: '#CEB18E',
  },
  milan_sage: {
    label: 'Milão Sálvia',
    wallBg: '#EBF0EC',
    wainscotBg: '#DCE4DE',
    floorBg: '#D4BEA4',
    floorLine: '#C2A88B',
  },
  noite_veludo: {
    label: 'Noite Veludo',
    wallBg: '#2B2B33',
    wainscotBg: '#23232A',
    floorBg: '#7C5D49',
    floorLine: '#684B39',
  },
};

const DEFAULT_AVATAR_POS: SuiteAvatarPosition = {
  x: 292,
  y: 138,
  zIndex: 14,
  flipped: false,
};

const WARDROBE_CATEGORIES: Array<'todas' | ClothingCategory> = [
  'todas',
  'cabelo',
  'blusas',
  'casacos',
  'vestidos',
  'calcas',
  'sapatos',
  'acessorios',
];

const GENDER_STYLE_LABEL: Record<ItemGenderStyle, string> = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  unissex: 'Unissex',
};

/**
 * Módulo 3: Suíte 3D Interativa (Three.js) com Decoração Livre + Armário Integrado.
 */
export const SuiteRoom: React.FC<SuiteRoomProps> = ({
  username,
  suite,
  catalog,
  furnitureCatalog,
  ownedFurnitureIds,
  wallpaperCatalog,
  ownedWallpaperIds,
  ownedItemIds,
  equipped,
  skinTone,
  avatarGender,
  faceCustomization,
  deletedItemIds,
  isAccountVip = false,
  visitingProfile,
  onExitVisit,
  onOpenHostProfile,
  onUpdateSuite,
  onToggleEquip,
  onChangeSkinTone,
  onClearOutfit,
  onGoToShop,
}) => {
  const isVisiting = Boolean(visitingProfile);
  const displayUsername = visitingProfile ? visitingProfile.username : username;
  const displaySuite = visitingProfile ? visitingProfile.suite : suite;
  const displayEquipped = visitingProfile ? visitingProfile.equipped : equipped;
  const displaySkinTone = visitingProfile ? visitingProfile.skinTone : skinTone;
  const displayAvatarGender = visitingProfile ? visitingProfile.avatarGender : avatarGender;
  const displayFaceCustomization = visitingProfile ? visitingProfile.faceCustomization : faceCustomization;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<'armario' | 'moveis'>('armario');
  const [selectedCategory, setSelectedCategory] = useState<'todas' | ClothingCategory>('todas');
  const [genderFilter, setGenderFilter] = useState<'todos' | 'compativel'>('todos');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const avatarPos = displaySuite.avatarPos ?? DEFAULT_AVATAR_POS;

  const resolvedFurnitureCatalog = useMemo(
    () => furnitureCatalog ?? getFullFurnitureCatalog(),
    [furnitureCatalog],
  );

  const resolvedWallpaperCatalog = useMemo(
    () => wallpaperCatalog ?? getFullWallpaperCatalog(),
    [wallpaperCatalog],
  );

  const visibleCatalog = useMemo(
    () => resolvedFurnitureCatalog.filter((f) => !deletedItemIds.includes(f.id)),
    [resolvedFurnitureCatalog, deletedItemIds],
  );

  const ownedFurnitureSet = useMemo(() => {
    if (ownedFurnitureIds) return new Set(ownedFurnitureIds);
    return new Set(
      resolvedFurnitureCatalog.filter((f) => f.starter).map((f) => f.id),
    );
  }, [ownedFurnitureIds, resolvedFurnitureCatalog]);

  const ownedWallpaperSet = useMemo(() => {
    if (ownedWallpaperIds) return new Set(ownedWallpaperIds);
    return new Set(
      resolvedWallpaperCatalog.filter((w) => w.starter).map((w) => w.id),
    );
  }, [ownedWallpaperIds, resolvedWallpaperCatalog]);

  const ownedFurnitureList = useMemo(
    () => visibleCatalog.filter((f) => ownedFurnitureSet.has(f.id)),
    [visibleCatalog, ownedFurnitureSet],
  );

  const shopFurnitureList = useMemo(
    () => visibleCatalog.filter((f) => !ownedFurnitureSet.has(f.id)),
    [visibleCatalog, ownedFurnitureSet],
  );

  const ownedWallpapers = useMemo(
    () => resolvedWallpaperCatalog.filter((w) => ownedWallpaperSet.has(w.id)),
    [resolvedWallpaperCatalog, ownedWallpaperSet],
  );

  const activeWallpaper = useMemo(
    () =>
      displaySuite.wallpaperId
        ? resolvedWallpaperCatalog.find((w) => w.id === displaySuite.wallpaperId)
        : undefined,
    [displaySuite.wallpaperId, resolvedWallpaperCatalog],
  );

  const visiblePlacedItems = useMemo(
    () =>
      displaySuite.items
        .filter((item) => !deletedItemIds.includes(item.furnitureId))
        .sort((a, b) => a.zIndex - b.zIndex),
    [displaySuite.items, deletedItemIds],
  );

  const wardrobeItems = useMemo(() => {
    return catalog.filter((item) => {
      if (!ownedItemIds.includes(item.id) || deletedItemIds.includes(item.id)) {
        return false;
      }
      if (selectedCategory !== 'todas' && item.category !== selectedCategory) {
        return false;
      }
      const itemGender = item.gender ?? item.genderStyle ?? 'unissex';
      if (genderFilter === 'compativel') {
        return isItemCompatibleWithGender(itemGender, avatarGender);
      }
      return true;
    });
  }, [catalog, ownedItemIds, deletedItemIds, selectedCategory, genderFilter, avatarGender]);

  const selectedFurniture = !isVisiting
    ? visiblePlacedItems.find((item) => item.instanceId === selectedId)
    : undefined;

  const theme = ROOM_THEMES[displaySuite.theme] ?? ROOM_THEMES.paris_marfim;

  const three = useThreeScene();
  const visibleClothingCatalog = useMemo(
    () => catalog.filter((c) => !deletedItemIds.includes(c.id)),
    [catalog, deletedItemIds]
  );

  const avatarAssemblyRef = useRef<AvatarAssemblyGroup | null>(null);
  const furnitureMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const selectionRingRef = useRef<THREE.Mesh | null>(null);
  const currentAvatarWorldRef = useRef<{
    x: number;
    z: number;
    rotY: number;
    initialized: boolean;
  }>({ x: 0, z: 0, rotY: 0, initialized: false });

  const displayEquippedRef = useRef<EquippedOutfit>(displayEquipped);
  displayEquippedRef.current = displayEquipped;
  const visibleClothingRef = useRef<ClothingItem[]>(visibleClothingCatalog);
  visibleClothingRef.current = visibleClothingCatalog;
  const avatarPosRef = useRef<SuiteAvatarPosition>(avatarPos);
  avatarPosRef.current = avatarPos;

  // Injeta palco da Suíte (paredes, piso, iluminação arquitetônica) + anel seletor no ThreeSceneProvider
  useEffect(() => {
    if (!three.isReady) return;
    const built = buildRoomStage3D({
      theme: suiteThemeToBackdrop(displaySuite.theme),
      wallpaper: activeWallpaper,
      includeDjBooth: false,
    });
    floorMeshRef.current = built.floorMesh;
    three.setEnvironmentProp('suite-stage', built.group);

    if (!selectionRingRef.current) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.62, 0.72, 32),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
      );
      ring.name = 'Suite_SelectionRing';
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.015;
      ring.visible = false;
      selectionRingRef.current = ring;
      three.setEnvironmentProp('suite-selection-ring', ring);
    }

    return () => {
      floorMeshRef.current = null;
    };
  }, [three, three.isReady, displaySuite.theme, activeWallpaper]);

  // Limpa props de ambiente e móveis ao sair da Suíte
  useEffect(() => {
    if (!three.isReady) return;
    const furnMap = furnitureMapRef.current;
    return () => {
      three.setEnvironmentProp('suite-stage', null);
      three.setEnvironmentProp('suite-selection-ring', null);
      selectionRingRef.current = null;
      three.clearFurniture(true);
      furnMap.clear();
    };
  }, [three, three.isReady]);

  // Carrega e injeta o Avatar 3D da Suíte (AvatarAssemblyGroup) no ThreeSceneProvider
  useEffect(() => {
    if (!three.isReady) return;
    let cancelled = false;

    const cleanupAvatar = () => {
      if (avatarAssemblyRef.current) {
        three.removeAvatar('suite-avatar', false);
        avatarAssemblyRef.current.dispose();
        avatarAssemblyRef.current = null;
      }
    };

    loadBaseAvatarWithFallback({
      gender: displayAvatarGender,
      skinTone: displaySkinTone,
      faceCustomization: displayFaceCustomization,
      withShadowDisc: true,
    }).then((loaded) => {
      if (cancelled) {
        loaded.gltfResult?.dispose();
        if (loaded.proceduralRig) disposeObject3D(loaded.proceduralRig.root);
        return;
      }

      cleanupAvatar();

      const assembly = createAvatarAssemblyGroup(loaded);
      if (!currentAvatarWorldRef.current.initialized) {
        const startW = suitePxToWorld(avatarPosRef.current.x, avatarPosRef.current.y);
        currentAvatarWorldRef.current.x = startW.x;
        currentAvatarWorldRef.current.z = startW.z;
        currentAvatarWorldRef.current.initialized = true;
      }

      const cur = currentAvatarWorldRef.current;
      assembly.rootGroup.position.set(cur.x, 0, cur.z);
      assembly.rootGroup.rotation.y = cur.rotY;

      if (assembly.gltfResult?.mixer && assembly.gltfResult.animations[0]) {
        assembly.gltfResult.mixer.clipAction(assembly.gltfResult.animations[0]).play();
      } else if (assembly.proceduralRig) {
        updateAvatarPose(assembly.proceduralRig, 'idle', 0);
      }

      three.injectAvatar('suite-avatar', assembly.rootGroup, false);
      avatarAssemblyRef.current = assembly;

      updateAvatarAssemblyEquipment(assembly, displayEquippedRef.current, visibleClothingRef.current);
      syncAvatarAssemblyTransforms(assembly);
    });

    return () => {
      cancelled = true;
      cleanupAvatar();
    };
  }, [three, three.isReady, displayAvatarGender, displaySkinTone, displayFaceCustomization]);

  // Sincroniza roupas e cabelo equipados no avatar injetado na Suíte
  useEffect(() => {
    const assembly = avatarAssemblyRef.current;
    if (!assembly) return;
    updateAvatarAssemblyEquipment(assembly, displayEquipped, visibleClothingCatalog);
    syncAvatarAssemblyTransforms(assembly);
  }, [displayEquipped, visibleClothingCatalog]);

  // Injeta todos os modelos 3D de móveis da Suíte no ThreeSceneProvider
  useEffect(() => {
    if (!three.isReady) return;
    three.clearFurniture(true);
    furnitureMapRef.current.clear();

    const byId = new Map(resolvedFurnitureCatalog.map((f) => [f.id, f]));
    for (const placed of visiblePlacedItems) {
      const def = byId.get(placed.furnitureId);
      if (!def) continue;
      const grp = buildFurniture3D(def);
      grp.userData.instanceId = placed.instanceId;
      const w = suitePxToWorld(placed.x, placed.y);
      grp.position.set(w.x, 0, w.z);
      const rotDeg = placed.rotationY ?? (placed.flipped ? 180 : 0);
      grp.rotation.y = (rotDeg * Math.PI) / 180;
      three.injectFurniture(placed.instanceId, grp);
      furnitureMapRef.current.set(placed.instanceId, grp);
    }

    if (selectionRingRef.current) {
      const selGrp = selectedId ? furnitureMapRef.current.get(selectedId) : undefined;
      if (selGrp) {
        selectionRingRef.current.visible = true;
        selectionRingRef.current.position.set(selGrp.position.x, 0.015, selGrp.position.z);
      } else {
        selectionRingRef.current.visible = false;
      }
    }
  }, [three, three.isReady, visiblePlacedItems, resolvedFurnitureCatalog, selectedId]);

  const getTimestamp = () =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const handleAddFurniture = (def: FurnitureDef) => {
    if (def.isVipOnly && !isAccountVip) return;
    const newItem: PlacedFurniture = {
      instanceId: `inst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      furnitureId: def.id,
      x: Math.round((720 - def.width) / 2),
      y: Math.round((480 - def.height) / 2) + 35,
      zIndex: def.defaultZ,
      flipped: false,
      rotationY: 0,
    };
    setSelectedId(newItem.instanceId);
    onUpdateSuite(
      {
        ...suite,
        items: [...suite.items, newItem],
        lastSavedAt: getTimestamp(),
      },
      true,
    );
  };

  const handleRotateBy = (delta: number) => {
    if (!selectedFurniture) return;
    onUpdateSuite({
      ...suite,
      items: suite.items.map((item) => {
        if (item.instanceId !== selectedFurniture.instanceId) return item;
        const currentRot = item.rotationY ?? (item.flipped ? 180 : 0);
        const nextRot = (currentRot + delta + 360) % 360;
        return {
          ...item,
          rotationY: nextRot,
          flipped: nextRot >= 90 && nextRot <= 270,
        };
      }),
      lastSavedAt: getTimestamp(),
    });
  };

  const handleRemoveSelected = () => {
    if (!selectedFurniture) return;
    onUpdateSuite({
      ...suite,
      items: suite.items.filter(
        (item) => item.instanceId !== selectedFurniture.instanceId,
      ),
      lastSavedAt: getTimestamp(),
    });
    setSelectedId(null);
  };

  const handleExplicitSave = () => {
    onUpdateSuite(
      {
        ...suite,
        lastSavedAt: getTimestamp(),
      },
      true,
    );
    setSaveNotice('Layout da Suíte e visual salvos no navegador.');
    window.setTimeout(() => setSaveNotice(null), 2400);
  };

  const handleResetSuite = () => {
    setSelectedId(null);
    onUpdateSuite(
      {
        theme: 'paris_marfim',
        items: DEFAULT_SUITE_ITEMS,
        avatarPos: DEFAULT_AVATAR_POS,
        lastSavedAt: getTimestamp(),
      },
      true,
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <section className="lg:col-span-8 bg-white border border-[#E6E0D8] rounded-xl p-5 flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFEAE3]">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#1C1917] tracking-tight">
              {isVisiting ? `Suíte de ${displayUsername}` : 'Minha Suíte & Armário'}
            </h2>
            <p className="text-xs text-[#6B645D] mt-0.5">
              {isVisiting ? (
                `Você está visitando o quarto decorado de ${displayUsername}`
              ) : (
                <>
                  Vista sua MeDoll dentro do quarto e arraste móveis livremente · Salvo às{' '}
                  <span className="font-mono-num">{displaySuite.lastSavedAt}</span>
                </>
              )}
            </p>
          </div>

          {isVisiting ? (
            <button
              type="button"
              onClick={onExitVisit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para Minha Suíte
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSidebarMode((prev) => (prev === 'armario' ? 'moveis' : 'armario'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#C8235D] bg-[#FDF2F5] hover:bg-[#FCE7EE] border border-[#F2C6D6] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {sidebarMode === 'armario' ? (
                  <>
                    <Armchair className="w-3.5 h-3.5" />
                    Decorar Móveis
                  </>
                ) : (
                  <>
                    <Shirt className="w-3.5 h-3.5" />
                    Abrir Armário
                  </>
                )}
              </button>

              <div className="flex items-center gap-1 p-1 bg-[#F5F2EC] rounded-lg">
                {(Object.keys(ROOM_THEMES) as SuiteThemeId[]).map((themeKey) => (
                  <button
                    key={themeKey}
                    type="button"
                    onClick={() =>
                      onUpdateSuite({
                        ...suite,
                        theme: themeKey,
                        wallpaperId: undefined,
                        lastSavedAt: getTimestamp(),
                      })
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      !suite.wallpaperId && suite.theme === themeKey
                        ? 'bg-white text-[#1C1917] shadow-xs'
                        : 'text-[#6B645D] hover:text-[#1C1917]'
                    }`}
                  >
                    {ROOM_THEMES[themeKey].label}
                  </button>
                ))}
              </div>

              <select
                aria-label="Papel de parede da Suíte"
                value={suite.wallpaperId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateSuite({
                    ...suite,
                    wallpaperId: val || undefined,
                    lastSavedAt: getTimestamp(),
                  });
                }}
                className="px-2.5 py-1.5 text-xs font-medium bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#C8235D] cursor-pointer"
              >
                <option value="">Papel de parede (Tema base)</option>
                {ownedWallpapers.map((wp) => (
                  <option key={wp.id} value={wp.id}>
                    {wp.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleExplicitSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar Suíte
              </button>
            </div>
          )}
        </div>

        {!isVisiting && (
          <div className="my-3 min-h-[40px] flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#EFEAE3]">
            {selectedFurniture ? (
              <>
                <span className="text-xs font-medium text-[#1C1917]">
                  Selecionado:{' '}
                  <strong>
                    {resolvedFurnitureCatalog.find((f) => f.id === selectedFurniture.furnitureId)?.name}
                  </strong>{' '}
                  <span className="text-[#6B645D] font-mono-num">
                    ({selectedFurniture.rotationY ?? (selectedFurniture.flipped ? 180 : 0)}°)
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleRotateBy(45)}
                      title="Girar +45°"
                      className="px-2 py-1 text-xs font-medium bg-white border border-[#E6E0D8] hover:border-[#C7BEB2] rounded-md cursor-pointer"
                    >
                      +45°
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRotateBy(90)}
                      title="Girar +90°"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#E6E0D8] hover:border-[#C7BEB2] rounded-md cursor-pointer"
                    >
                      <FlipHorizontal2 className="w-3.5 h-3.5" />
                      +90°
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRotateBy(180)}
                      title="Girar +180°"
                      className="px-2 py-1 text-xs font-medium bg-white border border-[#E6E0D8] hover:border-[#C7BEB2] rounded-md cursor-pointer"
                    >
                      +180°
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveSelected}
                    title="Guardar móvel"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#B91C1C] bg-white border border-[#E6E0D8] hover:border-[#FCA5A5] rounded-md cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </button>
                </div>
              </>
            ) : (
              <span className="text-xs text-[#6B645D]">
                Clique no piso 3D para caminhar com sua MeDoll, arraste móveis ou vista roupas pelo Armário ao lado.
              </span>
            )}
          </div>
        )}

        <div className={`relative w-full overflow-hidden rounded-xl border border-[#DFD8CE] ${isVisiting ? 'mt-4' : ''}`}>
          <Suite3DViewport
            selectedInstanceId={selectedId}
            onSelectFurniture={(instanceId) => {
              if (!isVisiting) setSelectedId(instanceId);
            }}
            onMoveFurniture={(instanceId, nextX, nextY) => {
              if (isVisiting) return;
              onUpdateSuite({
                ...suite,
                items: suite.items.map((item) =>
                  item.instanceId === instanceId ? { ...item, x: nextX, y: nextY } : item,
                ),
                lastSavedAt: getTimestamp(),
              });
            }}
            avatarPos={avatarPos}
            onWalkAvatar={(nextX, nextY, facingRight) => {
              if (isVisiting) return;
              onUpdateSuite({
                ...suite,
                avatarPos: {
                  ...avatarPos,
                  x: nextX,
                  y: nextY,
                  flipped: !facingRight,
                },
                lastSavedAt: getTimestamp(),
              });
            }}
            avatarAssemblyRef={avatarAssemblyRef}
            furnitureMapRef={furnitureMapRef}
            floorMeshRef={floorMeshRef}
            selectionRingRef={selectionRingRef}
            currentAvatarWorldRef={currentAvatarWorldRef}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B645D]">
          <span>
            {isVisiting ? (
              `Modo visitação · Tema: ${activeWallpaper ? activeWallpaper.name : theme.label} · ${visiblePlacedItems.length} móveis no quarto`
            ) : saveNotice ? (
              <strong className="text-[#15803D]">{saveNotice}</strong>
            ) : (
              'Móveis, papel de parede, roupas escolhidas no Armário e posição do avatar são salvos automaticamente.'
            )}
          </span>
          {!isVisiting && (
            <button
              type="button"
              onClick={handleResetSuite}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#57534E] hover:text-[#1C1917] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar decoração inicial
            </button>
          )}
        </div>
      </section>

      <aside className="lg:col-span-4 bg-white border border-[#E6E0D8] rounded-xl p-5 flex flex-col">
        {visitingProfile ? (
          <div className="flex flex-col justify-between h-full space-y-5">
            <div className="space-y-4">
              <div className="pb-3 border-b border-[#EFEAE3] flex items-center gap-3">
                <ProfileAvatar
                  username={visitingProfile.username}
                  equipped={visitingProfile.equipped}
                  skinTone={visitingProfile.skinTone}
                  avatarGender={visitingProfile.avatarGender}
                  faceCustomization={visitingProfile.faceCustomization}
                  customAvatarUrl={visitingProfile.customAvatarUrl}
                  avatarDisplayMode={visitingProfile.avatarDisplayMode}
                  deletedItemIds={deletedItemIds}
                  sizeClass="w-14 h-14"
                  roundedClass="rounded-xl"
                />
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-bold text-[#1C1917] truncate">
                    {visitingProfile.displayName || visitingProfile.username}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {visitingProfile.staffRoleTier && (
                      <StaffRoleBadge tier={visitingProfile.staffRoleTier} compact />
                    )}
                    {visitingProfile.isVip && <VipBadge compact />}
                    <span className="text-xs font-mono-num text-[#6B645D]">
                      Nível {visitingProfile.level}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3]">
                <p className="text-[11px] font-semibold text-[#78716C]">
                  Recado da Anfitriã
                </p>
                <p className="text-xs text-[#1C1917] mt-1 leading-relaxed">
                  “{visitingProfile.bio}”
                </p>
              </div>

              <p className="text-xs text-[#6B645D] leading-relaxed">
                Você está explorando a Suíte decorada por {visitingProfile.username}. A decoração e o visual do avatar permanecem protegidos durante a visita.
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-[#EFEAE3]">
              {onOpenHostProfile && (
                <button
                  type="button"
                  onClick={() => onOpenHostProfile(visitingProfile)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#1C1917] bg-[#FAF8F5] hover:bg-[#F2ECE3] border border-[#E6E0D8] rounded-lg transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-[#C8235D]" />
                  Ver Perfil Completo de {visitingProfile.username}
                </button>
              )}
              <button
                type="button"
                onClick={onExitVisit}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar para Minha Suíte
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="grid grid-cols-2 gap-1 p-1 bg-[#F5F2EC] rounded-xl mb-4"
              role="tablist"
              aria-label="Ferramentas da Suíte"
            >
              <button
                type="button"
                role="tab"
                aria-selected={sidebarMode === 'armario'}
                onClick={() => setSidebarMode('armario')}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  sidebarMode === 'armario'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#6B645D] hover:text-[#1C1917]'
                }`}
              >
                <Shirt className="w-3.5 h-3.5 text-[#C8235D]" />
                Armário ({ownedItemIds.filter((id) => !deletedItemIds.includes(id)).length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarMode === 'moveis'}
                onClick={() => setSidebarMode('moveis')}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  sidebarMode === 'moveis'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#6B645D] hover:text-[#1C1917]'
                }`}
              >
                <Armchair className="w-3.5 h-3.5 text-[#C8235D]" />
                Móveis ({visiblePlacedItems.length})
              </button>
            </div>

            {sidebarMode === 'armario' ? (
              <>
                <div className="pb-3 border-b border-[#EFEAE3] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-xl font-bold text-[#1C1917]">
                        Armário da Suíte
                      </h3>
                      <p className="text-[11px] text-[#6B645D]">
                        Troque o look sem sair do quarto
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={onClearOutfit}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#44403C] bg-[#F5F2EC] hover:bg-[#EAE4DA] rounded-md cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Limpar Look
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[#6B645D]">Pele:</span>
                      {SKIN_TONES.map((tone) => (
                        <button
                          key={tone.id}
                          type="button"
                          onClick={() => onChangeSkinTone(tone.id)}
                          title={tone.label}
                          aria-label={`Selecionar tom de pele ${tone.label}`}
                          className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                            skinTone === tone.id
                              ? 'border-[#C8235D] scale-110 ring-2 ring-[#C8235D]/25'
                              : 'border-[#D6CFC7] hover:scale-105'
                          }`}
                          style={{ backgroundColor: tone.base }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setGenderFilter('todos')}
                        className={`px-2 py-0.5 text-[11px] font-medium rounded border cursor-pointer ${
                          genderFilter === 'todos'
                            ? 'border-[#C8235D] bg-[#FDF2F5] text-[#9E1646]'
                            : 'border-[#E6E0D8] text-[#6B645D]'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setGenderFilter('compativel')}
                        className={`px-2 py-0.5 text-[11px] font-medium rounded border cursor-pointer ${
                          genderFilter === 'compativel'
                            ? 'border-[#C8235D] bg-[#FDF2F5] text-[#9E1646]'
                            : 'border-[#E6E0D8] text-[#6B645D]'
                        }`}
                      >
                        Meu Corpo
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1" role="tablist" aria-label="Categorias do Armário">
                    {WARDROBE_CATEGORIES.map((cat) => {
                      const isActive = selectedCategory === cat;
                      const label = cat === 'todas' ? 'Tudo' : CATEGORY_LABELS[cat];
                      return (
                        <button
                          key={cat}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            isActive
                              ? 'bg-[#1C1917] text-white'
                              : 'bg-[#F5F2EC] text-[#57534E] hover:bg-[#EAE4DA]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pt-3 max-h-[460px] pr-1">
                  {wardrobeItems.length === 0 ? (
                    <div className="py-10 text-center px-3">
                      <p className="text-xs font-medium text-[#44403C]">
                        Nenhuma peça nesta categoria ainda.
                      </p>
                      <button
                        type="button"
                        onClick={onGoToShop}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Comprar na Starplaza
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {wardrobeItems.map((item) => {
                        const isEquipped = isClothingItemEquipped(equipped, item);
                        const itemGender = item.gender ?? item.genderStyle ?? 'unissex';
                        const compatible = isItemCompatibleWithGender(itemGender, avatarGender);
                        const vipLocked = Boolean(item.isVipOnly) && !isAccountVip;
                        const blocked = !compatible || vipLocked;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={blocked && !isEquipped}
                            onClick={() => onToggleEquip(item)}
                            className={`group text-left rounded-xl border p-2.5 transition-all flex flex-col justify-between ${
                              blocked && !isEquipped
                                ? 'border-[#E6E0D8] bg-[#FAF8F5]/60 opacity-60 cursor-not-allowed'
                                : isEquipped
                                  ? 'border-[#C8235D] bg-[#C8235D]/[0.04] cursor-pointer'
                                  : 'border-[#E6E0D8] bg-[#FAF8F5] hover:border-[#C7BEB2] hover:bg-white cursor-pointer'
                            }`}
                          >
                            <div className="relative flex items-center justify-center h-20 bg-white rounded-lg border border-[#EFEAE3] mb-2 overflow-hidden p-1">
                              <ThreeClothingThumbnail
                                item={item}
                                genderHint={avatarGender}
                                className="w-16 h-16 object-contain transition-transform duration-200 group-hover:scale-105"
                              />
                              <div className="absolute top-1 left-1 flex flex-col items-start gap-0.5">
                                {item.isVipOnly && <VipBadge compact />}
                                {item.isLegendary && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#78350F] text-[#FEF3C7] text-[9px] font-bold">
                                    Lendário
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-[11px] font-semibold text-[#1C1917] line-clamp-1">
                              {item.name}
                            </p>
                            <div className="mt-1.5 pt-1.5 border-t border-[#EFEAE3] flex items-center justify-between text-[11px]">
                              <span
                                className={`inline-flex items-center gap-0.5 font-semibold ${
                                  blocked && !isEquipped
                                    ? 'text-[#78716C]'
                                    : isEquipped
                                      ? 'text-[#C8235D]'
                                      : 'text-[#57534E]'
                                }`}
                              >
                                {blocked && !isEquipped && <Lock className="w-2.5 h-2.5" />}
                                {vipLocked
                                  ? 'VIP'
                                  : !compatible
                                    ? 'Incompat.'
                                    : isEquipped
                                      ? 'Equipada'
                                      : 'Vestir'}
                              </span>
                              <span className="text-[#78716C]">
                                {GENDER_STYLE_LABEL[itemGender]}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="pb-3 border-b border-[#EFEAE3] flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#1C1917]">
                      Depósito de Móveis ({ownedFurnitureList.length})
                    </h3>
                    <p className="text-[11px] text-[#6B645D] mt-0.5">
                      Seus móveis adquiridos e novos temas na Starplaza
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onGoToShop}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#C8235D] bg-[#FDF2F5] hover:bg-[#FCE7EE] border border-[#F2C6D6] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    Starplaza
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 max-h-[460px] pr-1">
                  {ownedFurnitureList.map((furn) => {
                    const vipLocked = Boolean(furn.isVipOnly) && !isAccountVip;
                    return (
                      <div
                        key={furn.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                          furn.isVipOnly
                            ? 'bg-[#FFFDF7] border-[#FCD34D]'
                            : 'bg-[#FAF8F5] border-[#E6E0D8] hover:border-[#C7BEB2]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-12 bg-white rounded-lg border border-[#EFEAE3] p-1 flex items-center justify-center shrink-0 overflow-hidden">
                            <ThreeFurnitureThumbnail
                              def={furn}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-[#1C1917] truncate">
                                {furn.name}
                              </p>
                              {furn.isVipOnly && <VipBadge compact />}
                            </div>
                            <p className="text-[11px] text-[#6B645D] mt-0.5">
                              {furn.category} · {furn.width}×{furn.height}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={vipLocked}
                          onClick={() => handleAddFurniture(furn)}
                          title={vipLocked ? 'Móvel exclusivo para Assinantes VIP' : undefined}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                            vipLocked
                              ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] cursor-not-allowed'
                              : 'text-white bg-[#C8235D] hover:bg-[#A61B4B] cursor-pointer'
                          }`}
                        >
                          {vipLocked ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              VIP
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              Colocar
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}

                  {shopFurnitureList.length > 0 && (
                    <div className="pt-3 mt-2 border-t border-[#EFEAE3] space-y-2">
                      <p className="text-[11px] font-bold text-[#57534E]">
                        Disponíveis para compra na Starplaza ({shopFurnitureList.length})
                      </p>
                      {shopFurnitureList.map((furn) => (
                        <div
                          key={furn.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-dashed border-[#DFD8CE] bg-[#FAF8F5]/60"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-12 h-10 bg-white rounded-lg border border-[#EFEAE3] p-1 flex items-center justify-center shrink-0 overflow-hidden">
                              <ThreeFurnitureThumbnail
                                def={furn}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-[#1C1917] truncate">
                                  {furn.name}
                                </p>
                                {furn.isVipOnly && <VipBadge compact />}
                              </div>
                              <p className="text-[11px] font-mono-num text-[#6B645D]">
                                {furn.price} AM · {furn.category}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={onGoToShop}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#1C1917] bg-white hover:bg-[#F5F2EC] border border-[#E6E0D8] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Lock className="w-3 h-3 text-[#C8235D]" />
                            Comprar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
};
