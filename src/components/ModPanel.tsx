import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Crown,
  KeyRound,
  Layers,
  LifeBuoy,
  MessageSquareText,
  PlusCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type {
  AvatarDisplayMode,
  AvatarGender,
  ClothingItem,
  EquippedOutfit,
  FurnitureDef,
  MockUser,
  PlayerProgressState,
  PurchasableRoomItem,
  PurchasableWallpaperItem,
  RoomReportEntry,
  ServerRegion,
  SkinToneId,
  StaffRoleTier,
  SupportChatMessage,
  SupportTicket,
  UserAccount,
  UserRole,
} from '../types/game';
import { useGlobalState } from '../core/state/GlobalStateManager';
import { subscribeRemoteSync } from '../core/state/socketBridge';
import { resolveCoreStaffRole } from '../core/security/RoleGuard';
import { isPrimaryAdminAccount, normalizeUsername } from '../utils/storage';
import { readRoomsSnapshot } from '../utils/realtime';
import { resilientApiRequest } from '../utils/apiClient';
import { StaffDirectory, type StaffBotEditorPayload } from './StaffDirectory';
import { AdminMasterPanel } from './staff/AdminMasterPanel';
import { CommunityDevOpsPanel } from './staff/CommunityDevOpsPanel';
import { ModeratorSupportPanel } from './staff/ModeratorSupportPanel';
import { GlobalDesignerWorkbench } from './staff/GlobalDesignerWorkbench';

export type StaffPanelSubTab =
  | 'directory'
  | 'overview'
  | 'cm'
  | 'moderation'
  | 'designer';

interface ModPanelProps {
  currentUser: UserAccount;
  initialSubTab?: StaffPanelSubTab;
  liveUserProfile?: {
    accountId?: string;
    username: string;
    displayName?: string;
    playerState: PlayerProgressState;
  };
  globalNotice: string;
  users: MockUser[];
  deletedItemIds: string[];
  soldOutItemIds?: string[];
  legendaryLaunchTimestamps?: Record<string, number>;
  bannedWords: string[];
  reports?: RoomReportEntry[];
  customClothingCatalog?: ClothingItem[];
  customFurnitureCatalog?: FurnitureDef[];
  onUpdateNotice: (notice: string) => void;
  onToggleBanUser: (userId: string, reason?: string) => void;
  onToggleUserVip?: (userId: string) => void;
  onAssignStaffRole: (user: MockUser, roleTier: StaffRoleTier | null) => void;
  onAssignAccountStaffRole: (
    accountId: string,
    roleTier: StaffRoleTier | null,
    staffRoleTitle?: string,
  ) => void;
  onCreateStaffBot: (
    input: StaffBotEditorPayload,
  ) => { ok: true } | { ok: false; error: string };
  onUpdateStaffProfile: (
    accountId: string,
    input: StaffBotEditorPayload,
  ) => { ok: true } | { ok: false; error: string };
  onRemoveStaffMember: (accountId: string) => void;
  onCreateCustomClothing?: (item: ClothingItem) => void;
  onCreateCustomFurniture?: (furn: FurnitureDef) => void;
  onCreateCustomRoomTemplate?: (roomTpl: PurchasableRoomItem) => void;
  onCreateCustomWallpaper?: (wp: PurchasableWallpaperItem) => void;
  onDeleteCatalogItem: (itemId: string) => void;
  onToggleSoldOutItem?: (itemId: string) => void;
  onRelaunchLegendary24h?: (itemId: string) => void;
  onAdminGrantItem?: (
    targetAccountIdOrUsername: string,
    itemId: string,
  ) => Promise<{ ok: boolean; message: string }>;
  onRestoreAllItems: () => void;
  onResetAllDemoData: () => void;
  onAddBannedWord: (word: string) => void;
  onRemoveBannedWord: (word: string) => void;
  onGoToMyProfile?: () => void;
  onOpenPublicProfile?: (
    username: string,
    fallbackAppearance?: {
      equipped?: EquippedOutfit;
      skinTone?: SkinToneId;
      avatarGender?: AvatarGender;
      customAvatarUrl?: string;
      avatarDisplayMode?: AvatarDisplayMode;
      role?: UserRole;
    },
  ) => void;
  onUploadProfilePhoto?: (targetUid: string, dataUrl: string) => void;
  onRemoveProfilePhoto?: (targetUid: string) => void;
  onSimulateSentinelChatTest: (input: {
    targetUserId: string;
    server: ServerRegion;
    sampleText: string;
  }) => { ok: boolean; message: string };
}

