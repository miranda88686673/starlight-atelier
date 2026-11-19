import { GLOBAL_ROOMS } from '../data/catalog';
import {
  RoomAvatarPresence,
  RoomChatMessage,
  RoomDef,
  RoomDjTrack,
  RoomId,
  RoomInteractiveProp,
} from '../types/game';
import {
  emitDjMediaSyncToServer,
  emitRoomChatSend,
  emitRoomMutation,
  emitRoomPresenceLeave,
  emitRoomPresenceUpsert,
  emitStatePatchToServer,
} from '../core/state/socketBridge';
import { normalizeUsername } from './storage';

export const ROOMS_STORAGE_KEY = 'starlight_atelier_rooms_v1';
const CHANNEL_NAME = 'starlight_atelier_realtime_v1';
const TAB_CLIENT_KEY = 'starlight_atelier_tab_client_id';
const PRESENCE_TTL_MS = 120_000;

export interface RoomKickNotice {
  roomId: RoomId;
  targetClientId: string;
  targetUsername: string;
  byUsername: string;
  at: number;
}

export interface SharedRoomsSnapshot {
  presences: Record<string, RoomAvatarPresence>;
  messagesByRoom: Record<RoomId, RoomChatMessage[]>;
  customRooms: RoomDef[];
  kicks: RoomKickNotice[];
  djTracksByRoom?: Record<RoomId, RoomDjTrack>;
  officialOverrides?: Record<string, Partial<RoomDef>>;
}

/**
 * Gera ou recupera um ID único por aba do navegador (via sessionStorage).
 * Permite abrir múltiplas abas/janelas no mesmo PC e vê-las como avatares distintos na sala.
 */
