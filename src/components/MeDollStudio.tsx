import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Lock,
  RotateCcw,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { resolveItemClass, SKIN_TONES } from '../data/catalog';
import {
  AvatarGender,
  CATEGORY_LABELS,
  ClothingCategory,
  ClothingItem,
  EquippedOutfit,
  ItemGenderStyle,
  SkinToneId,
  AvatarFaceCustomization,
  EyeStyleId,
  EyebrowStyleId,
  NoseStyleId,
  MouthStyleId,
  EYE_COLOR_PALETTE,
  DEFAULT_FACE_CUSTOMIZATION,
} from '../types/game';
import {
  ACCESSORY_SLOT_LABELS,
  getEquippedAccessoriesList,
  isClothingItemEquipped,
  isItemCompatibleWithGender,
} from '../utils/storage';
import { VipBadge } from './StaffDirectory';
import { ThreeClothingThumbnail } from './three/ThreeItemThumbnail';
import { FaceEditor } from './FaceEditor';
import { useThreeScene } from './three/ThreeSceneProvider';
import { disposeObject3D } from '../three/studioEngine';
import { updateAvatarPose, type Avatar3DPose } from '../three/avatar3d';
import {
  animateAvatarCompanions,
  createAvatarAssemblyGroup,
  syncAvatarAssemblyTransforms,
  updateAvatarAssemblyEquipment,
  type AvatarAssemblyGroup,
} from '../three/clothing3d';
import {
  loadBaseAvatarWithFallback,
  type SourceAxisOrientation,
} from '../three/gltfAvatarLoader';

interface MeDollStudioProps {
  catalog: ClothingItem[];
  ownedItemIds: string[];
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  faceCustomization: AvatarFaceCustomization;
  deletedItemIds: string[];
  isAccountVip: boolean;
  genderNotice?: string | null;
  baseGlbUrl?: string;
  sourceOrientation?: SourceAxisOrientation;
  backgroundHex?: string;
  onToggleEquip: (item: ClothingItem) => void;
  onUnequipCategory: (category: ClothingCategory) => void;
  onClearOutfit: () => void;
  onChangeSkinTone: (tone: SkinToneId) => void;
  onChangeAvatarGender: (gender: AvatarGender) => void;
  onChangeFaceCustomization: (fc: AvatarFaceCustomization) => void;
  onGoToShop: () => void;
  onGoToProfile: () => void;
}

const CATEGORIES: Array<'todas' | ClothingCategory> = [
  'todas',
  'cabelo',
  'blusas',
  'casacos',
  'vestidos',
  'calcas',
  'sapatos',
  'acessorios',
];

const ASSEMBLY_SLOT_ORDER: readonly ClothingCategory[] = [
  'cabelo',
  'vestidos',
  'blusas',
  'casacos',
  'calcas',
  'sapatos',
  'acessorios',
];

const GENDER_STYLE_LABEL: Record<ItemGenderStyle, string> = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  unissex: 'Unissex',
};

// Scratch math objects at module scope (zero per-frame allocations)
const _camDesiredTarget = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();

/**
 * Módulo 1: Provador 3D & Guarda-Roupa Organizado da MeDoll.
 * Consome o ThreeSceneProvider centralizado para montar a viewport, injetar o avatar 3D
 * (AvatarAssemblyGroup) e atualizar roupas/cabelo via nós pai-filho.
 */
