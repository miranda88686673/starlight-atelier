import React, { useMemo, useState } from 'react';
import {
  Armchair,
  Building2,
  Check,
  Coins,
  Crown,
  DoorOpen,
  Lock,
  Paintbrush,
  Search,
  Shirt,
  ShoppingBag,
  Sparkles,
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
import { isItemCompatibleWithGender } from '../utils/storage';
import { VipBadge } from './StaffDirectory';
import { FurnitureSvg } from './svg/FurnitureSvg';
import { ItemPreviewSvg } from './svg/ItemPreviewSvg';
import { RoomBackdropSvg } from './svg/RoomBackdropSvg';

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
  starcoins: number;
  isAccountVip: boolean;
  bodyGender: AvatarGender;
  onBuyItem: (item: ClothingItem) => void;
  onBuyFurniture?: (furn: FurnitureDef) => void;
  onBuyRoomTemplate?: (roomTpl: PurchasableRoomItem) => void;
  onBuyWallpaper?: (wp: PurchasableWallpaperItem) => void;
  onEquipFromShop: (item: ClothingItem) => void;
  onClaimAllowance: () => void;
  onGoToVipStore?: () => void;
  onGoToSuite?: () => void;
  onGoToRooms?: () => void;
}

type ShopSection = 'roupas' | 'moveis' | 'salas' | 'papeis';

