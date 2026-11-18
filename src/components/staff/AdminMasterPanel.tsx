import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  Clock,
  Crown,
  Gift,
  KeyRound,
  Lock,
  Megaphone,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  FURNITURE_CATALOG,
  INITIAL_CLOTHING_CATALOG,
  formatCountdown24h,
  resolveLegendarySaleStatus,
} from '../../data/catalog';
import type {
  ClothingItem,
  FurnitureDef,
  MockUser,
  StaffRoleTier,
  UserAccount,
} from '../../types/game';
import type { StaffAuditLogEntry } from '../../core/schemas/dbSchema';
import {
  loadAccounts,
  normalizeUsername,
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
  soldOutItemIds?: string[];
  legendaryLaunchTimestamps?: Record<string, number>;
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
  onCreateStaffBot?: (
    input: StaffBotEditorPayload,
  ) => { ok: true } | { ok: false; error: string };
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
}

export const AdminMasterPanel: React.FC<AdminMasterPanelProps> = ({
  currentUser,
  globalNotice,
  users,
  deletedItemIds,
  soldOutItemIds = [],
  legendaryLaunchTimestamps,
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
  onDeleteCatalogItem,
  onToggleSoldOutItem,
  onRelaunchLegendary24h,
  onAdminGrantItem,
  onRestoreAllItems,
  onResetAllDemoData,
  onAddBannedWord,
  onRemoveBannedWord,
}) => {
  const [noticeDraft, setNoticeDraft] = useState(globalNotice);
  const [wordDraft, setWordDraft] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Contratação RH (Exclusivo para Jogadores Reais)
  const [humanTargetInput, setHumanTargetInput] = useState('');
  const [humanRoleTier, setHumanRoleTier] = useState<StaffRoleTier>('mod_br');
  const [humanCustomTitle, setHumanCustomTitle] = useState('');

  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<'todos' | 'legendary' | 'clothes' | 'furniture'>('todos');
  const [confirmReset, setConfirmReset] = useState(false);
  const [grantTargetInput, setGrantTargetInput] = useState('');
  const [grantItemId, setGrantItemId] = useState('legendary_coroa_2023');
  const [grantBusy, setGrantBusy] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const accounts = useMemo(() => loadAccounts(), [staffAuditLogs, users]);
  const humanAccounts = useMemo(() => accounts.filter((a) => !a.isBot), [accounts]);

  const grantableClothingItems = useMemo(() => {
    const combined = [...customClothingCatalog, ...INITIAL_CLOTHING_CATALOG];
    return [...combined].sort((a, b) => {
      const aLeg = a.isLegendary || a.itemClass === 'legendary' ? 0 : 1;
      const bLeg = b.isLegendary || b.itemClass === 'legendary' ? 0 : 1;
      return aLeg - bLeg;
    });
  }, [customClothingCatalog]);

  const allCatalogEntries = useMemo(() => {
    const clothes = [...customClothingCatalog, ...INITIAL_CLOTHING_CATALOG].map((c) => ({
      id: c.id,
      name: c.name,
      kind: 'Roupa',
      price: c.price,
      vip: Boolean(c.isVipOnly),
      legendary: Boolean(c.isLegendary || c.itemClass === 'legendary'),
      itemClass: c.itemClass,
      launchedAt: c.launchedAt,
      legendaryExpiresAt: c.legendaryExpiresAt,
      customCreatedAt: c.customCreatedAt,
    }));
    const furns = [...customFurnitureCatalog, ...FURNITURE_CATALOG].map((f) => ({
      id: f.id,
      name: f.name,
      kind: 'Móvel',
      price: f.price,
      vip: Boolean(f.isVipOnly),
      legendary: false,
      itemClass: f.isVipOnly ? ('vip' as const) : ('am' as const),
      launchedAt: undefined,
      legendaryExpiresAt: undefined,
      customCreatedAt: undefined,
    }));
    const q = catalogSearch.trim().toLowerCase();
    return [...clothes, ...furns]
      .filter((item) => {
        if (catalogFilter === 'legendary' && !item.legendary) return false;
        if (catalogFilter === 'clothes' && item.kind !== 'Roupa') return false;
        if (catalogFilter === 'furniture' && item.kind !== 'Móvel') return false;
        if (q && !item.name.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => Number(b.legendary) - Number(a.legendary))
      .slice(0, 80);
  }, [catalogSearch, catalogFilter, customClothingCatalog, customFurnitureCatalog]);

  const handleGrantItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAdminGrantItem || !grantTargetInput.trim() || !grantItemId) return;
    setGrantBusy(true);
    try {
      const res = await onAdminGrantItem(grantTargetInput.trim(), grantItemId);
      setFeedback(res.message);
      if (res.ok) {
        setGrantTargetInput('');
      }
    } finally {
      setGrantBusy(false);
    }
  };

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
              Controle irrestrito de RH (Jogadores Reais por ID), acesso total às Mesas da Staff e auditoria protegida em tempo real.
            </p>
          </div>
        </div>
        <div className="text-right text-xs">
          <p className="text-[#FDE68A] font-semibold">
            {humanAccounts.length} conta(s) humana(s) ativa(s)
          </p>
          <p className="text-[11px] text-[#A8A29E]">
            Bots e jogadores fantasmas bloqueados no servidor
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

      {/* 1. Interface de Contratação RH (Exclusivo para Jogadores Reais) */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFEAE3]">
          <div>
            <h4 className="font-display text-lg font-bold text-[#1C1917] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#C8235D]" />
              RH &amp; Promoção de Staff Humana
            </h4>
            <p className="text-xs text-[#6B645D]">
              Contrate ou promova jogadores reais pelo ID, @usuário ou e-mail para cargos oficiais da Staff.
            </p>
          </div>
        </div>

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
              placeholder="Ex: Community Manager · Atendimento & Loja Premium"
              className="mt-1 w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
            />
          </label>
        </form>
      </section>

      {/* 2. Aviso Global & Filtro de Palavras */}
      <div className="grid grid-cols-1 gap-6">
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
              Catálogo Starplaza ({deletedItemIds.length} ocultos · {soldOutItemIds.length} vendidos)
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

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'legendary', label: 'Lendários (Coroas)' },
                { id: 'clothes', label: 'Roupas' },
                { id: 'furniture', label: 'Móveis' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCatalogFilter(f.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${
                  catalogFilter === f.id
                    ? 'bg-[#1C1917] text-white border-[#1C1917]'
                    : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder="Filtrar item por nome ou ID (ex: Coroa 2023)..."
            className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
          />
          <div className="max-h-56 overflow-y-auto divide-y divide-[#F5F2EC]">
            {allCatalogEntries.map((item) => {
              const hidden = deletedItemIds.includes(item.id);
              const isManualSoldOut = soldOutItemIds.includes(item.id);
              const saleStatus = resolveLegendarySaleStatus(
                {
                  id: item.id,
                  itemClass: item.itemClass,
                  isVipOnly: item.vip,
                  isLegendary: item.legendary,
                  launchedAt: item.launchedAt,
                  legendaryExpiresAt: item.legendaryExpiresAt,
                  customCreatedAt: item.customCreatedAt,
                },
                { soldOutItemIds, legendaryLaunchTimestamps },
                nowMs,
              );
              return (
                <div
                  key={item.id}
                  className="py-1.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-[#1C1917]">{item.name}</span>{' '}
                    {item.legendary && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-900 rounded">
                        <Sparkles className="w-2.5 h-2.5" />
                        Lendário
                      </span>
                    )}{' '}
                    {item.legendary && (
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono-num font-semibold rounded ${
                          saleStatus.isSoldOut
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {saleStatus.reason === 'admin_sold_out'
                          ? 'Vendido (Admin)'
                          : saleStatus.reason === 'expired_24h'
                            ? 'Vendido (24h esgotadas)'
                            : `24h: ${formatCountdown24h(saleStatus.remainingMs)}`}
                      </span>
                    )}{' '}
                    <span className="text-[10px] text-[#78716C] font-mono-num">
                      ({item.kind} · {item.price.toLocaleString('pt-BR')} AM)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.legendary && onRelaunchLegendary24h && (
                      <button
                        type="button"
                        onClick={() => onRelaunchLegendary24h(item.id)}
                        title="Abrir ou renovar janela de 24 horas reais na Starplaza"
                        className="px-2 py-0.5 text-[11px] font-semibold rounded border bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3 inline mr-1" />
                        Lançar 24h
                      </button>
                    )}
                    {onToggleSoldOutItem && (
                      <button
                        type="button"
                        onClick={() => onToggleSoldOutItem(item.id)}
                        title="Marcar ou desmarcar item como Vendido na loja"
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer ${
                          isManualSoldOut
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8] hover:border-amber-400'
                        }`}
                      >
                        <Lock className="w-3 h-3 inline mr-1" />
                        {isManualSoldOut ? 'Vendido (Reabrir)' : 'Marcar Vendido'}
                      </button>
                    )}
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
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 5. Entrega Direta de Relíquias Lendárias / Itens pelo Admin */}
      {onAdminGrantItem && (
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
          <div>
            <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#C8235D]" />
              Entregar Coroa Lendária ou Peça Exclusiva ao Jogador
            </h4>
            <p className="text-xs text-[#6B645D] mt-0.5">
              Itens lendários não são vendidos diretamente na loja. Use este painel para entregar relíquias (Coroa 2023–2026) diretamente no guarda-roupa de qualquer jogador.
            </p>
          </div>
          <form onSubmit={handleGrantItemSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[#44403C]">
                Jogador Destinatário (@usuário ou ID)
              </span>
              <input
                type="text"
                required
                list="grant-player-targets"
                value={grantTargetInput}
                onChange={(e) => setGrantTargetInput(e.target.value)}
                placeholder="Ex: clara_couture ou acc_..."
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
              <datalist id="grant-player-targets">
                {humanAccounts.map((a) => (
                  <option key={a.id} value={a.username}>
                    {a.displayName || a.username} ({a.id})
                  </option>
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">Peça / Coroa</span>
              <select
                value={grantItemId}
                onChange={(e) => setGrantItemId(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                {grantableClothingItems.map((ci) => (
                  <option key={ci.id} value={ci.id}>
                    {ci.isLegendary || ci.itemClass === 'legendary' ? '[Lendário] ' : ''}
                    {ci.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={grantBusy || !grantTargetInput.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:opacity-50 rounded-lg cursor-pointer"
            >
              {grantBusy ? 'Entregando...' : 'Entregar no Inventário'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
};
