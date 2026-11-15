import React, { useState } from 'react';
import {
  Disc3,
  ExternalLink,
  Headphones,
  ListMusic,
  Music,
  Play,
  Plus,
  Radio,
  SkipForward,
  Sliders,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Youtube,
} from 'lucide-react';
import { RoomDjQueuedTrack, RoomDjTrack, RoomId } from '../types/game';

interface DjBoothModalProps {
  roomId: RoomId;
  roomName: string;
  currentTrack?: RoomDjTrack;
  currentUser: string;
  isHostOrStaff: boolean;
  volume: number;
  isMuted: boolean;
  onChangeVolume: (vol: number) => void;
  onToggleMute: () => void;
  onSetTrack: (track: RoomDjTrack) => void;
  onAddToQueue: (track: RoomDjQueuedTrack) => void;
  onRemoveFromQueue: (queueItemId: string) => void;
  onPlayNextFromQueue: () => void;
  onClearTrack: () => void;
  onClose: () => void;
}

/** Extrai com segurança o ID de 11 caracteres de URLs comuns do YouTube */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

const PRESET_TRACKS: Array<{
  title: string;
  category: string;
  videoId: string;
  url: string;
}> = [
  {
    title: 'Fashion Week Runway Beats · High Couture Bass',
    category: 'Passarela & Moda',
    videoId: 'jfKfPfyJRdk',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  },
  {
    title: 'Lofi Fashion Atelier & Chill Study Beats',
    category: 'Ateliê & Chill',
    videoId: '5qap5aO4i9A',
    url: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
  },
  {
    title: 'Synthwave Neon Nightclub & Cyber Drive',
    category: 'Boate & Club',
    videoId: '4xDzrJKXOOY',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
  },
  {
    title: 'Sunset Rooftop Lounge & Deep House Vibes',
    category: 'Cobertura & Lounge',
    videoId: 'DWcJFNfaw9c',
    url: 'https://www.youtube.com/watch?v=DWcJFNfaw9c',
  },
  {
    title: 'Parisian Café Jazz & French Boutique Accordion',
    category: 'Bistrô & Paris',
    videoId: 'DXUAyRRkI6k',
    url: 'https://www.youtube.com/watch?v=DXUAyRRkI6k',
  },
];

