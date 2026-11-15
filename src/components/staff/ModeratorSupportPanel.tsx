import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Flag,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserX,
} from 'lucide-react';
import { GLOBAL_ROOMS } from '../../data/catalog';
import type {
  BanReviewRequest,
  MockUser,
  RoomReportEntry,
  ServerRegion,
  UserAccount,
} from '../../types/game';
import { useGlobalState } from '../../core/state/GlobalStateManager';
import { resolveCoreStaffRole } from '../../core/security/RoleGuard';
import { readRoomsSnapshot } from '../../utils/realtime';

interface ModeratorSupportPanelProps {
  currentUser: UserAccount;
  users: MockUser[];
  reports?: RoomReportEntry[];
  onToggleBanUser: (userId: string, reason?: string) => void;
  onSimulateSentinelChatTest: (input: {
    targetUserId: string;
    server: ServerRegion;
    sampleText: string;
  }) => { ok: boolean; message: string };
}

export const ModeratorSupportPanel: React.FC<ModeratorSupportPanelProps> = ({
  currentUser,
  users,
  reports = [],
  onToggleBanUser,
  onSimulateSentinelChatTest,
}) => {
  const { banReviews, refreshBanReviews } = useGlobalState();

  const [selectedRoomId, setSelectedRoomId] = useState<string>('lounge_party');
  const [roomsSnap, setRoomsSnap] = useState(() => readRoomsSnapshot());
  const [banTargetIdOrUser, setBanTargetIdOrUser] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('Violação das regras de convivência');
  const [sentinelInput, setSentinelInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Abrir pedido manual de revisão de banimento
  const [appealTargetUser, setAppealTargetUser] = useState('');
  const [appealReason, setAppealReason] = useState('');

  useEffect(() => {
    void refreshBanReviews();
    setRoomsSnap(readRoomsSnapshot());
  }, [refreshBanReviews]);

  const role = resolveCoreStaffRole(currentUser) || 'moderator';
  const staffHeaders = {
    'Content-Type': 'application/json',
    'x-actor-id': currentUser.id,
    'x-staff-role': role,
    'x-actor-email': currentUser.email,
  };

  const allRooms = useMemo(
    () => [...GLOBAL_ROOMS, ...(roomsSnap.customRooms ?? [])],
    [roomsSnap.customRooms],
  );
  const roomMessages = roomsSnap.messagesByRoom?.[selectedRoomId] ?? [];

  const handleBanReviewDecision = async (
    review: BanReviewRequest,
    status: 'approved_unban' | 'upheld',
  ) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/ban-reviews/${review.id}`, {
        method: 'PATCH',
        headers: staffHeaders,
        body: JSON.stringify({
          status,
          moderatorNote:
            status === 'approved_unban'
              ? 'Desbanimento aprovado pela Moderação após análise.'
              : 'Banimento mantido conforme histórico de regras.',
          reviewerUsername: currentUser.displayName || currentUser.username,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setFeedback(
          status === 'approved_unban'
            ? `Conta "${review.targetUsername}" desbanida e revisão concluída!`
            : `Banimento de "${review.targetUsername}" mantido.`,
        );
        await refreshBanReviews();
      } else {
        setFeedback(data.error || 'Erro ao decidir revisão.');
      }
    } catch {
      setFeedback('Falha de rede na revisão de banimento.');
    } finally {
      setBusy(false);
    }
  };

  const handleDirectPunishById = (action: 'ban' | 'mute') => {
    const raw = banTargetIdOrUser.trim();
    if (!raw) return;
    const target = users.find(
      (u) =>
        u.id.toLowerCase() === raw.toLowerCase() ||
        u.username.toLowerCase() === raw.toLowerCase(),
    );
    if (!target) {
      setFeedback(`Usuário ou ID "${raw}" não encontrado na lista de jogadores.`);
      return;
    }
    if (action === 'ban') {
      onToggleBanUser(target.id, banReasonInput.trim() || 'Punição via Mesa de Moderação');
      setFeedback(
        target.status === 'banned'
          ? `Banimento de "${target.username}" (${target.id}) removido.`
          : `Usuário "${target.username}" (${target.id}) banido pela Moderação.`,
      );
    } else {
      const res = onSimulateSentinelChatTest({
        targetUserId: target.id,
        server: currentUser.serverRegion || 'BR',
        sampleText: sentinelInput.trim() || 'ofensa',
      });
      setFeedback(res.message);
    }
    setBanTargetIdOrUser('');
  };

  const handleCreateBanReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealTargetUser.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/ban-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername: appealTargetUser.trim(),
          reason: appealReason.trim() || 'Solicitação de revisão de banimento',
        }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        setAppealTargetUser('');
        setAppealReason('');
        setFeedback('Pedido de revisão de banimento adicionado à fila.');
        await refreshBanReviews();
      }
    } finally {
      setBusy(false);
    }
  };

  const pendingReviewsCount = banReviews.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho Mesa da Moderação */}
      <div className="bg-[#064E3B] text-white rounded-xl p-5 border border-[#34D399]/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#34D399]/50 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#34D399]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold text-white">
                Mesa da Moderação · Segurança &amp; Conduta
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#34D399] text-[#06281E] rounded-md">
                {pendingReviewsCount} Revisão(ões) Pendente(s)
              </span>
            </div>
            <p className="text-xs text-emerald-100 mt-0.5">
              Monitoramento do chat das salas em tempo real, denúncias /report, fila de revisão de banimentos e punição direta por User ID.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshBanReviews();
            setRoomsSnap(readRoomsSnapshot());
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sincronizar Moderação
        </button>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center justify-between gap-2">
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

      {/* 2. Histórico de Chat em Tempo Real + Banir/Mutar por User ID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#059669]" />
              Histórico de Chat das Salas
            </h4>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
            >
              {allRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3]">
            {roomMessages.length === 0 ? (
              <p className="text-xs text-[#6B645D]">Nenhuma mensagem recente nesta sala.</p>
            ) : (
              roomMessages.slice(-25).map((msg) => {
                const matchedUser = users.find(
                  (u) => u.username.toLowerCase() === msg.senderUsername.toLowerCase(),
                );
                return (
                  <div
                    key={msg.id}
                    className="p-2 rounded-lg bg-white border border-[#EFEAE3] flex items-start justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-[#1C1917]">{msg.senderUsername}</span>{' '}
                      <span className="text-[10px] text-[#78716C] font-mono">
                        {new Date(msg.createdAt).toLocaleTimeString('pt-BR')}
                      </span>
                      <p className="text-[#44403C] break-words">{msg.text}</p>
                    </div>
                    {matchedUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setBanTargetIdOrUser(matchedUser.id);
                          setFeedback(`Alvo selecionado: ${matchedUser.username} (${matchedUser.id})`);
                        }}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] rounded shrink-0 cursor-pointer"
                      >
                        Selecionar ID
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
          <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
            <UserX className="w-4 h-4 text-[#B91C1C]" />
            Banir ou Mutar Diretamente por User ID
          </h4>
          <label className="block">
            <span className="text-xs font-semibold text-[#44403C]">
              User ID ou @username
            </span>
            <input
              type="text"
              list="mod-user-ids"
              value={banTargetIdOrUser}
              onChange={(e) => setBanTargetIdOrUser(e.target.value)}
              placeholder="Ex: @nome_jogador ou ID"
              className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
            />
            <datalist id="mod-user-ids">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#44403C]">Motivo registrado</span>
            <input
              type="text"
              value={banReasonInput}
              onChange={(e) => setBanReasonInput(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-[#6B645D]">
              Teste Sentinela (mensagem simulada opcional para aplicar advertência/mute)
            </span>
            <input
              type="text"
              value={sentinelInput}
              onChange={(e) => setSentinelInput(e.target.value)}
              placeholder="Ex: ofensa"
              className="mt-1 w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
            />
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleDirectPunishById('ban')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              Banir / Desbanir ID
            </button>
            <button
              type="button"
              onClick={() => handleDirectPunishById('mute')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#FAF8F5] border border-[#E6E0D8] hover:border-[#C8235D] text-[#1C1917] rounded-lg cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              Disparar Sentinela / Mute
            </button>
          </div>
        </section>
      </div>

      {/* 3. Fila de Revisão de Banimentos & Denúncias /report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
          <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#059669]" />
            Fila de Revisão de Banimentos ({banReviews.length})
          </h4>
          <form onSubmit={handleCreateBanReview} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={appealTargetUser}
              onChange={(e) => setAppealTargetUser(e.target.value)}
              placeholder="@usuário banido"
              className="px-2.5 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
            />
            <input
              type="text"
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              placeholder="Justificativa do recurso"
              className="px-2.5 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1C1917] rounded-lg cursor-pointer"
            >
              Registrar Revisão
            </button>
          </form>

          <div className="max-h-56 overflow-y-auto space-y-2">
            {banReviews.length === 0 ? (
              <p className="text-xs text-[#6B645D]">Nenhuma revisão de banimento na fila.</p>
            ) : (
              banReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3 rounded-lg bg-[#FAF8F5] border border-[#EFEAE3] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <strong>@{rev.targetUsername}</strong>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white border border-[#E6E0D8]">
                      {rev.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#57534E]">{rev.reason}</p>
                  {rev.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleBanReviewDecision(rev, 'approved_unban')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded cursor-pointer"
                      >
                        Aprovar Desbanimento
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleBanReviewDecision(rev, 'upheld')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-rose-600 text-white rounded cursor-pointer"
                      >
                        Manter Ban
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
          <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
            <Flag className="w-4 h-4 text-[#C8235D]" />
            Denúncias de Jogadores `/report` ({reports.length})
          </h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {reports.length === 0 ? (
              <p className="text-xs text-[#6B645D]">Nenhuma denúncia aberta pelos jogadores.</p>
            ) : (
              reports.slice(0, 25).map((rep) => (
                <div
                  key={rep.id}
                  className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#EFEAE3] text-xs"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>
                      Alvo: <strong className="text-[#B91C1C]">@{rep.target}</strong>
                    </span>
                    <span className="text-[10px] text-[#78716C]">{rep.server}</span>
                  </div>
                  <p className="text-[11px] text-[#57534E] mt-0.5">
                    Motivo: {rep.reason} · Reportado por {rep.reporter}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
