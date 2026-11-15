import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Lock,
  RotateCcw,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { SKIN_TONES } from '../data/catalog';
import {
  AvatarGender,
  CATEGORY_LABELS,
  ClothingCategory,
  ClothingItem,
  EquippedOutfit,
  ItemGenderStyle,
  SkinToneId,
} from '../types/game';
import { isItemCompatibleWithGender } from '../utils/storage';
import { VipBadge } from './StaffDirectory';
import { ItemPreviewSvg } from './svg/ItemPreviewSvg';
import { MeDollSvg } from './svg/MeDollSvg';
import { StarlightEngine } from '../core/engine';

interface MeDollStudioProps {
  catalog: ClothingItem[];
  ownedItemIds: string[];
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  deletedItemIds: string[];
  isAccountVip: boolean;
  genderNotice?: string | null;
  onToggleEquip: (item: ClothingItem) => void;
  onUnequipCategory: (category: ClothingCategory) => void;
  onClearOutfit: () => void;
  onChangeSkinTone: (tone: SkinToneId) => void;
  onChangeAvatarGender: (gender: AvatarGender) => void;
  onGoToShop: () => void;
  onGoToProfile: () => void;
}

const CATEGORIES: Array<'todas' | ClothingCategory> = [
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
 * Módulo 1: Provador Compacto & Guarda-Roupa Organizado da MeDoll.
 * Provador centralizado à esquerda (com respiração e piscar de olhos em idle)
 * e inventário categorizado em grade limpa à direita.
 */
export const MeDollStudio: React.FC<MeDollStudioProps> = ({
  catalog,
  ownedItemIds,
  equipped,
  skinTone,
  avatarGender,
  deletedItemIds,
  isAccountVip,
  genderNotice,
  onToggleEquip,
  onUnequipCategory,
  onClearOutfit,
  onChangeSkinTone,
  onChangeAvatarGender,
  onGoToShop,
  onGoToProfile,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'todas' | ClothingCategory>('todas');
  const [wardrobeGenderFilter, setWardrobeGenderFilter] = useState<
    'compativel' | 'todos' | ItemGenderStyle
  >('todos');
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxEngineRef = useRef<StarlightEngine | null>(null);
  const equippedSnapshotRef = useRef<string>(JSON.stringify(equipped));

  useEffect(() => {
    const canvas = fxCanvasRef.current;
    if (!canvas) return;
    const engine = new StarlightEngine(canvas, {
      logicalWidth: 360,
      logicalHeight: 360,
      mode: 'fx_overlay',
    });
    engine.setAmbientLighting('warm_atelier');
    engine.start();
    fxEngineRef.current = engine;
    return () => {
      engine.destroy();
      fxEngineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const serialized = JSON.stringify(equipped);
    if (serialized !== equippedSnapshotRef.current) {
      equippedSnapshotRef.current = serialized;
      fxEngineRef.current?.emitSparkleAtPercent(50, 48, 18);
    }
  }, [equipped]);

  const wardrobeItems = useMemo(() => {
    return catalog.filter((item) => {
      if (!ownedItemIds.includes(item.id) || deletedItemIds.includes(item.id)) {
        return false;
      }
      if (selectedCategory !== 'todas' && item.category !== selectedCategory) {
        return false;
      }
      const itemGender = item.gender ?? item.genderStyle ?? 'unissex';
      if (wardrobeGenderFilter === 'compativel') {
        return isItemCompatibleWithGender(itemGender, avatarGender);
      }
      if (wardrobeGenderFilter !== 'todos' && itemGender !== wardrobeGenderFilter) {
        return false;
      }
      return true;
    });
  }, [
    catalog,
    ownedItemIds,
    deletedItemIds,
    selectedCategory,
    wardrobeGenderFilter,
    avatarGender,
  ]);

  const activeLayers = useMemo(() => {
    const order: ClothingCategory[] = [
      'acessorios',
      'cabelo',
      'vestidos',
      'blusas',
      'calcas',
      'sapatos',
    ];
    return order
      .map((cat) => {
        const itemId = equipped[cat];
        if (!itemId || deletedItemIds.includes(itemId)) return null;
        const item = catalog.find((c) => c.id === itemId);
        return item ? { category: cat, item } : null;
      })
      .filter((entry): entry is { category: ClothingCategory; item: ClothingItem } =>
        Boolean(entry),
      );
  }, [equipped, catalog, deletedItemIds]);

  const totalOwnedCount = useMemo(
    () => ownedItemIds.filter((id) => !deletedItemIds.includes(id)).length,
    [ownedItemIds, deletedItemIds],
  );

  return (
    <div className="space-y-3">
      {genderNotice && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-xl bg-[#FFFBEB] border border-[#FCD34D] text-xs font-medium text-[#92400E]"
        >
          {genderNotice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Coluna Esquerda: Provador Compacto & Elegante (5 colunas) */}
        <section className="lg:col-span-5 bg-white border border-[#E6E0D8] rounded-xl p-4 sm:p-5 flex flex-col gap-3.5">
          {/* Cabeçalho enxuto em linha única */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
            <div>
              <h3 className="font-display text-xl font-bold text-[#1C1917] tracking-tight">
                Provador MeDoll
              </h3>
              <p className="text-[11px] text-[#6B645D]">
                {activeLayers.length} {activeLayers.length === 1 ? 'peça vestida' : 'peças vestidas'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClearOutfit}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#44403C] bg-[#F5F2EC] hover:bg-[#EAE4DA] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar Look
            </button>
          </div>

          {/* Controles compactos de Corpo e Tom de Pele */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div
              className="inline-flex items-center gap-0.5 p-0.5 bg-[#F5F2EC] rounded-lg"
              role="group"
              aria-label="Modelo de corpo da MeDoll"
            >
              {(['feminino', 'masculino', 'neutro'] as AvatarGender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onChangeAvatarGender(g)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    avatarGender === g
                      ? 'bg-white text-[#1C1917] shadow-2xs'
                      : 'text-[#6B645D] hover:text-[#1C1917]'
                  }`}
                >
                  {g === 'feminino' ? 'Feminino' : g === 'masculino' ? 'Masculino' : 'Neutro'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#6B645D] mr-0.5">Pele:</span>
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
          </div>

          {/* Espelho Central do Provador (Limpo, sem sobreposições invasivas) */}
          <div className="relative h-[340px] sm:h-[360px] rounded-xl bg-gradient-to-b from-[#FAF8F5] to-[#F3ECE2] border border-[#EFEAE3] flex items-center justify-center overflow-hidden py-3">
            <div
              className="absolute w-52 h-[305px] rounded-t-full bg-white/70 border border-[#E6DDD0]"
              aria-hidden="true"
            />
            <div
              className="absolute bottom-5 w-36 h-4 rounded-full bg-[#D8CEC0]/45 blur-[2px]"
              aria-hidden="true"
            />
            <canvas
              ref={fxCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
              aria-hidden="true"
            />

            <div className="relative z-10 w-[185px] h-[335px]">
              <MeDollSvg
                equipped={equipped}
                skinTone={skinTone}
                avatarGender={avatarGender}
                deletedItemIds={deletedItemIds}
                enableIdle
              />
            </div>
          </div>

          {/* Barra Horizontal Compacta com Peças Vestidas (1 clique para remover) */}
          <div className="pt-1">
            {activeLayers.length === 0 ? (
              <p className="text-[11px] text-[#78716C] py-1">
                Nenhuma peça vestida no momento. Clique nas peças do guarda-roupa ao lado.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeLayers.map(({ category, item }) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-[#FAF8F5] border border-[#E6E0D8] text-[11px] text-[#1C1917]"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                      style={{ backgroundColor: item.swatchColor }}
                    />
                    <span className="font-medium max-w-[125px] truncate">{item.name}</span>
                    <button
                      type="button"
                      onClick={() => onUnequipCategory(category)}
                      title={`Remover ${item.name}`}
                      aria-label={`Remover ${item.name}`}
                      className="p-0.5 text-[#78716C] hover:text-[#C8235D] rounded transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Ações Rápidas no Rodapé */}
          <div className="pt-2.5 border-t border-[#EFEAE3] flex items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={onGoToProfile}
              className="inline-flex items-center gap-1.5 font-semibold text-[#1C1917] hover:text-[#C8235D] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              Meu Perfil / Conta
            </button>
            <button
              type="button"
              onClick={onGoToShop}
              className="inline-flex items-center gap-1.5 font-semibold text-[#C8235D] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Explorar Starplaza
            </button>
          </div>
        </section>

        {/* Coluna Direita: Guarda-Roupa Organizado por Categorias (7 colunas) */}
        <aside className="lg:col-span-7 bg-white border border-[#E6E0D8] rounded-xl p-4 sm:p-5 flex flex-col">
          <div className="pb-3.5 border-b border-[#EFEAE3] space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-xl font-bold text-[#1C1917]">
                Guarda-Roupa
              </h3>
              <span className="text-xs text-[#6B645D] font-mono-num">
                {wardrobeItems.length} de {totalOwnedCount} peças
              </span>
            </div>

            {/* Abas de Categorias em Destaque */}
            <div
              className="flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Categorias do guarda-roupa"
            >
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                const label = cat === 'todas' ? 'Tudo' : CATEGORY_LABELS[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#1C1917] text-white'
                        : 'bg-[#F5F2EC] text-[#57534E] hover:bg-[#EAE4DA] hover:text-[#1C1917]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Filtro Secundário por Caimento/Gênero */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'todos', label: 'Todos os Estilos' },
                  { id: 'compativel', label: 'Para este Corpo' },
                  { id: 'feminino', label: 'Feminino' },
                  { id: 'masculino', label: 'Masculino' },
                  { id: 'unissex', label: 'Unissex' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setWardrobeGenderFilter(opt.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    wardrobeGenderFilter === opt.id
                      ? 'border-[#C8235D] bg-[#FDF2F5] text-[#9E1646]'
                      : 'border-[#E6E0D8] bg-[#FAF8F5] text-[#6B645D] hover:text-[#1C1917]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3.5 max-h-[420px] overflow-y-auto pr-1">
            {wardrobeItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <p className="text-sm font-medium text-[#44403C]">
                  Nenhuma peça nesta categoria ainda.
                </p>
                <p className="text-xs text-[#78716C] mt-1 mb-4">
                  Visite a Starplaza para adquirir novos itens com suas Starcoins.
                </p>
                <button
                  type="button"
                  onClick={onGoToShop}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors cursor-pointer"
                >
                  Ir para a Starplaza
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {wardrobeItems.map((item) => {
                  const isEquipped = equipped[item.category] === item.id;
                  const itemGender = item.gender ?? item.genderStyle ?? 'unissex';
                  const isCompatible = isItemCompatibleWithGender(itemGender, avatarGender);
                  const isVipLocked = Boolean(item.isVipOnly) && !isAccountVip;
                  const blocked = !isCompatible || isVipLocked;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={blocked && !isEquipped}
                      onClick={() => onToggleEquip(item)}
                      title={
                        isVipLocked
                          ? 'Exclusivo Assinantes VIP'
                          : !isCompatible
                            ? `Peça exclusiva para corpo ${GENDER_STYLE_LABEL[itemGender]}`
                            : undefined
                      }
                      className={`group text-left rounded-xl border p-2.5 transition-all flex flex-col justify-between ${
                        blocked && !isEquipped
                          ? 'border-[#E6E0D8] bg-[#FAF8F5]/60 opacity-60 cursor-not-allowed'
                          : isEquipped
                            ? 'border-[#C8235D] bg-[#C8235D]/[0.04] cursor-pointer'
                            : 'border-[#E6E0D8] bg-[#FAF8F5] hover:border-[#C7BEB2] hover:bg-white cursor-pointer'
                      }`}
                    >
                      <div className="relative flex items-center justify-center h-24 bg-white rounded-lg border border-[#EFEAE3] mb-2 overflow-hidden">
                        <ItemPreviewSvg
                          item={item}
                          previewGender={avatarGender}
                          className="w-22 h-22 transition-transform duration-200 group-hover:scale-105"
                        />
                        {item.isVipOnly && (
                          <div className="absolute top-1 left-1 flex flex-wrap items-center gap-1">
                            <VipBadge compact />
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-[#1C1917] line-clamp-1">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-[#6B645D] mt-0.5 truncate">
                          {CATEGORY_LABELS[item.category]} · {GENDER_STYLE_LABEL[itemGender]}
                        </p>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-[#EFEAE3] flex items-center justify-between text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            blocked && !isEquipped
                              ? 'text-[#78716C]'
                              : isEquipped
                                ? 'text-[#C8235D]'
                                : 'text-[#44403C]'
                          }`}
                        >
                          {blocked && !isEquipped && <Lock className="w-3 h-3" />}
                          {isVipLocked
                            ? 'VIP'
                            : !isCompatible
                              ? 'Incompatível'
                              : isEquipped
                                ? 'Vestida'
                                : 'Vestir'}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: item.swatchColor }}
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
