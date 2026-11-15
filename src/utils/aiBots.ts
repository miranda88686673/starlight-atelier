import { GLOBAL_ROOMS, NEWS_PHOTO_ASSETS } from '../data/catalog';
import {
  AiMaintenanceLogEntry,
  BotAiSpecialty,
  ClothingCategory,
  ClothingItem,
  EquippedOutfit,
  FurnitureDef,
  ItemGenderStyle,
  LAYER_Z_INDEX,
  NewsCategory,
  PlayerProgressState,
  RoomAvatarPresence,
  RoomChatMessage,
  RoomDef,
  RoomReportEntry,
  ServerRegion,
  UserAccount,
  WorldModerationState,
} from '../types/game';
import {
  ADMIN_OWNER_EMAIL,
  ACCOUNTS_KEY,
  PLAYER_PREFIX,
  WORLD_KEY,
  addCustomClothingToWorld,
  addCustomFurnitureToWorld,
  getFullClothingCatalog,
  getFullFurnitureCatalog,
  isItemCompatibleWithGender,
  isVipAccount,
  loadAccounts,
  loadPlayerProgress,
  loadWorldState,
  normalizeUsername,
  publishNewsPostToWorld,
  savePlayerProgress,
  saveWorldState,
} from './storage';
import { SharedRoomsSnapshot } from './realtime';

export const DESIGNER_CREATION_INTERVAL_MS = 2 * 60 * 60 * 1000;
export const WEEKLY_VIP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export const AI_LOGS_KEY = 'starlight_atelier_ai_logs_v1';
const CORRUPTED_CACHE_KEY = 'starlight_atelier_corrupted_cache';
const ROOMS_STORAGE_KEY = 'starlight_atelier_rooms_v1';
const REALTIME_CHANNEL_NAME = 'starlight_atelier_realtime_v1';

export const BOT_SPECIALTY_META: Record<
  BotAiSpecialty,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
  }
> = {
  maintenance: {
    label: 'Engenheiro de Manutenção & Auto-Reparo',
    shortLabel: 'IA Manutenção',
    description:
      'Monitora localStorage, corrige itens duplicados, destrava avatares e estabiliza salas automaticamente.',
    badgeClass: 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]',
  },
  moderation: {
    label: 'Sentinela de Moderação & Disciplina',
    shortLabel: 'IA Sentinela',
    description:
      'Vigia o chat com punição progressiva (advertência, mute de 5 min e banimento), atende /report e audita vestuários.',
    badgeClass: 'bg-[#FCE8EF] text-[#9E1646] border-[#F4C4D5]',
  },
  hybrid: {
    label: 'Híbrido Completo (Manutenção + Comunidade)',
    shortLabel: 'IA Híbrida',
    description:
      'Executa auto-reparo técnico em salas/suítes, responde dúvidas de jogadores e organiza eventos sociais.',
    badgeClass: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
  },
  designer: {
    label: 'Designer Global (Moda, Móveis & Salas)',
    shortLabel: 'IA Designer',
    description:
      'Cria coleções de roupas inspiradas em tendências reais, novos móveis para a Suíte e salas temáticas públicas.',
    badgeClass: 'bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]',
  },
};

/** Dicionário multilíngue de ofensas, golpes e termos proibidos por servidor regional */
const SERVER_PROFANITY_PATTERNS: Record<ServerRegion, string[]> = {
  BR: [
    'palavrao',
    'ofensa',
    'golpe',
    'idiota',
    'burro',
    'otario',
    'lixo',
    'trouxa',
    'fdp',
    'desgraca',
    'merda',
    'porra',
    'caralho',
    'arrombado',
    'vagabundo',
    'piranha',
    'imbecil',
  ],
  ES: [
    'insulto',
    'estafa',
    'idiota',
    'tonto',
    'basura',
    'imbecil',
    'estupido',
    'mierda',
    'puta',
    'pendejo',
    'cabron',
    'gilipollas',
    'maldito',
  ],
  EN: [
    'scam',
    'hack',
    'idiot',
    'stupid',
    'trash',
    'loser',
    'moron',
    'dumb',
    'asshole',
    'bitch',
    'fuck',
    'shit',
    'bullshit',
    'bastard',
  ],
};

/** Termos graves que resultam em banimento imediato sem etapas prévias */
const SEVERE_PROFANITY_TERMS = new Set([
  'golpe',
  'scam',
  'hack',
  'estafa',
  'fdp',
  'caralho',
  'porra',
  'arrombado',
  'puta',
  'cabron',
  'gilipollas',
  'asshole',
  'bitch',
  'fuck',
]);

function stripAccents(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function broadcastAiLogsSync(): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(REALTIME_CHANNEL_NAME);
    ch.postMessage({ type: 'ai_logs:sync' });
    ch.close();
  } catch {
    // Silencioso
  }
}

function broadcastRoomsSync(snapshot: SharedRoomsSnapshot): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(REALTIME_CHANNEL_NAME);
    ch.postMessage({ type: 'rooms:sync', snapshot });
    ch.close();
  } catch {
    // Silencioso
  }
}

