import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Coins,
  Globe,
  Layers,
  LifeBuoy,
  Lock,
  LogIn,
  Mail,
  MessageCircle,
  Moon,
  PlusCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  User,
  UserPlus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import couplePortraitImg from '../assets/images/atelier_couple_portrait_1794768226559.jpg';
import floralCrestImg from '../assets/images/atelier_floral_crest_1794768226415.jpg';
import { useGlobalState } from '../core/state/GlobalStateManager';
import {
  AvatarGender,
  ServerRegion,
  SupportChatMessage,
  SupportTicket,
  UserAccount,
} from '../types/game';
import { soundEngine } from '../utils/sound';
import type { LoginXpAwardResult } from '../utils/levelSystem';
import {
  ADMIN_OWNER_EMAIL,
  loginAccount,
  registerAccount,
  syncAccountAndProgressFromServer,
} from '../utils/storage';

interface LoginModalProps {
  onAuthenticated: (
    account: UserAccount,
    loginXpAward?: LoginXpAwardResult,
  ) => void;
}

const AVATAR_OPTIONS: Array<{
  id: AvatarGender;
  label: string;
  desc: string;
}> = [
  { id: 'feminino', label: 'Feminino', desc: 'Visual clássico atelier' },
  { id: 'masculino', label: 'Masculino', desc: 'Alfaiataria estruturada' },
  { id: 'neutro', label: 'Neutro', desc: 'Silhueta contemporânea' },
];

const SERVER_OPTIONS: Array<{
  id: ServerRegion;
  label: string;
  desc: string;
}> = [
  { id: 'BR', label: 'Brasileiro (BR)', desc: 'Salas e chat em Português' },
  { id: 'ES', label: 'Espanhol (ES)', desc: 'Salas e chat em Español' },
  { id: 'EN', label: 'Inglês (EN)', desc: 'Salas e chat em English' },
];

/** Filigrana ornamental dourada reutilizável para os cantos das molduras clássicas */
const GoldCornerFiligree: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
    className={`w-8 h-8 text-[#B7965B] pointer-events-none select-none ${className}`}
  >
    <path
      d="M4 34C4 18 10 8 28 5C18 8 12 15 11 25C15 19 20 15 27 14C20 18 16 23 15 31C11 27 8 28 4 34Z"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 42C8 35 12 31 17 31C20 31 22 33 21 36C20 38 17 38 16 36"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
    <path
      d="M32 7C36 7 39 9 39 12C39 14 37 16 34 15"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
    <circle cx="8" cy="8" r="1.6" fill="currentColor" />
  </svg>
);

/** Ramos botânicos dourados decorativos nos cantos do plano de fundo em linho */
const BackdropBotanicalCorner: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 360 360"
    fill="none"
    aria-hidden="true"
    className={`pointer-events-none select-none text-[#9B7E4B]/55 ${className}`}
  >
    {/* Flor principal estilo peônia/rosa */}
    <g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M115 245C115 215 140 192 170 192C200 192 224 215 224 245C224 276 200 300 170 300C140 300 115 276 115 245Z" fill="#DFD0B8" fillOpacity="0.35" />
      <path d="M138 245C138 228 152 214 170 214C188 214 202 228 202 245C202 262 188 276 170 276C152 276 138 262 138 245Z" />
      <path d="M154 245C154 236 161 229 170 229C179 229 186 236 186 245C186 254 179 261 170 261C161 261 154 254 154 245Z" />
      <path d="M170 245L140 205M170 245L205 210M170 245L210 265M170 245L135 275" strokeOpacity="0.6" />
      {/* Segunda flor lateral */}
      <circle cx="72" cy="185" r="36" fill="#DFD0B8" fillOpacity="0.28" />
      <circle cx="72" cy="185" r="18" />
      <path d="M72 185L48 164M72 185L98 168M72 185L94 208M72 185L50 206" strokeOpacity="0.6" />
      {/* Folhagens e ramos delicados */}
      <path d="M18 330C62 290 100 265 130 250" />
      <path d="M108 190C82 145 78 96 95 45C116 86 122 135 108 190Z" fill="#DFD0B8" fillOpacity="0.22" />
      <path d="M155 190C155 136 178 86 222 54C216 105 196 155 155 190Z" fill="#DFD0B8" fillOpacity="0.22" />
      <path d="M210 225C255 198 302 195 344 212C302 238 258 244 210 225Z" fill="#DFD0B8" fillOpacity="0.22" />
      <path d="M196 278C244 275 288 292 320 326C272 325 232 308 196 278Z" fill="#DFD0B8" fillOpacity="0.22" />
      <path d="M40 240C20 200 18 158 34 118C52 154 56 196 40 240Z" fill="#DFD0B8" fillOpacity="0.2" />
    </g>
  </svg>
);

/**
 * Tela Inicial de Acesso (Login e Criação de Conta) fiel à referência visual editorial Starlight Atelier.
 */
