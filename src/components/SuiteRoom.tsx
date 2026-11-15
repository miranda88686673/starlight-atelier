import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
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
  isItemCompatibleWithGender,
} from '../utils/storage';
import { ProfileAvatar } from './ProfileAvatar';
import { StaffRoleBadge, VipBadge } from './StaffDirectory';
import { FurnitureSvg } from './svg/FurnitureSvg';
import { ItemPreviewSvg } from './svg/ItemPreviewSvg';
import { MeDollSvg } from './svg/MeDollSvg';

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

const STAGE_WIDTH = 720;
const STAGE_HEIGHT = 480;
const AVATAR_STAGE_WIDTH = 136;
const AVATAR_STAGE_HEIGHT = 252;

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
 * Módulo 3: Suíte 2D com Decoração Livre + Guarda-Roupa Integrado.
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

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<'armario' | 'moveis'>('armario');
  const [selectedCategory, setSelectedCategory] = useState<'todas' | ClothingCategory>('todas');
  const [genderFilter, setGenderFilter] = useState<'todos' | 'compativel'>('todos');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [walkingPos, setWalkingPos] = useState<SuiteAvatarPosition | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const [floorMarker, setFloorMarker] = useState<{ x: number; y: number } | null>(null);
  const walkRafRef = useRef<number | null>(null);
  const floorMarkerTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (walkRafRef.current !== null) {
        window.cancelAnimationFrame(walkRafRef.current);
      }
      if (floorMarkerTimerRef.current !== null) {
        window.clearTimeout(floorMarkerTimerRef.current);
      }
    };
  }, []);

  const avatarPos = walkingPos ?? displaySuite.avatarPos ?? DEFAULT_AVATAR_POS;
  const isAvatarSelected = !isVisiting && selectedId === '__avatar__';

  const dragStateRef = useRef<{
    targetId: string;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    minY: number;
  } | null>(null);

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

  const getTimestamp = () =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const cancelSuiteWalk = () => {
    if (walkRafRef.current !== null) {
      window.cancelAnimationFrame(walkRafRef.current);
      walkRafRef.current = null;
    }
    setWalkingPos(null);
    setIsWalking(false);
  };

  const handleStageFloorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isVisiting || !stageRef.current) return;
    if (e.target !== stageRef.current) return;

    const stageRect = stageRef.current.getBoundingClientRect();
    const scaleX = STAGE_WIDTH / stageRect.width;
    const scaleY = STAGE_HEIGHT / stageRect.height;

    const clickStageX = (e.clientX - stageRect.left) * scaleX;
    const clickStageY = (e.clientY - stageRect.top) * scaleY;

    // Caminha apenas quando o jogador clica na área do piso/tapete (y >= 265px)
    if (clickStageY < 265) return;

    const clampedFeetX = Math.max(
      AVATAR_STAGE_WIDTH / 2,
      Math.min(STAGE_WIDTH - AVATAR_STAGE_WIDTH / 2, clickStageX),
    );
    const clampedFeetY = Math.max(296, Math.min(STAGE_HEIGHT - 8, clickStageY));

    const targetX = Math.max(
      0,
      Math.min(STAGE_WIDTH - AVATAR_STAGE_WIDTH, Math.round(clampedFeetX - AVATAR_STAGE_WIDTH / 2)),
    );
    const targetY = Math.max(
      80,
      Math.min(STAGE_HEIGHT - AVATAR_STAGE_HEIGHT, Math.round(clampedFeetY - AVATAR_STAGE_HEIGHT + 8)),
    );

    setFloorMarker({ x: clampedFeetX, y: clampedFeetY });
    if (floorMarkerTimerRef.current !== null) {
      window.clearTimeout(floorMarkerTimerRef.current);
    }
    floorMarkerTimerRef.current = window.setTimeout(() => setFloorMarker(null), 650);

    const startPos = walkingPos ?? displaySuite.avatarPos ?? DEFAULT_AVATAR_POS;
    const dx = targetX - startPos.x;
    const dy = targetY - startPos.y;
    const dist = Math.hypot(dx, dy);
    const nextFlipped =
      Math.abs(dx) > 4 ? dx < 0 : Boolean(startPos.flipped);

    cancelSuiteWalk();

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (dist < 6 || prefersReducedMotion) {
      onUpdateSuite({
        ...suite,
        avatarPos: {
          ...startPos,
          x: targetX,
          y: targetY,
          flipped: nextFlipped,
        },
        lastSavedAt: getTimestamp(),
      });
      return;
    }

    const durationMs = Math.max(260, Math.min(1650, dist * 3.1));
    const startTime = performance.now();
    setIsWalking(true);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      const curX = Math.round(startPos.x + dx * eased);
      const curY = Math.round(startPos.y + dy * eased);

      const framePos: SuiteAvatarPosition = {
        ...startPos,
        x: curX,
        y: curY,
        flipped: nextFlipped,
      };
      setWalkingPos(framePos);

      if (t < 1) {
        walkRafRef.current = window.requestAnimationFrame(step);
      } else {
        walkRafRef.current = null;
        setWalkingPos(null);
        setIsWalking(false);
        onUpdateSuite({
          ...suite,
          avatarPos: {
            ...startPos,
            x: targetX,
            y: targetY,
            flipped: nextFlipped,
          },
          lastSavedAt: getTimestamp(),
        });
      }
    };

    walkRafRef.current = window.requestAnimationFrame(step);
  };

  const handlePointerDownDraggable = (
    e: React.PointerEvent<HTMLDivElement>,
    targetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    minY = 12,
  ) => {
    if (isVisiting) return;
    e.stopPropagation();
    if (targetId === '__avatar__') {
      cancelSuiteWalk();
    }
    if (!stageRef.current) return;

    const stageRect = stageRef.current.getBoundingClientRect();
    const scaleX = STAGE_WIDTH / stageRect.width;
    const scaleY = STAGE_HEIGHT / stageRect.height;

    const pointerStageX = (e.clientX - stageRect.left) * scaleX;
    const pointerStageY = (e.clientY - stageRect.top) * scaleY;

    setSelectedId(targetId);
    dragStateRef.current = {
      targetId,
      offsetX: pointerStageX - x,
      offsetY: pointerStageY - y,
      width,
      height,
      minY,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveDraggable = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || !stageRef.current) return;

    const stageRect = stageRef.current.getBoundingClientRect();
    const scaleX = STAGE_WIDTH / stageRect.width;
    const scaleY = STAGE_HEIGHT / stageRect.height;

    const rawX = (e.clientX - stageRect.left) * scaleX - drag.offsetX;
    const rawY = (e.clientY - stageRect.top) * scaleY - drag.offsetY;

    const clampedX = Math.max(0, Math.min(STAGE_WIDTH - drag.width, Math.round(rawX)));
    const clampedY = Math.max(
      drag.minY,
      Math.min(STAGE_HEIGHT - drag.height, Math.round(rawY)),
    );

    if (drag.targetId === '__avatar__') {
      onUpdateSuite({
        ...suite,
        avatarPos: {
          ...avatarPos,
          x: clampedX,
          y: clampedY,
        },
        lastSavedAt: getTimestamp(),
      });
      return;
    }

    onUpdateSuite({
      ...suite,
      items: suite.items.map((item) =>
        item.instanceId === drag.targetId
          ? { ...item, x: clampedX, y: clampedY }
          : item,
      ),
      lastSavedAt: getTimestamp(),
    });
  };

  const handlePointerUpDraggable = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignora caso o ponteiro já tenha sido liberado
      }
    }
  };

  const handleAddFurniture = (def: FurnitureDef) => {
    if (def.isVipOnly && !isAccountVip) return;
    const newItem: PlacedFurniture = {
      instanceId: `inst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      furnitureId: def.id,
      x: Math.round((STAGE_WIDTH - def.width) / 2),
      y: Math.round((STAGE_HEIGHT - def.height) / 2) + 35,
      zIndex: def.defaultZ,
      flipped: false,
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

  const handleBringForward = () => {
    if (isAvatarSelected) {
      onUpdateSuite({
        ...suite,
        avatarPos: {
          ...avatarPos,
          zIndex: Math.min(30, avatarPos.zIndex + 1),
        },
        lastSavedAt: getTimestamp(),
      });
      return;
    }
    if (!selectedFurniture) return;
    onUpdateSuite({
      ...suite,
      items: suite.items.map((item) =>
        item.instanceId === selectedFurniture.instanceId
          ? { ...item, zIndex: Math.min(30, item.zIndex + 1) }
          : item,
      ),
      lastSavedAt: getTimestamp(),
    });
  };

  const handleSendBackward = () => {
    if (isAvatarSelected) {
      onUpdateSuite({
        ...suite,
        avatarPos: {
          ...avatarPos,
          zIndex: Math.max(1, avatarPos.zIndex - 1),
        },
        lastSavedAt: getTimestamp(),
      });
      return;
    }
    if (!selectedFurniture) return;
    onUpdateSuite({
      ...suite,
      items: suite.items.map((item) =>
        item.instanceId === selectedFurniture.instanceId
          ? { ...item, zIndex: Math.max(1, item.zIndex - 1) }
          : item,
      ),
      lastSavedAt: getTimestamp(),
    });
  };

  const handleFlipSelected = () => {
    if (isAvatarSelected) {
      onUpdateSuite({
        ...suite,
        avatarPos: {
          ...avatarPos,
          flipped: !avatarPos.flipped,
        },
        lastSavedAt: getTimestamp(),
      });
      return;
    }
    if (!selectedFurniture) return;
    onUpdateSuite({
      ...suite,
      items: suite.items.map((item) =>
        item.instanceId === selectedFurniture.instanceId
          ? { ...item, flipped: !item.flipped }
          : item,
      ),
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
            {isAvatarSelected ? (
              <>
                <span className="text-xs font-medium text-[#1C1917]">
                  Selecionado: <strong>{username} (MeDoll na Suíte)</strong>{' '}
                  <span className="text-[#6B645D] font-mono-num">
                    ({avatarPos.x}px, {avatarPos.y}px · camada {avatarPos.zIndex})
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleBringForward}
                    title="Trazer MeDoll para frente"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#E6E0D8] hover:border-[#C7BEB2] rounded-md cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    Frente
                  </button>
                  <button
                    type="button"
                    onClick={handleSendBackward}
                    title="Enviar MeDoll para trás"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#E6E0D8] hover:border-[#C7BEB2] rounded-md cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    Trás
                  </button>
                  <button
                    type="button"
                    onClick={handleFlipSelected}
                    title="Virar direção do avatar"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#E6E0D8] hover:border-[#C7BEB2] rounded-md cursor-pointer"
                  >
                    <FlipHorizontal2 className="w-3.5 h-3.5" />
                    Virar
                  </button>
                </div>
              </>
            ) : selectedFurniture ? (
              <>
                <span className="text-xs font-medium text-[#1C1917]">
                  Selecionado:{' '}
                  <strong>
                    {resolvedFurnitureCatalog.find((f) => f.id === selectedFurniture.furnitureId)?.name}
                  </strong>{' '}
                  <span className="text-[#6B645D] font-mono-num">
                    ({selectedFurniture.x}px, {selectedFurniture.y}px · camada{' '}
                    {selectedFurniture.zIndex})
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleBringForward}
                    title="Trazer para frente"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#E6E0D8] hover:border-[#C7BEB2] rounded-md cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    Frente
                  </button>
                  <button
                    type="button"
                    onClick={handleSendBackward}
                    title="Enviar para trás"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#E6E0D8] hover:border-[#C7BEB2] rounded-md cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    Trás
                  </button>
                  <button
                    type="button"
                    onClick={handleFlipSelected}
                    title="Espelhar móvel"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#E6E0D8] hover:border-[#C7BEB2] rounded-md cursor-pointer"
                  >
                    <FlipHorizontal2 className="w-3.5 h-3.5" />
                    Girar
                  </button>
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
                Arraste sua MeDoll ou os móveis pelo quarto e clique nas roupas do Armário ao lado para vestir em tempo real.
              </span>
            )}
          </div>
        )}

        <div className={`relative w-full overflow-hidden rounded-xl border border-[#DFD8CE] ${isVisiting ? 'mt-4' : ''}`}>
          <div
            ref={stageRef}
            onPointerDown={() => setSelectedId(null)}
            onClick={handleStageFloorClick}
            className="relative w-full aspect-[3/2] select-none touch-none overflow-hidden"
            style={{ backgroundColor: activeWallpaper?.wallTopColor ?? theme.wallBg }}
          >
            <svg
              viewBox="0 0 720 480"
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="suiteWallGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={activeWallpaper?.wallTopColor ?? theme.wallBg}
                  />
                  <stop
                    offset="100%"
                    stopColor={activeWallpaper?.wallBottomColor ?? theme.wallBg}
                  />
                </linearGradient>
                <linearGradient id="suiteFloorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={activeWallpaper?.floorTopColor ?? theme.floorBg}
                  />
                  <stop
                    offset="100%"
                    stopColor={activeWallpaper?.floorBottomColor ?? theme.floorBg}
                  />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width="720" height="295" fill="url(#suiteWallGrad)" />

              {/* Textura / estampa do papel de parede ativo */}
              {activeWallpaper?.pattern === 'striped' && (
                <g opacity="0.24">
                  {Array.from({ length: 18 }).map((_, idx) => (
                    <rect
                      key={idx}
                      x={idx * 40}
                      y="0"
                      width="18"
                      height="215"
                      fill={activeWallpaper.accentColor}
                    />
                  ))}
                </g>
              )}
              {activeWallpaper?.pattern === 'neon' && (
                <g opacity="0.35">
                  <line x1="0" y1="44" x2="720" y2="44" stroke={activeWallpaper.accentColor} strokeWidth="2.5" />
                  <line x1="0" y1="168" x2="720" y2="168" stroke="#38BDF8" strokeWidth="1.5" />
                  <circle cx="290" cy="108" r="54" fill={activeWallpaper.accentColor} opacity="0.22" />
                  <circle cx="520" cy="96" r="68" fill="#38BDF8" opacity="0.18" />
                </g>
              )}
              {activeWallpaper?.pattern === 'plaid' && (
                <g opacity="0.22" stroke={activeWallpaper.accentColor} strokeWidth="1.5">
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <line key={`v-${idx}`} x1={idx * 64} y1="0" x2={idx * 64} y2="215" />
                  ))}
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <line key={`h-${idx}`} x1="0" y1={idx * 44} x2="720" y2={idx * 44} />
                  ))}
                </g>
              )}
              {activeWallpaper?.pattern === 'sequin' && (
                <g opacity="0.28">
                  <path d="M0,120 Q220,40 460,150 T720,85" fill="none" stroke={activeWallpaper.accentColor} strokeWidth="2.4" />
                  <path d="M80,180 Q320,90 640,175" fill="none" stroke={activeWallpaper.accentColor} strokeWidth="1.4" />
                </g>
              )}

              <rect
                x="0"
                y="210"
                width="720"
                height="85"
                fill={activeWallpaper?.wainscotColor ?? theme.wainscotBg}
              />
              <line
                x1="0"
                y1="210"
                x2="720"
                y2="210"
                stroke={activeWallpaper?.accentColor ?? '#C8BEB1'}
                strokeWidth="2"
                opacity={activeWallpaper ? 0.65 : 1}
              />
              <rect
                x="36"
                y="224"
                width="180"
                height="56"
                fill="none"
                stroke={activeWallpaper?.accentColor ?? '#C8BEB1'}
                strokeWidth="1.2"
                opacity="0.6"
              />
              <rect
                x="504"
                y="224"
                width="180"
                height="56"
                fill="none"
                stroke={activeWallpaper?.accentColor ?? '#C8BEB1'}
                strokeWidth="1.2"
                opacity="0.6"
              />

              <g transform="translate(52, 42)">
                <rect x="0" y="0" width="124" height="156" rx="2" fill="#DCEAF2" stroke="#D8CFC2" strokeWidth="6" />
                <rect x="4" y="106" width="116" height="46" fill="#C4D4DC" />
                <line x1="62" y1="0" x2="62" y2="156" stroke="#FFFFFF" strokeWidth="4" />
                <line x1="0" y1="78" x2="124" y2="78" stroke="#FFFFFF" strokeWidth="4" />
              </g>

              <rect x="0" y="287" width="720" height="10" fill="#FFFFFF" opacity="0.6" />
              <rect x="0" y="297" width="720" height="183" fill="url(#suiteFloorGrad)" />
              <g
                stroke={activeWallpaper?.accentColor ?? theme.floorLine}
                strokeWidth="1.2"
                opacity={activeWallpaper ? 0.35 : 0.65}
              >
                <line x1="0" y1="330" x2="720" y2="330" />
                <line x1="0" y1="368" x2="720" y2="368" />
                <line x1="0" y1="415" x2="720" y2="415" />
                <line x1="120" y1="297" x2="40" y2="480" />
                <line x1="240" y1="297" x2="200" y2="480" />
                <line x1="360" y1="297" x2="360" y2="480" />
                <line x1="480" y1="297" x2="520" y2="480" />
                <line x1="600" y1="297" x2="680" y2="480" />
              </g>
            </svg>

            {visiblePlacedItems.map((placed) => {
              const def = resolvedFurnitureCatalog.find((f) => f.id === placed.furnitureId);
              if (!def) return null;
              const isSelected = placed.instanceId === selectedId;

              return (
                <div
                  key={placed.instanceId}
                  onPointerDown={(e) =>
                    handlePointerDownDraggable(
                      e,
                      placed.instanceId,
                      placed.x,
                      placed.y,
                      def.width,
                      def.height,
                      12,
                    )
                  }
                  onPointerMove={handlePointerMoveDraggable}
                  onPointerUp={handlePointerUpDraggable}
                  onPointerCancel={handlePointerUpDraggable}
                  style={{
                    left: `${(placed.x / STAGE_WIDTH) * 100}%`,
                    top: `${(placed.y / STAGE_HEIGHT) * 100}%`,
                    width: `${(def.width / STAGE_WIDTH) * 100}%`,
                    height: `${(def.height / STAGE_HEIGHT) * 100}%`,
                    zIndex: placed.zIndex,
                    transform: placed.flipped ? 'scaleX(-1)' : undefined,
                  }}
                  className={`absolute transition-shadow ${
                    isVisiting
                      ? 'cursor-default'
                      : 'cursor-grab active:cursor-grabbing'
                  } ${
                    isSelected
                      ? 'ring-2 ring-[#C8235D] ring-offset-2 ring-offset-transparent rounded-lg'
                      : !isVisiting
                        ? 'hover:drop-shadow-md'
                        : ''
                  }`}
                  title={isVisiting ? def.name : `${def.name} — arraste para mover`}
                >
                  <FurnitureSvg
                    furnitureId={def.id}
                    furnitureDef={def}
                    className="w-full h-full"
                  />
                </div>
              );
            })}

            {floorMarker && (
              <div
                style={{
                  left: `${(floorMarker.x / STAGE_WIDTH) * 100}%`,
                  top: `${(floorMarker.y / STAGE_HEIGHT) * 100}%`,
                }}
                className="target-ring-pulse absolute -translate-x-1/2 -translate-y-1/2 w-12 h-4 rounded-full border-2 border-[#C8235D]/80 pointer-events-none z-20"
                aria-hidden="true"
              />
            )}

            <div
              onPointerDown={(e) =>
                handlePointerDownDraggable(
                  e,
                  '__avatar__',
                  avatarPos.x,
                  avatarPos.y,
                  AVATAR_STAGE_WIDTH,
                  AVATAR_STAGE_HEIGHT,
                  80,
                )
              }
              onPointerMove={handlePointerMoveDraggable}
              onPointerUp={handlePointerUpDraggable}
              onPointerCancel={handlePointerUpDraggable}
              style={{
                left: `${(avatarPos.x / STAGE_WIDTH) * 100}%`,
                top: `${(avatarPos.y / STAGE_HEIGHT) * 100}%`,
                width: `${(AVATAR_STAGE_WIDTH / STAGE_WIDTH) * 100}%`,
                height: `${(AVATAR_STAGE_HEIGHT / STAGE_HEIGHT) * 100}%`,
                zIndex: avatarPos.zIndex,
              }}
              className={`group absolute rounded-xl transition-shadow ${
                isVisiting
                  ? 'cursor-default'
                  : 'cursor-grab active:cursor-grabbing'
              } ${
                isAvatarSelected
                  ? 'ring-2 ring-[#C8235D] ring-offset-2 ring-offset-transparent'
                  : !isVisiting
                    ? 'hover:drop-shadow-md'
                    : ''
              }`}
              title={
                isVisiting
                  ? displayUsername
                  : `${displayUsername} — clique no chão para caminhar ou arraste para posicionar`
              }
            >
              <div
                className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[56%] h-3 rounded-full bg-black/20 blur-[2px] pointer-events-none"
                aria-hidden="true"
              />
              <div
                className="w-full h-full pointer-events-none"
                style={{
                  transform: avatarPos.flipped ? 'scaleX(-1)' : undefined,
                }}
              >
                <MeDollSvg
                  equipped={displayEquipped}
                  skinTone={displaySkinTone}
                  avatarGender={displayAvatarGender}
                  deletedItemIds={deletedItemIds}
                  isWalking={!isVisiting && isWalking}
                />
              </div>
            </div>
          </div>
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
                        const isEquipped = equipped[item.category] === item.id;
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
                            <div className="relative flex items-center justify-center h-20 bg-white rounded-lg border border-[#EFEAE3] mb-2 overflow-hidden">
                              <ItemPreviewSvg
                                item={item}
                                previewGender={avatarGender}
                                className="w-16 h-16 transition-transform duration-200 group-hover:scale-105"
                              />
                              {item.isVipOnly && (
                                <div className="absolute top-1 left-1 flex flex-col items-start gap-0.5">
                                  <VipBadge compact />
                                  {item.isLegendary && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#78350F] text-[#FEF3C7] text-[9px] font-bold">
                                      Lendário
                                    </span>
                                  )}
                                </div>
                              )}
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
                          <div className="w-14 h-12 bg-white rounded-lg border border-[#EFEAE3] p-1 flex items-center justify-center shrink-0">
                            <FurnitureSvg
                              furnitureId={furn.id}
                              furnitureDef={furn}
                              className="w-full h-full"
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
                            <div className="w-12 h-10 bg-white rounded-lg border border-[#EFEAE3] p-1 flex items-center justify-center shrink-0">
                              <FurnitureSvg
                                furnitureId={furn.id}
                                furnitureDef={furn}
                                className="w-full h-full"
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
