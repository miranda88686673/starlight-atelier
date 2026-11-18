import React, { useId } from 'react';
import {
  PurchasableWallpaperItem,
  RoomBackdropTheme,
} from '../../types/game';

interface RoomBackdropSvgProps {
  theme: RoomBackdropTheme;
  wallpaper?: PurchasableWallpaperItem;
}

/**
 * Cenário SVG 2D temático compartilhado entre Salas Globais, Criador de Salas e Starplaza.
 * Garante pré-visualizações arquitetônicas nítidas e detalhadas sem blocos genéricos vazios.
 */
export const RoomBackdropSvg: React.FC<RoomBackdropSvgProps> = React.memo(
  ({ theme, wallpaper }) => {
    const uid = useId().replace(/:/g, '');

    const renderArchitecturalBackdrop = () => {
      if (theme === 'lounge_party') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`${uid}_sky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="65%" stopColor="#7DD3FC" />
                <stop offset="100%" stopColor="#BAE6FD" />
              </linearGradient>
              <linearGradient id={`${uid}_woodDeck`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7A4928" />
                <stop offset="100%" stopColor="#5C3419" />
              </linearGradient>
              <linearGradient id={`${uid}_aqWater`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#0369A1" stopOpacity="0.65" />
              </linearGradient>
            </defs>

            {/* Céu azul limpo e lindo com sol radiante */}
            <rect x="0" y="0" width="800" height="290" fill={`url(#${uid}_sky)`} />
            <circle cx="670" cy="52" r="34" fill="#FEF3C7" opacity="0.95" />
            <circle cx="670" cy="52" r="48" fill="#FDE68A" opacity="0.32" />

            {/* Nuvens fofas brancas no céu limpo */}
            {[
              { cx: 140, cy: 62, r: 24 },
              { cx: 165, cy: 56, r: 20 },
              { cx: 380, cy: 75, r: 28 },
              { cx: 412, cy: 68, r: 22 },
            ].map((cl, i) => (
              <g key={i} fill="#FFFFFF" opacity="0.82">
                <circle cx={cl.cx} cy={cl.cy} r={cl.r} />
                <circle cx={cl.cx + 22} cy={cl.cy + 4} r={cl.r * 0.8} />
                <circle cx={cl.cx - 20} cy={cl.cy + 6} r={cl.r * 0.75} />
              </g>
            ))}

            {/* Prédios modernos diurnos no plano de fundo */}
            {[
              { x: 10, y: 110, w: 58, h: 180 },
              { x: 74, y: 68, w: 52, h: 222 },
              { x: 132, y: 95, w: 62, h: 195 },
              { x: 202, y: 52, w: 56, h: 238 },
              { x: 266, y: 88, w: 66, h: 202 },
              { x: 342, y: 64, w: 58, h: 226 },
              { x: 408, y: 98, w: 60, h: 192 },
              { x: 476, y: 56, w: 64, h: 234 },
              { x: 548, y: 84, w: 54, h: 206 },
              { x: 610, y: 72, w: 62, h: 218 },
              { x: 680, y: 92, w: 56, h: 198 },
              { x: 742, y: 114, w: 52, h: 176 },
            ].map((b, i) => (
              <g key={b.x}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
                {[0, 1, 2, 3, 4, 5].map((r) => (
                  <rect
                    key={r}
                    x={b.x + 8}
                    y={b.y + 14 + r * 22}
                    width={b.w - 16}
                    height="7"
                    fill={i % 2 === 0 ? '#E2E8F0' : '#94A3B8'}
                    opacity="0.85"
                  />
                ))}
              </g>
            ))}

            {/* Paredes de vidro panorâmicas */}
            <rect x="0" y="165" width="800" height="125" fill="#E0F2FE" opacity="0.25" />
            <line x1="0" y1="165" x2="800" y2="165" stroke="#94A3B8" strokeWidth="3.5" />
            {[160, 320, 480, 640].map((gx) => (
              <line key={gx} x1={gx} y1="165" x2={gx} y2="290" stroke="#94A3B8" strokeWidth="2.5" opacity="0.7" />
            ))}

            {/* Aquários de luxo com peixes nadando junto às paredes de vidro */}
            {[36, 564].map((ax) => (
              <g key={ax}>
                <rect x={ax} y="256" width="200" height="32" fill="#0F172A" stroke="#D4A853" strokeWidth="2" />
                <rect x={ax + 2} y="180" width="196" height="76" fill={`url(#${uid}_aqWater)`} stroke="#D4A853" strokeWidth="2.5" />
                <ellipse cx={ax + 52} cy="212" rx="12" ry="6" fill="#FF6B2B" />
                <polygon points={`${ax + 40},212 ${ax + 31},206 ${ax + 31},218`} fill="#FFFFFF" />
                <ellipse cx={ax + 112} cy="228" rx="11" ry="5.5" fill="#FACC15" />
                <polygon points={`${ax + 123},228 ${ax + 132},223 ${ax + 132},233`} fill="#FEF3C7" />
                <ellipse cx={ax + 158} cy="204" rx="10" ry="5" fill="#38BDF8" />
                <polygon points={`${ax + 148},204 ${ax + 140},199 ${ax + 140},209`} fill="#E0F2FE" />
              </g>
            ))}

            {/* Chão de madeira do terraço */}
            <rect x="0" y="288" width="800" height="212" fill={`url(#${uid}_woodDeck)`} />
            {[320, 355, 390, 425, 460, 492].map((wy) => (
              <line key={wy} x1="0" y1={wy} x2="800" y2={wy} stroke="#3D2110" strokeWidth="2" opacity="0.65" />
            ))}
            <ellipse cx="400" cy="396" rx="165" ry="44" fill="#2A1B12" opacity="0.65" stroke="#F59E0B" strokeWidth="3" />
          </svg>
        );
      }

      if (theme === 'ilha_tropical' || theme === 'ilha_coqueiro') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`${uid}_tropSky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0EA5E9" />
                <stop offset="100%" stopColor="#BAE6FD" />
              </linearGradient>
              <linearGradient id={`${uid}_tropOcean`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284C7" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="800" height="250" fill={`url(#${uid}_tropSky)`} />
            <circle cx="675" cy="60" r="34" fill="#FEF08A" />
            <rect x="0" y="220" width="800" height="280" fill={`url(#${uid}_tropOcean)`} />
            <ellipse cx="400" cy="390" rx="310" ry="105" fill="#F2D296" stroke="#FFFFFF" strokeWidth="6" strokeOpacity="0.65" />
            {/* Coqueiro esquerdo */}
            <path d="M120 355 Q138 250 110 155" stroke="#7C5333" strokeWidth="14" fill="none" strokeLinecap="round" />
            <circle cx="110" cy="164" r="8" fill="#4B2C15" />
            <circle cx="120" cy="168" r="8" fill="#4B2C15" />
            <path d="M110 155 Q50 130 30 180 M110 155 Q175 125 190 175 M110 155 Q105 95 145 105" stroke="#16A34A" strokeWidth="10" fill="none" strokeLinecap="round" />
            {theme === 'ilha_tropical' && (
              <>
                <path d="M680 355 Q662 250 690 155" stroke="#7C5333" strokeWidth="14" fill="none" strokeLinecap="round" />
                <circle cx="690" cy="164" r="8" fill="#4B2C15" />
                <circle cx="680" cy="168" r="8" fill="#4B2C15" />
                <path d="M690 155 Q625 125 610 175 M690 155 Q750 130 770 180 M690 155 Q695 95 655 105" stroke="#16A34A" strokeWidth="10" fill="none" strokeLinecap="round" />
              </>
            )}
          </svg>
        );
      }

      if (theme === 'floresta_piquenique') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <rect x="0" y="0" width="800" height="250" fill="#7DD3FC" />
            <circle cx="660" cy="65" r="32" fill="#FEF08A" />
            <rect x="0" y="230" width="800" height="270" fill="#4ADE80" />
            <ellipse cx="195" cy="365" rx="115" ry="48" fill="#0EA5E9" stroke="#78716C" strokeWidth="8" />
            {[90, 210, 590, 710].map((tx) => (
              <g key={tx}>
                <rect x={tx - 10} y="155" width="20" height="95" fill="#78350F" />
                <circle cx={tx} cy="130" r="52" fill="#15803D" />
                <circle cx={tx - 24} cy="150" r="36" fill="#16A34A" />
                <circle cx={tx + 24} cy="150" r="36" fill="#22C55E" />
              </g>
            ))}
            <rect x="470" y="340" width="150" height="72" rx="6" fill="#EF4444" fillOpacity="0.85" stroke="#FFFFFF" strokeWidth="4" />
            <circle cx="515" cy="366" r="10" fill="#A1622B" />
            <circle cx="560" cy="378" r="8" fill="#EF4444" />
            <circle cx="585" cy="372" r="8" fill="#F97316" />
          </svg>
        );
      }

      if (theme === 'boate_neon') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`${uid}_clubWall`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0E0B1D" />
                <stop offset="100%" stopColor="#261347" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="800" height="288" fill={`url(#${uid}_clubWall)`} />
            <polygon points="160,0 40,288 260,288" fill="#EC4899" opacity="0.16" />
            <polygon points="640,0 540,288 760,288" fill="#38BDF8" opacity="0.16" />
            <circle cx="400" cy="48" r="26" fill="#E2E8F0" opacity="0.88" />
            <rect
              x="245"
              y="138"
              width="310"
              height="142"
              rx="8"
              fill="#181230"
              stroke="#7E22CE"
              strokeWidth="2.5"
            />
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <rect
                key={i}
                x={268 + i * 27}
                y={170 + ((i * 19) % 45)}
                width="18"
                height={95 - ((i * 19) % 45)}
                rx="2"
                fill={i % 2 === 0 ? '#EC4899' : '#38BDF8'}
                opacity="0.85"
              />
            ))}
            <rect x="0" y="286" width="800" height="214" fill="#11101C" />
            <g opacity="0.32">
              {[160, 240, 320, 400, 480, 560].map((x, idx) => (
                <rect
                  key={x}
                  x={x}
                  y="340"
                  width="74"
                  height="48"
                  fill={idx % 2 === 0 ? '#A855F7' : '#38BDF8'}
                  stroke="#0F172A"
                  strokeWidth="2"
                />
              ))}
            </g>
          </svg>
        );
      }

      if (theme === 'hotel_royal_vip') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <rect x="0" y="0" width="800" height="288" fill="#231D29" />
            <rect x="0" y="205" width="800" height="83" fill="#17131C" />
            <line x1="0" y1="205" x2="800" y2="205" stroke="#D4A853" strokeWidth="2.5" />
            {[140, 400, 660].map((cx) => (
              <g key={cx}>
                <path
                  d={`M${cx - 58},245 L${cx - 58},92 A58,58 0 0,1 ${cx + 58},92 L${cx + 58},245 Z`}
                  fill="#332B3D"
                  stroke="#D4A853"
                  strokeWidth="3.5"
                />
                <circle cx={cx} cy="56" r="14" fill="#FDE68A" opacity="0.65" />
              </g>
            ))}
            <rect x="0" y="288" width="800" height="212" fill="#EAE0D2" />
            <path
              d="M295,288 L505,288 L560,500 L240,500 Z"
              fill="#9E1B49"
              opacity="0.88"
            />
            <line x1="295" y1="288" x2="240" y2="500" stroke="#D4A853" strokeWidth="3" />
            <line x1="505" y1="288" x2="560" y2="500" stroke="#D4A853" strokeWidth="3" />
          </svg>
        );
      }

      if (theme === 'bar_lounge') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <rect x="0" y="0" width="800" height="286" fill="#2D1D17" />
            <rect x="0" y="202" width="800" height="84" fill="#201410" />
            <rect
              x="220"
              y="54"
              width="360"
              height="145"
              rx="6"
              fill="#3D271E"
              stroke="#C49A48"
              strokeWidth="2.5"
            />
            <line
              x1="235"
              y1="104"
              x2="565"
              y2="104"
              stroke="#F59E0B"
              strokeWidth="2"
              opacity="0.7"
            />
            <line
              x1="235"
              y1="152"
              x2="565"
              y2="152"
              stroke="#F59E0B"
              strokeWidth="2"
              opacity="0.7"
            />
            {[260, 300, 340, 380, 420, 460, 500, 535].map((x, idx) => (
              <rect
                key={x}
                x={x}
                y={idx % 2 === 0 ? 74 : 122}
                width="12"
                height="26"
                rx="2"
                fill={idx % 3 === 0 ? '#FBBF24' : '#38BDF8'}
                opacity="0.82"
              />
            ))}
            <rect x="0" y="286" width="800" height="214" fill="#5A3B2B" />
            {[330, 376, 424, 468].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="800"
                y2={y}
                stroke="#41291D"
                strokeWidth="1.5"
              />
            ))}
          </svg>
        );
      }

      if (theme === 'cobertura_diamante_vip') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`${uid}_diamondSky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B1120" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="800" height="284" fill={`url(#${uid}_diamondSky)`} />
            {[80, 150, 240, 330, 450, 560, 680, 740].map((cx, idx) => (
              <circle
                key={cx}
                cx={cx}
                cy={28 + ((idx * 23) % 70)}
                r="2.2"
                fill="#E0F2FE"
              />
            ))}
            <g fill="#0F172A" opacity="0.88">
              <rect x="30" y="135" width="75" height="149" />
              <rect x="125" y="96" width="60" height="188" />
              <rect x="615" y="88" width="72" height="196" />
              <rect x="705" y="130" width="78" height="154" />
            </g>
            <line
              x1="0"
              y1="244"
              x2="800"
              y2="244"
              stroke="#38BDF8"
              strokeWidth="2.5"
              opacity="0.8"
            />
            <rect x="0" y="284" width="800" height="216" fill="#1E293B" />
            <ellipse
              cx="400"
              cy="392"
              rx="235"
              ry="66"
              fill="#38BDF8"
              opacity="0.16"
              stroke="#D4A853"
              strokeWidth="2"
            />
          </svg>
        );
      }

      if (theme === 'casa_estar_moderna') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <rect x="0" y="0" width="800" height="286" fill="#F4F1EA" />
            <rect x="0" y="212" width="800" height="74" fill="#E5DFD3" />
            <rect
              x="180"
              y="42"
              width="440"
              height="176"
              rx="4"
              fill="#D4E8DA"
              stroke="#6E5A47"
              strokeWidth="6"
            />
            <line x1="326" y1="42" x2="326" y2="218" stroke="#FFFFFF" strokeWidth="4" />
            <line x1="473" y1="42" x2="473" y2="218" stroke="#FFFFFF" strokeWidth="4" />
            <circle cx="255" cy="145" r="36" fill="#5F8D6B" opacity="0.6" />
            <circle cx="535" cy="136" r="42" fill="#467A5B" opacity="0.55" />
            <rect x="0" y="286" width="800" height="214" fill="#DFC9AE" />
            {[326, 370, 418, 464].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="800"
                y2={y}
                stroke="#C7AC8C"
                strokeWidth="1.4"
              />
            ))}
            <ellipse
              cx="400"
              cy="392"
              rx="230"
              ry="62"
              fill="#FAF6F0"
              stroke="#D5C8B8"
              strokeWidth="2"
            />
          </svg>
        );
      }

      if (theme === 'quarto_cozy') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <rect x="0" y="0" width="800" height="288" fill="#F6EDE3" />
            <rect x="0" y="218" width="800" height="70" fill="#EADAC8" />
            <rect
              x="82"
              y="56"
              width="160"
              height="145"
              rx="4"
              fill="#DCE6EF"
              stroke="#B6997C"
              strokeWidth="5"
            />
            <line x1="162" y1="56" x2="162" y2="201" stroke="#FFFFFF" strokeWidth="3" />
            <line x1="82" y1="128" x2="242" y2="128" stroke="#FFFFFF" strokeWidth="3" />
            <path d="M74,50 L108,50 L96,208 L74,208 Z" fill="#D8A7B1" opacity="0.88" />
            <path d="M216,50 L250,50 L250,208 L228,208 Z" fill="#D8A7B1" opacity="0.88" />
            <path
              d="M270,58 Q430,104 590,58 Q695,86 780,55"
              fill="none"
              stroke="#9C7F63"
              strokeWidth="1.6"
            />
            {[300, 360, 425, 490, 555, 625, 695, 755].map((cx, idx) => (
              <circle
                key={cx}
                cx={cx}
                cy={idx % 2 === 0 ? 73 : 82}
                r="5"
                fill="#FDE68A"
              />
            ))}
            <rect
              x="490"
              y="168"
              width="230"
              height="118"
              rx="8"
              fill="#B58B67"
              stroke="#8C6645"
              strokeWidth="2"
            />
            <rect x="504" y="196" width="202" height="74" rx="6" fill="#FAF6F0" />
            <rect x="504" y="220" width="202" height="58" rx="6" fill="#E3A8B5" />
            <rect
              x="520"
              y="182"
              width="66"
              height="28"
              rx="6"
              fill="#FFFFFF"
              stroke="#E6DCD1"
              strokeWidth="1.5"
            />
            <rect
              x="612"
              y="182"
              width="66"
              height="28"
              rx="6"
              fill="#FFFFFF"
              stroke="#E6DCD1"
              strokeWidth="1.5"
            />
            <rect
              x="315"
              y="96"
              width="110"
              height="82"
              rx="4"
              fill="#FFFFFF"
              stroke="#B58B67"
              strokeWidth="4"
            />
            <circle cx="370" cy="137" r="20" fill="#E8B8C2" opacity="0.65" />
            <rect x="0" y="288" width="800" height="212" fill="#DFC7AE" />
            {[328, 372, 416, 460].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="800"
                y2={y}
                stroke="#CAAE91"
                strokeWidth="1.4"
              />
            ))}
            <ellipse
              cx="385"
              cy="392"
              rx="225"
              ry="64"
              fill="#FAF4ED"
              stroke="#E2D3C2"
              strokeWidth="2.5"
            />
          </svg>
        );
      }

      if (theme === 'cafe_starlight') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <rect x="0" y="0" width="800" height="295" fill="#F8F1E7" />
            <g>
              <rect x="0" y="0" width="800" height="44" fill="#C8235D" />
              {[0, 80, 160, 240, 320, 400, 480, 560, 640, 720].map((x) => (
                <rect key={x} x={x} y="0" width="40" height="44" fill="#FAF6F0" />
              ))}
              <rect x="0" y="42" width="800" height="6" fill="#9E1B49" opacity="0.35" />
            </g>
            <rect
              x="70"
              y="84"
              width="170"
              height="150"
              rx="4"
              fill="#DCE9F0"
              stroke="#C7B8A5"
              strokeWidth="5"
            />
            <line x1="155" y1="84" x2="155" y2="234" stroke="#FFFFFF" strokeWidth="3" />
            <rect
              x="560"
              y="84"
              width="170"
              height="150"
              rx="4"
              fill="#DCE9F0"
              stroke="#C7B8A5"
              strokeWidth="5"
            />
            <line x1="645" y1="84" x2="645" y2="234" stroke="#FFFFFF" strokeWidth="3" />
            <rect
              x="305"
              y="176"
              width="190"
              height="108"
              rx="4"
              fill="#6F4E37"
              stroke="#4F3524"
              strokeWidth="2"
            />
            <rect
              x="295"
              y="168"
              width="210"
              height="14"
              rx="3"
              fill="#FAF6F0"
              stroke="#D5C8B8"
              strokeWidth="1.5"
            />
            <text
              x="400"
              y="138"
              textAnchor="middle"
              fill="#6F4E37"
              fontSize="18"
              fontFamily="Georgia, serif"
              fontWeight="bold"
            >
              CAFÉ STARLIGHT
            </text>
            <rect x="0" y="285" width="800" height="215" fill="#E8DED1" />
            <g fill="#D7C8B6" opacity="0.55">
              {[0, 100, 200, 300, 400, 500, 600, 700].map((x) => (
                <rect key={`r1-${x}`} x={x} y="290" width="50" height="45" />
              ))}
              {[50, 150, 250, 350, 450, 550, 650, 750].map((x) => (
                <rect key={`r2-${x}`} x={x} y="335" width="50" height="50" />
              ))}
              {[0, 100, 200, 300, 400, 500, 600, 700].map((x) => (
                <rect key={`r3-${x}`} x={x} y="385" width="50" height="55" />
              ))}
            </g>
          </svg>
        );
      }

      if (theme === 'festa_cobertura') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`${uid}_duskSky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2A2438" />
                <stop offset="65%" stopColor="#5C3D5E" />
                <stop offset="100%" stopColor="#C77D8A" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="800" height="285" fill={`url(#${uid}_duskSky)`} />
            <g fill="#221D2E" opacity="0.72">
              <rect x="20" y="130" width="75" height="155" />
              <rect x="110" y="95" width="60" height="190" />
              <rect x="185" y="150" width="85" height="135" />
              <rect x="520" y="110" width="80" height="175" />
              <rect x="615" y="85" width="70" height="200" />
              <rect x="700" y="140" width="85" height="145" />
            </g>
            <path
              d="M0,55 Q200,98 400,62 Q600,98 800,55"
              fill="none"
              stroke="#E5C17B"
              strokeWidth="1.5"
            />
            {[60, 140, 220, 300, 380, 460, 540, 620, 700, 760].map((cx, i) => (
              <circle
                key={cx}
                cx={cx}
                cy={i % 2 === 0 ? 70 : 78}
                r="4.5"
                fill="#FDE68A"
              />
            ))}
            <rect x="0" y="242" width="800" height="42" fill="#FFFFFF" opacity="0.14" />
            <line x1="0" y1="242" x2="800" y2="242" stroke="#E6DDD0" strokeWidth="3" />
            <rect x="0" y="284" width="800" height="216" fill="#46373B" />
            <ellipse cx="400" cy="390" rx="220" ry="62" fill="#C8235D" opacity="0.18" />
            <ellipse cx="400" cy="390" rx="150" ry="42" fill="#FDE68A" opacity="0.15" />
          </svg>
        );
      }

      if (theme === 'atelier_rosa') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <rect x="0" y="0" width="800" height="285" fill="#F9ECF0" />
            <rect x="0" y="205" width="800" height="80" fill="#F2DCE3" />
            <rect
              x="70"
              y="54"
              width="160"
              height="180"
              rx="80"
              fill="#FFFFFF"
              stroke="#E4C1CD"
              strokeWidth="4"
            />
            <rect
              x="570"
              y="54"
              width="160"
              height="180"
              rx="80"
              fill="#FFFFFF"
              stroke="#E4C1CD"
              strokeWidth="4"
            />
            <rect
              x="315"
              y="72"
              width="170"
              height="118"
              rx="4"
              fill="#FFFFFF"
              stroke="#C9A258"
              strokeWidth="4"
            />
            <circle cx="400" cy="131" r="28" fill="#E8A5B2" opacity="0.55" />
            <rect x="0" y="285" width="800" height="215" fill="#EFE4DE" />
            <ellipse
              cx="400"
              cy="392"
              rx="230"
              ry="64"
              fill="#FAF6F4"
              stroke="#E2C3CE"
              strokeWidth="2"
            />
          </svg>
        );
      }

      if (theme === 'estudio_3d_designer') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`${uid}_gridWall`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B0F19" />
                <stop offset="60%" stopColor="#111827" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
              <linearGradient id={`${uid}_catwalkFloor`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              <linearGradient id={`${uid}_spotlightLeft`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${uid}_spotlightRight`} x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F472B6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#F472B6" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Parede de estúdio 3D futurista */}
            <rect x="0" y="0" width="800" height="270" fill={`url(#${uid}_gridWall)`} />

            {/* Treliça metálica de estúdio no topo */}
            <rect x="0" y="0" width="800" height="24" fill="#0A0E17" />
            <line x1="0" y1="24" x2="800" y2="24" stroke="#38BDF8" strokeWidth="2" opacity="0.8" />
            {[40, 120, 200, 280, 360, 440, 520, 600, 680, 760].map((x) => (
              <g key={x}>
                <line x1={x} y1="0" x2={x + 20} y2="24" stroke="#334155" strokeWidth="1.5" />
                <line x1={x + 20} y1="0" x2={x} y2="24" stroke="#334155" strokeWidth="1.5" />
                <circle cx={x + 10} cy="24" r="3.5" fill="#38BDF8" />
              </g>
            ))}

            {/* Painel Central: Telão de Criação 3D com malha poligonal */}
            <rect x="220" y="46" width="360" height="175" rx="8" fill="#090D16" stroke="#38BDF8" strokeWidth="2.5" />
            <rect x="232" y="58" width="336" height="151" rx="4" fill="#0F172A" />

            {/* Linhas de perspectiva isométrica / malha 3D na tela */}
            <g opacity="0.35" stroke="#38BDF8" strokeWidth="1">
              {[80, 110, 140, 170].map((y) => (
                <line key={y} x1="232" y1={y} x2="568" y2={y} />
              ))}
              {[270, 310, 350, 390, 430, 470, 510, 550].map((x) => (
                <line key={x} x1={x} y1="58" x2={x} y2="209" />
              ))}
            </g>

            {/* Holograma de Manequim Alta-Costura na tela */}
            <g stroke="#38BDF8" strokeWidth="1.8" fill="none" opacity="0.85">
              <ellipse cx="400" cy="92" rx="14" ry="17" />
              <path d="M386,110 L414,110 L422,142 L400,165 L378,142 Z" />
              <line x1="400" y1="165" x2="400" y2="198" strokeWidth="2.5" />
              <ellipse cx="400" cy="198" rx="18" ry="4" fill="#38BDF8" fillOpacity="0.3" />
            </g>
            <text x="400" y="80" textAnchor="middle" fill="#38BDF8" fontSize="10" fontWeight="bold" letterSpacing="2">
              ESTÚDIO 3D DESIGNER
            </text>

            {/* Feixes de luz volumétrica (spotlights) */}
            <polygon points="120,24 0,380 260,380" fill={`url(#${uid}_spotlightLeft)`} />
            <polygon points="680,24 540,380 800,380" fill={`url(#${uid}_spotlightRight)`} />

            {/* Piso com perspectiva 3D profunda */}
            <rect x="0" y="270" width="800" height="230" fill={`url(#${uid}_catwalkFloor)`} />

            {/* Linhas radiais de fuga da perspectiva 3D no chão */}
            <g stroke="#38BDF8" strokeWidth="1.2" opacity="0.3">
              {[0, 80, 160, 240, 320, 480, 560, 640, 720, 800].map((x) => (
                <line key={x} x1="400" y1="270" x2={x} y2="500" />
              ))}
              {[300, 335, 375, 420, 470].map((y) => (
                <line key={y} x1="0" y1={y} x2="800" y2={y} strokeWidth={1 + (y - 300) * 0.01} />
              ))}
            </g>

            {/* Passarela 3D central iluminada */}
            <polygon
              points="330,270 470,270 540,500 260,500"
              fill="#1E293B"
              stroke="#38BDF8"
              strokeWidth="2.5"
            />
            {/* Faixa neon central da passarela */}
            <polygon
              points="385,270 415,270 425,500 375,500"
              fill="#38BDF8"
              opacity="0.25"
            />
            <line x1="330" y1="270" x2="260" y2="500" stroke="#F472B6" strokeWidth="2.5" />
            <line x1="470" y1="270" x2="540" y2="500" stroke="#38BDF8" strokeWidth="2.5" />

            {/* Caixas de som laterais de estúdio */}
            <rect x="25" y="195" width="45" height="90" rx="3" fill="#111827" stroke="#38BDF8" strokeWidth="1.5" />
            <circle cx="47" cy="225" r="14" fill="#1F2937" stroke="#38BDF8" strokeWidth="1" />
            <circle cx="47" cy="262" r="16" fill="#1F2937" stroke="#38BDF8" strokeWidth="1" />

            <rect x="730" y="195" width="45" height="90" rx="3" fill="#111827" stroke="#F472B6" strokeWidth="1.5" />
            <circle cx="753" cy="225" r="14" fill="#1F2937" stroke="#F472B6" strokeWidth="1" />
            <circle cx="753" cy="262" r="16" fill="#1F2937" stroke="#F472B6" strokeWidth="1" />
          </svg>
        );
      }

      if (theme === 'chao_plano_custom') {
        return (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <rect x="0" y="0" width="800" height="295" fill="#CBD5E1" />
            <rect x="0" y="295" width="800" height="205" fill="#EFEAE3" />
            <line x1="0" y1="295" x2="800" y2="295" stroke="#D6CFC7" strokeWidth="2" />
          </svg>
        );
      }

      return (
        <svg
          viewBox="0 0 800 500"
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
        >
          <rect x="0" y="0" width="800" height="285" fill="#F5EFE7" />
          <rect x="0" y="205" width="800" height="80" fill="#EAE0D2" />
          {[120, 400, 680].map((cx) => (
            <g key={cx}>
              <path
                d={`M${cx - 64},245 L${cx - 64},96 A64,64 0 0,1 ${cx + 64},96 L${cx + 64},245 Z`}
                fill="#DFECF2"
                stroke="#D1C4B2"
                strokeWidth="4"
              />
              <line x1={cx} y1="32" x2={cx} y2="245" stroke="#FFFFFF" strokeWidth="3" />
            </g>
          ))}
          <rect
            x="200"
            y="228"
            width="140"
            height="50"
            rx="12"
            fill="#D58799"
            stroke="#AD5B6F"
            strokeWidth="1.5"
          />
          <rect
            x="460"
            y="228"
            width="140"
            height="50"
            rx="12"
            fill="#D58799"
            stroke="#AD5B6F"
            strokeWidth="1.5"
          />
          <rect x="0" y="285" width="800" height="215" fill="#EAE2D6" />
          <ellipse
            cx="400"
            cy="392"
            rx="240"
            ry="68"
            fill="#F6F1EA"
            stroke="#D5C8B8"
            strokeWidth="2"
          />
        </svg>
      );
    };

    return (
      <>
        {renderArchitecturalBackdrop()}
        {wallpaper && (
          <svg
            viewBox="0 0 800 500"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <rect
              x="0"
              y="0"
              width="800"
              height="286"
              fill={wallpaper.wallTopColor}
              opacity="0.45"
            />
            {wallpaper.pattern === 'striped' && (
              <g opacity="0.22">
                {Array.from({ length: 20 }).map((_, idx) => (
                  <rect
                    key={idx}
                    x={idx * 40}
                    y="0"
                    width="18"
                    height="286"
                    fill={wallpaper.accentColor}
                  />
                ))}
              </g>
            )}
            {wallpaper.pattern === 'neon' && (
              <g opacity="0.32">
                <line
                  x1="0"
                  y1="36"
                  x2="800"
                  y2="36"
                  stroke={wallpaper.accentColor}
                  strokeWidth="3"
                />
                <line
                  x1="0"
                  y1="240"
                  x2="800"
                  y2="240"
                  stroke="#38BDF8"
                  strokeWidth="2"
                />
              </g>
            )}
            <rect
              x="0"
              y="286"
              width="800"
              height="214"
              fill={wallpaper.floorTopColor}
              opacity="0.35"
            />
          </svg>
        )}
      </>
    );
  },
);

RoomBackdropSvg.displayName = 'RoomBackdropSvg';
