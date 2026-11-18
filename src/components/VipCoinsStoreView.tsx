import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Crown,
  Gem,
  ImagePlus,
  Send,
  ShoppingBag,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  ClothingItem,
  PremiumOrder,
  PremiumOrderType,
  UserAccount,
} from '../types/game';
import { useGlobalState } from '../core/state/GlobalStateManager';
import { soundEngine } from '../utils/sound';
import { VipBadge } from './StaffDirectory';
import { ThreeClothingThumbnail } from './three/ThreeItemThumbnail';

interface VipCoinsStoreViewProps {
  currentUser: UserAccount;
  starcoins: number;
  isAccountVip: boolean;
  legendaryCatalog: ClothingItem[];
  onGoToStarplaza: () => void;
}

interface SelectedCheckoutPack {
  packId: string;
  packTitle: string;
  priceLabel: string;
  orderType: PremiumOrderType;
  amAmount: number;
  bonusAmAmount: number;
}

const VIP_PLANS = [
  {
    id: 'vip_mensal',
    title: 'Passe VIP Mensal',
    duration: '30 dias de privilégios',
    priceLabel: 'R$ 19,90',
    bonusAm: 400,
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
    bonusAm: 1400,
    highlight: true,
    perks: [
      'Tudo do Passe Mensal + bônus de 1.400 AM',
      'Prioridade nas coleções semanais do Designer Global',
      'Desbloqueio instantâneo de coroas, cetros e joias',
    ],
  },
  {
    id: 'vip_vitalicio',
    title: 'Passe Maison Royale Vitalício',
    duration: 'Acesso permanente',
    priceLabel: 'R$ 169,90',
    bonusAm: 3500,
    highlight: false,
    perks: [
      'Status VIP permanente na conta sem renovação',
      '+3.500 AM creditados após validação',
      'Acesso garantido a todos os lançamentos lendários futuros',
    ],
  },
];

const AM_PACKAGES = [
  {
    id: 'am_500',
    title: 'Bolsa Atelier',
    amount: 500,
    priceLabel: 'R$ 7,90',
    note: 'Ideal para acessórios e tendências Y2K',
  },
  {
    id: 'am_1500',
    title: 'Cofre Starlight',
    amount: 1500,
    priceLabel: 'R$ 19,90',
    note: 'Inclui margem para móveis e vestidos',
  },
  {
    id: 'am_4000',
    title: 'Baú Alta Costura',
    amount: 4000,
    priceLabel: 'R$ 44,90',
    note: 'Monte coleções completas e suítes luxuosas',
  },
  {
    id: 'am_10000',
    title: 'Tesouro Soberano',
    amount: 10000,
    priceLabel: 'R$ 94,90',
    note: 'Saldo máximo para itens lendários VIP',
  },
];