export function loadAiLogs(): AiMaintenanceLogEntry[] {
  try {
    const raw = window.localStorage.getItem(AI_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AiMaintenanceLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendAiLog(
  entry: Omit<AiMaintenanceLogEntry, 'id' | 'timestamp'>,
): AiMaintenanceLogEntry[] {
  const current = loadAiLogs();
  const nextEntry: AiMaintenanceLogEntry = {
    ...entry,
    id: `ailog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  const updated = [nextEntry, ...current].slice(0, 80);
  try {
    window.localStorage.setItem(AI_LOGS_KEY, JSON.stringify(updated));
  } catch {
    // Silencioso
  }
  broadcastAiLogsSync();
  return updated;
}

export function clearAiLogs(): AiMaintenanceLogEntry[] {
  try {
    window.localStorage.setItem(AI_LOGS_KEY, JSON.stringify([]));
  } catch {
    // Silencioso
  }
  broadcastAiLogsSync();
  return [];
}

/** Retorna todos os bots técnicos/engenheiros ativos (Manutenção, Híbrido ou Gerentes da Comunidade) */
export function getTechnicalAiBots(accounts: UserAccount[] = loadAccounts()): UserAccount[] {
  return accounts.filter(
    (acc) =>
      acc.isBot &&
      acc.botActive !== false &&
      (acc.botAiSpecialty === 'maintenance' ||
        acc.botAiSpecialty === 'hybrid' ||
        acc.staffRoleTier?.startsWith('cm_') ||
        !acc.botAiSpecialty),
  );
}

/** Retorna o Bot Sentinela ativo responsável pelo servidor informado (Moderação ou Híbrido) */
export function getSentinelAiBotForServer(
  server: ServerRegion,
  accounts: UserAccount[] = loadAccounts(),
): UserAccount | null {
  const activeSentinels = accounts.filter(
    (acc) =>
      acc.isBot &&
      acc.botActive !== false &&
      (acc.botAiSpecialty === 'moderation' ||
        acc.botAiSpecialty === 'hybrid' ||
        !acc.botAiSpecialty) &&
      !acc.staffRoleTier?.startsWith('cm_') &&
      acc.staffRoleTier !== 'designer_global',
  );

  const exactServerBot = activeSentinels.find(
    (acc) =>
      acc.serverRegion === server ||
      (server === 'BR' && acc.staffRoleTier === 'mod_br') ||
      (server === 'ES' && acc.staffRoleTier === 'mod_es') ||
      (server === 'EN' && acc.staffRoleTier === 'mod_en'),
  );
  if (exactServerBot) return exactServerBot;

  return activeSentinels.find((acc) => acc.staffRoleTier === 'admin') ?? null;
}

/** Retorna um Bot Gerente da Comunidade ativo para o servidor informado */
export function getCommunityManagerBotForServer(
  server: ServerRegion,
  accounts: UserAccount[] = loadAccounts(),
): UserAccount | null {
  return (
    accounts.find(
      (acc) =>
        acc.isBot &&
        acc.botActive !== false &&
        (acc.staffRoleTier === `cm_${server.toLowerCase()}` ||
          (acc.staffRoleTier?.startsWith('cm_') && acc.serverRegion === server)),
    ) ?? null
  );
}

export interface MaintenanceScanResult {
  repairedCount: number;
  findings: Array<{ issue: string; action: string }>;
  logs: AiMaintenanceLogEntry[];
  botUsed: { id: string; name: string; username: string; serverRegion?: ServerRegion } | null;
  worldChanged: boolean;
  playerIdsRepaired: string[];
  roomsRepaired: boolean;
}

/**
 * Rotina de Diagnóstico Autônomo, Auto-Reparo Técnico (Gerente da Comunidade / Engenheiro)
 * e Auditoria de Vestuário (Moderadores).
 */
export function runAiMaintenanceScan(options?: {
  logHealthyCheck?: boolean;
  triggeredBy?: string;
}): MaintenanceScanResult {
  const accounts = loadAccounts();
  const techBots = getTechnicalAiBots(accounts);
  const chosenBot =
    techBots.find((b) => b.staffRoleTier?.startsWith('cm_')) ??
    techBots[0] ??
    accounts.find((a) => a.staffRoleTier === 'admin') ??
    null;

  const modBots = accounts.filter(
    (a) => a.isBot && a.botActive !== false && a.staffRoleTier?.startsWith('mod_'),
  );

  if (!chosenBot) {
    return {
      repairedCount: 0,
      findings: [],
      logs: loadAiLogs(),
      botUsed: null,
      worldChanged: false,
      playerIdsRepaired: [],
      roomsRepaired: false,
    };
  }

  const findings: Array<{ issue: string; action: string; category?: 'maintenance' | 'moderation'; bot?: UserAccount }> = [];
  let worldChanged = false;
  const playerIdsRepaired: string[] = [];
  let roomsRepaired = false;

  const fullCatalog = getFullClothingCatalog();
  const fullCatalogMap = new Map(fullCatalog.map((item) => [item.id, item]));
  const fullFurnitureIds = new Set(getFullFurnitureCatalog().map((f) => f.id));

  // 1. Limpeza de cache JSON corrompido
  try {
    const cacheRaw = window.localStorage.getItem(CORRUPTED_CACHE_KEY);
    if (cacheRaw !== null) {
      window.localStorage.removeItem(CORRUPTED_CACHE_KEY);
      findings.push({
        issue: 'Cache JSON corrompido detectado no armazenamento local (localStorage).',
        action: 'Cache inválido isolado e removido com segurança sem perda de contas.',
      });
    }
  } catch {
    // Silencioso
  }

  // 2. Auditoria de inventários, starcoins, móveis da Suíte e compatibilidade de vestuário
  try {
    const keysToCheck: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PLAYER_PREFIX)) {
        keysToCheck.push(k);
      }
    }

    for (const key of keysToCheck) {
      const accountId = key.replace(PLAYER_PREFIX, '');
      const ownerAcc = accounts.find((a) => a.id === accountId);
      const ownerLabel = ownerAcc?.displayName || ownerAcc?.username || accountId;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as Partial<PlayerProgressState>;
        let dirty = false;

        if (Array.isArray(parsed.ownedItemIds)) {
          const uniqueItems = Array.from(new Set(parsed.ownedItemIds));
          if (uniqueItems.length !== parsed.ownedItemIds.length) {
            const diff = parsed.ownedItemIds.length - uniqueItems.length;
            parsed.ownedItemIds = uniqueItems;
            dirty = true;
            findings.push({
              issue: `${diff} item(ns) duplicado(s) no guarda-roupa de ${ownerLabel}.`,
              action: 'Inventário deduplicado e índices das camadas sincronizados.',
            });
          }
        }

        if (
          typeof parsed.starcoins !== 'number' ||
          Number.isNaN(parsed.starcoins) ||
          parsed.starcoins < 0
        ) {
          parsed.starcoins = 1200;
          dirty = true;
          findings.push({
            issue: `Saldo corrompido ou negativo detectado na conta ${ownerLabel}.`,
            action: 'Saldo restaurado para valor íntegro padrão (1.200 SC).',
          });
        }

        // Auditoria de vestuário na conta (itens inexistentes ou incompatíveis com o corpo)
        if (parsed.equipped && typeof parsed.equipped === 'object') {
          const bodyGender = parsed.avatarGender ?? ownerAcc?.avatarGender ?? 'feminino';
          const fixedEquipped = { ...parsed.equipped };
          let outfitFixed = 0;

          (Object.keys(fixedEquipped) as ClothingCategory[]).forEach((slot) => {
            const itemId = fixedEquipped[slot];
            if (!itemId) return;
            const catalogItem = fullCatalogMap.get(itemId);
            if (
              !catalogItem ||
              !isItemCompatibleWithGender(
                catalogItem.gender ?? catalogItem.genderStyle,
                bodyGender,
              )
            ) {
              delete fixedEquipped[slot];
              outfitFixed += 1;
            }
          });

          if (outfitFixed > 0) {
            parsed.equipped = fixedEquipped;
            dirty = true;
            const auditorBot = modBots[0] ?? chosenBot;
            findings.push({
              issue: `Auditoria de Vestuário: ${outfitFixed} peça(s) corrompida(s) ou incompatível(is) com o corpo de ${ownerLabel}.`,
              action: 'Peças inválidas desequipadas automaticamente para manter renderização limpa.',
              category: 'moderation',
              bot: auditorBot,
            });
          }
        }

        // Suíte 2D: móveis fora do palco, órfãos ou duplicados exatamente sobrepostos
        if (parsed.suite && Array.isArray(parsed.suite.items)) {
          let movedCount = 0;
          let removedOrphanOrDup = 0;
          const seenInstanceIds = new Set<string>();
          const seenPlacements = new Set<string>();

          const nextItems = parsed.suite.items
            .filter((item) => {
              if (!item || !item.furnitureId || !fullFurnitureIds.has(item.furnitureId)) {
                removedOrphanOrDup += 1;
                return false;
              }
              if (seenInstanceIds.has(item.instanceId)) {
                removedOrphanOrDup += 1;
                return false;
              }
              seenInstanceIds.add(item.instanceId);

              const placementSig = `${item.furnitureId}_${Math.round(item.x)}_${Math.round(item.y)}`;
              if (seenPlacements.has(placementSig)) {
                removedOrphanOrDup += 1;
                return false;
              }
              seenPlacements.add(placementSig);
              return true;
            })
            .map((item) => {
              const invalidCoord =
                Number.isNaN(item.x) ||
                Number.isNaN(item.y) ||
                item.x < 0 ||
                item.x > 620 ||
                item.y < 0 ||
                item.y > 380 ||
                item.zIndex < 1 ||
                item.zIndex > 80;
              if (invalidCoord) {
                movedCount += 1;
                return {
                  ...item,
                  x: Math.max(20, Math.min(540, Number.isFinite(item.x) ? item.x : 220)),
                  y: Math.max(40, Math.min(310, Number.isFinite(item.y) ? item.y : 180)),
                  zIndex: Math.max(1, Math.min(50, Number.isFinite(item.zIndex) ? item.zIndex : 10)),
                };
              }
              return item;
            });

          if (movedCount > 0 || removedOrphanOrDup > 0) {
            parsed.suite.items = nextItems;
            dirty = true;
            findings.push({
              issue: `Suíte de ${ownerLabel}: ${movedCount} móvel(is) desalinhado(s) e ${removedOrphanOrDup} sobreposto(s)/inválido(s).`,
              action: 'Coordenadas 2D recalibradas e duplicidades da Suíte removidas.',
            });
          }
        }

        if (dirty) {
          window.localStorage.setItem(key, JSON.stringify(parsed));
          playerIdsRepaired.push(accountId);
        }
      } catch {
        window.localStorage.removeItem(key);
        playerIdsRepaired.push(accountId);
        findings.push({
          issue: `JSON corrompido detectado no progresso de ${ownerLabel}.`,
          action: 'Estrutura inválida limpa e conta preparada para reconstrução segura.',
        });
      }
    }
  } catch {
    // Silencioso
  }

  // 3. Verificação de Salas Globais: NPCs figurantes legados, avatares travados e vestuário em sala
  try {
    const roomsRaw = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    if (roomsRaw) {
      try {
        const snap = JSON.parse(roomsRaw) as Partial<SharedRoomsSnapshot>;
        const now = Date.now();
        let snapDirty = false;

        const cleanCustomRooms = Array.isArray(snap.customRooms)
          ? snap.customRooms.filter((r) => Boolean(r && r.id && r.name))
          : [];
        if (
          Array.isArray(snap.customRooms) &&
          cleanCustomRooms.length !== snap.customRooms.length
        ) {
          snapDirty = true;
          findings.push({
            issue: 'Sala personalizada corrompida ou sem metadados encontrada no Lobby.',
            action: 'Registro inválido removido da lista global de salas.',
          });
        }

        const allRoomsMap = new Map<string, RoomDef>(
          [...GLOBAL_ROOMS, ...cleanCustomRooms].map((r) => [r.id, r]),
        );

        const nextPresences: Record<string, RoomAvatarPresence> = {};
        let stuckFixed = 0;
        let stalePurged = 0;
        let npcPurged = 0;
        let roomOutfitFixed = 0;

        Object.values(snap.presences ?? {}).forEach((presence) => {
          if (!presence || !presence.clientId) {
            snapDirty = true;
            return;
          }

          if (presence.clientId.startsWith('npc_')) {
            npcPurged += 1;
            snapDirty = true;
            return;
          }

          if (!presence.isBot && now - presence.lastSeen > 18_000) {
            stalePurged += 1;
            snapDirty = true;
            return;
          }

          let fixedPresence = { ...presence };
          const roomDef = allRoomsMap.get(fixedPresence.roomId);
          const minY = roomDef?.walkMinY ?? 55;
          const maxY = roomDef?.walkMaxY ?? 89;

          const badX =
            typeof fixedPresence.x !== 'number' ||
            Number.isNaN(fixedPresence.x) ||
            fixedPresence.x < 8 ||
            fixedPresence.x > 92;
          const badY =
            typeof fixedPresence.y !== 'number' ||
            Number.isNaN(fixedPresence.y) ||
            fixedPresence.y < minY ||
            fixedPresence.y > maxY;
          const badRoom = !roomDef;

          if (badX || badY || badRoom) {
            stuckFixed += 1;
            snapDirty = true;
            fixedPresence = {
              ...fixedPresence,
              roomId: badRoom ? 'lounge_principal' : fixedPresence.roomId,
              x: badX ? 50 : fixedPresence.x,
              y: badY ? Math.round((minY + maxY) / 2) : fixedPresence.y,
            };
          }

          // Auditoria de vestuário ativo na sala
          if (fixedPresence.equipped) {
            const fixedEq = { ...fixedPresence.equipped };
            let eqChanged = false;
            (Object.keys(fixedEq) as ClothingCategory[]).forEach((slot) => {
              const id = fixedEq[slot];
              if (!id) return;
              const item = fullCatalogMap.get(id);
              if (
                !item ||
                !isItemCompatibleWithGender(
                  item.gender ?? item.genderStyle,
                  fixedPresence.avatarGender,
                )
              ) {
                delete fixedEq[slot];
                eqChanged = true;
              }
            });
            if (eqChanged) {
              roomOutfitFixed += 1;
              snapDirty = true;
              fixedPresence = { ...fixedPresence, equipped: fixedEq };
            }
          }

          nextPresences[fixedPresence.clientId] = fixedPresence;
        });

        if (npcPurged > 0) {
          findings.push({
            issue: `${npcPurged} figurante(s) estático(s) legado(s) detectado(s) nas salas.`,
            action: 'Figurantes estáticos removidos permanentemente (somente jogadores e Bots da Staff).',
          });
        }
        if (stalePurged > 0) {
          findings.push({
            issue: `${stalePurged} avatar(es) fantasma(s)/expirado(s) travado(s) no mapa das salas.`,
            action: 'Presenças inativas removidas e contador das salas atualizado.',
          });
        }
        if (stuckFixed > 0) {
          findings.push({
            issue: `${stuckFixed} avatar(es) fora dos limites caminháveis ou em sala inexistente.`,
            action: 'Avatares reposicionados com segurança para o piso central da sala.',
          });
        }
        if (roomOutfitFixed > 0) {
          const auditorBot = modBots[0] ?? chosenBot;
          findings.push({
            issue: `${roomOutfitFixed} avatar(es) em sala com peça inválida ou incompatível.`,
            action: 'Auditoria de Vestuário desequipou as peças conflitantes ao vivo.',
            category: 'moderation',
            bot: auditorBot,
          });
        }

        if (snapDirty) {
          roomsRepaired = true;
          const repairedSnap: SharedRoomsSnapshot = {
            presences: nextPresences,
            messagesByRoom: snap.messagesByRoom ?? {},
            customRooms: cleanCustomRooms,
            kicks: Array.isArray(snap.kicks) ? snap.kicks : [],
          };
          window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(repairedSnap));
          broadcastRoomsSync(repairedSnap);
        }
      } catch {
        window.localStorage.removeItem(ROOMS_STORAGE_KEY);
        roomsRepaired = true;
        findings.push({
          issue: 'Snapshot de salas multiplayer corrompido no localStorage.',
          action: 'Snapshot reinicializado e salas estabilizadas automaticamente.',
        });
      }
    }
  } catch {
    // Silencioso
  }

  // 4. Verificação do estado global de moderação
  try {
    const worldRaw = window.localStorage.getItem(WORLD_KEY);
    if (worldRaw) {
      const world = loadWorldState();
      const seenUsernames = new Set<string>();
      const dedupUsers = world.users.filter((u) => {
        const norm = normalizeUsername(u.username);
        if (!norm || seenUsernames.has(norm)) return false;
        seenUsernames.add(norm);
        return true;
      });
      const dedupDeleted = Array.from(new Set(world.deletedItemIds));
      const dedupBanned = Array.from(new Set(world.bannedWords));

      if (
        dedupUsers.length !== world.users.length ||
        dedupDeleted.length !== world.deletedItemIds.length ||
        dedupBanned.length !== world.bannedWords.length
      ) {
        const nextWorld: WorldModerationState = {
          ...world,
          users: dedupUsers,
          deletedItemIds: dedupDeleted,
          bannedWords: dedupBanned,
        };
        saveWorldState(nextWorld);
        worldChanged = true;
        findings.push({
          issue: 'Registros duplicados detectados na tabela global de contas/moderação.',
          action: 'Registros consolidados mantendo a Fonte Única de Verdade íntegra.',
        });
      }
    }
  } catch {
    // Silencioso
  }

  // 5. Integridade da chave de contas
  try {
    const rawAccs = window.localStorage.getItem(ACCOUNTS_KEY);
    if (rawAccs) {
      JSON.parse(rawAccs);
    }
  } catch {
    loadAccounts();
    findings.push({
      issue: 'Tabela de contas no localStorage apresentou falha de leitura JSON.',
      action: 'Contas reconstruídas a partir das definições seguras do sistema.',
    });
  }

  let logs = loadAiLogs();
  const prefix = options?.triggeredBy ? `[${options.triggeredBy}] ` : '';

  if (findings.length > 0) {
    for (const f of findings) {
      const actor = f.bot ?? chosenBot;
      logs = appendAiLog({
        botId: actor.id,
        botName: actor.displayName,
        botUsername: actor.username,
        serverRegion: actor.serverRegion,
        category: f.category ?? 'maintenance',
        issueDetected: `${prefix}${f.issue}`,
        actionTaken: f.action,
        status: 'repaired',
      });
    }
  } else if (options?.logHealthyCheck) {
    logs = appendAiLog({
      botId: chosenBot.id,
      botName: chosenBot.displayName,
      botUsername: chosenBot.username,
      serverRegion: chosenBot.serverRegion,
      category: 'maintenance',
      issueDetected: `${prefix}Diagnóstico preventivo concluído sem inconsistências.`,
      actionTaken:
        'Estado do localStorage, inventários, vestuário, suítes e salas verificados (100% íntegro).',
      status: 'healthy',
    });
  }

  return {
    repairedCount: findings.length,
    findings,
    logs,
    botUsed: {
      id: chosenBot.id,
      name: chosenBot.displayName,
      username: chosenBot.username,
      serverRegion: chosenBot.serverRegion,
    },
    worldChanged,
    playerIdsRepaired,
    roomsRepaired,
  };
}

/**
 * Injeta falhas controladas no localStorage (cache corrompido, avatar travado fora do palco
 * e itens duplicados no inventário) e aciona o diagnóstico automático.
 */
export function simulateSystemFaultAndRepair(
  targetAccountId?: string,
): MaintenanceScanResult {
  const techBots = getTechnicalAiBots();
  if (techBots.length === 0) {
    return {
      repairedCount: 0,
      findings: [],
      logs: loadAiLogs(),
      botUsed: null,
      worldChanged: false,
      playerIdsRepaired: [],
      roomsRepaired: false,
    };
  }

  try {
    window.localStorage.setItem(CORRUPTED_CACHE_KEY, '{corrupted_json_cache: [1, 2,');
  } catch {
    // Silencioso
  }

  try {
    const rawRooms = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    if (rawRooms) {
      const snap = JSON.parse(rawRooms) as SharedRoomsSnapshot;
      snap.presences[`cli_stuck_sim_${Date.now()}`] = {
        clientId: `cli_stuck_sim_${Date.now()}`,
        username: 'avatar_travado_sim',
        role: 'player',
        roomId: 'sala_inexistente_404',
        x: 999,
        y: -45,
        facing: 'right',
        equipped: {},
        skinTone: 'pessego',
        avatarGender: 'feminino',
        lastSeen: Date.now() - 45_000,
        isBot: false,
      };
      window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(snap));
    }
  } catch {
    // Silencioso
  }

  if (targetAccountId) {
    try {
      const key = `${PLAYER_PREFIX}${targetAccountId}`;
      const rawPlayer = window.localStorage.getItem(key);
      if (rawPlayer) {
        const parsed = JSON.parse(rawPlayer) as PlayerProgressState;
        if (Array.isArray(parsed.ownedItemIds) && parsed.ownedItemIds.length > 0) {
          parsed.ownedItemIds = [
            ...parsed.ownedItemIds,
            parsed.ownedItemIds[0],
            parsed.ownedItemIds[0],
          ];
          window.localStorage.setItem(key, JSON.stringify(parsed));
        }
      }
    } catch {
      // Silencioso
    }
  }

  return runAiMaintenanceScan({
    triggeredBy: 'Simulação de Falha',
    logHealthyCheck: false,
  });
}

export type ModerationActionKind = 'none' | 'warning' | 'mute' | 'ban';

export interface SentinelEvaluationResult {
  triggered: boolean;
  action: ModerationActionKind;
  bot?: UserAccount;
  reason?: string;
  matchedDetail?: string;
  violationType?: 'profanity' | 'spam';
  publicChatNotice?: string;
  muteUntil?: number;
}

/**
 * Avalia mensagens em tempo real com Moderação Progressiva:
 * - Infração grave: banimento imediato.
 * - 1ª infração leve / spam: Advertência visual.
 * - 2ª infração: Mute temporário de 5 minutos.
 * - 3ª infração: Banimento definitivo no servidor.
 */
export function evaluateMessageWithSentinelBot(params: {
  text: string;
  roomServer: ServerRegion;
  senderUsername: string;
  bannedWords: string[];
  recentRoomMessages: RoomChatMessage[];
  priorWarnings?: number;
}): SentinelEvaluationResult {
  const {
    text,
    roomServer,
    senderUsername,
    bannedWords,
    recentRoomMessages,
    priorWarnings = 0,
  } = params;

  const sentinelBot = getSentinelAiBotForServer(roomServer);
  if (!sentinelBot) {
    return { triggered: false, action: 'none' };
  }

  const normalizedText = stripAccents(text.trim());
  const senderNorm = normalizeUsername(senderUsername);

  let matchedReason: string | null = null;
  let matchedDetail = '';
  let violationType: 'profanity' | 'spam' = 'profanity';
  let isSevere = false;

  // 1. Palavras proibidas definidas pela equipe
  for (const rawBanned of bannedWords) {
    const cleanBanned = stripAccents(rawBanned.trim());
    if (!cleanBanned) continue;
    if (normalizedText.includes(cleanBanned)) {
      matchedDetail = rawBanned.trim();
      matchedReason = `Linguagem inadequada detectada no Servidor ${roomServer} ("${matchedDetail}")`;
      if (SEVERE_PROFANITY_TERMS.has(cleanBanned)) isSevere = true;
      break;
    }
  }

  // 2. Dicionário de ofensas e golpes por servidor
  if (!matchedReason) {
    const serverTerms = SERVER_PROFANITY_PATTERNS[roomServer] ?? [];
    const wordsInText = normalizedText
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    for (const term of serverTerms) {
      const cleanTerm = stripAccents(term);
      if (wordsInText.includes(cleanTerm)) {
        matchedDetail = term;
        matchedReason = `Conduta abusiva detectada no Servidor ${roomServer} ("${term}")`;
        if (SEVERE_PROFANITY_TERMS.has(cleanTerm)) isSevere = true;
        break;
      }
    }
  }

  // 3. Spam excessivo
  if (!matchedReason) {
    const hasCharFlood = /(.)\1{9,}/.test(normalizedText);
    const now = Date.now();
    const recentByUser = recentRoomMessages.filter(
      (m) =>
        m.senderRole !== 'system' &&
        normalizeUsername(m.senderUsername) === senderNorm &&
        now - m.createdAt < 15_000,
    );
    const identicalCount = recentByUser.filter(
      (m) => stripAccents(m.text.trim()) === normalizedText,
    ).length;
    const rapidBurstCount = recentByUser.filter((m) => now - m.createdAt < 6_000).length;

    if (hasCharFlood || identicalCount >= 2 || rapidBurstCount >= 4) {
      violationType = 'spam';
      matchedDetail = hasCharFlood
        ? 'Repetição excessiva de caracteres'
        : 'Flood repetitivo no chat';
      matchedReason = `Spam detectado no Servidor ${roomServer}: ${matchedDetail}`;
    }
  }

  if (!matchedReason) {
    return { triggered: false, action: 'none' };
  }

  // Moderação Progressiva
  const botLabel = `Moderador (${roomServer}) · ${sentinelBot.displayName}`;

  if (isSevere || priorWarnings >= 2) {
    return {
      triggered: true,
      action: 'ban',
      bot: sentinelBot,
      violationType,
      matchedDetail,
      reason: matchedReason,
      publicChatNotice: `[${botLabel}]: ${senderNorm} foi banida do Servidor ${roomServer} (${matchedReason}).`,
    };
  }

  if (priorWarnings === 1) {
    const muteUntil = Date.now() + 5 * 60 * 1000;
    return {
      triggered: true,
      action: 'mute',
      bot: sentinelBot,
      violationType,
      matchedDetail,
      reason: matchedReason,
      muteUntil,
      publicChatNotice: `[${botLabel}]: ${senderNorm} recebeu mute temporário de 5 minutos por reincidência (${matchedDetail}).`,
    };
  }

  return {
    triggered: true,
    action: 'warning',
    bot: sentinelBot,
    violationType,
    matchedDetail,
    reason: matchedReason,
    publicChatNotice: `[${botLabel}]: Advertência para ${senderNorm} — mensagem bloqueada (${matchedDetail}). Próxima infração resultará em mute.`,
  };
}

/** Processa uma denúncia /report enviada nas salas pelo Bot Moderador do servidor */
export function handleRoomReportWithModBot(params: {
  reporter: string;
  target: string;
  reason: string;
  server: ServerRegion;
  roomId: string;
}): { report: RoomReportEntry; publicChatNotice: string; bot: UserAccount | null } {
  const sentinelBot = getSentinelAiBotForServer(params.server);
  const world = loadWorldState();
  const cleanTarget = normalizeUsername(params.target);
  const cleanReporter = normalizeUsername(params.reporter);

  const report: RoomReportEntry = {
    id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    reporter: cleanReporter,
    target: cleanTarget,
    reason: params.reason.trim() || 'Conduta imprópria reportada na sala',
    server: params.server,
    roomId: params.roomId,
    createdAt: Date.now(),
    handledByBot: sentinelBot?.displayName,
  };

  saveWorldState({
    ...world,
    reports: [report, ...(world.reports ?? [])].slice(0, 50),
  });

  if (sentinelBot) {
    appendAiLog({
      botId: sentinelBot.id,
      botName: sentinelBot.displayName,
      botUsername: sentinelBot.username,
      serverRegion: params.server,
      category: 'moderation',
      issueDetected: `Denúncia /report registrada contra ${cleanTarget} por ${cleanReporter}.`,
      actionTaken: `Moderador (${params.server}) abriu auditoria prioritária (${report.reason}).`,
      status: 'warning',
    });
  }

  const botLabel = sentinelBot
    ? `Moderador (${params.server}) · ${sentinelBot.displayName}`
    : `Moderação (${params.server})`;

  return {
    report,
    bot: sentinelBot,
    publicChatNotice: `[${botLabel}]: Denúncia contra ${cleanTarget} recebida e registrada para análise.`,
  };
}

/** Resposta interativa do Gerente da Comunidade quando jogadores pedem ajuda na sala */
export function maybeGetCommunityManagerReply(params: {
  text: string;
  roomServer: ServerRegion;
  senderUsername: string;
}): { bot: UserAccount; replyText: string } | null {
  const cmBot = getCommunityManagerBotForServer(params.roomServer);
  if (!cmBot || cmBot.botRoamRooms === false) return null;

  const norm = stripAccents(params.text);
  const user = normalizeUsername(params.senderUsername);
  if (user === normalizeUsername(cmBot.username)) return null;

  const asksHelp =
    norm.includes('ajuda') ||
    norm.includes('help') ||
    norm.includes('ayuda') ||
    norm.includes('starcoin') ||
    norm.includes('evento') ||
    norm.includes('desfile') ||
    norm.includes('vip') ||
    norm.includes('como comprar');

  if (!asksHelp) return null;

  if (params.roomServer === 'ES') {
    return {
      bot: cmBot,
      replyText: `¡Hola ${user}! Visita Starplaza para probar looks nuevos o revisa los avisos del Servidor ES para los próximos eventos de moda.`,
    };
  }
  if (params.roomServer === 'EN') {
    return {
      bot: cmBot,
      replyText: `Hi ${user}! You can customize your MeDoll in the Studio, shop new collections in Starplaza, or join our EN fashion events right here!`,
    };
  }
  if (norm.includes('vip')) {
    return {
      bot: cmBot,
      replyText: `Olá ${user}! A Boutique VIP Exclusiva na Starplaza traz peças douradas especiais para assinantes VIP e equipe autorizada.`,
    };
  }
  return {
    bot: cmBot,
    replyText: `Olá ${user}! Precisando de dicas? Personalize sua MeDoll no Estúdio, compre tendências na Starplaza e fique de olho nos avisos de desfile do Servidor BR!`,
  };
}

// --- CRIAÇÃO AUTÔNOMA DO DESIGNER GLOBAL ---

const DESIGNER_FASHION_CONCEPTS: Array<{
  collectionTag: string;
  name: string;
  brand: string;
  category: ClothingCategory;
  gender: ItemGenderStyle;
  price: number;
  swatchColor: string;
  templateId?: string;
  isVipOnly?: boolean;
}> = [
  {
    collectionTag: 'Streetwear EUA',
    name: 'Jaqueta Varsity Brooklyn Oversized',
    brand: 'SoHo Youth USA',
    category: 'blusas',
    gender: 'unissex',
    price: 340,
    swatchColor: '#1E3A8A',
    templateId: 'tpl_jaqueta',
  },
  {
    collectionTag: 'Y2K Glam LA',
    name: 'Saia Cargo Metálica Sunset LA',
    brand: 'Melrose Studio',
    category: 'calcas',
    gender: 'feminino',
    price: 275,
    swatchColor: '#BE185D',
    templateId: 'tpl_saia',
  },
  {
    collectionTag: 'Alta Costura NY',
    name: 'Vestido Esmeralda Met Gala VIP',
    brand: 'Maison Celine VIP',
    category: 'vestidos',
    gender: 'feminino',
    price: 780,
    swatchColor: '#047857',
    isVipOnly: true,
  },
  {
    collectionTag: 'Casual Chic EUA',
    name: 'Blazer Estruturado Fifth Ave',
    brand: 'Homme & Co NY',
    category: 'blusas',
    gender: 'masculino',
    price: 390,
    swatchColor: '#334155',
  },
  {
    collectionTag: 'Y2K Glam LA',
    name: 'Óculos Retrô Solar Malibu',
    brand: 'Melrose Studio',
    category: 'acessorios',
    gender: 'unissex',
    price: 195,
    swatchColor: '#D97706',
    templateId: 'tpl_oculos',
  },
  {
    collectionTag: 'Streetwear EUA',
    name: 'Calça Wide Leg Skater Carbono VIP',
    brand: 'SoHo Youth VIP',
    category: 'calcas',
    gender: 'unissex',
    price: 490,
    swatchColor: '#27272A',
    isVipOnly: true,
  },
  {
    collectionTag: 'Casual Chic EUA',
    name: 'Scarpin Rubi Tribeca',
    brand: 'Celine Atelier',
    category: 'sapatos',
    gender: 'feminino',
    price: 295,
    swatchColor: '#BE123C',
  },
];

const DESIGNER_WEEKLY_VIP_CONCEPTS: Array<{
  collectionTag: string;
  name: string;
  brand: string;
  category: ClothingCategory;
  gender: ItemGenderStyle;
  price: number;
  swatchColor: string;
  templateId: 'tpl_coroa' | 'tpl_cetro' | 'tpl_relogio' | 'tpl_bolsa';
}> = [
  {
    collectionTag: 'Lendário Semanal VIP',
    name: 'Coroa Diamante Beverly Hills VIP',
    brand: 'Maison Royale VIP',
    category: 'acessorios',
    gender: 'unissex',
    price: 1080,
    swatchColor: '#FBBF24',
    templateId: 'tpl_coroa',
  },
  {
    collectionTag: 'Lendário Semanal VIP',
    name: 'Cetro Imperial Safira NY VIP',
    brand: 'Maison Royale VIP',
    category: 'acessorios',
    gender: 'unissex',
    price: 1240,
    swatchColor: '#38BDF8',
    templateId: 'tpl_cetro',
  },
  {
    collectionTag: 'Lendário Semanal VIP',
    name: 'Cronógrafo Ouro Rosé Madison VIP',
    brand: 'Maison Royale VIP',
    category: 'acessorios',
    gender: 'unissex',
    price: 890,
    swatchColor: '#F59E0B',
    templateId: 'tpl_relogio',
  },
  {
    collectionTag: 'Lendário Semanal VIP',
    name: 'Bolsa Couture Cristal Rodeo VIP',
    brand: 'Maison Royale VIP',
    category: 'acessorios',
    gender: 'feminino',
    price: 960,
    swatchColor: '#0F172A',
    templateId: 'tpl_bolsa',
  },
];

const DESIGNER_FURNITURE_CONCEPTS: Array<{
  name: string;
  category: 'Assentos' | 'Superfícies' | 'Decoração';
  themeTag: 'boate' | 'casa' | 'bar' | 'hotel';
  width: number;
  height: number;
  price: number;
  swatchColor: string;
  secondaryColor?: string;
  accentColor?: string;
  templateId: FurnitureDef['templateId'];
  description?: string;
  isVipOnly?: boolean;
}> = [
  {
    name: 'Sofá Bouclé Pérola Atelier',
    category: 'Assentos',
    themeTag: 'casa',
    width: 195,
    height: 112,
    price: 420,
    swatchColor: '#D6CFC7',
    secondaryColor: '#EDE7E0',
    accentColor: '#C49A48',
    templateId: 'tpl_sofa',
    description: 'Sofá curvo de linhas orgânicas para salas de estar modernas.',
  },
  {
    name: 'Mesa Escultural Terracota',
    category: 'Superfícies',
    themeTag: 'casa',
    width: 128,
    height: 76,
    price: 240,
    swatchColor: '#B45309',
    secondaryColor: '#FAF5EE',
    accentColor: '#D4A853',
    templateId: 'tpl_mesa',
    description: 'Mesa auxiliar escultural para sala de jantar ou estar.',
  },
  {
    name: 'Escultura Lunar Ouro VIP',
    category: 'Decoração',
    themeTag: 'hotel',
    width: 100,
    height: 130,
    price: 580,
    swatchColor: '#F59E0B',
    secondaryColor: '#27272A',
    accentColor: '#FDE68A',
    templateId: 'tpl_decoracao',
    isVipOnly: true,
    description: 'Peça de arte luminosa digna de lobby de hotel 5 estrelas.',
  },
  {
    name: 'Balcão Cocktail Velvet Club',
    category: 'Superfícies',
    themeTag: 'bar',
    width: 205,
    height: 128,
    price: 510,
    swatchColor: '#4A1D3D',
    secondaryColor: '#18181B',
    accentColor: '#F59E0B',
    templateId: 'tpl_bar',
    description: 'Bar sofisticado com adega iluminada e taças de cristal.',
  },
  {
    name: 'Mesa DJ Laser Violeta',
    category: 'Superfícies',
    themeTag: 'boate',
    width: 186,
    height: 122,
    price: 495,
    swatchColor: '#1E1B4B',
    secondaryColor: '#4C1D95',
    accentColor: '#22D3EE',
    templateId: 'tpl_dj',
    description: 'Controladora de boate com luzes LED sincronizadas.',
  },
];

const DESIGNER_ROOM_CONCEPTS: Array<{
  name: string;
  subtitle: string;
  backdropTheme: RoomDef['backdropTheme'];
  serverRegion: ServerRegion;
}> = [
  {
    name: 'Passarela Semana de Moda BR',
    subtitle: 'Desfile exclusivo projetado pelo Designer Global · Servidor Brasileiro',
    backdropTheme: 'atelier_rosa',
    serverRegion: 'BR',
  },
  {
    name: 'Galeria Lumière Paris',
    subtitle: 'Lounge artístico para encontros de estilistas · Servidor Internacional',
    backdropTheme: 'lounge_principal',
    serverRegion: 'EN',
  },
  {
    name: 'Café Galería Diseño ES',
    subtitle: 'Espacio temático de diseño y moda · Servidor Español',
    backdropTheme: 'cafe_starlight',
    serverRegion: 'ES',
  },
];

function sanitizeEquippedOutfit(
  equipped: EquippedOutfit,
  bodyGender: PlayerProgressState['avatarGender'],
  catalogMap: Map<string, ClothingItem>,
  deletedItemIds: Set<string>,
  hasVipAccess: boolean,
): { nextEquipped: EquippedOutfit; fixedIssues: string[] } {
  const nextEquipped: EquippedOutfit = { ...equipped };
  const fixedIssues: string[] = [];

  (Object.keys(nextEquipped) as ClothingCategory[]).forEach((slot) => {
    const id = nextEquipped[slot];
    if (!id) return;
    const item = catalogMap.get(id);
    if (!item || deletedItemIds.has(id)) {
      delete nextEquipped[slot];
      fixedIssues.push(`peça removida/inexistente (${slot})`);
      return;
    }
    if (!isItemCompatibleWithGender(item.gender ?? item.genderStyle, bodyGender)) {
      delete nextEquipped[slot];
      fixedIssues.push(`peça incompatível com modelo ${bodyGender} (${item.name})`);
      return;
    }
    if (item.isVipOnly && !hasVipAccess) {
      delete nextEquipped[slot];
      fixedIssues.push(`peça VIP sem assinatura ativa (${item.name})`);
    }
  });

  // Regra anatômica de camadas: vestidos não podem sobrepor blusas ou calças simultaneamente
  if (nextEquipped.vestidos && (nextEquipped.blusas || nextEquipped.calcas)) {
    delete nextEquipped.blusas;
    delete nextEquipped.calcas;
    fixedIssues.push('sobreposição corrigida (vestido x blusa/calça)');
  }

  return { nextEquipped, fixedIssues };
}

/**
 * Auditoria e Correção de Roupas Bugadas realizada pelo Designer Global:
 * varre contas e avatares nas salas públicas corrigindo sobreposições,
 * peças incompatíveis com o gênero e IDs corrompidos.
 */
export function runDesignerWardrobeAudit(triggeredBy?: string): {
  fixedCount: number;
  worldUpdated: boolean;
  roomsUpdated: boolean;
} {
  if (typeof window === 'undefined') {
    return { fixedCount: 0, worldUpdated: false, roomsUpdated: false };
  }

  const accounts = loadAccounts();
  const world = loadWorldState();
  const designer =
    accounts.find((a) => a.staffRoleTier === 'designer_global') ??
    accounts.find((a) => a.staffRoleTier === 'admin');
  const fullCatalog = getFullClothingCatalog(world);
  const catalogMap = new Map(fullCatalog.map((item) => [item.id, item]));
  const deletedSet = new Set(world.deletedItemIds ?? []);

  let fixedCount = 0;
  const fixedDetails: string[] = [];

  // 1. Auditoria em todas as contas salvas no localStorage
  for (const acc of accounts) {
    const prog = loadPlayerProgress(acc.id, acc.avatarGender);
    const { nextEquipped, fixedIssues } = sanitizeEquippedOutfit(
      prog.equipped,
      prog.avatarGender,
      catalogMap,
      deletedSet,
      isVipAccount(acc),
    );
    if (fixedIssues.length > 0) {
      savePlayerProgress(acc.id, { ...prog, equipped: nextEquipped });
      fixedCount += fixedIssues.length;
      fixedDetails.push(`${acc.displayName}: ${fixedIssues.join(', ')}`);
    }
  }

  // 2. Auditoria ao vivo em todas as presenças das salas públicas
  let roomsUpdated = false;
  try {
    const rawRooms = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    if (rawRooms) {
      const snap = JSON.parse(rawRooms) as SharedRoomsSnapshot;
      const nextPresences: Record<string, RoomAvatarPresence> = { ...(snap.presences ?? {}) };
      for (const [cid, p] of Object.entries(nextPresences)) {
        const linked = accounts.find(
          (a) => normalizeUsername(a.username) === normalizeUsername(p.username),
        );
        const vipOk = linked ? isVipAccount(linked) : Boolean(p.isVip);
        const { nextEquipped, fixedIssues } = sanitizeEquippedOutfit(
          p.equipped ?? {},
          p.avatarGender ?? 'feminino',
          catalogMap,
          deletedSet,
          vipOk,
        );
        if (fixedIssues.length > 0) {
          nextPresences[cid] = { ...p, equipped: nextEquipped };
          fixedCount += fixedIssues.length;
          roomsUpdated = true;
          fixedDetails.push(`Sala(${p.username}): ${fixedIssues.join(', ')}`);
        }
      }
      if (roomsUpdated) {
        const nextSnap: SharedRoomsSnapshot = { ...snap, presences: nextPresences };
        window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(nextSnap));
        broadcastRoomsSync(nextSnap);
      }
    }
  } catch {
    // Silencioso
  }

  saveWorldState({ ...loadWorldState(), lastDesignerAuditAt: Date.now() });

  if (designer && (fixedCount > 0 || triggeredBy)) {
    appendAiLog({
      botId: designer.id,
      botName: designer.displayName,
      botUsername: designer.username,
      category: 'design',
      issueDetected:
        fixedCount > 0
          ? `Auditoria de Moda detectou ${fixedCount} peça(s) sobreposta(s) ou incompatível(is).`
          : `${triggeredBy ? `[${triggeredBy}] ` : ''}Auditoria de Moda concluída nas salas e contas.`,
      actionTaken:
        fixedCount > 0
          ? `Designer Global corrigiu automaticamente: ${fixedDetails.slice(0, 3).join(' | ')}.`
          : 'Todos os avatares estão com vestuário compatível e sem sobreposições.',
      status: fixedCount > 0 ? 'repaired' : 'healthy',
    });
  }

  return { fixedCount, worldUpdated: true, roomsUpdated };
}

function emitLocalizedCommunityNewsForRelease(params: {
  releaseKind: 'fashion_2h' | 'vip_weekly' | 'furniture' | 'room';
  itemName: string;
  collectionTag: string;
  price?: number;
  accounts: UserAccount[];
}): void {
  const { releaseKind, itemName, collectionTag, price, accounts } = params;
  const cmBr =
    accounts.find((a) => a.staffRoleTier === 'cm_br') ??
    accounts.find((a) => a.staffRoleTier === 'designer_global');
  const cmEs = accounts.find((a) => a.staffRoleTier === 'cm_es');
  const cmEn = accounts.find((a) => a.staffRoleTier === 'cm_en');

  const photo =
    releaseKind === 'vip_weekly'
      ? NEWS_PHOTO_ASSETS[1]
      : releaseKind === 'furniture'
        ? NEWS_PHOTO_ASSETS[3]
        : releaseKind === 'room'
          ? NEWS_PHOTO_ASSETS[2]
          : NEWS_PHOTO_ASSETS[0];

  const category: NewsCategory =
    releaseKind === 'vip_weekly'
      ? 'Coleção VIP'
      : releaseKind === 'furniture' || releaseKind === 'room'
        ? 'Atualizações'
        : 'Lançamentos';

  if (cmBr) {
    publishNewsPostToWorld({
      title:
        releaseKind === 'vip_weekly'
          ? `Lançamento Semanal Lendário VIP: ${itemName}`
          : `Novo Destaque ${collectionTag}: ${itemName}`,
      summary:
        releaseKind === 'vip_weekly'
          ? `Peça de altíssimo luxo exclusiva para membros VIP acaba de entrar na vitrine (${price ?? 900} SC).`
          : `Inspirada nas tendências jovens atuais, "${itemName}" já está disponível para você testar e combinar na Starplaza.`,
      body: `Novidade no Servidor BR! Confira "${itemName}" (${collectionTag}) recém-lançada pelo departamento de estilo. Aproveite as salas públicas caminhando pelo salão com respeito e criatividade para exibir seu novo look!`,
      imageUrl: photo.url,
      imageCaption: `${photo.label} · ${itemName}`,
      category,
      serverRegion: 'BR',
      authorAccountId: cmBr.id,
      authorUsername: cmBr.username,
      authorDisplayName: cmBr.displayName,
      authorRoleTier: cmBr.staffRoleTier ?? 'cm_br',
    });
  }

  if (cmEs && releaseKind !== 'furniture') {
    publishNewsPostToWorld({
      title:
        releaseKind === 'vip_weekly'
          ? `Edición Semanal Legendaria VIP: ${itemName}`
          : `Novedad en Starplaza: ${itemName}`,
      summary: `Nueva incorporación de ${collectionTag} lista para explorar en el catálogo del Servidor ES.`,
      body: `¡Hola comunidad del Servidor ES! Ya pueden encontrar "${itemName}" en Starplaza. Recuerden mantener un ambiente amable en el Salón Principal ES y disfrutar los nuevos estilos.`,
      imageUrl: photo.url,
      imageCaption: `${photo.label} · ${itemName}`,
      category,
      serverRegion: 'ES',
      authorAccountId: cmEs.id,
      authorUsername: cmEs.username,
      authorDisplayName: cmEs.displayName,
      authorRoleTier: cmEs.staffRoleTier ?? 'cm_es',
    });
  }

  if (cmEn && (releaseKind === 'fashion_2h' || releaseKind === 'vip_weekly')) {
    publishNewsPostToWorld({
      title:
        releaseKind === 'vip_weekly'
          ? `Weekly Legendary VIP Drop: ${itemName}`
          : `Fresh US Streetwear & Style Drop: ${itemName}`,
      summary: `Explore "${itemName}" from ${collectionTag} in Starplaza now and show off your outfit in the EN Lounge.`,
      body: `Hey EN Server stylists! "${itemName}" just hit the racks. Remember our community guidelines—be welcoming in public lounges and share your runway inspirations!`,
      imageUrl: photo.url,
      imageCaption: `${photo.label} · ${itemName}`,
      category,
      serverRegion: 'EN',
      authorAccountId: cmEn.id,
      authorUsername: cmEn.username,
      authorDisplayName: cmEn.displayName,
      authorRoleTier: cmEn.staffRoleTier ?? 'cm_en',
    });
  }
}

export interface AutonomousLifeTickResult {
  roomsUpdated: boolean;
  worldUpdated: boolean;
  logsUpdated: boolean;
  createdSummary?: string;
}

/**
 * Executa o ciclo de vida autônomo dos perfis oficiais da Staff:
 * 1. Respeita estritamente `botRoamRooms` e `botActive` (remove se desligado).
 * 2. Move os membros pelas salas públicas do seu servidor e mantém conversa natural.
 * 3. Designer Global executa Auditoria de Moda (correção de roupas bugadas),
 *    Ciclo Autônomo de 2 Horas (tendências americanas atuais) e Ciclo Semanal VIP (7 dias).
 * 4. Gerentes da Comunidade (BR, ES, EN) publicam notícias localizadas com fotos a cada lançamento.
 */
export function runBotAutonomousLifeTick(options?: {
  forceDesignerCreation?: boolean;
  forceWeeklyVip?: boolean;
  forceWardrobeAudit?: boolean;
}): AutonomousLifeTickResult {
  if (typeof window === 'undefined') {
    return { roomsUpdated: false, worldUpdated: false, logsUpdated: false };
  }

  const accounts = loadAccounts();
  let world = loadWorldState();
  let snap: SharedRoomsSnapshot;

  try {
    const raw = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    snap = raw
      ? (JSON.parse(raw) as SharedRoomsSnapshot)
      : { presences: {}, messagesByRoom: {}, customRooms: [], kicks: [] };
  } catch {
    return { roomsUpdated: false, worldUpdated: false, logsUpdated: false };
  }

  const allRooms = [...GLOBAL_ROOMS, ...(snap.customRooms ?? [])];
  const nextPresences = { ...(snap.presences ?? {}) };
  let roomsUpdated = false;
  let worldUpdated = false;
  let logsUpdated = false;
  let createdSummary: string | undefined;

  // Trava estrita: nunca cria novos bots automaticamente; opera somente nos bots já cadastrados
  const bots = accounts.filter((a) => a.isBot);
  const fullCatalog = getFullClothingCatalog(world);
  const now = Date.now();

  for (const bot of bots) {
    const botClientId = `bot_live_${bot.id}`;
    const botProgress = loadPlayerProgress(bot.id, bot.avatarGender);

    // Regra 1: Se o bot estiver desativado, fora das salas ou offline, retira imediatamente
    if (
      bot.botActive === false ||
      bot.botRoamRooms === false ||
      botProgress.presenceStatus === 'offline'
    ) {
      if (nextPresences[botClientId]) {
        delete nextPresences[botClientId];
        roomsUpdated = true;
      }
      continue;
    }

    // Regra 2: Seleciona salas válidas do servidor do bot (Admin / Designer circulam livremente)
    const eligibleRooms = allRooms.filter(
      (r) =>
        r.visibility === 'public' &&
        (!bot.serverRegion ||
          bot.staffRoleTier === 'designer_global' ||
          bot.staffRoleTier === 'admin' ||
          (r.serverRegion ?? 'BR') === bot.serverRegion),
    );
    const pool = eligibleRooms.length > 0 ? eligibleRooms : GLOBAL_ROOMS.slice(0, 3);

    const existing = nextPresences[botClientId];
    const shouldSwitchRoom = !existing || Math.random() < 0.14;
    let chosenRoom = shouldSwitchRoom
      ? pool[Math.floor(Math.random() * pool.length)]
      : pool.find((r) => r.id === existing.roomId) ?? pool[0];

    // Bots têm ~25% de chance ao trocar de sala de atuar diretamente em sua Mesa de Trabalho em `central_staff`
    const centralStaffRoom = allRooms.find((r) => r.id === 'central_staff');
    if (shouldSwitchRoom && centralStaffRoom && Math.random() < 0.28) {
      chosenRoom = centralStaffRoom;
    }

    const workDeskAnchor =
      chosenRoom.id === 'central_staff'
        ? bot.staffRoleTier === 'admin'
          ? { x: 18, y: 68 }
          : bot.staffRoleTier?.startsWith('cm_') || bot.botAiSpecialty === 'maintenance'
            ? { x: 38, y: 65 }
            : bot.staffRoleTier === 'designer_global' || bot.botAiSpecialty === 'designer'
              ? { x: 76, y: 65 }
              : { x: 58, y: 66 }
        : null;

    const nextX = workDeskAnchor
      ? Math.max(10, Math.min(90, Math.round(workDeskAnchor.x + (Math.random() * 6 - 3))))
      : existing && existing.roomId === chosenRoom.id
        ? Math.max(12, Math.min(88, Math.round(existing.x + (Math.random() * 22 - 11))))
        : Math.round(24 + Math.random() * 52);
    const nextY = workDeskAnchor
      ? Math.max(chosenRoom.walkMinY + 2, Math.min(chosenRoom.walkMaxY - 2, Math.round(workDeskAnchor.y + (Math.random() * 4 - 2))))
      : existing && existing.roomId === chosenRoom.id
        ? Math.max(
            chosenRoom.walkMinY + 2,
            Math.min(
              chosenRoom.walkMaxY - 2,
              Math.round(existing.y + (Math.random() * 12 - 6)),
            ),
          )
        : Math.round(chosenRoom.walkMinY + 6 + Math.random() * 14);

    // Regra 3: Ocasionalmente compra e equipa peça compatível na Starplaza
    let updatedProgress = botProgress;
    if (Math.random() < 0.18) {
      const compatible = fullCatalog.filter(
        (c) =>
          !world.deletedItemIds.includes(c.id) &&
          isItemCompatibleWithGender(c.gender ?? c.genderStyle, botProgress.avatarGender) &&
          (!c.isVipOnly || Boolean(bot.isVip) || bot.staffRoleTier === 'designer_global'),
      );
      if (compatible.length > 0) {
        const pickItem = compatible[Math.floor(Math.random() * compatible.length)];
        const alreadyOwned = botProgress.ownedItemIds.includes(pickItem.id);
        if (alreadyOwned || botProgress.starcoins >= pickItem.price) {
          const nextEquipped = { ...botProgress.equipped };
          if (pickItem.category === 'vestidos') {
            delete nextEquipped.blusas;
            delete nextEquipped.calcas;
          } else if (pickItem.category === 'blusas' || pickItem.category === 'calcas') {
            delete nextEquipped.vestidos;
          }
          nextEquipped[pickItem.category] = pickItem.id;

          updatedProgress = {
            ...botProgress,
            starcoins: alreadyOwned
              ? botProgress.starcoins
              : botProgress.starcoins - pickItem.price,
            ownedItemIds: alreadyOwned
              ? botProgress.ownedItemIds
              : [...botProgress.ownedItemIds, pickItem.id],
            equipped: nextEquipped,
          };
          savePlayerProgress(bot.id, updatedProgress);
        }
      }
    }

    // Regra 4: Autonomia do Designer Global (Auditoria de Roupas, Ciclo 2h e Lançamento Semanal VIP 7d)
    let designerAnnouncement: string | null = null;
    if (bot.staffRoleTier === 'designer_global' || bot.botAiSpecialty === 'designer') {
      if (
        options?.forceWardrobeAudit ||
        now - (world.lastDesignerAuditAt ?? 0) >= 60_000
      ) {
        const auditRes = runDesignerWardrobeAudit(
          options?.forceWardrobeAudit ? 'Auditoria Manual' : undefined,
        );
        if (auditRes.fixedCount > 0) {
          logsUpdated = true;
          worldUpdated = true;
        }
        if (auditRes.roomsUpdated) {
          roomsUpdated = true;
        }
        world = loadWorldState();
      }

      const humanDesignerActive = Object.values(nextPresences).some(
        (p) =>
          p &&
          !p.isBot &&
          now - p.lastSeen < 120_000 &&
          accounts.some(
            (a) =>
              a.username.toLowerCase() === p.username.toLowerCase() &&
              !a.isBot &&
              a.staffRoleTier === 'designer_global',
          ),
      );

      const weeklyDue =
        !humanDesignerActive &&
        (Boolean(options?.forceWeeklyVip) ||
          now - (world.lastWeeklyVipReleaseAt ?? now) >= WEEKLY_VIP_INTERVAL_MS);
      const biHourlyDue =
        !humanDesignerActive &&
        (Boolean(options?.forceDesignerCreation) ||
          now - (world.lastDesignerCreationAt ?? now) >= DESIGNER_CREATION_INTERVAL_MS);

      if (weeklyDue) {
        const existingCustomClothing = world.customClothingCatalog ?? [];
        const uncreatedWeekly = DESIGNER_WEEKLY_VIP_CONCEPTS.filter(
          (c) => !existingCustomClothing.some((e) => e.name === c.name),
        );
        const wTpl =
          uncreatedWeekly[Math.floor(Math.random() * uncreatedWeekly.length)] ??
          DESIGNER_WEEKLY_VIP_CONCEPTS[
            Math.floor(Math.random() * DESIGNER_WEEKLY_VIP_CONCEPTS.length)
          ];
        const editionTag =
          uncreatedWeekly.length === 0 ? ` S${Math.floor(Math.random() * 89 + 10)}` : '';
        const newVipItem: ClothingItem = {
          id: `design_vip_week_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          name: `${wTpl.name}${editionTag}`,
          brand: wTpl.brand,
          category: wTpl.category,
          gender: wTpl.gender,
          price: wTpl.price,
          zIndex: LAYER_Z_INDEX[wTpl.category],
          swatchColor: wTpl.swatchColor,
          templateId: wTpl.templateId,
          collectionTag: wTpl.collectionTag,
          isVipOnly: true,
          isLegendary: true,
        };
        world = addCustomClothingToWorld(newVipItem);
        saveWorldState({ ...world, lastWeeklyVipReleaseAt: now });
        world = loadWorldState();
        worldUpdated = true;
        createdSummary = `Lançamento Semanal VIP Lendário "${newVipItem.name}" publicado na Boutique VIP!`;
        designerAnnouncement = `Coleção Semanal VIP no ar: "${newVipItem.name}"! Já disponível para visualização de todos e uso exclusivo VIP na Starplaza.`;
        appendAiLog({
          botId: bot.id,
          botName: bot.displayName,
          botUsername: bot.username,
          category: 'design',
          issueDetected: 'Ciclo semanal (7 dias) de Lançamento Lendário VIP atingido.',
          actionTaken: `Designer Global lançou o item lendário VIP "${newVipItem.name}" (${newVipItem.price} SC).`,
          status: 'created',
        });
        emitLocalizedCommunityNewsForRelease({
          releaseKind: 'vip_weekly',
          itemName: newVipItem.name,
          collectionTag: newVipItem.collectionTag ?? 'Boutique VIP',
          price: newVipItem.price,
          accounts,
        });
        logsUpdated = true;
      } else if (biHourlyDue) {
        const existingCustomClothing = world.customClothingCatalog ?? [];
        const existingCustomFurn = world.customFurnitureCatalog ?? [];
        const botRooms = (snap.customRooms ?? []).filter((r) =>
          r.id.startsWith('bot_design_room_'),
        );

        const uncreatedFashion = DESIGNER_FASHION_CONCEPTS.filter(
          (c) => !existingCustomClothing.some((e) => e.name === c.name),
        );
        const uncreatedFurn = DESIGNER_FURNITURE_CONCEPTS.filter(
          (f) => !existingCustomFurn.some((e) => e.name === f.name),
        );
        const uncreatedRooms =
          botRooms.length < 4
            ? DESIGNER_ROOM_CONCEPTS.filter(
                (r) => !(snap.customRooms ?? []).some((e) => e.name === r.name),
              )
            : [];

        const actionChoices: Array<'fashion' | 'furniture' | 'room'> = [];
        if (uncreatedFashion.length > 0) actionChoices.push('fashion');
        if (uncreatedFurn.length > 0) actionChoices.push('furniture');
        if (uncreatedRooms.length > 0) actionChoices.push('room');

        const chosenAction =
          actionChoices[Math.floor(Math.random() * actionChoices.length)] ?? 'fashion';

        if (chosenAction === 'fashion') {
          const template =
            uncreatedFashion[Math.floor(Math.random() * uncreatedFashion.length)] ??
            DESIGNER_FASHION_CONCEPTS[Math.floor(Math.random() * DESIGNER_FASHION_CONCEPTS.length)];
          const suffix =
            uncreatedFashion.length === 0 ? ` Ed. ${Math.floor(Math.random() * 90 + 10)}` : '';
          const newPiece: ClothingItem = {
            id: `design_cloth_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: `${template.name}${suffix}`,
            brand: template.brand,
            category: template.category,
            gender: template.gender,
            price: template.price,
            zIndex: LAYER_Z_INDEX[template.category],
            swatchColor: template.swatchColor,
            templateId: template.templateId,
            collectionTag: template.collectionTag,
            isVipOnly: template.isVipOnly,
          };
          world = addCustomClothingToWorld(newPiece);
          saveWorldState({ ...world, lastDesignerCreationAt: now });
          world = loadWorldState();
          worldUpdated = true;
          createdSummary = `Peça "${newPiece.name}" (${newPiece.collectionTag}) lançada na Starplaza!`;
          designerAnnouncement = `Nova criação lançada na Starplaza: "${newPiece.name}" (${newPiece.collectionTag}${newPiece.isVipOnly ? ' · VIP' : ''})!`;
          appendAiLog({
            botId: bot.id,
            botName: bot.displayName,
            botUsername: bot.username,
            category: 'design',
            issueDetected: `Ciclo de 2 horas: tendência ${newPiece.collectionTag}.`,
            actionTaken: `Designer Global lançou "${newPiece.name}" (${newPiece.gender}, ${newPiece.price} SC) na Starplaza.`,
            status: 'created',
          });
          emitLocalizedCommunityNewsForRelease({
            releaseKind: 'fashion_2h',
            itemName: newPiece.name,
            collectionTag: newPiece.collectionTag ?? 'Tendências EUA',
            price: newPiece.price,
            accounts,
          });
          logsUpdated = true;
        } else if (chosenAction === 'furniture' && uncreatedFurn.length > 0) {
          const fTpl = uncreatedFurn[Math.floor(Math.random() * uncreatedFurn.length)];
          const newFurn: FurnitureDef = {
            id: `design_furn_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: fTpl.name,
            category: fTpl.category,
            themeTag: fTpl.themeTag,
            width: fTpl.width,
            height: fTpl.height,
            price: fTpl.price,
            defaultZ: 4,
            swatchColor: fTpl.swatchColor,
            secondaryColor: fTpl.secondaryColor,
            accentColor: fTpl.accentColor,
            templateId: fTpl.templateId,
            description: fTpl.description,
            isVipOnly: fTpl.isVipOnly,
          };
          world = addCustomFurnitureToWorld(newFurn);
          saveWorldState({ ...world, lastDesignerCreationAt: now });
          world = loadWorldState();
          worldUpdated = true;
          createdSummary = `Móvel "${newFurn.name}" adicionado à arquitetura das Suítes!`;
          designerAnnouncement = `Novo móvel exclusivo projetado para sua Suíte: "${newFurn.name}"!`;
          appendAiLog({
            botId: bot.id,
            botName: bot.displayName,
            botUsername: bot.username,
            category: 'design',
            issueDetected: 'Ciclo de 2 horas: nova peça de arquitetura para Suítes 2D.',
            actionTaken: `Designer Global desenhou o móvel "${newFurn.name}" (${newFurn.price} SC).`,
            status: 'created',
          });
          emitLocalizedCommunityNewsForRelease({
            releaseKind: 'furniture',
            itemName: newFurn.name,
            collectionTag: 'Arquitetura de Suítes',
            price: newFurn.price,
            accounts,
          });
          logsUpdated = true;
        } else if (chosenAction === 'room' && uncreatedRooms.length > 0) {
          const rTpl = uncreatedRooms[Math.floor(Math.random() * uncreatedRooms.length)];
          const newRoom: RoomDef = {
            id: `bot_design_room_${Date.now()}`,
            name: rTpl.name,
            subtitle: rTpl.subtitle,
            backdropTheme: rTpl.backdropTheme,
            walkMinY: 56,
            walkMaxY: 88,
            visibility: 'public',
            serverRegion: rTpl.serverRegion,
            creatorUsername: bot.username,
            roomNotice: `Sala arquitetada por ${bot.displayName} (Designer Global).`,
            isCustom: true,
          };
          snap.customRooms = [newRoom, ...(snap.customRooms ?? [])];
          snap.messagesByRoom[newRoom.id] = [
            {
              id: `msg_design_room_${now}`,
              roomId: newRoom.id,
              senderUsername: bot.username,
              senderRole: 'admin',
              senderStaffTier: bot.staffRoleTier,
              senderIsVip: Boolean(bot.isVip),
              text: `Inauguração da sala "${newRoom.name}"! Aproveitem o novo ambiente temático.`,
              createdAt: now,
            },
          ];
          saveWorldState({ ...world, lastDesignerCreationAt: now });
          world = loadWorldState();
          worldUpdated = true;
          roomsUpdated = true;
          createdSummary = `Sala temática "${newRoom.name}" inaugurada no Lobby!`;
          designerAnnouncement = `Acabei de inaugurar uma nova sala temática no Lobby: "${newRoom.name}"! Venham conhecer!`;
          appendAiLog({
            botId: bot.id,
            botName: bot.displayName,
            botUsername: bot.username,
            serverRegion: newRoom.serverRegion,
            category: 'design',
            issueDetected: 'Expansão arquitetônica do Lobby de Salas.',
            actionTaken: `Designer Global arquitetou a sala pública "${newRoom.name}" (${newRoom.serverRegion}).`,
            status: 'created',
          });
          emitLocalizedCommunityNewsForRelease({
            releaseKind: 'room',
            itemName: newRoom.name,
            collectionTag: `Salas ${newRoom.serverRegion}`,
            accounts,
          });
          logsUpdated = true;
        }
      }
    }

    // Regra 5: Fala 100% natural no chat da sala (sem revelar natureza automatizada)
    let chatBubbleText = existing?.lastMessage;
    let chatBubbleAt = existing?.lastMessageAt;

    const shouldSpeak =
      Boolean(designerAnnouncement) ||
      !existing ||
      (now - (existing.lastMessageAt ?? 0) > 25_000 && Math.random() < 0.28);

    if (shouldSpeak) {
      const server = chosenRoom.serverRegion ?? bot.serverRegion ?? 'BR';
      const linesByRole: string[] = designerAnnouncement
        ? [designerAnnouncement]
        : bot.staffRoleTier?.startsWith('cm_')
          ? server === 'ES'
            ? [
                '¡Bienvenidas! El desfile de temporada comienza pronto.',
                '¿Necesitan ayuda con eventos o Starplaza? Pregunten por aquí.',
              ]
            : server === 'EN'
              ? [
                  'Welcome stylists! Check out the server notice for today’s fashion event.',
                  'Need help with looks or VIP items? Just ask in chat!',
                ]
              : [
                  'Olá estilistas! Já conferiram as novidades e eventos do Servidor BR?',
                  'Qualquer dúvida sobre looks, Suíte ou Starplaza, é só chamar no chat!',
                ]
          : bot.staffRoleTier === 'designer_global'
            ? [
                'Observando as tendências de Streetwear e Y2K para a próxima coleção!',
                'Que cores e cortes vocês mais gostariam de ver na Starplaza?',
              ]
            : server === 'ES'
              ? [
                  '¡Hola a todos! Disfruten del salón y compartan sus mejores looks.',
                  'Cualquier consulta en el Servidor ES estoy por aquí.',
                ]
              : server === 'EN'
                ? [
                    'Hey everyone! Have fun styling and hanging out in the EN lounge.',
                    'Feel free to reach out if you need anything in the room!',
                  ]
                : [
                    'Olá pessoal! Aproveitem as salas e mantenham o chat sempre acolhedor.',
                    'Bom divertimento a todos! Qualquer dúvida estou por aqui.',
                  ];

      const spoken = linesByRole[Math.floor(Math.random() * linesByRole.length)];
      chatBubbleText = spoken;
      chatBubbleAt = now;

      const roomMsgs = snap.messagesByRoom[chosenRoom.id] ?? [];
      snap.messagesByRoom[chosenRoom.id] = [
        ...roomMsgs,
        {
          id: `msg_bot_${bot.id}_${now}`,
          roomId: chosenRoom.id,
          senderUsername: bot.username,
          senderRole: 'admin' as const,
          senderStaffTier: bot.staffRoleTier,
          senderIsVip: Boolean(bot.isVip),
          text: spoken,
          createdAt: now,
          senderAvatar: {
            equipped: updatedProgress.equipped,
            skinTone: updatedProgress.skinTone,
            avatarGender: updatedProgress.avatarGender,
            customAvatarUrl: updatedProgress.customAvatarUrl,
            avatarDisplayMode: updatedProgress.avatarDisplayMode,
          },
        },
      ].slice(-60);
    }

    nextPresences[botClientId] = {
      clientId: botClientId,
      username: bot.username,
      role: bot.role,
      staffRoleTier: bot.staffRoleTier,
      isVip: Boolean(bot.isVip),
      roomId: chosenRoom.id,
      x: nextX,
      y: nextY,
      facing: nextX >= (existing?.x ?? 50) ? 'right' : 'left',
      equipped: updatedProgress.equipped,
      skinTone: updatedProgress.skinTone,
      avatarGender: updatedProgress.avatarGender,
      customAvatarUrl: updatedProgress.customAvatarUrl,
      avatarDisplayMode: updatedProgress.avatarDisplayMode,
      lastSeen: now,
      isBot: true,
      lastMessage: chatBubbleText,
      lastMessageAt: chatBubbleAt,
    };
    roomsUpdated = true;
  }

  if (roomsUpdated) {
    const nextSnap: SharedRoomsSnapshot = {
      ...snap,
      presences: nextPresences,
    };
    try {
      window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(nextSnap));
    } catch {
      // Silencioso
    }
    broadcastRoomsSync(nextSnap);
  }

  return { roomsUpdated, worldUpdated, logsUpdated, createdSummary };
}

