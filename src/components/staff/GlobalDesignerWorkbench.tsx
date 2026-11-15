import React, { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Layers,
  Palette,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  AvatarGender,
  CATEGORY_LABELS,
  ClothingCategory,
  ClothingItem,
  DesignPattern,
  FurnitureDef,
  FurnitureTemplateId,
  LAYER_Z_INDEX,
  PurchasableRoomItem,
  PurchasableWallpaperItem,
  RoomBackdropTheme,
  RoomThemeCategory,
  SkinToneId,
  UserAccount,
} from '../../types/game';
import { resolveCoreStaffRole } from '../../core/security/RoleGuard';
import { MeDollSvg } from '../svg/MeDollSvg';
import { FurnitureSvg } from '../svg/FurnitureSvg';

interface GlobalDesignerWorkbenchProps {
  currentUser: UserAccount;
  onCreateCustomClothing?: (item: ClothingItem) => void;
  onCreateCustomFurniture?: (furn: FurnitureDef) => void;
  onCreateCustomRoomTemplate?: (roomTpl: PurchasableRoomItem) => void;
  onCreateCustomWallpaper?: (wp: PurchasableWallpaperItem) => void;
}

const CLOTHING_TEMPLATE_OPTIONS: Array<{
  id: string;
  label: string;
  defaultCategory: ClothingCategory;
}> = [
  { id: 'tpl_camisa', label: 'Camisa / Blusa Clássica', defaultCategory: 'blusas' },
  { id: 'tpl_jaqueta', label: 'Jaqueta / Sobretudo', defaultCategory: 'blusas' },
  { id: 'tpl_vestido', label: 'Vestido de Gala / Passarela', defaultCategory: 'vestidos' },
  { id: 'tpl_calca', label: 'Calça Alfaiataria / Jeans', defaultCategory: 'calcas' },
  { id: 'tpl_saia', label: 'Saia Midi / Plissada', defaultCategory: 'calcas' },
  { id: 'tpl_tenis', label: 'Tênis Streetwear', defaultCategory: 'sapatos' },
  { id: 'tpl_bota', label: 'Bota / Salto Atelier', defaultCategory: 'sapatos' },
  { id: 'tpl_cabelo', label: 'Penteado Editorial', defaultCategory: 'cabelo' },
  { id: 'tpl_oculos', label: 'Acessório / Óculos', defaultCategory: 'acessorios' },
  { id: 'tpl_bolsa', label: 'Bolsa Couture', defaultCategory: 'acessorios' },
  { id: 'tpl_coroa', label: 'Coroa / Tiara Real', defaultCategory: 'acessorios' },
];