export const MeDollStudio: React.FC<MeDollStudioProps> = ({
  catalog,
  ownedItemIds,
  equipped,
  skinTone,
  avatarGender,
  faceCustomization,
  deletedItemIds,
  isAccountVip,
  genderNotice,
  baseGlbUrl,
  sourceOrientation,
  backgroundHex = '#F6F1EA',
  onToggleEquip,
  onUnequipCategory,
  onClearOutfit,
  onChangeSkinTone,
  onChangeAvatarGender,
  onChangeFaceCustomization,
  onGoToShop,
  onGoToProfile,
}) => {
  const three = useThreeScene();

  const [selectedCategory, setSelectedCategory] = useState<'todas' | ClothingCategory>('todas');
  const [wardrobeGenderFilter, setWardrobeGenderFilter] = useState<
    'compativel' | 'todos' | ItemGenderStyle
  >('todos');
  const [pose, setPose] = useState<Avatar3DPose>('idle');
  const [camView, setCamView] = useState<'body' | 'face'>('body');
  const [studioTab, setStudioTab] = useState<'guardaroupa' | 'rosto'>('guardaroupa');

  // Container DOM isolado onde o canvas do ThreeSceneProvider é acoplado
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const assemblyRef = useRef<AvatarAssemblyGroup | null>(null);
  const sparkTriggerRef = useRef<(() => void) | null>(null);

  const poseRef = useRef<Avatar3DPose>('idle');
  const camViewRef = useRef<'body' | 'face'>('body');
  const camTransitionActiveRef = useRef<boolean>(false);

  const safeEquipped = useMemo(() => {
    const next: EquippedOutfit = { ...equipped };
    (['cabelo', 'blusas', 'casacos', 'vestidos', 'calcas', 'sapatos', 'acessorios'] as ClothingCategory[]).forEach((cat) => {
      const id = next[cat];
      if (id && deletedItemIds.includes(id)) {
        delete next[cat];
      }
    });
    if (next.acessoriosSlots) {
      const cleanedSlots: NonNullable<EquippedOutfit['acessoriosSlots']> = {};
      (Object.entries(next.acessoriosSlots) as Array<[keyof NonNullable<EquippedOutfit['acessoriosSlots']>, string | undefined]>).forEach(
        ([subSlot, id]) => {
          if (id && !deletedItemIds.includes(id)) {
            cleanedSlots[subSlot] = id;
          }
        },
      );
      if (Object.keys(cleanedSlots).length > 0) {
        next.acessoriosSlots = cleanedSlots;
      } else {
        delete next.acessoriosSlots;
      }
    }
    return next;
  }, [equipped, deletedItemIds]);

  const equippedRef = useRef<EquippedOutfit>(safeEquipped);
  const catalogRef = useRef<ClothingItem[]>(catalog);
  const equippedSnapRef = useRef<string>(JSON.stringify(safeEquipped));

  equippedRef.current = safeEquipped;
  catalogRef.current = catalog;

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  // Acopla a viewport no ThreeSceneProvider e injeta pedestal + partículas de estúdio
  useEffect(() => {
    if (!three.isReady || !stageContainerRef.current) return;

    const unmountViewport = three.mountViewport(stageContainerRef.current, {
      backgroundHex,
      lightingIntensityScale: 1,
      fov: 32,
      near: 0.1,
      far: 30,
      position: [0, 1.15, 3.15],
      target: [0, 0.86, 0],
      enablePan: false,
      minDistance: 0.95,
      maxDistance: 4.8,
      minPolarAngle: 0.35,
      maxPolarAngle: Math.PI * 0.52,
      cursorClassName: 'cursor-grab active:cursor-grabbing',
    });

    // Pedestal discreto de boutique ancorado no chão (y = 0)
    const pedestalGroup = new THREE.Group();
    pedestalGroup.name = 'MeDoll_Pedestal';
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.74, 0.05, 36),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#EBE1D4'),
        roughness: 0.35,
        metalness: 0.08,
        clearcoat: 0.3,
      })
    );
    pedestal.position.y = -0.025;
    pedestal.receiveShadow = true;
    pedestalGroup.add(pedestal);

    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.012, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.85 })
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.002;
    pedestalGroup.add(rimRing);
    three.setEnvironmentProp('medoll-pedestal', pedestalGroup);

    // Sistema de partículas 3D (THREE.Points) ao atualizar nós de roupa/cabelo
    const SPARK_COUNT = 24;
    const sparkPositions = new Float32Array(SPARK_COUNT * 3);
    const sparkVelocities = new Float32Array(SPARK_COUNT * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.045,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    sparkPoints.name = 'MeDoll_Sparks';
    sparkPoints.frustumCulled = false;
    sparkPoints.visible = false;
    three.setEnvironmentProp('medoll-sparks', sparkPoints);

    let sparkLife = 0;
    const triggerSparkBurst = () => {
      sparkLife = 1.0;
      sparkPoints.visible = true;
      for (let i = 0; i < SPARK_COUNT; i++) {
        const angle = (i / SPARK_COUNT) * Math.PI * 2 + Math.random() * 0.3;
        const r = 0.16 + Math.random() * 0.25;
        sparkPositions[i * 3] = Math.cos(angle) * r;
        sparkPositions[i * 3 + 1] = 0.45 + Math.random() * 0.95;
        sparkPositions[i * 3 + 2] = Math.sin(angle) * r;
        sparkVelocities[i * 3] = Math.cos(angle) * (0.25 + Math.random() * 0.35);
        sparkVelocities[i * 3 + 1] = 0.35 + Math.random() * 0.45;
        sparkVelocities[i * 3 + 2] = Math.sin(angle) * (0.25 + Math.random() * 0.35);
      }
      sparkGeo.attributes.position.needsUpdate = true;
    };
    sparkTriggerRef.current = triggerSparkBurst;

    const controls = three.controls;
    const camera = three.camera;
    const handleControlStart = () => {
      camTransitionActiveRef.current = false;
    };
    controls?.addEventListener('start', handleControlStart);

    const unregisterTick = three.registerFrameTick('medoll-studio', (dt, t) => {
      const assembly = assemblyRef.current;

      if (assembly) {
        if (assembly.gltfResult?.mixer) {
          assembly.gltfResult.mixer.update(dt);
        } else if (assembly.proceduralRig) {
          updateAvatarPose(assembly.proceduralRig, poseRef.current, t);
        }
        animateAvatarCompanions(assembly.rootGroup, t);
        syncAvatarAssemblyTransforms(assembly);
      }

      if (sparkLife > 0) {
        sparkLife = Math.max(0, sparkLife - dt * 1.45);
        sparkMat.opacity = sparkLife * 0.9;
        for (let i = 0; i < SPARK_COUNT; i++) {
          sparkPositions[i * 3] += sparkVelocities[i * 3] * dt;
          sparkPositions[i * 3 + 1] += sparkVelocities[i * 3 + 1] * dt;
          sparkPositions[i * 3 + 2] += sparkVelocities[i * 3 + 2] * dt;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        if (sparkLife <= 0) {
          sparkPoints.visible = false;
        }
      }

      if (camTransitionActiveRef.current && controls && camera) {
        const isFace = camViewRef.current === 'face';
        const totalH = assembly ? assembly.metrics.totalHeight : 1.6;
        const headHalfH = assembly ? assembly.metrics.headHalfH : 0.135;
        const targetY = isFace ? totalH - headHalfH * 1.12 : totalH * 0.51;
        const targetDist = isFace ? 1.02 : 2.95;

        _camDesiredTarget.set(0, THREE.MathUtils.damp(controls.target.y, targetY, 6, dt), 0);
        controls.target.set(
          THREE.MathUtils.damp(controls.target.x, _camDesiredTarget.x, 6, dt),
          _camDesiredTarget.y,
          THREE.MathUtils.damp(controls.target.z, _camDesiredTarget.z, 6, dt)
        );

        const curDist = camera.position.distanceTo(controls.target);
        _camDesiredPos
          .copy(camera.position)
          .sub(controls.target)
          .normalize()
          .multiplyScalar(THREE.MathUtils.damp(curDist, targetDist, 5, dt))
          .add(controls.target);
        camera.position.copy(_camDesiredPos);

        if (
          Math.abs(controls.target.y - targetY) < 0.005 &&
          Math.abs(curDist - targetDist) < 0.015
        ) {
          camTransitionActiveRef.current = false;
        }
      }
    });

    return () => {
      sparkTriggerRef.current = null;
      unregisterTick();
      controls?.removeEventListener('start', handleControlStart);
      three.setEnvironmentProp('medoll-pedestal', null);
      three.setEnvironmentProp('medoll-sparks', null);
      unmountViewport();
    };
  }, [three, three.isReady, backgroundHex]);

  // Carrega o modelo 3D base e injeta o AvatarAssemblyGroup no ThreeSceneProvider
  useEffect(() => {
    if (!three.isReady) return;
    let cancelled = false;

    const cleanupCurrentAssembly = () => {
      if (assemblyRef.current) {
        three.removeAvatar('medoll-hero', false);
        assemblyRef.current.dispose();
        assemblyRef.current = null;
      }
    };

    loadBaseAvatarWithFallback({
      gender: avatarGender,
      skinTone,
      faceCustomization,
      url: baseGlbUrl,
      sourceOrientation,
      withShadowDisc: true,
    }).then((loaded) => {
      if (cancelled) {
        loaded.gltfResult?.dispose();
        if (loaded.proceduralRig) disposeObject3D(loaded.proceduralRig.root);
        return;
      }

      cleanupCurrentAssembly();

      const assembly = createAvatarAssemblyGroup(loaded);
      if (assembly.gltfResult?.mixer && assembly.gltfResult.animations[0]) {
        assembly.gltfResult.mixer.clipAction(assembly.gltfResult.animations[0]).play();
      } else if (assembly.proceduralRig) {
        updateAvatarPose(assembly.proceduralRig, poseRef.current, 0);
      }

      three.injectAvatar('medoll-hero', assembly.rootGroup, false);
      assemblyRef.current = assembly;

      updateAvatarAssemblyEquipment(assembly, equippedRef.current, catalogRef.current);
      syncAvatarAssemblyTransforms(assembly);
    });

    return () => {
      cancelled = true;
      cleanupCurrentAssembly();
    };
  }, [three, three.isReady, avatarGender, skinTone, faceCustomization, baseGlbUrl, sourceOrientation]);

  // Atualiza somente os nós filhos (clothingNode e hairNode) quando o look ou catálogo muda
  useEffect(() => {
    const assembly = assemblyRef.current;
    if (!assembly) return;
    updateAvatarAssemblyEquipment(assembly, safeEquipped, catalog);
    syncAvatarAssemblyTransforms(assembly);
    const serialized = JSON.stringify(safeEquipped);
    if (serialized !== equippedSnapRef.current) {
      equippedSnapRef.current = serialized;
      sparkTriggerRef.current?.();
    }
  }, [safeEquipped, catalog]);

  const wardrobeItems = useMemo(() => {
    return catalog.filter((item) => {
      if (!ownedItemIds.includes(item.id) || deletedItemIds.includes(item.id)) {
        return false;
      }
      if (selectedCategory !== 'todas' && item.category !== selectedCategory) {
        return false;
      }
      const itemGender = item.gender ?? item.genderStyle ?? 'unissex';
      if (wardrobeGenderFilter === 'compativel') {
        return isItemCompatibleWithGender(itemGender, avatarGender);
      }
      if (wardrobeGenderFilter !== 'todos' && itemGender !== wardrobeGenderFilter) {
        return false;
      }
      return true;
    });
  }, [
    catalog,
    ownedItemIds,
    deletedItemIds,
    selectedCategory,
    wardrobeGenderFilter,
    avatarGender,
  ]);

  // Peças ativas acopladas aos nós filhos do Three.js Group (incluindo múltiplos acessórios por parte do corpo)
  const equippedSlots = useMemo(() => {
    const entries: Array<{ category: ClothingCategory; slotLabel?: string; item: ClothingItem }> = [];
    ASSEMBLY_SLOT_ORDER.forEach((cat) => {
      if (cat === 'acessorios') {
        const accList = getEquippedAccessoriesList(safeEquipped, catalog);
        accList.forEach(({ slot, item }) => {
          entries.push({
            category: 'acessorios',
            slotLabel: ACCESSORY_SLOT_LABELS[slot],
            item,
          });
        });
        return;
      }
      const itemId = safeEquipped[cat];
      if (!itemId) return;
      const item = catalog.find((c) => c.id === itemId);
      if (item) {
        entries.push({ category: cat, item });
      }
    });
    return entries;
  }, [safeEquipped, catalog]);

  const totalOwnedCount = useMemo(
    () => ownedItemIds.filter((id) => !deletedItemIds.includes(id)).length,
    [ownedItemIds, deletedItemIds]
  );

  const selectCamView = (view: 'body' | 'face') => {
    setCamView(view);
    camViewRef.current = view;
    camTransitionActiveRef.current = true;
  };

  return (
    <div className="space-y-3">
      {genderNotice && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-xl bg-[#FFFBEB] border border-[#FCD34D] text-xs font-medium text-[#92400E]"
        >
          {genderNotice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Coluna Esquerda: Provador 3D com Hierarquia Three.js Group (5 colunas) */}
        <section className="lg:col-span-5 bg-white border border-[#E6E0D8] rounded-xl p-4 sm:p-5 flex flex-col gap-3.5">
          {/* Cabeçalho enxuto */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFEAE3]">
            <div>
              <h3 className="font-display text-xl font-bold text-[#1C1917] tracking-tight">
                Provador MeDoll
              </h3>
              <p className="text-[11px] text-[#6B645D]">
                {equippedSlots.length}{' '}
                {equippedSlots.length === 1 ? 'peça equipada' : 'peças equipadas'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClearOutfit}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#44403C] bg-[#F5F2EC] hover:bg-[#EAE4DA] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar Look
            </button>
          </div>

          {/* Controles compactos de Corpo e Tom de Pele */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div
              className="inline-flex items-center gap-0.5 p-0.5 bg-[#F5F2EC] rounded-lg"
              role="group"
              aria-label="Modelo de corpo da MeDoll"
            >
              {(['feminino', 'masculino', 'neutro'] as AvatarGender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onChangeAvatarGender(g)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    avatarGender === g
                      ? 'bg-white text-[#1C1917] shadow-2xs'
                      : 'text-[#6B645D] hover:text-[#1C1917]'
                  }`}
                >
                  {g === 'feminino' ? 'Feminino' : g === 'masculino' ? 'Masculino' : 'Neutro'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#6B645D] mr-0.5">Pele:</span>
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => onChangeSkinTone(tone.id)}
                  title={tone.label}
                  aria-label={`Selecionar tom de pele ${tone.label}`}
                  className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                    skinTone === tone.id
                      ? 'border-[#C8235D] scale-110 ring-2 ring-[#C8235D]/25'
                      : 'border-[#D6CFC7] hover:scale-105'
                  }`}
                  style={{ backgroundColor: tone.base }}
                />
              ))}
            </div>
          </div>

          {/* Palco 3D Interativo da MeDoll (hospedado pelo ThreeSceneProvider centralizado) */}
          <div className="relative rounded-xl overflow-hidden">
            <div className="relative w-full h-[360px] sm:h-[385px] rounded-2xl overflow-hidden border border-[#E5D7C6] bg-[#F6F1EA] select-none">
              <div ref={stageContainerRef} className="w-full h-full" />

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-1 bg-[#1C1917]/90 text-white rounded-lg p-1 pointer-events-auto border border-white/15 shadow-md">
                  <button
                    type="button"
                    onClick={() => selectCamView('body')}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                      camView === 'body' ? 'bg-[#8B1538] text-white' : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    Corpo 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => selectCamView('face')}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                      camView === 'face' ? 'bg-[#8B1538] text-white' : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    Rosto & Cabelo
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-[#1C1917]/90 text-white rounded-lg p-1 pointer-events-auto border border-white/15 shadow-md">
                  {(['idle', 'runway', 'sit'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPose(p)}
                      className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                        pose === p ? 'bg-amber-600 text-white' : 'text-stone-300 hover:text-white'
                      }`}
                    >
                      {p === 'idle' ? 'Natural' : p === 'runway' ? 'Desfile' : 'Sentado'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Barra Horizontal Compacta com Peças Acopladas nos Nós 3D */}
          <div className="pt-1">
            {equippedSlots.length === 0 ? (
              <p className="text-[11px] text-[#78716C] py-1">
                Nenhuma peça vestida no momento. Clique nas peças do guarda-roupa ao lado.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {equippedSlots.map(({ category, slotLabel, item }) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-[#FAF8F5] border border-[#E6E0D8] text-[11px] text-[#1C1917]"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                      style={{ backgroundColor: item.swatchColor }}
                    />
                    <span className="font-medium max-w-[140px] truncate">
                      {slotLabel ? `${slotLabel}: ` : ''}
                      {item.name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        category === 'acessorios'
                          ? onToggleEquip(item)
                          : onUnequipCategory(category)
                      }
                      title={`Remover ${item.name}`}
                      aria-label={`Remover ${item.name}`}
                      className="p-0.5 text-[#78716C] hover:text-[#C8235D] rounded transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Ações Rápidas no Rodapé */}
          <div className="pt-2.5 border-t border-[#EFEAE3] flex items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={onGoToProfile}
              className="inline-flex items-center gap-1.5 font-semibold text-[#1C1917] hover:text-[#C8235D] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              Meu Perfil / Conta
            </button>
            <button
              type="button"
              onClick={onGoToShop}
              className="inline-flex items-center gap-1.5 font-semibold text-[#C8235D] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Explorar Starplaza
            </button>
          </div>
        </section>

        {/* Coluna Direita: Guarda-Roupa ou Personalização de Rosto (7 colunas) */}
        <aside className="lg:col-span-7 bg-white border border-[#E6E0D8] rounded-xl p-4 sm:p-5 flex flex-col">
          {/* Seletor de Aba Principal: Guarda-Roupa vs Rosto */}
          <div className="flex items-center gap-2 pb-3 mb-3.5 border-b border-[#EFEAE3]">
            <button
              type="button"
              onClick={() => {
                setStudioTab('guardaroupa');
                selectCamView('body');
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                studioTab === 'guardaroupa'
                  ? 'bg-[#1C1917] text-white'
                  : 'bg-[#F5F2EC] text-[#57534E] hover:bg-[#EAE4DA]'
              }`}
            >
              Guarda-Roupa ({wardrobeItems.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStudioTab('rosto');
                selectCamView('face');
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                studioTab === 'rosto'
                  ? 'bg-[#C8235D] text-white'
                  : 'bg-[#F5F2EC] text-[#57534E] hover:bg-[#EAE4DA]'
              }`}
            >
              Rosto & Feições
            </button>
          </div>

          {studioTab === 'rosto' ? (
            <FaceEditor
              faceCustomization={faceCustomization}
              onChangeFaceCustomization={onChangeFaceCustomization}
              avatarGender={avatarGender}
              skinTone={skinTone}
              onResetFace={() => onChangeFaceCustomization(DEFAULT_FACE_CUSTOMIZATION)}
            />
          ) : (
            <>
              <div className="pb-3.5 border-b border-[#EFEAE3] space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-xl font-bold text-[#1C1917]">
                    Guarda-Roupa
                  </h3>
                  <span className="text-xs text-[#6B645D] font-mono-num">
                    {wardrobeItems.length} de {totalOwnedCount} peças
                  </span>
                </div>

                {/* Abas de Categorias em Destaque */}
                <div
                  className="flex flex-wrap gap-1.5"
                  role="tablist"
                  aria-label="Categorias do guarda-roupa"
                >
                  {CATEGORIES.map((cat) => {
                    const isActive = selectedCategory === cat;
                    const label = cat === 'todas' ? 'Tudo' : CATEGORY_LABELS[cat];
                    return (
                      <button
                        key={cat}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isActive
                            ? 'bg-[#1C1917] text-white'
                            : 'bg-[#F5F2EC] text-[#57534E] hover:bg-[#EAE4DA] hover:text-[#1C1917]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Filtro Secundário por Caimento/Gênero */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'todos', label: 'Todos os Estilos' },
                      { id: 'compativel', label: 'Para este Corpo' },
                      { id: 'feminino', label: 'Feminino' },
                      { id: 'masculino', label: 'Masculino' },
                      { id: 'unissex', label: 'Unissex' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setWardrobeGenderFilter(opt.id)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        wardrobeGenderFilter === opt.id
                          ? 'border-[#C8235D] bg-[#FDF2F5] text-[#9E1646]'
                          : 'border-[#E6E0D8] bg-[#FAF8F5] text-[#6B645D] hover:text-[#1C1917]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

          <div className="pt-3.5 max-h-[420px] overflow-y-auto pr-1">
            {wardrobeItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <p className="text-sm font-medium text-[#44403C]">
                  Nenhuma peça nesta categoria ainda.
                </p>
                <p className="text-xs text-[#78716C] mt-1 mb-4">
                  Visite a Starplaza para adquirir novos itens com suas moedas AM.
                </p>
                <button
                  type="button"
                  onClick={onGoToShop}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors cursor-pointer"
                >
                  Ir para a Starplaza
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {wardrobeItems.map((item) => {
                  const isEquipped = isClothingItemEquipped(equipped, item);
                  const itemGender = item.gender ?? item.genderStyle ?? 'unissex';
                  const isCompatible = isItemCompatibleWithGender(itemGender, avatarGender);
                  const isVipLocked = Boolean(item.isVipOnly) && !isAccountVip;
                  const blocked = !isCompatible || isVipLocked;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={blocked && !isEquipped}
                      onClick={() => onToggleEquip(item)}
                      title={
                        isVipLocked
                          ? 'Exclusivo Assinantes VIP'
                          : !isCompatible
                            ? `Peça exclusiva para corpo ${GENDER_STYLE_LABEL[itemGender]}`
                            : undefined
                      }
                      className={`group text-left rounded-xl border p-2.5 transition-all flex flex-col justify-between ${
                        blocked && !isEquipped
                          ? 'border-[#E6E0D8] bg-[#FAF8F5]/60 opacity-60 cursor-not-allowed'
                          : isEquipped
                            ? 'border-[#C8235D] bg-[#C8235D]/[0.04] cursor-pointer'
                            : 'border-[#E6E0D8] bg-[#FAF8F5] hover:border-[#C7BEB2] hover:bg-white cursor-pointer'
                      }`}
                    >
                      <div className="relative flex items-center justify-center h-24 bg-white rounded-lg border border-[#EFEAE3] mb-2 overflow-hidden p-1">
                        <ThreeClothingThumbnail
                          item={item}
                          genderHint={avatarGender}
                          className="w-20 h-20 object-contain transition-transform duration-200 group-hover:scale-105"
                        />
                        {resolveItemClass(item) === 'legendary' ? (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-2xs">
                            Lendário
                          </span>
                        ) : item.isVipOnly ? (
                          <div className="absolute top-1 left-1 flex flex-wrap items-center gap-1">
                            <VipBadge compact />
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-[#1C1917] line-clamp-1">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-[#6B645D] mt-0.5 truncate">
                          {CATEGORY_LABELS[item.category]} · {GENDER_STYLE_LABEL[itemGender]}
                        </p>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-[#EFEAE3] flex items-center justify-between text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            blocked && !isEquipped
                              ? 'text-[#78716C]'
                              : isEquipped
                                ? 'text-[#C8235D]'
                                : 'text-[#44403C]'
                          }`}
                        >
                          {blocked && !isEquipped && <Lock className="w-3 h-3" />}
                          {isVipLocked
                            ? 'VIP'
                            : !isCompatible
                              ? 'Incompatível'
                              : isEquipped
                                ? 'Vestida'
                                : 'Vestir'}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: item.swatchColor }}
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};