export interface AdminBotOrderInput {
  botAccountId: string;
  action: 'move_room' | 'speak_room' | 'wardrobe_audit' | 'designer_drop' | 'maintenance_scan';
  targetRoomId?: string;
  speechText?: string;
  issuedByEmail: string;
}

export interface AdminBotOrderResult {
  ok: boolean;
  message: string;
  worldUpdated?: boolean;
  logsUpdated?: boolean;
}

/**
 * Painel de Ordens Diretas da Administradora Principal (miranda88686673@gmail.com):
 * envia comandos imediatos para qualquer Bot já existente sem jamais criar novos bots.
 */
export function executeAdminBotOrder(
  input: AdminBotOrderInput,
): AdminBotOrderResult {
  if (typeof window === 'undefined') {
    return { ok: false, message: 'Ambiente de navegador indisponível.' };
  }

  if (input.issuedByEmail.trim().toLowerCase() !== ADMIN_OWNER_EMAIL) {
    return {
      ok: false,
      message: `Acesso restrito: apenas ${ADMIN_OWNER_EMAIL} pode emitir ordens diretas aos bots.`,
    };
  }

  const accounts = loadAccounts();
  const bot = accounts.find((a) => a.id === input.botAccountId && a.isBot);
  if (!bot) {
    return { ok: false, message: 'Bot selecionado não encontrado na equipe.' };
  }

  if (input.action === 'wardrobe_audit') {
    const res = runDesignerWardrobeAudit(`Ordem Direta (${bot.displayName})`);
    return {
      ok: true,
      message:
        res.fixedCount > 0
          ? `${bot.displayName} executou auditoria e corrigiu ${res.fixedCount} peça(s) incompatível(is).`
          : `${bot.displayName} auditou todas as contas e salas: tudo compatível.`,
      worldUpdated: res.worldUpdated,
      logsUpdated: true,
    };
  }

  if (input.action === 'designer_drop') {
    const res = runBotAutonomousLifeTick({ forceDesignerCreation: true });
    return {
      ok: true,
      message:
        res.createdSummary ||
        `Ordem executada: ${bot.displayName} publicou um novo lançamento na Starplaza.`,
      worldUpdated: res.worldUpdated,
      logsUpdated: res.logsUpdated,
    };
  }

  if (input.action === 'maintenance_scan') {
    const res = runAiMaintenanceScan({
      triggeredBy: `Ordem Direta (${bot.displayName})`,
      logHealthyCheck: true,
    });
    return {
      ok: true,
      message:
        res.repairedCount > 0
          ? `${bot.displayName} concluiu varredura e corrigiu ${res.repairedCount} ocorrência(s).`
          : `${bot.displayName} concluiu varredura completa: sistema 100% íntegro.`,
      worldUpdated: res.worldChanged,
      logsUpdated: true,
    };
  }

  // move_room ou speak_room no snapshot das salas
  let snap: SharedRoomsSnapshot;
  try {
    const raw = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    snap = raw
      ? (JSON.parse(raw) as SharedRoomsSnapshot)
      : { presences: {}, messagesByRoom: {}, customRooms: [], kicks: [] };
  } catch {
    snap = { presences: {}, messagesByRoom: {}, customRooms: [], kicks: [] };
  }

  const allRooms = [...GLOBAL_ROOMS, ...(snap.customRooms ?? [])];
  const botClientId = `bot_live_${bot.id}`;
  const existing = snap.presences?.[botClientId];
  const botProgress = loadPlayerProgress(bot.id, bot.avatarGender);
  const now = Date.now();

  const fallbackRoom =
    allRooms.find((r) => (r.serverRegion ?? 'BR') === (bot.serverRegion ?? 'BR')) ??
    GLOBAL_ROOMS[0];
  const currentBotRoom = existing
    ? allRooms.find((r) => r.id === existing.roomId)
    : undefined;
  const targetRoom =
    (input.targetRoomId && allRooms.find((r) => r.id === input.targetRoomId)) ||
    currentBotRoom ||
    fallbackRoom;

  const targetX =
    input.action === 'move_room' || !existing || existing.roomId !== targetRoom.id
      ? 50
      : existing.x;
  const targetY =
    input.action === 'move_room' || !existing || existing.roomId !== targetRoom.id
      ? Math.round((targetRoom.walkMinY + targetRoom.walkMaxY) / 2)
      : existing.y;

  let nextLastMessage = existing?.lastMessage;
  let nextLastMessageAt = existing?.lastMessageAt;

  if (input.action === 'speak_room') {
    const speech = (input.speechText ?? '').trim();
    if (!speech) {
      return { ok: false, message: 'Digite a fala que o bot deve enviar na sala.' };
    }
    nextLastMessage = speech;
    nextLastMessageAt = now;

    const prevMsgs = snap.messagesByRoom?.[targetRoom.id] ?? [];
    snap.messagesByRoom = {
      ...(snap.messagesByRoom ?? {}),
      [targetRoom.id]: [
        ...prevMsgs,
        {
          id: `msg_order_${bot.id}_${now}`,
          roomId: targetRoom.id,
          senderUsername: bot.username,
          senderRole: 'admin' as const,
          senderStaffTier: bot.staffRoleTier,
          senderIsVip: Boolean(bot.isVip),
          text: speech,
          createdAt: now,
          senderAvatar: {
            equipped: botProgress.equipped,
            skinTone: botProgress.skinTone,
            avatarGender: botProgress.avatarGender,
            customAvatarUrl: botProgress.customAvatarUrl,
            avatarDisplayMode: botProgress.avatarDisplayMode,
          },
        },
      ].slice(-60),
    };
  }

  snap.presences = {
    ...(snap.presences ?? {}),
    [botClientId]: {
      clientId: botClientId,
      username: bot.username,
      role: bot.role,
      staffRoleTier: bot.staffRoleTier,
      isVip: Boolean(bot.isVip),
      roomId: targetRoom.id,
      x: targetX,
      y: targetY,
      facing: targetX >= (existing?.x ?? 50) ? 'right' : 'left',
      equipped: botProgress.equipped,
      skinTone: botProgress.skinTone,
      avatarGender: botProgress.avatarGender,
      customAvatarUrl: botProgress.customAvatarUrl,
      avatarDisplayMode: botProgress.avatarDisplayMode,
      lastSeen: now,
      isBot: true,
      lastMessage: nextLastMessage,
      lastMessageAt: nextLastMessageAt,
    },
  };

  try {
    window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(snap));
  } catch {
    // Silencioso
  }
  broadcastRoomsSync(snap);

  appendAiLog({
    botId: bot.id,
    botName: bot.displayName,
    botUsername: bot.username,
    serverRegion: targetRoom.serverRegion ?? bot.serverRegion,
    category: 'moderation',
    issueDetected:
      input.action === 'move_room'
        ? `Ordem direta da Administradora Geral: mover para "${targetRoom.name}".`
        : `Ordem direta da Administradora Geral: enviar mensagem em "${targetRoom.name}".`,
    actionTaken:
      input.action === 'move_room'
        ? `${bot.displayName} entrou na sala "${targetRoom.name}".`
        : `${bot.displayName} disse em "${targetRoom.name}": "${nextLastMessage}"`,
    status: 'healthy',
  });

  return {
    ok: true,
    message:
      input.action === 'move_room'
        ? `${bot.displayName} foi movido imediatamente para "${targetRoom.name}".`
        : `${bot.displayName} falou na sala "${targetRoom.name}".`,
    logsUpdated: true,
  };
}

