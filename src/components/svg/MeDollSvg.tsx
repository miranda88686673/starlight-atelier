import React, { useId } from 'react';
import { SKIN_TONES } from '../../data/catalog';
import {
  AvatarFaceCustomization,
  AvatarGender,
  ClothingItem,
  DesignPattern,
  EquippedOutfit,
  SkinToneId,
} from '../../types/game';
import { getFullClothingCatalog } from '../../utils/storage';

const STATIC_RENDERED_IDS = new Set([
  'hair_ondas_mel',
  'hair_bob_paris',
  'hair_coque_atelier',
  'hair_longo_cereja',
  'hair_rabo_seda',
  'hair_corte_executivo',
  'hair_fade_moderno',
  'hair_cachos_urbanos',
  'hair_surf_loiro',
  'hair_coroa_ondas_vip',
  'top_camisa_seda',
  'top_cropped_veludo',
  'top_camisa_social_azul',
  'top_camiseta_basica_preta',
  'top_blazer_tweed',
  'top_corset_dourado',
  'top_blusa_ombro_laco',
  'top_sueter_listrado',
  'top_jaqueta_couro',
  'top_jaqueta_bomber',
  'top_sobretudo_caramelo',
  'top_hoodie_y2k_ny',
  'top_cropped_y2k_la',
  'top_smoking_ouro_vip',
  'dress_tubinho_atelier',
  'dress_midi_floral_rose',
  'dress_gala_escarlate',
  'dress_cetim_champagne',
  'dress_alta_costura_diamante',
  'bottom_calca_alfaiataria',
  'bottom_saia_midi',
  'bottom_chino_areia',
  'bottom_jeans_cintura',
  'bottom_saia_couro',
  'bottom_cargo_urbana',
  'bottom_jogger_creme',
  'bottom_baggy_denim_us',
  'bottom_calca_vip_preta',
  'shoes_scarpin_preto',
  'shoes_sapatilha_creme',
  'shoes_oxford_couro',
  'shoes_tenis_branco',
  'shoes_bota_cano',
  'shoes_sandalia_ouro',
  'shoes_coturno_preto',
  'shoes_chunky_y2k',
  'shoes_salto_cristal_vip',
  'shoes_mocassim_ouro_vip',
  'acc_oculos_gatinho',
  'acc_bone_street',
  'acc_boina_francesa',
  'acc_tiara_perolas',
  'acc_chapeu_fedora',
  'acc_oculos_aviador',
  'acc_colar_perolas',
  'acc_relogio_couro',
  'acc_bolsa_estruturada',
  'acc_coroa_imperial_vip',
  'acc_coroa_diamante_soberana_vip',
  'acc_cetro_real_vip',
  'acc_relogio_ouro_vip',
  'acc_bolsa_grife_vip',
]);

interface MeDollSvgProps {
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender?: AvatarGender;
  faceCustomization?: AvatarFaceCustomization;
  /** Lista de IDs removidos pelo moderador (não devem ser renderizados) */
  deletedItemIds?: string[];
  /** Ativa animação fluida de passos ao caminhar pelo chão */
  isWalking?: boolean;
  /** Ativa respiração suave de idle e piscar de olhos realista */
  enableIdle?: boolean;
  /** Itens extras (ainda não salvos no catálogo) para pré-visualização imediata */
  extraItems?: ClothingItem[];
  className?: string;
}

function renderPatternOverlay(
  uid: string,
  pattern: DesignPattern | undefined,
  accent: string
) {
  if (!pattern || pattern === 'solid') return null;
  if (pattern === 'striped') {
    return (
      <pattern id={`${uid}_pat`} width="8" height="8" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="8" stroke={accent} strokeWidth="2.2" opacity="0.48" />
      </pattern>
    );
  }
  if (pattern === 'plaid') {
    return (
      <pattern id={`${uid}_pat`} width="10" height="10" patternUnits="userSpaceOnUse">
        <line x1="0" y1="5" x2="10" y2="5" stroke={accent} strokeWidth="1.4" opacity="0.4" />
        <line x1="5" y1="0" x2="5" y2="10" stroke={accent} strokeWidth="1.4" opacity="0.4" />
      </pattern>
    );
  }
  if (pattern === 'floral') {
    return (
      <pattern id={`${uid}_pat`} width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="5" cy="5" r="2.2" fill={accent} opacity="0.55" />
        <circle cx="11" cy="11" r="1.6" fill="#FFFFFF" opacity="0.5" />
      </pattern>
    );
  }
  if (pattern === 'sequin') {
    return (
      <pattern id={`${uid}_pat`} width="7" height="7" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.1" fill="#FFFFFF" opacity="0.65" />
        <circle cx="5.5" cy="5.5" r="1" fill={accent} opacity="0.65" />
      </pattern>
    );
  }
  if (pattern === 'denim') {
    return (
      <pattern
        id={`${uid}_pat`}
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(35)"
      >
        <line x1="0" y1="0" x2="0" y2="6" stroke="#FFFFFF" strokeWidth="0.9" opacity="0.18" />
      </pattern>
    );
  }
  if (pattern === 'neon') {
    return (
      <pattern id={`${uid}_pat`} width="12" height="12" patternUnits="userSpaceOnUse">
        <line x1="0" y1="12" x2="12" y2="0" stroke={accent} strokeWidth="1.5" opacity="0.55" />
      </pattern>
    );
  }
  return null;
}

