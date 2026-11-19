import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Flag,
  MessageSquare,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
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
import { hasRolePermission, resolveCoreStaffRole } from '../../core/security/RoleGuard';
import { subscribeRemoteSync } from '../../core/state/socketBridge';
import { readRoomsSnapshot } from '../../utils/realtime';
import { resilientApiRequest } from '../../utils/apiClient';
import { normalizeUsername } from '../../utils/storage';

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
  const {
    banReviews,
    supportModMessages,
    refreshBanReviews,
    refreshSupportModMessages,
  } = useGlobalState();

  const [selectedRoomId, setSelectedRoomId] = useState<string>('lounge_party');
  const [roomsSnap, setRoomsSnap] = useState(() => readRoomsSnapshot());
  const [banTargetIdOrUser, setBanTargetIdOrUser] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('Violação das regras de convivência');
  const [sentinelInput, setSentinelInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Canal direto Suporte Oficial <-> Moderadores
  const [channelInput, setChannelInput] = useState('');
  const [channelBusy, setChannelBusy] = useState(false);

  // Abrir pedido manual de revisão de banimento
  const [appealTargetUser, setAppealTargetUser] = useState('');
  const [appealReason, setAppealReason] = useState('');

  useEffect(() => {
    void refreshBanReviews();
    void refreshSupportModMessages();
    setRoomsSnap(readRoomsSnapshot());
    return subscribeRemoteSync({
      onInit: () => setRoomsSnap(readRoomsSnapshot()),
      onRoomSnapshotSync: () => setRoomsSnap(readRoomsSnapshot()),
      onRoomChatBroadcast: () => setRoomsSnap(readRoomsSnapshot()),
      onPatch: (p) => {
        if (p.roomsSnapshot) setRoomsSnap(readRoomsSnapshot());
      },
    });
  }, [refreshBanReviews, refreshSupportModMessages]);

  const role = resolveCoreStaffRole(currentUser);
  const canModerate = hasRolePermission(currentUser, ['admin', 'moderator']);

  const staffHeaders = {
    'x-actor-id': currentUser.id,
    'x-staff-role': role || 'moderator',
    'x-actor-email': currentUser.email,
  };

  const allRooms = useMemo(
    () => [...GLOBAL_ROOMS, ...(roomsSnap.customRooms ?? [])],
    [roomsSnap.customRooms],
  );
  const roomMessages = roomsSnap.messagesByRoom?.[selectedRoomId] ?? [];

  // Lista destacada da equipe oficial de Suporte nas salas oficiais
  const officialSupportRoster = useMemo(() => {
    const byUser = new Map<string, { username: string; rooms: string[] }>();
    const overrides = roomsSnap.officialOverrides ?? {};
    for (const room of GLOBAL_ROOMS) {
      const list = overrides[room.id]?.supportStaff ?? room.supportStaff ?? [];
      for (const uname of list) {
        const norm = normalizeUsername(uname);
        if (!norm) continue;
        const existing = byUser.get(norm);
        if (existing) {
          if (!existing.rooms.includes(room.name)) {
            existing.rooms.push(room.name);
          }
        } else {
          byUser.set(norm, { username: uname.trim(), rooms: [room.name] });
        }
      }
    }
    return Array.from(byUser.values());
  }, [roomsSnap.officialOverrides]);

  const isViewerOfficialSupport = useMemo(() => {
    const norm = normalizeUsername(currentUser.username);
    return officialSupportRoster.some((m) => normalizeUsername(m.username) === norm);
  }, [currentUser.username, officialSupportRoster]);

  const handleSendDirectSupportModMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = channelInput.trim();
    if (!text || channelBusy) return;
    setChannelBusy(true);
    try {
      const payload = {
        senderAccountId: currentUser.id,
        senderUsername: currentUser.username,
        text,
      };
      const data = await resilientApiRequest<{ ok?: boolean; error?: string }>(
        '/api/support-mod/messages',
        {
          method: 'POST',
          body: payload,
          socketEvent: 'support_mod:send_message',
          socketPayload: payload,
        },
      );
      if (data.ok) {
        setChannelInput('');
        await refreshSupportModMessages();
      } else {
        setFeedback(data.error || 'Não foi possível enviar mensagem no canal direto.');
      }
    } finally {
      setChannelBusy(false);
    }
  };

  const handleBanReviewDecision = async (
    review: BanReviewRequest,
    status: 'approved_unban' | 'upheld',
  ) => {
    if (!canModerate) return;
    setBusy(true);
    try {
      const data = await resilientApiRequest<{ ok?: boolean; error?: string }>(
        `/api/ban-reviews/${encodeURIComponent(review.id)}`,
        {
          method: 'PATCH',
          headers: staffHeaders,
          body: {
            status,
            moderatorNote:
              status === 'approved_unban'
                ? 'Desbanimento aprovado pela Moderação após análise.'
                : 'Banimento mantido conforme histórico de regras.',
            reviewerUsername: currentUser.displayName || currentUser.username,
          },
        },
      );
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
    if (!canModerate) return;
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
    if (!canModerate || !appealTargetUser.trim()) return;
    setBusy(true);
    try {
      const data = await resilientApiRequest<{ ok?: boolean; error?: string }>(
        '/api/ban-reviews',
        {
          method: 'POST',
          body: {
            targetUsername: appealTargetUser.trim(),
            reason: appealReason.trim() || 'Solicitação de revisão de banimento',
          },
        },
      );
      if (data.ok) {
        setAppealTargetUser('');
        setAppealReason('');
        setFeedback('Pedido de revisão de banimento adicionado à fila.');
        await refreshBanReviews();
      } else if (data.error) {
        setFeedback(data.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const pendingReviewsCount = banReviews.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho Mesa da Moderação & Suporte Oficial */}
      <div className="bg-[#064E3B] text-white rounded-xl p-5 border border-[#34D399]/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#34D399]/50 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#34D399]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-bold text-white">
                {canModerate
                  ? 'Mesa da Moderação · Segurança & Conduta'
                  : 'Mesa de Suporte Oficial · Apoio aos Jogadores'}
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#34D399] text-[#06281E] rounded-md">
                {pendingReviewsCount} Revisão(ões) Pendente(s)
              </span>
              {isViewerOfficialSupport && !canModerate && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-black rounded-md bg-gradient-to-r from-amber-300 to-yellow-500 text-[#451A03] shadow-[0_0_10px_rgba(251,191,36,0.85)]">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#451A03] text-amber-300 inline-flex items-center justify-center font-black text-[9px]">
                    S
                  </span>
                  Suporte Oficial (Sem Poder Punitivo)
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-100 mt-0.5">
              {canModerate
                ? 'Monitoramento do chat das salas em tempo real, canal direto com a equipe de Suporte, denúncias /report e punição direta por User ID.'
                : 'Atendimento e tira-dúvidas nas salas oficiais com comunicação direta com a equipe de Moderadores (cargo informativo, sem poder de banimento/mute).'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshBanReviews();
            void refreshSupportModMessages();
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

      {/* 1. DESTAQUE NA ABA MODERAÇÃO: Equipe Oficial de Suporte (S Dourado) + Canal Direto com Moderadores */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-gradient-to-br from-[#FFFBEB] via-white to-[#FEF3C7]/40 border-2 border-amber-300 rounded-xl p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display text-base font-bold text-[#78350F] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-[#451A03] font-black text-xs inline-flex items-center justify-center shadow-[0_0_12px_rgba(251,191,36,0.95)] ring-2 ring-yellow-200 animate-pulse">
                S
              </span>
              Equipe de Suporte Oficial
            </h4>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-200/80 text-[#78350F]">
              {officialSupportRoster.length} membro(s)
            </span>
          </div>
          <p className="text-[11px] text-[#78350F]/90 leading-relaxed">
            Usuários nomeados pelo Administrador como <strong>Suporte</strong> nas salas oficiais exibem o emblema{' '}
            <strong>S dourado brilhante</strong>. Eles <strong>não possuem poderes de moderação</strong>: atuam tirando dúvidas da comunidade e reportando ocorrências diretamente aos Moderadores.
          </p>

          <div className="max-h-56 overflow-y-auto space-y-2 pt-1">
            {officialSupportRoster.length === 0 ? (
              <div className="p-3 rounded-lg bg-white/80 border border-amber-200 text-xs text-[#92400E]">
                Nenhum usuário com cargo <strong>Suporte</strong> ativo no momento. O Administrador pode atribuir esse cargo dentro das salas oficiais em <em>Gerenciar Cargo</em>.
              </div>
            ) : (
              officialSupportRoster.map((member) => (
                <div
                  key={member.username}
                  className="p-2.5 rounded-lg bg-white border border-amber-200/90 flex items-start justify-between gap-2 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-[#451A03] font-black text-xs inline-flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(251,191,36,0.9)] ring-1 ring-yellow-200 animate-pulse">
                      S
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#1C1917] truncate">
                          @{member.username}
                        </span>
                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-amber-100 text-[#92400E] border border-amber-300">
                          Suporte
                        </span>
                      </div>
                      <p className="text-[10px] text-[#78716C] truncate">
                        Salas: {member.rooms.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="lg:col-span-7 bg-white border border-[#E6E0D8] rounded-xl p-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-[#EFEAE3] pb-2.5">
            <div>
              <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                <MessageSquareText className="w-4 h-4 text-[#059669]" />
                Canal Direto: Suporte Oficial ↔ Equipe de Moderadores
              </h4>
              <p className="text-[11px] text-[#6B645D]">
                Comunicação direta em tempo real para encaminhar dúvidas complexas, denúncias e solicitações urgentes.
              </p>
            </div>
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          </div>

          <div className="max-h-56 min-h-[160px] overflow-y-auto space-y-2 p-3 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3]">
            {supportModMessages.length === 0 ? (
              <p className="text-xs text-[#6B645D]">
                Nenhuma mensagem enviada no canal direto ainda. Envie um aviso para alinhar o atendimento entre Suporte e Moderadores.
              </p>
            ) : (
              supportModMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded-lg border text-xs ${
                    msg.isSupport
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-white border-[#E6E0D8]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {msg.isSupport && (
                        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-[#451A03] font-black text-[9px] inline-flex items-center justify-center shadow-[0_0_8px_rgba(251,191,36,0.9)]">
                          S
                        </span>
                      )}
                      <span className="font-bold text-[#1C1917]">
                        @{msg.senderUsername}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                          msg.isSupport
                            ? 'bg-amber-200 text-[#78350F]'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {msg.senderRoleLabel}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#78716C] font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-[#44403C] mt-1 break-words">{msg.text}</p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => void handleSendDirectSupportModMessage(e)}
            className="flex flex-wrap gap-2"
          >
            <input
              type="text"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="Escreva para a equipe de Suporte / Moderadores..."
              className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#059669]"
            />
            <button
              type="submit"
              disabled={channelBusy || !channelInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#065F46] disabled:opacity-50 rounded-lg cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {channelBusy ? 'Enviando...' : 'Enviar'}
            </button>
          </form>
        </section>
      </div>

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
                    {canModerate && matchedUser && (
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

        {canModerate ? (
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
        ) : (
          <section className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 flex flex-col justify-center space-y-2.5">
            <div className="flex items-center gap-2 text-[#92400E]">
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-[#451A03] font-black text-xs inline-flex items-center justify-center shadow-[0_0_10px_rgba(251,191,36,0.9)]">
                S
              </span>
              <h4 className="font-display text-base font-bold">
                Atribuições do Cargo Suporte Oficial
              </h4>
            </div>
            <p className="text-xs text-[#78350F] leading-relaxed">
              Seu cargo é focado exclusivamente em acolher os jogadores nas salas oficiais, tirar dúvidas sobre regras, loja e mecânicas, e encaminhar casos graves diretamente aos Moderadores pelo canal acima.
            </p>
            <p className="text-[11px] font-semibold text-[#92400E]">
              Por segurança da comunidade, o cargo Suporte não possui comandos de banimento, mute ou expulsão.
            </p>
          </section>
        )}
      </div>

      {/* 3. Fila de Revisão de Banimentos & Denúncias /report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
          <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#059669]" />
            Fila de Revisão de Banimentos ({banReviews.length})
          </h4>
          {canModerate && (
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
          )}

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
                  {canModerate && rev.status === 'pending' && (
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
