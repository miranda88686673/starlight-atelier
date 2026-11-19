import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Loader2, Mic, Send, ShieldAlert, ShieldCheck, Square, X } from 'lucide-react';
import {
  ChatSenderAvatar,
  RoomAvatarPresence,
  RoomChatMessage,
  RoomId,
  UserRole,
} from '../types/game';
import { useFirebase } from '../context/FirebaseContext';
import {
  sendRoomMessageToFirestore,
  subscribeRoomMessagesFromFirestore,
} from '../firebase';
import { normalizeUsername } from '../utils/storage';
import { ProfileAvatar } from './ProfileAvatar';
import { StaffRoleBadge, VipBadge } from './StaffDirectory';

export type ChatModCapability = 'admin' | 'ban_only' | 'cm' | 'none';

interface ChatBoxProps {
  roomId?: RoomId;
  roomName: string;
  messages: RoomChatMessage[];
  presencesInRoom: RoomAvatarPresence[];
  currentUsername: string;
  currentUserRole?: UserRole;
  currentUserIsVip?: boolean;
  modCapability: ChatModCapability;
  modLabel?: string;
  sentinelLabel?: string;
  mutedUntil?: number | null;
  onSendMessage: (
    text: string,
  ) => { blocked: boolean; reason?: string; messageId?: string } | void;
  onStaffCommand: (commandText: string) => string | null;
  onSelectProfile?: (
    username: string,
    fallbackAppearance?: ChatSenderAvatar & { role?: UserRole },
  ) => void;
}

/**
 * Caixa de Bate-Papo em Tempo Real por Sala (ChatBox.tsx).
 * Sincroniza mensagens em tempo real via coleção Firestore `messages` + Socket.IO,
 * exibe insígnias metálicas/diamante, selo VIP, suporte a /report e mute progressivo.
 */
