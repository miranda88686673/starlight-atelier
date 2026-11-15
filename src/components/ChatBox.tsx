import React, { useEffect, useRef, useState } from 'react';
import { Clock, Send, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  ChatSenderAvatar,
  RoomAvatarPresence,
  RoomChatMessage,
  UserRole,
} from '../types/game';
import { normalizeUsername } from '../utils/storage';
import { ProfileAvatar } from './ProfileAvatar';
import { StaffRoleBadge, VipBadge } from './StaffDirectory';

export type ChatModCapability = 'admin' | 'ban_only' | 'cm' | 'none';

interface ChatBoxProps {
  roomName: string;
  messages: RoomChatMessage[];
  presencesInRoom: RoomAvatarPresence[];
  currentUsername: string;
  modCapability: ChatModCapability;
  modLabel?: string;
  sentinelLabel?: string;
  mutedUntil?: number | null;
  onSendMessage: (
    text: string,
  ) => { blocked: boolean; reason?: string } | void;
  onStaffCommand: (commandText: string) => string | null;
  onSelectProfile?: (
    username: string,
    fallbackAppearance?: ChatSenderAvatar & { role?: UserRole },
  ) => void;
}

/**
 * Caixa de Bate-Papo em Tempo Real por Sala (ChatBox.tsx).
 * Exibe insígnias metálicas/diamante, selo VIP, suporte a /report e contagem de mute progressivo.
 */
