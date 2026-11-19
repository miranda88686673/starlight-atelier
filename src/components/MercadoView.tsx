import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  Coins,
  Eye,
  History,
  PlusCircle,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  ClothingCategory,
  ClothingItem,
  DEFAULT_FACE_CUSTOMIZATION,
  ItemGenderStyle,
  MarketListing,
  PlayerProgressState,
  UserAccount,
} from '../types/game';
import { resolveItemClass } from '../data/catalog';
import { useGlobalState } from '../core/state/GlobalStateManager';
import { notifyRemoteMarketListings } from '../core/state/socketBridge';
import { resolveCoreStaffRole } from '../core/security/RoleGuard';
import { soundEngine } from '../utils/sound';
import { resilientApiRequest } from '../utils/apiClient';
import { VipBadge } from './StaffDirectory';
import { Avatar3DViewport } from './three/Avatar3DViewport';
import { ThreeClothingThumbnail } from './three/ThreeItemThumbnail';

interface MercadoViewProps {
  currentUser: UserAccount;
  playerState: PlayerProgressState;
  catalog: ClothingItem[];
  deletedItemIds: string[];
  onUpdatePlayerState: React.Dispatch<React.SetStateAction<PlayerProgressState>>;
  onOpenPublicProfile?: (username: string) => void;
  onEquipItem?: (item: ClothingItem) => void;
}

type MercadoSubTab = 'vitrine' | 'anunciar' | 'meus';
type SortOrder = 'recentes' | 'menor_preco' | 'maior_preco';

const MARKET_CATEGORIES: Array<'todas' | ClothingCategory> = [
  'todas',
  'cabelo',
  'blusas',
  'casacos',
  'vestidos',
  'calcas',
  'sapatos',
  'acessorios',
];