export const DjBoothModal: React.FC<DjBoothModalProps> = ({
  roomName,
  currentTrack,
  currentUser,
  volume,
  isMuted,
  onChangeVolume,
  onToggleMute,
  onSetTrack,
  onAddToQueue,
  onRemoveFromQueue,
  onPlayNextFromQueue,
  onClearTrack,
  onClose,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const buildTrackPayload = (): {
    videoId: string;
    youtubeUrl: string;
    title: string;
  } | null => {
    setErrorMsg(null);
    const videoId = extractYouTubeVideoId(urlInput);
    if (!videoId) {
      setErrorMsg(
        'Link do YouTube inválido. Cole uma URL como https://www.youtube.com/watch?v=... ou https://youtu.be/...',
      );
      return null;
    }

    const title =
      customTitle.trim() || `Música YouTube (${videoId.slice(0, 6)})`;
    return {
      videoId,
      youtubeUrl: urlInput.trim(),
      title,
    };
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = buildTrackPayload();
    if (!parsed) return;

    onSetTrack({
      videoId: parsed.videoId,
      youtubeUrl: parsed.youtubeUrl,
      title: parsed.title,
      addedBy: currentUser,
      startedAt: Date.now(),
      isPlaying: true,
      queue: currentTrack?.queue,
    });

    setUrlInput('');
    setCustomTitle('');
  };

  const handleEnqueueUrl = () => {
    const parsed = buildTrackPayload();
    if (!parsed) return;
    onAddToQueue({
      id: `djq_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      videoId: parsed.videoId,
      youtubeUrl: parsed.youtubeUrl,
      title: parsed.title,
      addedBy: currentUser,
    });
    setUrlInput('');
    setCustomTitle('');
  };

  const handleSelectPreset = (preset: (typeof PRESET_TRACKS)[0]) => {
    setErrorMsg(null);
    onSetTrack({
      videoId: preset.videoId,
      youtubeUrl: preset.url,
      title: preset.title,
      addedBy: currentUser,
      startedAt: Date.now(),
      isPlaying: true,
      queue: currentTrack?.queue,
    });
  };

  const queueItems = currentTrack?.queue ?? [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Cabine de DJ Starlight"
    >
      <div className="bg-[#0F172A] border border-[#38BDF8]/40 rounded-2xl max-w-xl w-full p-6 text-white shadow-2xl relative my-auto">
        {/* Efeito Neon Glow de fundo */}
        <div
          className="absolute -top-12 -left-12 w-48 h-48 bg-[#38BDF8]/15 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-12 -right-12 w-48 h-48 bg-[#EC4899]/15 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#38BDF8] to-[#6366F1] flex items-center justify-center shadow-lg shadow-[#38BDF8]/20">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Cabine de DJ Starlight
                <span className="text-[10px] font-mono-num font-semibold uppercase px-2 py-0.5 rounded bg-[#EC4899]/20 text-[#F472B6] border border-[#EC4899]/30">
                  Ao Vivo
                </span>
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Tocando som sincronizado para todos em <strong>{roomName}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fechar Cabine de DJ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controle de Volume Individual */}
        <div className="mt-4 p-3 rounded-xl bg-[#1E293B]/55 border border-white/10 relative z-10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E2E8F0] hover:text-white cursor-pointer shrink-0"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#38BDF8]" />
            )}
            <span>Seu Volume</span>
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={(e) => onChangeVolume(Number(e.target.value))}
            aria-label="Volume individual da cabine de DJ"
            className="flex-1 accent-[#38BDF8] cursor-pointer"
          />
          <span className="text-xs font-mono-num text-[#38BDF8] w-10 text-right">
            {isMuted ? 0 : volume}%
          </span>
        </div>

        {/* Status da Música Atual */}
        <div className="mt-3 p-4 rounded-xl bg-[#1E293B]/70 border border-white/10 relative z-10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#38BDF8] flex items-center gap-1.5 uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse text-[#38BDF8]" />
              Em Reprodução na Sala
            </span>

            {currentTrack && (
              <span className="text-[11px] text-[#94A3B8]">
                Adicionada por: <strong className="text-white">{currentTrack.addedBy}</strong>
              </span>
            )}
          </div>

          {currentTrack ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-[#0F172A] border border-[#38BDF8]/50 flex items-center justify-center shrink-0 relative overflow-hidden">
                  <Disc3 className="w-6 h-6 text-[#38BDF8] animate-spin" style={{ animationDuration: '4s' }} />
                  <div className="absolute inset-0 bg-[#38BDF8]/10 pointer-events-none" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">
                    {currentTrack.title}
                  </h4>
                  <a
                    href={currentTrack.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#38BDF8] hover:underline truncate mt-0.5"
                  >
                    <Youtube className="w-3 h-3 text-[#EF4444]" />
                    <span>Ver no YouTube</span>
                    <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {queueItems.length > 0 && (
                  <button
                    type="button"
                    onClick={onPlayNextFromQueue}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1C1917] bg-[#FDE68A] hover:bg-[#FCD34D] rounded-lg transition-colors cursor-pointer"
                    title="Pular para a próxima música da fila"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    Próxima
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClearTrack}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#F87171] bg-[#7F1D1D]/30 hover:bg-[#7F1D1D]/60 border border-[#EF4444]/40 rounded-lg transition-colors cursor-pointer"
                  title="Parar e remover música da sala"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Parar Som
                </button>
              </div>
            </div>
          ) : (
            <div className="py-3 text-center text-xs text-[#94A3B8] flex flex-col items-center justify-center gap-1">
              <Music className="w-6 h-6 text-[#64748B] mb-1 opacity-70" />
              <span>Nenhuma música tocando no momento nesta sala.</span>
              <span className="text-[11px] text-[#64748B]">
                Cole um link do YouTube abaixo ou escolha uma trilha temática!
              </span>
            </div>
          )}
        </div>

        {/* Fila de Reprodução */}
        <div className="mt-3 p-3.5 rounded-xl bg-[#1E293B]/45 border border-white/10 relative z-10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#CBD5E1] flex items-center gap-1.5">
              <ListMusic className="w-3.5 h-3.5 text-[#38BDF8]" />
              Fila de Reprodução Sincronizada ({queueItems.length})
            </span>
          </div>
          {queueItems.length === 0 ? (
            <p className="text-[11px] text-[#64748B]">
              A fila está vazia. Cole uma URL ou clique em &quot;+ Fila&quot; em qualquer sugestão.
            </p>
          ) : (
            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
              {queueItems.map((qItem, idx) => (
                <div
                  key={qItem.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#0F172A]/80 border border-white/5 text-xs"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-[10px] font-mono-num text-[#38BDF8]">
                      #{idx + 1}
                    </span>
                    <span className="truncate text-white font-medium">
                      {qItem.title}
                    </span>
                    <span className="text-[10px] text-[#94A3B8] shrink-0">
                      ({qItem.addedBy})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFromQueue(qItem.id)}
                    className="p-1 text-[#94A3B8] hover:text-[#F87171] cursor-pointer shrink-0"
                    title="Remover da fila"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulário: Adicionar Link do YouTube */}
        <form onSubmit={handleApplyUrl} className="mt-4 space-y-2.5 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5 flex items-center gap-1.5">
              <Youtube className="w-4 h-4 text-[#EF4444]" />
              Link de Música ou Vídeo do YouTube
            </label>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                className="flex-1 min-w-[200px] px-3.5 py-2 text-xs bg-[#1E293B] border border-white/15 rounded-xl text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8] transition-colors"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-semibold text-black bg-[#38BDF8] hover:bg-[#7DD3FC] rounded-xl shadow-lg shadow-[#38BDF8]/20 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                Tocar Agora
              </button>
              <button
                type="button"
                onClick={handleEnqueueUrl}
                className="px-3 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Fila
              </button>
            </div>
          </div>

          <div>
            <input
              type="text"
              maxLength={70}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Nome ou título da faixa (opcional)"
              className="w-full px-3.5 py-1.5 text-xs bg-[#1E293B]/70 border border-white/10 rounded-lg text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-[#F87171] font-medium bg-[#7F1D1D]/20 p-2 rounded-lg border border-[#EF4444]/30">
              {errorMsg}
            </p>
          )}
        </form>

        {/* Trilhas Predefinidas de Moda / Passarela / Boate */}
        <div className="mt-4 pt-3 border-t border-white/10 relative z-10 space-y-2">
          <span className="text-xs font-semibold text-[#CBD5E1] block flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#38BDF8]" />
            Sugestões Rápidas de Estúdio &amp; Desfile
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_TRACKS.map((preset) => {
              const isSelected = currentTrack?.videoId === preset.videoId;
              return (
                <div
                  key={preset.videoId}
                  className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-white'
                      : 'border-white/10 bg-[#1E293B]/60 hover:bg-[#1E293B] hover:border-white/20 text-[#CBD5E1]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <span className="text-[10px] font-semibold text-[#38BDF8] block uppercase">
                      {preset.category}
                    </span>
                    <p className="text-xs font-medium truncate mt-0.5 text-white">
                      {preset.title}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onAddToQueue({
                          id: `djq_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                          videoId: preset.videoId,
                          youtubeUrl: preset.url,
                          title: preset.title,
                          addedBy: currentUser,
                        })
                      }
                      title="Adicionar à fila"
                      className="px-1.5 py-1 text-[10px] font-semibold bg-white/10 hover:bg-white/20 rounded text-white cursor-pointer"
                    >
                      +Fila
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      title="Tocar agora"
                      className="p-1 cursor-pointer"
                    >
                      <Play
                        className={`w-3.5 h-3.5 ${
                          isSelected ? 'text-[#38BDF8] fill-[#38BDF8]' : 'text-[#64748B]'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé explicativo */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#94A3B8] relative z-10">
          <span>Sincronizada ao segundo entre todos os visitantes da sala.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
