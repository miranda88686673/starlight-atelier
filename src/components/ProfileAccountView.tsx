import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  Check,
  Clock,
  Globe,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { ACCOUNT_COUNTRIES } from '../data/catalog';
import {
  AvatarDisplayMode,
  PlayerProgressState,
  PresenceStatus,
  UserAccount,
} from '../types/game';
import {
  NAME_CHANGE_FEE_SC,
  generateSimulatedIp,
  getCountryMeta,
  isVipAccount,
  loadAccounts,
} from '../utils/storage';
import { useGlobalState } from '../core/state/GlobalStateManager';
import { ProfileAvatar } from './ProfileAvatar';
import { STAFF_ROLE_BADGE_META, StaffRoleBadge, VipBadge } from './StaffDirectory';

interface ProfileAccountViewProps {
  account: UserAccount;
  playerState: PlayerProgressState;
  deletedItemIds: string[];
  onUpdateIdentity: (input: {
    username: string;
    displayName: string;
  }) => { ok: true } | { ok: false; error: string };
  onUpdateProfileFields: (
    patch: Partial<
      Pick<
        PlayerProgressState,
        'bio' | 'presenceStatus' | 'countryCode' | 'timezone' | 'simulatedIp' | 'friendUsernames'
      >
    >,
  ) => void;
  onUploadProfilePhoto: (targetUid: string, dataUrl: string) => void;
  onRemoveProfilePhoto: (targetUid: string) => void;
  onChangeAvatarDisplayMode: (mode: AvatarDisplayMode) => void;
  onGoToMeDoll: () => void;
  onGoToSuite: () => void;
}

export const PRESENCE_META: Record<
  PresenceStatus,
  {
    label: string;
    dotClass: string;
    textClass: string;
    bgActiveClass: string;
    description: string;
  }
> = {
  online: {
    label: 'Online',
    dotClass: 'bg-emerald-500',
    textClass: 'text-[#15803D]',
    bgActiveClass: 'border-emerald-500 bg-emerald-50/70 text-[#14532D]',
    description: 'Visível e disponível para salas, convites e trocas.',
  },
  ausente: {
    label: 'Ausente',
    dotClass: 'bg-amber-400',
    textClass: 'text-[#B45309]',
    bgActiveClass: 'border-amber-400 bg-amber-50/80 text-[#78350F]',
    description: 'Conectado no atelier, mas temporariamente afastado.',
  },
  offline: {
    label: 'Offline',
    dotClass: 'bg-rose-500',
    textClass: 'text-[#B91C1C]',
    bgActiveClass: 'border-rose-400 bg-rose-50/70 text-[#881337]',
    description: 'Modo discreto; aparece como desconectado para a comunidade.',
  },
};

/** Redimensiona imagem enviada do PC via Canvas (máximo 200x200px, JPEG qualidade 0.80) */
function resizeImageToDataUrl(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.80));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function getTimeOfDayLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Manhã';
  if (hour >= 12 && hour < 18) return 'Tarde';
  if (hour >= 18 && hour < 24) return 'Noite';
  return 'Madrugada';
}

/**
 * Tela dedicada exclusivamente ao Perfil e Configurações da Conta
 * (separada da customização física do corpo e vestuário da MeDoll).
 */
