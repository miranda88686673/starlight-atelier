import React from 'react';

interface CountryFlagProps {
  countryCode?: string;
  countryName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-5 h-3.5 rounded-[3px]',
  md: 'w-6 h-4 rounded-[3px]',
  lg: 'w-8 h-5.5 rounded-[4px]',
};

/**
 * Bandeira vetorial real (SVG inline) correspondente ao código do país da conta.
 * Garante renderização nítida de bandeiras da vida real em qualquer navegador/SO.
 */
export const CountryFlag: React.FC<CountryFlagProps> = ({
  countryCode = 'BR',
  countryName,
  size = 'md',
  className = '',
}) => {
  const normalized = (countryCode || 'BR').toUpperCase();
  const baseCode = normalized.startsWith('BR') ? 'BR' : normalized;
  const label = countryName || baseCode;
  const sizeClass = SIZE_CLASSES[size];

  const renderFlagGraphic = () => {
    switch (baseCode) {
      case 'BR':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="28" height="20" fill="#009B3A" />
            <polygon points="14,2.2 25.2,10 14,17.8 2.8,10" fill="#FFDF00" />
            <circle cx="14" cy="10" r="4.3" fill="#002776" />
            <path
              d="M9.9 9.2 C12.5 8.2 15.8 8.8 18.2 10.6"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.85"
              strokeLinecap="round"
            />
          </svg>
        );

      case 'PT':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="11.2" height="20" fill="#006600" />
            <rect x="11.2" width="16.8" height="20" fill="#FF0000" />
            <circle cx="11.2" cy="10" r="3.8" fill="#FFCC00" />
            <circle cx="11.2" cy="10" r="2.6" fill="#FFFFFF" stroke="#B91C1C" strokeWidth="0.7" />
            <rect x="10.4" y="9.1" width="1.6" height="1.8" rx="0.4" fill="#003399" />
          </svg>
        );

      case 'US':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="28" height="20" fill="#FFFFFF" />
            {[0, 2, 4, 6, 8, 10, 12].map((i) => (
              <rect
                key={i}
                y={(i * 20) / 13}
                width="28"
                height={20 / 13 + 0.05}
                fill="#B22234"
              />
            ))}
            <rect width="12.5" height={20 * (7 / 13)} fill="#3C3B6E" />
            <g fill="#FFFFFF">
              <circle cx="2.6" cy="2.3" r="0.6" />
              <circle cx="5.2" cy="2.3" r="0.6" />
              <circle cx="7.8" cy="2.3" r="0.6" />
              <circle cx="10.2" cy="2.3" r="0.6" />
              <circle cx="3.9" cy="4.4" r="0.6" />
              <circle cx="6.5" cy="4.4" r="0.6" />
              <circle cx="9.1" cy="4.4" r="0.6" />
              <circle cx="2.6" cy="6.6" r="0.6" />
              <circle cx="5.2" cy="6.6" r="0.6" />
              <circle cx="7.8" cy="6.6" r="0.6" />
              <circle cx="10.2" cy="6.6" r="0.6" />
              <circle cx="3.9" cy="8.7" r="0.6" />
              <circle cx="6.5" cy="8.7" r="0.6" />
              <circle cx="9.1" cy="8.7" r="0.6" />
            </g>
          </svg>
        );

      case 'ES':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="28" height="20" fill="#AA151B" />
            <rect y="5" width="28" height="10" fill="#F1BF00" />
            <rect x="6" y="7.2" width="3.2" height="5.4" rx="0.8" fill="#AA151B" />
            <rect x="6.5" y="6.3" width="2.2" height="1" fill="#D97706" />
          </svg>
        );

      case 'AR':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="28" height="20" fill="#74ACDF" />
            <rect y="6.6" width="28" height="6.8" fill="#FFFFFF" />
            <circle cx="14" cy="10" r="2.2" fill="#F6B40E" />
          </svg>
        );

      case 'FR':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="9.4" height="20" fill="#002395" />
            <rect x="9.4" width="9.3" height="20" fill="#FFFFFF" />
            <rect x="18.7" width="9.3" height="20" fill="#ED2939" />
          </svg>
        );

      case 'GB':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="28" height="20" fill="#012169" />
            <path d="M0 0 L28 20 M28 0 L0 20" stroke="#FFFFFF" strokeWidth="3.8" />
            <path d="M0 0 L28 20 M28 0 L0 20" stroke="#C8102E" strokeWidth="1.9" />
            <path d="M14 0 V20 M0 10 H28" stroke="#FFFFFF" strokeWidth="5.4" />
            <path d="M14 0 V20 M0 10 H28" stroke="#C8102E" strokeWidth="3.1" />
          </svg>
        );

      case 'IT':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="9.4" height="20" fill="#009246" />
            <rect x="9.4" width="9.3" height="20" fill="#FFFFFF" />
            <rect x="18.7" width="9.3" height="20" fill="#CE2B37" />
          </svg>
        );

      case 'DE':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="28" height="6.7" fill="#000000" />
            <rect y="6.7" width="28" height="6.7" fill="#DD0000" />
            <rect y="13.4" width="28" height="6.6" fill="#FFCE00" />
          </svg>
        );

      case 'MX':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="9.4" height="20" fill="#006847" />
            <rect x="9.4" width="9.3" height="20" fill="#FFFFFF" />
            <rect x="18.7" width="9.3" height="20" fill="#CE1126" />
            <circle cx="14" cy="10" r="2.2" fill="#8B5A2B" />
          </svg>
        );

      case 'CA':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="7" height="20" fill="#FF0000" />
            <rect x="7" width="14" height="20" fill="#FFFFFF" />
            <rect x="21" width="7" height="20" fill="#FF0000" />
            <polygon
              points="14,5 15,8.2 17.6,7.4 16.3,10.2 18.2,11.2 14.8,12 14.8,15 13.2,15 13.2,12 9.8,11.2 11.7,10.2 10.4,7.4 13,8.2"
              fill="#FF0000"
            />
          </svg>
        );

      case 'JP':
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="28" height="20" fill="#FFFFFF" />
            <circle cx="14" cy="10" r="4.8" fill="#BC002D" />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 28 20" className="w-full h-full block" aria-hidden="true">
            <rect width="28" height="20" fill="#1E293B" />
            <circle cx="14" cy="10" r="5.5" fill="none" stroke="#E2E8F0" strokeWidth="1.3" />
            <ellipse cx="14" cy="10" rx="2.6" ry="5.5" fill="none" stroke="#E2E8F0" strokeWidth="1" />
            <line x1="8.5" y1="10" x2="19.5" y2="10" stroke="#E2E8F0" strokeWidth="1" />
          </svg>
        );
    }
  };

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden shadow-xs ring-1 ring-black/15 align-middle ${sizeClass} ${className}`}
      title={`País da conta: ${label}`}
      aria-label={`Bandeira de ${label}`}
    >
      {renderFlagGraphic()}
    </span>
  );
};
