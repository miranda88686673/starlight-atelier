import React, { useEffect, useMemo, useState } from 'react';
import {
  Armchair,
  Building2,
  Check,
  Clock,
  Coins,
  Crown,
  DoorOpen,
  Eye,
  Lock,
  Paintbrush,
  Search,
  Shirt,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AvatarGender,
  CATEGORY_LABELS,
  ClothingCategory,
  ClothingItem,
  EquippedOutfit,
  FurnitureDef,
  ItemGenderStyle,
  PurchasableRoomItem,
  PurchasableWallpaperItem,
  RoomThemeCategory,
} from '../types/game';
import {
  isClothingItemEquipped,
  isItemCompatibleWithGender,
  toggleItemInEquippedOutfit,
} from '../utils/storage';
import {
  formatCountdown24h,
  resolveItemClass,
  resolveLegendarySaleStatus,
} from '../data/catalog';
import { VipBadge } from './StaffDirectory';
import { Avatar3DViewport } from './three/Avatar3DViewport';
import {
  ThreeClothingThumbnail,
  ThreeFurnitureThumbnail,
  ThreeRoomThumbnail,
} from './three/ThreeItemThumbnail';

interface StarplazaShopProps {
  catalog: ClothingItem[];
  furnitureCatalog?: FurnitureDef[];
  roomCatalog?: PurchasableRoomItem[];
  wallpaperCatalog?: PurchasableWallpaperItem[];
  ownedItemIds: string[];
  ownedFurnitureIds?: string[];
  ownedRoomTemplateIds?: string[];
  ownedWallpaperIds?: string[];
  equipped: EquippedOutfit;
  deletedItemIds: string[];
  soldOutItemIds?: string[];
  legendaryLaunchTimestamps?: Record<string, number>;
  starcoins: number;
  isAccountVip: boolean;
  bodyGender: AvatarGender;
  onBuyItem: (item: ClothingItem) => void;
  onBuyFurniture?: (furn: FurnitureDef) => void;
  onBuyRoomTemplate?: (roomTpl: PurchasableRoomItem) => void;
  onBuyWallpaper?: (wp: PurchasableWallpaperItem) => void;
  onEquipFromShop: (item: ClothingItem) => void;
  onGoToVipStore?: () => void;
  onGoToSuite?: () => void;
  onGoToRooms?: () => void;
}

type ShopSection = 'roupas' | 'moveis' | 'salas' | 'papeis';

const AM_PAGE_SIZE = 24;

const SHOP_CATEGORIES: Array<'todas' | ClothingCategory> = [
  'todas',
  'cabelo',
  'blusas',
  'casacos',
  'vestidos',
  'calcas',
  'sapatos',
  'acessorios',
];

const THEME_FILTERS: Array<{ id: 'todos' | RoomThemeCategory; label: string }> = [
  { id: 'todos', label: 'Todos os Ambientes' },
  { id: 'boate', label: 'Boate & Club' },
  { id: 'casa', label: 'Casa por Cômodo' },
  { id: 'bar', label: 'Bares & Bistrô' },
  { id: 'hotel', label: 'Hotel de Luxo' },
  { id: 'geral', label: 'Coleção Geral' },
];

const THEME_TAG_LABELS: Record<RoomThemeCategory, string> = {
  boate: 'Boate',
  casa: 'Casa',
  bar: 'Bares',
  hotel: 'Hotel de Luxo',
  geral: 'Geral',
};

const GENDER_FILTERS: Array<{ id: 'todos' | 'compativel' | ItemGenderStyle; label: string }> = [
  { id: 'todos', label: 'Todos os Gêneros' },
  { id: 'compativel', label: 'Para minha MeDoll' },
  { id: 'feminino', label: 'Feminino' },
  { id: 'masculino', label: 'Masculino' },
  { id: 'unissex', label: 'Unissex' },
];

const GENDER_BADGE_STYLES: Record<ItemGenderStyle, { label: string; className: string }> = {
  feminino: {
    label: 'Feminino',
    className: 'bg-[#FCE8EF] text-[#9E1646] border-[#F4C4D5]',
  },
  masculino: {
    label: 'Masculino',
    className: 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]',
  },
  unissex: {
    label: 'Unissex',
    className: 'bg-[#F5F2EC] text-[#44403C] border-[#E6E0D8]',
  },
};

/**
 * Módulo 2: Starplaza Boutique & Arquitetura.
 * Seções integradas: Roupas & Cabelos, Móveis Temáticos (Boate, Casa, Bares, Hotel),
 * Salas Comuns & VIP e Papéis de Parede para Suíte/Salas.
 */
