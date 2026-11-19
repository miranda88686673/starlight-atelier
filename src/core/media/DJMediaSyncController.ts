/**
 * DJMediaSyncController — Ponte de Mídia Externa (YouTube IFrame Player API).
 * Carrega https://www.youtube.com/iframe_api assincronamente, exibe o vídeo na
 * tela da Cabine de DJ e sincroniza áudio espacial + segundo exato entre clientes.
 */

export interface DjSyncTrackInput {
  video_id: string;
  started_at: number;
  is_playing: boolean;
}

export type DjPlaybackState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'blocked'
  | 'error';

export interface DjPlaybackStatus {
  state: DjPlaybackState;
  needsAudioUnlock: boolean;
  errorCode?: number;
  isEmbedBlocked?: boolean;
  errorMessage?: string;
}

interface YTPlayerInstance {
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  cueVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted?: () => boolean;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  getPlayerState: () => number;
  getIframe?: () => HTMLIFrameElement;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      height?: string | number;
      width?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayerInstance;
  PlayerState?: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiLoadPromise: Promise<YTNamespace> | null = null;

/** Carrega a API oficial do YouTube IFrame de forma assíncrona e idempotente */
export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API disponível apenas no navegador.'));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (ytApiLoadPromise) {
    return ytApiLoadPromise;
  }

  ytApiLoadPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousCallback === 'function') {
        try {
          previousCallback();
        } catch {
          // Silencioso
        }
      }
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error('YouTube IFrame API carregada sem objeto YT.Player.'));
      }
    };

    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        ytApiLoadPromise = null;
        reject(new Error('Falha ao carregar script da API do YouTube IFrame.'));
      };
      document.head.appendChild(script);
    }
  });

  return ytApiLoadPromise;
}

export class DJMediaSyncController {
  private player: YTPlayerInstance | null = null;
  private isPlayerReady = false;
  private currentVideoId: string | null = null;
  private pendingTrack: DjSyncTrackInput | null = null;
  private muted = false;
  private volume = 80;
  private spatialGain = 1;
  private onEndedCallback?: () => void;
  private onStatusCallback?: (status: DjPlaybackStatus) => void;
  private autoplayCheckTimer: number | null = null;
  private destroyed = false;

  /** Inicializa o YT.Player visível ocupando 100% da tela da Cabine de DJ */
  async mount(container: HTMLElement): Promise<void> {
    if (this.destroyed || this.player) return;

    const YT = await loadYouTubeIframeApi();
    if (this.destroyed) return;

    const hostEl = document.createElement('div');
    hostEl.style.width = '100%';
    hostEl.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(hostEl);

    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : undefined;

    this.player = new YT.Player(hostEl, {
      height: '100%',
      width: '100%',
      videoId: this.pendingTrack?.video_id ?? undefined,
      playerVars: {
        autoplay: 1,
        controls: 1,
        disablekb: 0,
        enablejsapi: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        ...(origin ? { origin } : {}),
      },
      events: {
        onReady: () => {
          this.isPlayerReady = true;
          try {
            const iframe = this.player?.getIframe?.();
            if (iframe) {
              iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
              iframe.style.width = '100%';
              iframe.style.height = '100%';
              iframe.style.display = 'block';
              iframe.style.border = '0';
            }
          } catch {
            // Silencioso
          }
          this.applyVolumeToPlayer();
          if (this.pendingTrack) {
            this.applyTrackState(this.pendingTrack);
          } else {
            this.emitStatus('idle', false);
          }
        },
        onStateChange: (ev) => {
          // 0=ENDED, 1=PLAYING, 2=PAUSED, 3=BUFFERING, 5=CUED, -1=UNSTARTED
          if (ev.data === 1) {
            this.clearAutoplayTimer();
            let playerIsMuted = false;
            try {
              playerIsMuted = Boolean(this.player?.isMuted?.());
            } catch {
              playerIsMuted = false;
            }
            const needsUnlock = !this.muted && this.volume > 0 && playerIsMuted;
            this.emitStatus('playing', needsUnlock);
          } else if (ev.data === 2) {
            this.emitStatus('paused', false);
          } else if (ev.data === 3) {
            this.emitStatus('loading', false);
          } else if (ev.data === 0) {
            this.clearAutoplayTimer();
            if (this.onEndedCallback) {
              this.onEndedCallback();
            } else if (this.pendingTrack?.is_playing) {
              this.player?.loadVideoById({
                videoId: this.pendingTrack.video_id,
                startSeconds: 0,
              });
            }
          }
        },
        onError: (ev) => {
          this.clearAutoplayTimer();
          const code = ev.data;
          const isEmbed = code === 101 || code === 150;
          const errorMessage = isEmbed
            ? 'O proprietário deste vídeo bloqueou a reprodução externa (embed). Escolha outra música ou pule para a próxima.'
            : code === 100
              ? 'Vídeo não encontrado ou privado no YouTube.'
              : code === 2
                ? 'ID de vídeo do YouTube inválido.'
                : 'Erro ao reproduzir vídeo do YouTube.';
          this.emitStatus('error', false, code, isEmbed, errorMessage);
        },
      },
    });
  }

  private clearAutoplayTimer(): void {
    if (this.autoplayCheckTimer !== null) {
      window.clearTimeout(this.autoplayCheckTimer);
      this.autoplayCheckTimer = null;
    }
  }