/** Comprime comprovante enviado pelo jogador antes de enviar ao servidor */
async function compressReceiptImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo do comprovante.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.onload = () => {
        const maxWidth = 600;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponível.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export const VipCoinsStoreView: React.FC<VipCoinsStoreViewProps> = ({
  currentUser,
  starcoins,
  isAccountVip,
  legendaryCatalog,
  onGoToStarplaza,
}) => {
  const {
    premiumOrders,
    premiumPixConfig,
    refreshPremiumOrders,
    refreshPremiumPixConfig,
  } = useGlobalState();

  const [selectedPack, setSelectedPack] = useState<SelectedCheckoutPack | null>(null);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string>('');
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutSuccessMsg, setCheckoutSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [orderChatInputs, setOrderChatInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    void refreshPremiumOrders();
    void refreshPremiumPixConfig();
  }, [refreshPremiumOrders, refreshPremiumPixConfig]);

  const activePixKey = premiumPixConfig.pixKey || '7198826894';

  const myOrders = useMemo(
    () =>
      premiumOrders.filter(
        (o) =>
          o.requesterAccountId === currentUser.id ||
          o.requesterUsername.toLowerCase() === currentUser.username.toLowerCase(),
      ),
    [currentUser.id, currentUser.username, premiumOrders],
  );

  const showcaseLegendary = useMemo(
    () => legendaryCatalog.filter((item) => item.isLegendary || item.isVipOnly).slice(0, 4),
    [legendaryCatalog],
  );

  const handleOpenPackCheckout = (pack: SelectedCheckoutPack) => {
    setSelectedPack(pack);
    setReceiptDataUrl('');
    setCheckoutMessage('');
    setErrorMsg(null);
    setCheckoutSuccessMsg(null);
    setPixCopied(false);
  };

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(activePixKey);
      setPixCopied(true);
      window.setTimeout(() => setPixCopied(false), 2500);
    } catch {
      setPixCopied(false);
    }
  };

  const handleReceiptSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    try {
      const compressed = await compressReceiptImage(file);
      setReceiptDataUrl(compressed);
    } catch {
      setErrorMsg('Não foi possível processar a imagem do comprovante. Tente outra imagem.');
    }
  };

  const handleSubmitPremiumOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPack || submitting) return;
    if (!receiptDataUrl && !checkoutMessage.trim()) {
      setErrorMsg('Anexe o comprovante PIX ou envie os dados do pagamento no chat.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/premium-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterAccountId: currentUser.id,
          requesterUsername: currentUser.username,
          requesterDisplayName: currentUser.displayName || currentUser.username,
          packId: selectedPack.packId,
          packTitle: selectedPack.packTitle,
          priceLabel: selectedPack.priceLabel,
          orderType: selectedPack.orderType,
          amAmount: selectedPack.amAmount,
          bonusAmAmount: selectedPack.bonusAmAmount,
          receiptImageUrl: receiptDataUrl || undefined,
          initialMessage:
            checkoutMessage.trim() ||
            `Pagamento PIX realizado para ${selectedPack.packTitle} (${selectedPack.priceLabel}).`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        order?: PremiumOrder;
      };
      if (data.ok && data.order) {
        soundEngine.playPurchase();
        setCheckoutSuccessMsg('Analisaremos seu pedido chega em 24 horas');
        setSelectedPack(null);
        setReceiptDataUrl('');
        setCheckoutMessage('');
        await refreshPremiumOrders();
      } else {
        setErrorMsg(data.error || 'Falha ao enviar pedido.');
      }
    } catch {
      setErrorMsg('Erro de conexão ao registrar pedido na Loja Premium.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOrderFollowUp = async (order: PremiumOrder) => {
    const text = (orderChatInputs[order.id] || '').trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/premium-orders/${order.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          senderName: currentUser.displayName || currentUser.username,
          actorId: currentUser.id,
        }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        setOrderChatInputs((prev) => ({ ...prev, [order.id]: '' }));
        await refreshPremiumOrders();
      }
    } finally {
      setSubmitting(false);
    }
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
                Loja Premium · Moedas AM &amp; VIP
              </h2>
              {isAccountVip && <VipBadge />}
            </div>
            <p className="text-sm text-[#57534E] mt-0.5 max-w-2xl">
              Escolha um pacote de moedas AM ou assinatura VIP, realize o pagamento via PIX para a chave do Community Manager e envie o comprovante no chat do pedido para liberação direta na sua conta.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] flex items-center gap-2.5">
            <Coins className="w-4 h-4 text-[#C6922B]" />
            <div>
              <p className="text-[11px] text-[#6B645D] leading-none">Seu Saldo Atual</p>
              <p className="font-mono-num text-base font-bold text-[#1C1917] mt-0.5">
                {starcoins.toLocaleString('pt-BR')} AM
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

      {checkoutSuccessMsg && (
        <div
          role="status"
          className="px-4 py-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-sm font-bold text-emerald-900 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{checkoutSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutSuccessMsg(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Fechar
          </button>
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
              Clique em qualquer plano para abrir a tela PIX e enviar seu comprovante ao Community Manager
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
                    +{plan.bonusAm.toLocaleString('pt-BR')} AM bônus
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
                onClick={() =>
                  handleOpenPackCheckout({
                    packId: plan.id,
                    packTitle: plan.title,
                    priceLabel: plan.priceLabel,
                    orderType: 'vip',
                    amAmount: 0,
                    bonusAmAmount: plan.bonusAm,
                  })
                }
                className={`mt-6 w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  isAccountVip
                    ? 'bg-[#1C1917] hover:bg-[#332E2B] text-white'
                    : 'bg-[#B45309] hover:bg-[#92400E] text-white'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                {isAccountVip
                  ? `Renovar VIP & +${plan.bonusAm.toLocaleString('pt-BR')} AM`
                  : 'Comprar VIP via PIX'}
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Pacotes de Moedas AM */}
      <section className="space-y-3">
        <div>
          <h3 className="font-display text-2xl font-bold text-[#1C1917]">
            Pacotes de Moedas AM
          </h3>
          <p className="text-xs text-[#6B645D]">
            Escolha um pacote abaixo para abrir a tela de pagamento PIX com o Community Manager
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AM_PACKAGES.map((pack) => (
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
                  +{pack.amount.toLocaleString('pt-BR')} AM
                </p>
                <p className="text-xs text-[#6B645D] mt-1 leading-relaxed">{pack.note}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#EFEAE3] flex items-center justify-between gap-2">
                <span className="font-mono-num text-xs font-bold text-[#1C1917]">
                  {pack.priceLabel}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleOpenPackCheckout({
                      packId: pack.id,
                      packTitle: pack.title,
                      priceLabel: pack.priceLabel,
                      orderType: 'am_pack',
                      amAmount: pack.amount,
                      bonusAmAmount: 0,
                    })
                  }
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors cursor-pointer"
                >
                  Escolher Pacote
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Meus Pedidos na Loja Premium & Chat com Community Manager */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
          <div>
            <h3 className="text-base font-bold text-[#1C1917]">
              Meus Pedidos na Loja Premium ({myOrders.length})
            </h3>
            <p className="text-xs text-[#6B645D]">
              Acompanhe o status da análise do seu comprovante e converse com o Community Manager.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-[#44403C] bg-[#FAF8F5] px-3 py-1 rounded-lg border border-[#E6E0D8]">
            Chave PIX oficial: {activePixKey}
          </span>
        </div>

        {myOrders.length === 0 ? (
          <p className="text-xs text-[#6B645D]">
            Você ainda não possui pedidos registrados na Loja Premium. Clique em qualquer pacote acima para iniciar.
          </p>
        ) : (
          <div className="space-y-3">
            {myOrders.map((order) => {
              const totalAm = order.amAmount + (order.bonusAmAmount || 0);
              const badge =
                order.status === 'credited'
                  ? { label: 'Creditado na Conta', cls: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2 }
                  : order.status === 'rejected'
                    ? { label: 'Recusado', cls: 'bg-rose-100 text-rose-800', Icon: Clock }
                    : { label: 'Analisaremos seu pedido chega em 24 horas', cls: 'bg-amber-100 text-amber-900', Icon: Clock };
              const StatusIcon = badge.Icon;

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#1C1917]">
                        {order.packTitle} · {order.priceLabel}{' '}
                        <span className="text-[#C8235D]">
                          ({order.orderType === 'vip' ? 'VIP + ' : ''}
                          +{totalAm.toLocaleString('pt-BR')} AM)
                        </span>
                      </p>
                      <p className="text-[10px] font-mono text-[#78716C]">
                        Pedido #{order.id} · PIX: {order.pixKeyUsed}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${badge.cls}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {badge.label}
                    </span>
                  </div>

                  {order.receiptImageUrl && (
                    <div>
                      <img
                        src={order.receiptImageUrl}
                        alt="Comprovante PIX enviado"
                        className="h-24 rounded-lg border border-[#E6E0D8] object-contain bg-white"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 bg-white border border-[#EFEAE3] rounded-lg p-3 max-h-36 overflow-y-auto">
                    {order.messages.map((m) => (
                      <div key={m.id} className="text-xs text-[#44403C]">
                        <strong className={m.senderRole === 'player' ? 'text-[#C8235D]' : 'text-[#0284C7]'}>
                          {m.senderName}:
                        </strong>{' '}
                        {m.text}
                      </div>
                    ))}
                  </div>

                  {order.status === 'pending' && (
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={orderChatInputs[order.id] ?? ''}
                        onChange={(e) =>
                          setOrderChatInputs((prev) => ({
                            ...prev,
                            [order.id]: e.target.value,
                          }))
                        }
                        placeholder="Enviar mensagem adicional sobre o pagamento..."
                        className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-white border border-[#E6E0D8] rounded-lg"
                      />
                      <button
                        type="button"
                        disabled={submitting || !(orderChatInputs[order.id] || '').trim()}
                        onClick={() => void handleSendOrderFollowUp(order)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] disabled:opacity-50 rounded-lg cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        Enviar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
                    : 'Todos podem visualizar os detalhes abaixo; adquira qualquer Plano VIP acima para equipá-los.'}
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
                <div className="w-24 h-28 flex items-center justify-center">
                  <ThreeClothingThumbnail item={item} className="w-24 h-28 object-contain" />
                </div>
                <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] text-[10px] font-bold">
                  Lendário VIP
                </span>
                <p className="text-xs font-semibold text-[#1C1917] mt-1.5 line-clamp-1">
                  {item.name}
                </p>
                <p className="font-mono-num text-[11px] text-[#78350F] mt-0.5">
                  {item.price} AM
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pequena Tela de Pagamento PIX + Envio de Comprovante */}
      {selectedPack && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pagamento PIX Loja Premium"
        >
          <form
            onSubmit={(e) => void handleSubmitPremiumOrder(e)}
            className="bg-white border border-[#E6E0D8] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
              <div>
                <h3 className="font-display text-lg font-bold text-[#1C1917]">
                  Pagamento PIX · Loja Premium
                </h3>
                <p className="text-xs text-[#57534E] mt-0.5">
                  {selectedPack.packTitle} — <strong>{selectedPack.priceLabel}</strong> (
                  {selectedPack.orderType === 'vip' ? 'VIP + ' : ''}
                  +{(selectedPack.amAmount + selectedPack.bonusAmAmount).toLocaleString('pt-BR')} AM)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPack(null)}
                className="text-xs font-bold text-[#6B645D] hover:text-[#1C1917] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {errorMsg}
              </div>
            )}

            {/* Bloco Chave PIX do Community Manager */}
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B645D]">
                Chave PIX do Community Manager
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-base font-bold text-[#1C1917] select-all">
                  {activePixKey}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyPix()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#D6CEC2] hover:border-[#C8235D] rounded-lg cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  {pixCopied ? 'Copiada!' : 'Copiar PIX'}
                </button>
              </div>
              <p className="text-[11px] text-[#57534E]">
                Efetue o PIX no valor de <strong>{selectedPack.priceLabel}</strong> e anexe o comprovante abaixo.
              </p>
            </div>

            {/* Upload de Comprovante */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[#44403C]">
                Comprovante de Pagamento (Imagem)
              </span>
              <label className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-dashed border-[#C7BEB2] bg-[#FAF8F5] hover:border-[#C8235D] cursor-pointer text-center">
                {receiptDataUrl ? (
                  <img
                    src={receiptDataUrl}
                    alt="Prévia do comprovante PIX"
                    className="max-h-36 object-contain rounded"
                  />
                ) : (
                  <>
                    <ImagePlus className="w-5 h-5 text-[#C8235D]" />
                    <span className="text-xs font-semibold text-[#1C1917]">
                      Clique para anexar o comprovante PIX
                    </span>
                    <span className="text-[10px] text-[#6B645D]">
                      PNG, JPG ou WebP
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleReceiptSelect(e)}
                  className="hidden"
                />
              </label>
            </div>

            {/* Chat do Comprovante */}
            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">
                Mensagem no chat para o Community Manager
              </span>
              <textarea
                rows={2}
                value={checkoutMessage}
                onChange={(e) => setCheckoutMessage(e.target.value)}
                placeholder="Ex: PIX enviado às 14h30 pela conta..."
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg resize-none"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedPack(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:opacity-50 rounded-lg cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {submitting ? 'Enviando...' : 'Enviar Comprovante no Chat'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
