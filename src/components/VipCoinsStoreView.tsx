import React, { useMemo, useState } from 'react';
import { Check, Coins, Crown, Gem, ShoppingBag, Sparkles } from 'lucide-react';
import { ClothingItem } from '../types/game';
import { VipBadge } from './StaffDirectory';
import { ItemPreviewSvg } from './svg/ItemPreviewSvg';

interface VipCoinsStoreViewProps {
  starcoins: number;
  isAccountVip: boolean;
  legendaryCatalog: ClothingItem[];
  onBuyStarcoinsPack: (amount: number, packTitle: string) => void;
  onActivateVipPlan: (bonusStarcoins: number, planTitle: string) => void;
  onGoToStarplaza: () => void;
}

const VIP_PLANS = [
  {
    id: 'vip_mensal',
    title: 'Passe VIP Mensal',
    duration: '30 dias de privilégios',
    priceLabel: 'R$ 19,90',
    bonusSc: 400,
    highlight: false,
    perks: [
      'Acesso total à Boutique VIP Exclusiva',
      'Desbloqueia compra e uso de Itens Lendários VIP',
      'Selo dourado VIP no perfil, chat e salas',
    ],
  },
  {
    id: 'vip_semestral',
    title: 'Passe VIP Semestral',
    duration: '6 meses de privilégios',
    priceLabel: 'R$ 89,90',
    bonusSc: 1400,
    highlight: true,
    perks: [
      'Tudo do Passe Mensal + bônus de 1.400 StarCoins',
      'Prioridade nas coleções semanais do Designer Global',
      'Desbloqueio instantâneo de coroas, cetros e joias',
    ],
  },
  {
    id: 'vip_vitalicio',
    title: 'Passe Maison Royale Vitalício',
    duration: 'Acesso permanente',
    priceLabel: 'R$ 169,90',
    bonusSc: 3500,
    highlight: false,
    perks: [
      'Status VIP permanente na conta sem renovação',
      '+3.500 StarCoins creditados na hora',
      'Acesso garantido a todos os lançamentos lendários futuros',
    ],
  },
];

const COIN_PACKAGES = [
  {
    id: 'sc_500',
    title: 'Bolsa Atelier',
    amount: 500,
    priceLabel: 'R$ 7,90',
    note: 'Ideal para acessórios e tendências Y2K',
  },
  {
    id: 'sc_1500',
    title: 'Cofre Starlight',
    amount: 1500,
    priceLabel: 'R$ 19,90',
    note: 'Inclui margem para móveis e vestidos',
  },
  {
    id: 'sc_4000',
    title: 'Baú Alta Costura',
    amount: 4000,
    priceLabel: 'R$ 44,90',
    note: 'Monte coleções completas e suítes luxuosas',
  },
  {
    id: 'sc_10000',
    title: 'Tesouro Soberano',
    amount: 10000,
    priceLabel: 'R$ 94,90',
    note: 'Saldo máximo para itens lendários VIP',
  },
];