export const ProfileAccountView: React.FC<ProfileAccountViewProps> = ({
  account,
  playerState,
  deletedItemIds,
  onUpdateIdentity,
  onUpdateProfileFields,
  onUploadProfilePhoto,
  onRemoveProfilePhoto,
  onChangeAvatarDisplayMode,
  onGoToMeDoll,
  onGoToSuite,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState(account.displayName);
  const [usernameDraft, setUsernameDraft] = useState(account.username);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const { presencesByAccountId } = useGlobalState();
  const [profileTab, setProfileTab] = useState<'perfil' | 'colecoes' | 'amigos' | 'email'>('perfil');
  const [newFriendInput, setNewFriendInput] = useState('');
  const [friendError, setFriendError] = useState<string | null>(null);

  const accountsByUsername = useMemo(() => {
    const map = new Map<string, UserAccount>();
    for (const acc of loadAccounts()) {
      map.set(acc.username.trim().toLowerCase(), acc);
    }
    return map;
  }, [profileTab]);

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    setFriendError(null);
    const clean = newFriendInput.trim().toLowerCase();
    if (!clean) return;
    const currentFriends = playerState.friendUsernames ?? [];
    if (currentFriends.includes(clean)) {
      setFriendError('Este usuário já está na sua lista de amigos.');
      return;
    }
    if (clean === account.username.trim().toLowerCase()) {
      setFriendError('Você não pode adicionar a si mesma como amiga.');
      return;
    }
    onUpdateProfileFields({ friendUsernames: [...currentFriends, clean] });
    setNewFriendInput('');
    flashSaved(`Amigo @${clean} adicionado com sucesso!`);
  };

  const handleRemoveFriend = (friendName: string) => {
    const currentFriends = playerState.friendUsernames ?? [];
    onUpdateProfileFields({
      friendUsernames: currentFriends.filter((f) => f !== friendName),
    });
    flashSaved(`Amigo @${friendName} removido.`);
  };

  // Mantém rascunhos de identidade alinhados com a conta ativa
  useEffect(() => {
    setDisplayNameDraft(account.displayName);
    setUsernameDraft(account.username);
    setIdentityError(null);
  }, [account.id, account.displayName, account.username]);

  // Atualiza o relógio sincronizado do fuso horário a cada segundo
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const flashSaved = (msg: string) => {
    setSaveFeedback(msg);
    window.setTimeout(() => setSaveFeedback(null), 2400);
  };

  const identityChanged =
    usernameDraft.trim().toLowerCase() !== account.username.trim().toLowerCase() ||
    displayNameDraft.trim().replace(/\s+/g, ' ').toLowerCase() !==
      account.displayName.trim().replace(/\s+/g, ' ').toLowerCase();
  const hasEnoughForNameChange = playerState.starcoins >= NAME_CHANGE_FEE_SC;

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    setIdentityError(null);
    const result = onUpdateIdentity({
      username: usernameDraft,
      displayName: displayNameDraft,
    });
    if (!result.ok) {
      setIdentityError(result.error);
      return;
    }
    flashSaved(
      `Identidade atualizada em todo o atelier (-${NAME_CHANGE_FEE_SC} SC descontados).`,
    );
  };

  const activeOwnedCount = playerState.ownedItemIds.filter(
    (id) => !deletedItemIds.includes(id),
  ).length;
  const playerLevel = 1 + Math.floor(activeOwnedCount / 3);
  const countryMeta = getCountryMeta(playerState.countryCode);
  const presenceMeta = PRESENCE_META[playerState.presenceStatus];

  const clockFormatted = useMemo(() => {
    try {
      const timeStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: playerState.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);

      const dateStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: playerState.timezone,
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(now);

      const hourPart = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: playerState.timezone,
          hour: 'numeric',
          hour12: false,
        }).format(now),
      );

      return {
        timeStr,
        dateStr,
        period: getTimeOfDayLabel(Number.isNaN(hourPart) ? now.getHours() : hourPart),
      };
    } catch {
      return {
        timeStr: now.toLocaleTimeString('pt-BR'),
        dateStr: now.toLocaleDateString('pt-BR'),
        period: getTimeOfDayLabel(now.getHours()),
      };
    }
  }, [now, playerState.timezone]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Selecione um arquivo de imagem válido (PNG, JPG ou WebP).');
      return;
    }

    try {
      setUploadError(null);
      const dataUrl = await resizeImageToDataUrl(file, 200);
      onUploadProfilePhoto(account.id, dataUrl);
      flashSaved('Foto de perfil salva.');
    } catch {
      setUploadError('Não foi possível processar esta imagem.');
    }
  };

  const handleSelectCountry = (nextCode: string) => {
    const meta = getCountryMeta(nextCode);
    const nextIp = generateSimulatedIp(`${account.id}_${meta.code}`, meta.code);
    onUpdateProfileFields({
      countryCode: meta.code,
      timezone: meta.timezone,
      simulatedIp: nextIp,
    });
    flashSaved(`País e fuso atualizados para ${meta.name}.`);
  };

  const handleUseBrowserTimezone = () => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTz) return;
    onUpdateProfileFields({ timezone: browserTz });
    flashSaved(`Fuso sincronizado com o navegador (${browserTz}).`);
  };

  const handleRegenerateSimulatedIp = () => {
    const entropy = `${account.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextIp = generateSimulatedIp(entropy, playerState.countryCode);
    onUpdateProfileFields({ simulatedIp: nextIp });
    flashSaved('Novo IP simulado registrado na sessão.');
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Conta + Identidade Oficial */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 min-w-0">
          <div className="relative shrink-0 self-start sm:self-auto">
            <ProfileAvatar
              username={account.username}
              equipped={playerState.equipped}
              skinTone={playerState.skinTone}
              avatarGender={playerState.avatarGender}
              customAvatarUrl={playerState.customAvatarUrl}
              avatarDisplayMode={playerState.avatarDisplayMode}
              deletedItemIds={deletedItemIds}
              sizeClass="w-24 h-24"
              roundedClass="rounded-2xl"
            />
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${presenceMeta.dotClass}`}
              title={`Status: ${presenceMeta.label}`}
            />
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-3xl font-bold text-[#1C1917] tracking-tight truncate">
                {account.displayName}
              </h2>
              <span className="text-sm font-semibold font-mono-num text-[#6B645D]">
                {account.username}
              </span>
              {account.staffRoleTier ? (
                <StaffRoleBadge tier={account.staffRoleTier} />
              ) : account.role === 'admin' ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8235D]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {STAFF_ROLE_BADGE_META.admin.label}
                </span>
              ) : (
                <span className="text-xs font-semibold text-[#6B645D]">
                  Estilista da Comunidade
                </span>
              )}
              {isVipAccount(account) && <VipBadge />}
            </div>

            <p className="text-xs text-[#6B645D] font-mono-num">
              {account.email} · Conta criada em {account.createdAt} · Nível {playerLevel} ·{' '}
              {playerState.starcoins.toLocaleString('pt-BR')} SC · {activeOwnedCount} peças
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${presenceMeta.textClass}`}>
                <span className={`w-2 h-2 rounded-full ${presenceMeta.dotClass}`} />
                {presenceMeta.label}
              </span>
              <span className="text-xs text-[#6B645D]">
                · {countryMeta.name} ({clockFormatted.timeStr})
              </span>
              {saveFeedback && (
                <span className="text-xs font-medium text-[#15803D]">
                  · {saveFeedback}
                </span>
              )}
            </div>

            {uploadError && <p className="text-xs text-[#B91C1C]">{uploadError}</p>}
          </div>
        </div>

        {/* Upload de Foto Customizada & Atalhos para Avatar Físico */}
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            className="hidden"
            aria-label="Selecionar imagem do computador"
          />

          {playerState.customAvatarUrl && (
            <div className="flex items-center gap-1 p-1 bg-[#F5F2EC] rounded-lg">
              <button
                type="button"
                onClick={() => {
                  onChangeAvatarDisplayMode('medoll');
                  flashSaved('Ícone oficial alterado para MeDoll.');
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  playerState.avatarDisplayMode === 'medoll'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#6B645D] hover:text-[#1C1917]'
                }`}
              >
                Usar MeDoll
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeAvatarDisplayMode('photo');
                  flashSaved('Ícone oficial alterado para Foto enviada.');
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  playerState.avatarDisplayMode === 'photo'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#6B645D] hover:text-[#1C1917]'
                }`}
              >
                Usar Foto
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1C1917] bg-[#FAF8F5] hover:bg-[#F2ECE3] border border-[#E6E0D8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-[#C8235D]" />
              {playerState.customAvatarUrl ? 'Alterar Foto' : 'Enviar Imagem / Alterar Foto'}
            </button>

            {playerState.customAvatarUrl && (
              <button
                type="button"
                onClick={() => {
                  onRemoveProfilePhoto(account.id);
                  flashSaved('Foto customizada removida.');
                }}
                title="Remover foto enviada"
                className="p-2 text-[#6B645D] hover:text-[#B91C1C] bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Sub-abas de Navegação do Perfil */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-[#E6E0D8] rounded-xl p-2.5">
        {[
          { id: 'perfil', label: '👤 Meu Perfil & Configurações' },
          { id: 'colecoes', label: '👑 Vitrine de Coleções' },
          { id: 'amigos', label: '👥 Aba de Amigos' },
          { id: 'email', label: '📧 Confirmação de E-mail' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setProfileTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              profileTab === tab.id
                ? 'bg-[#1C1917] text-white shadow-xs'
                : 'bg-[#FAF8F5] text-[#57534E] hover:bg-[#F3ECE1] hover:text-[#1C1917]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {profileTab === 'colecoes' && (
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE3]">
            <div>
              <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                Vitrine de Coleções
              </h3>
              <p className="text-xs text-[#6B645D] mt-0.5">
                Exibição de peças de maior raridade, coroas, itens lendários e tesouros guardados no closet.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#C8235D] bg-[#FCE8EF] px-3 py-1 rounded-lg">
              {activeOwnedCount} itens no closet
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
            {playerState.ownedItemIds
              .filter((id) => !deletedItemIds.includes(id))
              .slice(0, 18)
              .map((itemId, idx) => (
                <div
                  key={`${itemId}-${idx}`}
                  className="bg-[#FAF8F5] border border-[#E6E0D8] rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-2xs hover:border-[#C8235D] transition-colors"
                >
                  <div className="w-12 h-12 rounded-lg bg-white border border-[#EFEAE3] flex items-center justify-center mb-2 shadow-inner">
                    <Sparkles className="w-6 h-6 text-[#D4A853]" />
                  </div>
                  <span className="text-xs font-semibold text-[#1C1917] truncate w-full">
                    Peça #{itemId.slice(0, 10)}
                  </span>
                  <span className="text-[10px] text-[#C8235D] font-medium mt-0.5">
                    Coleção Rara
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {profileTab === 'amigos' && (
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE3]">
            <div>
              <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                Gerenciar Amigos
              </h3>
              <p className="text-xs text-[#6B645D] mt-0.5">
                Adicione amigos por nome de usuário para acompanhar presença e visitar suítes.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#15803D] bg-emerald-50 px-3 py-1 rounded-lg">
              {(playerState.friendUsernames ?? []).length} amigos conectados
            </span>
          </div>

          <form onSubmit={handleAddFriend} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newFriendInput}
              onChange={(e) => {
                setNewFriendInput(e.target.value.replace(/^@+/, ''));
                if (friendError) setFriendError(null);
              }}
              placeholder="Digite o nome de usuário do amigo (ex: sofia_style)..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-xl focus:outline-none focus:border-[#C8235D]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              Adicionar Amigo
            </button>
          </form>

          {friendError && (
            <p role="alert" className="text-xs text-[#B91C1C] font-medium">
              {friendError}
            </p>
          )}

          <div className="space-y-2 pt-2">
            {(!playerState.friendUsernames || playerState.friendUsernames.length === 0) ? (
              <div className="py-8 text-center text-xs text-[#6B645D] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E6E0D8]">
                Sua lista de amigos está vazia. Adicione estilistas para interagir nas salas!
              </div>
            ) : (
              playerState.friendUsernames.map((friendName) => {
                const matchedAcc = accountsByUsername.get(friendName.trim().toLowerCase());
                const livePresence =
                  (matchedAcc ? presencesByAccountId[matchedAcc.id] : undefined) ??
                  Object.values(presencesByAccountId).find(
                    (p) => p.username.trim().toLowerCase() === friendName.trim().toLowerCase(),
                  );
                const status = livePresence?.status ?? 'offline';
                const statusMeta =
                  status === 'online'
                    ? {
                        label: 'Online',
                        dotClass: 'bg-emerald-500',
                        textClass: 'text-emerald-700',
                      }
                    : status === 'away'
                      ? {
                          label: 'Ausente',
                          dotClass: 'bg-amber-400',
                          textClass: 'text-amber-700',
                        }
                      : {
                          label: 'Offline',
                          dotClass: 'bg-stone-400',
                          textClass: 'text-stone-500',
                        };

                return (
                  <div
                    key={friendName}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-full bg-[#1C1917] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {friendName.slice(0, 2).toUpperCase()}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#FAF8F5] ${statusMeta.dotClass}`}
                          title={statusMeta.label}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1C1917] truncate">
                          @{friendName}
                        </p>
                        <p className={`text-[11px] font-medium flex items-center gap-1.5 ${statusMeta.textClass}`}>
                          <span className={`inline-block w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
                          {statusMeta.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveFriend(friendName)}
                        className="px-3 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {profileTab === 'email' && (
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE3]">
            <div>
              <h3 className="font-display text-2xl font-bold text-[#1C1917]">
                Confirmação e Segurança de E-mail
              </h3>
              <p className="text-xs text-[#6B645D] mt-0.5">
                Validação definitiva de endereço para proteção de contas e avisos da comunidade.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" />
              E-mail Vinculado &amp; Verificado
            </span>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-[#1C1917]">
                  {account.email}
                </p>
                <p className="text-xs text-[#15803D] mt-0.5">
                  Conta protegida com autenticação de e-mail exclusivo e confirmação ativa no banco de dados.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-4 text-xs text-[#6B645D]">
            <span>Regra estrita: 1 e-mail por conta para impedir duplicatas ou acessos indevidos.</span>
            <button
              type="button"
              onClick={() => flashSaved('E-mail reconfirmado com sucesso no servidor!')}
              className="px-4 py-2 bg-[#1C1917] hover:bg-[#332E2B] text-white font-semibold rounded-lg cursor-pointer"
            >
              Reenviar Confirmação
            </button>
          </div>
        </section>
      )}

      {profileTab === 'perfil' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Coluna 1: Identidade + Biografia / Recado + Status de Presença */}
        <section className="lg:col-span-7 bg-white border border-[#E6E0D8] rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            {/* Identidade da Conta (Nome de Exibição & Usuário sincronizados) */}
            <form onSubmit={handleSaveIdentity} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2.5 border-b border-[#EFEAE3]">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-[#C8235D]" />
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#1C1917]">
                      Identidade da Conta
                    </h3>
                  </div>
                </div>
                <span className="font-mono-num text-[11px] font-semibold text-[#92400E] bg-[#FFFBEB] border border-[#FCD34D] px-2.5 py-0.5 rounded-md">
                  Taxa obrigatória: {NAME_CHANGE_FEE_SC} SC
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-[#44403C]">
                  Nome de Exibição (único)
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={40}
                    value={displayNameDraft}
                    onChange={(e) => {
                      setDisplayNameDraft(e.target.value);
                      if (identityError) setIdentityError(null);
                    }}
                    placeholder="Ex: Vitor, Clara Couture"
                    className="mt-1.5 w-full px-3 py-2 text-sm text-[#1C1917] bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                  />
                </label>

                <label className="block text-xs font-medium text-[#44403C]">
                  Nome de Usuário (único)
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={24}
                    value={usernameDraft}
                    onChange={(e) => {
                      setUsernameDraft(e.target.value.replace(/^@+/, ''));
                      if (identityError) setIdentityError(null);
                    }}
                    placeholder="vitor_atelier"
                    className="mt-1.5 w-full px-3 py-2 text-sm font-mono-num text-[#1C1917] bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                  />
                </label>
              </div>

              {!hasEnoughForNameChange && identityChanged && (
                <p className="text-xs font-medium text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] px-3 py-2 rounded-lg">
                  Saldo insuficiente para alterar o nome: são necessários{' '}
                  <strong className="font-mono-num">{NAME_CHANGE_FEE_SC} SC</strong> (você possui{' '}
                  <strong className="font-mono-num">{playerState.starcoins} SC</strong>).
                </p>
              )}

              {identityError && (
                <p
                  role="alert"
                  className="text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 rounded-lg"
                >
                  {identityError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-[#78716C]">
                  Nomes exclusivos em todo o jogo · Mudanças custam{' '}
                  <strong className="font-mono-num text-[#1C1917]">
                    {NAME_CHANGE_FEE_SC} SC
                  </strong>
                  .
                </span>
                <button
                  type="submit"
                  disabled={!identityChanged || !hasEnoughForNameChange}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] disabled:bg-[#D6CFC7] disabled:text-[#78716C] disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Alterar Nome ({NAME_CHANGE_FEE_SC} SC)
                </button>
              </div>
            </form>

            {/* Biografia / Recado */}
            <div>
              <div className="flex items-baseline justify-between gap-2 pb-2.5 border-b border-[#EFEAE3]">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#1C1917]">
                    Biografia / Recado
                  </h3>
                  <p className="text-xs text-[#6B645D]">
                    Escreva uma apresentação ou recado salvo automaticamente no seu perfil
                  </p>
                </div>
                <span className="text-xs font-mono-num text-[#78716C]">
                  {playerState.bio.length}/280
                </span>
              </div>

              <textarea
                rows={4}
                maxLength={280}
                value={playerState.bio}
                onChange={(e) => onUpdateProfileFields({ bio: e.target.value })}
                placeholder="Conte sobre seu estilo favorito, o que você está decorando na Suíte ou deixe um recado..."
                aria-label="Biografia ou recado do perfil"
                className="mt-3 w-full px-3.5 py-2.5 text-sm text-[#1C1917] bg-[#FAF8F5] border border-[#E6E0D8] rounded-xl focus:outline-none focus:border-[#C8235D] resize-none leading-relaxed"
              />
            </div>

            {/* Status de Presença */}
            <div>
              <div className="flex items-center gap-2 pb-2.5 border-b border-[#EFEAE3]">
                <UserCheck className="w-4 h-4 text-[#C8235D]" />
                <div>
                  <h3 className="font-display text-xl font-bold text-[#1C1917]">
                    Status de Presença
                  </h3>
                </div>
              </div>
              <p className="text-xs text-[#6B645D] mt-2">
                Defina sua disponibilidade em tempo real na plataforma:
              </p>

              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3"
                role="radiogroup"
                aria-label="Seletor de status de presença"
              >
                {(['online', 'ausente', 'offline'] as PresenceStatus[]).map((statusKey) => {
                  const meta = PRESENCE_META[statusKey];
                  const isActive = playerState.presenceStatus === statusKey;
                  return (
                    <button
                      key={statusKey}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => {
                        onUpdateProfileFields({ presenceStatus: statusKey });
                        flashSaved(`Status alterado para ${meta.label}.`);
                      }}
                      className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                        isActive
                          ? meta.bgActiveClass
                          : 'border-[#E6E0D8] bg-[#FAF8F5] hover:bg-white hover:border-[#C7BEB2]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.dotClass}`} />
                        <span className="text-sm font-semibold">{meta.label}</span>
                      </div>
                      <p className="text-[11px] opacity-85 mt-1.5 leading-snug">
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Atalhos limpos para separação Conta vs Avatar Físico / Suíte */}
          <div className="pt-4 border-t border-[#EFEAE3] flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#6B645D]">
              Deseja alterar o corpo, pele ou roupas do seu avatar?
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onGoToSuite}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ir para Suíte & Armário
              </button>
              <button
                type="button"
                onClick={onGoToMeDoll}
                className="px-3.5 py-2 text-xs font-semibold text-[#1C1917] bg-[#F5F2EC] hover:bg-[#EAE4DA] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Abrir Estúdio Físico
              </button>
            </div>
          </div>
        </section>

        {/* Coluna 2: Horário do Dia & País + Simulação de IP do Jogador */}
        <div className="lg:col-span-5 space-y-6 flex flex-col">
          {/* Horário Local e País da Conta */}
          <section className="bg-white border border-[#E6E0D8] rounded-xl p-6">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#C8235D]" />
                <h3 className="font-display text-xl font-bold text-[#1C1917]">
                  País e Horário Local
                </h3>
              </div>
              <button
                type="button"
                onClick={handleUseBrowserTimezone}
                className="text-xs font-semibold text-[#C8235D] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sincronizar navegador
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block text-xs font-medium text-[#44403C]">
                País / Região da Conta
                <select
                  value={playerState.countryCode}
                  onChange={(e) => handleSelectCountry(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-sm text-[#1C1917] bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D] cursor-pointer"
                >
                  {ACCOUNT_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name} · {country.cityLabel}
                    </option>
                  ))}
                </select>
              </label>

              {/* Painel de Relógio ao Vivo */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-[#6B645D]">
                    <Clock className="w-3.5 h-3.5 text-[#C8235D]" />
                    <span>Horário do dia · {clockFormatted.period}</span>
                  </div>
                  <p className="font-mono-num text-2xl font-bold text-[#1C1917] mt-1">
                    {clockFormatted.timeStr}
                  </p>
                  <p className="text-xs text-[#57534E] capitalize mt-0.5">
                    {clockFormatted.dateStr}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-semibold text-[#1C1917]">
                    {countryMeta.cityLabel}
                  </p>
                  <p className="text-[11px] font-mono-num text-[#78716C] mt-0.5">
                    {playerState.timezone}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Simulação de IP do Jogador (Campo Técnico & Controle de Moderação) */}
          <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-[#C8235D]" />
                  <h3 className="font-display text-xl font-bold text-[#1C1917]">
                    Dados Técnicos de Conexão
                  </h3>
                </div>
                <span className="text-[11px] font-mono-num text-[#78716C]">
                  Moderação
                </span>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-[#6B645D]">IP Simulado da Sessão</span>
                  <span className="font-mono-num text-sm font-bold text-[#1C1917]">
                    {playerState.simulatedIp}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-[#6B645D]">Localidade Estimada</span>
                  <span className="text-xs font-semibold text-[#1C1917]">
                    {countryMeta.cityLabel} ({countryMeta.code})
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-[#6B645D]">ID da Conta</span>
                  <span className="font-mono-num text-xs text-[#57534E]">
                    {account.id}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#6B645D] mt-3 leading-relaxed">
                Este endereço IP simulado fica visível para auditoria de segurança da Staff no painel de Moderação e atualiza automaticamente ao trocar o país da conta.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#EFEAE3] flex items-center justify-between gap-3">
              <span className="text-[11px] font-mono-num text-[#78716C]">
                {playerState.simulatedIp} - {countryMeta.cityLabel}
              </span>
              <button
                type="button"
                onClick={handleRegenerateSimulatedIp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1C1917] bg-[#F5F2EC] hover:bg-[#EAE4DA] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Renovar IP Simulado
              </button>
            </div>
          </section>
        </div>
      </div>
      )}
    </div>
  );
};
