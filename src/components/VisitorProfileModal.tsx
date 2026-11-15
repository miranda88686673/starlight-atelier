import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Globe,
  Home,
  Lock,
  MessageCircle,
  Network,
  Send,
  UserPlus,
  X,
} from 'lucide-react';
import {
  PrivateMessage,
  PublicProfileSummary,
  UserAccount,
} from '../types/game';
import {
  DMS_KEY,
  getCountryMeta,
  loadPrivateMessagesBetween,
  normalizeUsername,
  sendPrivateMessage,
} from '../utils/storage';
import { PRESENCE_META } from './ProfileAccountView';
import { ProfileAvatar } from './ProfileAvatar';
import { StaffRoleBadge, VipBadge } from './StaffDirectory';
import { MeDollSvg } from './svg/MeDollSvg';

interface VisitorProfileModalProps {
  profile: PublicProfileSummary;
  currentUser: UserAccount;
  deletedItemIds: string[];
  isFriend: boolean;
  onToggleFriend: (username: string) => void;
  onVisitSuite: (profile: PublicProfileSummary) => void;
  onClose: () => void;
}

function getPeriodLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Manhã';
  if (hour >= 12 && hour < 18) return 'Tarde';
  if (hour >= 18 && hour < 24) return 'Noite';
  return 'Madrugada';
}

/**
 * Modal de Perfil Público Visitante de qualquer jogador ou membro da Staff.
 * - Exibe MeDoll completa, foto oficial, crachá da Staff, nível, status, bio, país e relógio local.
 * - Permite Adicionar Amigo, Enviar Mensagem Privada e Visitar a Suíte do usuário.
 * - Oculta o IP simulado de visitantes comuns (exibe apenas para o próprio dono ou Admin/Staff).
 */