export const StarplazaShop: React.FC<StarplazaShopProps> = ({
  catalog,
  furnitureCatalog = [],
  roomCatalog = [],
  wallpaperCatalog = [],
  ownedItemIds,
  ownedFurnitureIds = [],
  ownedRoomTemplateIds = [],
  ownedWallpaperIds = [],
  equipped,
  deletedItemIds,
  soldOutItemIds = [],
  legendaryLaunchTimestamps,
  starcoins,
  isAccountVip,
  bodyGender,
  onBuyItem,
  onBuyFurniture,
  onBuyRoomTemplate,
  onBuyWallpaper,
  onEquipFromShop,
  onGoToVipStore,
  onGoToSuite,
  onGoToRooms,
}) => {
  const [section, setSection] = useState<ShopSection>('roupas');
  const [selectedGender, setSelectedGender] = useState<'todos' | 'compativel' | ItemGenderStyle>('todos');
  const [selectedCategory, setSelectedCategory] = useState<'todas' | ClothingCategory>('todas');
  const [selectedClass, setSelectedClass] = useState<'todas' | 'am' | 'vip' | 'legendary'>('todas');
  const [themeFilter, setThemeFilter] = useState<'todos' | RoomThemeCategory>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyPurchasable, setOnlyPurchasable] = useState(false);
  const [amPage, setAmPage] = useState(1);
  const [tryOnItem, setTryOnItem] = useState<ClothingItem | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    setAmPage(1);
  }, [selectedGender, selectedCategory, selectedClass, onlyPurchasable, searchQuery, section]);

  useEffect(() => {
    if (section !== 'roupas' && !tryOnItem) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [section, tryOnItem]);

  const filteredClothing = useMemo(() => {
    return catalog.filter((item) => {
      if (deletedItemIds.includes(item.id)) return false;
      const itemGender = item.gender ?? item.genderStyle ?? 'unissex';
      if (selectedGender === 'compativel') {
        if (!isItemCompatibleWithGender(itemGender, bodyGender)) return false;
      } else if (selectedGender !== 'todos' && itemGender !== selectedGender) {
        return false;
      }
      if (selectedCategory !== 'todas' && item.category !== selectedCategory) return false;
      if (selectedClass !== 'todas' && resolveItemClass(item) !== selectedClass) return false;
      if (onlyPurchasable && ownedItemIds.includes(item.id)) return false;
      if (
        searchQuery.trim() &&
        !`${item.name} ${item.brand} ${item.collectionTag ?? ''} ${CATEGORY_LABELS[item.category]}`
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [
    catalog,
    deletedItemIds,
    selectedGender,
    selectedCategory,
    selectedClass,
    onlyPurchasable,
    ownedItemIds,
    searchQuery,
    bodyGender,
  ]);

  const filteredFurniture = useMemo(() => {
    return furnitureCatalog.filter((furn) => {
      if (deletedItemIds.includes(furn.id)) return false;
      if (themeFilter !== 'todos' && (furn.themeTag ?? 'casa') !== themeFilter) return false;
      if (onlyPurchasable && ownedFurnitureIds.includes(furn.id)) return false;
      if (
        searchQuery.trim() &&
        !`${furn.name} ${furn.category} ${furn.description ?? ''} ${furn.themeTag ?? ''}`
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [furnitureCatalog, deletedItemIds, themeFilter, onlyPurchasable, ownedFurnitureIds, searchQuery]);

  const filteredRooms = useMemo(() => {
    return roomCatalog.filter((room) => {
      if (themeFilter !== 'todos' && room.themeTag !== themeFilter) return false;
      if (onlyPurchasable && ownedRoomTemplateIds.includes(room.id)) return false;
      if (
        searchQuery.trim() &&
        !`${room.name} ${room.subtitle} ${room.themeTag}`
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [roomCatalog, themeFilter, onlyPurchasable, ownedRoomTemplateIds, searchQuery]);

  const filteredWallpapers = useMemo(() => {
    return wallpaperCatalog.filter((wp) => {
      if (themeFilter !== 'todos' && wp.themeTag !== themeFilter) return false;
      if (onlyPurchasable && ownedWallpaperIds.includes(wp.id)) return false;
      if (
        searchQuery.trim() &&
        !`${wp.name} ${wp.subtitle} ${wp.themeTag}`
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [wallpaperCatalog, themeFilter, onlyPurchasable, ownedWallpaperIds, searchQuery]);

  const legendaryItems = useMemo(
    () => filteredClothing.filter((i) => resolveItemClass(i) === 'legendary'),
    [filteredClothing],
  );
  const vipItems = useMemo(
    () => filteredClothing.filter((i) => resolveItemClass(i) === 'vip'),
    [filteredClothing],
  );
  const amFreeItems = useMemo(
    () => filteredClothing.filter((i) => resolveItemClass(i) === 'am'),
    [filteredClothing],
  );
  const totalAmPages = Math.max(1, Math.ceil(amFreeItems.length / AM_PAGE_SIZE));
  const safeAmPage = Math.min(amPage, totalAmPages);
  const paginatedAmFreeItems = useMemo(() => {
    const start = (safeAmPage - 1) * AM_PAGE_SIZE;
    return amFreeItems.slice(start, start + AM_PAGE_SIZE);
  }, [amFreeItems, safeAmPage]);

  const renderClothingCard = (item: ClothingItem) => {
    const isOwned = ownedItemIds.includes(item.id);
    const isEquipped = isClothingItemEquipped(equipped, item);
    const saleStatus = resolveLegendarySaleStatus(
      item,
      { soldOutItemIds, legendaryLaunchTimestamps },
      nowMs,
    );
    const isSoldOut = saleStatus.isSoldOut;
    const canAfford = starcoins >= item.price;
    const itemGender = item.gender ?? item.genderStyle ?? 'unissex';
    const genderMeta = GENDER_BADGE_STYLES[itemGender];
    const isGenderCompatible = isItemCompatibleWithGender(itemGender, bodyGender);
    const itemCls = resolveItemClass(item);
    const isLegendary = itemCls === 'legendary';
    const isVip = itemCls === 'vip';
    const isVipLocked = isVip && !isAccountVip;

    return (
      <article
        key={item.id}
        className={`rounded-xl p-4 flex flex-col justify-between transition-all ${
          isLegendary
            ? 'bg-gradient-to-b from-[#FAF5FF] via-white to-[#F5EEFB] border-2 border-purple-400/80 shadow-[0_4px_18px_rgba(168,85,247,0.18)] hover:border-purple-500'
            : isVip
              ? 'bg-gradient-to-b from-[#FFFDF7] to-white border-2 border-[#D97706]/55 hover:border-[#D97706] shadow-sm'
              : 'bg-white border border-[#E6E0D8] hover:border-[#C7BEB2]'
        }`}
      >
        <div>
          <div
            className={`h-44 rounded-lg border flex items-center justify-center mb-3 p-1.5 overflow-hidden relative ${
              isLegendary
                ? 'bg-gradient-to-br from-purple-100/60 via-pink-50/40 to-amber-50/50 border-purple-200'
                : isVip
                  ? 'bg-[#FFFBEB]/60 border-[#FDE68A]'
                  : 'bg-[#FAF8F5] border-[#EFEAE3]'
            }`}
          >
            <ThreeClothingThumbnail
              item={item}
              genderHint={bodyGender}
              className="w-36 h-40 object-contain drop-shadow-md"
            />
            <span
              className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold border ${genderMeta.className}`}
            >
              {genderMeta.label}
            </span>
            {isLegendary && (
              <div className="absolute top-2 left-2 flex items-center gap-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white shadow-xs flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-200" /> Lendário
                </span>
              </div>
            )}
            {!isLegendary && isVip && (
              <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1">
                <VipBadge compact />
              </div>
            )}
            {!isLegendary && !isVip && (
              <div className="absolute top-2 left-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                  Livre · AM
                </span>
              </div>
            )}
            {item.collectionTag && (
              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1C1917]/85 text-white">
                {item.collectionTag}
              </span>
            )}
            {isSoldOut && (
              <span className="absolute inset-x-2 top-1/2 -translate-y-1/2 text-center px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[#1C1917]/90 text-[#FDE68A] border border-[#D4AF37]/60 shadow-sm pointer-events-none">
                {saleStatus.reason === 'expired_24h' ? 'Vendido · 24h Esgotadas' : 'Vendido na Loja'}
              </span>
            )}
            <button
              type="button"
              onClick={() => setTryOnItem(item)}
              title="Provar peça em 3D na sua MeDoll"
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-white/95 hover:bg-[#1C1917] text-[#1C1917] hover:text-white border border-[#E6E0D8] shadow-xs transition-colors cursor-pointer"
            >
              <Eye className="w-3 h-3" />
              Provar 3D
            </button>
          </div>

          <p className="text-[11px] text-[#6B645D]">
            {item.brand} · {CATEGORY_LABELS[item.category]}
          </p>
          <h3 className="text-sm font-semibold text-[#1C1917] mt-0.5 line-clamp-1">
            {item.name}
          </h3>
          {isLegendary && !isSoldOut && (
            <p className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100/90 text-purple-900 border border-purple-200 text-[10px] font-mono-num font-bold">
              <Clock className="w-3 h-3 text-purple-700" />
              Tempo limitado: {formatCountdown24h(saleStatus.remainingMs)}
            </p>
          )}
          {!isGenderCompatible && (
            <p className="text-[11px] font-medium text-[#B45309] mt-1">
              Compatível apenas com corpo {genderMeta.label}
            </p>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-[#EFEAE3] flex items-center justify-between gap-2">
          <span className="font-mono-num text-sm font-semibold text-[#1C1917]">
            {item.price === 0 ? 'Grátis' : `${item.price.toLocaleString('pt-BR')} AM`}
          </span>

          {isOwned ? (
            <button
              type="button"
              onClick={() => onEquipFromShop(item)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isEquipped
                  ? 'bg-[#1C1917] text-white'
                  : 'bg-[#F5F2EC] text-[#1C1917] hover:bg-[#EAE4DA]'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              {isEquipped ? 'Vestida' : 'Experimentar'}
            </button>
          ) : isSoldOut ? (
            <button
              type="button"
              disabled
              title={
                saleStatus.reason === 'expired_24h'
                  ? 'O tempo limitado de 24h deste item lendário terminou · Status: Vendido'
                  : 'Este item foi marcado como Vendido na loja pelo Administrador'
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#F5F2EC] text-[#78716C] border border-[#DFD8CE] cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Lock className="w-3 h-3" />
              Vendido
            </button>
          ) : isVipLocked ? (
            <button
              type="button"
              onClick={onGoToVipStore}
              disabled={!onGoToVipStore}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#D97706] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-75"
            >
              <Lock className="w-3 h-3" />
              {onGoToVipStore ? 'Ativar VIP' : 'Exclusivo VIP'}
            </button>
          ) : !isGenderCompatible ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#F5F2EC] text-[#78716C] border border-[#E6E0D8] cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Lock className="w-3 h-3" />
              Corpo {genderMeta.label}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAfford}
              onClick={() => onBuyItem(item)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                canAfford
                  ? isVip
                    ? 'bg-[#B45309] text-white hover:bg-[#92400E] cursor-pointer'
                    : 'bg-[#C8235D] text-white hover:bg-[#A61B4B] cursor-pointer'
                  : 'bg-[#EFEAE3] text-[#8C8278] cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {canAfford ? 'Comprar' : 'Saldo baixo'}
            </button>
          )}
        </div>
      </article>
    );
  };

  const totalClothingCount = useMemo(
    () => catalog.filter((i) => !deletedItemIds.includes(i.id)).length,
    [catalog, deletedItemIds]
  );

  return (
    <div className="space-y-6">
      {/* Navegação por Seção da Starplaza */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-1.5 bg-white border border-[#E6E0D8] rounded-xl"
        role="tablist"
        aria-label="Departamentos da Starplaza"
      >
        {(
          [
            {
              id: 'roupas' as ShopSection,
              label: 'Roupas & Cabelos',
              Icon: Shirt,
              count: catalog.filter((i) => !deletedItemIds.includes(i.id)).length,
            },
            {
              id: 'moveis' as ShopSection,
              label: 'Móveis Temáticos',
              Icon: Armchair,
              count: furnitureCatalog.filter((f) => !deletedItemIds.includes(f.id)).length,
            },
            {
              id: 'salas' as ShopSection,
              label: 'Salas (Comuns & VIP)',
              Icon: Building2,
              count: roomCatalog.length,
            },
            {
              id: 'papeis' as ShopSection,
              label: 'Papéis de Parede',
              Icon: Paintbrush,
              count: wallpaperCatalog.length,
            },
          ]
        ).map((tab) => {
          const active = section === tab.id;
          const IconComp = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(tab.id)}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#1C1917] text-white'
                  : 'text-[#57534E] hover:bg-[#FAF8F5] hover:text-[#1C1917]'
              }`}
            >
              <IconComp className={`w-4 h-4 shrink-0 ${active ? 'text-[#F59EB8]' : 'text-[#C8235D]'}`} />
              <span>{tab.label}</span>
              <span className="font-mono-num text-[11px] opacity-75">({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros Dinâmica conforme o Departamento */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {section === 'roupas' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {GENDER_FILTERS.map((gf) => {
                const isActive = selectedGender === gf.id;
                return (
                  <button
                    key={gf.id}
                    type="button"
                    onClick={() => setSelectedGender(gf.id)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#C8235D] text-white'
                        : 'bg-[#FAF8F5] border border-[#E6E0D8] text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    {gf.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {THEME_FILTERS.map((tf) => {
                const isActive = themeFilter === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setThemeFilter(tf.id)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#C8235D] text-white'
                        : 'bg-[#FAF8F5] border border-[#E6E0D8] text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-[#44403C] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyPurchasable}
                onChange={(e) => setOnlyPurchasable(e.target.checked)}
                className="rounded border-[#D6CFC7] text-[#C8235D] focus:ring-[#C8235D]"
              />
              Apenas não adquiridos
            </label>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar item ou tema..."
                className="pl-8 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg w-56 focus:outline-none focus:border-[#C8235D]"
              />
            </div>
          </div>
        </div>

        {section === 'roupas' && (
          <div className="space-y-2.5 pt-3 border-t border-[#EFEAE3]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {SHOP_CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-[#1C1917] text-white'
                          : 'bg-[#F5F2EC] text-[#57534E] hover:bg-[#EAE4DA] hover:text-[#1C1917]'
                      }`}
                    >
                      {cat === 'todas' ? 'Todas as Coleções' : CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>

              <span className="text-xs text-[#6B645D] font-mono-num">
                {filteredClothing.length} {filteredClothing.length === 1 ? 'peça exibida' : 'peças exibidas'}
              </span>
            </div>

            {/* Filtros por Classe de Peça (Lendários, VIP, AM Livres) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#EFEAE3]/70">
              <span className="text-[11px] font-semibold text-[#78716C] mr-1">Classe:</span>
              {[
                { id: 'todas', label: 'Todas as Classes', count: filteredClothing.length },
                { id: 'legendary', label: '✨ Lendários', count: legendaryItems.length },
                { id: 'vip', label: '👑 Itens VIP', count: vipItems.length },
                { id: 'am', label: '💎 Livres · AM', count: amFreeItems.length },
              ].map((cls) => {
                const isActive = selectedClass === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setSelectedClass(cls.id as typeof selectedClass)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? cls.id === 'legendary'
                          ? 'bg-gradient-to-r from-purple-700 to-pink-700 text-white font-bold shadow-xs'
                          : cls.id === 'vip'
                            ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold shadow-xs'
                            : 'bg-[#1C1917] text-white font-bold'
                        : 'bg-[#FAF8F5] text-[#57534E] border border-[#E6E0D8] hover:bg-[#EAE4DA]'
                    }`}
                  >
                    <span>{cls.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">({cls.count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* SEÇÃO 1: ROUPAS & CABELOS SEPARADOS POR CLASSE */}
      {section === 'roupas' && (
        <div className="space-y-6">
          {/* BLOCO 1: ITENS LENDÁRIOS */}
          {legendaryItems.length > 0 && (selectedClass === 'todas' || selectedClass === 'legendary') && (
            <section className="rounded-2xl border-2 border-purple-400/80 bg-gradient-to-br from-[#FAF5FF] via-white to-[#F3E8FF]/40 p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-2xl font-bold text-purple-950">
                        Coleção de Itens Lendários 3D
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        Alta-Raridade Three.js
                      </span>
                    </div>
                    <p className="text-xs text-purple-800/90 mt-0.5">
                      Edições limitadas com janela de 24 horas pelo relógio real na Starplaza. Após 24h ou quando marcadas como Vendido pelo Administrador, não podem mais ser compradas na loja.
                    </p>
                  </div>
                </div>
                <span className="font-mono-num text-xs font-bold text-purple-900 bg-purple-100 border border-purple-300 px-3 py-1 rounded-lg shrink-0">
                  {legendaryItems.length} {legendaryItems.length === 1 ? 'peça lendária' : 'peças lendárias'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {legendaryItems.map((item) => renderClothingCard(item))}
              </div>
            </section>
          )}

          {/* BLOCO 2: ITENS VIP */}
          {vipItems.length > 0 && (selectedClass === 'todas' || selectedClass === 'vip') && (
            <section className="rounded-2xl border-2 border-[#D97706]/50 bg-gradient-to-br from-[#FFFBEB] via-white to-[#FEF3C7]/35 p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#FDE68A]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FEF3C7] to-[#F59E0B] text-[#78350F] border border-[#D97706] flex items-center justify-center shrink-0">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-2xl font-bold text-[#78350F]">
                        Boutique de Itens VIP
                      </h3>
                      <VipBadge />
                    </div>
                    <p className="text-xs text-[#92400E] mt-0.5">
                      {isAccountVip
                        ? 'Seu Passe VIP está ativo! Todas as peças VIP estão prontas para compra e equipagem imediata.'
                        : 'Itens exclusivos para membros VIP do Starlight Atelier. Ative seu passe na Loja Premium para equipar!'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isAccountVip && onGoToVipStore && (
                    <button
                      type="button"
                      onClick={onGoToVipStore}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#B45309] hover:bg-[#92400E] rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      Ativar VIP
                    </button>
                  )}
                  <span className="font-mono-num text-xs font-bold text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] px-3 py-1 rounded-lg shrink-0">
                    {vipItems.length} {vipItems.length === 1 ? 'peça VIP' : 'peças VIP'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {vipItems.map((item) => renderClothingCard(item))}
              </div>
            </section>
          )}

          {/* BLOCO 3: ROUPAS LIVRES (COMPRA LIVRE COM MOEDA PREMIUM AM) */}
          {amFreeItems.length > 0 && (selectedClass === 'todas' || selectedClass === 'am') && (
            <section className="rounded-2xl border border-[#E6E0D8] bg-white p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EFEAE3]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                      Coleção Livre · Moeda Premium AM
                    </h3>
                    <p className="text-xs text-[#57534E] mt-0.5">
                      Peças 3D abertas para compra livre por todos os estilistas utilizando saldo AM regular.
                    </p>
                  </div>
                </div>
                <span className="font-mono-num text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg shrink-0">
                  {amFreeItems.length} {amFreeItems.length === 1 ? 'peça livre' : 'peças livres'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {paginatedAmFreeItems.map((item) => renderClothingCard(item))}
              </div>

              {totalAmPages > 1 && (
                <div className="pt-4 border-t border-[#EFEAE3] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-[#57534E] font-mono-num">
                    Mostrando {(safeAmPage - 1) * AM_PAGE_SIZE + 1}–
                    {Math.min(safeAmPage * AM_PAGE_SIZE, amFreeItems.length)} de {amFreeItems.length} peças
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeAmPage <= 1}
                      onClick={() => setAmPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E6E0D8] bg-[#FAF8F5] text-[#1C1917] hover:bg-[#EAE4DA] disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="px-3 py-1.5 text-xs font-mono-num font-semibold text-[#1C1917]">
                      Página {safeAmPage} / {totalAmPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeAmPage >= totalAmPages}
                      onClick={() => setAmPage((p) => Math.min(totalAmPages, p + 1))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E6E0D8] bg-[#FAF8F5] text-[#1C1917] hover:bg-[#EAE4DA] disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {legendaryItems.length === 0 && vipItems.length === 0 && amFreeItems.length === 0 && (
            <div className="bg-white border border-[#E6E0D8] rounded-xl p-12 text-center">
              {totalClothingCount === 0 ? (
                <p className="text-sm font-medium text-[#44403C]">
                  A loja de roupas está limpa no momento.
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-[#44403C]">
                    Nenhuma peça encontrada com os filtros atuais.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGender('todos');
                      setSelectedCategory('todas');
                      setSelectedClass('todas');
                      setSearchQuery('');
                      setOnlyPurchasable(false);
                    }}
                    className="mt-3 px-4 py-2 text-xs font-medium text-[#C8235D] hover:underline cursor-pointer"
                  >
                    Limpar todos os filtros
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 2: MÓVEIS TEMÁTICOS (BOATE, CASA POR CÔMODO, BARES, HOTEL DE LUXO) */}
      {section === 'moveis' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredFurniture.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-4 bg-white border border-[#E6E0D8] rounded-xl p-12 text-center text-xs text-[#6B645D]">
              Nenhum móvel encontrado nesta categoria.
            </div>
          ) : (
            filteredFurniture.map((furn) => {
              const isOwned = ownedFurnitureIds.includes(furn.id);
              const isVipLocked = Boolean(furn.isVipOnly) && !isAccountVip;
              const canAfford = starcoins >= furn.price;
              const themeLabel = THEME_TAG_LABELS[furn.themeTag ?? 'casa'];

              return (
                <article
                  key={furn.id}
                  className={`rounded-xl p-4 flex flex-col justify-between transition-colors ${
                    furn.isVipOnly
                      ? 'bg-gradient-to-b from-[#FFFDF7] to-white border-2 border-[#D97706]/55'
                      : 'bg-white border border-[#E6E0D8] hover:border-[#C7BEB2]'
                  }`}
                >
                  <div>
                    <div
                      className={`h-40 rounded-lg border flex items-center justify-center mb-3 p-3 relative overflow-hidden ${
                        furn.isVipOnly
                          ? 'bg-[#FFFBEB]/60 border-[#FDE68A]'
                          : 'bg-[#FAF8F5] border-[#EFEAE3]'
                      }`}
                    >
                      <ThreeFurnitureThumbnail def={furn} className="w-full h-full object-contain drop-shadow-md" />
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1C1917]/80 text-white">
                        {themeLabel}
                      </span>
                      {furn.isVipOnly && (
                        <div className="absolute top-2 left-2">
                          <VipBadge compact />
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-[#6B645D]">
                      {furn.category} · {furn.width}×{furn.height}
                    </p>
                    <h3 className="text-sm font-semibold text-[#1C1917] mt-0.5 line-clamp-1">
                      {furn.name}
                    </h3>
                    {furn.description && (
                      <p className="text-[11px] text-[#6B645D] mt-1 line-clamp-2 leading-snug">
                        {furn.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#EFEAE3] flex items-center justify-between gap-2">
                    <span className="font-mono-num text-sm font-semibold text-[#1C1917]">
                      {furn.price === 0 ? 'Grátis' : `${furn.price} AM`}
                    </span>

                    {isVipLocked ? (
                      <button
                        type="button"
                        onClick={onGoToVipStore}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#D97706] whitespace-nowrap cursor-pointer"
                      >
                        <Lock className="w-3 h-3" />
                        Ativar VIP
                      </button>
                    ) : isOwned ? (
                      <button
                        type="button"
                        onClick={onGoToSuite}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F5F2EC] hover:bg-[#EAE4DA] text-[#1C1917] whitespace-nowrap cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-[#15803D]" />
                        Adquirido · Suíte
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford || !onBuyFurniture}
                        onClick={() => onBuyFurniture?.(furn)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                          canAfford
                            ? furn.isVipOnly
                              ? 'bg-[#B45309] text-white hover:bg-[#92400E] cursor-pointer'
                              : 'bg-[#C8235D] text-white hover:bg-[#A61B4B] cursor-pointer'
                            : 'bg-[#EFEAE3] text-[#8C8278] cursor-not-allowed'
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        {canAfford ? 'Comprar' : 'Saldo baixo'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      {/* SEÇÃO 3: SALAS COMUNS & SALAS EXCLUSIVAS VIP */}
      {section === 'salas' && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => {
            const isOwned = ownedRoomTemplateIds.includes(room.id) || room.starter;
            const isVipLocked = Boolean(room.isVipOnly) && !isAccountVip;
            const canAfford = starcoins >= room.price;
            const themeLabel = THEME_TAG_LABELS[room.themeTag];

            return (
              <article
                key={room.id}
                className={`rounded-xl p-5 flex flex-col justify-between transition-colors ${
                  room.isVipOnly
                    ? 'bg-gradient-to-b from-[#FFFDF7] to-white border-2 border-[#D97706]/55'
                    : 'bg-white border border-[#E6E0D8]'
                }`}
              >
                <div>
                  <div className="h-36 rounded-lg border border-[#E6E0D8] mb-3 relative overflow-hidden bg-[#1D162B]">
                    <ThreeRoomThumbnail theme={room.backdropTheme} alt={room.name} className="w-full h-full object-cover" />
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1C1917]/85 text-white z-10">
                      {themeLabel}
                    </span>
                    {room.isVipOnly && (
                      <div className="absolute top-2.5 left-2.5 z-10">
                        <VipBadge compact />
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-[#6B645D]">
                    {room.isVipOnly ? 'Arquitetura Exclusiva VIP' : 'Sala Temática Comum'}
                  </p>
                  <h3 className="text-base font-bold text-[#1C1917] mt-0.5">
                    {room.name}
                  </h3>
                  <p className="text-xs text-[#57534E] mt-1 leading-relaxed">
                    {room.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#EFEAE3] flex items-center justify-between gap-2">
                  <span className="font-mono-num text-sm font-semibold text-[#1C1917]">
                    {room.price === 0 ? 'Inclusa' : `${room.price} AM`}
                  </span>

                  {isVipLocked ? (
                    <button
                      type="button"
                      onClick={onGoToVipStore}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#D97706] whitespace-nowrap cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Ativar VIP
                    </button>
                  ) : isOwned ? (
                    <button
                      type="button"
                      onClick={onGoToRooms}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F5F2EC] hover:bg-[#EAE4DA] text-[#1C1917] whitespace-nowrap cursor-pointer"
                    >
                      <DoorOpen className="w-3.5 h-3.5 text-[#15803D]" />
                      Desbloqueada · Criar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford || !onBuyRoomTemplate}
                      onClick={() => onBuyRoomTemplate?.(room)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        canAfford
                          ? room.isVipOnly
                            ? 'bg-[#B45309] text-white hover:bg-[#92400E] cursor-pointer'
                            : 'bg-[#C8235D] text-white hover:bg-[#A61B4B] cursor-pointer'
                          : 'bg-[#EFEAE3] text-[#8C8278] cursor-not-allowed'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {canAfford ? 'Desbloquear' : 'Saldo baixo'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* SEÇÃO 4: PAPÉIS DE PAREDE & PLANOS DE FUNDO */}
      {section === 'papeis' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWallpapers.map((wp) => {
            const isOwned = ownedWallpaperIds.includes(wp.id) || wp.starter;
            const isVipLocked = Boolean(wp.isVipOnly) && !isAccountVip;
            const canAfford = starcoins >= wp.price;
            const themeLabel = THEME_TAG_LABELS[wp.themeTag];

            return (
              <article
                key={wp.id}
                className={`rounded-xl p-5 flex flex-col justify-between transition-colors ${
                  wp.isVipOnly
                    ? 'bg-gradient-to-b from-[#FFFDF7] to-white border-2 border-[#D97706]/55'
                    : 'bg-white border border-[#E6E0D8]'
                }`}
              >
                <div>
                  <div className="h-36 rounded-lg border border-[#E6E0D8] mb-3 relative overflow-hidden bg-[#1D162B]">
                    <ThreeRoomThumbnail
                      theme="casa_estar_moderna"
                      wallpaper={wp}
                      alt={wp.name}
                      className="w-full h-full object-cover"
                    />

                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1C1917]/85 text-white">
                      {themeLabel}
                    </span>
                    {wp.isVipOnly && (
                      <div className="absolute top-2.5 left-2.5">
                        <VipBadge compact />
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-[#6B645D]">
                    Revestimento Suíte &amp; Salas
                  </p>
                  <h3 className="text-base font-bold text-[#1C1917] mt-0.5">
                    {wp.name}
                  </h3>
                  <p className="text-xs text-[#57534E] mt-1 leading-relaxed">
                    {wp.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#EFEAE3] flex items-center justify-between gap-2">
                  <span className="font-mono-num text-sm font-semibold text-[#1C1917]">
                    {wp.price === 0 ? 'Incluso' : `${wp.price} AM`}
                  </span>

                  {isVipLocked ? (
                    <button
                      type="button"
                      onClick={onGoToVipStore}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#D97706] whitespace-nowrap cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Ativar VIP
                    </button>
                  ) : isOwned ? (
                    <button
                      type="button"
                      onClick={onGoToSuite}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F5F2EC] hover:bg-[#EAE4DA] text-[#1C1917] whitespace-nowrap cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 text-[#15803D]" />
                      Aplicar na Suíte
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford || !onBuyWallpaper}
                      onClick={() => onBuyWallpaper?.(wp)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        canAfford
                          ? wp.isVipOnly
                            ? 'bg-[#B45309] text-white hover:bg-[#92400E] cursor-pointer'
                            : 'bg-[#C8235D] text-white hover:bg-[#A61B4B] cursor-pointer'
                          : 'bg-[#EFEAE3] text-[#8C8278] cursor-not-allowed'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {canAfford ? 'Comprar' : 'Saldo baixo'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* MODAL DE PROVADOR 3D INTERATIVO DA STARPLAZA */}
      {tryOnItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Provador 3D: ${tryOnItem.name}`}
          onClick={() => setTryOnItem(null)}
        >
          <div
            className="bg-white border border-[#E6E0D8] rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#EFEAE3]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C8235D]">
                  Provador 3D Starplaza · {tryOnItem.brand}
                </p>
                <h3 className="font-display text-2xl font-bold text-[#1C1917] mt-0.5">
                  {tryOnItem.name}
                </h3>
                <p className="text-xs text-[#6B645D] mt-0.5">
                  Gire o avatar 3D com o mouse, altere o ângulo para Rosto &amp; Cabelo ou visualize em pose de desfile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTryOnItem(null)}
                aria-label="Fechar provador 3D"
                className="p-2 rounded-lg text-[#57534E] hover:bg-[#F5F2EC] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <Avatar3DViewport
              equipped={
                isClothingItemEquipped(equipped, tryOnItem)
                  ? equipped
                  : toggleItemInEquippedOutfit(equipped, tryOnItem, catalog)
              }
              skinTone="pessego"
              avatarGender={
                tryOnItem.gender === 'feminino' || tryOnItem.gender === 'masculino'
                  ? tryOnItem.gender
                  : bodyGender
              }
              catalog={catalog}
              focusMode={tryOnItem.category === 'cabelo' ? 'face' : 'body'}
              initialPose="runway"
              showControls
              heightClassName="h-[380px]"
              backgroundHex="#F6F1EA"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#EFEAE3]">
              <div>
                <span className="text-xs text-[#6B645D]">Valor da peça:</span>{' '}
                <strong className="font-mono-num text-base text-[#1C1917]">
                  {tryOnItem.price === 0 ? 'Grátis' : `${tryOnItem.price} AM`}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTryOnItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#44403C] bg-[#F5F2EC] hover:bg-[#EAE4DA] rounded-lg cursor-pointer"
                >
                  Fechar
                </button>
                {ownedItemIds.includes(tryOnItem.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      onEquipFromShop(tryOnItem);
                      setTryOnItem(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Vestir na MeDoll
                  </button>
                ) : resolveLegendarySaleStatus(
                    tryOnItem,
                    { soldOutItemIds, legendaryLaunchTimestamps },
                    nowMs,
                  ).isSoldOut ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#EFEAE3] text-[#78716C] rounded-lg cursor-not-allowed"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {resolveLegendarySaleStatus(
                      tryOnItem,
                      { soldOutItemIds, legendaryLaunchTimestamps },
                      nowMs,
                    ).reason === 'expired_24h'
                      ? 'Vendido (24h esgotadas)'
                      : 'Vendido na Loja'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      starcoins < tryOnItem.price ||
                      (resolveItemClass(tryOnItem) === 'vip' && !isAccountVip) ||
                      !isItemCompatibleWithGender(
                        tryOnItem.gender ?? tryOnItem.genderStyle ?? 'unissex',
                        bodyGender,
                      )
                    }
                    onClick={() => {
                      onBuyItem(tryOnItem);
                      setTryOnItem(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:bg-[#EFEAE3] disabled:text-[#8C8278] rounded-lg cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Comprar agora
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
