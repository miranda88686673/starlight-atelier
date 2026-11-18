import React from 'react';
import atelierCoupleImg from '../assets/images/atelier_couple_portrait_1794768226559.jpg';
import atelierFloralImg from '../assets/images/atelier_floral_crest_1794768226415.jpg';
import atelierFurnitureImg from '../assets/images/news_atelier_furniture_1794575518176.jpg';
import runwayEventImg from '../assets/images/news_runway_event_1794575517773.jpg';
import streetwearUsImg from '../assets/images/news_streetwear_us_1794575515807.jpg';
import vipLegendaryImg from '../assets/images/news_vip_legendary_1794575516493.jpg';
import { ProfileBannerConfig, ProfileBannerPresetId } from '../types/game';

export interface BannerPresetMeta {
  id: Exclude<ProfileBannerPresetId, 'custom_image'>;
  name: string;
  subtitle: string;
  baseGradient: string;
  orbAColor: string;
  orbBColor: string;
  ribbonColor: string;
  swatchHex: string;
}

export interface GameBannerImageMeta {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
}

export const PROFILE_GAME_BANNER_IMAGES: GameBannerImageMeta[] = [
  {
    id: 'game_runway',
    name: 'Passarela Starlight',
    subtitle: 'Desfile oficial e holofotes do atelier',
    imageUrl: runwayEventImg,
  },
  {
    id: 'game_vip_legendary',
    name: 'Salão VIP & Coroas',
    subtitle: 'Galeria dourada de peças exclusivas',
    imageUrl: vipLegendaryImg,
  },
  {
    id: 'game_streetwear',
    name: 'Avenida Streetwear',
    subtitle: 'Editorial urbano contemporâneo',
    imageUrl: streetwearUsImg,
  },
  {
    id: 'game_atelier_suite',
    name: 'Suíte Clássica',
    subtitle: 'Interiores e mobiliário de luxo do jogo',
    imageUrl: atelierFurnitureImg,
  },
  {
    id: 'game_couple_portrait',
    name: 'Retrato do Atelier',
    subtitle: 'Ilustração clássica em seda champagne',
    imageUrl: atelierCoupleImg,
  },
  {
    id: 'game_floral_crest',
    name: 'Brasão Floral Dourado',
    subtitle: 'Ornamentos botânicos do Starlight',
    imageUrl: atelierFloralImg,
  },
];

export const PROFILE_BANNER_PRESETS: BannerPresetMeta[] = [
  {
    id: 'atelier_aurora',
    name: 'Aurora do Atelier',
    subtitle: 'Seda rosé e champagne em movimento fluido',
    baseGradient: 'linear-gradient(125deg, #211018 0%, #5B1331 48%, #281B29 100%)',
    orbAColor: 'radial-gradient(circle, rgba(236, 72, 153, 0.52) 0%, transparent 68%)',
    orbBColor: 'radial-gradient(circle, rgba(212, 168, 83, 0.44) 0%, transparent 68%)',
    ribbonColor: 'linear-gradient(90deg, transparent 0%, rgba(255, 240, 245, 0.16) 50%, transparent 100%)',
    swatchHex: '#9E1646',
  },
  {
    id: 'runway_gold',
    name: 'Passarela Dourada',
    subtitle: 'Holofotes dourados deslizantes sobre veludo ônix',
    baseGradient: 'linear-gradient(125deg, #17130E 0%, #3E2B14 50%, #1C1917 100%)',
    orbAColor: 'radial-gradient(circle, rgba(245, 158, 11, 0.48) 0%, transparent 66%)',
    orbBColor: 'radial-gradient(circle, rgba(253, 230, 138, 0.34) 0%, transparent 68%)',
    ribbonColor: 'linear-gradient(90deg, transparent 0%, rgba(254, 243, 199, 0.22) 50%, transparent 100%)',
    swatchHex: '#D4A853',
  },
  {
    id: 'midnight_velvet',
    name: 'Noite Estrelada',
    subtitle: 'Índigo noturno com feixes prismáticos cobalto',
    baseGradient: 'linear-gradient(125deg, #090D1F 0%, #1E2252 52%, #131026 100%)',
    orbAColor: 'radial-gradient(circle, rgba(56, 189, 248, 0.45) 0%, transparent 66%)',
    orbBColor: 'radial-gradient(circle, rgba(168, 85, 247, 0.42) 0%, transparent 68%)',
    ribbonColor: 'linear-gradient(90deg, transparent 0%, rgba(186, 230, 253, 0.18) 50%, transparent 100%)',
    swatchHex: '#3B82F6',
  },
  {
    id: 'botanical_silk',
    name: 'Jardim Editorial',
    subtitle: 'Ondas esmeraldas suaves e brilho marfim',
    baseGradient: 'linear-gradient(125deg, #0D1F18 0%, #1B4332 50%, #1B2621 100%)',
    orbAColor: 'radial-gradient(circle, rgba(52, 211, 153, 0.42) 0%, transparent 66%)',
    orbBColor: 'radial-gradient(circle, rgba(250, 246, 240, 0.24) 0%, transparent 68%)',
    ribbonColor: 'linear-gradient(90deg, transparent 0%, rgba(209, 250, 229, 0.18) 50%, transparent 100%)',
    swatchHex: '#10B981',
  },
  {
    id: 'sunset_rose',
    name: 'Crepúsculo Rosé',
    subtitle: 'Gradiente editorial pêssego, rubi e âmbar em deriva',
    baseGradient: 'linear-gradient(125deg, #2D1119 0%, #7C223A 48%, #47251D 100%)',
    orbAColor: 'radial-gradient(circle, rgba(251, 113, 133, 0.5) 0%, transparent 66%)',
    orbBColor: 'radial-gradient(circle, rgba(251, 146, 60, 0.4) 0%, transparent 68%)',
    ribbonColor: 'linear-gradient(90deg, transparent 0%, rgba(255, 228, 230, 0.2) 50%, transparent 100%)',
    swatchHex: '#E11D48',
  },
];