export const VisitorProfileModal: React.FC<VisitorProfileModalProps> = ({
  profile,
  currentUser,
  deletedItemIds,
  isFriend,
  onToggleFriend,
  onVisitSuite,
  onClose,
}) => {
  const isSelf =
    normalizeUsername(currentUser.username) === normalizeUsername(profile.username);
  // Regra de privacidade: IP simulado só aparece para o próprio dono da conta ou Admin/Staff
  const canViewTechnicalIp = isSelf || currentUser.role === 'admin';

  const [now, setNow] = useState<Date>(() => new Date());
  const [dmOpen, setDmOpen] = useState(false);
  const [dmDraft, setDmDraft] = useState('');
  const [messages, setMessages] = useState<PrivateMessage[]>(() =>
    loadPrivateMessagesBetween(currentUser.username, profile.username),
  );
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Atualiza relógio local do usuário visitado a cada segundo
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Sincroniza mensagens privadas ao trocar de perfil ou receber mensagem em outra aba
  useEffect(() => {
    setMessages(loadPrivateMessagesBetween(currentUser.username, profile.username));

    const onStorage = (e: StorageEvent) => {
      if (e.key === DMS_KEY) {
        setMessages(loadPrivateMessagesBetween(currentUser.username, profile.username));
      }
    };
    window.addEventListener('storage', onStorage);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('starlight_atelier_realtime_v1');
      channel.onmessage = (event) => {
        if (event.data?.type === 'dm:sync') {
          setMessages(loadPrivateMessagesBetween(currentUser.username, profile.username));
        }
      };
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, [currentUser.username, profile.username]);

  // Fecha o modal com tecla Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const countryMeta = getCountryMeta(profile.countryCode);
  const presenceMeta = PRESENCE_META[profile.presenceStatus];

  const clockInfo = useMemo(() => {
    try {
      const timeStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: profile.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);

      const hourNum = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: profile.timezone,
          hour: 'numeric',
          hour12: false,
        }).format(now),
      );

      return {
        timeStr,
        period: getPeriodLabel(Number.isNaN(hourNum) ? now.getHours() : hourNum),
      };
    } catch {
      return {
        timeStr: now.toLocaleTimeString('pt-BR'),
        period: getPeriodLabel(now.getHours()),
      };
    }
  }, [now, profile.timezone]);

  const handleToggleFriendClick = () => {
    onToggleFriend(profile.username);
    setActionFeedback(
      isFriend
        ? `${profile.username} removida da lista de amigos.`
        : `${profile.username} adicionada como amiga!`,
    );
    window.setTimeout(() => setActionFeedback(null), 2400);
  };

  const handleSendDm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmDraft.trim()) return;
    const updated = sendPrivateMessage(currentUser.username, profile.username, dmDraft);
    setMessages(updated);
    setDmDraft('');
    setActionFeedback(`Mensagem privada enviada para ${profile.username}.`);
    window.setTimeout(() => setActionFeedback(null), 2400);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil público de ${profile.username}`}
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#E6E0D8] rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra Superior do Modal */}
        <div className="px-6 py-4 border-b border-[#EFEAE3] bg-[#FAF8F5] flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h2 className="font-display text-2xl font-bold text-[#1C1917] truncate">
              {profile.displayName}
            </h2>
            {profile.displayName.toLowerCase() !== profile.username.toLowerCase() && (
              <span className="text-xs font-semibold font-mono-num text-[#6B645D]">
                {profile.username}
              </span>
            )}

            {profile.staffRoleTier ? (
              <StaffRoleBadge tier={profile.staffRoleTier} />
            ) : profile.role === 'admin' ? (
              <StaffRoleBadge tier="admin" />
            ) : (
              <span className="text-xs font-semibold text-[#6B645D]">
                · Estilista da Comunidade
              </span>
            )}

            {profile.isVip && <VipBadge />}

            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${presenceMeta.textClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${presenceMeta.dotClass}`} />
              {presenceMeta.label}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar perfil"
            className="p-1.5 text-[#6B645D] hover:text-[#1C1917] rounded-lg hover:bg-[#EFEAE3] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal: Avatar Completo (Esquerda) + Informações & Ações (Direita) */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Vitrine Visual da MeDoll + Foto Oficial */}
          <div className="md:col-span-5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3] p-4 flex flex-col items-center justify-between relative overflow-hidden min-h-[340px]">
            {/* Arco editorial de estúdio */}
            <div
              className="absolute top-5 w-48 h-72 rounded-t-full bg-[#F2ECE3]/90 border border-[#E6DDD0]"
              aria-hidden="true"
            />

            {/* Miniatura da Foto Customizada no canto caso o jogador use foto enviada */}
            {profile.avatarDisplayMode === 'photo' && profile.customAvatarUrl && (
              <div className="absolute top-3 left-3 z-20 flex flex-col items-center">
                <ProfileAvatar
                  username={profile.username}
                  equipped={profile.equipped}
                  skinTone={profile.skinTone}
                  avatarGender={profile.avatarGender}
                  customAvatarUrl={profile.customAvatarUrl}
                  avatarDisplayMode="photo"
                  deletedItemIds={deletedItemIds}
                  sizeClass="w-14 h-14"
                  roundedClass="rounded-xl"
                />
                <span className="text-[10px] font-medium text-[#6B645D] mt-1">
                  Foto oficial
                </span>
              </div>
            )}

            <div className="relative z-10 w-[170px] h-[300px] my-auto">
              <MeDollSvg
                equipped={profile.equipped}
                skinTone={profile.skinTone}
                avatarGender={profile.avatarGender}
                deletedItemIds={deletedItemIds}
              />
            </div>

            <div className="relative z-10 w-full pt-3 border-t border-[#E6DDD0] flex items-center justify-between text-xs text-[#57534E] font-mono-num">
              <span>Nível {profile.level}</span>
              <span>
                {profile.avatarGender === 'masculino'
                  ? 'Corpo Masculino'
                  : profile.avatarGender === 'neutro'
                    ? 'Corpo Neutro'
                    : 'Corpo Feminino'}
              </span>
            </div>
          </div>

          {/* Dados Pessoais, Localidade, Privacidade e Botões de Interação */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              {profile.staffRoleTitle && (
                <p className="text-xs font-semibold text-[#C8235D]">
                  Cargo Oficial: {profile.staffRoleTitle}
                </p>
              )}

              {/* Biografia / Recado */}
              <div>
                <h3 className="text-xs font-semibold text-[#78716C]">
                  Biografia / Recado
                </h3>
                <p className="mt-1.5 text-sm text-[#1C1917] bg-[#FAF8F5] border border-[#EFEAE3] rounded-xl px-4 py-3 leading-relaxed">
                  “{profile.bio || 'Explorando estilos no Starlight Atelier.'}”
                </p>
              </div>

              {/* País e Horário Local Sincronizado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3]">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B645D]">
                    <Globe className="w-3.5 h-3.5 text-[#C8235D]" />
                    <span>País da Conta</span>
                  </div>
                  <p className="text-xs font-bold text-[#1C1917] mt-1">
                    {countryMeta.name}
                  </p>
                  <p className="text-[11px] text-[#6B645D] mt-0.5">
                    {countryMeta.cityLabel}
                    {profile.serverRegion ? ` · Servidor ${profile.serverRegion}` : ''}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3]">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B645D]">
                    <Clock className="w-3.5 h-3.5 text-[#C8235D]" />
                    <span>Horário Local · {clockInfo.period}</span>
                  </div>
                  <p className="font-mono-num text-sm font-bold text-[#1C1917] mt-1">
                    {clockInfo.timeStr}
                  </p>
                  <p className="text-[11px] font-mono-num text-[#6B645D] mt-0.5 truncate">
                    {profile.timezone}
                  </p>
                </div>
              </div>

              {/* Regra de Privacidade: IP simulado visível apenas ao próprio usuário ou Admin/Staff */}
              {canViewTechnicalIp ? (
                <div className="p-3.5 rounded-xl bg-[#FDF2F5]/60 border border-[#F3D0DC] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Network className="w-4 h-4 text-[#C8235D] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#9E1646]">
                        IP Simulado (Visível apenas para Moderação / Dono)
                      </p>
                      <p className="font-mono-num text-xs font-bold text-[#1C1917] truncate">
                        {profile.simulatedIp} - {countryMeta.cityLabel}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3] flex items-center gap-2 text-[11px] text-[#78716C]">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Dados técnicos de conexão (IP) ocultos para privacidade do jogador.
                  </span>
                </div>
              )}

              {actionFeedback && (
                <p
                  role="status"
                  className="text-xs font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-2 rounded-lg"
                >
                  {actionFeedback}
                </p>
              )}
            </div>

            {/* Botões de Interação Rápida */}
            <div className="pt-4 border-t border-[#EFEAE3] flex flex-wrap items-center gap-2.5">
              {!isSelf && (
                <button
                  type="button"
                  onClick={handleToggleFriendClick}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isFriend
                      ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0] hover:bg-[#DCFCE7]'
                      : 'bg-[#FAF8F5] text-[#1C1917] border-[#E6E0D8] hover:bg-[#F2ECE3]'
                  }`}
                >
                  {isFriend ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Amigo Adicionado
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5 text-[#C8235D]" />
                      Adicionar Amigo
                    </>
                  )}
                </button>
              )}

              {!isSelf && (
                <button
                  type="button"
                  onClick={() => setDmOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dmOpen
                      ? 'bg-[#1C1917] text-white border-[#1C1917]'
                      : 'bg-[#FAF8F5] text-[#1C1917] border-[#E6E0D8] hover:bg-[#F2ECE3]'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Enviar Mensagem Privada
                  {messages.length > 0 && (
                    <span className="font-mono-num opacity-75">({messages.length})</span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onVisitSuite(profile);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-auto"
              >
                <Home className="w-3.5 h-3.5" />
                {isSelf ? 'Ir para Minha Suíte' : 'Visitar Suíte'}
              </button>
            </div>
          </div>
        </div>

        {/* Gaveta Expansível de Mensagem Privada (DM) */}
        {dmOpen && !isSelf && (
          <div className="px-6 pb-6 pt-2 border-t border-[#EFEAE3] bg-[#FAF8F5]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-[#1C1917]">
                Mensagem Privada com {profile.username}
              </h4>
              <span className="text-[11px] text-[#6B645D]">
                Conversa salva localmente
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-2 mb-3 p-3 rounded-xl bg-white border border-[#E6E0D8]">
              {messages.length === 0 ? (
                <p className="text-xs text-[#78716C] text-center py-2">
                  Nenhuma mensagem ainda. Diga olá para {profile.username}!
                </p>
              ) : (
                messages.map((m) => {
                  const sentByMe =
                    normalizeUsername(m.fromUsername) ===
                    normalizeUsername(currentUser.username);
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${sentByMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-1.5 rounded-lg text-xs ${
                          sentByMe
                            ? 'bg-[#C8235D] text-white'
                            : 'bg-[#F5F2EC] text-[#1C1917]'
                        }`}
                      >
                        {m.text}
                      </div>
                      <span className="text-[10px] font-mono-num text-[#8C8278] mt-0.5">
                        {m.fromUsername} ·{' '}
                        {new Date(m.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendDm} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={220}
                value={dmDraft}
                onChange={(e) => setDmDraft(e.target.value)}
                placeholder={`Escreva uma mensagem privada para ${profile.username}...`}
                className="flex-1 px-3 py-2 text-xs bg-white border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar DM
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
