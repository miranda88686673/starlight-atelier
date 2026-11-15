import React from 'react';
import { FurnitureDef } from '../../types/game';
import { getFullFurnitureCatalog } from '../../utils/storage';

interface FurnitureSvgProps {
  furnitureId: string;
  furnitureDef?: FurnitureDef;
  className?: string;
}

/**
 * Ilustrações vetoriais 2D de alta riqueza visual para Suíte e Starplaza
 * (inclui coleções Boate, Casa por Cômodo, Bares, Hotel de Luxo e peças criadas pela Visão IA).
 */
export const FurnitureSvg: React.FC<FurnitureSvgProps> = ({
  furnitureId,
  furnitureDef,
  className = 'w-full h-full',
}) => {
  switch (furnitureId) {
    case 'furn_tapete_persa':
      return (
        <svg viewBox="0 0 240 88" className={className}>
          <polygon
            points="32,12 208,12 234,76 6,76"
            fill="#EDE5D8"
            stroke="#C7BBAE"
            strokeWidth="1.5"
          />
          <polygon
            points="44,20 196,20 216,68 24,68"
            fill="none"
            stroke="#B67C65"
            strokeWidth="2"
          />
          <polygon points="120,26 168,44 120,62 72,44" fill="#D8C8B8" stroke="#A66D57" strokeWidth="1.2" />
          <polygon points="120,34 146,44 120,54 94,44" fill="#C8235D" opacity="0.22" />
        </svg>
      );

    case 'furn_sofa_veludo':
      return (
        <svg viewBox="0 0 195 112" className={className}>
          <rect x="20" y="94" width="6" height="14" rx="2" fill="#B88E44" />
          <rect x="169" y="94" width="6" height="14" rx="2" fill="#B88E44" />
          <path
            d="M22,52 C22,18 46,12 97.5,12 C149,12 173,18 173,52 L173,78 L22,78 Z"
            fill="#C9647C"
            stroke="#9E4259"
            strokeWidth="1.5"
          />
          <line x1="60" y1="18" x2="60" y2="62" stroke="#9E4259" strokeWidth="1.2" opacity="0.5" />
          <line x1="97.5" y1="14" x2="97.5" y2="62" stroke="#9E4259" strokeWidth="1.2" opacity="0.5" />
          <line x1="135" y1="18" x2="135" y2="62" stroke="#9E4259" strokeWidth="1.2" opacity="0.5" />
          <rect x="10" y="42" width="22" height="52" rx="9" fill="#B8536B" stroke="#91374E" strokeWidth="1.4" />
          <rect x="163" y="42" width="22" height="52" rx="9" fill="#B8536B" stroke="#91374E" strokeWidth="1.4" />
          <rect x="30" y="58" width="67" height="24" rx="6" fill="#DA7990" stroke="#9E4259" strokeWidth="1.2" />
          <rect x="98" y="58" width="67" height="24" rx="6" fill="#DA7990" stroke="#9E4259" strokeWidth="1.2" />
          <rect x="14" y="80" width="167" height="16" rx="4" fill="#9E4259" />
          <rect x="38" y="44" width="24" height="20" rx="5" transform="rotate(-8 50 54)" fill="#F7EFE7" stroke="#D5C8BA" strokeWidth="1" />
        </svg>
      );

    case 'furn_mesa_centro':
      return (
        <svg viewBox="0 0 128 76" className={className}>
          <line x1="22" y1="30" x2="22" y2="70" stroke="#B88E44" strokeWidth="3.2" strokeLinecap="round" />
          <line x1="106" y1="30" x2="106" y2="70" stroke="#B88E44" strokeWidth="3.2" strokeLinecap="round" />
          <line x1="40" y1="34" x2="40" y2="62" stroke="#9E7634" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="88" y1="34" x2="88" y2="62" stroke="#9E7634" strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="64" cy="28" rx="56" ry="17" fill="#FAF7F2" stroke="#D8D0C5" strokeWidth="1.5" />
          <path d="M26,28 Q56,22 86,31" fill="none" stroke="#DFD8CE" strokeWidth="1.5" />
          <ellipse cx="64" cy="31" rx="56" ry="17" fill="none" stroke="#C5BBAE" strokeWidth="1" opacity="0.5" />
          <rect x="44" y="20" width="24" height="12" rx="1.5" fill="#2B2629" />
          <rect x="46" y="21" width="20" height="3" fill="#FAF7F2" opacity="0.6" />
          <ellipse cx="82" cy="24" rx="6" ry="3.5" fill="#C8235D" />
        </svg>
      );

    case 'furn_quadro_editorial':
      return (
        <svg viewBox="0 0 92 118" className={className}>
          <rect x="4" y="4" width="84" height="110" rx="2" fill="#C9A258" stroke="#9A7634" strokeWidth="1.5" />
          <rect x="11" y="11" width="70" height="96" fill="#FAF6F0" />
          <circle cx="46" cy="46" r="18" fill="#E8B4BC" opacity="0.7" />
          <path d="M36,84 C36,64 56,64 56,84" fill="none" stroke="#1C1917" strokeWidth="2" />
          <circle cx="46" cy="52" r="7" fill="none" stroke="#1C1917" strokeWidth="1.8" />
          <line x1="25" y1="95" x2="67" y2="95" stroke="#A69B8E" strokeWidth="1" />
        </svg>
      );

    case 'furn_luminaria_arco':
      return (
        <svg viewBox="0 0 100 172" className={className}>
          <ellipse cx="74" cy="160" rx="20" ry="7" fill="#E6DFD5" stroke="#B8AFA2" strokeWidth="1.2" />
          <path
            d="M74,158 C78,86 72,18 32,20 C18,21 16,32 16,42"
            fill="none"
            stroke="#C49A48"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <polygon points="8,62 38,62 48,148 0,148" fill="#FDE68A" opacity="0.18" />
          <path d="M6,44 C6,34 38,34 38,44 L44,62 L0,62 Z" fill="#FFFBF2" stroke="#C49A48" strokeWidth="1.4" />
        </svg>
      );

    case 'furn_planta_monstera':
      return (
        <svg viewBox="0 0 90 138" className={className}>
          <path d="M45,86 C20,76 8,52 18,32 C34,36 44,58 45,86 Z" fill="#467A5B" stroke="#2F5940" strokeWidth="1.2" />
          <path d="M45,86 C70,76 82,52 72,32 C56,36 46,58 45,86 Z" fill="#3B6B4F" stroke="#2F5940" strokeWidth="1.2" />
          <path d="M45,84 C36,56 32,24 45,10 C58,24 54,56 45,84 Z" fill="#56916D" stroke="#2F5940" strokeWidth="1.2" />
          <path d="M24,86 L66,86 L60,130 Q45,135 30,130 Z" fill="#EFE8DE" stroke="#C5BCAE" strokeWidth="1.4" />
          <ellipse cx="45" cy="86" rx="21" ry="5" fill="#7C5E48" />
        </svg>
      );

    case 'furn_penteadeira':
      return (
        <svg viewBox="0 0 136 162" className={className}>
          <ellipse cx="68" cy="48" rx="34" ry="42" fill="#DCE8EE" stroke="#C49A48" strokeWidth="4" />
          <line x1="48" y1="30" x2="62" y2="18" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.8" />
          <line x1="54" y1="38" x2="72" y2="22" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
          <rect x="18" y="106" width="7" height="50" fill="#EAE2D7" stroke="#C7BCB0" strokeWidth="1" />
          <rect x="111" y="106" width="7" height="50" fill="#EAE2D7" stroke="#C7BCB0" strokeWidth="1" />
          <rect x="10" y="90" width="116" height="22" rx="3" fill="#FAF6F0" stroke="#C7BCB0" strokeWidth="1.4" />
          <rect x="18" y="95" width="44" height="12" rx="2" fill="#F0E9DF" stroke="#D1C7BA" strokeWidth="1" />
          <rect x="74" y="95" width="44" height="12" rx="2" fill="#F0E9DF" stroke="#D1C7BA" strokeWidth="1" />
          <circle cx="40" cy="101" r="2" fill="#C49A48" />
          <circle cx="96" cy="101" r="2" fill="#C49A48" />
          <rect x="26" y="76" width="12" height="14" rx="2" fill="#E89CB0" />
          <circle cx="32" cy="73" r="3" fill="#C49A48" />
        </svg>
      );

    case 'furn_cama_dossel':
      return (
        <svg viewBox="0 0 215 145" className={className}>
          <path
            d="M16,74 L16,32 C16,18 32,12 107.5,12 C183,12 199,18 199,32 L199,74 Z"
            fill="#E3D7CB"
            stroke="#C2B3A4"
            strokeWidth="1.5"
          />
          <rect x="30" y="46" width="68" height="28" rx="8" fill="#FFFFFF" stroke="#D8CEC2" strokeWidth="1.2" />
          <rect x="117" y="46" width="68" height="28" rx="8" fill="#FFFFFF" stroke="#D8CEC2" strokeWidth="1.2" />
          <rect x="14" y="68" width="187" height="58" rx="8" fill="#FAF7F2" stroke="#D2C7BA" strokeWidth="1.4" />
          <rect x="14" y="88" width="187" height="38" rx="6" fill="#D59BA9" stroke="#B67887" strokeWidth="1.2" />
          <rect x="22" y="126" width="8" height="14" rx="2" fill="#B88E44" />
          <rect x="185" y="126" width="8" height="14" rx="2" fill="#B88E44" />
        </svg>
      );

    case 'furn_sofa_ouro_vip':
      return (
        <svg viewBox="0 0 205 118" className={className}>
          <rect x="20" y="98" width="7" height="14" rx="2" fill="#D4A853" />
          <rect x="178" y="98" width="7" height="14" rx="2" fill="#D4A853" />
          <path
            d="M22,54 C22,18 48,12 102.5,12 C157,12 183,18 183,54 L183,82 L22,82 Z"
            fill="#1F1B24"
            stroke="#D4A853"
            strokeWidth="2"
          />
          <rect x="10" y="44" width="22" height="54" rx="9" fill="#2A2431" stroke="#D4A853" strokeWidth="1.6" />
          <rect x="173" y="44" width="22" height="54" rx="9" fill="#2A2431" stroke="#D4A853" strokeWidth="1.6" />
          <rect x="30" y="60" width="72" height="24" rx="6" fill="#2E2736" stroke="#D4A853" strokeWidth="1.3" />
          <rect x="103" y="60" width="72" height="24" rx="6" fill="#2E2736" stroke="#D4A853" strokeWidth="1.3" />
          <rect x="14" y="83" width="177" height="16" rx="4" fill="#B8893A" />
          <rect x="44" y="42" width="24" height="20" rx="5" transform="rotate(-8 56 52)" fill="#FDE68A" stroke="#B8893A" strokeWidth="1.1" />
        </svg>
      );

    default: {
      const custom = furnitureDef ?? getFullFurnitureCatalog().find((f) => f.id === furnitureId);
      if (!custom) {
        return (
          <svg viewBox="0 0 180 110" className={className}>
            <rect x="26" y="88" width="6" height="14" rx="2" fill="#B88E44" />
            <rect x="148" y="88" width="6" height="14" rx="2" fill="#B88E44" />
            <rect x="18" y="42" width="144" height="48" rx="6" fill="#E8DFD3" stroke="#B6A897" strokeWidth="1.6" />
            <rect x="14" y="34" width="152" height="12" rx="4" fill="#FAF7F2" stroke="#C5B9AA" strokeWidth="1.4" />
            <rect x="28" y="52" width="56" height="28" rx="3" fill="#DFD3C3" stroke="#B6A897" strokeWidth="1" />
            <rect x="96" y="52" width="56" height="28" rx="3" fill="#DFD3C3" stroke="#B6A897" strokeWidth="1" />
            <circle cx="76" cy="66" r="2.5" fill="#C49A48" />
            <circle cx="104" cy="66" r="2.5" fill="#C49A48" />
          </svg>
        );
      }
      const color = custom.swatchColor || '#C89B7B';
      const secondary = custom.secondaryColor || '#2C2630';
      const accent = custom.accentColor || (custom.isVipOnly ? '#D4A853' : '#F59E0B');
      const border = custom.isVipOnly ? '#D4A853' : '#44403C';

      if (custom.templateId === 'tpl_dj') {
        return (
          <svg viewBox="0 0 184 122" className={className}>
            <rect x="14" y="44" width="156" height="70" rx="6" fill={color} stroke={accent} strokeWidth="2" />
            <rect x="24" y="54" width="136" height="36" rx="4" fill={secondary} />
            {/* Barras equalizador neon */}
            <rect x="40" y="72" width="8" height="14" fill={accent} />
            <rect x="54" y="64" width="8" height="22" fill="#EC4899" />
            <rect x="68" y="60" width="8" height="26" fill={accent} />
            <rect x="82" y="68" width="8" height="18" fill="#A855F7" />
            <rect x="96" y="58" width="8" height="28" fill={accent} />
            <rect x="110" y="66" width="8" height="20" fill="#EC4899" />
            <rect x="124" y="62" width="8" height="24" fill={accent} />
            {/* Pratos DJ */}
            <rect x="10" y="34" width="164" height="12" rx="4" fill="#0F172A" stroke={accent} strokeWidth="1.2" />
            <ellipse cx="52" cy="30" rx="18" ry="6" fill="#27272A" stroke={accent} strokeWidth="1.4" />
            <ellipse cx="132" cy="30" rx="18" ry="6" fill="#27272A" stroke={accent} strokeWidth="1.4" />
            <rect x="80" y="26" width="24" height="8" rx="1.5" fill="#18181B" stroke="#EC4899" strokeWidth="1" />
          </svg>
        );
      }

      if (custom.templateId === 'tpl_pista') {
        return (
          <svg viewBox="0 0 256 96" className={className}>
            <polygon points="36,14 220,14 248,84 8,84" fill={secondary} stroke={accent} strokeWidth="2.4" />
            <polygon points="56,22 104,22 96,46 42,46" fill={color} opacity="0.9" />
            <polygon points="108,22 148,22 152,46 104,46" fill={accent} opacity="0.65" />
            <polygon points="152,22 200,22 214,46 160,46" fill={color} opacity="0.9" />
            <polygon points="38,52 98,52 90,76 22,76" fill={accent} opacity="0.55" />
            <polygon points="102,52 154,52 158,76 98,76" fill="#38BDF8" opacity="0.55" />
            <polygon points="158,52 218,52 234,76 166,76" fill={accent} opacity="0.55" />
          </svg>
        );
      }

      if (custom.templateId === 'tpl_bar') {
        return (
          <svg viewBox="0 0 210 132" className={className}>
            <rect x="18" y="48" width="174" height="74" rx="5" fill={color} stroke={accent} strokeWidth="1.8" />
            <rect x="28" y="60" width="154" height="46" rx="3" fill={secondary} opacity="0.88" />
            <rect x="10" y="38" width="190" height="14" rx="4" fill={secondary} stroke={accent} strokeWidth="1.4" />
            {/* Garrafas e taças */}
            <rect x="46" y="18" width="10" height="20" rx="2" fill="#059669" />
            <rect x="64" y="14" width="10" height="24" rx="2" fill={accent} />
            <rect x="82" y="20" width="10" height="18" rx="2" fill="#BE185D" />
            <polygon points="132,24 146,24 139,34" fill="#E0F2FE" opacity="0.85" />
            <line x1="139" y1="34" x2="139" y2="38" stroke="#E0F2FE" strokeWidth="1.6" />
            <rect x="158" y="26" width="14" height="12" rx="2" fill={accent} />
          </svg>
        );
      }

      if (custom.templateId === 'tpl_banqueta') {
        return (
          <svg viewBox="0 0 78 116" className={className}>
            <ellipse cx="39" cy="106" rx="22" ry="6" fill={secondary} stroke={accent} strokeWidth="1.2" />
            <rect x="36" y="42" width="6" height="64" fill={accent} />
            <ellipse cx="39" cy="76" rx="15" ry="4" fill="none" stroke={accent} strokeWidth="2.5" />
            <rect x="17" y="24" width="44" height="20" rx="8" fill={color} stroke={border} strokeWidth="1.5" />
            <path d="M19,26 Q39,14 59,26" fill={color} stroke={border} strokeWidth="1.3" />
          </svg>
        );
      }

      if (custom.templateId === 'tpl_cozinha') {
        return (
          <svg viewBox="0 0 204 120" className={className}>
            <rect x="16" y="42" width="172" height="70" rx="4" fill={secondary} stroke="#3E2A1E" strokeWidth="1.5" />
            <rect x="26" y="54" width="48" height="48" rx="2" fill="#4A3226" stroke={accent} strokeWidth="1" />
            <rect x="80" y="54" width="48" height="48" rx="2" fill="#4A3226" stroke={accent} strokeWidth="1" />
            <rect x="134" y="54" width="44" height="48" rx="2" fill="#4A3226" stroke={accent} strokeWidth="1" />
            {/* Tampo mármore & cooktop */}
            <rect x="10" y="30" width="184" height="16" rx="3" fill={color} stroke="#D6CFC5" strokeWidth="1.4" />
            <rect x="44" y="28" width="54" height="8" rx="1.5" fill="#18181B" />
            <circle cx="58" cy="32" r="3" fill="#EF4444" opacity="0.7" />
            <circle cx="82" cy="32" r="3" fill="#EF4444" opacity="0.7" />
            {/* Panela cobre */}
            <rect x="128" y="18" width="26" height="12" rx="3" fill="#B45309" stroke="#78350F" strokeWidth="1" />
          </svg>
        );
      }

      if (custom.templateId === 'tpl_banheira') {
        return (
          <svg viewBox="0 0 192 116" className={className}>
            <circle cx="42" cy="96" r="5" fill={accent} />
            <circle cx="150" cy="96" r="5" fill={accent} />
            <path d="M18,46 L174,46 L160,92 Q96,104 32,92 Z" fill={color} stroke="#C7BEB2" strokeWidth="1.8" />
            <ellipse cx="96" cy="46" rx="78" ry="12" fill="#E0F2FE" stroke="#C7BEB2" strokeWidth="1.5" />
            {/* Espuma */}
            <circle cx="62" cy="42" r="8" fill="#FFFFFF" opacity="0.9" />
            <circle cx="78" cy="39" r="10" fill="#FFFFFF" opacity="0.95" />
            <circle cx="96" cy="43" r="9" fill="#FFFFFF" opacity="0.9" />
            <circle cx="114" cy="40" r="8" fill="#FFFFFF" opacity="0.92" />
            {/* Torneira dourada */}
            <path d="M158,44 L158,24 Q150,18 144,26" fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        );
      }

      if (custom.templateId === 'tpl_cama') {
        return (
          <svg viewBox="0 0 228 152" className={className}>
            <path
              d="M16,78 L16,24 C16,12 36,8 114,8 C192,8 212,12 212,24 L212,78 Z"
              fill={secondary}
              stroke={accent}
              strokeWidth="2.2"
            />
            <rect x="32" y="44" width="72" height="28" rx="8" fill="#FFFFFF" stroke={accent} strokeWidth="1.1" />
            <rect x="124" y="44" width="72" height="28" rx="8" fill="#FFFFFF" stroke={accent} strokeWidth="1.1" />
            <rect x="14" y="70" width="200" height="60" rx="8" fill={color} stroke={accent} strokeWidth="1.5" />
            <rect x="14" y="92" width="200" height="38" rx="6" fill={secondary} stroke={accent} strokeWidth="1.4" />
            <rect x="24" y="130" width="9" height="16" rx="2" fill={accent} />
            <rect x="195" y="130" width="9" height="16" rx="2" fill={accent} />
          </svg>
        );
      }

      if (custom.templateId === 'tpl_lustre') {
        return (
          <svg viewBox="0 0 126 138" className={className}>
            <line x1="63" y1="4" x2="63" y2="30" stroke={accent} strokeWidth="3" />
            <ellipse cx="63" cy="60" rx="52" ry="34" fill="#FEF3C7" opacity="0.22" />
            <path d="M22,48 Q63,28 104,48" fill="none" stroke={accent} strokeWidth="3.2" />
            <path d="M32,68 Q63,52 94,68" fill="none" stroke={accent} strokeWidth="2.5" />
            <circle cx="24" cy="48" r="5" fill="#FEF08A" />
            <circle cx="63" cy="36" r="6" fill="#FEF08A" />
            <circle cx="102" cy="48" r="5" fill="#FEF08A" />
            <polygon points="44,54 49,78 39,78" fill={color} opacity="0.88" />
            <polygon points="63,58 69,92 57,92" fill={color} opacity="0.92" />
            <polygon points="82,54 87,78 77,78" fill={color} opacity="0.88" />
          </svg>
        );
      }

      if (custom.templateId === 'tpl_mesa' || custom.category === 'Superfícies') {
        return (
          <svg viewBox="0 0 148 88" className={className}>
            <line x1="26" y1="36" x2="26" y2="80" stroke={border} strokeWidth="3.5" strokeLinecap="round" />
            <line x1="122" y1="36" x2="122" y2="80" stroke={border} strokeWidth="3.5" strokeLinecap="round" />
            <line x1="46" y1="40" x2="46" y2="70" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="102" y1="40" x2="102" y2="70" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="74" cy="32" rx="64" ry="18" fill={color} stroke={border} strokeWidth="1.8" />
            <ellipse cx="74" cy="32" rx="46" ry="11" fill="#FFFFFF" opacity="0.22" />
            <rect x="68" y="18" width="12" height="10" rx="2" fill={accent} />
          </svg>
        );
      }

      if (custom.templateId === 'tpl_decoracao' || custom.category === 'Decoração') {
        return (
          <svg viewBox="0 0 100 130" className={className}>
            <rect x="44" y="96" width="12" height="26" fill={border} />
            <ellipse cx="50" cy="122" rx="22" ry="6" fill={border} />
            <circle cx="50" cy="54" r="34" fill={color} stroke={accent} strokeWidth="2.2" />
            <circle cx="50" cy="54" r="18" fill="#FFFFFF" opacity="0.28" />
          </svg>
        );
      }

      return (
        <svg viewBox="0 0 195 112" className={className}>
          <rect x="20" y="94" width="6" height="14" rx="2" fill={accent} />
          <rect x="169" y="94" width="6" height="14" rx="2" fill={accent} />
          <path d="M22,52 C22,18 46,12 97.5,12 C149,12 173,18 173,52 L173,78 L22,78 Z" fill={color} stroke={border} strokeWidth="1.8" />
          <rect x="10" y="42" width="22" height="52" rx="9" fill={secondary} stroke={border} strokeWidth="1.5" />
          <rect x="163" y="42" width="22" height="52" rx="9" fill={secondary} stroke={border} strokeWidth="1.5" />
          <rect x="14" y="80" width="167" height="16" rx="4" fill={accent} opacity="0.88" />
        </svg>
      );
    }
  }
};
