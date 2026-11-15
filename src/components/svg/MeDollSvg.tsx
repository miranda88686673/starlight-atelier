import React, { useId } from 'react';
import { SKIN_TONES } from '../../data/catalog';
import {
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

  const active = {
    cabelo: pick(equipped.cabelo),
    sapatos: pick(equipped.sapatos),
    calcas: pick(equipped.calcas),
    blusas: pick(equipped.blusas),
    vestidos: pick(equipped.vestidos),
    acessorios: pick(equipped.acessorios),
  };

  const hasDynamicItem = Object.values(active).some(
    (id) => id && !STATIC_RENDERED_IDS.has(id)
  );
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
  const dynDress = findDynamic(active.vestidos);
  const dynAcc = findDynamic(active.acessorios);

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

  // Anatomia realista e distinta entre Masculino (ombros largos, V-taper), Neutro e Feminino (cintura marcada, quadril curvo)
  const shL = isMasc ? 90 : isNeutral ? 99 : 105;
  const shR = isMasc ? 190 : isNeutral ? 181 : 175;
  const waistL = isMasc ? 109 : isNeutral ? 112 : 116;
  const waistR = isMasc ? 171 : isNeutral ? 168 : 164;
  const hipL = isMasc ? 110 : isNeutral ? 108 : 104;
  const hipR = isMasc ? 170 : isNeutral ? 172 : 176;

  // Mangas adaptadas à pose e estrutura muscular de cada corpo
  const leftLongSleevePath = isMasc
    ? 'M90,149 C77,166 72,196 74,228 L91,228 C91,199 95,174 103,160 Z'
    : isNeutral
    ? 'M99,150 C86,164 80,192 79,220 L94,222 C96,197 101,174 109,160 Z'
    : 'M105,151 C91,163 82,190 78,214 L93,217 C97,195 104,174 113,160 Z';

  const rightLongSleevePath = isMasc
    ? 'M190,149 C203,166 208,196 206,228 L189,228 C189,199 185,174 177,160 Z'
    : isNeutral
    ? 'M181,150 C194,164 200,192 201,220 L186,222 C184,197 179,174 171,160 Z'
    : 'M175,151 C189,163 197,190 198,218 L184,218 C182,194 176,174 167,160 Z';

  const leftShortSleevePath = isMasc
    ? 'M90,149 L76,184 L92,190 L103,163 Z'
    : isNeutral
    ? 'M99,150 L85,182 L99,188 L109,163 Z'
    : 'M105,151 L91,179 L103,185 L113,164 Z';

  const rightShortSleevePath = isMasc
    ? 'M190,149 L204,184 L188,190 L177,163 Z'
    : isNeutral
    ? 'M181,150 L195,182 L181,188 L171,163 Z'
    : 'M175,151 L189,179 L177,185 L167,164 Z';

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
          <stop offset="0%" stopColor={tone.shadow} stopOpacity="0.32" />
          <stop offset="28%" stopColor={tone.base} stopOpacity="0" />
          <stop offset="72%" stopColor={tone.base} stopOpacity="0" />
          <stop offset="100%" stopColor={tone.shadow} stopOpacity="0.32" />
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
          <stop offset="0%" stopColor={isMasc ? '#68828E' : '#6A9480'} />
          <stop offset="72%" stopColor={isMasc ? '#2F3F47' : '#2C493C'} />
          <stop offset="100%" stopColor="#1B2823" />
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

      {/* 3. Boneca Base — Anatomia Realista Masculino / Neutro / Feminino */}
      <g data-layer="base-doll">
        {/* Braços */}
        {isMasc ? (
          <>
            <path
              d="M92,149 C78,165 73,194 74,228 C75,248 78,264 83,274 L94,272 C91,255 90,235 91,214 C93,192 98,172 104,159 Z"
              fill={tone.base}
              stroke={tone.shadow}
              strokeWidth="1"
            />
            <path d="M84,210 Q89,212 91,208" stroke={tone.shadow} strokeWidth="0.9" fill="none" opacity="0.55" />
            <ellipse cx="87" cy="277" rx="6.5" ry="9" fill={tone.base} stroke={tone.shadow} strokeWidth="0.9" />

            <path
              d="M188,149 C202,165 207,194 206,228 C205,248 202,264 197,274 L186,272 C189,255 190,235 189,214 C187,192 182,172 176,159 Z"
              fill={tone.base}
              stroke={tone.shadow}
              strokeWidth="1"
            />
            <path d="M196,210 Q191,212 189,208" stroke={tone.shadow} strokeWidth="0.9" fill="none" opacity="0.55" />
            <ellipse cx="193" cy="277" rx="6.5" ry="9" fill={tone.base} stroke={tone.shadow} strokeWidth="0.9" />
          </>
        ) : (
          <>
            {/* Braço Esquerdo (pose editorial na cintura) */}
            <path
              d="M105,152 C92,162 84,188 79,212 C76,225 90,245 104,255 L111,248 C100,238 92,222 93,210 C96,192 104,172 113,160 Z"
              fill={tone.base}
              stroke={tone.shadow}
              strokeWidth="1"
            />
            <ellipse cx="108" cy="254" rx="5.8" ry="7.8" fill={tone.base} stroke={tone.shadow} strokeWidth="0.9" />

            {/* Braço Direito (pose relaxada) */}
            <path
              d="M175,152 C188,162 195,188 197,216 C198,236 195,256 191,270 L182,268 C185,252 186,234 184,214 C182,190 175,172 167,160 Z"
              fill={tone.base}
              stroke={tone.shadow}
              strokeWidth="1"
            />
            <ellipse cx="186" cy="273" rx="5.4" ry="8.2" fill={tone.base} stroke={tone.shadow} strokeWidth="0.9" />
          </>
        )}

        {/* Pernas separadas com contorno de joelho e tornozelo */}
        <g className={isWalking ? 'avatar-leg-left-walk' : undefined}>
          <path
            d={
              isMasc
                ? 'M110,264 C109,308 111,348 114,378 C116,406 115,434 117,463 L133,463 C135,432 136,404 136,378 C137,344 138,306 139,276 L132,264 Z'
                : 'M112,266 C109,310 112,348 117,378 C120,404 118,434 120,462 L130,462 C133,432 135,402 134,376 C135,342 138,304 139,276 L132,266 Z'
            }
            fill={tone.base}
            stroke={tone.shadow}
            strokeWidth="1"
          />
          <path d="M120,374 Q126,378 131,374" stroke={tone.shadow} strokeWidth="1.2" fill="none" opacity="0.65" />
          <path
            d={
              isMasc
                ? 'M117,460 L113,490 Q124,496 135,490 L133,460 Z'
                : 'M120,460 L116,488 Q123,495 132,489 L130,460 Z'
            }
            fill={tone.base}
            stroke={tone.shadow}
            strokeWidth="1"
          />
        </g>

        <g className={isWalking ? 'avatar-leg-right-walk' : undefined}>
          <path
            d={
              isMasc
                ? 'M148,264 L141,276 C142,306 143,344 144,378 C144,404 145,432 147,463 L163,463 C165,434 164,406 166,378 C169,348 171,308 170,264 Z'
                : 'M148,266 L141,276 C142,304 145,342 146,376 C145,402 147,432 150,462 L160,462 C162,434 160,404 163,378 C168,348 171,310 168,266 Z'
            }
            fill={tone.base}
            stroke={tone.shadow}
            strokeWidth="1"
          />
          <path d="M149,374 Q154,378 160,374" stroke={tone.shadow} strokeWidth="1.2" fill="none" opacity="0.65" />
          <path
            d={
              isMasc
                ? 'M147,460 L145,490 Q156,496 167,490 L163,460 Z'
                : 'M150,460 L148,489 Q157,495 164,488 L160,460 Z'
            }
            fill={tone.base}
            stroke={tone.shadow}
            strokeWidth="1"
          />
        </g>

        {/* Tronco Anatômico */}
        {isMasc ? (
          <path
            d="M126,118 L125,135 C112,140 96,143 90,150 C92,169 98,189 104,206 C108,218 109,228 109,238 C109,249 109,259 110,272 C122,280 158,280 170,272 C171,259 171,249 171,238 C171,228 172,218 176,206 C182,189 188,169 190,150 C184,143 168,140 155,135 L154,118 Z"
            fill={tone.base}
            stroke={tone.shadow}
            strokeWidth="1"
          />
        ) : isNeutral ? (
          <path
            d="M130,118 L130,137 C119,142 105,145 99,152 C101,168 105,186 108,200 C110,212 112,222 112,232 C111,245 106,257 108,272 C119,280 161,280 172,272 C174,257 169,245 168,232 C168,222 170,212 172,200 C175,186 179,168 181,152 C175,145 161,142 150,137 L150,118 Z"
            fill={tone.base}
            stroke={tone.shadow}
            strokeWidth="1"
          />
        ) : (
          <path
            d="M132,118 L132,138 C123,143 109,146 103,153 C105,168 109,184 111,197 C113,209 117,220 116,229 C114,243 103,255 104,272 C116,281 164,281 176,272 C177,255 166,243 164,229 C163,220 167,209 169,197 C171,184 175,168 177,153 C171,146 157,143 148,138 L148,118 Z"
            fill={tone.base}
            stroke={tone.shadow}
            strokeWidth="1"
          />
        )}

        {/* Sombras anatômicas realistas */}
        <path
          d={isMasc ? 'M126,129 Q140,135 154,129' : 'M131,126 Q140,132 149,126'}
          fill="none"
          stroke={tone.shadow}
          strokeWidth="1.3"
          opacity="0.6"
        />
        {isMasc ? (
          <g fill="none" stroke={tone.shadow} opacity="0.46">
            <path d="M107,172 Q123,181 138,174" strokeWidth="1.2" />
            <path d="M142,174 Q157,181 173,172" strokeWidth="1.2" />
            <line x1="140" y1="178" x2="140" y2="218" strokeWidth="1" opacity="0.65" />
            <path d="M128,195 Q140,198 152,195" strokeWidth="0.85" opacity="0.55" />
          </g>
        ) : (
          <g fill="none" stroke={tone.shadow} opacity="0.45">
            <path d="M119,154 Q130,159 138,155" strokeWidth="1" />
            <path d="M142,155 Q150,159 161,154" strokeWidth="1" />
            <path d="M120,174 Q131,180 138,176" strokeWidth="0.9" />
            <path d="M142,176 Q149,180 160,174" strokeWidth="0.9" />
          </g>
        )}

        {/* Roupa íntima padrão de manequim */}
        {isMasc || isNeutral ? (
          <>
            <path
              d={`M${shL + 11},151 L${shL + 19},151 Q140,163 ${shR - 19},151 L${shR - 11},151 L${waistR - 2},224 L${waistL + 2},224 Z`}
              fill="#EFEAE4"
              stroke="#D5C9BC"
              strokeWidth="0.9"
            />
            <path
              d={`M${hipL},247 C124,252 156,252 ${hipR},247 L${hipR - 2},275 C154,282 126,282 ${hipL + 2},275 Z`}
              fill="#E5DDD3"
              stroke="#CFC2B3"
              strokeWidth="0.9"
            />
          </>
        ) : (
          <>
            <path
              d="M112,168 C122,175 135,175 140,170 C145,175 158,175 168,168 L165,196 C153,193 127,193 115,196 Z"
              fill="#F5ECE5"
              stroke="#DFC9BC"
              strokeWidth="0.9"
            />
            <path d="M116,150 L116,170" stroke="#DFC9BC" strokeWidth="1.4" />
            <path d="M164,150 L164,170" stroke="#DFC9BC" strokeWidth="1.4" />
            <path
              d="M107,252 C122,257 158,257 173,252 L171,270 C156,282 124,282 109,270 Z"
              fill="#F5ECE5"
              stroke="#DFC9BC"
              strokeWidth="0.9"
            />
          </>
        )}

        {/* Orelhas */}
        <ellipse cx="110.5" cy="89" rx="4.5" ry="7.5" fill={tone.base} stroke={tone.shadow} strokeWidth="0.9" />
        <ellipse cx="169.5" cy="89" rx="4.5" ry="7.5" fill={tone.base} stroke={tone.shadow} strokeWidth="0.9" />

        {/* Cabeça com mandíbula esculpida */}
        <path
          d={
            isMasc
              ? 'M110,82 C110,58 123,48 140,48 C157,48 170,58 170,82 C170,105 162,117 152,123 L140,126 L128,123 C118,117 110,105 110,82 Z'
              : 'M112,84 C112,60 124,50 140,50 C156,50 168,60 168,84 C168,107 155,123 140,124 C125,123 112,107 112,84 Z'
          }
          fill={tone.base}
          stroke={tone.shadow}
          strokeWidth="1"
        />
        <path
          d={
            isMasc
              ? 'M110,82 C110,58 123,48 140,48 C157,48 170,58 170,82 C170,105 162,117 152,123 L140,126 L128,123 C118,117 110,105 110,82 Z'
              : 'M112,84 C112,60 124,50 140,50 C156,50 168,60 168,84 C168,107 155,123 140,124 C125,123 112,107 112,84 Z'
          }
          fill={`url(#${rawUid}_skinShade)`}
        />

        {/* Maçãs do rosto & contorno sutil */}
        <ellipse cx="123" cy="96" rx="7" ry="3.8" fill={tone.blush} opacity={isMasc ? 0.14 : 0.36} />
        <ellipse cx="157" cy="96" rx="7" ry="3.8" fill={tone.blush} opacity={isMasc ? 0.14 : 0.36} />

        {/* Sobrancelhas detalhadas */}
        <path
          d={isMasc ? 'M116,74 Q127,70.5 136,74.5' : 'M119,75 Q127,70.5 134,75'}
          fill="none"
          stroke="#35251E"
          strokeWidth={isMasc ? 2.8 : 1.75}
          strokeLinecap="round"
        />
        <path
          d={isMasc ? 'M144,74.5 Q153,70.5 164,74' : 'M146,75 Q153,70.5 161,75'}
          fill="none"
          stroke="#35251E"
          strokeWidth={isMasc ? 2.8 : 1.75}
          strokeLinecap="round"
        />

        {/* Olhos estilizados padrão Stardoll com íris radial, sombra de pálpebra e piscar realista */}
        <g>
          <g className={enableIdle ? 'avatar-eye-blink' : undefined}>
            <ellipse cx="127" cy="84" rx="6.6" ry={isMasc ? 4 : 4.7} fill="#FFFFFF" stroke={tone.shadow} strokeWidth="0.45" />
            <path d="M120.8,82.5 Q127,79.5 133.2,82.5" fill={tone.shadow} opacity="0.22" />
            <circle cx="127.5" cy="84" r="3.6" fill={`url(#${rawUid}_iris)`} />
            <circle cx="127.5" cy="84" r="1.7" fill="#141210" />
            <circle cx="129.1" cy="82.2" r="1.2" fill="#FFFFFF" />
            <circle cx="126" cy="85.4" r="0.6" fill="#FFFFFF" opacity="0.85" />
            <path d="M119.8,83 Q127,77.8 134.2,83.5" fill="none" stroke="#181513" strokeWidth={isMasc ? 1.65 : 2.15} strokeLinecap="round" />
            {!isMasc && (
              <path d="M120.2,82.4 L118,80 M122.4,80.8 L120.6,78.6 M124.8,79.8 L123.6,77.8" stroke="#181513" strokeWidth="0.95" strokeLinecap="round" />
            )}
          </g>

          <g className={enableIdle ? 'avatar-eye-blink' : undefined}>
            <ellipse cx="153" cy="84" rx="6.6" ry={isMasc ? 4 : 4.7} fill="#FFFFFF" stroke={tone.shadow} strokeWidth="0.45" />
            <path d="M146.8,82.5 Q153,79.5 159.2,82.5" fill={tone.shadow} opacity="0.22" />
            <circle cx="152.5" cy="84" r="3.6" fill={`url(#${rawUid}_iris)`} />
            <circle cx="152.5" cy="84" r="1.7" fill="#141210" />
            <circle cx="154.1" cy="82.2" r="1.2" fill="#FFFFFF" />
            <circle cx="151" cy="85.4" r="0.6" fill="#FFFFFF" opacity="0.85" />
            <path d="M145.8,83.5 Q153,77.8 160.2,83" fill="none" stroke="#181513" strokeWidth={isMasc ? 1.65 : 2.15} strokeLinecap="round" />
            {!isMasc && (
              <path d="M159.8,82.4 L162,80 M157.6,80.8 L159.4,78.6 M155.2,79.8 L156.4,77.8" stroke="#181513" strokeWidth="0.95" strokeLinecap="round" />
            )}
          </g>
        </g>

        {/* Nariz com brilho suave e definição */}
        <line x1="139.6" y1="84" x2="139.8" y2="92" stroke="#FFFFFF" strokeWidth="1" opacity="0.32" strokeLinecap="round" />
        <path d="M139.5,87 Q141.5,93.5 138,96" fill="none" stroke={tone.shadow} strokeWidth="1.25" strokeLinecap="round" />
        <path d="M139,96 Q141.5,97 143,95.5" fill="none" stroke={tone.shadow} strokeWidth="0.85" strokeLinecap="round" opacity="0.7" />

        {/* Lábios detalhados com arco do cupido e brilho gloss */}
        <path
          d={
            isMasc
              ? 'M133,108 Q140,106 147,108 Q144,111.5 140,111.5 Q136,111.5 133,108 Z'
              : 'M132,107 Q136,104.2 140,106.3 Q144,104.2 148,107 Q144,112.6 140,112.6 Q136,112.6 132,107 Z'
          }
          fill={isMasc ? tone.shadow : isNeutral ? '#B96A76' : '#C24B65'}
        />
        <path
          d="M133,107.6 Q140,109.2 147,107.6"
          fill="none"
          stroke={isMasc ? '#683C28' : '#8A243C'}
          strokeWidth="0.8"
        />
        {!isMasc && (
          <ellipse cx="140" cy="110.2" rx="3.2" ry="0.9" fill="#FFFFFF" opacity="0.52" />
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

      {/* 9. Acessórios (z-index 60) */}
      <g data-layer="acessorios">
        {active.acessorios === 'acc_oculos_gatinho' && (
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
        {active.acessorios === 'acc_oculos_aviador' && (
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
        {active.acessorios === 'acc_boina_francesa' && (
          <g transform="rotate(-12 140 52)">
            <ellipse cx="140" cy="48" rx="34" ry="15" fill="#B91C4D" stroke="#881236" strokeWidth="1.2" />
            <path d="M138,33 L142,27" stroke="#881236" strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="140" cy="59" rx="26" ry="4" fill="#881236" />
          </g>
        )}
        {active.acessorios === 'acc_bone_street' && (
          <g>
            <path d="M108,65 C109,42 124,35 140,35 C156,35 171,42 172,65 Z" fill="#201F23" stroke="#111013" strokeWidth="1" />
            <path d="M107,65 Q140,73 185,68 Q162,59 107,65 Z" fill="#171619" />
          </g>
        )}
        {active.acessorios === 'acc_chapeu_fedora' && (
          <g>
            <ellipse cx="140" cy="59" rx="46" ry="8" fill="#C5AB89" stroke="#9B805E" strokeWidth="1.2" />
            <path d="M116,58 L121,36 Q140,32 159,36 L164,58 Z" fill="#C5AB89" stroke="#9B805E" strokeWidth="1.2" />
            <rect x="116.5" y="51" width="47" height="5" fill="#3D2B24" />
          </g>
        )}
        {active.acessorios === 'acc_tiara_perolas' && (
          <g fill="#FFFDF8" stroke="#D6C9B4" strokeWidth="0.7">
            <path d="M110,70 C115,44 165,44 170,70" fill="none" stroke="#DFC496" strokeWidth="2.5" />
            <circle cx="117" cy="56" r="3" />
            <circle cx="127" cy="49" r="3.4" />
            <circle cx="140" cy="47" r="3.8" />
            <circle cx="153" cy="49" r="3.4" />
            <circle cx="163" cy="56" r="3" />
          </g>
        )}
        {active.acessorios === 'acc_colar_perolas' && (
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
        {active.acessorios === 'acc_relogio_couro' && (
          <g>
            <rect x={isMasc ? 186 : 182} y="256" width="11" height="5" rx="1.5" fill="#6D3E24" />
            <circle cx={isMasc ? 191.5 : 187.5} cy="258.5" r="3.5" fill="#D4A853" stroke="#855C33" strokeWidth="0.8" />
          </g>
        )}
        {active.acessorios === 'acc_bolsa_estruturada' && (
          <g>
            <path d="M185,270 C183,254 198,254 198,270" fill="none" stroke="#7B4320" strokeWidth="2.5" />
            <path d="M178,271 L206,271 L210,310 L174,310 Z" fill="#A66134" stroke="#7B4320" strokeWidth="1.2" />
            <rect x="188" y="280" width="8" height="5" rx="1" fill="#D4A853" />
          </g>
        )}
        {active.acessorios === 'acc_coroa_imperial_vip' && (
          <g>
            <polygon points="116,54 121,34 131,45 140,26 149,45 159,34 164,54" fill="#FBBF24" stroke="#B45309" strokeWidth="1.3" />
            <polygon points="140,36 144,43 140,50 136,43" fill="#38BDF8" stroke="#0284C7" strokeWidth="0.7" />
            <circle cx="122" cy="46" r="2.2" fill="#FFFDF8" />
            <circle cx="158" cy="46" r="2.2" fill="#FFFDF8" />
          </g>
        )}
        {active.acessorios === 'acc_coroa_diamante_soberana_vip' && (
          <g>
            <polygon points="114,55 120,30 130,43 140,22 150,43 160,30 166,55" fill="#F8FAFC" stroke="#0284C7" strokeWidth="1.2" />
            <polygon points="140,31 145,41 140,51 135,41" fill="#0EA5E9" stroke="#0369A1" strokeWidth="0.8" />
            <circle cx="122" cy="44" r="2.6" fill="#38BDF8" />
            <circle cx="158" cy="44" r="2.6" fill="#38BDF8" />
            <circle cx="131" cy="49" r="2" fill="#E0F2FE" />
            <circle cx="149" cy="49" r="2" fill="#E0F2FE" />
          </g>
        )}
        {active.acessorios === 'acc_cetro_real_vip' && (
          <g>
            <line x1="186" y1="196" x2="195" y2="338" stroke="#D97706" strokeWidth="3.6" strokeLinecap="round" />
            <circle cx="186" cy="192" r="9" fill="#FBBF24" stroke="#92400E" strokeWidth="1.2" />
            <polygon points="186,181 191,192 186,203 181,192" fill="#E0F2FE" stroke="#0284C7" strokeWidth="0.9" />
            <circle cx="186" cy="192" r="2.4" fill="#FFFFFF" />
          </g>
        )}
        {active.acessorios === 'acc_relogio_ouro_vip' && (
          <g>
            <rect x={isMasc ? 185 : 181} y="255" width="13" height="6" rx="2" fill="#B45309" />
            <circle cx={isMasc ? 191.5 : 187.5} cy="258" r="4.5" fill="#FDE68A" stroke="#D97706" strokeWidth="1.2" />
            <circle cx={isMasc ? 191.5 : 187.5} cy="258" r="1.5" fill="#38BDF8" />
          </g>
        )}
        {active.acessorios === 'acc_bolsa_grife_vip' && (
          <g>
            <path d="M185,268 C182,251 199,251 199,268" fill="none" stroke="#FBBF24" strokeWidth="2.6" />
            <path d="M176,269 L208,269 L212,312 L172,312 Z" fill="#18181B" stroke="#D97706" strokeWidth="1.3" />
            <polygon points="192,282 197,289 192,296 187,289" fill="#38BDF8" stroke="#FBBF24" strokeWidth="0.9" />
          </g>
        )}
        {dynAcc &&
          (dynAcc.customLayerPngUrl ? (
            renderCustomPngLayer(dynAcc)
          ) : dynAcc.templateId === 'tpl_oculos' || dynAcc.templateId === 'acc_oculos_aviador' || dynAcc.templateId === 'acc_oculos_gatinho' ? (
            <g>
              <rect x="114" y="79" width="22" height="12" rx="4" fill="#1C1917" fillOpacity="0.28" stroke={dynAcc.swatchColor} strokeWidth="2.2" />
              <rect x="144" y="79" width="22" height="12" rx="4" fill="#1C1917" fillOpacity="0.28" stroke={dynAcc.swatchColor} strokeWidth="2.2" />
              <line x1="136" y1="84" x2="144" y2="84" stroke={dynAcc.swatchColor} strokeWidth="2" />
            </g>
          ) : dynAcc.templateId === 'tpl_bolsa' || dynAcc.templateId === 'acc_bolsa_estruturada' ? (
            <g>
              <path d="M185,270 C183,254 198,254 198,270" fill="none" stroke={dynAcc.secondaryColor || dynAcc.swatchColor} strokeWidth="2.5" />
              <path d="M178,271 L206,271 L210,310 L174,310 Z" fill={dynAcc.swatchColor} stroke={dynAcc.isVipOnly ? '#D4A853' : '#1C1917'} strokeOpacity="0.7" strokeWidth="1.1" />
              <rect x="188" y="282" width="8" height="5" rx="1" fill={dynAcc.accentColor || '#D4A853'} />
            </g>
          ) : dynAcc.templateId === 'tpl_cetro' ? (
            <g>
              <line x1="186" y1="198" x2="195" y2="334" stroke="#D97706" strokeWidth="3.2" strokeLinecap="round" />
              <circle cx="186" cy="194" r="8" fill={dynAcc.swatchColor} stroke="#92400E" strokeWidth="1.2" />
              <circle cx="186" cy="194" r="2.5" fill="#FFFFFF" />
            </g>
          ) : dynAcc.templateId === 'tpl_coroa' || dynAcc.templateId === 'acc_coroa_imperial_vip' ? (
            <g>
              <polygon points="116,54 121,34 131,45 140,26 149,45 159,34 164,54" fill={dynAcc.swatchColor} stroke="#B45309" strokeWidth="1.2" />
              <circle cx="140" cy="42" r="3" fill={dynAcc.accentColor || '#E0F2FE'} />
            </g>
          ) : dynAcc.templateId === 'tpl_relogio' ? (
            <g>
              <rect x={isMasc ? 185 : 181} y="255" width="13" height="6" rx="2" fill={dynAcc.secondaryColor || '#92400E'} />
              <circle cx={isMasc ? 191.5 : 187.5} cy="258" r="4.2" fill={dynAcc.swatchColor} stroke="#78350F" strokeWidth="1" />
            </g>
          ) : dynAcc.templateId === 'tpl_colar' || dynAcc.templateId === 'acc_colar_perolas' ? (
            <g fill={dynAcc.swatchColor} stroke={dynAcc.accentColor || '#D4A853'} strokeWidth="0.8">
              <path d="M126,142 Q140,158 154,142" fill="none" stroke={dynAcc.swatchColor} strokeWidth="2.4" />
              <circle cx="131" cy="147" r="2.3" />
              <circle cx="140" cy="151" r="3" fill={dynAcc.accentColor || '#FDE68A'} />
              <circle cx="149" cy="147" r="2.3" />
            </g>
          ) : dynAcc.templateId === 'tpl_chapeu' || dynAcc.templateId === 'acc_boina_francesa' || dynAcc.templateId === 'acc_chapeu_fedora' ? (
            <g>
              <ellipse cx="140" cy="59" rx="44" ry="8" fill={dynAcc.swatchColor} stroke={dynAcc.secondaryColor || '#1C1917'} strokeWidth="1.2" />
              <path d="M116,58 L121,36 Q140,32 159,36 L164,58 Z" fill={dynAcc.swatchColor} stroke={dynAcc.secondaryColor || '#1C1917'} strokeWidth="1.2" />
              <rect x="116.5" y="51" width="47" height="5" fill={dynAcc.accentColor || '#3D2B24'} />
            </g>
          ) : (
            <g>
              <path d="M110,66 C115,43 165,43 170,66" fill="none" stroke={dynAcc.swatchColor} strokeWidth="4" />
              {(dynAcc.isVipOnly || dynAcc.accentColor) && (
                <circle cx="140" cy="44" r="4" fill={dynAcc.accentColor || '#FBBF24'} stroke="#B45309" strokeWidth="0.8" />
              )}
            </g>
          ))}
      </g>
      </g>
    </svg>
  );
};