interface ProfileAnimatedBannerProps {
  banner?: ProfileBannerConfig;
  className?: string;
}

/**
 * Fundo animado em movimento contínuo posicionado acima e por trás
 * da foto de perfil, nome de usuário e informações da conta.
 * Usa exclusivamente transformações GPU (`transform`) + scrim de contraste WCAG.
 */
export const ProfileAnimatedBanner: React.FC<ProfileAnimatedBannerProps> = ({
  banner,
  className = '',
}) => {
  const speed = banner?.motionSpeed === 'medium' ? 'medium' : 'slow';
  const isCustomImage =
    banner?.presetId === 'custom_image' && Boolean(banner?.customImageUrl);

  const preset =
    PROFILE_BANNER_PRESETS.find((p) => p.id === banner?.presetId) ??
    PROFILE_BANNER_PRESETS[0];

  const panClass =
    speed === 'medium' ? 'profile-banner-pan-medium' : 'profile-banner-pan-slow';
  const orbAClass =
    speed === 'medium' ? 'profile-banner-orb-a-medium' : 'profile-banner-orb-a-slow';
  const orbBClass =
    speed === 'medium' ? 'profile-banner-orb-b-medium' : 'profile-banner-orb-b-slow';
  const sheenClass =
    speed === 'medium' ? 'profile-banner-sheen-medium' : 'profile-banner-sheen-slow';

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {isCustomImage ? (
        <>
          <img
            src={banner?.customImageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover ${panClass}`}
          />
          <div
            className={`absolute inset-y-0 w-[40%] ${sheenClass}`}
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255, 245, 235, 0.14) 50%, transparent 100%)',
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: preset.baseGradient }}
        >
          {/* Malha sutil e camadas em deriva contínua */}
          <div
            className={`absolute -top-1/2 -left-1/4 w-[85%] h-[180%] rounded-full blur-2xl ${orbAClass}`}
            style={{ background: preset.orbAColor }}
          />
          <div
            className={`absolute -bottom-1/2 -right-1/4 w-[85%] h-[180%] rounded-full blur-2xl ${orbBClass}`}
            style={{ background: preset.orbBColor }}
          />
          {/* Feixe luminoso diagonal passando sobre o banner */}
          <div
            className={`absolute inset-y-0 w-[45%] ${sheenClass}`}
            style={{ background: preset.ribbonColor }}
          />
          {/* Linhas editoriais sutis para textura arquitetônica */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0 1px, transparent 1px 64px)',
            }}
          />
        </div>
      )}

      {/* Scrim de contraste para legibilidade do avatar, bandeira, nível e data de criação */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(16, 13, 12, 0.16) 0%, rgba(16, 13, 12, 0.48) 48%, rgba(16, 13, 12, 0.88) 100%)',
        }}
      />
    </div>
  );
};