export const ChatBox: React.FC<ChatBoxProps> = ({
  roomName,
  messages,
  presencesInRoom,
  modCapability,
  modLabel,
  sentinelLabel,
  mutedUntil,
  onSendMessage,
  onStaffCommand,
  onSelectProfile,
}) => {
  const [draft, setDraft] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!mutedUntil || mutedUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [mutedUntil]);

  const muteRemainingSec =
    mutedUntil && mutedUntil > nowTs
      ? Math.max(1, Math.ceil((mutedUntil - nowTs) / 1000))
      : 0;
  const isMutedNow = muteRemainingSec > 0;
  const muteMin = Math.floor(muteRemainingSec / 60);
  const muteSec = muteRemainingSec % 60;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    setWarning(null);

    if (trimmed.startsWith('/')) {
      const cmd = trimmed.split(/\s+/)[0].toLowerCase();
      const isPublicCmd = cmd === '/report' || cmd === '/ajuda';
      if (!isPublicCmd && modCapability === 'none') {
        setWarning(
          'Comandos de moderação indisponíveis neste servidor para a sua conta. Use /report usuario motivo para denunciar.',
        );
        return;
      }
      const commandFeedback = onStaffCommand(trimmed);
      if (commandFeedback) {
        setWarning(commandFeedback);
      }
      setDraft('');
      return;
    }

    if (isMutedNow) {
      setWarning(
        `Você está temporariamente silenciada (${muteMin}:${String(muteSec).padStart(2, '0')} restantes).`,
      );
      return;
    }

    const sendRes = onSendMessage(trimmed);
    if (sendRes && sendRes.blocked) {
      setWarning(
        sendRes.reason ?? 'Mensagem bloqueada pelo sistema de moderação da sala.',
      );
      return;
    }

    setDraft('');
  };

  return (
    <aside className="bg-white border border-[#E6E0D8] rounded-xl flex flex-col h-[540px]">
      <div className="px-4 py-3.5 border-b border-[#EFEAE3] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#1C1917] truncate">
            Chat · {roomName}
          </h3>
          <p className="text-[11px] text-[#6B645D] font-mono-num">
            {presencesInRoom.length}{' '}
            {presencesInRoom.length === 1 ? 'avatar na sala' : 'avatares na sala'}
          </p>
        </div>

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {modCapability !== 'none' && (
            <span
              title={
                modCapability === 'admin'
                  ? 'Comandos disponíveis: /aviso, /evento, /ban usuario, /limpar'
                  : modCapability === 'cm'
                    ? 'Gerente da Comunidade: /evento texto, /aviso texto'
                    : 'Moderador regional: comando disponível /ban usuario'
              }
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C8235D] whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {modLabel ??
                (modCapability === 'admin'
                  ? 'Administrador Geral'
                  : modCapability === 'cm'
                    ? 'Gerente da Comunidade'
                    : 'Moderador')}
            </span>
          )}
          {sentinelLabel && (
            <span className="text-[10px] font-medium text-[#6B645D] whitespace-nowrap">
              {sentinelLabel}
            </span>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#FAF8F5]/60"
      >
        {messages.map((msg) => {
          const timeLabel = new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          });

          if (msg.senderRole === 'system') {
            return (
              <div
                key={msg.id}
                className="text-xs text-[#6B645D] bg-[#F2ECE3]/70 border border-[#E6DDD0] rounded-lg px-3 py-2 leading-relaxed"
              >
                <span className="font-semibold text-[#44403C]">
                  [{msg.senderUsername}]
                </span>{' '}
                {msg.text}
              </div>
            );
          }

          const livePresence = presencesInRoom.find(
            (p) => normalizeUsername(p.username) === normalizeUsername(msg.senderUsername),
          );
          const avatarSource = livePresence ?? msg.senderAvatar;
          const resolvedTier = msg.senderStaffTier ?? livePresence?.staffRoleTier;
          const resolvedVip = Boolean(msg.senderIsVip ?? livePresence?.isVip);

          const openSenderProfile = () =>
            onSelectProfile?.(msg.senderUsername, {
              equipped: avatarSource?.equipped ?? {},
              skinTone: avatarSource?.skinTone ?? 'pessego',
              avatarGender: avatarSource?.avatarGender ?? 'feminino',
              customAvatarUrl: avatarSource?.customAvatarUrl,
              avatarDisplayMode: avatarSource?.avatarDisplayMode ?? 'medoll',
              role: msg.senderRole === 'admin' ? 'admin' : 'player',
            });

          return (
            <div key={msg.id} className="flex items-start gap-2.5 text-xs leading-relaxed">
              <button
                type="button"
                onClick={openSenderProfile}
                title={`Ver perfil de ${msg.senderUsername}`}
                className="shrink-0 rounded-lg hover:ring-2 hover:ring-[#C8235D]/50 transition-shadow cursor-pointer"
              >
                <ProfileAvatar
                  username={msg.senderUsername}
                  equipped={avatarSource?.equipped ?? {}}
                  skinTone={avatarSource?.skinTone ?? 'pessego'}
                  avatarGender={avatarSource?.avatarGender ?? 'feminino'}
                  customAvatarUrl={avatarSource?.customAvatarUrl}
                  avatarDisplayMode={avatarSource?.avatarDisplayMode ?? 'medoll'}
                  sizeClass="w-8 h-8"
                  roundedClass="rounded-lg"
                />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1 min-w-0">
                    <button
                      type="button"
                      onClick={openSenderProfile}
                      title={`Ver perfil de ${msg.senderUsername}`}
                      className="font-semibold text-[#1C1917] hover:text-[#C8235D] hover:underline truncate cursor-pointer text-left"
                    >
                      {msg.senderUsername}
                    </button>
                    {resolvedTier ? (
                      <StaffRoleBadge tier={resolvedTier} compact />
                    ) : msg.senderRole === 'admin' ? (
                      <span className="text-[10px] font-semibold text-[#C8235D]">
                        · Equipe
                      </span>
                    ) : null}
                    {resolvedVip && <VipBadge compact />}
                  </div>
                  <span className="font-mono-num text-[10px] text-[#8C8278] shrink-0">
                    {timeLabel}
                  </span>
                </div>
                <p className="text-[#44403C] mt-0.5 break-words">{msg.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isMutedNow && (
        <div
          role="status"
          className="mx-3 mt-2 px-3 py-2 rounded-lg bg-[#FFFBEB] border border-[#FCD34D] text-[11px] text-[#92400E] flex items-center gap-1.5"
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>
            Mute temporário ativo · Restam{' '}
            <strong className="font-mono-num">
              {muteMin}:{String(muteSec).padStart(2, '0')}
            </strong>
          </span>
        </div>
      )}

      {warning && (
        <div
          role="status"
          className="mx-3 mt-2 px-3 py-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[11px] text-[#B91C1C] flex items-start gap-1.5"
        >
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-[#EFEAE3] bg-white rounded-b-xl space-y-1.5"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            maxLength={180}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              isMutedNow
                ? 'Chat bloqueado temporariamente (mute ativo)...'
                : modCapability === 'admin'
                  ? 'Escreva ou use /aviso, /evento, /ban, /limpar...'
                  : modCapability === 'cm'
                    ? 'Escreva ou use /evento texto ou /aviso texto...'
                    : modCapability === 'ban_only'
                      ? 'Escreva ou use /ban usuario...'
                      : 'Escreva aqui ou use /report usuario motivo...'
            }
            className="flex-1 px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
          />
          <button
            type="submit"
            aria-label="Enviar mensagem"
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Enviar
          </button>
        </div>

        {modCapability === 'admin' ? (
          <p className="text-[10px] text-[#78716C]">
            Comandos Administrador Geral: <span className="font-mono-num">/aviso texto</span> ·{' '}
            <span className="font-mono-num">/evento texto</span> ·{' '}
            <span className="font-mono-num">/ban usuario</span> ·{' '}
            <span className="font-mono-num">/limpar</span>
          </p>
        ) : modCapability === 'cm' ? (
          <p className="text-[10px] text-[#78716C]">
            Comandos Gerente da Comunidade: <span className="font-mono-num">/evento texto</span> ·{' '}
            <span className="font-mono-num">/aviso texto</span> ·{' '}
            <span className="font-mono-num">/report usuario motivo</span>
          </p>
        ) : modCapability === 'ban_only' ? (
          <p className="text-[10px] text-[#78716C]">
            Comando Moderador: <span className="font-mono-num">/ban usuario [motivo]</span> ·{' '}
            <span className="font-mono-num">/report usuario motivo</span>
          </p>
        ) : (
          <p className="text-[10px] text-[#78716C]">
            Dica: use <span className="font-mono-num">/report usuario motivo</span> para acionar o Moderador do servidor.
          </p>
        )}
      </form>
    </aside>
  );
};
