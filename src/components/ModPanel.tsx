import React, { useEffect, useMemo, useState } from 'react';
import {
  Crown,
  KeyRound,
  Layers,
  LifeBuoy,
  Send,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type {
  AiMaintenanceLogEntry,
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
import { resolveCoreStaffRole } from '../core/security/RoleGuard';
import type {
  AdminBotOrderInput,
  AdminBotOrderResult,
  AutonomousLifeTickResult,
  MaintenanceScanResult,
} from '../utils/aiBots';
import { isPrimaryAdminAccount } from '../utils/storage';
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
  serverNotices?: Partial<Record<ServerRegion, string>>;
  users: MockUser[];
  deletedItemIds: string[];
  bannedWords: string[];
  reports?: RoomReportEntry[];
  customClothingCatalog?: ClothingItem[];
  customFurnitureCatalog?: FurnitureDef[];
  onUpdateNotice: (notice: string) => void;
  onUpdateServerNotice?: (server: ServerRegion, notice: string) => void;
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
  onToggleBotRoam?: (accountId: string) => void;
  onCreateCustomClothing?: (item: ClothingItem) => void;
  onCreateCustomFurniture?: (furn: FurnitureDef) => void;
  onCreateCustomRoomTemplate?: (roomTpl: PurchasableRoomItem) => void;
  onCreateCustomWallpaper?: (wp: PurchasableWallpaperItem) => void;
  onDeleteCatalogItem: (itemId: string) => void;
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
  aiLogs: AiMaintenanceLogEntry[];
  onRunAiDiagnostics: () => MaintenanceScanResult;
  onSimulateFaultAndRepair: () => MaintenanceScanResult;
  onRunBotLifeTick?: (options?: {
    forceDesignerCreation?: boolean;
    forceWeeklyVip?: boolean;
    forceWardrobeAudit?: boolean;
  }) => AutonomousLifeTickResult;
  onExecuteAdminBotOrder?: (input: AdminBotOrderInput) => AdminBotOrderResult;
  onSimulateSentinelChatTest: (input: {
    targetUserId: string;
    server: ServerRegion;
    sampleText: string;
  }) => { ok: boolean; message: string };
  onClearAiLogs?: () => void;
}

export const ModPanel: React.FC<ModPanelProps> = ({
  currentUser,
  initialSubTab,
  liveUserProfile,
  globalNotice,
  serverNotices,
  users,
  deletedItemIds,
  bannedWords,
  reports,
  customClothingCatalog,
  customFurnitureCatalog,
  onUpdateNotice,
  onUpdateServerNotice,
  onToggleBanUser,
  onToggleUserVip,
  onAssignStaffRole,
  onAssignAccountStaffRole,
  onCreateStaffBot,
  onUpdateStaffProfile,
  onRemoveStaffMember,
  onToggleBotRoam,
  onCreateCustomClothing,
  onCreateCustomFurniture,
  onCreateCustomRoomTemplate,
  onCreateCustomWallpaper,
  onDeleteCatalogItem,
  onRestoreAllItems,
  onResetAllDemoData,
  onAddBannedWord,
  onRemoveBannedWord,
  onGoToMyProfile,
  onOpenPublicProfile,
  onUploadProfilePhoto,
  onRemoveProfilePhoto,
  aiLogs,
  onRunAiDiagnostics,
  onSimulateFaultAndRepair,
  onRunBotLifeTick,
  onExecuteAdminBotOrder,
  onSimulateSentinelChatTest,
}) => {
  const { staffAuditLogs, refreshStaffAuditLogs } = useGlobalState();
  const isPrimaryAdmin = isPrimaryAdminAccount(currentUser);
  const coreRole = resolveCoreStaffRole(currentUser);
  const hasMasterKey = isPrimaryAdmin || coreRole === 'admin';

  // Chamado rápido para jogadores dentro da aba Moderação
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketInput, setTicketInput] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketSuccessId, setTicketSuccessId] = useState<string | null>(null);
  const [ticketMsgs, setTicketMsgs] = useState<SupportChatMessage[]>([
    {
      id: 'inapp_help_0',
      senderRole: 'ai_bot',
      senderName: 'Bot Gerente de Comunidade · IA',
      text: `Olá ${currentUser.displayName || currentUser.username}! Descreva sua dúvida ou problema sobre o Starlight Atelier. Posso responder imediatamente ou encaminhar seu chamado aos Moderadores.`,
      createdAt: Date.now(),
    },
  ]);

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
      tabs.push({ id: 'cm', label: 'Sala de Controle CM', Icon: Server });
    }
    if (hasMasterKey || coreRole === 'moderator') {
      tabs.push({ id: 'moderation', label: 'Moderação & Suporte', Icon: ShieldCheck });
    }
    if (hasMasterKey || coreRole === 'designer') {
      tabs.push({ id: 'designer', label: 'Designer Global', Icon: Layers });
    }
    return tabs;
  }, [coreRole, hasMasterKey]);

  const defaultTabForRole: StaffPanelSubTab = useMemo(() => {
    if (initialSubTab && allowedTabs.some((t) => t.id === initialSubTab)) {
      return initialSubTab;
    }
    if (hasMasterKey) return 'overview';
    if (coreRole === 'cm') return 'cm';
    if (coreRole === 'moderator') return 'moderation';
    if (coreRole === 'designer') return 'designer';
    return 'directory';
  }, [allowedTabs, coreRole, hasMasterKey, initialSubTab]);

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

  const handlePlayerSupportAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = ticketInput.trim();
    if (!text || ticketBusy) return;
    const playerMsg: SupportChatMessage = {
      id: `inapp_p_${Date.now()}`,
      senderRole: 'player',
      senderName: currentUser.username,
      text,
      createdAt: Date.now(),
    };
    const nextHistory = [...ticketMsgs, playerMsg];
    setTicketMsgs(nextHistory);
    setTicketInput('');
    setTicketBusy(true);
    try {
      const res = await fetch('/api/support/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          username: currentUser.username,
          history: nextHistory.map((m) => ({
            senderRole: m.senderRole,
            text: m.text,
          })),
        }),
      });
      const data = (await res.json()) as { reply?: string };
      setTicketMsgs((prev) => [
        ...prev,
        {
          id: `inapp_ai_${Date.now()}`,
          senderRole: 'ai_bot',
          senderName: `Gerente de Comunidade (${currentUser.serverRegion || 'BR'})`,
          text:
            data.reply ||
            'Recebemos sua solicitação! Clique em "Enviar para Fila da Moderação" se desejar atendimento humano.',
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setTicketBusy(false);
    }
  };

  const handleEscalateInAppTicket = async () => {
    if (ticketBusy) return;
    setTicketBusy(true);
    try {
      const lastMsg =
        [...ticketMsgs].reverse().find((m) => m.senderRole === 'player')?.text ||
        'Chamado aberto na aba Moderação';
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterAccountId: currentUser.id,
          requesterUsername: currentUser.username,
          category: 'geral',
          subject: lastMsg.slice(0, 90),
          messages: ticketMsgs,
          escalateToHuman: true,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; ticket?: SupportTicket };
      if (data.ok && data.ticket) {
        setTicketSuccessId(data.ticket.id);
      }
    } finally {
      setTicketBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Unificado Staff & Suporte */}
      <div className="bg-white border border-[#E6E0D8] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#C8235D]" />
            <h2 className="font-display text-2xl font-bold text-[#1C1917]">
              Central da Staff, Moderação & Suporte
            </h2>
          </div>
          <p className="text-xs text-[#6B645D] mt-1">
            {coreRole
              ? `Cargo ativo: ${coreRole.toUpperCase()} · Operação sincronizada com as Mesas de Trabalho da Central da Staff.`
              : 'Consulte a equipe oficial da Staff ou abra um chamado com o Bot Gerente de Comunidade e Moderadores.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTicketOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors cursor-pointer"
        >
          <LifeBuoy className="w-4 h-4 text-[#F59EB8]" />
          {ticketOpen ? 'Ocultar Chamado Staff' : 'Abrir Chamado com a Staff'}
        </button>
      </div>

      {/* Gaveta Interativa "Abrir Chamado com a Staff" (IA + Moderador Humano) */}
      {ticketOpen && (
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#EFEAE3] pb-2.5">
            <div>
              <h3 className="font-display text-base font-bold text-[#1C1917]">
                Atendimento Oficial · Gerente de Comunidade IA & Moderação
              </h3>
              <p className="text-[11px] text-[#6B645D]">
                Tire dúvidas sobre regras, StarCoins, Suíte ou encaminhe para um Moderador Humano.
              </p>
            </div>
            {ticketSuccessId && (
              <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                Chamado #{ticketSuccessId} na fila!
              </span>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 p-3 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3]">
            {ticketMsgs.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.senderRole === 'player' ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-[10px] font-semibold text-[#6B645D] mb-0.5">
                  {m.senderName}
                </span>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${
                    m.senderRole === 'player'
                      ? 'bg-[#C8235D] text-white'
                      : 'bg-white border border-[#E6E0D8] text-[#1C1917]'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={(e) => void handlePlayerSupportAsk(e)} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
              placeholder="Descreva sua demanda formalmente..."
              className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
            />
            <button
              type="submit"
              disabled={ticketBusy || !ticketInput.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:opacity-50 rounded-lg cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar à IA
            </button>
            <button
              type="button"
              disabled={ticketBusy || Boolean(ticketSuccessId)}
              onClick={() => void handleEscalateInAppTicket()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#FAF8F5] border border-[#E6E0D8] hover:border-[#059669] text-[#1C1917] disabled:opacity-50 rounded-lg cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
              Enviar p/ Fila Humana
            </button>
          </form>
        </section>
      )}

      {/* Navegação das 4 Estações de Trabalho + Diretório */}
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
          onCreateStaffBot={onCreateStaffBot}
          onUpdateStaffProfile={onUpdateStaffProfile}
          onRemoveStaffMember={onRemoveStaffMember}
          onToggleBotRoam={onToggleBotRoam}
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
          onCreateStaffBot={onCreateStaffBot}
          onExecuteAdminBotOrder={onExecuteAdminBotOrder}
          onDeleteCatalogItem={onDeleteCatalogItem}
          onRestoreAllItems={onRestoreAllItems}
          onResetAllDemoData={onResetAllDemoData}
          onAddBannedWord={onAddBannedWord}
          onRemoveBannedWord={onRemoveBannedWord}
        />
      )}

      {activeSubTab === 'cm' && (hasMasterKey || coreRole === 'cm') && (
        <CommunityDevOpsPanel
          currentUser={currentUser}
          serverNotices={serverNotices}
          aiLogs={aiLogs}
          onUpdateServerNotice={onUpdateServerNotice}
          onRunAiDiagnostics={onRunAiDiagnostics}
          onSimulateFaultAndRepair={onSimulateFaultAndRepair}
          onRunBotLifeTick={onRunBotLifeTick}
        />
      )}

      {activeSubTab === 'moderation' && (hasMasterKey || coreRole === 'moderator') && (
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