export const GlobalDesignerWorkbench: React.FC<GlobalDesignerWorkbenchProps> = ({
  currentUser,
  onCreateCustomClothing,
  onCreateCustomFurniture,
  onCreateCustomRoomTemplate,
  onCreateCustomWallpaper,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);

  // 1. Fábrica de Camadas PNG Transparentes + Calibração no Manequim 2D
  const [pieceName, setPieceName] = useState('');
  const [pieceBrand, setPieceBrand] = useState('Atelier Lumière');
  const [pieceCategory, setPieceCategory] = useState<ClothingCategory>('blusas');
  const [pieceGender, setPieceGender] = useState<'feminino' | 'masculino' | 'unissex'>('unissex');
  const [piecePrice, setPiecePrice] = useState(320);
  const [pieceVip, setPieceVip] = useState(false);
  const [pieceTemplateId, setPieceTemplateId] = useState('tpl_camisa');
  const [pieceColor, setPieceColor] = useState('#C8235D');
  const [pieceSecondary, setPieceSecondary] = useState('#1C1917');
  const [pieceAccent, setPieceAccent] = useState('#D4A853');
  const [piecePattern, setPiecePattern] = useState<DesignPattern>('solid');

  // Camada PNG + Sliders X/Y/Escala
  const [pngLayerUrl, setPngLayerUrl] = useState<string>('');
  const [layerOffsetX, setLayerOffsetX] = useState(0);
  const [layerOffsetY, setLayerOffsetY] = useState(0);
  const [layerScale, setLayerScale] = useState(1);

  // Manequim de Teste ao vivo
  const [mannequinGender, setMannequinGender] = useState<AvatarGender>('feminino');
  const [mannequinSkin, setMannequinSkin] = useState<SkinToneId>('porcelana');

  // Clonagem por Foto IA
  const [photoBusy, setPhotoBusy] = useState(false);

  // Estúdio Rápido de Móveis & Sala
  const [furnName, setFurnName] = useState('');
  const [furnTemplate, setFurnTemplate] = useState<FurnitureTemplateId>('tpl_sofa');
  const [furnColor, setFurnColor] = useState('#9E1646');
  const [furnPrice, setFurnPrice] = useState(450);
  const [furnTheme, setFurnTheme] = useState<RoomThemeCategory>('casa');

  const [wpName, setWpName] = useState('');
  const [wpColor1, setWpColor1] = useState('#FAF5EE');
  const [wpColor2, setWpColor2] = useState('#E8D5B7');

  const role = resolveCoreStaffRole(currentUser) || 'designer';

  const previewClothingItem = useMemo<ClothingItem>(
    () => ({
      id: 'designer_workbench_preview',
      name: pieceName.trim() || 'Peça em Calibração',
      brand: pieceBrand.trim() || 'Atelier Global',
      category: pieceCategory,
      price: piecePrice,
      vip: pieceVip,
      isVipOnly: pieceVip,
      swatchColor: pieceColor,
      secondaryColor: pieceSecondary,
      accentColor: pieceAccent,
      pattern: piecePattern,
      gender: pieceGender,
      templateId: pieceTemplateId,
      zIndex: LAYER_Z_INDEX[pieceCategory],
      customLayerPngUrl: pngLayerUrl || undefined,
      layerOffsetX,
      layerOffsetY,
      layerScale,
    }),
    [
      layerOffsetX,
      layerOffsetY,
      layerScale,
      pieceAccent,
      pieceBrand,
      pieceCategory,
      pieceColor,
      pieceGender,
      pieceName,
      piecePattern,
      piecePrice,
      pieceSecondary,
      pieceTemplateId,
      pieceVip,
      pngLayerUrl,
    ],
  );

  const handleUploadPngLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      if (url) {
        setPngLayerUrl(url);
        setFeedback('PNG transparente carregado! Ajuste X, Y e Escala no manequim ao lado.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzePhotoAi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Falha ao ler foto.'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/designer/analyze-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-id': currentUser.id,
          'x-staff-role': role,
          'x-actor-email': currentUser.email,
        },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: file.type || 'image/jpeg',
          targetKind: 'clothing',
          adminEmail: currentUser.email,
          actor_id: currentUser.id,
          role,
          hintName: pieceName.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        design?: {
          name: string;
          brand: string;
          clothingCategory: ClothingCategory;
          gender: 'feminino' | 'masculino' | 'unissex';
          clothingTemplateId: string;
          swatchColor: string;
          secondaryColor: string;
          accentColor: string;
          pattern: DesignPattern;
          suggestedPriceSc: number;
          suggestedVip: boolean;
        };
      };
      if (!json.ok || !json.design) {
        setFeedback(json.error || 'Visão IA indisponível para analisar foto.');
        return;
      }
      setPieceName(json.design.name);
      setPieceBrand(json.design.brand);
      setPieceCategory(json.design.clothingCategory);
      setPieceGender(json.design.gender);
      setPieceTemplateId(json.design.clothingTemplateId);
      setPieceColor(json.design.swatchColor);
      setPieceSecondary(json.design.secondaryColor);
      setPieceAccent(json.design.accentColor);
      setPiecePattern(json.design.pattern);
      setPiecePrice(json.design.suggestedPriceSc);
      setPieceVip(json.design.suggestedVip);
      setFeedback(`Foto clonada com Visão IA: "${json.design.name}" pronta para publicação!`);
    } catch {
      setFeedback('Erro ao conectar ao serviço de análise de foto.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handlePublishClothingZeroDowntime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateCustomClothing) return;
    const finalName = pieceName.trim() || `Criação ${CATEGORY_LABELS[pieceCategory]} #${Date.now().toString().slice(-3)}`;
    const item: ClothingItem = {
      ...previewClothingItem,
      id: `design_layer_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: finalName,
      customCreatedAt: Date.now(),
      createdBy: currentUser.displayName || currentUser.username,
      badge: pngLayerUrl ? 'Camada PNG 2D' : 'Designer Global',
    };
    onCreateCustomClothing(item);
    setFeedback(`"${item.name}" publicada na Starplaza com Zero-Downtime! Todos os jogadores já podem testar.`);
    setPieceName('');
    setPngLayerUrl('');
    setLayerOffsetX(0);
    setLayerOffsetY(0);
    setLayerScale(1);
  };

  const handlePublishFurniture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateCustomFurniture || !furnName.trim()) return;
    onCreateCustomFurniture({
      id: `design_furn_${Date.now()}`,
      name: furnName.trim(),
      category: 'Decoração',
      themeTag: furnTheme,
      width: 170,
      height: 115,
      price: furnPrice,
      defaultZ: 4,
      swatchColor: furnColor,
      secondaryColor: '#27232A',
      accentColor: '#D4A853',
      templateId: furnTemplate,
      description: 'Móvel exclusivo projetado na Bancada Designer Global.',
    });
    setFeedback(`Móvel "${furnName.trim()}" publicado para as Suítes!`);
    setFurnName('');
  };

  const handlePublishWallpaper = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateCustomWallpaper || !wpName.trim()) return;
    onCreateCustomWallpaper({
      id: `design_wp_${Date.now()}`,
      name: wpName.trim(),
      subtitle: 'Papel de parede editorial criado no Estúdio 2D.',
      themeTag: 'geral',
      price: 260,
      wallTopColor: wpColor1,
      wallBottomColor: wpColor2,
      wainscotColor: wpColor2,
      floorTopColor: '#EAE2D7',
      floorBottomColor: '#D6C9B9',
      accentColor: '#D4A853',
      pattern: 'solid',
    });
    setFeedback(`Papel de parede "${wpName.trim()}" publicado!`);
    setWpName('');
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Bancada Designer */}
      <div className="bg-[#3B0764] text-white rounded-xl p-5 border border-[#C084FC]/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#C084FC]/50 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-[#E9D5FF]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold text-white">
                Bancada do Global Designer · Fábrica de Conteúdo 2D
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#E9D5FF] text-[#3B0764] rounded-md">
                Zero-Downtime Sync
              </span>
            </div>
            <p className="text-xs text-purple-100 mt-0.5">
              Upload de PNG transparente com calibração X/Y/Escala no manequim ao vivo e estúdio de móveis e papéis de parede 2D.
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-medium text-purple-900 flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-bold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 1. Workbench PNG Transparente + Manequim 2D ao Vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handlePublishClothingZeroDowntime}
          className="lg:col-span-7 bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
            <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#7C3AED]" />
              Editor de Peça & Camada PNG Transparente
            </h4>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-[#FAF8F5] border border-[#E6E0D8] hover:border-[#7C3AED] rounded-lg cursor-pointer">
              {photoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 text-[#7C3AED]" />}
              Clonar Foto via IA
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void handleAnalyzePhotoAi(e)}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">Nome da Peça</span>
              <input
                type="text"
                required
                value={pieceName}
                onChange={(e) => setPieceName(e.target.value)}
                placeholder="Ex: Jaqueta Holográfica Milão"
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">Grife / Marca</span>
              <input
                type="text"
                value={pieceBrand}
                onChange={(e) => setPieceBrand(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">
                Categoria (Z-Index: {LAYER_Z_INDEX[pieceCategory]})
              </span>
              <select
                value={pieceCategory}
                onChange={(e) => setPieceCategory(e.target.value as ClothingCategory)}
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                {(Object.keys(CATEGORY_LABELS) as ClothingCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]} (Z={LAYER_Z_INDEX[cat]})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">Gênero / Silhueta</span>
              <select
                value={pieceGender}
                onChange={(e) =>
                  setPieceGender(e.target.value as 'feminino' | 'masculino' | 'unissex')
                }
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                <option value="unissex">Unissex</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
              </select>
            </label>
          </div>

          {/* Upload de PNG Transparente & Sliders X/Y/Escala */}
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#7C3AED]" />
                Camada PNG Transparente (Opcional — sobrepõe o vetor)
              </span>
              <div className="flex items-center gap-2">
                <label className="px-3 py-1 text-[11px] font-semibold bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg cursor-pointer">
                  Carregar PNG
                  <input
                    type="file"
                    accept="image/png,image/webp,image/*"
                    onChange={handleUploadPngLayer}
                    className="hidden"
                  />
                </label>
                {pngLayerUrl && (
                  <button
                    type="button"
                    onClick={() => setPngLayerUrl('')}
                    className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Remover PNG
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <label className="block">
                <span className="font-semibold text-[#44403C]">Offset X: {layerOffsetX}px</span>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  value={layerOffsetX}
                  onChange={(e) => setLayerOffsetX(Number(e.target.value))}
                  className="w-full accent-[#7C3AED]"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-[#44403C]">Offset Y: {layerOffsetY}px</span>
                <input
                  type="range"
                  min={-80}
                  max={80}
                  value={layerOffsetY}
                  onChange={(e) => setLayerOffsetY(Number(e.target.value))}
                  className="w-full accent-[#7C3AED]"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-[#44403C]">Escala: {layerScale.toFixed(2)}x</span>
                <input
                  type="range"
                  min={0.5}
                  max={1.6}
                  step={0.05}
                  value={layerScale}
                  onChange={(e) => setLayerScale(Number(e.target.value))}
                  className="w-full accent-[#7C3AED]"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
            <label className="block">
              <span className="text-[11px] font-semibold text-[#44403C]">Cor Principal</span>
              <input
                type="color"
                value={pieceColor}
                onChange={(e) => setPieceColor(e.target.value)}
                className="mt-1 w-full h-8 rounded cursor-pointer"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-[#44403C]">Secundária</span>
              <input
                type="color"
                value={pieceSecondary}
                onChange={(e) => setPieceSecondary(e.target.value)}
                className="mt-1 w-full h-8 rounded cursor-pointer"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-[#44403C]">Preço (AM)</span>
              <input
                type="number"
                min={50}
                max={5000}
                value={piecePrice}
                onChange={(e) => setPiecePrice(Number(e.target.value))}
                className="mt-1 w-full px-2.5 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#44403C] pt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={pieceVip}
                onChange={(e) => setPieceVip(e.target.checked)}
              />
              Peça VIP
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-[#44403C]">Molde Vetorial Base</span>
              <select
                value={pieceTemplateId}
                onChange={(e) => setPieceTemplateId(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                {CLOTHING_TEMPLATE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-[#44403C]">Textura / Padrão</span>
              <select
                value={piecePattern}
                onChange={(e) => setPiecePattern(e.target.value as DesignPattern)}
                className="mt-1 w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                <option value="solid">Liso Acetato</option>
                <option value="striped">Listrado</option>
                <option value="plaid">Xadrez Tweed</option>
                <option value="floral">Floral</option>
                <option value="sequin">Paetê / Brilho</option>
                <option value="denim">Jeans Denim</option>
                <option value="neon">Neon Club</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Publicar na Starplaza (Zero-Downtime)
          </button>
        </form>

        {/* Manequim de Teste 2D ao Vivo */}
        <div className="lg:col-span-5 bg-white border border-[#E6E0D8] rounded-xl p-5 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between pb-2 border-b border-[#EFEAE3]">
            <span className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#7C3AED]" />
              Provador / Manequim 2D ao Vivo
            </span>
            <div className="flex gap-1">
              {(['feminino', 'masculino', 'neutro'] as AvatarGender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setMannequinGender(g)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded border cursor-pointer ${
                    mannequinGender === g
                      ? 'bg-[#1C1917] text-white border-[#1C1917]'
                      : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="my-4 w-52 h-80 bg-[#FAF8F5] rounded-xl border border-[#EFEAE3] flex items-center justify-center p-2">
            <MeDollSvg
              equipped={{ [pieceCategory]: previewClothingItem.id }}
              skinTone={mannequinSkin}
              avatarGender={mannequinGender}
              extraItems={[previewClothingItem]}
              enableIdle={false}
            />
          </div>

          <div className="w-full flex items-center justify-between text-[11px] text-[#6B645D]">
            <span>Pele do manequim:</span>
            <div className="flex gap-1.5">
              {(['porcelana', 'mel', 'bronze', 'ebano'] as SkinToneId[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setMannequinSkin(st)}
                  className={`px-2 py-0.5 rounded border capitalize cursor-pointer ${
                    mannequinSkin === st
                      ? 'border-[#7C3AED] font-bold text-[#1C1917]'
                      : 'border-[#E6E0D8]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Estúdio de Móveis & Papel de Parede + Info Cron Bot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handlePublishFurniture}
          className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3"
        >
          <h4 className="font-display text-base font-bold text-[#1C1917]">
            Estúdio Rápido de Móveis 2D (Suíte)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
            <div className="space-y-2">
              <input
                type="text"
                required
                value={furnName}
                onChange={(e) => setFurnName(e.target.value)}
                placeholder="Nome do móvel..."
                className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
              <select
                value={furnTemplate}
                onChange={(e) => setFurnTemplate(e.target.value as FurnitureTemplateId)}
                className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              >
                <option value="tpl_sofa">Sofá Lounge</option>
                <option value="tpl_cama">Cama King</option>
                <option value="tpl_mesa">Mesa de Centro</option>
                <option value="tpl_dj">Cabine de DJ</option>
                <option value="tpl_lustre">Lustre Cristal</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={furnColor}
                  onChange={(e) => setFurnColor(e.target.value)}
                  className="h-8 w-12 rounded cursor-pointer"
                />
                <input
                  type="number"
                  value={furnPrice}
                  onChange={(e) => setFurnPrice(Number(e.target.value))}
                  className="flex-1 px-2 py-1 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
                />
                <select
                  value={furnTheme}
                  onChange={(e) => setFurnTheme(e.target.value as RoomThemeCategory)}
                  className="px-2 py-1 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
                >
                  <option value="casa">Casa</option>
                  <option value="hotel">Hotel</option>
                  <option value="boate">Boate</option>
                </select>
              </div>
            </div>
            <div className="h-28 rounded-xl bg-[#FAF8F5] border border-[#EFEAE3] flex items-center justify-center p-2">
              <FurnitureSvg
                furnitureId="custom_preview"
                furnitureDef={{
                  id: 'custom_preview',
                  name: furnName || 'Prévia',
                  category: 'Decoração',
                  themeTag: furnTheme,
                  width: 170,
                  height: 115,
                  price: furnPrice,
                  defaultZ: 4,
                  swatchColor: furnColor,
                  secondaryColor: '#27232A',
                  accentColor: '#D4A853',
                  templateId: furnTemplate,
                }}
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg cursor-pointer"
          >
            Publicar Móvel na Starplaza
          </button>
        </form>

        <div className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-4">
          <form onSubmit={handlePublishWallpaper} className="space-y-2.5">
            <h4 className="font-display text-base font-bold text-[#1C1917]">
              Papéis de Parede 2D
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={wpName}
                onChange={(e) => setWpName(e.target.value)}
                placeholder="Nome do papel de parede..."
                className="flex-1 px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
              />
              <input
                type="color"
                value={wpColor1}
                onChange={(e) => setWpColor1(e.target.value)}
                className="h-8 w-10 rounded cursor-pointer"
              />
              <input
                type="color"
                value={wpColor2}
                onChange={(e) => setWpColor2(e.target.value)}
                className="h-8 w-10 rounded cursor-pointer"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-[#7C3AED] text-white rounded-lg cursor-pointer"
              >
                Publicar
              </button>
            </div>
          </form>

          <p className="text-[11px] text-[#57534E]">
            Todas as criações publicadas nesta bancada entram ao vivo na Starplaza sem necessidade de reinício do servidor.
          </p>
        </div>
      </div>
    </div>
  );
};