export const MeDollSvg: React.FC<MeDollSvgProps> = ({
  equipped,
  skinTone,
  avatarGender = 'feminino',
  faceCustomization,
  deletedItemIds = [],
  isWalking = false,
  enableIdle = true,
  extraItems = [],
  className = 'w-full h-full',
}) => {
  const rawUid = useId().replace(/:/g, '');
  const tone = SKIN_TONES.find((t) => t.id === skinTone) ?? SKIN_TONES[1];
  const isMasc = avatarGender === 'masculino';
  const isNeutral = avatarGender === 'neutro';

  const pick = (id?: string) => (id && !deletedItemIds.includes(id) ? id : undefined);

  const rawAccIds = [
    ...(equipped.acessorios ? [equipped.acessorios] : []),
    ...(equipped.acessoriosSlots
      ? Object.values(equipped.acessoriosSlots).filter((v): v is string => Boolean(v))
      : []),
  ];
  const equippedAccIds = Array.from(new Set(rawAccIds)).filter(
    (id) => !deletedItemIds.includes(id),
  );

  const active = {
    cabelo: pick(equipped.cabelo),
    sapatos: pick(equipped.sapatos),
    calcas: pick(equipped.calcas),
    blusas: pick(equipped.blusas),
    casacos: pick(equipped.casacos),
    vestidos: pick(equipped.vestidos),
    acessorios: equippedAccIds[0],
  };

  const hasDynamicItem =
    Object.values(active).some((id) => id && !STATIC_RENDERED_IDS.has(id)) ||
    equippedAccIds.some((id) => !STATIC_RENDERED_IDS.has(id));
  const fullCatalog: ClothingItem[] = hasDynamicItem
    ? [...extraItems, ...getFullClothingCatalog()]
    : extraItems;
  const findDynamic = (id?: string): ClothingItem | undefined =>
    id && !STATIC_RENDERED_IDS.has(id)
      ? fullCatalog.find((c) => c.id === id)
      : undefined;

  const dynHair = findDynamic(active.cabelo);
  const dynShoes = findDynamic(active.sapatos);
  const dynBottom = findDynamic(active.calcas);
  const dynTop = findDynamic(active.blusas);
  const dynCoat = findDynamic(active.casacos);
  const dynDress = findDynamic(active.vestidos);
  const dynAccList = equippedAccIds
    .map((id) => findDynamic(id))
    .filter((item): item is ClothingItem => Boolean(item));
  const hasStaticAcc = (id: string) => equippedAccIds.includes(id);

  const renderCustomPngLayer = (item?: ClothingItem) => {
    if (!item?.customLayerPngUrl) return null;
    const ox = item.layerOffsetX ?? 0;
    const oy = item.layerOffsetY ?? 0;
    const sc = item.layerScale ?? 1;
    const box =
      item.category === 'cabelo'
        ? { x: 80, y: 20, w: 120, h: 150, cx: 140, cy: 90 }
        : item.category === 'sapatos'
          ? { x: 96, y: 400, w: 88, h: 100, cx: 140, cy: 450 }
          : item.category === 'calcas'
            ? { x: 80, y: 215, w: 120, h: 255, cx: 140, cy: 340 }
            : item.category === 'vestidos'
              ? { x: 65, y: 135, w: 150, h: 280, cx: 140, cy: 270 }
              : item.category === 'casacos'
                ? { x: 66, y: 130, w: 148, h: 170, cx: 140, cy: 210 }
                : item.category === 'acessorios'
                  ? { x: 85, y: 45, w: 110, h: 140, cx: 140, cy: 115 }
                  : { x: 70, y: 132, w: 140, h: 130, cx: 140, cy: 195 };

    return (
      <g
        transform={`translate(${ox}, ${oy}) translate(${box.cx}, ${box.cy}) scale(${sc}) translate(${-box.cx}, ${-box.cy})`}
      >
        <image
          href={item.customLayerPngUrl}
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
    );
  };

  // Anatomia fiel ao Sheet Base Modelo (Masculino: ombros largos, bíceps e tórax em V; Feminino: ombros estreitos, cintura fina, quadril curvilíneo e pose A-frame; Neutro: equilíbrio contemporâneo)
  const shL = isMasc ? 80 : isNeutral ? 94 : 102;
  const shR = isMasc ? 200 : isNeutral ? 186 : 178;
  const waistL = isMasc ? 105 : isNeutral ? 110 : 115;
  const waistR = isMasc ? 175 : isNeutral ? 170 : 165;
  const hipL = isMasc ? 107 : isNeutral ? 104 : 97;
  const hipR = isMasc ? 173 : isNeutral ? 176 : 183;

  // Mangas adaptadas à pose anatômica de cada modelo (braços masculinos fortes e paralelos; femininos em pose editorial aberta com mãos à vista)
  const leftLongSleevePath = isMasc
    ? 'M82,148 C70,168 68,200 72,248 L88,248 C88,214 91,184 98,162 Z'
    : isNeutral
    ? 'M94,149 C82,172 74,206 72,248 L87,250 C90,214 96,184 104,162 Z'
    : 'M102,150 C88,174 78,210 70,250 L84,253 C92,216 99,184 108,162 Z';

  const rightLongSleevePath = isMasc
    ? 'M198,148 C210,168 212,200 208,248 L192,248 C192,214 189,184 182,162 Z'
    : isNeutral
    ? 'M186,149 C198,172 206,206 208,248 L193,250 C190,214 184,184 176,162 Z'
    : 'M178,150 C192,174 202,210 210,250 L196,253 C188,216 181,184 172,162 Z';

  const leftShortSleevePath = isMasc
    ? 'M82,148 L69,186 L87,192 L98,163 Z'
    : isNeutral
    ? 'M94,149 L81,185 L95,190 L104,163 Z'
    : 'M102,150 L87,183 L100,188 L108,163 Z';

  const rightShortSleevePath = isMasc
    ? 'M198,148 L211,186 L193,192 L182,163 Z'
    : isNeutral
    ? 'M186,149 L199,185 L185,190 L176,163 Z'
    : 'M178,150 L193,183 L180,188 L172,163 Z';

  const inkColor = '#2B231F';
  const showBaseTopMesh = !active.blusas && !active.vestidos;
  const showBaseBottomMesh = !active.calcas && !active.vestidos;

  return (
    <svg
      viewBox="0 0 280 520"
      className={`${className} ${isWalking ? 'avatar-walk-bob' : ''}`}
      role="img"
      aria-label={`Avatar MeDoll (${avatarGender}) com roupas em camadas`}
    >
      <defs>
        <radialGradient id={`${rawUid}_floor`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1C1917" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#1C1917" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${rawUid}_skinShade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={tone.shadow} stopOpacity="0.34" />
          <stop offset="28%" stopColor={tone.base} stopOpacity="0" />
          <stop offset="72%" stopColor={tone.base} stopOpacity="0" />
          <stop offset="100%" stopColor={tone.shadow} stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id={`${rawUid}_silkIvory`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#F5EFE6" />
          <stop offset="100%" stopColor="#DFD2C0" />
        </linearGradient>
        <linearGradient id={`${rawUid}_velvetCrimson`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DE316A" />
          <stop offset="55%" stopColor="#B2184B" />
          <stop offset="100%" stopColor="#770C30" />
        </linearGradient>
        <linearGradient id={`${rawUid}_goldChampagne`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBF0D4" />
          <stop offset="48%" stopColor="#DFC496" />
          <stop offset="100%" stopColor="#A98243" />
        </linearGradient>
        <linearGradient id={`${rawUid}_rosePleat`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6CAD3" />
          <stop offset="100%" stopColor="#D37F92" />
        </linearGradient>
        <linearGradient id={`${rawUid}_denimWash`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6D93BD" />
          <stop offset="50%" stopColor="#4B709B" />
          <stop offset="100%" stopColor="#314E70" />
        </linearGradient>
        <linearGradient id={`${rawUid}_leatherNoir`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#45414D" />
          <stop offset="50%" stopColor="#26232B" />
          <stop offset="100%" stopColor="#121014" />
        </linearGradient>
        <radialGradient id={`${rawUid}_iris`} cx="45%" cy="38%" r="55%">
          <stop offset="0%" stopColor={faceCustomization?.eyeColor || (isMasc ? '#6B7E85' : '#7C6253')} />
          <stop offset="72%" stopColor={faceCustomization?.eyeColor || (isMasc ? '#324148' : '#3E2B22')} stopOpacity={faceCustomization?.eyeColor ? 0.78 : 1} />
          <stop offset="100%" stopColor="#1B1715" />
        </radialGradient>
        <linearGradient id={`${rawUid}_clothShade`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#1C1917" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`${rawUid}_hairGloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.32" />
          <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>

        {dynTop &&
          renderPatternOverlay(
            `${rawUid}_top`,
            dynTop.pattern,
            dynTop.accentColor || '#FFFFFF'
          )}
        {dynBottom &&
          renderPatternOverlay(
            `${rawUid}_bot`,
            dynBottom.pattern,
            dynBottom.accentColor || '#FFFFFF'
          )}
        {dynDress &&
          renderPatternOverlay(
            `${rawUid}_drs`,
            dynDress.pattern,
            dynDress.accentColor || '#FFFFFF'
          )}
      </defs>

      {/* 1. Sombra no piso */}
      <ellipse
        cx="140"
        cy="497"
        rx={isMasc ? 70 : 64}
        ry="12"
        fill={`url(#${rawUid}_floor)`}
      />

      <g className={!isWalking && enableIdle ? 'avatar-idle-breathe' : undefined}>
      {/* 2. Camada Traseira do Cabelo (z-index 5) */}
      <g data-layer="cabelo-tras">
        {active.cabelo === 'hair_ondas_mel' && (
          <path
            d="M100,72 C85,96 84,140 90,178 C96,210 112,216 140,214 C168,216 184,210 190,178 C196,140 195,96 180,72 C166,46 114,46 100,72 Z"
            fill="#9A6232"
          />
        )}
        {active.cabelo === 'hair_bob_paris' && (
          <path
            d="M102,74 C92,98 94,132 103,145 C118,150 162,150 177,145 C186,132 188,98 178,74 Z"
            fill="#19161A"
          />
        )}
        {active.cabelo === 'hair_coque_atelier' && (
          <g>
            <circle cx="140" cy="36" r="22" fill="#3C2521" />
            <path d="M122,34 Q140,22 158,34" stroke="#6B4841" strokeWidth="2.5" fill="none" />
          </g>
        )}
        {active.cabelo === 'hair_longo_cereja' && (
          <path
            d="M98,74 C78,108 76,178 86,238 C98,255 182,255 194,238 C204,178 202,108 182,74 C168,45 112,45 98,74 Z"
            fill="#882E25"
          />
        )}
        {active.cabelo === 'hair_rabo_seda' && (
          <g>
            <path
              d="M148,38 C178,34 198,64 196,120 C195,158 185,192 174,205 C168,175 170,136 164,92 Z"
              fill="#D2BC96"
            />
            <rect x="142" y="34" width="12" height="7" rx="3" fill="#C8235D" />
          </g>
        )}
        {active.cabelo === 'hair_surf_loiro' && (
          <path
            d="M103,72 C95,94 96,124 106,135 C120,140 160,140 174,135 C184,124 185,94 177,72 Z"
            fill="#A67D3E"
          />
        )}
        {active.cabelo === 'hair_cachos_urbanos' && (
          <g fill="#2C1C16">
            <circle cx="114" cy="64" r="14" />
            <circle cx="166" cy="64" r="14" />
            <circle cx="107" cy="82" r="11" />
            <circle cx="173" cy="82" r="11" />
          </g>
        )}
        {active.cabelo === 'hair_coroa_ondas_vip' && (
          <path
            d="M96,72 C76,105 76,170 86,232 C102,248 178,248 194,232 C204,170 204,105 184,72 C168,42 112,42 96,72 Z"
            fill="#C79658"
          />
        )}
        {dynHair &&
          !dynHair.customLayerPngUrl &&
          (dynHair.gender === 'feminino' ||
            dynHair.templateId === 'tpl_cabelo_longo' ||
            dynHair.templateId === 'hair_ondas_mel') && (
            <path
              d="M98,74 C82,102 82,164 90,214 C104,228 176,228 190,214 C198,164 198,102 182,74 C166,46 114,46 98,74 Z"
              fill={dynHair.secondaryColor || dynHair.swatchColor}
              opacity="0.92"
            />
          )}
      </g>

      {/* 3. Boneca Base — Modelo Anatômico de Referência (Masculino / Feminino / Neutro) */}
      <g data-layer="base-doll" strokeLinejoin="round" strokeLinecap="round">
        {/* Braços e Mãos Articuladas (5 dedos) */}
        {isMasc ? (
          <>
            {/* Braço Esquerdo Masculino (deltoide, bíceps e antebraço definidos) */}
            <path
              d="M84,148 C72,160 69,183 71,203 C70,222 71,240 73,254 L87,254 C88,236 89,218 90,201 C93,184 96,170 100,158 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="1.05"
            />
            <path d="M73,196 Q81,201 89,198" stroke={tone.shadow} strokeWidth="0.9" fill="none" opacity="0.7" />
            <path d="M73,254 L87,254" stroke={inkColor} strokeWidth="1.1" />
            {/* Mão Esquerda Masculina (5 dedos articulados) */}
            <path
              d="M73,254 L70,266 L68,278 L71,279 L73,269 L73,283 L76,283 L77,270 L77,284 L80,284 L81,270 L82,281 L85,280 L85,268 L88,274 L91,272 L87,254 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="0.95"
            />

            {/* Braço Direito Masculino */}
            <path
              d="M196,148 C208,160 211,183 209,203 C210,222 209,240 207,254 L193,254 C192,236 191,218 190,201 C187,184 184,170 180,158 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="1.05"
            />
            <path d="M207,196 Q199,201 191,198" stroke={tone.shadow} strokeWidth="0.9" fill="none" opacity="0.7" />
            <path d="M193,254 L207,254" stroke={inkColor} strokeWidth="1.1" />
            {/* Mão Direita Masculina (5 dedos articulados) */}
            <path
              d="M193,254 L189,272 L192,274 L195,268 L195,280 L198,281 L199,270 L200,284 L203,284 L203,270 L204,283 L207,283 L207,269 L209,279 L212,278 L210,266 L207,254 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="0.95"
            />
          </>
        ) : isNeutral ? (
          <>
            {/* Braço Esquerdo Neutro */}
            <path
              d="M95,149 C84,166 78,195 75,224 C73,237 72,247 71,254 L84,255 C86,242 89,224 91,206 C95,186 100,170 105,159 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="1.05"
            />
            {/* Mão Esquerda Neutra */}
            <path
              d="M71,254 L66,268 L62,279 L65,280 L69,271 L68,284 L71,284 L73,272 L73,285 L76,285 L77,272 L79,282 L82,281 L81,269 L85,274 L87,272 L84,255 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="0.9"
            />

            {/* Braço Direito Neutro */}
            <path
              d="M185,149 C196,166 202,195 205,224 C207,237 208,247 209,254 L196,255 C194,242 191,224 189,206 C185,186 180,170 175,159 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="1.05"
            />
            {/* Mão Direita Neutra */}
            <path
              d="M196,255 L193,272 L195,274 L199,269 L198,281 L201,282 L203,272 L204,285 L207,285 L207,272 L209,284 L212,284 L211,271 L215,280 L218,279 L214,268 L209,254 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="0.9"
            />
          </>
        ) : (
          <>
            {/* Braço Esquerdo Feminino (pose editorial A-frame graciosamente aberta) */}
            <path
              d="M102,150 C90,168 83,196 76,225 C73,238 71,247 70,253 L82,256 C85,243 88,226 92,208 C97,188 102,172 108,160 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="1.05"
            />
            <path d="M81,203 Q87,207 92,205" stroke={tone.shadow} strokeWidth="0.85" fill="none" opacity="0.65" />
            {/* Mão Esquerda Feminina aberta (5 dedos alongados) */}
            <path
              d="M70,253 L64,267 L58,278 L61,280 L67,270 L64,284 L67,285 L71,272 L71,286 L74,286 L75,272 L77,283 L80,282 L79,269 L84,273 L86,271 L82,256 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="0.9"
            />

            {/* Braço Direito Feminino (simétrico em pose A-frame aberta) */}
            <path
              d="M178,150 C190,168 197,196 204,225 C207,238 209,247 210,253 L198,256 C195,243 192,226 188,208 C183,188 178,172 172,160 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="1.05"
            />
            <path d="M199,203 Q193,207 188,205" stroke={tone.shadow} strokeWidth="0.85" fill="none" opacity="0.65" />
            {/* Mão Direita Feminina aberta (5 dedos alongados) */}
            <path
              d="M198,256 L194,271 L196,273 L201,269 L200,282 L203,283 L205,272 L206,286 L209,286 L209,272 L213,285 L216,284 L213,270 L219,280 L222,278 L216,267 L210,253 Z"
              fill={tone.base}
              stroke={inkColor}
              strokeWidth="0.9"
            />
          </>
        )}

        {/* Pernas separadas com musculatura, contorno de joelho, panturrilha e pés descalços detalhados */}
        <g className={isWalking ? 'avatar-leg-left-walk' : undefined}>
          {/* Perna esquerda */}
          <path
            d={
              isMasc
                ? 'M107,264 C104,306 107,344 113,375 C112,402 112,432 117,461 L132,461 C135,432 136,404 136,376 C137,342 138,304 139,278 L131,264 Z'
                : 'M98,266 C97,306 104,344 113,376 C113,402 115,432 119,461 L130,461 C133,432 135,402 134,375 C135,340 137,304 138,276 L130,266 Z'
            }
            fill={tone.base}
            stroke={inkColor}
            strokeWidth="1.05"
          />
          {/* Contornos anatômicos do joelho e coxa */}
          <path
            d={isMasc ? 'M118,370 Q125,365 131,370 M119,380 Q125,384 130,380' : 'M118,372 Q124,368 129,372 M120,380 Q124,383 128,380'}
            stroke={tone.shadow}
            strokeWidth="1"
            fill="none"
            opacity="0.72"
          />
          <path
            d={isMasc ? 'M114,312 Q117,340 120,358' : 'M108,314 Q112,338 116,356'}
            stroke={tone.shadow}
            strokeWidth="0.9"
            fill="none"
            opacity="0.55"
          />
          {/* Pé esquerdo descalço com dedos definidos */}
          <path
            d={
              isMasc
                ? 'M117,461 C116,472 112,482 110,489 C110,494 114,496 118,495 C121,496 125,496 128,495 C132,496 135,493 135,488 C134,480 133,471 132,461 Z'
                : 'M119,461 C118,472 114,482 113,489 C113,493 116,495 120,494 C123,495 127,495 130,493 C133,493 134,490 133,486 C132,478 131,470 130,461 Z'
            }
            fill={tone.base}
            stroke={inkColor}
            strokeWidth="1"
          />
          {/* Divisões dos dedos do pé esquerdo */}
          <path
            d={
              isMasc
                ? 'M115,490 L115,495 M119,490 L119,495 M123,490 L123,495 M127,489 L127,494'
                : 'M117,489 L117,494 M120,489 L120,494 M124,489 L124,494 M127,488 L127,493'
            }
            stroke={inkColor}
            strokeWidth="0.75"
            opacity="0.72"
          />
        </g>

        <g className={isWalking ? 'avatar-leg-right-walk' : undefined}>
          {/* Perna direita */}
          <path
            d={
              isMasc
                ? 'M149,264 L141,278 C142,304 143,342 144,376 C144,404 145,432 148,461 L163,461 C168,432 168,402 167,375 C173,344 176,306 173,264 Z'
                : 'M150,266 L142,276 C143,304 145,340 146,375 C145,402 147,432 150,461 L161,461 C165,432 167,402 167,376 C176,344 183,306 182,266 Z'
            }
            fill={tone.base}
            stroke={inkColor}
            strokeWidth="1.05"
          />
          <path
            d={isMasc ? 'M149,370 Q155,365 162,370 M150,380 Q155,384 161,380' : 'M151,372 Q156,368 162,372 M152,380 Q156,383 160,380'}
            stroke={tone.shadow}
            strokeWidth="1"
            fill="none"
            opacity="0.72"
          />
          <path
            d={isMasc ? 'M166,312 Q163,340 160,358' : 'M172,314 Q168,338 164,356'}
            stroke={tone.shadow}
            strokeWidth="0.9"
            fill="none"
            opacity="0.55"
          />
          {/* Pé direito descalço com dedos definidos */}
          <path
            d={
              isMasc
                ? 'M148,461 C147,471 146,480 145,488 C145,493 148,496 152,495 C155,496 159,496 162,495 C166,496 170,494 170,489 C168,482 164,472 163,461 Z'
                : 'M150,461 C149,470 148,478 147,486 C146,490 147,493 150,493 C153,495 157,495 160,494 C164,495 167,493 167,489 C166,482 162,472 161,461 Z'
            }
            fill={tone.base}
            stroke={inkColor}
            strokeWidth="1"
          />
          <path
            d={
              isMasc
                ? 'M153,489 L153,494 M157,490 L157,495 M161,490 L161,495 M165,490 L165,495'
                : 'M153,488 L153,493 M156,489 L156,494 M160,489 L160,494 M163,489 L163,494'
            }
            stroke={inkColor}
            strokeWidth="0.75"
            opacity="0.72"
          />
        </g>

        {/* Tronco e Pescoço Anatômicos */}
        {isMasc ? (
          <path
            d="M126,118 L125,134 C110,139 90,141 82,149 C86,170 93,190 99,207 C103,219 105,229 105,239 C105,249 106,260 107,274 C118,283 162,283 173,274 C174,260 175,249 175,239 C175,229 177,219 181,207 C187,190 194,170 198,149 C190,141 170,139 155,134 L154,118 Z"
            fill={tone.base}
            stroke={inkColor}
            strokeWidth="1.05"
          />
        ) : isNeutral ? (
          <path
            d="M130,118 L129,136 C116,141 101,144 94,151 C97,168 102,186 106,200 C109,212 111,222 110,232 C108,245 103,257 104,273 C117,282 163,282 176,273 C177,257 172,245 170,232 C169,222 171,212 174,200 C178,186 183,168 186,151 C179,144 164,141 151,136 L150,118 Z"
            fill={tone.base}
            stroke={inkColor}
            strokeWidth="1.05"
          />
        ) : (
          <path
            d="M132,118 L131,137 C120,142 107,145 102,152 C104,167 108,183 111,196 C113,208 116,219 115,229 C112,242 98,254 98,272 C113,282 167,282 182,272 C182,254 168,242 165,229 C164,219 167,208 169,196 C172,183 176,167 178,152 C173,145 160,142 149,137 L148,118 Z"
            fill={tone.base}
            stroke={inkColor}
            strokeWidth="1.05"
          />
        )}

        {/* Clavículas e Contorno do Pescoço */}
        <path
          d={isMasc ? 'M127,128 L121,143 M153,128 L159,143 M112,146 Q128,151 138,147 M168,146 Q152,151 142,147' : 'M132,126 L128,141 M148,126 L152,141 M116,147 Q129,151 138,148 M164,147 Q151,151 142,148'}
          fill="none"
          stroke={tone.shadow}
          strokeWidth="1.1"
          opacity="0.78"
        />

        {/* Roupa íntima padrão: Cueca padrão (Masculino) / Biquíni de duas peças (Feminino e Neutro) */}
        {showBaseTopMesh && (
          isMasc ? (
            <g fill="none" stroke={tone.shadow} opacity="0.55">
              <path d="M107,172 Q123,182 138,175" strokeWidth="1.2" />
              <path d="M142,175 Q157,182 173,172" strokeWidth="1.2" />
              <line x1="140" y1="178" x2="140" y2="218" strokeWidth="1" opacity="0.65" />
            </g>
          ) : (
            <g>
              {/* Alças do biquíni */}
              <path d="M123,167 L128,139 M157,167 L152,139" stroke="#232732" strokeWidth="2.1" fill="none" />
              {/* Faixa dorsal lateral */}
              <path d="M111,175 L169,175" stroke="#232732" strokeWidth="2.4" fill="none" />
              {/* Bojos do biquíni */}
              <path
                d="M114,175 C118,163 134,163 139,175 C135,183 120,184 114,175 Z"
                fill="#232732"
                stroke={inkColor}
                strokeWidth="0.95"
              />
              <path
                d="M166,175 C162,163 146,163 141,175 C145,183 160,184 166,175 Z"
                fill="#232732"
                stroke={inkColor}
                strokeWidth="0.95"
              />
              <line x1="138" y1="174" x2="142" y2="174" stroke="#3B4252" strokeWidth="1.8" />
            </g>
          )
        )}

        {showBaseBottomMesh && (
          isMasc ? (
            <g>
              {/* Cueca padrão masculina com elástico discreto */}
              <path
                d="M105,236 Q140,240 175,236 L173,274 C162,283 147,281 140,275 C133,281 118,283 107,274 Z"
                fill="#232732"
                stroke={inkColor}
                strokeWidth="1.05"
              />
              <path
                d="M105,236 Q140,240 175,236 L174,244 Q140,248 106,244 Z"
                fill="#E5E7EB"
                stroke={inkColor}
                strokeWidth="0.85"
              />
              <path d="M134,247 Q136,262 140,274 Q144,262 146,247" fill="none" stroke="#3B4252" strokeWidth="0.95" />
            </g>
          ) : (
            <g>
              {/* Calcinha de biquíni feminina / neutra */}
              <path
                d={`M${hipL + 4},248 Q140,259 ${hipR - 4},248 L${hipR - 2},257 C163,267 148,278 140,280 C132,278 117,267 ${hipL + 2},257 Z`}
                fill="#232732"
                stroke={inkColor}
                strokeWidth="1"
              />
              <path
                d={`M${hipL + 3},250 Q140,261 ${hipR - 3},250`}
                fill="none"
                stroke="#3B4252"
                strokeWidth="1.3"
              />
            </g>
          )
        )}

        {/* Orelhas esculpidas */}
        <ellipse cx={isMasc ? 111 : 113} cy="89" rx="4.2" ry="7.4" fill={tone.base} stroke={inkColor} strokeWidth="0.95" />
        <ellipse cx={isMasc ? 169 : 167} cy="89" rx="4.2" ry="7.4" fill={tone.base} stroke={inkColor} strokeWidth="0.95" />

        {/* Cabeça com mandíbula masculina esculpida / rosto oval feminino refinado */}
        <path
          d={
            isMasc
              ? 'M112,81 C112,56 123,46 140,46 C157,46 168,56 168,81 C168,103 161,115 151,122 L140,126 L129,122 C119,115 112,103 112,81 Z'
              : isNeutral
              ? 'M114,82 C114,58 125,48 140,48 C155,48 166,58 166,82 C166,104 156,118 145,123 L140,124 L135,123 C124,118 114,104 114,82 Z'
              : 'M115,83 C115,59 125,49 140,49 C155,49 165,59 165,83 C165,105 152,121 140,123 C128,121 115,105 115,83 Z'
          }
          fill={tone.base}
          stroke={inkColor}
          strokeWidth="1.05"
        />
        <path
          d={
            isMasc
              ? 'M112,81 C112,56 123,46 140,46 C157,46 168,56 168,81 C168,103 161,115 151,122 L140,126 L129,122 C119,115 112,103 112,81 Z'
              : isNeutral
              ? 'M114,82 C114,58 125,48 140,48 C155,48 166,58 166,82 C166,104 156,118 145,123 L140,124 L135,123 C124,118 114,104 114,82 Z'
              : 'M115,83 C115,59 125,49 140,49 C155,49 165,59 165,83 C165,105 152,121 140,123 C128,121 115,105 115,83 Z'
          }
          fill={`url(#${rawUid}_skinShade)`}
        />

        {/* Contorno de maçã do rosto / sombra mandibular */}
        <ellipse cx="123" cy="95" rx="6.5" ry="3.4" fill={tone.blush} opacity={isMasc ? 0.16 : 0.34} />
        <ellipse cx="157" cy="95" rx="6.5" ry="3.4" fill={tone.blush} opacity={isMasc ? 0.16 : 0.34} />
        {isMasc && (
          <path d="M117,97 L123,111 M163,97 L157,111" stroke={tone.shadow} strokeWidth="0.9" opacity="0.55" />
        )}

        {/* Sobrancelhas, Olhos, Nariz e Boca definidos com estilos & customização 2D/3D sincronizada */}
        {(() => {
          const browStyle = faceCustomization?.eyebrowStyle ?? 'arqueada';
          const browColor = faceCustomization?.eyebrowColor || '#2A1D17';
          const browDx = (faceCustomization?.eyebrowsPosX ?? 0) * 0.45;
          const browDy = (faceCustomization?.eyebrowsPosY ?? 0) * 0.45;
          const browSc = Math.max(0.6, Math.min(1.5, faceCustomization?.eyebrowsScale ?? 1.0));

          const eyeStyle = faceCustomization?.eyeStyle ?? 'amendoado';
          const eyeDx = (faceCustomization?.eyesPosX ?? 0) * 0.45;
          const eyeDy = (faceCustomization?.eyesPosY ?? 0) * 0.45;
          const eyeSc = Math.max(0.6, Math.min(1.5, faceCustomization?.eyesScale ?? 1.0));

          const noseStyle = faceCustomization?.noseStyle ?? 'fino';
          const noseDx = (faceCustomization?.nosePosX ?? 0) * 0.4;
          const noseDy = (faceCustomization?.nosePosY ?? 0) * 0.45;
          const noseSc = Math.max(0.6, Math.min(1.5, faceCustomization?.noseScale ?? 1.0));

          const mouthStyle = faceCustomization?.mouthStyle ?? 'cupido';
          const mouthDx = (faceCustomization?.mouthPosX ?? 0) * 0.4;
          const mouthDy = (faceCustomization?.mouthPosY ?? 0) * 0.45;
          const mouthSc = Math.max(0.6, Math.min(1.5, faceCustomization?.mouthScale ?? 1.0));
          const lipColor = faceCustomization?.mouthColor || (isMasc ? tone.shadow : isNeutral ? '#BC707B' : '#C65B6F');

          const leftBrowPath =
            browStyle === 'reta'
              ? 'M117,74 L136,73.2'
              : browStyle === 'fina'
                ? 'M118.5,75 Q127,72 135.5,74.8'
                : browStyle === 'grossa'
                  ? 'M116.5,75.2 Q126,69.5 136.5,74.2'
                  : isMasc
                    ? 'M117,74.5 Q126,70.5 136,74.5'
                    : 'M119,75.5 Q127,70.4 135.5,74.8';
          const rightBrowPath =
            browStyle === 'reta'
              ? 'M144,73.2 L163,74'
              : browStyle === 'fina'
                ? 'M144.5,74.8 Q153,72 161.5,75'
                : browStyle === 'grossa'
                  ? 'M143.5,74.2 Q154,69.5 163.5,75.2'
                  : isMasc
                    ? 'M144,74.5 Q154,70.5 163,74.5'
                    : 'M144.5,74.8 Q153,70.4 161,75.5';
          const browStrokeW =
            browStyle === 'fina'
              ? isMasc
                ? 1.8
                : 1.25
              : browStyle === 'grossa'
                ? isMasc
                  ? 3.4
                  : 2.55
                : isMasc
                  ? 2.6
                  : 1.75;

          const leftEyeSclera =
            eyeStyle === 'grande'
              ? 'M119.5,83 Q127,76.4 134.5,83.4 Q127,89.4 119.5,83 Z'
              : eyeStyle === 'marcado'
                ? 'M119,83.2 Q127,78.4 135,83.2 Q127,87.4 119,83.2 Z'
                : eyeStyle === 'suave'
                  ? 'M120.2,83.4 Q127,79.6 133.8,83.5 Q127,87.2 120.2,83.4 Z'
                  : isMasc
                    ? 'M120,83 Q127,79 134,83.5 Q127,87.5 120,83 Z'
                    : 'M120,83 Q127,78.2 134,83.5 Q127,88 120,83 Z';
          const rightEyeSclera =
            eyeStyle === 'grande'
              ? 'M145.5,83.4 Q153,76.4 160.5,83 Q153,89.4 145.5,83.4 Z'
              : eyeStyle === 'marcado'
                ? 'M145,83.2 Q153,78.4 161,83.2 Q153,87.4 145,83.2 Z'
                : eyeStyle === 'suave'
                  ? 'M146.2,83.5 Q153,79.6 159.8,83.4 Q153,87.2 146.2,83.5 Z'
                  : isMasc
                    ? 'M146,83.5 Q153,79 160,83 Q153,87.5 146,83.5 Z'
                    : 'M146,83.5 Q153,78.2 160,83 Q153,88 146,83.5 Z';
          const irisR = eyeStyle === 'grande' ? 3.7 : eyeStyle === 'suave' ? 2.9 : 3.2;
          const lidStrokeW =
            eyeStyle === 'marcado'
              ? isMasc
                ? 2.2
                : 2.7
              : eyeStyle === 'suave'
                ? 1.5
                : isMasc
                  ? 1.7
                  : 2.1;

          const lipPath =
            mouthStyle === 'cheia'
              ? 'M131.2,107 Q135.5,103.4 140,105.6 Q144.5,103.4 148.8,107 Q144.8,113.8 140,113.8 Q135.2,113.8 131.2,107 Z'
              : mouthStyle === 'delicada'
                ? 'M134,107.6 Q137,105.6 140,106.8 Q143,105.6 146,107.6 Q143,110.8 140,110.8 Q137,110.8 134,107.6 Z'
                : mouthStyle === 'natural'
                  ? 'M132.5,107.4 Q140,105.2 147.5,107.4 Q144,111.5 140,111.5 Q136,111.5 132.5,107.4 Z'
                  : isMasc
                    ? 'M132.5,107.5 Q140,105.5 147.5,107.5 Q144,111.5 140,111.5 Q136,111.5 132.5,107.5 Z'
                    : 'M132,107 Q136,104.2 140,106.2 Q144,104.2 148,107 Q144,112.4 140,112.4 Q136,112.4 132,107 Z';

          return (
            <>
              {/* Sobrancelhas */}
              <g>
                <g transform={`translate(${browDx}, ${browDy}) translate(127, 73) scale(${browSc}) translate(-127, -73)`}>
                  <path
                    d={leftBrowPath}
                    fill="none"
                    stroke={browColor}
                    strokeWidth={browStrokeW}
                    strokeLinecap="round"
                  />
                </g>
                <g transform={`translate(${-browDx}, ${browDy}) translate(153, 73) scale(${browSc}) translate(-153, -73)`}>
                  <path
                    d={rightBrowPath}
                    fill="none"
                    stroke={browColor}
                    strokeWidth={browStrokeW}
                    strokeLinecap="round"
                  />
                </g>
              </g>

              {/* Olhos com pálpebra marcada, íris sombreada e piscar procedural */}
              <g>
                <g transform={`translate(${eyeDx}, ${eyeDy}) translate(127, 83) scale(${eyeSc}) translate(-127, -83)`}>
                  <g className={enableIdle ? 'avatar-eye-blink' : undefined}>
                    <path
                      d={leftEyeSclera}
                      fill="#FFFFFF"
                      stroke={inkColor}
                      strokeWidth="0.7"
                    />
                    <path d="M121,79.5 Q127,76.8 133,79.8" fill="none" stroke={tone.shadow} strokeWidth="0.9" opacity="0.7" />
                    <circle cx="127.3" cy="83.2" r={irisR} fill={`url(#${rawUid}_iris)`} />
                    <circle cx="127.3" cy="83.2" r={irisR * 0.46} fill="#141210" />
                    <circle cx="128.7" cy="81.6" r="1.15" fill="#FFFFFF" />
                    <path
                      d={eyeStyle === 'marcado' ? 'M118,82.6 Q127,77.2 134.8,83.4' : 'M119.5,82.8 Q127,77.6 134.5,83.4'}
                      fill="none"
                      stroke="#181412"
                      strokeWidth={lidStrokeW}
                    />
                    {(!isMasc || eyeStyle === 'marcado') && (
                      <path d="M120,82.2 L117.2,79.2 M122.2,80.6 L120.2,78.1" stroke="#181412" strokeWidth="0.95" />
                    )}
                  </g>
                </g>

                <g transform={`translate(${-eyeDx}, ${eyeDy}) translate(153, 83) scale(${eyeSc}) translate(-153, -83)`}>
                  <g className={enableIdle ? 'avatar-eye-blink' : undefined}>
                    <path
                      d={rightEyeSclera}
                      fill="#FFFFFF"
                      stroke={inkColor}
                      strokeWidth="0.7"
                    />
                    <path d="M147,79.8 Q153,76.8 159,79.5" fill="none" stroke={tone.shadow} strokeWidth="0.9" opacity="0.7" />
                    <circle cx="152.7" cy="83.2" r={irisR} fill={`url(#${rawUid}_iris)`} />
                    <circle cx="152.7" cy="83.2" r={irisR * 0.46} fill="#141210" />
                    <circle cx="154.1" cy="81.6" r="1.15" fill="#FFFFFF" />
                    <path
                      d={eyeStyle === 'marcado' ? 'M145.2,83.4 Q153,77.2 162,82.6' : 'M145.5,83.4 Q153,77.6 160.5,82.8'}
                      fill="none"
                      stroke="#181412"
                      strokeWidth={lidStrokeW}
                    />
                    {(!isMasc || eyeStyle === 'marcado') && (
                      <path d="M160,82.2 L162.8,79.2 M157.8,80.6 L159.8,78.1" stroke="#181412" strokeWidth="0.95" />
                    )}
                  </g>
                </g>
              </g>

              {/* Nariz esculpido conforme noseStyle */}
              <g transform={`translate(${noseDx}, ${noseDy}) translate(140, 90) scale(${noseSc}) translate(-140, -90)`}>
                <line x1="139.5" y1="83" x2="139.5" y2="92" stroke="#FFFFFF" strokeWidth="0.95" opacity="0.32" />
                {noseStyle === 'reto' ? (
                  <>
                    <path d="M139.3,83.5 L139.8,95.2" fill="none" stroke={inkColor} strokeWidth="1.15" opacity="0.76" />
                    <path d="M137.2,96.2 L142.8,96.2" fill="none" stroke={tone.shadow} strokeWidth="1.05" />
                  </>
                ) : noseStyle === 'delicado' ? (
                  <>
                    <path d="M139.6,87.5 Q140.8,92.5 138.6,95.2" fill="none" stroke={inkColor} strokeWidth="0.85" opacity="0.6" />
                    <path d="M138.2,95.4 Q140,96.4 141.8,95.4" fill="none" stroke={tone.shadow} strokeWidth="0.9" />
                  </>
                ) : noseStyle === 'arredondado' ? (
                  <>
                    <path d="M138.5,86 Q142,92.8 137.5,96.4" fill="none" stroke={inkColor} strokeWidth="1.1" opacity="0.72" />
                    <path d="M136.5,95.6 Q140,98.6 143.5,95.6" fill="none" stroke={tone.shadow} strokeWidth="1.15" />
                  </>
                ) : (
                  <>
                    <path d="M139.2,85 Q141.5,93 137.8,96" fill="none" stroke={inkColor} strokeWidth="1.05" opacity="0.72" />
                    <path d="M137.5,96.2 Q140,97.4 142.8,96" fill="none" stroke={tone.shadow} strokeWidth="0.95" />
                  </>
                )}
              </g>

              {/* Lábios detalhados conforme mouthStyle */}
              <g transform={`translate(${mouthDx}, ${mouthDy}) translate(140, 108) scale(${mouthSc}) translate(-140, -108)`}>
                <path
                  d={lipPath}
                  fill={lipColor}
                  stroke={inkColor}
                  strokeWidth="0.65"
                />
                <path d="M133.2,107.5 Q140,109 146.8,107.5" fill="none" stroke={inkColor} strokeWidth="0.75" opacity="0.85" />
                {(!isMasc || mouthStyle === 'cheia') && (
                  <ellipse cx="140" cy="110.2" rx="2.8" ry="0.85" fill="#FFFFFF" opacity="0.48" />
                )}
              </g>
            </>
          );
        })()}

        {/* Cabelo Base Padrão (Estrutura Facial e Cabelo Padrão da folha de referência) quando nenhum cabelo está equipado */}
        {!active.cabelo && (
          isMasc ? (
            <g>
              <path
                d="M111,76 C109,54 120,40 140,40 C160,40 171,54 169,76 C167,64 161,59 152,58 C142,57 132,62 124,62 C116,62 113,67 111,76 Z"
                fill="#332119"
                stroke={inkColor}
                strokeWidth="1"
              />
              <path d="M121,51 Q138,44 156,50" fill="none" stroke="#5B3F31" strokeWidth="1.4" opacity="0.75" />
            </g>
          ) : (
            <g>
              {/* Coque baixo traseiro elegante */}
              <circle cx="140" cy="96" r="14" fill="#2A1B15" stroke={inkColor} strokeWidth="1" />
              {/* Cabelo partido ao meio em ondas clássicas */}
              <path
                d="M112,84 C111,54 124,44 140,44 C156,44 169,54 168,84 C164,70 154,60 140,56 C126,60 116,70 112,84 Z"
                fill="#35231B"
                stroke={inkColor}
                strokeWidth="1"
              />
              <line x1="140" y1="45" x2="140" y2="56" stroke="#1E130F" strokeWidth="1" />
              <path d="M123,55 Q131,50 138,54 M142,54 Q149,50 157,55" fill="none" stroke="#614436" strokeWidth="1.2" opacity="0.7" />
            </g>
          )
        )}
      </g>

      {/* 4. Sapatos (z-index 20) */}
      <g data-layer="sapatos">
        {active.sapatos === 'shoes_scarpin_preto' && (
          <g>
            <path d="M119,465 L115,491 Q124,497 132,491 L130,465 Q125,478 119,465 Z" fill="#1D191D" />
            <path d="M124,485 L125,498" stroke="#1D191D" strokeWidth="2.5" />
            <path d="M120,485 Q124,487 128,485" stroke="#52525B" strokeWidth="0.9" fill="none" />
            <path d="M150,465 L148,491 Q156,497 165,491 L161,465 Q155,478 150,465 Z" fill="#1D191D" />
            <path d="M155,485 L156,498" stroke="#1D191D" strokeWidth="2.5" />
            <path d="M152,485 Q156,487 160,485" stroke="#52525B" strokeWidth="0.9" fill="none" />
          </g>
        )}
        {active.sapatos === 'shoes_sapatilha_creme' && (
          <g>
            <path d="M118,473 L115,490 Q123,496 132,490 L131,473 Q125,481 118,473 Z" fill="#EFE6D8" stroke="#C8B9A6" strokeWidth="1" />
            <circle cx="123" cy="479" r="2.2" fill="#C8235D" />
            <path d="M149,473 L148,490 Q157,496 165,490 L162,473 Q155,481 149,473 Z" fill="#EFE6D8" stroke="#C8B9A6" strokeWidth="1" />
            <circle cx="157" cy="479" r="2.2" fill="#C8235D" />
          </g>
        )}
        {active.sapatos === 'shoes_oxford_couro' && (
          <g>
            <path d="M117,466 L113,491 Q123,497 134,491 L132,466 Z" fill="#6D3E24" stroke="#472614" strokeWidth="1" />
            <path d="M115,491 L133,491" stroke="#2D170B" strokeWidth="2.5" />
            <path d="M121,473 L128,473 M121,477 L128,477" stroke="#472614" strokeWidth="1" />
            <path d="M148,466 L146,491 Q157,497 167,491 L163,466 Z" fill="#6D3E24" stroke="#472614" strokeWidth="1" />
            <path d="M147,491 L165,491" stroke="#2D170B" strokeWidth="2.5" />
            <path d="M152,473 L159,473 M152,477 L159,477" stroke="#472614" strokeWidth="1" />
          </g>
        )}
        {active.sapatos === 'shoes_tenis_branco' && (
          <g>
            <path d="M117,466 L113,491 Q124,497 134,491 L132,466 Z" fill="#F9F8F6" stroke="#CFC9C0" strokeWidth="1" />
            <path d="M113,488 Q124,494 134,488 L134,492 Q124,497 113,492 Z" fill="#E3DDD4" />
            <path d="M148,466 L146,491 Q156,497 167,491 L163,466 Z" fill="#F9F8F6" stroke="#CFC9C0" strokeWidth="1" />
            <path d="M146,488 Q156,494 167,488 L167,492 Q156,497 146,492 Z" fill="#E3DDD4" />
          </g>
        )}
        {active.sapatos === 'shoes_bota_cano' && (
          <g>
            <path d="M118,402 L115,491 Q123,497 133,491 L132,402 Z" fill="#8C4E2B" stroke="#68361B" strokeWidth="1" />
            <path d="M117,424 L132,424" stroke="#68361B" strokeWidth="1" />
            <path d="M148,402 L147,491 Q157,497 165,491 L162,402 Z" fill="#8C4E2B" stroke="#68361B" strokeWidth="1" />
            <path d="M148,424 L163,424" stroke="#68361B" strokeWidth="1" />
          </g>
        )}
        {active.sapatos === 'shoes_sandalia_ouro' && (
          <g stroke="#D4A853" strokeWidth="2.2" fill="none">
            <path d="M119,465 L129,465 M118,474 L130,474 M116,486 Q123,494 131,488" />
            <path d="M151,465 L161,465 M150,474 L162,474 M149,488 Q157,494 164,486" />
            <path d="M117,489 L131,489" strokeWidth="3" />
            <path d="M149,489 L163,489" strokeWidth="3" />
          </g>
        )}
        {active.sapatos === 'shoes_coturno_preto' && (
          <g>
            <path d="M116,422 L113,491 Q124,498 134,491 L133,422 Z" fill="#201E23" stroke="#111013" strokeWidth="1" />
            <path d="M113,489 L134,489" stroke="#0B0A0C" strokeWidth="3.5" />
            <path d="M120,440 L129,440 M120,450 L129,450 M120,460 L129,460" stroke="#52525B" strokeWidth="1.2" />
            <path d="M147,422 L146,491 Q156,498 167,491 L164,422 Z" fill="#201E23" stroke="#111013" strokeWidth="1" />
            <path d="M146,489 L167,489" stroke="#0B0A0C" strokeWidth="3.5" />
            <path d="M151,440 L160,440 M151,450 L160,450 M151,460 L160,460" stroke="#52525B" strokeWidth="1.2" />
          </g>
        )}
        {active.sapatos === 'shoes_salto_cristal_vip' && (
          <g>
            <path d="M119,465 L115,491 Q124,497 132,491 L130,465 Q125,478 119,465 Z" fill="#BAE6FD" stroke="#7DD3FC" strokeWidth="1" />
            <path d="M124,485 L125,498" stroke="#D4A853" strokeWidth="2.4" />
            <path d="M150,465 L148,491 Q156,497 165,491 L161,465 Q155,478 150,465 Z" fill="#BAE6FD" stroke="#7DD3FC" strokeWidth="1" />
            <path d="M155,485 L156,498" stroke="#D4A853" strokeWidth="2.4" />
            <circle cx="123" cy="484" r="2" fill="#FFFFFF" />
            <circle cx="157" cy="484" r="2" fill="#FFFFFF" />
          </g>
        )}
        {active.sapatos === 'shoes_mocassim_ouro_vip' && (
          <g>
            <path d="M117,469 L113,491 Q123,497 134,491 L132,469 Z" fill="#1C1917" stroke="#B8893A" strokeWidth="1.1" />
            <rect x="119" y="476" width="10" height="3" rx="1" fill="#FBBF24" />
            <path d="M148,469 L146,491 Q157,497 167,491 L163,469 Z" fill="#1C1917" stroke="#B8893A" strokeWidth="1.1" />
            <rect x="151" y="476" width="10" height="3" rx="1" fill="#FBBF24" />
          </g>
        )}
        {active.sapatos === 'shoes_chunky_y2k' && (
          <g>
            <path d="M115,465 L110,492 Q123,498 136,492 L133,465 Z" fill="#F3EDE2" stroke="#94A3B8" strokeWidth="1" />
            <path d="M110,488 Q123,495 136,488 L136,494 Q123,499 110,494 Z" fill="#1E293B" />
            <path d="M147,465 L144,492 Q157,498 170,492 L165,465 Z" fill="#F3EDE2" stroke="#94A3B8" strokeWidth="1" />
            <path d="M144,488 Q157,495 170,488 L170,494 Q157,499 144,494 Z" fill="#1E293B" />
          </g>
        )}
        {dynShoes &&
          (dynShoes.customLayerPngUrl ? (
            renderCustomPngLayer(dynShoes)
          ) : (
            <g>
              {dynShoes.templateId === 'shoes_bota_cano' ? (
                <>
                  <path d="M117,406 L114,491 Q124,497 134,491 L132,406 Z" fill={dynShoes.swatchColor} stroke={dynShoes.secondaryColor || '#1C1917'} strokeWidth="1" />
                  <path d="M148,406 L146,491 Q156,497 166,491 L163,406 Z" fill={dynShoes.swatchColor} stroke={dynShoes.secondaryColor || '#1C1917'} strokeWidth="1" />
                  <path d="M114,489 L134,489 M146,489 L166,489" stroke={dynShoes.accentColor || '#18181B'} strokeWidth="3" />
                </>
              ) : (
                <>
                  <path d="M117,466 L114,491 Q124,497 134,491 L132,466 Z" fill={dynShoes.swatchColor} stroke={dynShoes.isVipOnly ? '#D4A853' : dynShoes.secondaryColor || '#1C1917'} strokeWidth="1" />
                  <path d="M148,466 L146,491 Q156,497 166,491 L163,466 Z" fill={dynShoes.swatchColor} stroke={dynShoes.isVipOnly ? '#D4A853' : dynShoes.secondaryColor || '#1C1917'} strokeWidth="1" />
                  <path d="M114,489 Q124,494 134,489 M146,489 Q156,494 166,489" stroke={dynShoes.accentColor || '#E5E7EB'} strokeWidth="2.2" fill="none" />
                </>
              )}
            </g>
          ))}
      </g>

      {/* 5. Calças e Saias (z-index 30) */}
      <g data-layer="calcas">
        {active.calcas === 'bottom_calca_alfaiataria' && (
          <g>
            <path
              d={`M${waistL},225 L${waistR},225 L${hipR + 2},274 L163,465 L146,465 L140,295 L134,465 L117,465 L${hipL - 2},274 Z`}
              fill="#374151"
              stroke="#1F2937"
              strokeWidth="1"
            />
            <rect x={waistL} y="225" width={waistR - waistL} height="9" fill="#27303F" />
            <line x1="125" y1="242" x2="124" y2="455" stroke="#576375" strokeWidth="1" />
            <line x1="155" y1="242" x2="156" y2="455" stroke="#576375" strokeWidth="1" />
          </g>
        )}
        {active.calcas === 'bottom_chino_areia' && (
          <g>
            <path
              d={`M${waistL},224 L${waistR},224 L${hipR + 2},274 L163,463 L146,463 L140,296 L134,463 L117,463 L${hipL - 2},274 Z`}
              fill="#C8B496"
              stroke="#9D8768"
              strokeWidth="1"
            />
            <rect x={waistL} y="224" width={waistR - waistL} height="8" fill="#6D4B30" />
            <rect x="136" y="224" width="8" height="8" rx="1" fill="#D4A853" />
          </g>
        )}
        {active.calcas === 'bottom_cargo_urbana' && (
          <g>
            <path
              d={`M${waistL - 1},224 L${waistR + 1},224 L${hipR + 4},278 L166,464 L146,464 L140,296 L134,464 L114,464 L${hipL - 4},278 Z`}
              fill="#3E454C"
              stroke="#24292E"
              strokeWidth="1"
            />
            <rect x="108" y="314" width="14" height="34" rx="2" fill="#32383E" stroke="#24292E" strokeWidth="0.9" />
            <rect x="158" y="314" width="14" height="34" rx="2" fill="#32383E" stroke="#24292E" strokeWidth="0.9" />
          </g>
        )}
        {active.calcas === 'bottom_jogger_creme' && (
          <g>
            <path
              d={`M${waistL - 1},225 L${waistR + 1},225 L${hipR + 3},276 L163,456 L147,456 L140,296 L133,456 L117,456 L${hipL - 3},276 Z`}
              fill="#EAE2D6"
              stroke="#C9BDAC"
              strokeWidth="1"
            />
            <rect x="116" y="450" width="18" height="7" rx="2" fill="#D5C8B7" />
            <rect x="146" y="450" width="18" height="7" rx="2" fill="#D5C8B7" />
            <path d="M136,227 L135,244 M144,227 L145,244" stroke="#9C8E7B" strokeWidth="1.2" />
          </g>
        )}
        {active.calcas === 'bottom_saia_midi' && (
          <g>
            <path
              d={`M${waistL},225 L${waistR},225 L194,386 Q140,398 86,386 Z`}
              fill={`url(#${rawUid}_rosePleat)`}
              stroke="#C87588"
              strokeWidth="1"
            />
            <rect x={waistL} y="225" width={waistR - waistL} height="8" fill="#C87588" />
            <path d="M124,233 L106,387 M134,233 L126,390 M146,233 L154,390 M156,233 L174,387" stroke="#C87588" strokeWidth="0.9" opacity="0.65" />
          </g>
        )}
        {active.calcas === 'bottom_jeans_cintura' && (
          <g>
            <path
              d={`M${waistL},224 L${waistR},224 L${hipR + 1},274 L162,462 L146,462 L140,296 L134,462 L118,462 L${hipL - 1},274 Z`}
              fill={`url(#${rawUid}_denimWash)`}
              stroke="#2C4563"
              strokeWidth="1"
            />
            <line x1="140" y1="226" x2="140" y2="268" stroke="#D79F5B" strokeWidth="1.2" />
            <circle cx="140" cy="229" r="2" fill="#D4A853" />
          </g>
        )}
        {active.calcas === 'bottom_saia_couro' && (
          <g>
            <path
              d={`M${waistL},226 L${waistR},226 L181,316 Q140,324 99,316 Z`}
              fill="#6E1E33"
              stroke="#481020"
              strokeWidth="1"
            />
            <rect x={waistL} y="226" width={waistR - waistL} height="8" fill="#481020" />
            <line x1="140" y1="234" x2="140" y2="318" stroke="#9B3751" strokeWidth="1.3" />
          </g>
        )}
        {active.calcas === 'bottom_calca_vip_preta' && (
          <g>
            <path
              d={`M${waistL},224 L${waistR},224 L${hipR + 2},274 L163,465 L146,465 L140,295 L134,465 L117,465 L${hipL - 2},274 Z`}
              fill="#18181B"
              stroke="#D4A853"
              strokeWidth="1.1"
            />
            <rect x={waistL} y="224" width={waistR - waistL} height="8" fill="#B8893A" />
            <rect x="135" y="224" width="10" height="8" rx="1" fill="#FDE68A" />
            <line x1="115" y1="250" x2="119" y2="462" stroke="#D4A853" strokeWidth="1.5" />
            <line x1="165" y1="250" x2="161" y2="462" stroke="#D4A853" strokeWidth="1.5" />
          </g>
        )}
        {active.calcas === 'bottom_baggy_denim_us' && (
          <g>
            <path
              d={`M${waistL - 2},225 L${waistR + 2},225 L${hipR + 6},282 L171,466 L146,466 L140,302 L134,466 L109,466 L${hipL - 6},282 Z`}
              fill="#3B6592"
              stroke="#1E3A5F"
              strokeWidth="1"
            />
            <rect x={waistL - 2} y="225" width={waistR - waistL + 4} height="8" fill="#2A4A6D" />
            <line x1="120" y1="245" x2="117" y2="462" stroke="#608AB5" strokeWidth="1.2" opacity="0.5" />
            <line x1="160" y1="245" x2="163" y2="462" stroke="#608AB5" strokeWidth="1.2" opacity="0.5" />
          </g>
        )}
        {dynBottom &&
          (dynBottom.customLayerPngUrl ? (
            renderCustomPngLayer(dynBottom)
          ) : dynBottom.templateId === 'tpl_saia' || dynBottom.templateId === 'bottom_saia_midi' ? (
            <g>
              <path
                d={`M${waistL},225 L${waistR},225 L190,370 Q140,382 90,370 Z`}
                fill={dynBottom.swatchColor}
                stroke={dynBottom.isVipOnly ? '#D4A853' : dynBottom.secondaryColor || '#1C1917'}
                strokeOpacity="0.65"
                strokeWidth="1"
              />
              {dynBottom.pattern && dynBottom.pattern !== 'solid' && (
                <path
                  d={`M${waistL},225 L${waistR},225 L190,370 Q140,382 90,370 Z`}
                  fill={`url(#${rawUid}_bot_pat)`}
                />
              )}
              <rect
                x={waistL}
                y="225"
                width={waistR - waistL}
                height="7"
                fill={dynBottom.accentColor || (dynBottom.isVipOnly ? '#D4A853' : '#1C1917')}
                opacity="0.85"
              />
            </g>
          ) : (
            <g>
              <path
                d={`M${waistL},224 L${waistR},224 L${hipR + 2},274 L163,463 L146,463 L140,295 L134,463 L117,463 L${hipL - 2},274 Z`}
                fill={dynBottom.swatchColor}
                stroke={dynBottom.isVipOnly ? '#D4A853' : dynBottom.secondaryColor || '#1C1917'}
                strokeOpacity="0.65"
                strokeWidth="1"
              />
              {dynBottom.pattern && dynBottom.pattern !== 'solid' && (
                <path
                  d={`M${waistL},224 L${waistR},224 L${hipR + 2},274 L163,463 L146,463 L140,295 L134,463 L117,463 L${hipL - 2},274 Z`}
                  fill={`url(#${rawUid}_bot_pat)`}
                />
              )}
              <rect
                x={waistL}
                y="224"
                width={waistR - waistL}
                height="7"
                fill={dynBottom.secondaryColor || '#1C1917'}
                opacity="0.7"
              />
              <rect x="136" y="224" width="8" height="7" rx="1" fill={dynBottom.accentColor || '#D4A853'} />
            </g>
          ))}
      </g>

      {/* 6. Blusas, Camisas e Jaquetas (z-index 40) */}
      <g data-layer="blusas">
        {active.blusas === 'top_camisa_seda' && (
          <g>
            <path d={leftLongSleevePath} fill={`url(#${rawUid}_silkIvory)`} stroke="#D5C8B8" strokeWidth="1" />
            <path d={rightLongSleevePath} fill={`url(#${rawUid}_silkIvory)`} stroke="#D5C8B8" strokeWidth="1" />
            <path
              d={`M${shL},151 L126,144 L140,162 L154,144 L${shR},151 L${waistR + 4},200 L${waistR},232 L${waistL},232 L${waistL - 4},200 Z`}
              fill={`url(#${rawUid}_silkIvory)`}
              stroke="#D5C8B8"
              strokeWidth="1"
            />
            <line x1="140" y1="162" x2="140" y2="232" stroke="#D5C8B8" strokeWidth="1" />
            <circle cx="140" cy="176" r="1.5" fill="#C4B4A2" />
            <circle cx="140" cy="196" r="1.5" fill="#C4B4A2" />
            <circle cx="140" cy="216" r="1.5" fill="#C4B4A2" />
          </g>
        )}
        {active.blusas === 'top_camisa_social_azul' && (
          <g>
            <path d={leftLongSleevePath} fill="#90B2D8" stroke="#6B8DB5" strokeWidth="1" />
            <path d={rightLongSleevePath} fill="#90B2D8" stroke="#6B8DB5" strokeWidth="1" />
            <path
              d={`M${shL},150 L126,143 L140,160 L154,143 L${shR},150 L${waistR + 4},200 L${waistR},232 L${waistL},232 L${waistL - 4},200 Z`}
              fill="#90B2D8"
              stroke="#6B8DB5"
              strokeWidth="1"
            />
            <path d="M126,143 L140,160 L132,166 L121,152 Z" fill="#A9C6E6" stroke="#6B8DB5" strokeWidth="0.8" />
            <path d="M154,143 L140,160 L148,166 L159,152 Z" fill="#A9C6E6" stroke="#6B8DB5" strokeWidth="0.8" />
            <line x1="140" y1="160" x2="140" y2="232" stroke="#6B8DB5" strokeWidth="1" />
            <rect x="148" y="175" width="12" height="14" rx="1" fill="#82A4CA" stroke="#6B8DB5" strokeWidth="0.8" />
          </g>
        )}
        {active.blusas === 'top_camiseta_basica_preta' && (
          <g>
            <path d={leftShortSleevePath} fill="#2B2B30" stroke="#1A1A1E" strokeWidth="1" />
            <path d={rightShortSleevePath} fill="#2B2B30" stroke="#1A1A1E" strokeWidth="1" />
            <path
              d={`M${shL},150 L125,146 Q140,158 155,146 L${shR},150 L${waistR + 4},200 L${waistR + 1},233 L${waistL - 1},233 L${waistL - 4},200 Z`}
              fill="#2B2B30"
              stroke="#1A1A1E"
              strokeWidth="1"
            />
          </g>
        )}
        {active.blusas === 'top_cropped_veludo' && (
          <g>
            <path
              d={`M${shL + 7},152 L${shL + 13},152 L120,170 Q140,178 160,170 L${shR - 13},152 L${shR - 7},152 L${waistR + 3},196 L${waistR},212 L${waistL},212 L${waistL - 3},196 Z`}
              fill={`url(#${rawUid}_velvetCrimson)`}
              stroke="#7A0E31"
              strokeWidth="1"
            />
          </g>
        )}
        {active.blusas === 'top_blusa_ombro_laco' && (
          <g>
            <path
              d={`M${shL + 2},160 Q140,174 ${shR - 2},160 L${waistR + 2},226 L${waistL - 2},226 Z`}
              fill="#F8ECEF"
              stroke="#D8BCC5"
              strokeWidth="1"
            />
            <path
              d={`M${shL - 4},160 Q100,176 112,176 Q126,184 140,176 Q154,184 168,176 Q180,176 ${shR + 4},160`}
              fill="#FDF7F9"
              stroke="#D8BCC5"
              strokeWidth="1"
            />
            <circle cx="140" cy="176" r="3" fill="#C8235D" />
          </g>
        )}
        {active.blusas === 'top_blazer_tweed' && (
          <g>
            <path d={leftLongSleevePath} fill="#2F3640" stroke="#1E242B" strokeWidth="1" />
            <path d={rightLongSleevePath} fill="#2F3640" stroke="#1E242B" strokeWidth="1" />
            <path
              d={`M${shL - 2},150 L125,144 L140,176 L155,144 L${shR + 2},150 L${waistR + 6},205 L${waistR + 2},240 L${waistL - 2},240 L${waistL - 6},205 Z`}
              fill="#2F3640"
              stroke="#1E242B"
              strokeWidth="1"
            />
            <path d="M125,144 L140,176 L130,180 L118,154 Z" fill="#46505E" />
            <path d="M155,144 L140,176 L150,180 L162,154 Z" fill="#46505E" />
            <circle cx="133" cy="202" r="2.2" fill="#D4A853" />
            <circle cx="147" cy="202" r="2.2" fill="#D4A853" />
            <circle cx="133" cy="220" r="2.2" fill="#D4A853" />
            <circle cx="147" cy="220" r="2.2" fill="#D4A853" />
          </g>
        )}
        {active.blusas === 'top_jaqueta_couro' && (
          <g>
            <path d={leftLongSleevePath} fill={`url(#${rawUid}_leatherNoir)`} stroke="#0F0E12" strokeWidth="1" />
            <path d={rightLongSleevePath} fill={`url(#${rawUid}_leatherNoir)`} stroke="#0F0E12" strokeWidth="1" />
            <path
              d={`M${shL - 2},150 L124,144 L140,178 L156,144 L${shR + 2},150 L${waistR + 6},205 L${waistR + 2},238 L${waistL - 2},238 L${waistL - 6},205 Z`}
              fill={`url(#${rawUid}_leatherNoir)`}
              stroke="#0F0E12"
              strokeWidth="1"
            />
            <path d="M122,145 L138,176 L126,174 L112,154 Z" fill="#322F38" stroke="#52525B" strokeWidth="0.7" />
            <path d="M158,145 L142,176 L154,174 L168,154 Z" fill="#322F38" stroke="#52525B" strokeWidth="0.7" />
            <line x1="145" y1="176" x2="137" y2="236" stroke="#D4D4D8" strokeWidth="1.6" />
          </g>
        )}
        {active.blusas === 'top_jaqueta_bomber' && (
          <g>
            <path d={leftLongSleevePath} fill="#EAE3D5" stroke="#B7AE9E" strokeWidth="1" />
            <path d={rightLongSleevePath} fill="#EAE3D5" stroke="#B7AE9E" strokeWidth="1" />
            <path
              d={`M${shL - 2},150 L126,144 Q140,152 154,144 L${shR + 2},150 L${waistR + 7},205 L${waistR + 2},236 L${waistL - 2},236 L${waistL - 7},205 Z`}
              fill="#3B5242"
              stroke="#243529"
              strokeWidth="1"
            />
            <rect x={waistL - 2} y="227" width={waistR - waistL + 4} height="9" fill="#243529" />
            <line x1="140" y1="152" x2="140" y2="235" stroke="#D4A853" strokeWidth="1.5" />
          </g>
        )}
        {active.blusas === 'top_sobretudo_caramelo' && (
          <g>
            <path d={leftLongSleevePath} fill="#B58453" stroke="#855C33" strokeWidth="1" />
            <path d={rightLongSleevePath} fill="#B58453" stroke="#855C33" strokeWidth="1" />
            <path
              d={`M${shL - 3},150 L124,143 L140,174 L156,143 L${shR + 3},150 L${waistR + 6},212 L${hipR + 12},344 L${hipL - 12},344 L${waistL - 6},212 Z`}
              fill="#B58453"
              stroke="#855C33"
              strokeWidth="1"
            />
            <path d="M124,143 L140,174 L128,178 L115,154 Z" fill="#C99A6B" />
            <path d="M156,143 L140,174 L152,178 L165,154 Z" fill="#C99A6B" />
            <rect x={waistL - 2} y="216" width={waistR - waistL + 4} height="7" fill="#855C33" />
            <circle cx="132" cy="196" r="2" fill="#4E341B" />
            <circle cx="148" cy="196" r="2" fill="#4E341B" />
          </g>
        )}
        {active.blusas === 'top_corset_dourado' && (
          <g>
            <path
              d={`M${shL + 5},164 Q124,174 140,168 Q156,174 ${shR - 5},164 L${waistR + 1},224 Q140,234 ${waistL - 1},224 Z`}
              fill={`url(#${rawUid}_goldChampagne)`}
              stroke="#A37F42"
              strokeWidth="1"
            />
            <line x1="127" y1="170" x2="125" y2="225" stroke="#A37F42" strokeWidth="0.9" opacity="0.6" />
            <line x1="140" y1="169" x2="140" y2="228" stroke="#A37F42" strokeWidth="0.9" opacity="0.6" />
            <line x1="153" y1="170" x2="155" y2="225" stroke="#A37F42" strokeWidth="0.9" opacity="0.6" />
          </g>
        )}
        {active.blusas === 'top_sueter_listrado' && (
          <g>
            <path d={leftLongSleevePath} fill="#F6F3ED" stroke="#23334C" strokeWidth="1" />
            <path d={rightLongSleevePath} fill="#F6F3ED" stroke="#23334C" strokeWidth="1" />
            <path
              d={`M${shL},152 Q140,162 ${shR},152 L${waistR + 3},200 L${waistR},230 L${waistL},230 L${waistL - 3},200 Z`}
              fill="#F6F3ED"
              stroke="#23334C"
              strokeWidth="1"
            />
            <g stroke="#23334C" strokeWidth="4">
              <line x1="106" y1="168" x2="174" y2="168" />
              <line x1="108" y1="184" x2="172" y2="184" />
              <line x1="111" y1="200" x2="169" y2="200" />
              <line x1="113" y1="216" x2="167" y2="216" />
            </g>
          </g>
        )}
        {active.blusas === 'top_smoking_ouro_vip' && (
          <g>
            <path d={leftLongSleevePath} fill="#1E1B24" stroke="#D4A853" strokeWidth="1" />
            <path d={rightLongSleevePath} fill="#1E1B24" stroke="#D4A853" strokeWidth="1" />
            <path
              d={`M${shL - 2},150 L125,144 L140,178 L155,144 L${shR + 2},150 L${waistR + 6},205 L${waistR + 2},240 L${waistL - 2},240 L${waistL - 6},205 Z`}
              fill="#1E1B24"
              stroke="#D4A853"
              strokeWidth="1"
            />
            <path d="M125,144 L140,178 L131,180 L118,154 Z" fill="#D4A853" />
            <path d="M155,144 L140,178 L149,180 L162,154 Z" fill="#D4A853" />
            <polygon points="133,154 140,158 147,154 147,162 140,158 133,162" fill="#FBBF24" />
            <circle cx="140" cy="202" r="2.3" fill="#FBBF24" />
            <circle cx="140" cy="220" r="2.3" fill="#FBBF24" />
          </g>
        )}
        {active.blusas === 'top_hoodie_y2k_ny' && (
          <g>
            <path d={leftLongSleevePath} fill="#1E3A8A" stroke="#172554" strokeWidth="1" />
            <path d={rightLongSleevePath} fill="#1E3A8A" stroke="#172554" strokeWidth="1" />
            <path
              d={`M${shL - 3},148 L125,142 Q140,152 155,142 L${shR + 3},148 L${waistR + 7},205 L${waistR + 3},236 L${waistL - 3},236 L${waistL - 7},205 Z`}
              fill="#1E3A8A"
              stroke="#172554"
              strokeWidth="1"
            />
            <path d="M126,144 Q140,157 154,144 Q158,158 140,164 Q122,158 126,144 Z" fill="#172554" />
            <rect x="122" y="182" width="36" height="14" rx="2" fill="#F8FAFC" opacity="0.92" />
            <text x="140" y="192" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#1E3A8A">NYC</text>
          </g>
        )}
        {active.blusas === 'top_cropped_y2k_la' && (
          <g>
            <path d={leftShortSleevePath} fill="#EC4899" stroke="#BE185D" strokeWidth="1" />
            <path d={rightShortSleevePath} fill="#EC4899" stroke="#BE185D" strokeWidth="1" />
            <path
              d={`M${shL},150 L125,146 Q140,158 155,146 L${shR},150 L${waistR + 4},196 L${waistR},210 L${waistL},210 L${waistL - 4},196 Z`}
              fill="#EC4899"
              stroke="#BE185D"
              strokeWidth="1"
            />
            <polygon points="140,170 144,178 152,178 146,183 148,191 140,186 132,191 134,183 128,178 136,178" fill="#FEF08A" />
          </g>
        )}
        {dynTop &&
          (dynTop.customLayerPngUrl ? (
            renderCustomPngLayer(dynTop)
          ) : (
            <g>
              {dynTop.templateId !== 'tpl_regata' && dynTop.templateId !== 'top_cropped_veludo' && (
                <>
                  <path
                    d={leftLongSleevePath}
                    fill={dynTop.secondaryColor || dynTop.swatchColor}
                    stroke={dynTop.isVipOnly ? '#D4A853' : '#1C1917'}
                    strokeOpacity="0.55"
                    strokeWidth="1"
                  />
                  <path
                    d={rightLongSleevePath}
                    fill={dynTop.secondaryColor || dynTop.swatchColor}
                    stroke={dynTop.isVipOnly ? '#D4A853' : '#1C1917'}
                    strokeOpacity="0.55"
                    strokeWidth="1"
                  />
                </>
              )}
              <path
                d={`M${shL},150 L126,144 Q140,158 154,144 L${shR},150 L${waistR + 4},200 L${waistR + 1},234 L${waistL - 1},234 L${waistL - 4},200 Z`}
                fill={dynTop.swatchColor}
                stroke={dynTop.isVipOnly ? '#D4A853' : dynTop.secondaryColor || '#1C1917'}
                strokeOpacity="0.65"
                strokeWidth="1"
              />
              {dynTop.pattern && dynTop.pattern !== 'solid' && (
                <path
                  d={`M${shL},150 L126,144 Q140,158 154,144 L${shR},150 L${waistR + 4},200 L${waistR + 1},234 L${waistL - 1},234 L${waistL - 4},200 Z`}
                  fill={`url(#${rawUid}_top_pat)`}
                />
              )}
              {(dynTop.templateId === 'top_blazer_tweed' ||
                dynTop.templateId === 'top_jaqueta_couro' ||
                dynTop.templateId === 'tpl_blazer') && (
                <>
                  <path
                    d="M125,144 L140,176 L130,180 L118,154 Z"
                    fill={dynTop.secondaryColor || '#1F2937'}
                    opacity="0.9"
                  />
                  <path
                    d="M155,144 L140,176 L150,180 L162,154 Z"
                    fill={dynTop.secondaryColor || '#1F2937'}
                    opacity="0.9"
                  />
                  <circle cx="140" cy="196" r="2.2" fill={dynTop.accentColor || '#D4A853'} />
                  <circle cx="140" cy="214" r="2.2" fill={dynTop.accentColor || '#D4A853'} />
                </>
              )}
              <path
                d={`M${shL + 8},164 Q${waistL + 6},198 ${waistL + 10},225`}
                fill="none"
                stroke="#1C1917"
                strokeWidth="0.9"
                opacity="0.22"
              />
              <path
                d={`M${shR - 8},164 Q${waistR - 6},198 ${waistR - 10},225`}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="0.9"
                opacity="0.25"
              />
              {dynTop.isVipOnly && (
                <circle cx="140" cy="182" r="2.8" fill="#FDE68A" stroke="#B45309" strokeWidth="0.7" />
              )}
            </g>
          ))}
      </g>

      {/* 7. Vestidos (z-index 42) */}
      <g data-layer="vestidos">
        {active.vestidos === 'dress_tubinho_atelier' && (
          <g>
            <path
              d={`M${shL + 8},151 L122,151 Q140,172 158,151 L${shR - 8},151 L${waistR},215 L${hipR + 6},316 Q140,322 ${hipL - 6},316 L${waistL},215 Z`}
              fill="#1F1D22"
              stroke="#0E0D10"
              strokeWidth="1"
            />
            <rect x={waistL} y="220" width={waistR - waistL} height="5" fill="#D4A853" />
          </g>
        )}
        {active.vestidos === 'dress_midi_floral_rose' && (
          <g>
            <path
              d={`M${shL + 8},152 L119,152 L123,172 Q140,180 157,172 L161,152 L${shR - 8},152 L${waistR},224 L196,386 Q140,398 84,386 L${waistL},224 Z`}
              fill={`url(#${rawUid}_rosePleat)`}
              stroke="#C87588"
              strokeWidth="1"
            />
            <rect x={waistL} y="222" width={waistR - waistL} height="6" fill="#B95D73" />
            <circle cx="122" cy="296" r="3" fill="#FFFDF8" opacity="0.65" />
            <circle cx="154" cy="332" r="3.5" fill="#FFFDF8" opacity="0.65" />
            <circle cx="132" cy="356" r="2.8" fill="#FFFDF8" opacity="0.65" />
          </g>
        )}
        {active.vestidos === 'dress_gala_escarlate' && (
          <g>
            <path
              d={`M${shL + 6},162 Q125,174 140,166 Q155,174 ${shR - 6},162 L${waistR},224 L204,470 Q140,485 76,470 L${waistL},224 Z`}
              fill={`url(#${rawUid}_velvetCrimson)`}
              stroke="#7A0E31"
              strokeWidth="1"
            />
            <path d="M126,225 L112,473 M154,225 L168,473" stroke="#E86D93" strokeWidth="0.9" opacity="0.45" />
          </g>
        )}
        {active.vestidos === 'dress_cetim_champagne' && (
          <g>
            <path d="M117,151 L117,170" stroke="#B89356" strokeWidth="1.5" />
            <path d="M163,151 L163,170" stroke="#B89356" strokeWidth="1.5" />
            <path
              d={`M${shL + 9},168 Q128,176 140,171 Q152,176 ${shR - 9},168 L${waistR},222 L${hipR + 8},354 Q140,362 ${hipL - 8},354 L${waistL},222 Z`}
              fill={`url(#${rawUid}_goldChampagne)`}
              stroke="#A37F42"
              strokeWidth="1"
            />
          </g>
        )}
        {active.vestidos === 'dress_alta_costura_diamante' && (
          <g>
            <path d="M117,150 L117,168" stroke="#D4A853" strokeWidth="1.6" />
            <path d="M163,150 L163,168" stroke="#D4A853" strokeWidth="1.6" />
            <path
              d={`M${shL + 6},164 Q125,174 140,166 Q155,174 ${shR - 6},164 L${waistR},222 L205,468 Q140,486 75,468 L${waistL},222 Z`}
              fill={`url(#${rawUid}_goldChampagne)`}
              stroke="#D4A853"
              strokeWidth="1.2"
            />
            <rect x={waistL} y="218" width={waistR - waistL} height="6" fill="#0EA5E9" opacity="0.85" />
            <polygon points="140,224 146,232 140,240 134,232" fill="#E0F2FE" stroke="#0284C7" strokeWidth="0.8" />
            <circle cx="118" cy="310" r="2.8" fill="#FFFFFF" opacity="0.8" />
            <circle cx="158" cy="360" r="3.2" fill="#FFFFFF" opacity="0.8" />
            <circle cx="136" cy="412" r="2.8" fill="#FFFFFF" opacity="0.8" />
          </g>
        )}
        {dynDress &&
          (dynDress.customLayerPngUrl ? (
            renderCustomPngLayer(dynDress)
          ) : (
            <g>
              <path
                d={
                  dynDress.templateId === 'dress_gala_escarlate'
                    ? `M${shL + 6},162 Q125,174 140,166 Q155,174 ${shR - 6},162 L${waistR},224 L204,470 Q140,485 76,470 L${waistL},224 Z`
                    : `M${shL + 8},154 L120,154 Q140,172 160,154 L${shR - 8},154 L${waistR},222 L195,388 Q140,400 85,388 L${waistL},222 Z`
                }
                fill={dynDress.swatchColor}
                stroke={dynDress.isVipOnly ? '#D4A853' : dynDress.secondaryColor || '#1C1917'}
                strokeOpacity="0.65"
                strokeWidth="1.1"
              />
              {dynDress.pattern && dynDress.pattern !== 'solid' && (
                <path
                  d={
                    dynDress.templateId === 'dress_gala_escarlate'
                      ? `M${shL + 6},162 Q125,174 140,166 Q155,174 ${shR - 6},162 L${waistR},224 L204,470 Q140,485 76,470 L${waistL},224 Z`
                      : `M${shL + 8},154 L120,154 Q140,172 160,154 L${shR - 8},154 L${waistR},222 L195,388 Q140,400 85,388 L${waistL},222 Z`
                  }
                  fill={`url(#${rawUid}_drs_pat)`}
                />
              )}
              <rect
                x={waistL}
                y="220"
                width={waistR - waistL}
                height="6"
                fill={dynDress.accentColor || (dynDress.isVipOnly ? '#FBBF24' : dynDress.secondaryColor || '#1C1917')}
                opacity="0.88"
              />
              <path d="M124,228 L112,382 M140,228 L140,388 M156,228 L168,382" stroke="#1C1917" strokeWidth="0.85" opacity="0.2" />
              <path d="M130,228 L122,382 M150,228 L158,382" stroke="#FFFFFF" strokeWidth="0.85" opacity="0.24" />
            </g>
          ))}
      </g>

      {/* 7.5 Camada de Sobreposição: Jaquetas & Casacos (z-index 44) */}
      <g data-layer="casacos">
        {dynCoat &&
          (dynCoat.customLayerPngUrl ? (
            renderCustomPngLayer(dynCoat)
          ) : (
            <g>
              <path
                d={`M${shL - 1},148 L122,146 L132,248 L${waistL - 6},248 Z`}
                fill={dynCoat.swatchColor}
                stroke={dynCoat.secondaryColor || '#1C1917'}
                strokeWidth="1.2"
              />
              <path
                d={`M${shR + 1},148 L158,146 L148,248 L${waistR + 6},248 Z`}
                fill={dynCoat.swatchColor}
                stroke={dynCoat.secondaryColor || '#1C1917'}
                strokeWidth="1.2"
              />
              <polygon
                points={`122,146 135,182 126,184`}
                fill={dynCoat.secondaryColor || dynCoat.swatchColor}
                stroke={dynCoat.accentColor || '#1C1917'}
                strokeWidth="0.9"
              />
              <polygon
                points={`158,146 145,182 154,184`}
                fill={dynCoat.secondaryColor || dynCoat.swatchColor}
                stroke={dynCoat.accentColor || '#1C1917'}
                strokeWidth="0.9"
              />
              <circle cx="131" cy="196" r="2.1" fill={dynCoat.accentColor || '#D4A853'} />
              <circle cx="131" cy="214" r="2.1" fill={dynCoat.accentColor || '#D4A853'} />
            </g>
          ))}
      </g>

      {/* 8. Camada Frontal do Cabelo (z-index 50) */}
      <g data-layer="cabelo-frente">
        {active.cabelo === 'hair_ondas_mel' && (
          <path
            d="M106,82 C104,54 122,42 142,42 C164,42 176,56 174,84 C168,66 154,60 140,62 C126,64 114,72 106,82 Z"
            fill="#C78A4E"
          />
        )}
        {active.cabelo === 'hair_bob_paris' && (
          <g>
            <path
              d="M106,86 C105,54 120,44 140,44 C160,44 175,54 174,86 C168,72 162,67 156,67 L124,67 C118,67 112,72 106,86 Z"
              fill="#242024"
            />
            <path d="M116,58 L164,58 L161,72 L119,72 Z" fill="#242024" />
          </g>
        )}
        {active.cabelo === 'hair_coque_atelier' && (
          <path
            d="M110,82 C109,54 122,45 140,45 C158,45 171,54 170,82 C164,66 153,61 140,61 C127,61 116,66 110,82 Z"
            fill="#4A312C"
          />
        )}
        {active.cabelo === 'hair_longo_cereja' && (
          <path
            d="M104,88 C104,52 120,42 140,42 C160,42 176,52 176,88 C168,68 156,61 145,62 L135,62 C124,61 112,68 104,88 Z"
            fill="#A94438"
          />
        )}
        {active.cabelo === 'hair_rabo_seda' && (
          <path
            d="M109,83 C109,52 122,42 140,42 C158,42 171,52 171,83 C165,67 154,61 140,61 C126,61 115,67 109,83 Z"
            fill="#E5D3B3"
          />
        )}
        {active.cabelo === 'hair_corte_executivo' && (
          <path
            d="M108,82 C106,55 121,41 142,41 C163,41 174,55 172,82 C167,67 156,62 144,63 L126,65 C117,67 111,73 108,82 Z"
            fill="#4A3224"
          />
        )}
        {active.cabelo === 'hair_fade_moderno' && (
          <path
            d="M110,76 C111,48 124,38 140,38 C156,38 169,48 170,76 C164,61 154,58 140,58 C126,58 116,61 110,76 Z"
            fill="#1F1D20"
          />
        )}
        {active.cabelo === 'hair_cachos_urbanos' && (
          <g fill="#36231C">
            <circle cx="122" cy="52" r="12" />
            <circle cx="140" cy="48" r="13" />
            <circle cx="158" cy="52" r="12" />
            <circle cx="114" cy="64" r="9" />
            <circle cx="166" cy="64" r="9" />
          </g>
        )}
        {active.cabelo === 'hair_surf_loiro' && (
          <path
            d="M106,84 C105,52 120,42 140,42 C160,42 175,52 174,84 C166,68 152,61 140,68 C128,61 114,68 106,84 Z"
            fill="#C89B54"
          />
        )}
        {active.cabelo === 'hair_coroa_ondas_vip' && (
          <path
            d="M104,84 C104,50 120,40 140,40 C160,40 176,50 176,84 C168,66 154,59 140,62 C126,59 112,66 104,84 Z"
            fill="#E6B97A"
          />
        )}
        {dynHair &&
          (dynHair.customLayerPngUrl ? (
            renderCustomPngLayer(dynHair)
          ) : (
            <g>
              <path
                d={
                  dynHair.gender === 'masculino' || dynHair.templateId === 'hair_fade_moderno'
                    ? 'M110,76 C111,48 124,38 140,38 C156,38 169,48 170,76 C164,61 154,58 140,58 C126,58 116,61 110,76 Z'
                    : 'M106,84 C105,52 120,42 140,42 C160,42 175,52 174,84 C166,66 153,61 140,63 C127,61 114,66 106,84 Z'
                }
                fill={dynHair.swatchColor}
              />
              <path
                d="M118,55 Q140,44 162,55"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.26"
              />
            </g>
          ))}
        {/* Brilho acetinado sutil sobre qualquer cabelo vetorial ativo */}
        {active.cabelo && !dynHair?.customLayerPngUrl && (
          <path
            d="M118,54 Q140,45 162,54"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.22"
          />
        )}
      </g>

      {/* 9. Acessórios Múltiplos por Parte do Corpo (z-index 60) */}
      <g data-layer="acessorios">
        {hasStaticAcc('acc_oculos_gatinho') && (
          <g>
            <path
              d="M112,80 L135,82 C136,89 131,93 123,93 C115,93 112,87 112,80 Z"
              fill="#1C1917"
              fillOpacity="0.25"
              stroke="#5B3926"
              strokeWidth="2.4"
            />
            <path
              d="M168,80 L145,82 C144,89 149,93 157,93 C165,93 168,87 168,80 Z"
              fill="#1C1917"
              fillOpacity="0.25"
              stroke="#5B3926"
              strokeWidth="2.4"
            />
            <line x1="135" y1="83" x2="145" y2="83" stroke="#5B3926" strokeWidth="2.2" />
          </g>
        )}
        {hasStaticAcc('acc_oculos_aviador') && (
          <g>
            <path
              d="M115,80 L136,80 C136,90 130,94 123,93 C117,92 114,86 115,80 Z"
              fill="#27272A"
              fillOpacity="0.38"
              stroke="#D4A853"
              strokeWidth="2"
            />
            <path
              d="M165,80 L144,80 C144,90 150,94 157,93 C163,92 166,86 165,80 Z"
              fill="#27272A"
              fillOpacity="0.38"
              stroke="#D4A853"
              strokeWidth="2"
            />
            <line x1="135" y1="80" x2="145" y2="80" stroke="#D4A853" strokeWidth="1.8" />
            <line x1="136" y1="83" x2="144" y2="83" stroke="#D4A853" strokeWidth="1.5" />
          </g>
        )}
        {hasStaticAcc('acc_boina_francesa') && (
          <g transform="rotate(-12 140 52)">
            <ellipse cx="140" cy="48" rx="34" ry="15" fill="#B91C4D" stroke="#881236" strokeWidth="1.2" />
            <path d="M138,33 L142,27" stroke="#881236" strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="140" cy="59" rx="26" ry="4" fill="#881236" />
          </g>
        )}
        {hasStaticAcc('acc_bone_street') && (
          <g>
            <path d="M108,65 C109,42 124,35 140,35 C156,35 171,42 172,65 Z" fill="#201F23" stroke="#111013" strokeWidth="1" />
            <path d="M107,65 Q140,73 185,68 Q162,59 107,65 Z" fill="#171619" />
          </g>
        )}
        {hasStaticAcc('acc_chapeu_fedora') && (
          <g>
            <ellipse cx="140" cy="59" rx="46" ry="8" fill="#C5AB89" stroke="#9B805E" strokeWidth="1.2" />
            <path d="M116,58 L121,36 Q140,32 159,36 L164,58 Z" fill="#C5AB89" stroke="#9B805E" strokeWidth="1.2" />
            <rect x="116.5" y="51" width="47" height="5" fill="#3D2B24" />
          </g>
        )}
        {hasStaticAcc('acc_tiara_perolas') && (
          <g fill="#FFFDF8" stroke="#D6C9B4" strokeWidth="0.7">
            <path d="M110,70 C115,44 165,44 170,70" fill="none" stroke="#DFC496" strokeWidth="2.5" />
            <circle cx="117" cy="56" r="3" />
            <circle cx="127" cy="49" r="3.4" />
            <circle cx="140" cy="47" r="3.8" />
            <circle cx="153" cy="49" r="3.4" />
            <circle cx="163" cy="56" r="3" />
          </g>
        )}
        {hasStaticAcc('acc_colar_perolas') && (
          <g fill="#FFFDF8" stroke="#DDD3C2" strokeWidth="0.7">
            <circle cx="127" cy="141" r="2.6" />
            <circle cx="132" cy="145" r="2.6" />
            <circle cx="137" cy="148" r="2.7" />
            <circle cx="143" cy="148" r="2.7" />
            <circle cx="148" cy="145" r="2.6" />
            <circle cx="153" cy="141" r="2.6" />
            <circle cx="129" cy="149" r="2.4" />
            <circle cx="135" cy="154" r="2.5" />
            <circle cx="140" cy="156" r="2.9" />
            <circle cx="145" cy="154" r="2.5" />
            <circle cx="151" cy="149" r="2.4" />
          </g>
        )}
        {hasStaticAcc('acc_relogio_couro') && (
          <g>
            <rect x={isMasc ? 194 : isNeutral ? 196 : 198} y="246" width="12" height="5" rx="1.5" fill="#6D3E24" />
            <circle cx={isMasc ? 200 : isNeutral ? 202 : 204} cy="248.5" r="3.5" fill="#D4A853" stroke="#855C33" strokeWidth="0.8" />
          </g>
        )}
        {hasStaticAcc('acc_bolsa_estruturada') && (
          <g>
            <path d={`M${isMasc ? 198 : 202},265 C${isMasc ? 196 : 200},249 ${isMasc ? 211 : 215},249 ${isMasc ? 211 : 215},265`} fill="none" stroke="#7B4320" strokeWidth="2.5" />
            <path d={`M${isMasc ? 191 : 195},266 L${isMasc ? 219 : 223},266 L${isMasc ? 223 : 227},305 L${isMasc ? 187 : 191},305 Z`} fill="#A66134" stroke="#7B4320" strokeWidth="1.2" />
            <rect x={isMasc ? 201 : 205} y="275" width="8" height="5" rx="1" fill="#D4A853" />
          </g>
        )}
        {hasStaticAcc('acc_coroa_imperial_vip') && (
          <g>
            <polygon points="116,54 121,34 131,45 140,26 149,45 159,34 164,54" fill="#FBBF24" stroke="#B45309" strokeWidth="1.3" />
            <polygon points="140,36 144,43 140,50 136,43" fill="#38BDF8" stroke="#0284C7" strokeWidth="0.7" />
            <circle cx="122" cy="46" r="2.2" fill="#FFFDF8" />
            <circle cx="158" cy="46" r="2.2" fill="#FFFDF8" />
          </g>
        )}
        {hasStaticAcc('acc_coroa_diamante_soberana_vip') && (
          <g>
            <polygon points="114,55 120,30 130,43 140,22 150,43 160,30 166,55" fill="#F8FAFC" stroke="#0284C7" strokeWidth="1.2" />
            <polygon points="140,31 145,41 140,51 135,41" fill="#0EA5E9" stroke="#0369A1" strokeWidth="0.8" />
            <circle cx="122" cy="44" r="2.6" fill="#38BDF8" />
            <circle cx="158" cy="44" r="2.6" fill="#38BDF8" />
            <circle cx="131" cy="49" r="2" fill="#E0F2FE" />
            <circle cx="149" cy="49" r="2" fill="#E0F2FE" />
          </g>
        )}
        {hasStaticAcc('acc_cetro_real_vip') && (
          <g>
            <line x1={isMasc ? 202 : 206} y1="196" x2={isMasc ? 210 : 215} y2="338" stroke="#D97706" strokeWidth="3.6" strokeLinecap="round" />
            <circle cx={isMasc ? 202 : 206} cy="192" r="9" fill="#FBBF24" stroke="#92400E" strokeWidth="1.2" />
            <polygon points={`${isMasc ? 202 : 206},181 ${isMasc ? 207 : 211},192 ${isMasc ? 202 : 206},203 ${isMasc ? 197 : 201},192`} fill="#E0F2FE" stroke="#0284C7" strokeWidth="0.9" />
            <circle cx={isMasc ? 202 : 206} cy="192" r="2.4" fill="#FFFFFF" />
          </g>
        )}
        {hasStaticAcc('acc_relogio_ouro_vip') && (
          <g>
            <rect x={isMasc ? 194 : isNeutral ? 196 : 198} y="245" width="13" height="6" rx="2" fill="#B45309" />
            <circle cx={isMasc ? 200.5 : isNeutral ? 202.5 : 204.5} cy="248" r="4.5" fill="#FDE68A" stroke="#D97706" strokeWidth="1.2" />
            <circle cx={isMasc ? 200.5 : isNeutral ? 202.5 : 204.5} cy="248" r="1.5" fill="#38BDF8" />
          </g>
        )}
        {hasStaticAcc('acc_bolsa_grife_vip') && (
          <g>
            <path d={`M${isMasc ? 198 : 202},264 C${isMasc ? 195 : 199},247 ${isMasc ? 212 : 216},247 ${isMasc ? 212 : 216},264`} fill="none" stroke="#FBBF24" strokeWidth="2.6" />
            <path d={`M${isMasc ? 189 : 193},265 L${isMasc ? 221 : 225},265 L${isMasc ? 225 : 229},308 L${isMasc ? 185 : 189},308 Z`} fill="#18181B" stroke="#D97706" strokeWidth="1.3" />
            <polygon points={`${isMasc ? 205 : 209},278 ${isMasc ? 210 : 214},285 ${isMasc ? 205 : 209},292 ${isMasc ? 200 : 204},285`} fill="#38BDF8" stroke="#FBBF24" strokeWidth="0.9" />
          </g>
        )}
        {dynAccList.map((dynAcc) => {
          if (dynAcc.customLayerPngUrl) {
            return <React.Fragment key={dynAcc.id}>{renderCustomPngLayer(dynAcc)}</React.Fragment>;
          }
          if (dynAcc.threeSpec?.garmentSilhouette === 'acc_eyepatch' || dynAcc.id === 'legendary_tapa_olho') {
            return (
              <g key={dynAcc.id}>
                <line x1="111" y1="81" x2="168" y2="75" stroke="#D4AF37" strokeWidth="2" />
                <path
                  d="M115,80 Q125,75 135,80 L133,91 Q124,95 116,90 Z"
                  fill="#18181B"
                  stroke="#F59E0B"
                  strokeWidth="1.8"
                />
                <circle cx="125" cy="85" r="2.2" fill="#FBBF24" />
              </g>
            );
          }
          if (dynAcc.threeSpec?.garmentSilhouette === 'acc_dragon' || dynAcc.id === 'legendary_dragaozinho') {
            return (
              <g key={dynAcc.id} transform="translate(212, 82)">
                <path d="M-4,10 Q-20,-6 -6,-14 Q6,-6 2,10 Z" fill="#F59E0B" opacity="0.88" stroke="#991B1B" strokeWidth="1" />
                <path d="M12,10 Q28,-6 14,-14 Q2,-6 6,10 Z" fill="#F59E0B" opacity="0.88" stroke="#991B1B" strokeWidth="1" />
                <ellipse cx="4" cy="14" rx="11" ry="8" fill="#DC2626" stroke="#7F1D1D" strokeWidth="1.2" />
                <ellipse cx="4" cy="16" rx="6" ry="4" fill="#FDE68A" />
                <circle cx="13" cy="6" r="6" fill="#DC2626" stroke="#7F1D1D" strokeWidth="1.1" />
                <polygon points="10,0 13,-7 15,1" fill="#FBBF24" />
                <circle cx="15" cy="5" r="1.4" fill="#FDE047" />
                <path d="M-7,15 Q-18,22 -14,30" fill="none" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" />
              </g>
            );
          }
          if (dynAcc.threeSpec?.garmentSilhouette === 'acc_white_tiger' || dynAcc.id === 'legendary_tigre_branco') {
            return (
              <g key={dynAcc.id} transform="translate(206, 430)">
                {/* Cauda listrada */}
                <path d="M-16,14 Q-32,8 -30,-4" fill="none" stroke="#F8FAFC" strokeWidth="4.2" strokeLinecap="round" />
                <path d="M-24,10 L-22,6 M-30,4 L-27,1" stroke="#18181B" strokeWidth="2.2" strokeLinecap="round" />
                {/* Patas brancas */}
                <rect x="-14" y="16" width="5" height="16" rx="2.5" fill="#F8FAFC" stroke="#18181B" strokeWidth="0.9" />
                <rect x="-6" y="17" width="5" height="15" rx="2.5" fill="#E2E8F0" stroke="#18181B" strokeWidth="0.9" />
                <rect x="6" y="16" width="5" height="16" rx="2.5" fill="#F8FAFC" stroke="#18181B" strokeWidth="0.9" />
                <rect x="13" y="17" width="5" height="15" rx="2.5" fill="#E2E8F0" stroke="#18181B" strokeWidth="0.9" />
                {/* Corpo branco com listras pretas */}
                <ellipse cx="0" cy="12" rx="18" ry="11" fill="#F8FAFC" stroke="#334155" strokeWidth="1.1" />
                <path d="M-9,3 Q-8,12 -10,19 M-2,2 Q-1,12 -3,20 M5,3 Q6,12 4,19" fill="none" stroke="#18181B" strokeWidth="2.2" strokeLinecap="round" />
                {/* Cabeça felina e orelhas */}
                <circle cx="15" cy="1" r="9.5" fill="#F8FAFC" stroke="#334155" strokeWidth="1.1" />
                <circle cx="9" cy="-7" r="3.4" fill="#F8FAFC" stroke="#18181B" strokeWidth="1" />
                <circle cx="20" cy="-7" r="3.4" fill="#F8FAFC" stroke="#18181B" strokeWidth="1" />
                <path d="M13,-5 L15,-2 M17,-5 L15,-2" stroke="#18181B" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12.5" cy="0" r="1.5" fill="#38BDF8" />
                <circle cx="18.5" cy="0" r="1.5" fill="#38BDF8" />
                <ellipse cx="16" cy="4.2" rx="3.2" ry="2.2" fill="#FFFFFF" />
                <polygon points="14.6,3 17.4,3 16,5" fill="#F472B6" />
              </g>
            );
          }
          if (dynAcc.threeSpec?.garmentSilhouette === 'acc_watch' || dynAcc.id === 'acc_relogio_ouro_atelier' || dynAcc.templateId === 'tpl_relogio') {
            return (
              <g key={dynAcc.id}>
                <rect x={isMasc ? 194 : isNeutral ? 196 : 198} y="245" width="13" height="6" rx="2" fill={dynAcc.secondaryColor || '#B45309'} />
                <circle cx={isMasc ? 200.5 : isNeutral ? 202.5 : 204.5} cy="248" r="4.5" fill={dynAcc.swatchColor || '#FBBF24'} stroke="#78350F" strokeWidth="1.1" />
                <circle cx={isMasc ? 200.5 : isNeutral ? 202.5 : 204.5} cy="248" r="1.5" fill="#FFFFFF" />
              </g>
            );
          }
          if (dynAcc.templateId === 'tpl_oculos' || dynAcc.templateId === 'acc_oculos_aviador' || dynAcc.templateId === 'acc_oculos_gatinho') {
            return (
              <g key={dynAcc.id}>
                <rect x="114" y="79" width="22" height="12" rx="4" fill="#1C1917" fillOpacity="0.28" stroke={dynAcc.swatchColor} strokeWidth="2.2" />
                <rect x="144" y="79" width="22" height="12" rx="4" fill="#1C1917" fillOpacity="0.28" stroke={dynAcc.swatchColor} strokeWidth="2.2" />
                <line x1="136" y1="84" x2="144" y2="84" stroke={dynAcc.swatchColor} strokeWidth="2" />
              </g>
            );
          }
          if (dynAcc.templateId === 'tpl_bolsa' || dynAcc.templateId === 'acc_bolsa_estruturada') {
            return (
              <g key={dynAcc.id}>
                <path d={`M${isMasc ? 198 : 202},265 C${isMasc ? 196 : 200},249 ${isMasc ? 211 : 215},249 ${isMasc ? 211 : 215},265`} fill="none" stroke={dynAcc.secondaryColor || dynAcc.swatchColor} strokeWidth="2.5" />
                <path d={`M${isMasc ? 191 : 195},266 L${isMasc ? 219 : 223},266 L${isMasc ? 223 : 227},305 L${isMasc ? 187 : 191},305 Z`} fill={dynAcc.swatchColor} stroke={dynAcc.isVipOnly ? '#D4A853' : '#1C1917'} strokeOpacity="0.7" strokeWidth="1.1" />
                <rect x={isMasc ? 201 : 205} y="277" width="8" height="5" rx="1" fill={dynAcc.accentColor || '#D4A853'} />
              </g>
            );
          }
          if (dynAcc.templateId === 'tpl_cetro') {
            return (
              <g key={dynAcc.id}>
                <line x1={isMasc ? 202 : 206} y1="198" x2={isMasc ? 210 : 215} y2="334" stroke="#D97706" strokeWidth="3.2" strokeLinecap="round" />
                <circle cx={isMasc ? 202 : 206} cy="194" r="8" fill={dynAcc.swatchColor} stroke="#92400E" strokeWidth="1.2" />
                <circle cx={isMasc ? 202 : 206} cy="194" r="2.5" fill="#FFFFFF" />
              </g>
            );
          }
          if (dynAcc.templateId === 'tpl_coroa' || dynAcc.templateId === 'acc_coroa_imperial_vip') {
            return (
              <g key={dynAcc.id}>
                <polygon points="116,54 121,34 131,45 140,26 149,45 159,34 164,54" fill={dynAcc.swatchColor} stroke="#B45309" strokeWidth="1.2" />
                <circle cx="140" cy="42" r="3" fill={dynAcc.accentColor || '#E0F2FE'} />
              </g>
            );
          }
          if (dynAcc.templateId === 'tpl_colar' || dynAcc.templateId === 'acc_colar_perolas') {
            return (
              <g key={dynAcc.id} fill={dynAcc.swatchColor} stroke={dynAcc.accentColor || '#D4A853'} strokeWidth="0.8">
                <path d="M126,142 Q140,158 154,142" fill="none" stroke={dynAcc.swatchColor} strokeWidth="2.4" />
                <circle cx="131" cy="147" r="2.3" />
                <circle cx="140" cy="151" r="3" fill={dynAcc.accentColor || '#FDE68A'} />
                <circle cx="149" cy="147" r="2.3" />
              </g>
            );
          }
          if (dynAcc.templateId === 'tpl_chapeu' || dynAcc.templateId === 'acc_boina_francesa' || dynAcc.templateId === 'acc_chapeu_fedora') {
            return (
              <g key={dynAcc.id}>
                <ellipse cx="140" cy="59" rx="44" ry="8" fill={dynAcc.swatchColor} stroke={dynAcc.secondaryColor || '#1C1917'} strokeWidth="1.2" />
                <path d="M116,58 L121,36 Q140,32 159,36 L164,58 Z" fill={dynAcc.swatchColor} stroke={dynAcc.secondaryColor || '#1C1917'} strokeWidth="1.2" />
                <rect x="116.5" y="51" width="47" height="5" fill={dynAcc.accentColor || '#3D2B24'} />
              </g>
            );
          }
          return (
            <g key={dynAcc.id}>
              <path d="M110,66 C115,43 165,43 170,66" fill="none" stroke={dynAcc.swatchColor} strokeWidth="4" />
              {(dynAcc.isVipOnly || dynAcc.accentColor) && (
                <circle cx="140" cy="44" r="4" fill={dynAcc.accentColor || '#FBBF24'} stroke="#B45309" strokeWidth="0.8" />
              )}
            </g>
          );
        })}
      </g>
      </g>
    </svg>
  );
};