  private emitStatus(
    state: DjPlaybackState,
    needsAudioUnlock: boolean,
    errorCode?: number,
    isEmbedBlocked?: boolean,
    errorMessage?: string,
  ): void {
    this.onStatusCallback?.({
      state,
      needsAudioUnlock,
      errorCode,
      isEmbedBlocked,
      errorMessage,
    });
  }

  private getEffectiveVolume(): number {
    return Math.max(0, Math.min(100, Math.round(this.volume * this.spatialGain)));
  }

  private applyVolumeToPlayer(): void {
    if (!this.player || !this.isPlayerReady) return;
    const effective = this.getEffectiveVolume();
    try {
      if (this.muted || effective <= 0) {
        this.player.mute();
      } else {
        this.player.unMute();
        this.player.setVolume(effective);
      }
    } catch {
      // Silencioso
    }
  }

  setOnEnded(cb?: () => void): void {
    this.onEndedCallback = cb;
  }

  setOnStatusChange(cb?: (status: DjPlaybackStatus) => void): void {
    this.onStatusCallback = cb;
  }

  /** Desbloqueia áudio e inicia reprodução em resposta direta a um clique do jogador */
  unlockAudio(): void {
    this.muted = false;
    if (!this.player || !this.isPlayerReady) return;
    const effective = this.getEffectiveVolume();
    try {
      this.player.unMute();
      this.player.setVolume(Math.max(5, effective));
      this.player.playVideo();
      this.emitStatus('playing', false);
    } catch {
      this.emitStatus('blocked', true);
    }
  }

  /** Calcula o segundo exato decorrido desde `started_at` */
  static computeElapsedSeconds(started_at: number): number {
    if (!Number.isFinite(started_at) || started_at <= 0) return 0;
    return Math.max(0, Math.floor((Date.now() - started_at) / 1000));
  }

  /** Sincroniza estado da música recebida via Socket.io ou banco em tempo real */
  syncTrack(track: DjSyncTrackInput | null): void {
    this.pendingTrack = track;
    if (!this.player || !this.isPlayerReady) return;
    this.applyTrackState(track);
  }

  private applyTrackState(track: DjSyncTrackInput | null): void {
    if (!this.player || !this.isPlayerReady) return;
    this.clearAutoplayTimer();

    if (!track || !track.video_id) {
      this.currentVideoId = null;
      try {
        this.player.stopVideo();
      } catch {
        // Silencioso
      }
      this.emitStatus('idle', false);
      return;
    }

    const startSeconds = DJMediaSyncController.computeElapsedSeconds(track.started_at);
    this.applyVolumeToPlayer();

    if (this.currentVideoId !== track.video_id) {
      this.currentVideoId = track.video_id;
      this.emitStatus('loading', false);
      if (track.is_playing) {
        this.player.loadVideoById({
          videoId: track.video_id,
          startSeconds,
        });
        this.scheduleAutoplayVerify();
      } else {
        this.player.cueVideoById({
          videoId: track.video_id,
          startSeconds,
        });
        this.emitStatus('paused', false);
      }
    } else if (track.is_playing) {
      try {
        const currentTime = this.player.getCurrentTime?.() ?? startSeconds;
        if (Math.abs(currentTime - startSeconds) > 2.5) {
          this.player.loadVideoById({
            videoId: track.video_id,
            startSeconds,
          });
        } else {
          this.player.playVideo();
        }
        this.scheduleAutoplayVerify();
      } catch {
        this.player.playVideo();
      }
    } else {
      this.player.pauseVideo();
      this.emitStatus('paused', false);
    }
  }

  /**
   * Verifica se o navegador bloqueou autoplay com som: caso travado em UNSTARTED/CUED,
   * inicia reprodução mutada e sinaliza o botão de desbloqueio de som para o jogador.
   */
  private scheduleAutoplayVerify(): void {
    this.clearAutoplayTimer();
    this.autoplayCheckTimer = window.setTimeout(() => {
      if (this.destroyed || !this.player || !this.isPlayerReady) return;
      if (!this.pendingTrack?.is_playing) return;
      try {
        const state = this.player.getPlayerState?.();
        const playerMuted = Boolean(this.player.isMuted?.());
        if (state === 1) {
          this.emitStatus('playing', !this.muted && this.volume > 0 && playerMuted);
          return;
        }
        if (state === -1 || state === 5 || state === 2) {
          // Navegador bloqueou autoplay com som: inicia vídeo visível mutado e avisa usuário
          this.player.mute();
          this.player.playVideo();
          this.emitStatus('blocked', true);
        }
      } catch {
        // Silencioso
      }
    }, 1100);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumeToPlayer();
  }

  setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    this.volume = clamped;
    this.applyVolumeToPlayer();
  }

  /** Aplica atenuação suave baseada na distância até a Cabine de DJ (0.55..1.0) */
  setSpatialGain(gain: number): void {
    const clamped = Math.max(0.55, Math.min(1, gain));
    if (Math.abs(this.spatialGain - clamped) < 0.015) return;
    this.spatialGain = clamped;
    this.applyVolumeToPlayer();
  }

  destroy(): void {
    this.destroyed = true;
    this.clearAutoplayTimer();
    try {
      this.player?.destroy();
    } catch {
      // Silencioso
    }
    this.player = null;
    this.isPlayerReady = false;
    this.currentVideoId = null;
  }
}
