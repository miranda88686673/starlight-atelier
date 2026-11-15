import React, { useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  Bot,
  Crown,
  KeyRound,
  Megaphone,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  FURNITURE_CATALOG,
  GLOBAL_ROOMS,
  INITIAL_CLOTHING_CATALOG,
} from '../../data/catalog';
import type {
  AiMaintenanceLogEntry,
  BotAiSpecialty,
  ClothingItem,
  FurnitureDef,
  MockUser,
  ServerRegion,
  StaffRoleTier,
  UserAccount,
} from '../../types/game';
import type { StaffAuditLogEntry } from '../../core/schemas/dbSchema';
import {
  BOT_SPECIALTY_META,
  type AdminBotOrderInput,
  type AdminBotOrderResult,
} from '../../utils/aiBots';
import {
  loadAccounts,
  normalizeUsername,
  SERVER_REGION_META,
} from '../../utils/storage';
import {
  ALL_STAFF_ROLE_TIERS,
  STAFF_ROLE_BADGE_META,
  type StaffBotEditorPayload,
  StaffRoleBadge,
  VipBadge,
} from '../StaffDirectory';

interface AdminMasterPanelProps {
  currentUser: UserAccount;
  globalNotice: string;
  users: MockUser[];
  deletedItemIds: string[];
  bannedWords: string[];
  customClothingCatalog?: ClothingItem[];
  customFurnitureCatalog?: FurnitureDef[];
  staffAuditLogs: StaffAuditLogEntry[];
  onRefreshAuditLogs: () => void;
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
  onExecuteAdminBotOrder?: (input: AdminBotOrderInput) => AdminBotOrderResult;
  onDeleteCatalogItem: (itemId: string) => void;
  onRestoreAllItems: () => void;
  onResetAllDemoData: () => void;
  onAddBannedWord: (word: string) => void;
  onRemoveBannedWord: (word: string) => void;
}

