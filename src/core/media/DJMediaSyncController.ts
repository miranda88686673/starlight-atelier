/**
 * DJMediaSyncController — Ponte de Mídia Externa (YouTube IFrame Player API).
 * Carrega https://www.youtube.com/iframe_api assincronamente e sincroniza a faixa
 * da Cabine de DJ (video_id, started_at, is_playing) ao segundo exato entre todos os clientes.
 */

export interface DjSyncTrackInput {
  video_id: string;
  started_at: number;
  is_playing: boolean;
}

interface YTPlayerInstance {
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  cueVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
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
  private onEndedCallback?: () => void;
  private destroyed = false;

  /** Inicializa o YT.Player dentro do elemento container oculto ou visível */
  async mount(container: HTMLElement): Promise<void> {
    if (this.destroyed || this.player) return;

    const YT = await loadYouTubeIframeApi();
    if (this.destroyed) return;

    const hostEl = document.createElement('div');
    container.innerHTML = '';
    container.appendChild(hostEl);

    this.player = new YT.Player(hostEl, {
      height: '1',
      width: '1',
      videoId: this.pendingTrack?.video_id ?? undefined,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          this.isPlayerReady = true;
          if (this.muted || this.volume <= 0) {
            this.player?.mute();
          } else {
            this.player?.unMute();
            this.player?.setVolume(this.volume);
          }
          if (this.pendingTrack) {
            this.applyTrackState(this.pendingTrack);
          }
        },
        onStateChange: (ev) => {
          if (ev.data === 0) {
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
      },
    });
  }

  setOnEnded(cb?: () => void): void {
    this.onEndedCallback = cb;
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

    if (!track || !track.video_id) {
      this.currentVideoId = null;
      this.player.stopVideo();
      return;
    }

    const startSeconds = DJMediaSyncController.computeElapsedSeconds(track.started_at);

    if (this.currentVideoId !== track.video_id) {
      this.currentVideoId = track.video_id;
      if (track.is_playing) {
        this.player.loadVideoById({
          videoId: track.video_id,
          startSeconds,
        });
      } else {
        this.player.cueVideoById({
          videoId: track.video_id,
          startSeconds,
        });
      }
    } else if (track.is_playing) {
      try {
        const currentTime = this.player.getCurrentTime?.() ?? startSeconds;
        // Só corrige posição se houver deriva superior a 2 segundos para evitar engasgos
        if (Math.abs(currentTime - startSeconds) > 2.5) {
          this.player.loadVideoById({
            videoId: track.video_id,
            startSeconds,
          });
        } else {
          this.player.playVideo();
        }
      } catch {
        this.player.playVideo();
      }
    } else {
      this.player.pauseVideo();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.player || !this.isPlayerReady) return;
    if (muted || this.volume <= 0) {
      this.player.mute();
    } else {
      this.player.unMute();
      this.player.setVolume(this.volume);
    }
  }

  setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    this.volume = clamped;
    if (!this.player || !this.isPlayerReady) return;
    if (this.muted || clamped <= 0) {
      this.player.mute();
    } else {
      this.player.unMute();
      this.player.setVolume(clamped);
    }
  }

  destroy(): void {
    this.destroyed = true;
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