const SHOP_CATEGORIES: Array<'todas' | ClothingCategory> = [
  'todas',
  'cabelo',
  'blusas',
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
  starcoins,
  isAccountVip,
  bodyGender,
  onBuyItem,
  onBuyFurniture,
  onBuyRoomTemplate,
  onBuyWallpaper,
  onEquipFromShop,
  onClaimAllowance,
  onGoToVipStore,
  onGoToSuite,
  onGoToRooms,
}) => {
  const [section, setSection] = useState<ShopSection>('roupas');
  const [selectedGender, setSelectedGender] = useState<'todos' | 'compativel' | ItemGenderStyle>('todos');
  const [selectedCategory, setSelectedCategory] = useState<'todas' | ClothingCategory>('todas');
  const [themeFilter, setThemeFilter] = useState<'todos' | RoomThemeCategory>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyPurchasable, setOnlyPurchasable] = useState(false);

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

  const vipItems = useMemo(() => filteredClothing.filter((i) => Boolean(i.isVipOnly)), [filteredClothing]);
  const regularItems = useMemo(() => filteredClothing.filter((i) => !i.isVipOnly), [filteredClothing]);

  const renderClothingCard = (item: ClothingItem, isVipSection: boolean) => {
    const isOwned = ownedItemIds.includes(item.id);
    const isEquipped = equipped[item.category] === item.id;
    const canAfford = starcoins >= item.price;
    const itemGender = item.gender ?? item.genderStyle ?? 'unissex';
    const genderMeta = GENDER_BADGE_STYLES[itemGender];
    const isGenderCompatible = isItemCompatibleWithGender(itemGender, bodyGender);
    const isVipLocked = Boolean(item.isVipOnly) && !isAccountVip;

    return (
      <article
        key={item.id}
        className={`rounded-xl p-4 flex flex-col justify-between transition-colors ${
          isVipSection
            ? 'bg-gradient-to-b from-[#FFFDF7] to-white border-2 border-[#D97706]/55 hover:border-[#D97706]'
            : 'bg-white border border-[#E6E0D8] hover:border-[#C7BEB2]'
        }`}
      >
        <div>
          <div
            className={`h-44 rounded-lg border flex items-center justify-center mb-3 p-1.5 overflow-hidden relative ${
              isVipSection
                ? 'bg-[#FFFBEB]/60 border-[#FDE68A]'
                : 'bg-[#FAF8F5] border-[#EFEAE3]'
            }`}
          >
            <ItemPreviewSvg item={item} previewGender={bodyGender} className="w-36 h-40" />
            <span
              className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold border ${genderMeta.className}`}
            >
              {genderMeta.label}
            </span>
            {item.isVipOnly && (
              <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1">
                <VipBadge compact />
              </div>
            )}
            {item.collectionTag && !item.isVipOnly && (
              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1C1917]/85 text-white">
                {item.collectionTag}
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#6B645D]">
            {item.brand} · {CATEGORY_LABELS[item.category]}
          </p>
          <h3 className="text-sm font-semibold text-[#1C1917] mt-0.5 line-clamp-1">
            {item.name}
          </h3>
          {!isGenderCompatible && (
            <p className="text-[11px] font-medium text-[#B45309] mt-1">
              Compatível apenas com corpo {genderMeta.label}
            </p>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-[#EFEAE3] flex items-center justify-between gap-2">
          <span className="font-mono-num text-sm font-semibold text-[#1C1917]">
            {item.price === 0 ? 'Grátis' : `${item.price} AM`}
          </span>

          {isVipLocked ? (
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
          ) : isOwned ? (
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
          ) : (
            <button
              type="button"
              disabled={!canAfford}
              onClick={() => onBuyItem(item)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                canAfford
                  ? isVipSection
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho editorial da Starplaza */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-3xl font-bold text-[#1C1917] tracking-tight">
              Starplaza Boutique &amp; Arquitetura
            </h2>
            {isAccountVip && <VipBadge />}
          </div>
          <p className="text-sm text-[#57534E] mt-1 max-w-2xl">
            Adquira coleções de moda, móveis temáticos (Boate, Casa, Bares e Hotel de Luxo), Salas exclusivas e Papéis de Parede personalizados com AM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] flex items-center gap-2.5">
            <Coins className="w-4 h-4 text-[#C6922B]" />
            <div>
              <p className="text-[11px] text-[#6B645D] leading-none">Saldo disponível</p>
              <p className="font-mono-num text-base font-semibold text-[#1C1917] mt-0.5">
                {starcoins.toLocaleString('pt-BR')} AM
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClaimAllowance}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#1C1917] bg-[#F5EFE6] hover:bg-[#EAE0D0] border border-[#DFD4C3] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C6922B]" />
            Resgatar Mesada (+250 AM)
          </button>
        </div>
      </section>

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
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#EFEAE3]">
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
        )}
      </section>

      {/* SEÇÃO 1: ROUPAS & CABELOS */}
      {section === 'roupas' && (
        <>
          {vipItems.length > 0 && (
            <section className="rounded-2xl border-2 border-[#D97706]/50 bg-gradient-to-br from-[#FFFBEB] via-white to-[#FEF3C7]/35 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#FDE68A]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FEF3C7] to-[#F59E0B] text-[#78350F] border border-[#D97706] flex items-center justify-center shrink-0">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-2xl font-bold text-[#78350F]">
                        Boutique VIP Exclusiva
                      </h3>
                      <VipBadge />
                    </div>
                    <p className="text-xs text-[#92400E] mt-0.5">
                      {isAccountVip
                        ? 'Seu Passe VIP está ativo! Peças de alta-costura e itens lendários desbloqueados.'
                        : 'Todos podem visualizar as peças lendárias abaixo. Ative o Passe VIP para comprar e equipar!'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isAccountVip && onGoToVipStore && (
                    <button
                      type="button"
                      onClick={onGoToVipStore}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#B45309] hover:bg-[#92400E] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
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
                {vipItems.map((item) => renderClothingCard(item, true))}
              </div>
            </section>
          )}

          {regularItems.length === 0 && vipItems.length === 0 ? (
            <div className="bg-white border border-[#E6E0D8] rounded-xl p-12 text-center">
              <p className="text-sm font-medium text-[#44403C]">
                Nenhuma peça encontrada com os filtros atuais.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedGender('todos');
                  setSelectedCategory('todas');
                  setSearchQuery('');
                  setOnlyPurchasable(false);
                }}
                className="mt-3 px-4 py-2 text-xs font-medium text-[#C8235D] hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            </div>
          ) : regularItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {regularItems.map((item) => renderClothingCard(item, false))}
            </div>
          ) : null}
        </>
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
                      <FurnitureSvg furnitureId={furn.id} furnitureDef={furn} className="w-full h-full" />
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
                  <div className="h-36 rounded-lg border border-[#E6E0D8] mb-3 relative overflow-hidden bg-[#F5EFE7]">
                    <RoomBackdropSvg theme={room.backdropTheme} />
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
                  <div className="h-36 rounded-lg border border-[#E6E0D8] mb-3 relative overflow-hidden">
                    <svg viewBox="0 0 240 140" className="w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id={`wp-wall-${wp.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={wp.wallTopColor} />
                          <stop offset="100%" stopColor={wp.wallBottomColor} />
                        </linearGradient>
                        <linearGradient id={`wp-floor-${wp.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={wp.floorTopColor} />
                          <stop offset="100%" stopColor={wp.floorBottomColor} />
                        </linearGradient>
                      </defs>
                      <rect x="0" y="0" width="240" height="88" fill={`url(#wp-wall-${wp.id})`} />
                      {wp.pattern === 'striped' &&
                        [16, 40, 64, 88, 112, 136, 160, 184, 208].map((x) => (
                          <rect key={x} x={x} y="0" width="8" height="88" fill={wp.accentColor} opacity="0.16" />
                        ))}
                      {wp.pattern === 'neon' && (
                        <>
                          <line x1="0" y1="22" x2="240" y2="22" stroke={wp.accentColor} strokeWidth="2" opacity="0.65" />
                          <circle cx="190" cy="40" r="24" fill={wp.accentColor} opacity="0.22" />
                        </>
                      )}
                      {wp.pattern === 'sequin' &&
                        [30, 75, 120, 165, 210].map((cx, i) => (
                          <circle key={cx} cx={cx} cy={i % 2 === 0 ? 28 : 48} r="4" fill={wp.accentColor} opacity="0.32" />
                        ))}
                      <rect x="0" y="64" width="240" height="24" fill={wp.wainscotColor} />
                      <line x1="0" y1="64" x2="240" y2="64" stroke={wp.accentColor} strokeWidth="1.5" opacity="0.6" />
                      <rect x="0" y="88" width="240" height="52" fill={`url(#wp-floor-${wp.id})`} />
                    </svg>

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
    </div>
  );
};