const GENDER_LABELS: Record<ItemGenderStyle, { label: string; className: string }> = {
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

export const MercadoView: React.FC<MercadoViewProps> = ({
  currentUser,
  playerState,
  catalog,
  deletedItemIds,
  onUpdatePlayerState,
  onOpenPublicProfile,
  onEquipItem,
}) => {
  const { marketListings, refreshMarketListings } = useGlobalState();

  const [subTab, setSubTab] = useState<MercadoSubTab>('vitrine');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'todas' | ClothingCategory>('todas');
  const [selectedRarity, setSelectedRarity] = useState<'todos' | 'am' | 'vip' | 'legendary'>('todos');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recentes');

  // Estado para criação de anúncio
  const [sellSearch, setSellSearch] = useState('');
  const [sellCategory, setSellCategory] = useState<'todas' | ClothingCategory>('todas');
  const [selectedSellItemId, setSelectedSellItemId] = useState<string>('');
  const [sellPriceInput, setSellPriceInput] = useState<string>('350');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [submittingListing, setSubmittingListing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tryOnData, setTryOnData] = useState<{
    item: ClothingItem;
    listing: MarketListing;
  } | null>(null);

  useEffect(() => {
    void refreshMarketListings();
  }, [refreshMarketListings]);

  const catalogById = useMemo(() => {
    const map = new Map<string, ClothingItem>();
    catalog.forEach((item) => map.set(item.id, item));
    return map;
  }, [catalog]);

  const activeListings = useMemo(() => {
    return marketListings.filter(
      (l) => l.status === 'active' && !deletedItemIds.includes(l.itemId) && catalogById.has(l.itemId),
    );
  }, [marketListings, deletedItemIds, catalogById]);

  const myActiveListedItemIds = useMemo(() => {
    return new Set(
      activeListings
        .filter((l) => l.sellerAccountId === currentUser.id)
        .map((l) => l.itemId),
    );
  }, [activeListings, currentUser.id]);

  const filteredVitrine = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = activeListings.filter((listing) => {
      const item = catalogById.get(listing.itemId);
      if (!item) return false;
      if (selectedCategory !== 'todas' && item.category !== selectedCategory) return false;
      const cls = resolveItemClass(item);
      if (selectedRarity !== 'todos' && cls !== selectedRarity) return false;
      if (
        q &&
        !`${item.name} ${item.brand} ${listing.sellerUsername} ${item.collectionTag ?? ''}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });

    if (sortOrder === 'menor_preco') {
      return [...matched].sort((a, b) => a.price - b.price);
    }
    if (sortOrder === 'maior_preco') {
      return [...matched].sort((a, b) => b.price - a.price);
    }
    return [...matched].sort((a, b) => b.createdAt - a.createdAt);
  }, [activeListings, catalogById, searchQuery, selectedCategory, selectedRarity, sortOrder]);

  const myOwnedSellableItems = useMemo(() => {
    const q = sellSearch.trim().toLowerCase();
    const list: ClothingItem[] = [];
    for (const itemId of playerState.ownedItemIds) {
      if (deletedItemIds.includes(itemId)) continue;
      if (myActiveListedItemIds.has(itemId)) continue;
      const item = catalogById.get(itemId);
      if (!item) continue;
      if (sellCategory !== 'todas' && item.category !== sellCategory) continue;
      if (
        q &&
        !`${item.name} ${item.brand} ${CATEGORY_LABELS[item.category]}`
          .toLowerCase()
          .includes(q)
      ) {
        continue;
      }
      list.push(item);
    }
    return list.sort((a, b) => {
      const aLeg = resolveItemClass(a) === 'legendary' ? 0 : 1;
      const bLeg = resolveItemClass(b) === 'legendary' ? 0 : 1;
      return aLeg - bLeg;
    });
  }, [
    playerState.ownedItemIds,
    deletedItemIds,
    myActiveListedItemIds,
    catalogById,
    sellCategory,
    sellSearch,
  ]);

  const myListingsHistory = useMemo(() => {
    return marketListings
      .filter(
        (l) =>
          l.sellerAccountId === currentUser.id ||
          l.buyerAccountId === currentUser.id,
      )
      .sort((a, b) => (b.soldAt ?? b.createdAt) - (a.soldAt ?? a.createdAt));
  }, [marketListings, currentUser.id]);

  const recentGlobalSales = useMemo(() => {
    return marketListings
      .filter((l) => l.status === 'sold')
      .sort((a, b) => (b.soldAt ?? b.createdAt) - (a.soldAt ?? a.createdAt))
      .slice(0, 12);
  }, [marketListings]);

  const selectedSellItem = selectedSellItemId
    ? catalogById.get(selectedSellItemId)
    : undefined;

  const handleSelectSellItem = (item: ClothingItem) => {
    setSelectedSellItemId(item.id);
    const suggested = Math.max(50, item.price > 0 ? item.price : 1500);
    setSellPriceInput(String(suggested));
    setErrorMessage(null);
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!selectedSellItem) {
      setErrorMessage('Selecione uma peça do seu inventário para anunciar.');
      return;
    }
    const parsedPrice = Math.round(Number(sellPriceInput));
    if (!Number.isFinite(parsedPrice) || parsedPrice < 1 || parsedPrice > 10_000_000) {
      setErrorMessage('Informe um preço válido em AM (entre 1 e 10.000.000 AM).');
      return;
    }

    setSubmittingListing(true);
    try {
      const payload = {
        sellerAccountId: currentUser.id,
        itemId: selectedSellItem.id,
        price: parsedPrice,
      };
      const data = await resilientApiRequest<{
        ok?: boolean;
        error?: string;
        listings?: MarketListing[];
      }>('/api/market/listings', {
        method: 'POST',
        headers: {
          'x-actor-id': currentUser.id,
        },
        body: payload,
        socketEvent: 'market:create_listing',
        socketPayload: payload,
      });

      if (!data.ok) {
        setErrorMessage(data.error || 'Não foi possível publicar o anúncio no Mercado.');
        soundEngine.playModAction();
        return;
      }

      if (Array.isArray(data.listings)) {
        notifyRemoteMarketListings(data.listings);
      } else {
        await refreshMarketListings();
      }
      soundEngine.playPurchase();
      setStatusMessage(
        `"${selectedSellItem.name}" anunciado no Mercado por ${parsedPrice.toLocaleString('pt-BR')} AM.`,
      );
      setSelectedSellItemId('');
      setSubTab('vitrine');
    } catch {
      setErrorMessage('Falha de conexão com o servidor ao publicar anúncio.');
    } finally {
      setSubmittingListing(false);
    }
  };

  const handleCancelListing = async (listing: MarketListing) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setBusyId(listing.id);
    try {
      const staffRole = resolveCoreStaffRole(currentUser);
      const data = await resilientApiRequest<{
        ok?: boolean;
        error?: string;
        listings?: MarketListing[];
      }>(`/api/market/listings/${encodeURIComponent(listing.id)}`, {
        method: 'DELETE',
        headers: {
          'x-actor-id': currentUser.id,
          'x-actor-email': currentUser.email,
          ...(staffRole ? { 'x-staff-role': staffRole } : {}),
        },
        socketEvent: 'market:cancel_listing',
        socketPayload: {
          listingId: listing.id,
          actorAccountId: currentUser.id,
        },
      });
      if (!data.ok) {
        setErrorMessage(data.error || 'Erro ao cancelar anúncio.');
        soundEngine.playModAction();
        return;
      }
      if (Array.isArray(data.listings)) {
        notifyRemoteMarketListings(data.listings);
      } else {
        await refreshMarketListings();
      }
      soundEngine.playEquip();
      const itemName = catalogById.get(listing.itemId)?.name ?? listing.itemId;
      setStatusMessage(`Anúncio de "${itemName}" retirado do Mercado.`);
    } catch {
      setErrorMessage('Falha de rede ao cancelar o anúncio.');
    } finally {
      setBusyId(null);
    }
  };

  const handleBuyListing = async (listing: MarketListing) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setBusyId(listing.id);
    try {
      const data = await resilientApiRequest<{
        ok?: boolean;
        error?: string;
        listings?: MarketListing[];
        buyerProgress?: PlayerProgressState;
      }>(`/api/market/listings/${encodeURIComponent(listing.id)}/buy`, {
        method: 'POST',
        headers: {
          'x-actor-id': currentUser.id,
        },
        body: {
          buyerAccountId: currentUser.id,
        },
        socketEvent: 'market:buy_listing',
        socketPayload: {
          listingId: listing.id,
          buyerAccountId: currentUser.id,
        },
      });
      if (!data.ok) {
        setErrorMessage(data.error || 'Não foi possível concluir a compra no Mercado.');
        soundEngine.playModAction();
        return;
      }

      if (data.buyerProgress) {
        onUpdatePlayerState(data.buyerProgress);
      }
      if (Array.isArray(data.listings)) {
        notifyRemoteMarketListings(data.listings);
      } else {
        await refreshMarketListings();
      }

      soundEngine.playPurchase();
      const boughtItem = catalogById.get(listing.itemId);
      setStatusMessage(
        `Compra concluída! "${boughtItem?.name ?? listing.itemId}" foi adicionado ao seu guarda-roupa por ${listing.price.toLocaleString('pt-BR')} AM.`,
      );
      if (tryOnData?.listing.id === listing.id) {
        setTryOnData(null);
      }
    } catch {
      setErrorMessage('Falha de conexão com o servidor ao comprar este anúncio.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Editorial do Mercado */}
      <section className="bg-white border border-[#E6E0D8] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FDF2F5] border border-[#F3D0DC] text-[#9E1646] text-[11px] font-semibold">
              <Store className="w-3.5 h-3.5" />
              Mercado P2P de Jogadores
            </span>
            <span className="font-mono-num text-xs text-[#6B645D]">
              {activeListings.length}{' '}
              {activeListings.length === 1 ? 'anúncio ativo' : 'anúncios ativos'}
            </span>
          </div>
          <h2 className="font-display text-3xl font-bold text-[#1C1917] tracking-tight">
            Mercado de Roupas &amp; Relíquias
          </h2>
          <p className="text-xs sm:text-sm text-[#57534E] max-w-2xl">
            Venda peças do seu guarda-roupa pelo preço em AM que desejar e negocie coleções raras ou Coroas Lendárias diretamente com outros jogadores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#C6922B]" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#78716C] font-semibold">
                Seu Saldo
              </p>
              <p className="font-mono-num text-sm font-bold text-[#1C1917]">
                {playerState.starcoins.toLocaleString('pt-BR')} AM
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void refreshMarketListings()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#44403C] bg-[#FAF8F5] hover:bg-[#EAE4DA] border border-[#E6E0D8] rounded-xl cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>
      </section>

      {/* Sub-abas de Navegação do Mercado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex flex-wrap gap-1.5 p-1 bg-white border border-[#E6E0D8] rounded-xl"
          role="tablist"
          aria-label="Seções do Mercado"
        >
          {(
            [
              {
                id: 'vitrine' as MercadoSubTab,
                label: 'Vitrine do Mercado',
                Icon: ShoppingBag,
                count: activeListings.length,
              },
              {
                id: 'anunciar' as MercadoSubTab,
                label: 'Vender um Item',
                Icon: PlusCircle,
                count: myOwnedSellableItems.length,
              },
              {
                id: 'meus' as MercadoSubTab,
                label: 'Meus Anúncios & Histórico',
                Icon: History,
                count: myListingsHistory.length,
              },
            ] as const
          ).map((t) => {
            const active = subTab === t.id;
            const IconComp = t.Icon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setSubTab(t.id);
                  setErrorMessage(null);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#1C1917] text-white'
                    : 'text-[#57534E] hover:bg-[#FAF8F5] hover:text-[#1C1917]'
                }`}
              >
                <IconComp
                  className={`w-3.5 h-3.5 ${active ? 'text-[#F59EB8]' : 'text-[#C8235D]'}`}
                />
                <span>{t.label}</span>
                <span className="font-mono-num text-[11px] opacity-75">({t.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback de Ações */}
      {statusMessage && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center justify-between gap-3">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-800 font-bold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B] flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[#991B1B] font-bold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* ABA 1: VITRINE DO MERCADO */}
      {subTab === 'vitrine' && (
        <div className="space-y-4">
          <section className="bg-white border border-[#E6E0D8] rounded-xl p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {MARKET_CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-[#1C1917] text-white'
                          : 'bg-[#F5F2EC] text-[#57534E] hover:bg-[#EAE4DA]'
                      }`}
                    >
                      {cat === 'todas' ? 'Todas as Categorias' : CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar peça ou vendedor..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg w-56 focus:outline-none focus:border-[#C8235D]"
                  />
                </div>

                <label className="inline-flex items-center gap-1.5 text-xs text-[#44403C]">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#78716C]" />
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className="px-2.5 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg cursor-pointer"
                  >
                    <option value="recentes">Mais recentes</option>
                    <option value="menor_preco">Menor preço (AM)</option>
                    <option value="maior_preco">Maior preço (AM)</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-[#EFEAE3]">
              <span className="text-[11px] font-semibold text-[#78716C] mr-1">
                Raridade:
              </span>
              {(
                [
                  { id: 'todos', label: 'Todas' },
                  { id: 'legendary', label: 'Lendários (Coroas)' },
                  { id: 'vip', label: 'VIP' },
                  { id: 'am', label: 'Livres · AM' },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRarity(r.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer ${
                    selectedRarity === r.id
                      ? 'bg-[#C8235D] text-white border-[#C8235D]'
                      : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </section>

          {filteredVitrine.length === 0 ? (
            <div className="bg-white border border-[#E6E0D8] rounded-2xl p-12 text-center space-y-3">
              <Store className="w-8 h-8 text-[#A8A29E] mx-auto" />
              <p className="text-sm font-medium text-[#44403C]">
                {activeListings.length === 0
                  ? 'Nenhum jogador anunciou peças no Mercado ainda. Seja o primeiro a anunciar!'
                  : 'Nenhum anúncio encontrado para estes filtros.'}
              </p>
              <button
                type="button"
                onClick={() => setSubTab('anunciar')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Anunciar uma Peça Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredVitrine.map((listing) => {
                const item = catalogById.get(listing.itemId);
                if (!item) return null;
                const cls = resolveItemClass(item);
                const isLegendary = cls === 'legendary';
                const isVip = cls === 'vip';
                const isMine = listing.sellerAccountId === currentUser.id;
                const alreadyOwned = playerState.ownedItemIds.includes(item.id);
                const canAfford = playerState.starcoins >= listing.price;
                const genderMeta = GENDER_LABELS[item.gender ?? item.genderStyle ?? 'unissex'];
                const isBusy = busyId === listing.id;

                return (
                  <article
                    key={listing.id}
                    className={`rounded-xl p-4 flex flex-col justify-between transition-all ${
                      isLegendary
                        ? 'bg-gradient-to-b from-[#FAF5FF] via-white to-[#F5EEFB] border-2 border-purple-400/80 shadow-sm'
                        : isVip
                          ? 'bg-gradient-to-b from-[#FFFDF7] to-white border-2 border-[#D97706]/55'
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
                          genderHint={playerState.avatarGender}
                          className="w-36 h-40 object-contain drop-shadow-md"
                        />
                        <span
                          className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold border ${genderMeta.className}`}
                        >
                          {genderMeta.label}
                        </span>
                        {isLegendary && (
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white shadow-xs inline-flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-200" />
                              Lendário
                            </span>
                          </div>
                        )}
                        {!isLegendary && isVip && (
                          <div className="absolute top-2 left-2">
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
                        <button
                          type="button"
                          onClick={() => setTryOnData({ item, listing })}
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
                      <p className="text-[11px] text-[#57534E] mt-1">
                        Vendedor:{' '}
                        <button
                          type="button"
                          onClick={() => onOpenPublicProfile?.(listing.sellerUsername)}
                          className="font-semibold text-[#C8235D] hover:underline cursor-pointer"
                        >
                          @{listing.sellerUsername}
                        </button>
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#EFEAE3] flex items-center justify-between gap-2">
                      <span className="font-mono-num text-sm font-bold text-[#1C1917]">
                        {listing.price.toLocaleString('pt-BR')} AM
                      </span>

                      {isMine ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleCancelListing(listing)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] hover:bg-[#FEE2E2] cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          {isBusy ? 'Removendo...' : 'Cancelar'}
                        </button>
                      ) : alreadyOwned ? (
                        <button
                          type="button"
                          onClick={() => onEquipItem?.(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#F5F2EC] text-[#57534E] border border-[#E6E0D8]"
                        >
                          <Check className="w-3 h-3 text-[#15803D]" />
                          Você já tem
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford || isBusy}
                          onClick={() => void handleBuyListing(listing)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                            canAfford
                              ? 'bg-[#C8235D] text-white hover:bg-[#A61B4B] cursor-pointer'
                              : 'bg-[#EFEAE3] text-[#8C8278] cursor-not-allowed'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          {isBusy
                            ? 'Comprando...'
                            : canAfford
                              ? 'Comprar'
                              : 'Saldo baixo'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: ANUNCIAR ITEM DO PRÓPRIO GUARDA-ROUPA */}
      {subTab === 'anunciar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Painel Esquerdo: Formulário do Anúncio */}
          <form
            onSubmit={handleCreateListing}
            className="lg:col-span-4 bg-white border border-[#E6E0D8] rounded-2xl p-5 space-y-4 lg:sticky lg:top-20"
          >
            <div className="pb-3 border-b border-[#EFEAE3]">
              <h3 className="font-display text-xl font-bold text-[#1C1917] flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#C8235D]" />
                Definir Preço de Venda
              </h3>
              <p className="text-xs text-[#6B645D] mt-0.5">
                Escolha uma peça do seu guarda-roupa à direita e defina o valor desejado em moedas AM.
              </p>
            </div>

            {selectedSellItem ? (
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg bg-white border border-[#E6E0D8] flex items-center justify-center shrink-0 overflow-hidden">
                  <ThreeClothingThumbnail
                    item={selectedSellItem}
                    genderHint={playerState.avatarGender}
                    className="w-14 h-14 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#1C1917] truncate">
                    {selectedSellItem.name}
                  </p>
                  <p className="text-[11px] text-[#6B645D]">
                    {CATEGORY_LABELS[selectedSellItem.category]} · {selectedSellItem.brand}
                  </p>
                  {resolveItemClass(selectedSellItem) === 'legendary' && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-900 rounded">
                      Relíquia Lendária
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-dashed border-[#D6CFC7] text-center text-xs text-[#6B645D]">
                Clique em qualquer peça do seu inventário ao lado para selecioná-la.
              </div>
            )}

            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">
                Preço de venda em AM (Starcoins)
              </span>
              <div className="mt-1 relative">
                <Coins className="w-4 h-4 text-[#C6922B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  min={1}
                  max={10000000}
                  required
                  value={sellPriceInput}
                  onChange={(e) => setSellPriceInput(e.target.value)}
                  className="w-full pl-9 pr-12 py-2.5 text-sm font-mono-num font-bold bg-[#FAF8F5] border border-[#E6E0D8] rounded-xl focus:outline-none focus:border-[#C8235D]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#78716C]">
                  AM
                </span>
              </div>
              <span className="block text-[11px] text-[#78716C] mt-1">
                Quando outro jogador comprar, o item será transferido e o valor integral em AM entrará na sua conta.
              </span>
            </label>

            <button
              type="submit"
              disabled={!selectedSellItem || submittingListing}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:bg-[#EFEAE3] disabled:text-[#8C8278] rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {submittingListing ? 'Publicando anúncio...' : 'Publicar Item no Mercado'}
            </button>
          </form>

          {/* Painel Direito: Inventário do Jogador */}
          <div className="lg:col-span-8 bg-white border border-[#E6E0D8] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-[#1C1917]">
                Seu Guarda-Roupa Disponível ({myOwnedSellableItems.length})
              </h3>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={sellSearch}
                  onChange={(e) => setSellSearch(e.target.value)}
                  placeholder="Filtrar seu inventário..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg w-52"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {MARKET_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSellCategory(cat)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                    sellCategory === cat
                      ? 'bg-[#1C1917] text-white border-[#1C1917]'
                      : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8]'
                  }`}
                >
                  {cat === 'todas' ? 'Todas' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {myOwnedSellableItems.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3] text-center text-xs text-[#6B645D]">
                Nenhuma peça disponível para anunciar com este filtro.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[540px] overflow-y-auto pr-1">
                {myOwnedSellableItems.map((item) => {
                  const selected = selectedSellItemId === item.id;
                  const isLeg = resolveItemClass(item) === 'legendary';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSellItem(item)}
                      className={`text-left rounded-xl p-2.5 border transition-all cursor-pointer ${
                        selected
                          ? 'border-[#C8235D] bg-[#FDF2F5] ring-2 ring-[#C8235D]/20'
                          : isLeg
                            ? 'border-purple-300 bg-purple-50/40 hover:border-purple-500'
                            : 'border-[#E6E0D8] bg-[#FAF8F5] hover:border-[#C7BEB2]'
                      }`}
                    >
                      <div className="h-24 rounded-lg bg-white border border-[#EFEAE3] flex items-center justify-center mb-2 overflow-hidden relative">
                        <ThreeClothingThumbnail
                          item={item}
                          genderHint={playerState.avatarGender}
                          className="w-20 h-20 object-contain"
                        />
                        {isLeg && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-600 text-white">
                            Lendário
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-[#1C1917] line-clamp-1">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-[#78716C]">
                        {CATEGORY_LABELS[item.category]}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: MEUS ANÚNCIOS & HISTÓRICO DE VENDAS */}
      {subTab === 'meus' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-[#E6E0D8] rounded-2xl p-5 space-y-3">
            <h3 className="font-display text-lg font-bold text-[#1C1917]">
              Minhas Negociações no Mercado ({myListingsHistory.length})
            </h3>
            {myListingsHistory.length === 0 ? (
              <p className="text-xs text-[#6B645D] py-6 text-center">
                Você ainda não anunciou ou negociou itens no Mercado.
              </p>
            ) : (
              <div className="divide-y divide-[#F5F2EC] max-h-96 overflow-y-auto">
                {myListingsHistory.map((l) => {
                  const item = catalogById.get(l.itemId);
                  const isSeller = l.sellerAccountId === currentUser.id;
                  return (
                    <div
                      key={l.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1C1917] truncate">
                          {item?.name ?? l.itemId}
                        </p>
                        <p className="text-[11px] text-[#6B645D]">
                          {isSeller ? 'Você anunciou' : `Comprado de @${l.sellerUsername}`} ·{' '}
                          <span className="font-mono-num font-semibold text-[#1C1917]">
                            {l.price.toLocaleString('pt-BR')} AM
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {l.status === 'active' ? (
                          <>
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                              Ativo
                            </span>
                            {isSeller && (
                              <button
                                type="button"
                                disabled={busyId === l.id}
                                onClick={() => void handleCancelListing(l)}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] rounded-md cursor-pointer"
                              >
                                Cancelar
                              </button>
                            )}
                          </>
                        ) : l.status === 'sold' ? (
                          <span className="px-2 py-0.5 rounded bg-[#FAF8F5] text-[#44403C] border border-[#E6E0D8] text-[10px] font-semibold">
                            Vendido {l.buyerUsername ? `p/ @${l.buyerUsername}` : ''}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-[#F5F2EC] text-[#78716C] text-[10px] font-semibold">
                            Cancelado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white border border-[#E6E0D8] rounded-2xl p-5 space-y-3">
            <h3 className="font-display text-lg font-bold text-[#1C1917]">
              Últimas Vendas do Mercado
            </h3>
            {recentGlobalSales.length === 0 ? (
              <p className="text-xs text-[#6B645D] py-6 text-center">
                Nenhuma venda registrada entre jogadores até o momento.
              </p>
            ) : (
              <div className="divide-y divide-[#F5F2EC] max-h-96 overflow-y-auto">
                {recentGlobalSales.map((sale) => {
                  const item = catalogById.get(sale.itemId);
                  return (
                    <div
                      key={sale.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1C1917] truncate">
                          {item?.name ?? sale.itemId}
                        </p>
                        <p className="text-[11px] text-[#6B645D]">
                          @{sale.sellerUsername} → @{sale.buyerUsername ?? 'jogador'}
                        </p>
                      </div>
                      <span className="font-mono-num text-xs font-bold text-[#C8235D] shrink-0">
                        {sale.price.toLocaleString('pt-BR')} AM
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal de Provador 3D para Anúncios do Mercado */}
      {tryOnData && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Provador 3D Mercado: ${tryOnData.item.name}`}
          onClick={() => setTryOnData(null)}
        >
          <div
            className="bg-white border border-[#E6E0D8] rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#EFEAE3]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C8235D]">
                  Provador 3D Mercado · Anúncio de @{tryOnData.listing.sellerUsername}
                </p>
                <h3 className="font-display text-2xl font-bold text-[#1C1917] mt-0.5">
                  {tryOnData.item.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTryOnData(null)}
                aria-label="Fechar provador 3D"
                className="p-2 rounded-lg text-[#57534E] hover:bg-[#F5F2EC] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <Avatar3DViewport
              equipped={{
                ...playerState.equipped,
                [tryOnData.item.category]: tryOnData.item.id,
              }}
              skinTone={playerState.skinTone}
              avatarGender={
                tryOnData.item.gender === 'feminino' || tryOnData.item.gender === 'masculino'
                  ? tryOnData.item.gender
                  : playerState.avatarGender
              }
              faceCustomization={playerState.faceCustomization ?? DEFAULT_FACE_CUSTOMIZATION}
              catalog={catalog}
              focusMode={
                tryOnData.item.category === 'cabelo' ||
                tryOnData.item.id.startsWith('acc_coroa_')
                  ? 'face'
                  : 'body'
              }
              initialPose="runway"
              showControls
              heightClassName="h-[360px]"
              backgroundHex="#F6F1EA"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#EFEAE3]">
              <div>
                <span className="text-xs text-[#6B645D]">Preço do jogador:</span>{' '}
                <strong className="font-mono-num text-base text-[#1C1917]">
                  {tryOnData.listing.price.toLocaleString('pt-BR')} AM
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTryOnData(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#44403C] bg-[#F5F2EC] hover:bg-[#EAE4DA] rounded-lg cursor-pointer"
                >
                  Fechar
                </button>
                {tryOnData.listing.sellerAccountId !== currentUser.id &&
                  !playerState.ownedItemIds.includes(tryOnData.item.id) && (
                    <button
                      type="button"
                      disabled={
                        playerState.starcoins < tryOnData.listing.price ||
                        busyId === tryOnData.listing.id
                      }
                      onClick={() => void handleBuyListing(tryOnData.listing)}
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
