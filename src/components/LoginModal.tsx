import React, { useState } from 'react';
import {
  Globe,
  KeyRound,
  LifeBuoy,
  Lock,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react';
import logoBannerImg from '../assets/images/starlight_atelier_logo_1794577859274.jpg';
import {
  AvatarGender,
  ServerRegion,
  SupportChatMessage,
  SupportTicket,
  UserAccount,
} from '../types/game';
import { soundEngine } from '../utils/sound';
import {
  ADMIN_OWNER_EMAIL,
  loginAccount,
  registerAccount,
  syncAccountAndProgressFromServer,
} from '../utils/storage';
import { MeDollSvg } from './svg/MeDollSvg';

interface LoginModalProps {
  onAuthenticated: (account: UserAccount) => void;
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

/**
 * Tela Inicial de Acesso (Login e Criação de Conta).
 * Persiste contas e sessão ativa no localStorage, mantendo sigilo total do acesso administrativo.
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
  const [regAvatarGender, setRegAvatarGender] = useState<AvatarGender>('feminino');
  const [regServerRegion, setRegServerRegion] = useState<ServerRegion>('BR');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotPreviewToken, setForgotPreviewToken] = useState<string | null>(null);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset' | 'done'>('request');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Help & Suporte IA + Escalonamento para Moderador Humano
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpUsername, setHelpUsername] = useState('');
  const [helpCategory, setHelpCategory] = useState<SupportTicket['category']>('login');
  const [helpInput, setHelpInput] = useState('');
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpEscalatedId, setHelpEscalatedId] = useState<string | null>(null);
  const [helpMessages, setHelpMessages] = useState<SupportChatMessage[]>([
    {
      id: 'help_welcome',
      senderRole: 'ai_bot',
      senderName: 'Suporte IA · Moderação',
      text: 'Olá! Sou o assistente de suporte do Starlight Atelier. Posso tirar dúvidas sobre acesso, senha, StarCoins, regras ou encaminhar seu caso diretamente para um Moderador Humano.',
      createdAt: Date.now(),
    },
  ]);

  const isAuthorizedAdminEmailEntered =
    loginUsername.trim().toLowerCase() === ADMIN_OWNER_EMAIL;

  const handleOpenHelpModal = () => {
    setHelpUsername((prev) => prev || loginUsername.trim());
    setHelpEscalatedId(null);
    setShowHelpModal(true);
  };

  const handleAskHelpAi = async (promptText?: string) => {
    const text = (promptText ?? helpInput).trim();
    if (!text || helpLoading) return;
    const playerMsg: SupportChatMessage = {
      id: `pmsg_${Date.now()}`,
      senderRole: 'player',
      senderName: helpUsername.trim() || 'Visitante',
      text,
      createdAt: Date.now(),
    };
    const nextHistory = [...helpMessages, playerMsg];
    setHelpMessages(nextHistory);
    if (!promptText) setHelpInput('');
    setHelpLoading(true);

    try {
      const res = await fetch('/api/support/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          username: helpUsername.trim() || loginUsername.trim() || 'Visitante',
          history: nextHistory.map((m) => ({
            senderRole: m.senderRole,
            text: m.text,
          })),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; reply?: string };
      const replyText =
        data.reply ||
        'Não consegui consultar o servidor agora. Clique em "Encaminhar para Moderador Humano" para registrar seu chamado na fila oficial.';
      setHelpMessages((prev) => [
        ...prev,
        {
          id: `aimsg_${Date.now()}`,
          senderRole: 'ai_bot',
          senderName: 'Suporte IA · Moderação',
          text: replyText,
          createdAt: Date.now(),
        },
      ]);
    } catch {
      setHelpMessages((prev) => [
        ...prev,
        {
          id: `aimsg_err_${Date.now()}`,
          senderRole: 'ai_bot',
          senderName: 'Suporte IA · Moderação',
          text: 'Conexão instável no momento. Você pode clicar em "Encaminhar para Moderador Humano" para enviar seu chamado assim que possível.',
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setHelpLoading(false);
    }
  };

  const handleEscalateToModerator = async () => {
    if (helpLoading) return;
    setHelpLoading(true);
    try {
      const requester =
        helpUsername.trim() || loginUsername.trim() || 'Visitante_Login';
      const lastPlayerText =
        [...helpMessages].reverse().find((m) => m.senderRole === 'player')?.text ||
        'Solicitação de atendimento humano pela tela de Login';
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterUsername: requester,
          category: helpCategory,
          subject: lastPlayerText.slice(0, 90),
          messages: helpMessages,
          escalateToHuman: true,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; ticket?: SupportTicket };
      if (data.ok && data.ticket) {
        setHelpEscalatedId(data.ticket.id);
        soundEngine.playPurchase();
        setHelpMessages((prev) => [
          ...prev,
          {
            id: `sys_esc_${Date.now()}`,
            senderRole: 'ai_bot',
            senderName: 'Sistema de Moderação',
            text: `Chamado #${data.ticket?.id} encaminhado com sucesso para a fila dos Moderadores Humanos! Assim que acessar ou conferir a aba Moderação, sua demanda estará registrada.`,
            createdAt: Date.now(),
          },
        ]);
      }
    } catch {
      // Silencioso
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
        accounts?: UserAccount[];
        worldState?: Parameters<typeof syncAccountAndProgressFromServer>[0]['worldState'];
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
      if (res.status === 401 || res.status === 400) {
        setErrorMsg(data.error || 'E-mail, nome do avatar ou senha inválidos.');
        soundEngine.playModAction();
        return;
      }
    } catch {
      // Continua para fallback local apenas se servidor inacessível
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
    onAuthenticated(fallback.account);
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
        worldState?: Parameters<typeof syncAccountAndProgressFromServer>[0]['worldState'];
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

  // Pré-visualização ao vivo do avatar durante o cadastro
  const previewOutfit =
    regAvatarGender === 'masculino'
      ? {
          cabelo: 'hair_corte_executivo',
          blusas: 'top_camisa_social_azul',
          calcas: 'bottom_chino_areia',
          sapatos: 'shoes_oxford_couro',
        }
      : regAvatarGender === 'neutro'
        ? {
            cabelo: 'hair_coque_atelier',
            blusas: 'top_camisa_seda',
            calcas: 'bottom_calca_alfaiataria',
            sapatos: 'shoes_tenis_branco',
          }
        : {
            cabelo: 'hair_ondas_mel',
            blusas: 'top_camisa_seda',
            calcas: 'bottom_saia_midi',
            sapatos: 'shoes_scarpin_preto',
          };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917] flex flex-col justify-center px-4 py-10">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Coluna Esquerda: Logotipo ilustrado Starlight Atelier + prévia da MeDoll */}
        <section className="lg:col-span-5 bg-white border border-[#E6E0D8] rounded-xl p-8 flex flex-col justify-between">
          <div>
            {/* Arte e Logotipo Oficial Starlight Atelier */}
            <div className="flex items-center gap-4 pb-5 border-b border-[#EFEAE3]">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#E6D5B8] bg-[#FAF4EC] shrink-0 shadow-xs">
                <img
                  src={logoBannerImg}
                  alt="Emblema Starlight Atelier"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#C8235D] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#D4A853]" />
                  Boutique &amp; Suíte 2D
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1C1917] tracking-tight leading-none mt-1">
                  Starlight Atelier
                </h1>
              </div>
            </div>

            <p className="text-sm text-[#57534E] mt-4 leading-relaxed">
              Crie sua boneca em camadas com traços realistas, conquiste coleções exclusivas na Starplaza, decore sua Suíte 2D e explore salas temáticas com estilistas do mundo todo.
            </p>
          </div>

          <div className="my-6 rounded-xl bg-gradient-to-b from-[#FAF6F0] to-[#F3ECE1] border border-[#EFEAE3] h-72 flex items-center justify-center relative overflow-hidden">
            <div className="w-44 h-64" aria-hidden="true">
              <MeDollSvg
                equipped={previewOutfit}
                skinTone="pessego"
                avatarGender={mode === 'register' ? regAvatarGender : 'feminino'}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#EFEAE3] flex items-center justify-between gap-3 text-xs text-[#6B645D]">
            <span>Moda em Camadas · Servidores BR, ES &amp; EN</span>
            <span className="font-mono-num text-[#C8235D] font-semibold">1.200 SC iniciais</span>
          </div>
        </section>

        {/* Coluna Direita: Formulário de Entrar / Criar Nova Conta */}
        <section className="lg:col-span-7 bg-white border border-[#E6E0D8] rounded-xl p-8 flex flex-col justify-between">
          <div>
            {/* Abas de alternância */}
            <div
              className="grid grid-cols-2 gap-1 p-1 bg-[#F5F2EC] rounded-xl mb-6"
              role="tablist"
              aria-label="Modo de autenticação"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => handleSwitchMode('login')}
                className={`py-2.5 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#6B645D] hover:text-[#1C1917]'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => handleSwitchMode('register')}
                className={`py-2.5 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#6B645D] hover:text-[#1C1917]'
                }`}
              >
                Criar Nova Conta
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mb-5 px-4 py-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#B91C1C]"
              >
                {errorMsg}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#1C1917]">
                    Acessar seu Atelier
                  </h2>
                  <p className="text-xs text-[#6B645D] mt-0.5">
                    Entre com seu E-mail ou Nome do Avatar para sincronizar seu guarda-roupa e Suíte em tempo real.
                  </p>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">
                    E-mail ou Nome do Avatar
                  </span>
                  <div className="relative mt-1.5">
                    <User className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Ex: clara_couture ou seu@email.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                    />
                  </div>
                </label>

                {isAuthorizedAdminEmailEntered && (
                  <div className="px-3.5 py-2.5 rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] flex items-center gap-2 text-xs text-[#0C4A6E]">
                    <ShieldCheck className="w-4 h-4 text-[#0284C7] shrink-0" />
                    <span>
                      Identidade de Administração Geral reconhecida ({ADMIN_OWNER_EMAIL}). Informe sua senha para autenticar.
                    </span>
                  </div>
                )}

                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">Senha</span>
                  <div className="relative mt-1.5">
                    <Lock className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Sua senha"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                    />
                  </div>
                </label>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B645D]">Autenticação centralizada com hash seguro</span>
                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotModal(true);
                        setForgotEmail('');
                        setForgotToken('');
                        setForgotNewPassword('');
                        setForgotPreviewToken(null);
                        setForgotError(null);
                        setForgotStep('request');
                      }}
                      className="text-[#C8235D] hover:underline font-medium cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenHelpModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1917] hover:bg-[#332E2B] text-white text-[11px] font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      <LifeBuoy className="w-3.5 h-3.5 text-[#F59EB8]" />
                      Help · Suporte IA
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  {authSubmitting ? 'Autenticando...' : 'Entrar no Jogo'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#1C1917]">
                    Criar Nova Conta
                  </h2>
                  <p className="text-xs text-[#6B645D] mt-0.5">
                    Você começa com 1.200 Lumes (LM) e bônus de boas-vindas para personalizar sua MeDoll.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-[#44403C]">
                      Nome de usuário
                    </span>
                    <div className="relative mt-1.5">
                      <User className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="ex: sofia_style"
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#44403C]">E-mail</span>
                    <div className="relative mt-1.5">
                      <Mail className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="voce@exemplo.com"
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                      />
                    </div>
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">Senha</span>
                  <div className="relative mt-1.5">
                    <Lock className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Mínimo de 4 caracteres"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                    />
                  </div>
                </label>

                <div>
                  <span className="block text-xs font-semibold text-[#44403C] mb-2">
                    Seleção de Gênero / Avatar inicial
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {AVATAR_OPTIONS.map((opt) => {
                      const active = regAvatarGender === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setRegAvatarGender(opt.id)}
                          className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                            active
                              ? 'border-[#C8235D] bg-[#C8235D]/[0.05]'
                              : 'border-[#E6E0D8] bg-[#FAF8F5] hover:border-[#C7BEB2]'
                          }`}
                        >
                          <p className="text-xs font-semibold text-[#1C1917]">
                            {opt.label}
                          </p>
                          <p className="text-[11px] text-[#6B645D] mt-0.5">
                            {opt.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#44403C] mb-2">
                    <Globe className="w-3.5 h-3.5 text-[#C8235D]" />
                    Servidor de Origem (Obrigatório)
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {SERVER_OPTIONS.map((srv) => {
                      const active = regServerRegion === srv.id;
                      return (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => setRegServerRegion(srv.id)}
                          className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                            active
                              ? 'border-[#1C1917] bg-[#1C1917]/[0.04]'
                              : 'border-[#E6E0D8] bg-[#FAF8F5] hover:border-[#C7BEB2]'
                          }`}
                        >
                          <p className="text-xs font-semibold text-[#1C1917]">
                            {srv.label}
                          </p>
                          <p className="text-[11px] text-[#6B645D] mt-0.5">
                            {srv.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Criar Conta e Começar
                </button>
              </form>
            )}
          </div>

          <p className="text-[11px] text-[#78716C] mt-6 pt-4 border-t border-[#EFEAE3]">
            Suas contas, looks da MeDoll e posições da Suíte são sincronizados em tempo real no servidor multiplayer centralizado do Starlight Atelier.
          </p>
        </section>
      </div>

      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Redefinir senha"
        >
          <div className="bg-white border border-[#E6E0D8] rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE3]">
              <h3 className="font-display text-xl font-bold text-[#1C1917]">
                Recuperação de Senha
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 text-[#6B645D] hover:text-[#1C1917] cursor-pointer"
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
                    Sua nova senha foi criptografada no servidor para a conta <strong>{forgotEmail}</strong>. Você já pode acessar normalmente.
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
                      const data = (await res.json()) as { ok?: boolean; error?: string };
                      if (data.ok) {
                        setForgotStep('done');
                        soundEngine.playPurchase();
                      } else {
                        setForgotError(data.error || 'Código inválido ou expirado.');
                      }
                    } catch {
                      setForgotError('Erro de conexão com o servidor de autenticação.');
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#E6E0D8] text-xs text-[#44403C]">
                    {forgotPreviewToken ? (
                      <>
                        Código temporário gerado para <strong>{forgotEmail}</strong> (modo despacho local):{' '}
                        <span className="font-mono font-bold text-[#C8235D] tracking-wider">
                          {forgotPreviewToken}
                        </span>
                      </>
                    ) : (
                      <>
                        Enviamos um código temporário de 6 dígitos para <strong>{forgotEmail}</strong>.
                      </>
                    )}
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold text-[#44403C]">
                      Código de recuperação
                    </span>
                    <input
                      type="text"
                      required
                      value={forgotToken}
                      onChange={(e) => setForgotToken(e.target.value.toUpperCase())}
                      placeholder="Ex: A1B2C3"
                      className="mt-1.5 w-full px-3.5 py-2 text-sm font-mono uppercase bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-[#44403C]">
                      Nova senha
                    </span>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="mt-1.5 w-full px-3.5 py-2 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
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
                      className="px-5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
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
                          data.error || 'Nenhuma conta localizada para este e-mail.',
                        );
                      }
                    } catch {
                      setForgotError('Não foi possível contatar o servidor de recuperação.');
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <p className="text-xs text-[#57534E]">
                    Informe o e-mail cadastrado na sua conta do Starlight Atelier para gerar um código temporário de redefinição de senha.
                  </p>
                  <label className="block">
                    <span className="text-xs font-semibold text-[#44403C]">Seu e-mail</span>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="ex: voce@exemplo.com"
                      className="mt-1.5 w-full px-3.5 py-2.5 text-sm bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
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
                      className="px-5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
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

      {/* Modal de Help / Suporte IA & Fila de Moderadores Humanos */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Central de Ajuda e Suporte IA"
        >
          <div className="bg-white border border-[#E6E0D8] rounded-xl max-w-lg w-full p-5 shadow-2xl flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE3]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#1C1917] text-white flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4 text-[#F59EB8]" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-[#1C1917]">
                    Help · Suporte Oficial
                  </h3>
                  <p className="text-[11px] text-[#6B645D]">
                    Atendimento IA imediato + escalonamento para Moderador Humano
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 text-[#6B645D] hover:text-[#1C1917] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-[#44403C]">
                  Seu @usuário ou nome
                </span>
                <input
                  type="text"
                  value={helpUsername}
                  onChange={(e) => setHelpUsername(e.target.value)}
                  placeholder="ex: clara_couture"
                  className="mt-1 w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-[#44403C]">
                  Assunto
                </span>
                <select
                  value={helpCategory}
                  onChange={(e) =>
                    setHelpCategory(e.target.value as SupportTicket['category'])
                  }
                  className="mt-1 w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                >
                  <option value="login">Login / Senha</option>
                  <option value="ban_review">Revisão de Banimento</option>
                  <option value="economia">StarCoins & VIP</option>
                  <option value="bug">Erro ou Sala Travada</option>
                  <option value="geral">Dúvida Geral</option>
                </select>
              </label>
            </div>

            {/* Chips de perguntas rápidas */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[
                'Não consigo fazer login',
                'Quero revisão de banimento',
                'Como ganhar StarCoins e VIP?',
                'Uma sala está travada',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void handleAskHelpAi(chip)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-[#FAF8F5] hover:bg-[#FCE8EF] text-[#44403C] hover:text-[#9E1646] border border-[#E6E0D8] rounded-lg transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Histórico de mensagens */}
            <div className="mt-3 flex-1 min-h-[200px] max-h-[280px] overflow-y-auto space-y-2.5 p-3 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3]">
              {helpMessages.map((msg) => {
                const isPlayer = msg.senderRole === 'player';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isPlayer ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] font-semibold text-[#6B645D] mb-0.5">
                      {msg.senderName}
                    </span>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                        isPlayer
                          ? 'bg-[#C8235D] text-white'
                          : 'bg-white border border-[#E6E0D8] text-[#1C1917]'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              {helpLoading && (
                <div className="text-[11px] text-[#6B645D] italic">
                  Consultando Staff IA...
                </div>
              )}
            </div>

            {/* Input e Escalonamento */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAskHelpAi();
              }}
              className="mt-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={helpInput}
                onChange={(e) => setHelpInput(e.target.value)}
                placeholder="Descreva sua dúvida ou solicitação..."
                className="flex-1 px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
              />
              <button
                type="submit"
                disabled={helpLoading || !helpInput.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:opacity-50 rounded-lg cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Perguntar
              </button>
            </form>

            <div className="mt-3 pt-2.5 border-t border-[#EFEAE3] flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-[#6B645D]">
                {helpEscalatedId
                  ? `Ticket registrado: ${helpEscalatedId}`
                  : 'Não resolveu? Envie direto para um Moderador.'}
              </span>
              <button
                type="button"
                disabled={helpLoading || Boolean(helpEscalatedId)}
                onClick={() => void handleEscalateToModerator()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
                {helpEscalatedId
                  ? 'Enviado para Moderação'
                  : 'Encaminhar para Moderador Humano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
