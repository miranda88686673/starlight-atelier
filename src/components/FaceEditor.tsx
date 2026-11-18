import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Sliders,
  BookmarkPlus,
  Trash2,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  AvatarFaceCustomization,
  AvatarGender,
  SkinToneId,
  DEFAULT_FACE_CUSTOMIZATION,
  EYE_COLOR_PALETTE,
  EYEBROW_COLOR_PALETTE,
  LIP_COLOR_PALETTE,
  BUILTIN_FACE_PRESETS,
  FacePreset,
  EyeStyleId,
  EyebrowStyleId,
  NoseStyleId,
  MouthStyleId,
  ColorPaletteOption,
} from '../types/game';
import { getSavedFacePresets, saveFacePreset, deleteFacePreset } from '../utils/storage';

export interface FaceEditorProps {
  faceCustomization: AvatarFaceCustomization;
  onChangeFaceCustomization: (fc: AvatarFaceCustomization) => void;
  avatarGender: AvatarGender;
  skinTone: SkinToneId;
  onResetFace?: () => void;
}

type FaceSubTab = 'olhos' | 'sobrancelhas' | 'nariz' | 'boca' | 'presets';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
  isScale?: boolean;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  unit = '',
  isScale = false,
  onChange,
}) => {
  const isDefault = Math.abs(value - defaultValue) < 0.001;
  const displayVal = isScale
    ? `${value.toFixed(2)}x`
    : `${value > 0 ? '+' : ''}${value}${unit}`;

  return (
    <div className="space-y-1.5 p-2.5 rounded-lg bg-[#FAF8F5] border border-[#EFEAE3]">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#44403C]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-[#1C1917] tabular-nums">
            {displayVal}
          </span>
          {!isDefault && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              title="Restaurar valor padrão"
              className="text-[10px] text-[#78716C] hover:text-[#C8235D] transition-colors cursor-pointer"
            >
              Resetar
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-[#E6E0D8] rounded-lg appearance-none cursor-pointer accent-[#C8235D]"
      />
    </div>
  );
};

export const FaceEditor: React.FC<FaceEditorProps> = ({
  faceCustomization,
  onChangeFaceCustomization,
  avatarGender,
  skinTone: _skinTone,
  onResetFace,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<FaceSubTab>('olhos');
  const [customPresets, setCustomPresets] = useState<FacePreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setCustomPresets(getSavedFacePresets());
  }, []);

  const update = (partial: Partial<AvatarFaceCustomization>) => {
    onChangeFaceCustomization({
      ...faceCustomization,
      ...partial,
    });
  };

  const handleSaveCurrentAsPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPresetName.trim();
    if (!name) return;

    const newPreset: FacePreset = {
      id: `custom_face_${Date.now()}`,
      name,
      description: `Rosto personalizado criado para modelo ${avatarGender}`,
      isBuiltIn: false,
      config: { ...faceCustomization },
      createdAt: new Date().toLocaleDateString('pt-BR'),
    };

    const updatedList = saveFacePreset(newPreset);
    setCustomPresets(updatedList);
    setNewPresetName('');
    setSaveSuccessMsg(`Preset "${name}" salvo com sucesso!`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleDeleteCustomPreset = (presetId: string) => {
    const updated = deleteFacePreset(presetId);
    setCustomPresets(updated);
  };

  const handleApplyPreset = (preset: FacePreset) => {
    onChangeFaceCustomization({
      ...DEFAULT_FACE_CUSTOMIZATION,
      ...preset.config,
    });
  };

  // Cores ativas
  const currentEyeColor = faceCustomization.eyeColor || '#92400E';
  const currentBrowColor = faceCustomization.eyebrowColor || '#2A1D17';
  const currentLipColor = faceCustomization.mouthColor || '#C65B6F';

  return (
    <div className="space-y-4">
      {/* Barra de Sub-abas com design anti-slop */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#EFEAE3]">
        <div
          className="inline-flex items-center gap-1 p-1 bg-[#F5F2EC] rounded-xl overflow-x-auto max-w-full"
          role="tablist"
          aria-label="Controles do FaceEditor"
        >
          {(
            [
              { id: 'olhos', label: 'Olhos' },
              { id: 'sobrancelhas', label: 'Sobrancelhas' },
              { id: 'nariz', label: 'Nariz' },
              { id: 'boca', label: 'Boca' },
              { id: 'presets', label: 'FacePresets' },
            ] as const
          ).map((t) => {
            const isActive = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveSubTab(t.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#1C1917] shadow-2xs'
                    : 'text-[#6B645D] hover:text-[#1C1917]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            if (onResetFace) onResetFace();
            else onChangeFaceCustomization(DEFAULT_FACE_CUSTOMIZATION);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#78716C] hover:text-[#C8235D] hover:bg-[#FDF2F5] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar Padrão
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ABA: OLHOS                                                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'olhos' && (
        <div className="space-y-4">
          {/* Estilo do Olho */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1C1917]">Formato dos Olhos</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'amendoado', label: 'Amendoado', desc: 'Clássico & expressivo' },
                  { id: 'grande', label: 'Grande', desc: 'Aberto & luminoso' },
                  { id: 'marcado', label: 'Marcado', desc: 'Delineado intenso' },
                  { id: 'suave', label: 'Suave', desc: 'Curvatura delicada' },
                ] as const
              ).map((opt) => {
                const isSelected = faceCustomization.eyeStyle === opt.id;
                const dPath =
                  opt.id === 'grande'
                    ? 'M4,12 Q18,2 32,12 Q18,22 4,12 Z'
                    : opt.id === 'marcado'
                      ? 'M3,12.5 Q18,4.5 33,12 Q18,19 3,12.5 Z'
                      : opt.id === 'suave'
                        ? 'M5,12.5 Q18,7 31,12.5 Q18,17.5 5,12.5 Z'
                        : 'M4,12 Q18,5 32,12.5 Q18,19 4,12 Z';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update({ eyeStyle: opt.id as EyeStyleId })}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#C8235D] bg-[#FDF2F5] text-[#9E1646] ring-1 ring-[#C8235D]'
                        : 'border-[#E6E0D8] bg-[#FAF8F5] text-[#44403C] hover:border-[#C7BEB2] hover:bg-white'
                    }`}
                  >
                    <svg viewBox="0 0 36 24" className="w-10 h-6 mb-1.5" aria-hidden="true">
                      <path d={dPath} fill="#FFFFFF" stroke="#1C1917" strokeWidth="1.2" />
                      <circle cx="18" cy="12.2" r={opt.id === 'grande' ? 5.2 : 4.2} fill={currentEyeColor} />
                      <circle cx="18" cy="12.2" r="2" fill="#141210" />
                      <circle cx="19.6" cy="10.4" r="1.2" fill="#FFFFFF" />
                      {opt.id === 'marcado' && (
                        <path d="M2,11.5 Q18,3.8 34,11.5" fill="none" stroke="#181412" strokeWidth="2.4" />
                      )}
                    </svg>
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[10px] text-[#78716C] mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paleta de Cores dos Olhos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1C1917]">Cor da Íris</label>
              <span className="text-[11px] text-[#78716C]">
                {EYE_COLOR_PALETTE.find((c) => c.hex.toLowerCase() === currentEyeColor.toLowerCase())?.label || 'Customizada'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {EYE_COLOR_PALETTE.map((c: ColorPaletteOption) => {
                const isSelected = currentEyeColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => update({ eyeColor: c.hex })}
                    title={c.label}
                    className={`relative w-7 h-7 rounded-full border transition-transform cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'border-[#C8235D] scale-110 ring-2 ring-[#C8235D]/30'
                        : 'border-black/15 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-sm" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seletores Deslizantes dos Olhos */}
          <div className="space-y-2 pt-2 border-t border-[#EFEAE3]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
              <Sliders className="w-3.5 h-3.5 text-[#C8235D]" />
              <span>Ajustes de Posição & Proporção dos Olhos</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <SliderRow
                label="Espaçamento (X)"
                value={faceCustomization.eyesPosX ?? 0}
                min={-12}
                max={12}
                step={1}
                defaultValue={0}
                onChange={(val) => update({ eyesPosX: val })}
              />
              <SliderRow
                label="Altura Vertical (Y)"
                value={faceCustomization.eyesPosY ?? 0}
                min={-12}
                max={12}
                step={1}
                defaultValue={0}
                onChange={(val) => update({ eyesPosY: val })}
              />
              <SliderRow
                label="Escala dos Olhos"
                value={faceCustomization.eyesScale ?? 1.0}
                min={0.7}
                max={1.4}
                step={0.05}
                defaultValue={1.0}
                isScale
                onChange={(val) => update({ eyesScale: val })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA: SOBRANCELHAS                                                         */}
      {/* ========================================================================= */}
      {activeSubTab === 'sobrancelhas' && (
        <div className="space-y-4">
          {/* Estilo da Sobrancelha */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1C1917]">Formato das Sobrancelhas</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'fina', label: 'Fina', desc: 'Traço elegante & limpo' },
                  { id: 'arqueada', label: 'Arqueada', desc: 'Arco alto expressivo' },
                  { id: 'reta', label: 'Reta', desc: 'Estilo moderno contemporâneo' },
                  { id: 'grossa', label: 'Grossa', desc: 'Volume natural marcante' },
                ] as const
              ).map((opt) => {
                const isSelected = faceCustomization.eyebrowStyle === opt.id;
                const dPath =
                  opt.id === 'reta'
                    ? 'M4,12 L32,10.5'
                    : opt.id === 'fina'
                      ? 'M5,14 Q18,7.5 31,13'
                      : opt.id === 'grossa'
                        ? 'M4,14.5 Q18,5.5 32,13'
                        : 'M5,14 Q18,6 31,12.5';
                const sw = opt.id === 'fina' ? 1.8 : opt.id === 'grossa' ? 4.4 : 2.8;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update({ eyebrowStyle: opt.id as EyebrowStyleId })}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#C8235D] bg-[#FDF2F5] text-[#9E1646] ring-1 ring-[#C8235D]'
                        : 'border-[#E6E0D8] bg-[#FAF8F5] text-[#44403C] hover:border-[#C7BEB2] hover:bg-white'
                    }`}
                  >
                    <svg viewBox="0 0 36 20" className="w-10 h-5 mb-1.5" aria-hidden="true">
                      <path d={dPath} fill="none" stroke={currentBrowColor} strokeWidth={sw} strokeLinecap="round" />
                    </svg>
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[10px] text-[#78716C] mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paleta de Cores das Sobrancelhas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1C1917]">Tom da Sobrancelha</label>
              <span className="text-[11px] text-[#78716C]">
                {EYEBROW_COLOR_PALETTE.find((c) => c.hex.toLowerCase() === currentBrowColor.toLowerCase())?.label || 'Customizada'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {EYEBROW_COLOR_PALETTE.map((c: ColorPaletteOption) => {
                const isSelected = currentBrowColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => update({ eyebrowColor: c.hex })}
                    title={c.label}
                    className={`relative w-7 h-7 rounded-full border transition-transform cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'border-[#C8235D] scale-110 ring-2 ring-[#C8235D]/30'
                        : 'border-black/15 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-sm" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seletores Deslizantes das Sobrancelhas */}
          <div className="space-y-2 pt-2 border-t border-[#EFEAE3]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
              <Sliders className="w-3.5 h-3.5 text-[#C8235D]" />
              <span>Ajustes de Posição & Proporção das Sobrancelhas</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <SliderRow
                label="Espaçamento (X)"
                value={faceCustomization.eyebrowsPosX ?? 0}
                min={-12}
                max={12}
                step={1}
                defaultValue={0}
                onChange={(val) => update({ eyebrowsPosX: val })}
              />
              <SliderRow
                label="Altura Vertical (Y)"
                value={faceCustomization.eyebrowsPosY ?? 0}
                min={-12}
                max={12}
                step={1}
                defaultValue={0}
                onChange={(val) => update({ eyebrowsPosY: val })}
              />
              <SliderRow
                label="Escala & Volume"
                value={faceCustomization.eyebrowsScale ?? 1.0}
                min={0.7}
                max={1.4}
                step={0.05}
                defaultValue={1.0}
                isScale
                onChange={(val) => update({ eyebrowsScale: val })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA: NARIZ                                                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'nariz' && (
        <div className="space-y-4">
          {/* Estilo do Nariz */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1C1917]">Modelo Anatômico do Nariz</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'fino', label: 'Fino', desc: 'Dorso afilado natural' },
                  { id: 'reto', label: 'Reto', desc: 'Ponte estruturada' },
                  { id: 'delicado', label: 'Delicado', desc: 'Ponta empinada sutil' },
                  { id: 'arredondado', label: 'Arredondado', desc: 'Curvatura suave e macia' },
                ] as const
              ).map((opt) => {
                const isSelected = faceCustomization.noseStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update({ noseStyle: opt.id as NoseStyleId })}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#C8235D] bg-[#FDF2F5] text-[#9E1646] ring-1 ring-[#C8235D]'
                        : 'border-[#E6E0D8] bg-[#FAF8F5] text-[#44403C] hover:border-[#C7BEB2] hover:bg-white'
                    }`}
                  >
                    <svg viewBox="0 0 28 24" className="w-8 h-6 mb-1.5" aria-hidden="true">
                      {opt.id === 'reto' ? (
                        <path d="M14,4 L14.5,17 M11,18.5 L17,18.5" fill="none" stroke="#44403C" strokeWidth="1.6" strokeLinecap="round" />
                      ) : opt.id === 'delicado' ? (
                        <path d="M14.2,7 Q15,13 13,16.5 M11.8,17 Q14,18.4 16.2,17" fill="none" stroke="#44403C" strokeWidth="1.4" strokeLinecap="round" />
                      ) : opt.id === 'arredondado' ? (
                        <path d="M13,5 Q17.5,13.5 11.5,17.5 M9.5,16.8 Q14,20.5 18.5,16.8" fill="none" stroke="#44403C" strokeWidth="1.6" strokeLinecap="round" />
                      ) : (
                        <path d="M13.6,5 Q16.2,13.5 12,17 M11.5,17.5 Q14,19 16.5,17.5" fill="none" stroke="#44403C" strokeWidth="1.5" strokeLinecap="round" />
                      )}
                    </svg>
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[10px] text-[#78716C] mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seletores Deslizantes do Nariz */}
          <div className="space-y-2 pt-2 border-t border-[#EFEAE3]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
              <Sliders className="w-3.5 h-3.5 text-[#C8235D]" />
              <span>Ajustes de Posição & Escala do Nariz</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <SliderRow
                label="Centralização (X)"
                value={faceCustomization.nosePosX ?? 0}
                min={-10}
                max={10}
                step={1}
                defaultValue={0}
                onChange={(val) => update({ nosePosX: val })}
              />
              <SliderRow
                label="Altura Vertical (Y)"
                value={faceCustomization.nosePosY ?? 0}
                min={-12}
                max={12}
                step={1}
                defaultValue={0}
                onChange={(val) => update({ nosePosY: val })}
              />
              <SliderRow
                label="Escala do Nariz"
                value={faceCustomization.noseScale ?? 1.0}
                min={0.7}
                max={1.4}
                step={0.05}
                defaultValue={1.0}
                isScale
                onChange={(val) => update({ noseScale: val })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA: BOCA & LÁBIOS                                                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'boca' && (
        <div className="space-y-4">
          {/* Estilo dos Lábios */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1C1917]">Formato da Boca</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'cupido', label: 'Arco do Cupido', desc: 'Superior delineado clássico' },
                  { id: 'natural', label: 'Natural', desc: 'Boca suave relaxada' },
                  { id: 'cheia', label: 'Cheia', desc: 'Volume labial sensual' },
                  { id: 'delicada', label: 'Delicada', desc: 'Lábios compactos finos' },
                ] as const
              ).map((opt) => {
                const isSelected = faceCustomization.mouthStyle === opt.id;
                const mPath =
                  opt.id === 'cheia'
                    ? 'M5,11 Q11,5 18,8.5 Q25,5 31,11 Q25,20 18,20 Q11,20 5,11 Z'
                    : opt.id === 'delicada'
                      ? 'M9,12 Q13.5,8.5 18,10.5 Q22.5,8.5 27,12 Q22.5,16.5 18,16.5 Q13.5,16.5 9,12 Z'
                      : opt.id === 'natural'
                        ? 'M6,11.5 Q18,8 30,11.5 Q24,17.5 18,17.5 Q12,17.5 6,11.5 Z'
                        : 'M6,11 Q12,6.5 18,9.5 Q24,6.5 30,11 Q24,18.5 18,18.5 Q12,18.5 6,11 Z';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update({ mouthStyle: opt.id as MouthStyleId })}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#C8235D] bg-[#FDF2F5] text-[#9E1646] ring-1 ring-[#C8235D]'
                        : 'border-[#E6E0D8] bg-[#FAF8F5] text-[#44403C] hover:border-[#C7BEB2] hover:bg-white'
                    }`}
                  >
                    <svg viewBox="0 0 36 22" className="w-10 h-6 mb-1.5" aria-hidden="true">
                      <path d={mPath} fill={currentLipColor} stroke="#1C1917" strokeWidth="1" />
                      <path d="M7.5,11.5 Q18,13.5 28.5,11.5" fill="none" stroke="#1C1917" strokeWidth="1" opacity="0.7" />
                    </svg>
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[10px] text-[#78716C] mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paleta de Cores dos Lábios (Batom / Gloss) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1C1917]">Tom dos Lábios (Batom)</label>
              <span className="text-[11px] text-[#78716C]">
                {LIP_COLOR_PALETTE.find((c) => c.hex.toLowerCase() === currentLipColor.toLowerCase())?.label || 'Customizada'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {LIP_COLOR_PALETTE.map((c: ColorPaletteOption) => {
                const isSelected = currentLipColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => update({ mouthColor: c.hex })}
                    title={c.label}
                    className={`relative w-7 h-7 rounded-full border transition-transform cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'border-[#C8235D] scale-110 ring-2 ring-[#C8235D]/30'
                        : 'border-black/15 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-sm" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seletores Deslizantes da Boca */}
          <div className="space-y-2 pt-2 border-t border-[#EFEAE3]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
              <Sliders className="w-3.5 h-3.5 text-[#C8235D]" />
              <span>Ajustes de Posição & Escala dos Lábios</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <SliderRow
                label="Centralização (X)"
                value={faceCustomization.mouthPosX ?? 0}
                min={-10}
                max={10}
                step={1}
                defaultValue={0}
                onChange={(val) => update({ mouthPosX: val })}
              />
              <SliderRow
                label="Altura Vertical (Y)"
                value={faceCustomization.mouthPosY ?? 0}
                min={-12}
                max={12}
                step={1}
                defaultValue={0}
                onChange={(val) => update({ mouthPosY: val })}
              />
              <SliderRow
                label="Volume & Escala"
                value={faceCustomization.mouthScale ?? 1.0}
                min={0.7}
                max={1.4}
                step={0.05}
                defaultValue={1.0}
                isScale
                onChange={(val) => update({ mouthScale: val })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA: FACE PRESETS (SUB-TAB)                                               */}
      {/* ========================================================================= */}
      {activeSubTab === 'presets' && (
        <div className="space-y-4">
          {/* Caixa para Salvar Rosto Atual como Novo Preset */}
          <form
            onSubmit={handleSaveCurrentAsPreset}
            className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] space-y-2.5"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-[#1C1917]">
              <BookmarkPlus className="w-4 h-4 text-[#C8235D]" />
              <span>Salvar Rosto Atual como FacePreset</span>
            </div>
            <p className="text-[11px] text-[#6B645D]">
              Guarde a posição exata, formato e paletas atuais de olhos, sobrancelhas, nariz e boca para reutilizar a qualquer momento.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ex: Glamour Noite, Boneca Delicada..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                maxLength={30}
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#D6CFC7] rounded-lg focus:outline-none focus:border-[#C8235D]"
              />
              <button
                type="submit"
                disabled={!newPresetName.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Salvar Preset
              </button>
            </div>
            {saveSuccessMsg && (
              <p className="text-[11px] font-semibold text-[#065F46]">{saveSuccessMsg}</p>
            )}
          </form>

          {/* Presets Personalizados do Jogador */}
          {customPresets.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#1C1917]">Meus Presets Salvos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {customPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-3 rounded-xl bg-white border border-[#E6E0D8] flex flex-col justify-between gap-2.5 shadow-2xs hover:border-[#C7BEB2] transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-[#1C1917] truncate">{preset.name}</p>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomPreset(preset.id)}
                          title="Excluir preset"
                          className="p-1 text-[#78716C] hover:text-[#DC2626] rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {preset.createdAt && (
                        <p className="text-[10px] text-[#78716C]">Criado em {preset.createdAt}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#EFEAE3]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-black/15 shadow-2xs"
                          style={{ backgroundColor: preset.config.eyeColor }}
                          title="Cor dos olhos"
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-black/15 shadow-2xs"
                          style={{ backgroundColor: preset.config.mouthColor || '#C65B6F' }}
                          title="Cor dos lábios"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#C8235D] rounded-lg transition-colors cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Presets Oficiais de Fábrica */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C8235D]" />
              <h4 className="text-xs font-bold text-[#1C1917]">Coleção de Presets Oficiais</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BUILTIN_FACE_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="p-3 rounded-xl bg-white border border-[#E6E0D8] flex flex-col justify-between gap-2.5 shadow-2xs hover:border-[#C7BEB2] transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-[#1C1917]">{preset.name}</p>
                      <span className="text-[10px] text-[#8B1538] font-medium bg-[#FDF2F5] px-1.5 py-0.5 rounded">
                        Oficial
                      </span>
                    </div>
                    {preset.description && (
                      <p className="text-[10px] text-[#6B645D] mt-1 line-clamp-2">
                        {preset.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#EFEAE3]">
                    <div className="flex items-center gap-1.5 text-[10px] text-[#78716C]">
                      <span
                        className="w-3 h-3 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: preset.config.eyeColor }}
                        title="Cor dos olhos"
                      />
                      <span
                        className="w-3 h-3 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: preset.config.mouthColor || '#C65B6F' }}
                        title="Cor dos lábios"
                      />
                      <span className="ml-1 capitalize">{preset.config.eyeStyle}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#C8235D] rounded-lg transition-colors cursor-pointer"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