export const LoginModal: React.FC<LoginModalProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Campos de Login
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Campos de Cadastro
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAvatarGender, setRegAvatarGender] =
    useState<AvatarGender>('feminino');
  const [regServerRegion, setRegServerRegion] = useState<ServerRegion>('BR');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Instrumental de música eletrônica procedural (Web Audio API)
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicIntervalRef = useRef<number | null>(null);

  const toggleElectronicMusic = () => {
    if (isPlayingMusic) {
      if (musicIntervalRef.current) {
        window.clearInterval(musicIntervalRef.current);
        musicIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setIsPlayingMusic(false);
    } else {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const notes = [110, 164.81, 220, 329.63, 440, 329.63, 220, 164.81];
        let step = 0;

        const playStep = () => {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
          const t = ctx.currentTime;

          const oscBass = ctx.createOscillator();
          const gainBass = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          
          oscBass.type = 'sawtooth';
          oscBass.frequency.setValueAtTime(step % 2 === 0 ? 55 : 82.5, t);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(600, t);
          filter.frequency.exponentialRampToValueAtTime(120, t + 0.2);

          gainBass.gain.setValueAtTime(0.15, t);
          gainBass.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

          oscBass.connect(filter);
          filter.connect(gainBass);
          gainBass.connect(ctx.destination);

          oscBass.start(t);
          oscBass.stop(t + 0.25);

          const oscArp = ctx.createOscillator();
          const gainArp = ctx.createGain();
          oscArp.type = 'square';
          oscArp.frequency.setValueAtTime(notes[step % notes.length], t);

          gainArp.gain.setValueAtTime(0.08, t);
          gainArp.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

          oscArp.connect(gainArp);
          gainArp.connect(ctx.destination);

          oscArp.start(t);
          oscArp.stop(t + 0.2);

          step++;
        };

        musicIntervalRef.current = window.setInterval(playStep, 230);
        setIsPlayingMusic(true);
      } catch (err) {
        console.error('AudioContext error:', err);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (musicIntervalRef.current) clearInterval(musicIntervalRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  // Recuperação de senha
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotPreviewToken, setForgotPreviewToken] = useState<string | null>(
    null,
  );
  const [forgotStep, setForgotStep] = useState<'request' | 'reset' | 'done'>(
    'request',
  );
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Sistema Oficial de Tickets Salvos (Tela Inicial -> Community Manager)
  const GUEST_TICKETS_STORAGE_KEY = 'starlight_guest_ticket_ids_v1';
  const { supportTickets, refreshSupportTickets } = useGlobalState();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpUsername, setHelpUsername] = useState('');
  const [helpEmail, setHelpEmail] = useState('');
  const [helpCategory, setHelpCategory] =
    useState<SupportTicket['category']>('login');
  const [helpSubject, setHelpSubject] = useState('');
  const [helpInput, setHelpInput] = useState('');
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpFeedback, setHelpFeedback] = useState<string | null>(null);
  const [selectedGuestTicketId, setSelectedGuestTicketId] = useState<string | null>(null);
  const [ticketReplyInput, setTicketReplyInput] = useState('');
  const [savedGuestTicketIds, setSavedGuestTicketIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(GUEST_TICKETS_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (showHelpModal) {
      void refreshSupportTickets();
    }
  }, [refreshSupportTickets, showHelpModal]);

  const myLoginTickets = useMemo(() => {
    const typedName = (helpUsername || loginUsername).trim().toLowerCase();
    return supportTickets.filter(
      (t) =>
        savedGuestTicketIds.includes(t.id) ||
        (typedName.length >= 2 && t.requesterUsername.trim().toLowerCase() === typedName),
    );
  }, [helpUsername, loginUsername, savedGuestTicketIds, supportTickets]);

  const activeGuestTicket = useMemo(
    () => myLoginTickets.find((t) => t.id === selectedGuestTicketId) ?? null,
    [myLoginTickets, selectedGuestTicketId],
  );

  const isAuthorizedAdminEmailEntered =
    loginUsername.trim().toLowerCase() === ADMIN_OWNER_EMAIL;

  const handleOpenHelpModal = () => {
    setHelpUsername((prev) => prev || loginUsername.trim());
    setHelpFeedback(null);
    setShowHelpModal(true);
    void refreshSupportTickets();
  };

  const rememberGuestTicketId = (ticketId: string) => {
    setSavedGuestTicketIds((prev) => {
      const next = prev.includes(ticketId) ? prev : [ticketId, ...prev].slice(0, 40);
      try {
        window.localStorage.setItem(GUEST_TICKETS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Silencioso
      }
      return next;
    });
  };

  const handleCreateLoginTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = helpInput.trim();
    if (!text || helpLoading) return;
    setHelpLoading(true);
    setHelpFeedback(null);

    try {
      const requester =
        helpUsername.trim() || loginUsername.trim() || 'Visitante_Login';
      const firstMsg: SupportChatMessage = {
        id: `pmsg_${Date.now()}`,
        senderRole: 'player',
        sender: 'user',
        senderName: requester,
        text,
        createdAt: Date.now(),
      };
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterUsername: requester,
          email: helpEmail.trim() || undefined,
          category: helpCategory,
          serverRegion: regServerRegion,
          subject: (helpSubject.trim() || text).slice(0, 90),
          messages: [firstMsg],
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        ticket?: SupportTicket;
        error?: string;
      };
      if (data.ok && data.ticket) {
        rememberGuestTicketId(data.ticket.id);
        setSelectedGuestTicketId(data.ticket.id);
        setHelpInput('');
        setHelpSubject('');
        setHelpFeedback(
          `Ticket #${data.ticket.id} enviado e salvo! O Community Manager responderá diretamente aqui e a conversa ficará visível para ambos.`,
        );
        soundEngine.playPurchase();
        await refreshSupportTickets();
      } else {
        setHelpFeedback(data.error || 'Não foi possível criar o Ticket.');
      }
    } catch {
      setHelpFeedback('Erro de conexão ao enviar Ticket para o servidor.');
    } finally {
      setHelpLoading(false);
    }
  };

  const handleSendGuestTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGuestTicket || helpLoading) return;
    const text = ticketReplyInput.trim();
    if (!text) return;
    setHelpLoading(true);
    try {
      const requester =
        helpUsername.trim() || activeGuestTicket.requesterUsername || 'Jogador';
      const res = await fetch(`/api/support/tickets/${activeGuestTicket.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          senderName: requester,
          senderRole: 'player',
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setTicketReplyInput('');
        soundEngine.playPurchase();
        await refreshSupportTickets();
      } else {
        setHelpFeedback(data.error || 'Não foi possível enviar sua resposta.');
      }
    } catch {
      setHelpFeedback('Falha de rede ao enviar resposta no Ticket.');
    } finally {
      setHelpLoading(false);
    }
  };

  const handleSwitchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setErrorMsg(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return;
    setErrorMsg(null);
    setAuthSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginUsername,
          password: loginPassword,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        account?: UserAccount;
        progress?: Parameters<typeof syncAccountAndProgressFromServer>[0]['progress'];
        loginXpAward?: LoginXpAwardResult;
        accounts?: UserAccount[];
        worldState?: Parameters<
          typeof syncAccountAndProgressFromServer
        >[0]['worldState'];
      };
      if (data.ok && data.account) {
        syncAccountAndProgressFromServer({
          account: data.account,
          progress: data.progress,
          accounts: data.accounts,
          worldState: data.worldState,
        });
        soundEngine.playPurchase();
        onAuthenticated(data.account, data.loginXpAward);
        return;
      }
      if (res.status === 401 || res.status === 400) {
        setErrorMsg(data.error || 'E-mail, nome do personagem ou senha inválidos.');
        soundEngine.playModAction();
        return;
      }
    } catch {
      // Fallback local apenas se servidor inacessível
    } finally {
      setAuthSubmitting(false);
    }

    const fallback = loginAccount({
      username: loginUsername,
      password: loginPassword,
    });
    if (!fallback.ok) {
      setErrorMsg(fallback.error);
      soundEngine.playModAction();
      return;
    }
    soundEngine.playPurchase();
    onAuthenticated(fallback.account, fallback.loginXpAward);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return;
    setErrorMsg(null);
    setAuthSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword,
          avatarGender: regAvatarGender,
          serverRegion: regServerRegion,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        account?: UserAccount;
        progress?: Parameters<typeof syncAccountAndProgressFromServer>[0]['progress'];
        accounts?: UserAccount[];
        worldState?: Parameters<
          typeof syncAccountAndProgressFromServer
        >[0]['worldState'];
      };
      if (data.ok && data.account) {
        syncAccountAndProgressFromServer({
          account: data.account,
          progress: data.progress,
          accounts: data.accounts,
          worldState: data.worldState,
        });
        soundEngine.playPurchase();
        onAuthenticated(data.account);
        return;
      }
      if (res.status >= 400 && res.status < 500) {
        setErrorMsg(data.error || 'Não foi possível concluir o cadastro.');
        soundEngine.playModAction();
        return;
      }
    } catch {
      // Fallback local caso servidor indisponível
    } finally {
      setAuthSubmitting(false);
    }

    const fallback = registerAccount({
      username: regUsername,
      email: regEmail,
      password: regPassword,
      avatarGender: regAvatarGender,
      serverRegion: regServerRegion,
    });
    if (!fallback.ok) {
      setErrorMsg(fallback.error);
      soundEngine.playModAction();
      return;
    }
    soundEngine.playPurchase();
    onAuthenticated(fallback.account);
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-10 text-white bg-[#050505]">
      {/* Luzes brilhantes espelhadas varrendo toda a tela preta (roxo, verde e amarelo) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-[-10%] w-[600px] h-[600px] bg-purple-600/35 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute bottom-10 left-[20%] w-[550px] h-[550px] bg-emerald-500/30 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute top-1/3 left-[40%] w-[500px] h-[500px] bg-yellow-500/30 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '5s' }} />

        {/* Luzes espelhadas no lado oposto para varrer toda a tela */}
        <div className="absolute top-20 right-[-10%] w-[600px] h-[600px] bg-emerald-500/30 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-20 right-[20%] w-[550px] h-[550px] bg-purple-600/35 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/2 right-[40%] w-[500px] h-[500px] bg-yellow-500/30 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '9s' }} />
      </div>

      {/* Botão de Música Eletrônica no Topo Direito */}
      <div className="absolute top-6 right-6 z-30">
        <button
          type="button"
          onClick={toggleElectronicMusic}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/80 border border-purple-500/50 text-purple-200 hover:text-white hover:border-purple-400 text-xs font-semibold backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all cursor-pointer"
        >
          {isPlayingMusic ? (
            <Volume2 className="w-4 h-4 text-green-400 animate-bounce" />
          ) : (
            <VolumeX className="w-4 h-4 text-purple-400" />
          )}
          <span>{isPlayingMusic ? 'Música Eletrônica (Tocando)' : 'Ativar Música Eletrônica'}</span>
        </button>
      </div>

      {/* Container principal com os dois cartões editoriais estilo vidro fosco */}
      <div className="relative z-10 w-full max-w-[1080px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
        {/* CARTÃO ESQUERDO: Apresentação / Mundo Virtual & Social */}
        <section className="lg:col-span-6 bg-white/85 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/50 shadow-2xl flex flex-col justify-between">
          <div>
            {/* Topo: Logo Nocturne Vale Club */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-gray-200/80">
              <div className="w-12 h-12 rounded-xl bg-[#761334]/10 flex items-center justify-center shrink-0">
                <Moon className="w-6 h-6 text-[#761334]" />
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-[28px] font-bold text-[#1C1917] tracking-tight">
                  Nocturne Vale Club
                </h1>
                <p className="text-xs text-[#5C5149] font-medium">
                  Mundo Virtual &amp; Social
                </p>
              </div>
            </div>

            {/* Texto Descritivo e Polaroid */}
            <div className="my-5 grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              <div className="sm:col-span-7 space-y-3">
                <span className="inline-block px-3 py-1 rounded-full bg-[#761334]/10 text-[#761334] text-[11px] font-semibold tracking-wider uppercase">
                  MUNDO VIRTUAL &amp; SOCIAL
                </span>
                <p className="font-display text-[15px] sm:text-[16px] text-[#2C231E] leading-relaxed">
                  Crie seu personagem, participe de festas incríveis com seus amigos na cobertura, decore suas salas e explore um mundo de possibilidades com jogadores do mundo todo!
                </p>
              </div>

              {/* Polaroid Photo Frame */}
              <div className="sm:col-span-5 flex justify-center">
                <div className="bg-white p-2.5 pb-6 rounded-lg shadow-xl border border-gray-200 rotate-2 hover:rotate-0 transition-transform w-full max-w-[170px]">
                  <div className="rounded overflow-hidden bg-gray-900 aspect-[3/4]">
                    <img
                      src={couplePortraitImg}
                      alt="Avatar Selfie no Nocturne Vale Club"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <p className="text-[11px] font-display text-center text-gray-700 mt-2">
                    Nocturne Selfie
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé do cartão esquerdo */}
          <div className="pt-4 border-t border-gray-200/80 flex flex-wrap items-center justify-between gap-2.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gray-100/90 border border-gray-200 text-xs font-medium text-[#2E2520]">
              <Layers className="w-3.5 h-3.5 text-[#761334] shrink-0" />
              <span>Moda, Amigos &amp; Festas · Servidores BR, ES &amp; EN</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gray-100/90 border border-gray-200 text-xs font-medium text-[#2E2520]">
              <Coins className="w-3.5 h-3.5 text-[#761334] shrink-0" />
              <span>Comece agora!</span>
            </div>
          </div>
        </section>

        {/* CARTÃO DIREITO: Fichário de Login / Criar Nova Conta */}
        <section className="lg:col-span-6 bg-white/90 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/50 shadow-2xl flex flex-col justify-between">
          <div className="flex-1 flex flex-col">
            {/* Abas superiores em estilo fichário conectado ao corpo */}
            <div
              className="grid grid-cols-2 items-end relative z-10 -mb-[1px]"
              role="tablist"
              aria-label="Modo de autenticação"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => handleSwitchMode('login')}
                className={`py-3 text-sm sm:text-[15px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-[#FAF8F4] text-[#3B2E28] rounded-t-xl border-t border-l border-r border-[#D6CEC2] shadow-[0_-2px_6px_rgba(61,44,31,0.04)]'
                    : 'bg-transparent text-[#54473E] hover:text-[#2E2520] rounded-t-xl'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => handleSwitchMode('register')}
                className={`py-3 text-sm sm:text-[15px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-[#FAF8F4] text-[#3B2E28] rounded-t-xl border-t border-l border-r border-[#D6CEC2] shadow-[0_-2px_6px_rgba(61,44,31,0.04)]'
                    : 'bg-transparent text-[#54473E] hover:text-[#2E2520] rounded-t-xl'
                }`}
              >
                Criar Nova Conta
              </button>
            </div>

            {/* Corpo do fichário */}
            <div
              className={`bg-[#FAF8F4] border border-[#D6CEC2] shadow-[0_8px_22px_rgba(61,44,31,0.08)] px-6 sm:px-9 py-7 sm:py-8 flex-1 flex flex-col justify-center ${
                mode === 'login'
                  ? 'rounded-b-xl rounded-tr-xl'
                  : 'rounded-b-xl rounded-tl-xl'
              }`}
            >
              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 px-4 py-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#B91C1C]"
                >
                  {errorMsg}
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="text-center pb-1">
                    <h2 className="font-display text-3xl sm:text-[34px] font-semibold text-[#1E1815] leading-tight">
                      Acessar seu Avatar
                    </h2>
                    <p className="text-xs sm:text-[13px] text-[#4A3F38] mt-1.5 leading-relaxed max-w-sm mx-auto">
                      Entre com seu E-mail ou Nome do Personagem para sincronizar seu
                      guarda-roupa, nível e sala em tempo real.
                    </p>
                  </div>

                  {/* Campo Email/Nome */}
                  <div className="pt-1">
                    <label htmlFor="login-identifier" className="sr-only">
                      E-mail ou Nome do Personagem
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#736961] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-identifier"
                        type="text"
                        required
                        autoComplete="username"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="E-mail ou Nome do Personagem"
                        className="w-full pl-10 pr-4 py-3 text-sm text-[#1E1815] placeholder:text-[#736961] bg-[#EAE7E2] border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334] focus:bg-[#F3F0EB] transition-colors"
                      />
                    </div>
                  </div>

                  {isAuthorizedAdminEmailEntered && (
                    <div className="px-3.5 py-2 rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] flex items-center gap-2 text-xs text-[#0C4A6E]">
                      <ShieldCheck className="w-4 h-4 text-[#0284C7] shrink-0" />
                      <span>
                        Identidade de Administração Geral reconhecida (
                        {ADMIN_OWNER_EMAIL}). Informe sua senha para autenticar.
                      </span>
                    </div>
                  )}

                  {/* Campo Senha */}
                  <div>
                    <label htmlFor="login-password" className="sr-only">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#736961] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Senha"
                        className="w-full pl-10 pr-4 py-3 text-sm text-[#1E1815] placeholder:text-[#736961] bg-[#EAE7E2] border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334] focus:bg-[#F3F0EB] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Linha: Esqueci minha senha & Help - Suporte IA */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotModal(true);
                        setForgotEmail(
                          loginUsername.includes('@') ? loginUsername : '',
                        );
                        setForgotToken('');
                        setForgotNewPassword('');
                        setForgotPreviewToken(null);
                        setForgotError(null);
                        setForgotStep('request');
                      }}
                      className="text-xs sm:text-[13px] font-medium text-[#3C312B] hover:text-[#761334] hover:underline transition-colors cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenHelpModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAE5DD] hover:bg-[#E1D9CD] border border-[#C8BFB2] text-xs sm:text-[13px] font-medium text-[#2D2521] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>Ticket</span>
                      <MessageCircle className="w-3.5 h-3.5 text-[#5A4F47]" />
                    </button>
                  </div>

                  {/* Botão Principal Vinho */}
                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3.5 px-4 text-[15px] font-medium text-white bg-[#761334] hover:bg-[#5E0E28] disabled:opacity-60 rounded-lg shadow-[0_6px_14px_rgba(118,19,52,0.28)] transition-colors cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>
                      {authSubmitting ? 'Autenticando...' : 'Entrar no Jogo'}
                    </span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div className="text-center pb-1">
                    <h2 className="font-display text-2xl sm:text-[28px] font-semibold text-[#1E1815] leading-tight">
                      Criar Nova Conta
                    </h2>
                    <p className="text-xs text-[#4A3F38] mt-1">
                      Comece no Nível 1 com 1.200 AM · Nome próprio exclusivo e 1 conta por e-mail.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-[#443933]">
                        Nome do Personagem (único)
                      </span>
                      <div className="relative mt-1">
                        <User className="w-4 h-4 text-[#736961] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          required
                          minLength={3}
                          maxLength={24}
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          placeholder="ex: SofiaStyle"
                          className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#EAE7E2] border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-[#443933]">
                        E-mail
                      </span>
                      <div className="relative mt-1">
                        <Mail className="w-4 h-4 text-[#736961] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="voce@exemplo.com"
                          className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#EAE7E2] border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                        />
                      </div>
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-medium text-[#443933]">
                      Senha
                    </span>
                    <div className="relative mt-1">
                      <Lock className="w-4 h-4 text-[#736961] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        required
                        minLength={4}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Mínimo de 4 caracteres"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#EAE7E2] border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                      />
                    </div>
                  </label>

                  <div>
                    <span className="block text-xs font-medium text-[#443933] mb-1.5">
                      Seleção de Gênero / Avatar inicial
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {AVATAR_OPTIONS.map((opt) => {
                        const active = regAvatarGender === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setRegAvatarGender(opt.id)}
                            className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                              active
                                ? 'border-[#761334] bg-[#761334]/[0.06]'
                                : 'border-[#CFC8BE] bg-[#EAE7E2] hover:border-[#A99E90]'
                            }`}
                          >
                            <p className="text-xs font-semibold text-[#1E1815]">
                              {opt.label}
                            </p>
                            <p className="text-[10px] text-[#5C5149] mt-0.5 leading-tight">
                              {opt.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-[#443933] mb-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#761334]" />
                      Servidor de Origem (Obrigatório)
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {SERVER_OPTIONS.map((srv) => {
                        const active = regServerRegion === srv.id;
                        return (
                          <button
                            key={srv.id}
                            type="button"
                            onClick={() => setRegServerRegion(srv.id)}
                            className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                              active
                                ? 'border-[#3B2E28] bg-[#3B2E28]/[0.06]'
                                : 'border-[#CFC8BE] bg-[#EAE7E2] hover:border-[#A99E90]'
                            }`}
                          >
                            <p className="text-xs font-semibold text-[#1E1815]">
                              {srv.label}
                            </p>
                            <p className="text-[10px] text-[#5C5149] mt-0.5 leading-tight">
                              {srv.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full mt-1 inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium text-white bg-[#761334] hover:bg-[#5E0E28] disabled:opacity-60 rounded-lg shadow-[0_6px_14px_rgba(118,19,52,0.28)] transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>
                      {authSubmitting
                        ? 'Criando conta...'
                        : 'Criar Conta e Começar'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>

          <p className="text-xs text-[#5C5149] text-center leading-relaxed mt-5 px-2">
            Suas contas, looks e posições da sala são sincronizados
            em tempo real no servidor multiplayer centralizado do Nocturne Vale Club.
          </p>
        </section>
      </div>

      {/* Modal de Recuperação de Senha */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Redefinir senha"
        >
          <div className="bg-[#FAF8F4] border border-[#D4C7B6] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DDD0]">
              <h3 className="font-display text-xl font-bold text-[#1E1815]">
                Recuperação de Senha
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 text-[#6B645D] hover:text-[#1E1815] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {forgotError && (
                <div className="px-3 py-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
                  {forgotError}
                </div>
              )}

              {forgotStep === 'done' ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-2">
                  <p className="font-semibold">Senha redefinida com segurança!</p>
                  <p>
                    Sua nova senha foi criptografada no servidor para a conta{' '}
                    <strong>{forgotEmail}</strong>. Você já pode acessar
                    normalmente.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="mt-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    Voltar ao Login
                  </button>
                </div>
              ) : forgotStep === 'reset' ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setForgotError(null);
                    setForgotLoading(true);
                    try {
                      const res = await fetch('/api/auth/reset-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: forgotEmail,
                          token: forgotToken,
                          newPassword: forgotNewPassword,
                        }),
                      });
                      const data = (await res.json()) as {
                        ok?: boolean;
                        error?: string;
                      };
                      if (data.ok) {
                        setForgotStep('done');
                        soundEngine.playPurchase();
                      } else {
                        setForgotError(
                          data.error || 'Código inválido ou expirado.',
                        );
                      }
                    } catch {
                      setForgotError(
                        'Erro de conexão com o servidor de autenticação.',
                      );
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <div className="p-3 rounded-lg bg-[#EAE7E2] border border-[#CFC8BE] text-xs text-[#3C312B]">
                    {forgotPreviewToken ? (
                      <>
                        Código temporário gerado para{' '}
                        <strong>{forgotEmail}</strong> (modo despacho local):{' '}
                        <span className="font-mono font-bold text-[#761334] tracking-wider">
                          {forgotPreviewToken}
                        </span>
                      </>
                    ) : (
                      <>
                        Enviamos um código temporário de 6 dígitos para{' '}
                        <strong>{forgotEmail}</strong>.
                      </>
                    )}
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold text-[#443933]">
                      Código de recuperação
                    </span>
                    <input
                      type="text"
                      required
                      value={forgotToken}
                      onChange={(e) =>
                        setForgotToken(e.target.value.toUpperCase())
                      }
                      placeholder="Ex: A1B2C3"
                      className="mt-1.5 w-full px-3.5 py-2 text-sm font-mono uppercase bg-[#EAE7E2] border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-[#443933]">
                      Nova senha
                    </span>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="mt-1.5 w-full px-3.5 py-2 text-sm bg-[#EAE7E2] border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                    />
                  </label>
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep('request')}
                      className="px-4 py-2 text-xs font-medium text-[#57534E] cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-[#761334] hover:bg-[#5E0E28] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                    >
                      {forgotLoading ? 'Validando...' : 'Confirmar Nova Senha'}
                    </button>
                  </div>
                </form>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!forgotEmail.includes('@')) return;
                    setForgotError(null);
                    setForgotLoading(true);
                    try {
                      const res = await fetch('/api/auth/forgot-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: forgotEmail }),
                      });
                      const data = (await res.json()) as {
                        ok?: boolean;
                        error?: string;
                        previewToken?: string;
                      };
                      if (data.ok) {
                        setForgotPreviewToken(data.previewToken ?? null);
                        setForgotStep('reset');
                        soundEngine.playPurchase();
                      } else {
                        setForgotError(
                          data.error ||
                            'Nenhuma conta localizada para este e-mail.',
                        );
                      }
                    } catch {
                      setForgotError(
                        'Não foi possível contatar o servidor de recuperação.',
                      );
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <p className="text-xs text-[#4E433C]">
                    Informe o e-mail cadastrado na sua conta do Starlight
                    Atelier para gerar um código temporário de redefinição de
                    senha.
                  </p>
                  <label className="block">
                    <span className="text-xs font-semibold text-[#443933]">
                      Seu e-mail
                    </span>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="ex: voce@exemplo.com"
                      className="mt-1.5 w-full px-3.5 py-2.5 text-sm bg-[#EAE7E2] border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                    />
                  </label>
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-4 py-2 text-xs font-medium text-[#57534E] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-[#761334] hover:bg-[#5E0E28] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                    >
                      {forgotLoading ? 'Enviando...' : 'Enviar Código'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Oficial de Tickets Salvos (Atendimento Community Manager) */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Central de Tickets Starlight Atelier"
        >
          <div className="bg-[#FAF8F4] border border-[#D4C7B6] rounded-xl max-w-2xl w-full p-5 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DDD0]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#3B2E28] text-white flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4 text-[#E6C792]" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-[#1E1815]">
                    Ticket · Atendimento Community Manager
                  </h3>
                  <p className="text-[11px] text-[#5C5149]">
                    Suas perguntas e as respostas da Staff ficam salvas para ambos acompanharem a qualquer momento.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshSupportTickets()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#EAE5DD] hover:bg-[#DDD5C9] text-[#3C312B] rounded-lg cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="p-1 text-[#6B645D] hover:text-[#1E1815] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {helpFeedback && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
                {helpFeedback}
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
              {/* Lista de Tickets salvos */}
              <div className="md:col-span-5 flex flex-col gap-2 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setSelectedGuestTicketId(null)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    !selectedGuestTicketId
                      ? 'bg-[#761334] text-white border-[#761334]'
                      : 'bg-white text-[#3C312B] border-[#D4C7B6] hover:border-[#761334]'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Abrir Novo Ticket
                </button>

                <div className="text-[11px] font-semibold text-[#5C5149] uppercase tracking-wider pt-1">
                  Tickets Salvos ({myLoginTickets.length})
                </div>

                {myLoginTickets.length === 0 ? (
                  <div className="p-3 rounded-lg bg-[#F2EDE5] border border-[#DDD4C7] text-[11px] text-[#5C5149]">
                    Nenhum Ticket encontrado neste navegador ou para o @usuário digitado. Envie sua dúvida ao lado!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myLoginTickets.map((tkt) => {
                      const active = selectedGuestTicketId === tkt.id;
                      const badge =
                        tkt.status === 'resolved'
                          ? { label: 'Resolvido', cls: 'bg-emerald-100 text-emerald-800' }
                          : tkt.status === 'answered'
                            ? { label: 'Respondido', cls: 'bg-sky-100 text-sky-800' }
                            : { label: 'Aberto', cls: 'bg-amber-100 text-amber-800' };
                      return (
                        <button
                          key={tkt.id}
                          type="button"
                          onClick={() => setSelectedGuestTicketId(tkt.id)}
                          className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                            active
                              ? 'bg-white border-[#761334] shadow-xs'
                              : 'bg-[#F6F2EB] border-[#DDD4C7] hover:border-[#B7965B]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono text-[#6B645D]">
                              #{tkt.id.slice(-8)}
                            </span>
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-[#1E1815] mt-1 line-clamp-1">
                            {tkt.subject}
                          </p>
                          <p className="text-[10px] text-[#5C5149] mt-0.5">
                            @{tkt.requesterUsername} · {tkt.messages.length} msg(ns)
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Formulário de Novo Ticket ou Conversa do Ticket Salvo */}
              <div className="md:col-span-7 flex flex-col min-h-0 bg-[#F2EDE5] border border-[#DDD4C7] rounded-xl p-3.5">
                {activeGuestTicket ? (
                  <>
                    <div className="pb-2 border-b border-[#DDD4C7] flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[#1E1815]">
                          {activeGuestTicket.subject}
                        </p>
                        <p className="text-[10px] text-[#5C5149]">
                          Ticket #{activeGuestTicket.id} · @{activeGuestTicket.requesterUsername}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-white border border-[#D4C7B6] text-[#3C312B]">
                        {activeGuestTicket.status === 'resolved' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-600" />
                        )}
                        {activeGuestTicket.status === 'resolved'
                          ? 'Resolvido'
                          : activeGuestTicket.status === 'answered'
                            ? 'Respondido pelo CM'
                            : 'Aguardando Community Manager'}
                      </span>
                    </div>

                    <div className="flex-1 min-h-[190px] max-h-[260px] overflow-y-auto space-y-2 py-3">
                      {activeGuestTicket.messages.map((msg) => {
                        const isPlayer = msg.senderRole === 'player';
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isPlayer ? 'items-end' : 'items-start'}`}
                          >
                            <span className="text-[10px] font-semibold text-[#5C5149] mb-0.5">
                              {msg.senderName} ·{' '}
                              {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <div
                              className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                                isPlayer
                                  ? 'bg-[#761334] text-white'
                                  : 'bg-white border border-[#D4C7B6] text-[#1E1815]'
                              }`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={(e) => void handleSendGuestTicketReply(e)}
                      className="pt-2 border-t border-[#DDD4C7] flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={ticketReplyInput}
                        onChange={(e) => setTicketReplyInput(e.target.value)}
                        placeholder="Responder ao Community Manager..."
                        className="flex-1 px-3 py-2 text-xs bg-white border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                      />
                      <button
                        type="submit"
                        disabled={helpLoading || !ticketReplyInput.trim()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#761334] hover:bg-[#5E0E28] disabled:opacity-50 rounded-lg cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Enviar
                      </button>
                    </form>
                  </>
                ) : (
                  <form
                    onSubmit={(e) => void handleCreateLoginTicket(e)}
                    className="space-y-2.5 flex-1 flex flex-col"
                  >
                    <p className="text-xs font-bold text-[#1E1815]">
                      Enviar pergunta ao Community Manager
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-[#443933]">
                          Seu @usuário ou nome
                        </span>
                        <input
                          type="text"
                          required
                          value={helpUsername}
                          onChange={(e) => setHelpUsername(e.target.value)}
                          placeholder="ex: clara_couture"
                          className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-[#443933]">
                          Categoria
                        </span>
                        <select
                          value={helpCategory}
                          onChange={(e) =>
                            setHelpCategory(e.target.value as SupportTicket['category'])
                          }
                          className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                        >
                          <option value="login">Login / Senha</option>
                          <option value="economia">Moedas AM &amp; VIP (Loja Premium)</option>
                          <option value="ban_review">Revisão de Conta</option>
                          <option value="bug">Erro Técnico</option>
                          <option value="geral">Dúvida Geral</option>
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-[#443933]">
                          Assunto do Ticket
                        </span>
                        <input
                          type="text"
                          value={helpSubject}
                          onChange={(e) => setHelpSubject(e.target.value)}
                          placeholder="Resumo rápido..."
                          className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-[#443933]">
                          E-mail de contato (opcional)
                        </span>
                        <input
                          type="email"
                          value={helpEmail}
                          onChange={(e) => setHelpEmail(e.target.value)}
                          placeholder="voce@exemplo.com"
                          className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334]"
                        />
                      </label>
                    </div>
                    <label className="block flex-1 flex flex-col">
                      <span className="text-[11px] font-semibold text-[#443933]">
                        Sua mensagem
                      </span>
                      <textarea
                        rows={4}
                        required
                        value={helpInput}
                        onChange={(e) => setHelpInput(e.target.value)}
                        placeholder="Descreva sua dúvida ou solicitação. O Ticket ficará salvo para você e o Community Manager..."
                        className="mt-1 w-full flex-1 px-3 py-2 text-xs bg-white border border-[#CFC8BE] rounded-lg focus:outline-none focus:border-[#761334] resize-none"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={helpLoading || !helpInput.trim()}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold text-white bg-[#761334] hover:bg-[#5E0E28] disabled:opacity-50 rounded-lg cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {helpLoading ? 'Salvando Ticket...' : 'Enviar Ticket Salvo'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