export const ChatBox: React.FC<ChatBoxProps> = ({
  roomId,
  roomName,
  messages,
  presencesInRoom,
  currentUsername,
  currentUserRole = 'player',
  currentUserIsVip = false,
  modCapability,
  modLabel,
  sentinelLabel,
  mutedUntil,
  onSendMessage,
  onStaffCommand,
  onSelectProfile,
}) => {
  const { authReady, firebaseUser, signInWithGoogle } = useFirebase();
  const [firestoreMessages, setFirestoreMessages] = useState<RoomChatMessage[]>([]);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [draft, setDraft] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const shouldSendOnStopRef = useRef<boolean>(true);
  const recordTimerRef = useRef<number | null>(null);

  // Sincronização em tempo real com a coleção Firestore `messages` por sala (apenas com auth pronto)
  useEffect(() => {
    setFirestoreMessages([]);
    if (!authReady || !firebaseUser || !roomId) {
      return;
    }
    const unsubscribe = subscribeRoomMessagesFromFirestore(roomId, (nextMsgs) => {
      setFirestoreMessages(nextMsgs);
    });
    return () => unsubscribe();
  }, [authReady, firebaseUser, roomId]);

  const mergedMessages = useMemo(() => {
    const byId = new Map<string, RoomChatMessage>();
    for (const msg of firestoreMessages) {
      if (msg?.id) {
        byId.set(msg.id, msg);
      }
    }
    for (const msg of messages) {
      if (!msg?.id) continue;
      const existing = byId.get(msg.id);
      byId.set(msg.id, existing ? { ...existing, ...msg } : msg);
    }
    return Array.from(byId.values())
      .sort((a, b) => {
        if ((a.createdAt || 0) !== (b.createdAt || 0)) {
          return (a.createdAt || 0) - (b.createdAt || 0);
        }
        return a.id.localeCompare(b.id);
      })
      .slice(-100);
  }, [messages, firestoreMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mergedMessages.length]);

  useEffect(() => {
    if (!mutedUntil || mutedUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [mutedUntil]);

  const stopStreamResources = () => {
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  useEffect(() => {
    return () => {
      shouldSendOnStopRef.current = false;
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // Silencioso
      }
      stopStreamResources();
    };
  }, []);

  const muteRemainingSec =
    mutedUntil && mutedUntil > nowTs
      ? Math.max(1, Math.ceil((mutedUntil - nowTs) / 1000))
      : 0;
  const isMutedNow = muteRemainingSec > 0;
  const muteMin = Math.floor(muteRemainingSec / 60);
  const muteSec = muteRemainingSec % 60;

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Falha ao converter áudio gravado.'));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler áudio do microfone.'));
      reader.readAsDataURL(blob);
    });

  const stopRecordingAndSend = (sendAfterStop = true) => {
    shouldSendOnStopRef.current = sendAfterStop;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        stopStreamResources();
        setVoiceStatus('idle');
      }
    } else {
      stopStreamResources();
      setVoiceStatus('idle');
    }
  };

  const handleToggleMicrophone = async () => {
    if (voiceStatus === 'transcribing') return;

    if (voiceStatus === 'recording') {
      stopRecordingAndSend(true);
      return;
    }

    setWarning(null);

    if (isMutedNow) {
      setWarning(
        `Você está temporariamente silenciada (${muteMin}:${String(muteSec).padStart(2, '0')} restantes).`,
      );
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setWarning('Seu navegador não oferece suporte à captura de microfone neste ambiente.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const candidateMimes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
      ];
      const chosenMime =
        typeof MediaRecorder !== 'undefined'
          ? candidateMimes.find((m) => MediaRecorder.isTypeSupported(m))
          : undefined;

      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      shouldSendOnStopRef.current = true;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const shouldSend = shouldSendOnStopRef.current;
        const mimeType = recorder.mimeType || chosenMime || 'audio/webm';
        const chunks = audioChunksRef.current;
        stopStreamResources();
        setRecordingSeconds(0);

        if (!shouldSend) {
          setVoiceStatus('idle');
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        if (audioBlob.size < 350) {
          setVoiceStatus('idle');
          setWarning('Áudio muito curto. Fale um pouco mais ao usar o microfone.');
          return;
        }

        setVoiceStatus('transcribing');
        try {
          const audioBase64 = await blobToBase64(audioBlob);
          const response = await fetch('/api/audio/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType }),
          });
          const payload = (await response.json()) as {
            ok?: boolean;
            text?: string;
            error?: string;
          };

          if (!response.ok || !payload.ok) {
            setWarning(payload.error || 'Não foi possível transcrever sua fala.');
            setVoiceStatus('idle');
            return;
          }

          const spokenText = (payload.text ?? '').trim().slice(0, 180);
          if (!spokenText) {
            setWarning('Nenhuma fala detectada no microfone. Tente falar mais perto.');
            setVoiceStatus('idle');
            return;
          }

          const sendRes = onSendMessage(spokenText);
          if (sendRes && sendRes.blocked) {
            setWarning(
              sendRes.reason ?? 'Mensagem falada bloqueada pela moderação da sala.',
            );
          } else if (roomId && firebaseUser?.emailVerified) {
            void sendRoomMessageToFirestore({
              id: sendRes?.messageId,
              roomId,
              senderUsername: currentUsername,
              senderRole: currentUserRole,
              isVip: currentUserIsVip,
              text: spokenText,
            }).catch(() => {
              setWarning('Mensagem enviada na sala, mas falhou ao sincronizar no Firestore.');
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro ao processar áudio.';
          setWarning(msg);
        } finally {
          setVoiceStatus('idle');
        }
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setVoiceStatus('recording');

      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= 20) {
            stopRecordingAndSend(true);
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      stopStreamResources();
      setVoiceStatus('idle');
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Permissão de microfone negada. Libere o microfone no navegador para falar no chat.'
          : 'Não foi possível acessar o microfone agora.';
      setWarning(msg);
    }
  };

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

    if (roomId && firebaseUser?.emailVerified) {
      void sendRoomMessageToFirestore({
        id: sendRes?.messageId,
        roomId,
        senderUsername: currentUsername,
        senderRole: currentUserRole,
        isVip: currentUserIsVip,
        text: trimmed,
      }).catch(() => {
        setWarning('Mensagem enviada na sala, mas falhou ao sincronizar no Firestore.');
      });
    }

    setDraft('');
  };

  const handleEnableCloudChat = async () => {
    if (linkingGoogle) return;
    setWarning(null);
    setLinkingGoogle(true);
    try {
      await signInWithGoogle();
    } catch {
      setWarning('Não foi possível conectar sua conta Google para sincronizar o chat.');
    } finally {
      setLinkingGoogle(false);
    }
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
          {authReady && !firebaseUser && (
            <button
              type="button"
              onClick={handleEnableCloudChat}
              disabled={linkingGoogle}
              className="px-2 py-1 text-[10px] font-semibold rounded-md bg-[#FAF8F5] hover:bg-[#FCE8EF] text-[#C8235D] border border-[#E6E0D8] transition-colors cursor-pointer disabled:opacity-60"
            >
              {linkingGoogle ? 'Conectando...' : 'Conectar Google'}
            </button>
          )}
          {modCapability !== 'none' && (
            <span
              title={
                modCapability === 'admin'
                  ? 'Comandos disponíveis: /aviso, /evento, /ban usuario, /limpar'
                  : modCapability === 'cm'
                    ? 'Community Manager: Tickets e Loja Premium no painel'
                    : 'Moderador regional: comando disponível /ban usuario'
              }
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C8235D] whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {modLabel ??
                (modCapability === 'admin'
                  ? 'Administrador Geral'
                  : modCapability === 'cm'
                    ? 'Community Manager'
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
        {mergedMessages.map((msg) => {
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
        {voiceStatus !== 'idle' && (
          <div
            role="status"
            className={`px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between gap-2 border ${
              voiceStatus === 'recording'
                ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#B91C1C]'
                : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {voiceStatus === 'recording' ? (
                <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping shrink-0" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              )}
              <span className="truncate font-medium">
                {voiceStatus === 'recording'
                  ? `Gravando microfone (${recordingSeconds}s/20s) · Clique no quadrado para enviar`
                  : 'Convertendo sua fala para o balão do avatar...'}
              </span>
            </div>
            {voiceStatus === 'recording' && (
              <button
                type="button"
                onClick={() => stopRecordingAndSend(false)}
                title="Cancelar gravação"
                className="p-0.5 rounded hover:bg-[#FEE2E2] text-[#991B1B] cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            maxLength={180}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              isMutedNow
                ? 'Chat bloqueado temporariamente (mute ativo)...'
                : voiceStatus === 'recording'
                  ? 'Falando no microfone...'
                  : modCapability === 'admin'
                    ? 'Escreva, use microfone ou /aviso, /evento, /ban...'
                    : modCapability === 'ban_only'
                      ? 'Escreva, use microfone ou /ban usuario...'
                      : 'Escreva aqui, use microfone ou /report...'
            }
            className="flex-1 min-w-0 px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
          />
          <button
            type="button"
            onClick={handleToggleMicrophone}
            disabled={voiceStatus === 'transcribing'}
            title={
              voiceStatus === 'recording'
                ? 'Parar e falar no chat'
                : voiceStatus === 'transcribing'
                  ? 'Transcrevendo fala...'
                  : 'Falar no chat pelo microfone'
            }
            aria-label={
              voiceStatus === 'recording'
                ? 'Parar gravação e enviar fala'
                : 'Usar microfone para falar no jogo'
            }
            className={`px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center shrink-0 cursor-pointer border ${
              voiceStatus === 'recording'
                ? 'bg-[#DC2626] hover:bg-[#B91C1C] text-white border-[#DC2626] animate-pulse'
                : voiceStatus === 'transcribing'
                  ? 'bg-[#F5F2EC] text-[#78716C] border-[#E6E0D8] cursor-wait'
                  : 'bg-[#FAF8F5] hover:bg-[#FCE8EF] text-[#1C1917] hover:text-[#C8235D] border-[#E6E0D8]'
            }`}
          >
            {voiceStatus === 'recording' ? (
              <Square className="w-3.5 h-3.5 fill-white" />
            ) : voiceStatus === 'transcribing' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="submit"
            aria-label="Enviar mensagem"
            className="px-3 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
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
            Atendimento Community Manager disponível na aba Moderação · Use{' '}
            <span className="font-mono-num">/report usuario motivo</span> se necessário.
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