export const AdminMasterPanel: React.FC<AdminMasterPanelProps> = ({
  currentUser,
  globalNotice,
  users,
  deletedItemIds,
  bannedWords,
  customClothingCatalog = [],
  customFurnitureCatalog = [],
  staffAuditLogs,
  onRefreshAuditLogs,
  onUpdateNotice,
  onToggleBanUser,
  onToggleUserVip,
  onAssignStaffRole,
  onAssignAccountStaffRole,
  onCreateStaffBot,
  onExecuteAdminBotOrder,
  onDeleteCatalogItem,
  onRestoreAllItems,
  onResetAllDemoData,
  onAddBannedWord,
  onRemoveBannedWord,
}) => {
  const [noticeDraft, setNoticeDraft] = useState(globalNotice);
  const [wordDraft, setWordDraft] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Contratação RH (Jogador Real por ID vs Bot Autônomo + Especialidade IA)
  const [hireMode, setHireMode] = useState<'human' | 'bot'>('human');
  const [humanTargetInput, setHumanTargetInput] = useState('');
  const [humanRoleTier, setHumanRoleTier] = useState<StaffRoleTier>('mod_br');
  const [humanCustomTitle, setHumanCustomTitle] = useState('');

  const [botUsername, setBotUsername] = useState('');
  const [botDisplayName, setBotDisplayName] = useState('');
  const [botPassword, setBotPassword] = useState('botstar123');
  const [botServer, setBotServer] = useState<ServerRegion>('BR');
  const [botRoleTier, setBotRoleTier] = useState<StaffRoleTier>('mod_br');
  const [botSpecialty, setBotSpecialty] = useState<BotAiSpecialty>('moderation');

  // Ordem direta a bots
  const [selectedBotId, setSelectedBotId] = useState('');
  const [botAction, setBotAction] = useState<AdminBotOrderInput['action']>('maintenance_scan');
  const [botRoomId, setBotRoomId] = useState('central_staff');
  const [botSpeech, setBotSpeech] = useState('');

  const [catalogSearch, setCatalogSearch] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const accounts = useMemo(() => loadAccounts(), [staffAuditLogs, users]);
  const botAccounts = useMemo(() => accounts.filter((a) => a.isBot), [accounts]);
  const humanAccounts = useMemo(() => accounts.filter((a) => !a.isBot), [accounts]);

  const effectiveSelectedBotId =
    selectedBotId && botAccounts.some((b) => b.id === selectedBotId)
      ? selectedBotId
      : botAccounts[0]?.id ?? '';

  const allCatalogEntries = useMemo(() => {
    const clothes = [...customClothingCatalog, ...INITIAL_CLOTHING_CATALOG].map((c) => ({
      id: c.id,
      name: c.name,
      kind: 'Roupa',
      price: c.price,
      vip: Boolean(c.isVipOnly),
    }));
    const furns = [...customFurnitureCatalog, ...FURNITURE_CATALOG].map((f) => ({
      id: f.id,
      name: f.name,
      kind: 'Móvel',
      price: f.price,
      vip: Boolean(f.isVipOnly),
    }));
    const q = catalogSearch.trim().toLowerCase();
    return [...clothes, ...furns]
      .filter((item) => !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q))
      .slice(0, 36);
  }, [catalogSearch, customClothingCatalog, customFurnitureCatalog]);

  const handleHireHuman = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = humanTargetInput.trim();
    if (!raw) return;
    const norm = normalizeUsername(raw);
    const matchedAcc = humanAccounts.find(
      (a) =>
        a.id === raw ||
        normalizeUsername(a.username) === norm ||
        a.email.toLowerCase() === raw.toLowerCase(),
    );
    if (matchedAcc) {
      onAssignAccountStaffRole(
        matchedAcc.id,
        humanRoleTier,
        humanCustomTitle.trim() || undefined,
      );
      setFeedback(
        `Jogador "${matchedAcc.displayName || matchedAcc.username}" (${matchedAcc.id}) contratado como ${STAFF_ROLE_BADGE_META[humanRoleTier].label}.`,
      );
      setHumanTargetInput('');
      setHumanCustomTitle('');
      return;
    }

    const matchedMock = users.find(
      (u) => u.id === raw || normalizeUsername(u.username) === norm,
    );
    if (matchedMock) {
      onAssignStaffRole(matchedMock, humanRoleTier);
      setFeedback(
        `Membro "${matchedMock.username}" promovido para ${STAFF_ROLE_BADGE_META[humanRoleTier].label}.`,
      );
      setHumanTargetInput('');
      return;
    }

    setFeedback(`Conta ou ID "${raw}" não encontrada. Verifique a lista de contas reais abaixo.`);
  };

  const handleHireBot = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onCreateStaffBot({
      username: botUsername,
      displayName: botDisplayName || botUsername,
      password: botPassword || 'botstar123',
      avatarGender: 'feminino',
      skinTone: 'pessego',
      presenceStatus: 'online',
      equipped: {
        cabelo: 'hair_ondas_mel',
        blusas: 'top_blazer_tweed',
        calcas: 'bottom_calca_alfaiataria',
        sapatos: 'shoes_scarpin_preto',
      },
      avatarDisplayMode: 'medoll',
      serverRegion: botServer,
      staffRoleTier: botRoleTier,
      staffRoleTitle: STAFF_ROLE_BADGE_META[botRoleTier].label,
      bio: BOT_SPECIALTY_META[botSpecialty].description,
      isVip: botRoleTier === 'designer_global' || botRoleTier === 'admin',
      botAiSpecialty: botSpecialty,
      botActive: true,
      botRoamRooms: true,
    });
    if (res.ok) {
      setFeedback(
        `Bot autônomo "${botDisplayName || botUsername}" (${BOT_SPECIALTY_META[botSpecialty].shortLabel}) contratado com mesa própria!`,
      );
      setBotUsername('');
      setBotDisplayName('');
    } else {
      setFeedback(res.error);
    }
  };

  const handleSendBotOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onExecuteAdminBotOrder || !effectiveSelectedBotId) return;
    const res = onExecuteAdminBotOrder({
      botAccountId: effectiveSelectedBotId,
      action: botAction,
      targetRoomId: botRoomId,
      speechText: botSpeech,
      issuedByEmail: currentUser.email,
    });
    setFeedback(res.message);
    if (res.ok && botAction === 'speak_room') {
      setBotSpeech('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Chave Mestre */}
      <div className="bg-[#1C1917] text-white rounded-xl p-5 border border-[#D4AF37]/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/60 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-[#FDE68A]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold text-[#FDF8E2]">
                Painel Mestre do Administrador
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#D4AF37] text-[#1C1917] rounded-md uppercase tracking-wide">
                Chave Mestre Ativa
              </span>
            </div>
            <p className="text-xs text-[#D6D3D1] mt-0.5">
              Controle irrestrito de RH (Jogadores Reais por ID & Bots IA), acesso total às 4 Mesas de Trabalho e auditoria protegida em tempo real.
            </p>
          </div>
        </div>
        <div className="text-right text-xs">
          <p className="text-[#FDE68A] font-semibold">
            {accounts.length} contas · {botAccounts.length} bots ativos
          </p>
          <p className="text-[11px] text-[#A8A29E]">
            Mesa física: Central da Staff → Mesa do Administrador
          </p>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-[#FDF2F5] border border-[#F3D0DC] text-xs font-medium text-[#9E1646] flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[#9E1646] hover:underline font-bold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 1. Interface de Contratação RH (Jogador Real por ID vs Bot Autônomo IA) */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFEAE3]">
          <div>
            <h4 className="font-display text-lg font-bold text-[#1C1917] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#C8235D]" />
              RH & Recrutamento de Staff
            </h4>
            <p className="text-xs text-[#6B645D]">
              Contrate um jogador real pelo ID/@usuário ou crie um Bot autônomo escolhendo sua especialidade de IA.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-[#E6E0D8] p-0.5 bg-[#FAF8F5]">
            <button
              type="button"
              onClick={() => setHireMode('human')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                hireMode === 'human'
                  ? 'bg-[#1C1917] text-white'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              Jogador Real (por ID)
            </button>
            <button
              type="button"
              onClick={() => setHireMode('bot')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                hireMode === 'bot'
                  ? 'bg-[#C8235D] text-white'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              Bot Autônomo (IA)
            </button>
          </div>
        </div>

        {hireMode === 'human' ? (
          <form onSubmit={handleHireHuman} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[#44403C]">
                ID da Conta, @usuário ou E-mail do Jogador Real
              </span>
              <input
                type="text"
                required
                list="real-player-ids"
                value={humanTargetInput}
                onChange={(e) => setHumanTargetInput(e.target.value)}
                placeholder="Ex: acc_174... ou clara_couture"
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
              />
              <datalist id="real-player-ids">
                {humanAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username} ({a.email})
                  </option>
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">Cargo na Staff</span>
              <select
                value={humanRoleTier}
                onChange={(e) => setHumanRoleTier(e.target.value as StaffRoleTier)}
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                {ALL_STAFF_ROLE_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {STAFF_ROLE_BADGE_META[tier].label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors cursor-pointer"
            >
              Contratar / Promover
            </button>

            <label className="block md:col-span-4">
              <span className="text-[11px] text-[#6B645D]">
                Título exibido na mesa (opcional)
              </span>
              <input
                type="text"
                value={humanCustomTitle}
                onChange={(e) => setHumanCustomTitle(e.target.value)}
                placeholder="Ex: Moderadora Sênior · Turno Noite"
                className="mt-1 w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
            </label>
          </form>
        ) : (
          <form onSubmit={handleHireBot} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">@usuario do Bot</span>
              <input
                type="text"
                required
                value={botUsername}
                onChange={(e) => setBotUsername(e.target.value)}
                placeholder="ex: sentinel_nova_br"
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">Nome de Exibição</span>
              <input
                type="text"
                value={botDisplayName}
                onChange={(e) => setBotDisplayName(e.target.value)}
                placeholder="ex: Nova Sentinela"
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">Especialidade da IA</span>
              <select
                value={botSpecialty}
                onChange={(e) => setBotSpecialty(e.target.value as BotAiSpecialty)}
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                {(['maintenance', 'moderation', 'hybrid', 'designer'] as BotAiSpecialty[]).map(
                  (spec) => (
                    <option key={spec} value={spec}>
                      {BOT_SPECIALTY_META[spec].label}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">Cargo / Mesa</span>
              <select
                value={botRoleTier}
                onChange={(e) => setBotRoleTier(e.target.value as StaffRoleTier)}
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                {ALL_STAFF_ROLE_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {STAFF_ROLE_BADGE_META[tier].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">Servidor</span>
              <select
                value={botServer}
                onChange={(e) => setBotServer(e.target.value as ServerRegion)}
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                {(['BR', 'ES', 'EN'] as ServerRegion[]).map((srv) => (
                  <option key={srv} value={srv}>
                    {SERVER_REGION_META[srv].flagEmoji} {SERVER_REGION_META[srv].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">Senha interna</span>
              <input
                type="password"
                value={botPassword}
                onChange={(e) => setBotPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5" />
                Contratar Bot Autônomo (Sem conflito humano)
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 2. Ordens Diretas aos Bots + Aviso Global & Filtro de Palavras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {onExecuteAdminBotOrder && botAccounts.length > 0 && (
          <form
            onSubmit={handleSendBotOrder}
            className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3"
          >
            <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
              <Play className="w-4 h-4 text-[#C8235D]" />
              Comando Imediato a Bots da Staff
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <select
                value={effectiveSelectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
                className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                {botAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName} (@{b.username})
                  </option>
                ))}
              </select>
              <select
                value={botAction}
                onChange={(e) =>
                  setBotAction(e.target.value as AdminBotOrderInput['action'])
                }
                className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                <option value="maintenance_scan">Executar Varredura DevOps</option>
                <option value="wardrobe_audit">Auditar Guarda-Roupa Global</option>
                <option value="designer_drop">Forçar Drop Starplaza</option>
                <option value="move_room">Mover para Sala</option>
                <option value="speak_room">Falar na Sala</option>
              </select>
            </div>
            {(botAction === 'move_room' || botAction === 'speak_room') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={botRoomId}
                  onChange={(e) => setBotRoomId(e.target.value)}
                  className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
                >
                  {GLOBAL_ROOMS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {botAction === 'speak_room' && (
                  <input
                    type="text"
                    value={botSpeech}
                    onChange={(e) => setBotSpeech(e.target.value)}
                    placeholder="Mensagem do bot na sala..."
                    className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
                  />
                )}
              </div>
            )}
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg cursor-pointer"
            >
              Executar Ordem
            </button>
          </form>
        )}

        <div className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-4">
          <div>
            <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#C8235D]" />
              Aviso Global do HUD & Filtro do Chat
            </h4>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={noticeDraft}
                onChange={(e) => setNoticeDraft(e.target.value)}
                placeholder="Digite o aviso oficial no topo do jogo..."
                className="flex-1 px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  onUpdateNotice(noticeDraft.trim());
                  setFeedback('Aviso global atualizado em tempo real.');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg cursor-pointer"
              >
                Publicar
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-[#EFEAE3]">
            <div className="flex gap-2">
              <input
                type="text"
                value={wordDraft}
                onChange={(e) => setWordDraft(e.target.value)}
                placeholder="Adicionar palavra proibida..."
                className="flex-1 px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  if (!wordDraft.trim()) return;
                  onAddBannedWord(wordDraft.trim());
                  setWordDraft('');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#FAF8F5] border border-[#E6E0D8] hover:border-[#C8235D] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {bannedWords.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onRemoveBannedWord(w)}
                  title="Clique para remover"
                  className="px-2 py-0.5 text-[11px] bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] rounded-md hover:bg-[#FEE2E2] cursor-pointer"
                >
                  {w} ✕
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Gestão de Usuários (VIP, Ban, Cargos) */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#C8235D]" />
            Contas & Usuários Registrados ({users.length})
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EFEAE3] text-[#6B645D]">
                <th className="py-2 pr-3">Usuário / ID</th>
                <th className="py-2 px-3">Cargo</th>
                <th className="py-2 px-3">VIP</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 pl-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F2EC]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 pr-3 font-medium text-[#1C1917]">
                    {u.username}{' '}
                    <span className="text-[10px] font-mono text-[#78716C]">({u.id})</span>
                  </td>
                  <td className="py-2 px-3">
                    {u.staffRoleTier ? <StaffRoleBadge tier={u.staffRoleTier} compact /> : 'Jogador'}
                  </td>
                  <td className="py-2 px-3">
                    {u.isVip ? <VipBadge compact /> : <span className="text-[#78716C]">Padrão</span>}
                  </td>
                  <td className="py-2 px-3">
                    {u.status === 'banned' ? (
                      <span className="text-[#B91C1C] font-semibold">Banido</span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">Ativo</span>
                    )}
                  </td>
                  <td className="py-2 pl-3 text-right space-x-1.5 whitespace-nowrap">
                    {onToggleUserVip && (
                      <button
                        type="button"
                        onClick={() => onToggleUserVip(u.id)}
                        className="px-2 py-1 text-[11px] font-semibold bg-[#FFFBEB] text-[#92400E] border border-[#FCD34D] rounded-md cursor-pointer"
                      >
                        <Crown className="w-3 h-3 inline mr-1" />
                        {u.isVip ? 'Remover VIP' : 'Dar VIP'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleBanUser(u.id, 'Ação direta Admin')}
                      className={`px-2 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${
                        u.status === 'banned'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                      }`}
                    >
                      <Ban className="w-3 h-3 inline mr-1" />
                      {u.status === 'banned' ? 'Desbanir' : 'Banir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Auditoria Protegida (staff_audit_logs) & Moderação de Catálogo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0284C7]" />
              Auditoria Protegida (`staff_audit_logs`)
            </h4>
            <button
              type="button"
              onClick={onRefreshAuditLogs}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Atualizar
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {staffAuditLogs.length === 0 ? (
              <p className="text-xs text-[#6B645D]">Nenhum registro de auditoria ainda.</p>
            ) : (
              staffAuditLogs.slice(0, 40).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#EFEAE3] text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2 font-semibold text-[#1C1917]">
                    <span>
                      [{log.role.toUpperCase()}] {log.actor_username || log.actor_id} ·{' '}
                      <span className="text-[#C8235D]">{log.action_type}</span>
                    </span>
                    <span className="text-[10px] text-[#78716C] font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-[#57534E] mt-0.5">
                    Alvo: <strong>{log.target_id}</strong> — {log.details}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#C8235D]" />
              Catálogo Starplaza ({deletedItemIds.length} ocultos)
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRestoreAllItems}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar
              </button>
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] rounded-lg cursor-pointer"
                >
                  <ShieldAlert className="w-3 h-3" />
                  Reset Mundo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onResetAllDemoData();
                    setConfirmReset(false);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-[#B91C1C] text-white rounded-lg cursor-pointer"
                >
                  Confirmar Reset?
                </button>
              )}
            </div>
          </div>
          <input
            type="text"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder="Filtrar item por nome ou ID..."
            className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
          />
          <div className="max-h-52 overflow-y-auto divide-y divide-[#F5F2EC]">
            {allCatalogEntries.map((item) => {
              const hidden = deletedItemIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="py-1.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-[#1C1917]">{item.name}</span>{' '}
                    <span className="text-[10px] text-[#78716C]">
                      ({item.kind} · {item.price} SC)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteCatalogItem(item.id)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer ${
                      hidden
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8]'
                    }`}
                  >
                    <Trash2 className="w-3 h-3 inline mr-1" />
                    {hidden ? 'Oculto' : 'Ocultar'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