export const ModPanel: React.FC<ModPanelProps> = ({
  currentUser,
  initialSubTab,
  liveUserProfile,
  globalNotice,
  users,
  deletedItemIds,
  soldOutItemIds = [],
  legendaryLaunchTimestamps,
  bannedWords,
  reports,
  customClothingCatalog,
  customFurnitureCatalog,
  onUpdateNotice,
  onToggleBanUser,
  onToggleUserVip,
  onAssignStaffRole,
  onAssignAccountStaffRole,
  onUpdateStaffProfile,
  onRemoveStaffMember,
  onCreateCustomClothing,
  onCreateCustomFurniture,
  onCreateCustomRoomTemplate,
  onCreateCustomWallpaper,
  onDeleteCatalogItem,
  onToggleSoldOutItem,
  onRelaunchLegendary24h,
  onAdminGrantItem,
  onRestoreAllItems,
  onResetAllDemoData,
  onAddBannedWord,
  onRemoveBannedWord,
  onGoToMyProfile,
  onOpenPublicProfile,
  onUploadProfilePhoto,
  onRemoveProfilePhoto,
  onSimulateSentinelChatTest,
}) => {
  const {
    staffAuditLogs,
    supportTickets,
    refreshStaffAuditLogs,
    refreshSupportTickets,
  } = useGlobalState();

  const isPrimaryAdmin = isPrimaryAdminAccount(currentUser);
  const coreRole = resolveCoreStaffRole(currentUser);
  const hasMasterKey = isPrimaryAdmin || coreRole === 'admin';

  const checkIsOfficialSupport = () => {
    const snap = readRoomsSnapshot();
    const norm = normalizeUsername(currentUser.username);
    return Object.values(snap.officialOverrides ?? {}).some(
      (ov) =>
        Array.isArray(ov?.supportStaff) &&
        ov.supportStaff.some((u) => normalizeUsername(u) === norm),
    );
  };

  const [isOfficialSupport, setIsOfficialSupport] = useState<boolean>(() =>
    checkIsOfficialSupport(),
  );

  useEffect(() => {
    setIsOfficialSupport(checkIsOfficialSupport());
    return subscribeRemoteSync({
      onInit: () => setIsOfficialSupport(checkIsOfficialSupport()),
      onRoomSnapshotSync: () => setIsOfficialSupport(checkIsOfficialSupport()),
      onPatch: (p) => {
        if (p.roomsSnapshot) setIsOfficialSupport(checkIsOfficialSupport());
      },
    });
  }, [currentUser.username]);

  // Sistema Oficial de Tickets Salvos dentro do jogo (Player <-> Community Manager)
  const [ticketOpen, setTicketOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] =
    useState<SupportTicket['category']>('geral');
  const [ticketInput, setTicketInput] = useState('');
  const [replyInput, setReplyInput] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketFeedback, setTicketFeedback] = useState<string | null>(null);

  const mySavedTickets = useMemo(() => {
    const uname = currentUser.username.trim().toLowerCase();
    return supportTickets.filter(
      (t) =>
        t.requesterAccountId === currentUser.id ||
        t.requesterUsername.trim().toLowerCase() === uname,
    );
  }, [currentUser.id, currentUser.username, supportTickets]);

  const activeTicket = useMemo(
    () => mySavedTickets.find((t) => t.id === selectedTicketId) ?? null,
    [mySavedTickets, selectedTicketId],
  );

  const allowedTabs = useMemo(() => {
    const tabs: Array<{
      id: StaffPanelSubTab;
      label: string;
      Icon: React.ComponentType<{ className?: string }>;
    }> = [
      { id: 'directory', label: 'Equipe & Mesas', Icon: Users },
    ];
    if (hasMasterKey) {
      tabs.push({ id: 'overview', label: 'Admin Mestre', Icon: KeyRound });
    }
    if (hasMasterKey || coreRole === 'cm') {
      tabs.push({ id: 'cm', label: 'Central Community Manager', Icon: MessageSquareText });
    }
    if (hasMasterKey || coreRole === 'moderator' || isOfficialSupport) {
      tabs.push({
        id: 'moderation',
        label:
          isOfficialSupport && !hasMasterKey && coreRole !== 'moderator'
            ? 'Suporte Oficial & Moderação'
            : 'Moderação & Segurança',
        Icon: ShieldCheck,
      });
    }
    if (hasMasterKey || coreRole === 'designer') {
      tabs.push({ id: 'designer', label: 'Designer Global', Icon: Layers });
    }
    return tabs;
  }, [coreRole, hasMasterKey, isOfficialSupport]);

  const defaultTabForRole: StaffPanelSubTab = useMemo(() => {
    if (initialSubTab && allowedTabs.some((t) => t.id === initialSubTab)) {
      return initialSubTab;
    }
    if (hasMasterKey) return 'overview';
    if (coreRole === 'cm') return 'cm';
    if (coreRole === 'moderator' || isOfficialSupport) return 'moderation';
    if (coreRole === 'designer') return 'designer';
    return 'directory';
  }, [allowedTabs, coreRole, hasMasterKey, initialSubTab, isOfficialSupport]);

  const [activeSubTab, setActiveSubTab] = useState<StaffPanelSubTab>(defaultTabForRole);

  useEffect(() => {
    if (initialSubTab && allowedTabs.some((t) => t.id === initialSubTab)) {
      setActiveSubTab(initialSubTab);
    }
  }, [allowedTabs, initialSubTab]);

  useEffect(() => {
    if (coreRole) {
      void refreshStaffAuditLogs(currentUser);
    }
  }, [coreRole, currentUser, refreshStaffAuditLogs]);

  useEffect(() => {
    if (ticketOpen) {
      void refreshSupportTickets();
    }
  }, [refreshSupportTickets, ticketOpen]);

  const handleCreatePlayerTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = ticketInput.trim();
    if (!text || ticketBusy) return;
    setTicketBusy(true);
    setTicketFeedback(null);
    try {
      const firstMsg: SupportChatMessage = {
        id: `inapp_p_${Date.now()}`,
        senderRole: 'player',
        sender: 'user',
        senderName: currentUser.displayName || currentUser.username,
        text,
        createdAt: Date.now(),
      };
      const payload = {
        requesterAccountId: currentUser.id,
        requesterUsername: currentUser.username,
        email: currentUser.email,
        category: newCategory,
        serverRegion: currentUser.serverRegion || 'BR',
        subject: (newSubject.trim() || text).slice(0, 90),
        messages: [firstMsg],
      };
      const data = await resilientApiRequest<{
        ok?: boolean;
        ticket?: SupportTicket;
        error?: string;
      }>('/api/support/tickets', {
        method: 'POST',
        body: payload,
        socketEvent: 'support:create_ticket',
        socketPayload: payload,
      });
      if (data.ok && data.ticket) {
        setSelectedTicketId(data.ticket.id);
        setNewSubject('');
        setTicketInput('');
        setTicketFeedback(
          `Ticket #${data.ticket.id} criado e salvo! Você e o Community Manager podem visualizar todo o histórico.`,
        );
        await refreshSupportTickets();
      } else {
        setTicketFeedback(data.error || 'Falha ao enviar Ticket.');
      }
    } catch {
      setTicketFeedback('Erro de rede ao registrar Ticket.');
    } finally {
      setTicketBusy(false);
    }
  };

  const handleReplyActiveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || ticketBusy) return;
    const text = replyInput.trim();
    if (!text) return;
    setTicketBusy(true);
    try {
      const data = await resilientApiRequest<{ ok?: boolean; error?: string }>(
        `/api/support/tickets/${encodeURIComponent(activeTicket.id)}/reply`,
        {
          method: 'POST',
          body: {
            text,
            senderName: currentUser.displayName || currentUser.username,
            senderRole: 'player',
          },
          socketEvent: 'support:reply_ticket',
          socketPayload: {
            ticketId: activeTicket.id,
            text,
            senderName: currentUser.displayName || currentUser.username,
            senderRole: 'player',
          },
        },
      );
      if (data.ok) {
        setReplyInput('');
        await refreshSupportTickets();
      } else {
        setTicketFeedback(data.error || 'Falha ao enviar mensagem no Ticket.');
      }
    } finally {
      setTicketBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Unificado Staff & Tickets */}
      <div className="bg-white border border-[#E6E0D8] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#C8235D]" />
            <h2 className="font-display text-2xl font-bold text-[#1C1917]">
              Central da Staff &amp; Tickets
            </h2>
          </div>
          <p className="text-xs text-[#6B645D] mt-1">
            {coreRole
              ? `Cargo ativo: ${coreRole.toUpperCase()} · Operação sincronizada com a Central da Staff.`
              : isOfficialSupport
                ? 'Cargo Oficial: SUPORTE (Emblema S Dourado) · Tire dúvidas dos jogadores e comunique-se com os Moderadores.'
                : 'Consulte a equipe oficial da Staff ou abra um Ticket salvo com o Community Manager.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTicketOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors cursor-pointer"
        >
          <LifeBuoy className="w-4 h-4 text-[#F59EB8]" />
          {ticketOpen ? 'Ocultar Ticket' : `Ticket (${mySavedTickets.length})`}
        </button>
      </div>

      {/* Gaveta Interativa "Ticket" Salvo (Player <-> Community Manager) */}
      {ticketOpen && (
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFEAE3] pb-2.5">
            <div>
              <h3 className="font-display text-base font-bold text-[#1C1917]">
                Ticket · Atendimento Community Manager
              </h3>
              <p className="text-[11px] text-[#6B645D]">
                Todas as perguntas e respostas ficam salvas na sua conta e disponíveis para o Community Manager.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshSupportTickets()}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#FAF8F5] border border-[#E6E0D8] hover:border-[#C8235D] rounded-lg cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => setSelectedTicketId(null)}
                className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Novo Ticket
              </button>
            </div>
          </div>

          {ticketFeedback && (
            <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
              {ticketFeedback}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Lista dos Tickets Salvos do Jogador */}
            <div className="lg:col-span-4 space-y-2 max-h-80 overflow-y-auto pr-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B645D]">
                Meus Tickets Salvos ({mySavedTickets.length})
              </p>
              {mySavedTickets.length === 0 ? (
                <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3] text-xs text-[#6B645D]">
                  Você ainda não abriu nenhum Ticket nesta conta.
                </div>
              ) : (
                mySavedTickets.map((tkt) => {
                  const selected = selectedTicketId === tkt.id;
                  const statusBadge =
                    tkt.status === 'resolved'
                      ? { label: 'Resolvido', cls: 'bg-emerald-100 text-emerald-800' }
                      : tkt.status === 'answered'
                        ? { label: 'Respondido', cls: 'bg-sky-100 text-sky-800' }
                        : { label: 'Aberto', cls: 'bg-amber-100 text-amber-800' };
                  return (
                    <button
                      key={tkt.id}
                      type="button"
                      onClick={() => setSelectedTicketId(tkt.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#FFF5F8] border-[#C8235D]'
                          : 'bg-[#FAF8F5] border-[#E6E0D8] hover:border-[#C8235D]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-[#78716C]">
                          #{tkt.id.slice(-8)}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#1C1917] mt-1 line-clamp-1">
                        {tkt.subject}
                      </p>
                      <p className="text-[10px] text-[#6B645D] mt-0.5">
                        {tkt.messages.length} mensagem(ns) salva(s)
                      </p>
                    </button>
                  );
                })
              )}
            </div>

            {/* Área de Conversa ou Novo Ticket */}
            <div className="lg:col-span-8 p-4 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3] flex flex-col">
              {activeTicket ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E6E0D8]">
                    <div>
                      <h4 className="text-xs font-bold text-[#1C1917]">
                        {activeTicket.subject}
                      </h4>
                      <p className="text-[10px] text-[#6B645D]">
                        Ticket #{activeTicket.id} · Categoria: {activeTicket.category}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-white border border-[#E6E0D8] text-[#44403C]">
                      {activeTicket.status === 'resolved' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Clock className="w-3 h-3 text-amber-600" />
                      )}
                      {activeTicket.status === 'resolved'
                        ? 'Resolvido'
                        : activeTicket.status === 'answered'
                          ? 'Respondido pelo Community Manager'
                          : 'Aguardando Community Manager'}
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-2 py-3 flex-1">
                    {activeTicket.messages.map((m) => {
                      const isPlayer = m.senderRole === 'player';
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isPlayer ? 'items-end' : 'items-start'}`}
                        >
                          <span className="text-[10px] font-semibold text-[#6B645D] mb-0.5">
                            {m.senderName} ·{' '}
                            {new Date(m.createdAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <div
                            className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${
                              isPlayer
                                ? 'bg-[#C8235D] text-white'
                                : 'bg-white border border-[#E6E0D8] text-[#1C1917]'
                            }`}
                          >
                            {m.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={(e) => void handleReplyActiveTicket(e)}
                    className="pt-2.5 border-t border-[#E6E0D8] flex flex-wrap gap-2"
                  >
                    <input
                      type="text"
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      placeholder="Escreva uma nova mensagem para o Community Manager..."
                      className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-white border border-[#E6E0D8] rounded-lg"
                    />
                    <button
                      type="submit"
                      disabled={ticketBusy || !replyInput.trim()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:opacity-50 rounded-lg cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar Resposta
                    </button>
                  </form>
                </>
              ) : (
                <form
                  onSubmit={(e) => void handleCreatePlayerTicket(e)}
                  className="space-y-3"
                >
                  <p className="text-xs font-bold text-[#1C1917]">
                    Abrir Novo Ticket com o Community Manager
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#44403C]">
                        Assunto
                      </span>
                      <input
                        type="text"
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        placeholder="Ex: Dúvida sobre pedido AM ou conta"
                        className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-[#E6E0D8] rounded-lg"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#44403C]">
                        Categoria
                      </span>
                      <select
                        value={newCategory}
                        onChange={(e) =>
                          setNewCategory(e.target.value as SupportTicket['category'])
                        }
                        className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-[#E6E0D8] rounded-lg"
                      >
                        <option value="geral">Dúvida Geral</option>
                        <option value="economia">Moedas AM &amp; VIP (Loja Premium)</option>
                        <option value="bug">Erro no Jogo</option>
                        <option value="login">Acesso à Conta</option>
                        <option value="ban_review">Revisão de Conta</option>
                      </select>
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={ticketInput}
                    onChange={(e) => setTicketInput(e.target.value)}
                    placeholder="Escreva sua pergunta. Tanto você quanto o Community Manager poderão acompanhar todas as respostas salvas..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E6E0D8] rounded-lg resize-none"
                  />
                  <button
                    type="submit"
                    disabled={ticketBusy || !ticketInput.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {ticketBusy ? 'Enviando Ticket...' : 'Enviar Ticket'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Navegação das Estações de Trabalho + Diretório */}
      {allowedTabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {allowedTabs.map((tab) => {
            const Icon = tab.Icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1C1917] text-white border-[#1C1917] shadow-sm'
                    : 'bg-white text-[#44403C] border-[#E6E0D8] hover:border-[#C8235D]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Renderização Modular por Estação */}
      {activeSubTab === 'directory' && (
        <StaffDirectory
          isPrimaryAdmin={isPrimaryAdmin}
          currentUser={currentUser}
          deletedItemIds={deletedItemIds}
          liveUserProfile={liveUserProfile}
          onAssignAccountStaffRole={onAssignAccountStaffRole}
          onUpdateStaffProfile={onUpdateStaffProfile}
          onRemoveStaffMember={onRemoveStaffMember}
          onGoToMyProfile={onGoToMyProfile}
          onOpenPublicProfile={onOpenPublicProfile}
          onUploadProfilePhoto={onUploadProfilePhoto}
          onRemoveProfilePhoto={onRemoveProfilePhoto}
        />
      )}

      {activeSubTab === 'overview' && hasMasterKey && (
        <AdminMasterPanel
          currentUser={currentUser}
          globalNotice={globalNotice}
          users={users}
          deletedItemIds={deletedItemIds}
          soldOutItemIds={soldOutItemIds}
          legendaryLaunchTimestamps={legendaryLaunchTimestamps}
          bannedWords={bannedWords}
          customClothingCatalog={customClothingCatalog}
          customFurnitureCatalog={customFurnitureCatalog}
          staffAuditLogs={staffAuditLogs}
          onRefreshAuditLogs={() => void refreshStaffAuditLogs(currentUser)}
          onUpdateNotice={onUpdateNotice}
          onToggleBanUser={onToggleBanUser}
          onToggleUserVip={onToggleUserVip}
          onAssignStaffRole={onAssignStaffRole}
          onAssignAccountStaffRole={onAssignAccountStaffRole}
          onDeleteCatalogItem={onDeleteCatalogItem}
          onToggleSoldOutItem={onToggleSoldOutItem}
          onRelaunchLegendary24h={onRelaunchLegendary24h}
          onAdminGrantItem={onAdminGrantItem}
          onRestoreAllItems={onRestoreAllItems}
          onResetAllDemoData={onResetAllDemoData}
          onAddBannedWord={onAddBannedWord}
          onRemoveBannedWord={onRemoveBannedWord}
        />
      )}

      {activeSubTab === 'cm' && (hasMasterKey || coreRole === 'cm') && (
        <CommunityDevOpsPanel currentUser={currentUser} />
      )}

      {activeSubTab === 'moderation' && (hasMasterKey || coreRole === 'moderator' || isOfficialSupport) && (
        <ModeratorSupportPanel
          currentUser={currentUser}
          users={users}
          reports={reports}
          onToggleBanUser={onToggleBanUser}
          onSimulateSentinelChatTest={onSimulateSentinelChatTest}
        />
      )}

      {activeSubTab === 'designer' && (hasMasterKey || coreRole === 'designer') && (
        <GlobalDesignerWorkbench
          currentUser={currentUser}
          onCreateCustomClothing={onCreateCustomClothing}
          onCreateCustomFurniture={onCreateCustomFurniture}
          onCreateCustomRoomTemplate={onCreateCustomRoomTemplate}
          onCreateCustomWallpaper={onCreateCustomWallpaper}
        />
      )}
    </div>
  );
};