export function getTabClientId(): string {
  try {
    const existing = window.sessionStorage.getItem(TAB_CLIENT_KEY);
    if (existing) return existing;
    const created = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    window.sessionStorage.setItem(TAB_CLIENT_KEY, created);
    return created;
  } catch {
    return `cli_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export function getSavedCurrentRoomId(accountId: string): RoomId | null {
  try {
    const tabId = getTabClientId();
    const tabSaved = window.sessionStorage.getItem(
      `starlight_current_room_${tabId}_${accountId}`,
    );
    if (tabSaved) return tabSaved;
    const lsSaved = window.localStorage.getItem(
      `starlight_current_room_${accountId}`,
    );
    return lsSaved || null;
  } catch {
    return null;
  }
}

export function saveCurrentRoomId(accountId: string, roomId: RoomId): void {
  try {
    const tabId = getTabClientId();
    window.sessionStorage.setItem(
      `starlight_current_room_${tabId}_${accountId}`,
      roomId,
    );
    window.localStorage.setItem(`starlight_current_room_${accountId}`, roomId);
  } catch {
    // Silencioso em modo restrito
  }
}

export function getSavedExitedRoomsMode(accountId: string): boolean {
  try {
    const tabId = getTabClientId();
    const tabVal = window.sessionStorage.getItem(
      `starlight_exited_room_${tabId}_${accountId}`,
    );
    if (tabVal !== null) return tabVal === '1';
    return window.localStorage.getItem(`starlight_exited_room_${accountId}`) === '1';
  } catch {
    return false;
  }
}

export function setSavedExitedRoomsMode(
  accountId: string,
  exited: boolean,
): void {
  try {
    const tabId = getTabClientId();
    const val = exited ? '1' : '0';
    window.sessionStorage.setItem(
      `starlight_exited_room_${tabId}_${accountId}`,
      val,
    );
    window.localStorage.setItem(`starlight_exited_room_${accountId}`, val);
  } catch {
    // Silencioso em modo restrito
  }
}

const OFFICIAL_LOUNGE_ROOM_IDS = [
  'lounge_party',
  'lounge_party_es',
  'lounge_party_en',
  'ilha_brasil',
  'ilha_spanish',
  'ilha_english',
];

function createInitialRoomsSnapshot(): SharedRoomsSnapshot {
  const presences: Record<string, RoomAvatarPresence> = {};

  const messagesByRoom: Record<RoomId, RoomChatMessage[]> = {
    lounge_party: [
      {
        id: 'msg_init_lounge_party',
        roomId: 'lounge_party',
        senderUsername: 'Nocturne Vale Club',
        senderRole: 'system',
        text: 'Bem-vinda ao Terraço Oficial Lounge Party (BR)! Aproveite o deck de madeira, os aquários de luxo e a Cabine DJ.',
        createdAt: Date.now() - 60_000,
      },
    ],
    lounge_party_es: [
      {
        id: 'msg_init_lounge_party_es',
        roomId: 'lounge_party_es',
        senderUsername: 'Nocturne Vale Club',
        senderRole: 'system',
        text: '¡Bienvenida a Lounge Party Oficial (ES)! Disfruta la terraza de madera, los acuarios de lujo y la Cabina DJ.',
        createdAt: Date.now() - 60_000,
      },
    ],
    lounge_party_en: [
      {
        id: 'msg_init_lounge_party_en',
        roomId: 'lounge_party_en',
        senderUsername: 'Nocturne Vale Club',
        senderRole: 'system',
        text: 'Welcome to Official Lounge Party (EN)! Enjoy the wooden rooftop deck, luxury fish aquariums & live DJ Booth.',
        createdAt: Date.now() - 60_000,
      },
    ],
    ilha_brasil: [
      {
        id: 'msg_init_ilha_brasil',
        roomId: 'ilha_brasil',
        senderUsername: 'Nocturne Vale Club',
        senderRole: 'system',
        text: 'Bem-vindo(a) à Ilha Brasil! Curta a praia, as cadeirinhas de madeira, os peixes saltando e as 3 Cabines de DJ ao vivo!',
        createdAt: Date.now() - 60_000,
      },
    ],
    ilha_spanish: [
      {
        id: 'msg_init_ilha_spanish',
        roomId: 'ilha_spanish',
        senderUsername: 'Nocturne Vale Club',
        senderRole: 'system',
        text: '¡Bienvenido(a) a Ilha Spanish! Disfruta la playa, las sillas de madera, los peces saltando y las 3 Cabinas de DJ!',
        createdAt: Date.now() - 60_000,
      },
    ],
    ilha_english: [
      {
        id: 'msg_init_ilha_english',
        roomId: 'ilha_english',
        senderUsername: 'Nocturne Vale Club',
        senderRole: 'system',
        text: 'Welcome to Ilha English! Relax on the wooden beach chairs, watch the jumping fish & party at the 3 live DJ Booths!',
        createdAt: Date.now() - 60_000,
      },
    ],
  };

  return {
    presences,
    messagesByRoom,
    customRooms: [],
    kicks: [],
    djTracksByRoom: {},
    officialOverrides: {},
  };
}

/**
 * Lê e limpa presenças expiradas, NPCs figurantes legados e bots com circulação desligada.
 */
export function readRoomsSnapshot(): SharedRoomsSnapshot {
  try {
    const raw = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    const now = Date.now();
    if (!raw) {
      const initial = createInitialRoomsSnapshot();
      window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed = JSON.parse(raw) as Partial<SharedRoomsSnapshot>;
    const fallback = createInitialRoomsSnapshot();

    const customRooms = Array.isArray(parsed.customRooms) ? parsed.customRooms : [];
    const validRoomIds = new Set<string>([
      ...OFFICIAL_LOUNGE_ROOM_IDS,
      ...customRooms.map((r) => r.id),
    ]);

    const cleanedPresences: Record<string, RoomAvatarPresence> = {};
    const sourcePresences = parsed.presences ?? {};

    Object.values(sourcePresences).forEach((entry) => {
      if (!entry || !entry.clientId) return;
      if (
        entry.isBot ||
        entry.clientId.startsWith('npc_') ||
        entry.clientId.startsWith('bot_live_')
      ) {
        return;
      }
      if (now - entry.lastSeen < PRESENCE_TTL_MS) {
        cleanedPresences[entry.clientId] = validRoomIds.has(entry.roomId)
          ? entry
          : { ...entry, roomId: 'lounge_party' };
      }
    });

    const messagesByRoom: Record<RoomId, RoomChatMessage[]> = {
      ...fallback.messagesByRoom,
    };
    for (const [rid, msgs] of Object.entries(parsed.messagesByRoom ?? {})) {
      if (validRoomIds.has(rid) && Array.isArray(msgs)) {
        messagesByRoom[rid] = msgs;
      }
    }
    const kicks = Array.isArray(parsed.kicks)
      ? parsed.kicks.filter((k) => now - k.at < 30_000)
      : [];
    const djTracksByRoom = parsed.djTracksByRoom ?? {};
    const officialOverrides = parsed.officialOverrides ?? {};

    return {
      presences: cleanedPresences,
      messagesByRoom,
      customRooms,
      kicks,
      djTracksByRoom,
      officialOverrides,
    };
  } catch {
    return createInitialRoomsSnapshot();
  }
}

function saveRoomsLocalAndBroadcastChannel(
  snapshot: SharedRoomsSnapshot,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  try {
    window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Silencioso em modo restrito
  }
  if (channel) {
    try {
      channel.postMessage({ type: 'rooms:sync', snapshot });
    } catch {
      // Canal já fechado
    }
  }
  return snapshot;
}

function writeAndBroadcastSnapshot(
  snapshot: SharedRoomsSnapshot,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  saveRoomsLocalAndBroadcastChannel(snapshot, channel);
  emitStatePatchToServer({ roomsSnapshot: snapshot });
  return snapshot;
}

/** Cria o canal de comunicação em tempo real entre abas/janelas */
export function createRealtimeChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  return new BroadcastChannel(CHANNEL_NAME);
}

/** Atualiza ou insere a presença de um avatar em uma sala (delta atômico sem sobrescrever outros IPs) */
export function upsertAvatarPresence(
  presence: RoomAvatarPresence,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const stamped: RoomAvatarPresence = { ...presence, lastSeen: Date.now() };
  const next: SharedRoomsSnapshot = {
    ...current,
    presences: {
      ...current.presences,
      [stamped.clientId]: stamped,
    },
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (!emitRoomPresenceUpsert(stamped)) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/** Remove a presença de uma aba quando o jogador sai da sala ou fecha a guia */
export function removeAvatarPresence(
  clientId: string,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  if (!current.presences[clientId]) return current;
  const nextPresences = { ...current.presences };
  delete nextPresences[clientId];
  const next: SharedRoomsSnapshot = { ...current, presences: nextPresences };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (!emitRoomPresenceLeave(clientId)) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/** Publica mensagem no chat de uma sala e atualiza o balão de fala sobre o avatar */
export function appendRoomMessage(
  roomId: RoomId,
  message: RoomChatMessage,
  senderClientId: string | null,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const prevRoomMsgs = current.messagesByRoom[roomId] ?? [];
  const nextRoomMsgs = [...prevRoomMsgs, message].slice(-80);

  const nextPresences = { ...current.presences };
  if (message.senderRole !== 'system' && message.text) {
    const normSender = normalizeUsername(message.senderUsername);
    if (senderClientId && nextPresences[senderClientId]) {
      nextPresences[senderClientId] = {
        ...nextPresences[senderClientId],
        lastMessage: message.text,
        lastMessageAt: message.createdAt,
        lastSeen: Date.now(),
      };
    }
    for (const [cid, pres] of Object.entries(nextPresences)) {
      if (pres && normalizeUsername(pres.username) === normSender) {
        nextPresences[cid] = {
          ...pres,
          lastMessage: message.text,
          lastMessageAt: message.createdAt,
          lastSeen: Date.now(),
        };
      }
    }
  }

  const next: SharedRoomsSnapshot = {
    ...current,
    presences: nextPresences,
    messagesByRoom: {
      ...current.messagesByRoom,
      [roomId]: nextRoomMsgs,
    },
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (!emitRoomChatSend(roomId, message, senderClientId)) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/** Limpa o histórico de mensagens de uma sala (comando /limpar da Staff) */
export function clearRoomMessages(
  roomId: RoomId,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const allRooms = [...GLOBAL_ROOMS, ...current.customRooms];
  const roomDef = allRooms.find((r) => r.id === roomId);
  const next: SharedRoomsSnapshot = {
    ...current,
    messagesByRoom: {
      ...current.messagesByRoom,
      [roomId]: [
        {
          id: `msg_clear_${Date.now()}`,
          roomId,
          senderUsername: 'Moderação',
          senderRole: 'system',
          text: `Histórico do chat de ${roomDef?.name ?? 'sala'} limpo pela Staff.`,
          createdAt: Date.now(),
        },
      ],
    },
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (!emitRoomMutation({ type: 'clear_messages', roomId })) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/** Cria uma nova sala personalizada (Pública ou Privada) visível no Lobby global */
export function createCustomRoom(
  room: RoomDef,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const welcomeMsg: RoomChatMessage = {
    id: `msg_created_${Date.now()}`,
    roomId: room.id,
    senderUsername: 'Sistema',
    senderRole: 'system',
    text: `Sala "${room.name}" criada por ${room.creatorUsername ?? 'anfitriao'}.`,
    createdAt: Date.now(),
  };

  const next: SharedRoomsSnapshot = {
    ...current,
    customRooms: [room, ...current.customRooms],
    messagesByRoom: {
      ...current.messagesByRoom,
      [room.id]: [welcomeMsg],
    },
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (!emitRoomMutation({ type: 'create_custom', room })) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/** Remove uma sala personalizada e move eventuais participantes para o Lounge Principal */
export function deleteCustomRoom(
  roomId: RoomId,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const nextPresences = { ...current.presences };
  Object.keys(nextPresences).forEach((cid) => {
    if (nextPresences[cid].roomId === roomId) {
      nextPresences[cid] = {
        ...nextPresences[cid],
        roomId: 'lounge_party',
        x: 50,
        y: 72,
      };
    }
  });

  const nextMessages = { ...current.messagesByRoom };
  delete nextMessages[roomId];

  const next: SharedRoomsSnapshot = {
    ...current,
    presences: nextPresences,
    customRooms: current.customRooms.filter((r) => r.id !== roomId),
    messagesByRoom: nextMessages,
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (!emitRoomMutation({ type: 'delete_custom', roomId })) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/** Atualiza o aviso local de uma sala personalizada (permissão do Dono da Sala) */
export function updateCustomRoomNotice(
  roomId: RoomId,
  roomNotice: string,
  byUsername: string,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const trimmed = roomNotice.trim();
  const nextRooms = current.customRooms.map((r) =>
    r.id === roomId ? { ...r, roomNotice: trimmed || undefined } : r,
  );

  const prevMsgs = current.messagesByRoom[roomId] ?? [];
  const sysMsg: RoomChatMessage = {
    id: `msg_rnotice_${Date.now()}`,
    roomId,
    senderUsername: 'Dono da Sala',
    senderRole: 'system',
    text: trimmed
      ? `${byUsername} definiu o aviso da sala: "${trimmed}"`
      : `${byUsername} removeu o aviso da sala.`,
    createdAt: Date.now(),
  };

  const next: SharedRoomsSnapshot = {
    ...current,
    customRooms: nextRooms,
    messagesByRoom: {
      ...current.messagesByRoom,
      [roomId]: [...prevMsgs, sysMsg].slice(-80),
    },
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (
    !emitRoomMutation({
      type: 'update_custom',
      roomId,
      patch: { roomNotice: trimmed || null, byUsername },
    })
  ) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/** Atualiza ou remove a imagem de fundo do PC aplicada a uma sala customizada */
export function updateCustomRoomBackground(
  roomId: RoomId,
  customBackgroundImageUrl: string | undefined,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const nextRooms = current.customRooms.map((r) =>
    r.id === roomId ? { ...r, customBackgroundImageUrl } : r,
  );
  const next: SharedRoomsSnapshot = {
    ...current,
    customRooms: nextRooms,
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (
    !emitRoomMutation({
      type: 'update_custom',
      roomId,
      patch: { customBackgroundImageUrl: customBackgroundImageUrl ?? null },
    })
  ) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/** Expulsa um avatar intruso de uma sala para o Lounge Principal (privilégio do criador da sala) */
export function kickAvatarFromRoom(
  roomId: RoomId,
  targetClientId: string,
  targetUsername: string,
  byUsername: string,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const nextPresences = { ...current.presences };

  if (nextPresences[targetClientId]) {
    nextPresences[targetClientId] = {
      ...nextPresences[targetClientId],
      roomId: 'lounge_party',
      x: 50,
      y: 74,
    };
  }

  const prevMsgs = current.messagesByRoom[roomId] ?? [];
  const kickMsg: RoomChatMessage = {
    id: `msg_kick_${Date.now()}`,
    roomId,
    senderUsername: 'Moderação Local',
    senderRole: 'system',
    text: `${targetUsername} foi expulsa desta sala pelo anfitrião ${byUsername}.`,
    createdAt: Date.now(),
  };

  const next: SharedRoomsSnapshot = {
    ...current,
    presences: nextPresences,
    messagesByRoom: {
      ...current.messagesByRoom,
      [roomId]: [...prevMsgs, kickMsg].slice(-80),
    },
    kicks: [
      ...current.kicks,
      {
        roomId,
        targetClientId,
        targetUsername,
        byUsername,
        at: Date.now(),
      },
    ],
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (
    !emitRoomMutation({
      type: 'kick_avatar',
      roomId,
      targetClientId,
      targetUsername,
      byUsername,
    })
  ) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/**
 * Filtro de moderação de palavras proibidas.
 * Bloqueia envio quando detectar termos listados em `bannedWords`.
 */
export function checkChatModeration(
  text: string,
  bannedWords: string[],
): { blocked: boolean; matchedWord?: string } {
  const normalized = text.toLowerCase();
  for (const rawWord of bannedWords) {
    const word = rawWord.trim().toLowerCase();
    if (!word) continue;
    if (normalized.includes(word)) {
      return { blocked: true, matchedWord: word };
    }
  }
  return { blocked: false };
}

/**
 * Define ou atualiza a faixa musical (YouTube) tocando na Cabine de DJ da sala.
 */
export function setRoomDjTrack(
  roomId: RoomId,
  track: RoomDjTrack,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const nextTracks = {
    ...(current.djTracksByRoom ?? {}),
    [roomId]: track,
  };
  emitDjMediaSyncToServer({
    roomId,
    video_id: track.videoId,
    started_at: track.startedAt,
    is_playing: track.isPlaying,
    title: track.title,
    youtubeUrl: track.youtubeUrl,
    addedBy: track.addedBy,
    queue: track.queue,
  });
  return writeAndBroadcastSnapshot(
    {
      ...current,
      djTracksByRoom: nextTracks,
    },
    channel,
  );
}

/**
 * Remove ou encerra a música da Cabine de DJ na sala especificada.
 */
export function clearRoomDjTrack(
  roomId: RoomId,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const nextTracks = { ...(current.djTracksByRoom ?? {}) };
  delete nextTracks[roomId];
  emitDjMediaSyncToServer({ roomId, stop: true });
  return writeAndBroadcastSnapshot(
    {
      ...current,
      djTracksByRoom: nextTracks,
    },
    channel,
  );
}

/**
 * Atualiza configurações, móveis e equipe de Suporte Oficial de salas oficiais (privilégio exclusivo de Administrador).
 */
export function updateOfficialRoomSettings(
  roomIds: RoomId | RoomId[],
  updates: Partial<RoomDef>,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const prevOverrides = current.officialOverrides ?? {};
  const ids = Array.isArray(roomIds) ? roomIds : [roomIds];
  const nextOverrides = { ...prevOverrides };
  for (const id of ids) {
    nextOverrides[id] = {
      ...(nextOverrides[id] ?? {}),
      ...updates,
    };
  }
  const next: SharedRoomsSnapshot = {
    ...current,
    officialOverrides: nextOverrides,
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (
    !emitRoomMutation({
      type: 'update_official',
      roomIds: ids,
      updates: {
        backdropTheme: updates.backdropTheme,
        interactiveProps: updates.interactiveProps,
        supportStaff: updates.supportStaff,
      },
    })
  ) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/**
 * Atualiza móveis / adereços interativos de uma sala personalizada do usuário (dono da sala)
 */
export function updateCustomRoomProps(
  roomId: RoomId,
  interactiveProps: RoomInteractiveProp[],
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const nextRooms = current.customRooms.map((r) =>
    r.id === roomId ? { ...r, interactiveProps } : r,
  );
  const next: SharedRoomsSnapshot = {
    ...current,
    customRooms: nextRooms,
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (
    !emitRoomMutation({
      type: 'update_custom',
      roomId,
      patch: { interactiveProps },
    })
  ) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

/**
 * Atualiza a equipe de empregos e taxas AM de uma sala criada por usuário (apenas Dono da Sala).
 */
export function updateCustomRoomEmployees(
  roomId: RoomId,
  employees: NonNullable<RoomDef['employees']>,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const nextRooms = current.customRooms.map((r) =>
    r.id === roomId ? { ...r, employees } : r,
  );
  const next: SharedRoomsSnapshot = {
    ...current,
    customRooms: nextRooms,
  };
  saveRoomsLocalAndBroadcastChannel(next, channel);
  if (
    !emitRoomMutation({
      type: 'update_custom',
      roomId,
      patch: { employees },
    })
  ) {
    emitStatePatchToServer({ roomsSnapshot: next });
  }
  return next;
}

