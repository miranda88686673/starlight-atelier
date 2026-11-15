import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Crown,
  Image as ImageIcon,
  KeyRound,
  LifeBuoy,
  MessageSquareText,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import type {
  PremiumOrder,
  SupportTicket,
  UserAccount,
} from '../../types/game';
import { useGlobalState } from '../../core/state/GlobalStateManager';
import { resolveCoreStaffRole } from '../../core/security/RoleGuard';

interface CommunityDevOpsPanelProps {
  currentUser: UserAccount;
}

export const CommunityDevOpsPanel: React.FC<CommunityDevOpsPanelProps> = ({
  currentUser,
}) => {
  const {
    supportTickets,
    premiumOrders,
    premiumPixConfig,
    refreshSupportTickets,
    refreshPremiumOrders,
    refreshPremiumPixConfig,
  } = useGlobalState();

  const [section, setSection] = useState<'tickets' | 'loja_premium'>('tickets');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'answered' | 'resolved'>('all');
  const [orderFilter, setOrderFilter] = useState<'pending' | 'credited' | 'rejected' | 'all'>('pending');

  const [ticketReplyById, setTicketReplyById] = useState<Record<string, string>>({});
  const [orderReplyById, setOrderReplyById] = useState<Record<string, string>>({});
  const [pixKeyInput, setPixKeyInput] = useState(premiumPixConfig.pixKey || '7198826894');
  const [zoomedReceiptUrl, setZoomedReceiptUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    void refreshSupportTickets();
    void refreshPremiumOrders();
    void refreshPremiumPixConfig();
  }, [refreshPremiumOrders, refreshPremiumPixConfig, refreshSupportTickets]);

  useEffect(() => {
    if (premiumPixConfig.pixKey) {
      setPixKeyInput(premiumPixConfig.pixKey);
    }
  }, [premiumPixConfig.pixKey]);

  const role = resolveCoreStaffRole(currentUser) || 'cm';
  const staffHeaders = {
    'Content-Type': 'application/json',
    'x-actor-id': currentUser.id,
    'x-staff-role': role,
    'x-actor-email': currentUser.email,
  };
  const actorName = currentUser.displayName || currentUser.username || 'Community Manager';

  const openTicketCount = useMemo(
    () => supportTickets.filter((t) => t.status === 'open').length,
    [supportTickets],
  );
  const pendingOrderCount = useMemo(
    () => premiumOrders.filter((o) => o.status === 'pending').length,
    [premiumOrders],
  );

  const filteredTickets = useMemo(() => {
    if (ticketFilter === 'all') return supportTickets;
    return supportTickets.filter((t) => t.status === ticketFilter);
  }, [supportTickets, ticketFilter]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return premiumOrders;
    return premiumOrders.filter((o) => o.status === orderFilter);
  }, [orderFilter, premiumOrders]);

  const handleSendTicketReply = async (ticket: SupportTicket) => {
    const text = (ticketReplyById[ticket.id] || '').trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/reply`, {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({
          text,
          senderName: actorName,
          senderRole: role === 'admin' ? 'admin' : 'cm',
          actorId: currentUser.id,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setTicketReplyById((prev) => ({ ...prev, [ticket.id]: '' }));
        setFeedback(
          `Resposta salva no Ticket #${ticket.id.slice(-8)}! O jogador já pode visualizá-la.`,
        );
        await refreshSupportTickets();
      } else {
        setFeedback(data.error || 'Erro ao responder Ticket.');
      }
    } catch {
      setFeedback('Erro de conexão ao responder Ticket.');
    } finally {
      setBusy(false);
    }
  };

  const handleResolveTicket = async (ticket: SupportTicket) => {
    if (busy) return;
    setBusy(true);
    try {
      const optionalReply = (ticketReplyById[ticket.id] || '').trim();
      const res = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: staffHeaders,
        body: JSON.stringify({
          replyText: optionalReply || undefined,
          status: 'resolved',
          cmUsername: actorName,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setTicketReplyById((prev) => ({ ...prev, [ticket.id]: '' }));
        setFeedback(`Ticket #${ticket.id.slice(-8)} marcado como resolvido (histórico preservado).`);
        await refreshSupportTickets();
      } else {
        setFeedback(data.error || 'Erro ao atualizar status do Ticket.');
      }
    } catch {
      setFeedback('Falha de rede ao encerrar Ticket.');
    } finally {
      setBusy(false);
    }
  };

  const handleSavePixKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pixKeyInput.trim();
    if (!cleaned || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/premium-pix-config', {
        method: 'PUT',
        headers: staffHeaders,
        body: JSON.stringify({
          pixKey: cleaned,
          actorUsername: actorName,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setFeedback(`Chave PIX da Loja Premium atualizada para "${cleaned}".`);
        await refreshPremiumPixConfig();
      } else {
        setFeedback(data.error || 'Erro ao salvar chave PIX.');
      }
    } catch {
      setFeedback('Erro de conexão ao salvar chave PIX.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendOrderChat = async (order: PremiumOrder) => {
    const text = (orderReplyById[order.id] || '').trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/premium-orders/${order.id}/message`, {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({
          text,
          senderName: actorName,
          actorId: currentUser.id,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setOrderReplyById((prev) => ({ ...prev, [order.id]: '' }));
        setFeedback(`Mensagem enviada no chat do pedido #${order.id.slice(-8)}.`);
        await refreshPremiumOrders();
      } else {
        setFeedback(data.error || 'Não foi possível enviar mensagem no pedido.');
      }
    } catch {
      setFeedback('Erro de rede ao responder chat do pedido.');
    } finally {
      setBusy(false);
    }
  };

  const handleDecideOrder = async (
    order: PremiumOrder,
    decision: 'credit' | 'reject',
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const note = (orderReplyById[order.id] || '').trim() || undefined;
      const res = await fetch(`/api/premium-orders/${order.id}/decide`, {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({
          decision,
          note,
          actorUsername: actorName,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setOrderReplyById((prev) => ({ ...prev, [order.id]: '' }));
        setFeedback(
          decision === 'credit'
            ? `Pedido #${order.id.slice(-8)} aprovado! ${
                order.orderType === 'vip'
                  ? `Status VIP + ${(order.amAmount + (order.bonusAmAmount || 0)).toLocaleString('pt-BR')} AM`
                  : `${(order.amAmount + (order.bonusAmAmount || 0)).toLocaleString('pt-BR')} AM`
              } creditado diretamente na conta de @${order.requesterUsername}.`
            : `Pedido #${order.id.slice(-8)} recusado e jogador notificado no chat.`,
        );
        await refreshPremiumOrders();
      } else {
        setFeedback(data.error || 'Não foi possível processar a decisão.');
      }
    } catch {
      setFeedback('Erro de conexão ao creditar/recusar pedido.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Exclusivo do Community Manager */}
      <div className="bg-[#0F172A] text-white rounded-xl p-5 border border-[#38BDF8]/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0284C7]/30 border border-[#38BDF8]/60 flex items-center justify-center shrink-0">
            <MessageSquareText className="w-5 h-5 text-[#38BDF8]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-bold text-white">
                Estação Community Manager · Tickets &amp; Loja Premium
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-400 text-[#1C1917]">
                {openTicketCount} Ticket(s) em aberto
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-400 text-[#06281E]">
                {pendingOrderCount} Pedido(s) PIX pendente(s)
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Responda aos Tickets enviados pela tela inicial e dentro do jogo, anexe a chave PIX oficial e credite AM ou VIP diretamente nas contas após conferir o comprovante.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void refreshSupportTickets();
            void refreshPremiumOrders();
            void refreshPremiumPixConfig();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sincronizar Central
        </button>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-xs font-medium text-[#0C4A6E] flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-bold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Alternador das 2 Funções Exclusivas do Community Manager */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSection('tickets')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
            section === 'tickets'
              ? 'bg-[#0284C7] text-white border-[#0284C7]'
              : 'bg-white text-[#44403C] border-[#E6E0D8] hover:border-[#0284C7]'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          Tickets (Login &amp; Jogo)
          {openTicketCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white/20 rounded">
              {openTicketCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSection('loja_premium')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
            section === 'loja_premium'
              ? 'bg-[#C8235D] text-white border-[#C8235D]'
              : 'bg-white text-[#44403C] border-[#E6E0D8] hover:border-[#C8235D]'
          }`}
        >
          <Coins className="w-4 h-4" />
          Loja Premium · PIX &amp; Crédito AM/VIP
          {pendingOrderCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white/20 rounded">
              {pendingOrderCount}
            </span>
          )}
        </button>
      </div>

      {/* SEÇÃO 1: TICKETS (TELA INICIAL + IN-GAME) */}
      {section === 'tickets' && (
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-[#0284C7]" />
                Tickets Salvos (Tela Inicial &amp; Jogo)
              </h4>
              <p className="text-xs text-[#6B645D]">
                Todas as perguntas dos jogadores e respostas do Community Manager ficam salvas para ambos visualizarem.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: `Todos (${supportTickets.length})` },
                  { id: 'open', label: 'Abertos' },
                  { id: 'answered', label: 'Respondidos' },
                  { id: 'resolved', label: 'Resolvidos' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTicketFilter(f.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border cursor-pointer ${
                    ticketFilter === f.id
                      ? 'bg-[#1C1917] text-white border-[#1C1917]'
                      : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3] text-xs text-[#6B645D]">
              Nenhum Ticket nesta categoria até o momento.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => {
                const badge =
                  ticket.status === 'resolved'
                    ? { label: 'Resolvido', cls: 'bg-emerald-100 text-emerald-800' }
                    : ticket.status === 'answered'
                      ? { label: 'Respondido', cls: 'bg-sky-100 text-sky-800' }
                      : { label: 'Aguardando Resposta', cls: 'bg-amber-200 text-amber-900' };

                return (
                  <div
                    key={ticket.id}
                    className={`p-4 rounded-xl border ${
                      ticket.status === 'open'
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-[#FAF8F5] border-[#E6E0D8]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-[#1C1917]">
                          @{ticket.requesterUsername} · {ticket.subject}
                        </span>
                        <span className="ml-2 text-[10px] font-mono text-[#78716C]">
                          #{ticket.id} ({ticket.category || 'geral'} · {ticket.serverRegion || 'BR'})
                        </span>
                        {ticket.email && (
                          <span className="ml-2 text-[10px] text-[#57534E]">
                            · {ticket.email}
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="mt-3 max-h-52 overflow-y-auto space-y-2 p-3 rounded-lg bg-white border border-[#EFEAE3]">
                      {ticket.messages.map((m) => {
                        const isPlayer = m.senderRole === 'player';
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isPlayer ? 'items-start' : 'items-end'}`}
                          >
                            <span className="text-[10px] font-semibold text-[#6B645D] mb-0.5">
                              {m.senderName} ·{' '}
                              {new Date(m.createdAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <div
                              className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs ${
                                isPlayer
                                  ? 'bg-[#FAF8F5] border border-[#E6E0D8] text-[#1C1917]'
                                  : 'bg-[#0284C7] text-white'
                              }`}
                            >
                              {m.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={ticketReplyById[ticket.id] ?? ''}
                        onChange={(e) =>
                          setTicketReplyById((prev) => ({
                            ...prev,
                            [ticket.id]: e.target.value,
                          }))
                        }
                        placeholder="Responder ao jogador (ficará salvo para ambos)..."
                        className="flex-1 min-w-[220px] px-3 py-2 text-xs bg-white border border-[#E6E0D8] rounded-lg"
                      />
                      <button
                        type="button"
                        disabled={busy || !(ticketReplyById[ticket.id] || '').trim()}
                        onClick={() => void handleSendTicketReply(ticket)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 rounded-lg cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Enviar Resposta
                      </button>
                      {ticket.status !== 'resolved' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleResolveTicket(ticket)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] disabled:opacity-50 rounded-lg cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Marcar Resolvido
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SEÇÃO 2: LOJA PREMIUM (CHAVE PIX + COMPROVANTES + CREDITO DIRETO AM/VIP) */}
      {section === 'loja_premium' && (
        <div className="space-y-6">
          {/* Anexar Chave PIX */}
          <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#C8235D]" />
                  Chave PIX Anexada na Loja Premium
                </h4>
                <p className="text-xs text-[#6B645D]">
                  Esta chave PIX aparece automaticamente para os jogadores ao clicar em qualquer pacote de AM ou plano VIP.
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-mono font-bold bg-[#FFF5F8] text-[#C8235D] border border-[#FBCFE8] rounded-lg">
                Ativa: {premiumPixConfig.pixKey || '7198826894'}
              </span>
            </div>

            <form onSubmit={(e) => void handleSavePixKey(e)} className="flex flex-wrap gap-2">
              <input
                type="text"
                required
                value={pixKeyInput}
                onChange={(e) => setPixKeyInput(e.target.value)}
                placeholder="Ex: 7198826894"
                className="flex-1 min-w-[220px] px-3 py-2 text-xs font-mono bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
              <button
                type="submit"
                disabled={busy || !pixKeyInput.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] disabled:opacity-50 rounded-lg cursor-pointer"
              >
                Anexar / Salvar Chave PIX
              </button>
            </form>
          </section>

          {/* Pedidos dos Jogadores + Chat + Comprovante + Crédito */}
          <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#C6922B]" />
                  Pedidos da Loja Premium (Comprovantes &amp; Liberação)
                </h4>
                <p className="text-xs text-[#6B645D]">
                  Analise o comprovante PIX enviado no chat do pedido e credite a moeda AM ou status VIP diretamente na conta do jogador.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'pending', label: `Pendentes (${pendingOrderCount})` },
                    { id: 'credited', label: 'Creditados' },
                    { id: 'rejected', label: 'Recusados' },
                    { id: 'all', label: `Todos (${premiumOrders.length})` },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrderFilter(f.id)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border cursor-pointer ${
                      orderFilter === f.id
                        ? 'bg-[#C8235D] text-white border-[#C8235D]'
                        : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3] text-xs text-[#6B645D]">
                Nenhum pedido encontrado neste filtro.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const totalAm = order.amAmount + (order.bonusAmAmount || 0);
                  const statusBadge =
                    order.status === 'credited'
                      ? { label: 'Creditado na Conta', cls: 'bg-emerald-100 text-emerald-800' }
                      : order.status === 'rejected'
                        ? { label: 'Recusado', cls: 'bg-rose-100 text-rose-800' }
                        : { label: 'Aguardando Análise (24h)', cls: 'bg-amber-200 text-amber-900' };

                  return (
                    <article
                      key={order.id}
                      className={`p-4 rounded-xl border space-y-3 ${
                        order.status === 'pending'
                          ? 'bg-amber-50/40 border-amber-300'
                          : 'bg-[#FAF8F5] border-[#E6E0D8]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#1C1917]">
                              @{order.requesterUsername}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#1C1917] text-white">
                              {order.orderType === 'vip' ? 'VIP + AM' : 'Pacote AM'}
                            </span>
                            <span className="text-xs font-semibold text-[#C8235D]">
                              {order.packTitle} ({order.priceLabel})
                            </span>
                          </div>
                          <p className="text-[11px] text-[#57534E] mt-0.5 font-mono">
                            Pedido #{order.id} · PIX: {order.pixKeyUsed} · Benefício:{' '}
                            {order.orderType === 'vip' ? 'Status VIP + ' : ''}
                            {totalAm.toLocaleString('pt-BR')} AM
                          </p>
                        </div>

                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                        {/* Comprovante */}
                        <div className="lg:col-span-4 bg-white border border-[#EFEAE3] rounded-lg p-3 flex flex-col items-center justify-center">
                          {order.receiptImageUrl ? (
                            <button
                              type="button"
                              onClick={() => setZoomedReceiptUrl(order.receiptImageUrl || null)}
                              className="group relative w-full cursor-pointer"
                              title="Clique para ampliar o comprovante"
                            >
                              <img
                                src={order.receiptImageUrl}
                                alt={`Comprovante de @${order.requesterUsername}`}
                                className="w-full max-h-44 object-contain rounded border border-[#E6E0D8]"
                              />
                              <span className="mt-1.5 inline-block text-[10px] font-semibold text-[#0284C7] group-hover:underline">
                                Ampliar comprovante
                              </span>
                            </button>
                          ) : (
                            <div className="py-6 text-center text-xs text-[#78716C] flex flex-col items-center gap-1">
                              <ImageIcon className="w-5 h-5 text-[#A8A29E]" />
                              <span>Sem imagem anexada</span>
                            </div>
                          )}
                        </div>

                        {/* Chat do Pedido */}
                        <div className="lg:col-span-8 flex flex-col bg-white border border-[#EFEAE3] rounded-lg p-3">
                          <p className="text-[11px] font-bold text-[#44403C] mb-2">
                            Chat do Pedido &amp; Comprovantes
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-2 flex-1 pr-1">
                            {order.messages.map((m) => (
                              <div key={m.id} className="text-xs border-b border-[#F5F2ED] pb-1.5 last:border-b-0">
                                <span className="font-bold text-[#1C1917]">{m.senderName}</span>{' '}
                                <span className="text-[10px] text-[#78716C]">
                                  ({new Date(m.createdAt).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })})
                                </span>
                                <p className="text-[#44403C] mt-0.5">{m.text}</p>
                                {m.attachmentImageUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setZoomedReceiptUrl(m.attachmentImageUrl || null)}
                                    className="mt-1 text-[10px] font-semibold text-[#0284C7] hover:underline cursor-pointer"
                                  >
                                    Ver anexo de comprovante
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-[#EFEAE3] flex flex-wrap gap-2">
                            <input
                              type="text"
                              value={orderReplyById[order.id] ?? ''}
                              onChange={(e) =>
                                setOrderReplyById((prev) => ({
                                  ...prev,
                                  [order.id]: e.target.value,
                                }))
                              }
                              placeholder="Mensagem no chat ou observação da decisão..."
                              className="flex-1 min-w-[180px] px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
                            />
                            <button
                              type="button"
                              disabled={busy || !(orderReplyById[order.id] || '').trim()}
                              onClick={() => void handleSendOrderChat(order)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] disabled:opacity-50 rounded-lg cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              Responder Chat
                            </button>
                          </div>
                        </div>
                      </div>

                      {order.status === 'pending' && (
                        <div className="pt-2 border-t border-[#E6E0D8] flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDecideOrder(order, 'reject')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Recusar Pedido
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDecideOrder(order, 'credit')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg cursor-pointer"
                          >
                            {order.orderType === 'vip' ? (
                              <Crown className="w-3.5 h-3.5" />
                            ) : (
                              <Coins className="w-3.5 h-3.5" />
                            )}
                            {order.orderType === 'vip'
                              ? `Ativar VIP + Creditar ${totalAm.toLocaleString('pt-BR')} AM`
                              : `Creditar ${totalAm.toLocaleString('pt-BR')} AM`}
                          </button>
                        </div>
                      )}

                      {order.status !== 'pending' && order.creditedByUsername && (
                        <p className="text-[11px] text-[#57534E]">
                          Processado por <strong>{order.creditedByUsername}</strong>
                          {order.decisionNote ? ` · ${order.decisionNote}` : ''}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Lightbox para ampliar comprovante PIX */}
      {zoomedReceiptUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setZoomedReceiptUrl(null)}
        >
          <div
            className="bg-white rounded-xl p-3 max-w-xl w-full space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1C1917]">
                Comprovante PIX Enviado
              </span>
              <button
                type="button"
                onClick={() => setZoomedReceiptUrl(null)}
                className="text-xs font-bold text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                Fechar ✕
              </button>
            </div>
            <img
              src={zoomedReceiptUrl}
              alt="Comprovante PIX ampliado"
              className="w-full max-h-[75vh] object-contain rounded-lg border border-[#E6E0D8]"
            />
          </div>
        </div>
      )}
    </div>
  );
};
