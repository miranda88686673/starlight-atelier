import React, { useId } from 'react';
import { AvatarGender, ClothingItem } from '../../types/game';
import { MeDollSvg } from './MeDollSvg';

interface ItemPreviewSvgProps {
  item: ClothingItem;
  previewGender?: AvatarGender;
  className?: string;
}

/**
 * Gera uma miniatura vetorial nítida e em alta definição da peça de vestuário para o Guarda-Roupa e a Starplaza.
 * Utiliza o mesmo motor vetorial da MeDoll com recorte automático (viewBox) por categoria/template
 * e suporte a peças dinâmicas ainda não salvas no catálogo (extraItems).
 */
export const ItemPreviewSvg: React.FC<ItemPreviewSvgProps> = ({
  item,
  previewGender,
  className = 'w-20 h-20',
}) => {
  const uid = useId().replace(/:/g, '');
  const itemGender = item.gender ?? item.genderStyle ?? 'unissex';
  const effectiveGender: AvatarGender =
    previewGender ?? (itemGender === 'masculino' ? 'masculino' : 'feminino');

  // Enquadramento focado na região anatômica de cada peça com suporte a crop_box dedicado
  const getCrop = () => {
    if (item.crop_box) {
      return {
        x: item.crop_box.x,
        y: item.crop_box.y,
        w: item.crop_box.width,
        h: item.crop_box.height,
      };
    }
    if (
      item.id === 'acc_bolsa_estruturada' ||
      item.id === 'acc_bolsa_grife_vip' ||
      item.templateId === 'tpl_bolsa' ||
      item.templateId === 'acc_bolsa_estruturada'
    ) {
      return { x: 146, y: 236, w: 92, h: 96 };
    }
    if (item.id === 'acc_cetro_real_vip' || item.templateId === 'tpl_cetro') {
      return { x: 144, y: 162, w: 88, h: 196 };
    }
    if (
      item.id === 'acc_relogio_couro' ||
      item.id === 'acc_relogio_ouro_vip' ||
      item.templateId === 'tpl_relogio'
    ) {
      return { x: 154, y: 226, w: 70, h: 70 };
    }
    if (item.id === 'acc_colar_perolas' || item.templateId === 'tpl_colar') {
      return { x: 102, y: 118, w: 76, h: 66 };
    }
    if (
      item.id === 'acc_boina_francesa' ||
      item.id === 'acc_bone_street' ||
      item.id === 'acc_chapeu_fedora' ||
      item.id === 'acc_tiara_perolas' ||
      item.id === 'acc_coroa_imperial_vip' ||
      item.id === 'acc_coroa_diamante_soberana_vip' ||
      item.templateId === 'tpl_coroa' ||
      item.templateId === 'tpl_chapeu' ||
      item.templateId === 'acc_coroa_imperial_vip' ||
      item.templateId === 'acc_boina_francesa'
    ) {
      return { x: 76, y: 12, w: 128, h: 102 };
    }
    if (
      item.id === 'acc_oculos_gatinho' ||
      item.id === 'acc_oculos_aviador' ||
      item.templateId === 'tpl_oculos' ||
      item.templateId === 'acc_oculos_gatinho' ||
      item.templateId === 'acc_oculos_aviador'
    ) {
      return { x: 92, y: 54, w: 96, h: 64 };
    }
    if (item.id === 'top_sobretudo_caramelo' || item.templateId === 'top_sobretudo_caramelo') {
      return { x: 56, y: 128, w: 168, h: 242 };
    }

    switch (item.category) {
      case 'cabelo':
        return { x: 60, y: 14, w: 160, h: 196 };
      case 'blusas':
        return { x: 60, y: 126, w: 160, h: 148 };
      case 'vestidos':
        return { x: 54, y: 126, w: 172, h: 286 };
      case 'calcas':
        return { x: 62, y: 210, w: 156, h: 256 };
      case 'sapatos':
        return { x: 74, y: 382, w: 132, h: 126 };
      case 'acessorios':
        return { x: 68, y: 36, w: 144, h: 144 };
    }
  };

  if (item.thumbnail_url) {
    return (
      <div className={`relative overflow-hidden flex items-center justify-center p-1.5 ${className}`}>
        <img
          src={item.thumbnail_url}
          alt={item.name}
          className="w-full h-full object-contain drop-shadow-xs"
          loading="lazy"
        />
      </div>
    );
  }

  if (item.customLayerPngUrl) {
    return (
      <div className={`relative overflow-hidden flex items-center justify-center p-1.5 ${className}`}>
        <img
          src={item.customLayerPngUrl}
          alt={item.name}
          className="w-full h-full object-contain drop-shadow-xs"
          loading="lazy"
        />
      </div>
    );
  }

  const crop = getCrop();

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className}`}>
      <svg
        viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full drop-shadow-xs"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`${uid}_studioGlow`} cx="50%" cy="46%" r="54%">
            <stop offset="0%" stopColor={item.swatchColor || '#E6DDD0'} stopOpacity="0.16" />
            <stop offset="100%" stopColor="#FAF8F5" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect
          x={crop.x}
          y={crop.y}
          width={crop.w}
          height={crop.h}
          fill={`url(#${uid}_studioGlow)`}
        />

        {/* Silhueta manequim discreta para dar referência de caimento sem poluir a peça */}
        <g opacity="0.16">
          <MeDollSvg
            equipped={{}}
            skinTone="porcelana"
            avatarGender={effectiveGender}
            enableIdle={false}
          />
        </g>

        {/* Renderização real da peça com destaque e zero animação idle na miniatura */}
        <MeDollSvg
          equipped={{ [item.category]: item.id }}
          skinTone="porcelana"
          avatarGender={effectiveGender}
          enableIdle={false}
          extraItems={[item]}
        />
      </svg>
    </div>
  );
};