export const VipCoinsStoreView: React.FC<VipCoinsStoreViewProps> = ({
  starcoins,
  isAccountVip,
  legendaryCatalog,
  onBuyStarcoinsPack,
  onActivateVipPlan,
  onGoToStarplaza,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);

  const showcaseLegendary = useMemo(
    () => legendaryCatalog.filter((item) => item.isLegendary || item.isVipOnly).slice(0, 4),
    [legendaryCatalog],
  );

  const showSuccess = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Financeiro & Status VIP */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FEF3C7] to-[#F59E0B] border border-[#D97706] text-[#78350F] flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-3xl font-bold text-[#1C1917] tracking-tight">
                Loja VIP & Banco de StarCoins
              </h2>
              {isAccountVip && <VipBadge />}
            </div>
            <p className="text-sm text-[#57534E] mt-0.5 max-w-2xl">
              Adquira pacotes de StarCoins ou ative sua Assinatura VIP para desbloquear instantaneamente coroas, cetros reais, joias e coleções exclusivas na Starplaza.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] flex items-center gap-2.5">
            <Coins className="w-4 h-4 text-[#C6922B]" />
            <div>
              <p className="text-[11px] text-[#6B645D] leading-none">Seu Saldo Atual</p>
              <p className="font-mono-num text-base font-bold text-[#1C1917] mt-0.5">
                {starcoins.toLocaleString('pt-BR')} SC
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoToStarplaza}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Explorar Starplaza
          </button>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-[#FFFBEB] border border-[#FCD34D] text-xs font-semibold text-[#78350F] flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-[#D97706] shrink-0" />
          {feedback}
        </div>
      )}

      {/* Planos de Assinatura VIP */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-bold text-[#1C1917]">
              Planos de Assinatura VIP
            </h3>
            <p className="text-xs text-[#6B645D]">
              Liberação imediata na sua conta em todas as salas e vitrines
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
              isAccountVip
                ? 'bg-[#FFFBEB] text-[#78350F] border-[#D97706]'
                : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8]'
            }`}
          >
            {isAccountVip ? 'Assinatura VIP Ativa' : 'Conta Padrão'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {VIP_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`rounded-xl p-6 flex flex-col justify-between transition-colors ${
                plan.highlight
                  ? 'legendary-sheen border-2 shadow-xs'
                  : 'bg-white border border-[#E6E0D8]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#92400E]">
                    {plan.duration}
                  </span>
                  <VipBadge compact />
                </div>
                <h4 className="font-display text-2xl font-bold text-[#1C1917] mt-2">
                  {plan.title}
                </h4>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono-num text-2xl font-bold text-[#1C1917]">
                    {plan.priceLabel}
                  </span>
                  <span className="text-xs font-semibold text-[#B45309] font-mono-num">
                    +{plan.bonusSc.toLocaleString('pt-BR')} SC bônus
                  </span>
                </div>

                <ul className="mt-4 space-y-2 border-t border-[#EFEAE3] pt-4">
                  {plan.perks.map((perk) => (
                    <li
                      key={perk}
                      className="flex items-start gap-2 text-xs text-[#44403C]"
                    >
                      <Check className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  onActivateVipPlan(plan.bonusSc, plan.title);
                  showSuccess(
                    `${plan.title} ativado! Seu passe VIP e +${plan.bonusSc.toLocaleString('pt-BR')} SC já foram creditados.`,
                  );
                }}
                className={`mt-6 w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  isAccountVip
                    ? 'bg-[#1C1917] hover:bg-[#332E2B] text-white'
                    : 'bg-[#B45309] hover:bg-[#92400E] text-white'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                {isAccountVip
                  ? `Renovar & Receber +${plan.bonusSc.toLocaleString('pt-BR')} SC`
                  : 'Ativar Assinatura VIP Agora'}
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Pacotes de Moedas (StarCoins) */}
      <section className="space-y-3">
        <div>
          <h3 className="font-display text-2xl font-bold text-[#1C1917]">
            Pacotes de StarCoins (SC)
          </h3>
          <p className="text-xs text-[#6B645D]">
            Crédito instantâneo para adquirir looks, acessórios e móveis exclusivos
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COIN_PACKAGES.map((pack) => (
            <article
              key={pack.id}
              className="bg-white border border-[#E6E0D8] hover:border-[#C7BEB2] rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#C6922B] flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-[#1C1917] mt-3">{pack.title}</h4>
                <p className="font-mono-num text-xl font-bold text-[#C8235D] mt-1">
                  +{pack.amount.toLocaleString('pt-BR')} SC
                </p>
                <p className="text-xs text-[#6B645D] mt-1 leading-relaxed">{pack.note}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#EFEAE3] flex items-center justify-between gap-2">
                <span className="font-mono-num text-xs font-bold text-[#1C1917]">
                  {pack.priceLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onBuyStarcoinsPack(pack.amount, pack.title);
                    showSuccess(
                      `+${pack.amount.toLocaleString('pt-BR')} StarCoins (${pack.title}) adicionados à sua conta!`,
                    );
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors cursor-pointer"
                >
                  Adquirir
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Prévia da Coleção Lendária VIP */}
      {showcaseLegendary.length > 0 && (
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFEAE3]">
            <div className="flex items-center gap-2.5">
              <Gem className="w-4 h-4 text-[#D97706]" />
              <div>
                <h3 className="text-base font-semibold text-[#1C1917]">
                  Vitrine de Itens Lendários VIP
                </h3>
                <p className="text-xs text-[#6B645D]">
                  {isAccountVip
                    ? 'Seu Passe VIP está ativo — todas estas peças estão liberadas para compra na Starplaza!'
                    : 'Todos podem visualizar os detalhes abaixo; ative qualquer Plano VIP acima para equipá-los.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onGoToStarplaza}
              className="text-xs font-semibold text-[#C8235D] hover:underline cursor-pointer"
            >
              Ver coleção completa na Starplaza →
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {showcaseLegendary.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#FCD34D] bg-[#FFFDF7] p-3 flex flex-col items-center text-center"
              >
                <ItemPreviewSvg item={item} className="w-24 h-28" />
                <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] text-[10px] font-bold">
                  Lendário VIP
                </span>
                <p className="text-xs font-semibold text-[#1C1917] mt-1.5 line-clamp-1">
                  {item.name}
                </p>
                <p className="font-mono-num text-[11px] text-[#78350F] mt-0.5">
                  {item.price} SC
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
