import { GLOBAL_ROOMS } from '../data/catalog';
import {
  RoomAvatarPresence,
  RoomChatMessage,
  RoomDef,
  RoomDjTrack,
  RoomId,
} from '../types/game';
import { loadAccounts } from './storage';
import {
  emitDjMediaSyncToServer,
  emitStatePatchToServer,
} from '../core/state/socketBridge';

const ROOMS_STORAGE_KEY = 'starlight_atelier_rooms_v1';
const CHANNEL_NAME = 'starlight_atelier_realtime_v1';
const TAB_CLIENT_KEY = 'starlight_atelier_tab_client_id';
const PRESENCE_TTL_MS = 60_000;

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

function createInitialRoomsSnapshot(): SharedRoomsSnapshot {
  const presences: Record<string, RoomAvatarPresence> = {};

  const messagesByRoom: Record<RoomId, RoomChatMessage[]> = {
    lounge_principal: [
      {
        id: 'msg_init_lounge',
        roomId: 'lounge_principal',
        senderUsername: 'Sistema',
        senderRole: 'system',
        text: 'Bem-vinda ao Lounge Principal! Clique no piso para caminhar ou use o chat ao lado.',
        createdAt: Date.now() - 60_000,
      },
    ],
    cafe_starlight: [
      {
        id: 'msg_init_cafe',
        roomId: 'cafe_starlight',
        senderUsername: 'Sistema',
        senderRole: 'system',
        text: 'Você entrou no Café Starlight. Aproveite o encontro!',
        createdAt: Date.now() - 60_000,
      },
    ],
    festa_cobertura: [
      {
        id: 'msg_init_party',
        roomId: 'festa_cobertura',
        senderUsername: 'Sistema',
        senderRole: 'system',
        text: 'Terraço aberto! Convide amigas em outras abas do navegador para conversar ao vivo.',
        createdAt: Date.now() - 60_000,
      },
    ],
  };

  return { presences, messagesByRoom, customRooms: [], kicks: [], djTracksByRoom: {} };
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

    const accounts = loadAccounts();
    const activeRoamingBotsById = new Set(
      accounts
        .filter((a) => a.isBot && a.botActive !== false && a.botRoamRooms !== false)
        .map((a) => `bot_live_${a.id}`),
    );

    const cleanedPresences: Record<string, RoomAvatarPresence> = {};
    const sourcePresences = parsed.presences ?? {};

    Object.values(sourcePresences).forEach((entry) => {
      if (!entry || !entry.clientId) return;
      // Expurga imediatamente qualquer figurante estático legado (npc_*)
      if (entry.clientId.startsWith('npc_')) return;

      if (entry.isBot) {
        if (
          entry.clientId.startsWith('bot_live_') &&
          !activeRoamingBotsById.has(entry.clientId)
        ) {
          return;
        }
        cleanedPresences[entry.clientId] = { ...entry, lastSeen: now };
      } else if (now - entry.lastSeen < PRESENCE_TTL_MS) {
        cleanedPresences[entry.clientId] = entry;
      }
    });

    const messagesByRoom: Record<RoomId, RoomChatMessage[]> = {
      ...fallback.messagesByRoom,
      ...(parsed.messagesByRoom ?? {}),
    };

    const customRooms = Array.isArray(parsed.customRooms) ? parsed.customRooms : [];
    const kicks = Array.isArray(parsed.kicks)
      ? parsed.kicks.filter((k) => now - k.at < 30_000)
      : [];
    const djTracksByRoom = parsed.djTracksByRoom ?? {};

    return {
      presences: cleanedPresences,
      messagesByRoom,
      customRooms,
      kicks,
      djTracksByRoom,
    };
  } catch {
    return createInitialRoomsSnapshot();
  }
}

function writeAndBroadcastSnapshot(
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

/** Atualiza ou insere a presença de um avatar em uma sala */
export function upsertAvatarPresence(
  presence: RoomAvatarPresence,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const next: SharedRoomsSnapshot = {
    ...current,
    presences: {
      ...current.presences,
      [presence.clientId]: { ...presence, lastSeen: Date.now() },
    },
  };
  return writeAndBroadcastSnapshot(next, channel);
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
  return writeAndBroadcastSnapshot(
    { ...current, presences: nextPresences },
    channel,
  );
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
  const nextRoomMsgs = [...prevRoomMsgs, message].slice(-60);

  const nextPresences = { ...current.presences };
  if (senderClientId && nextPresences[senderClientId] && message.senderRole !== 'system') {
    nextPresences[senderClientId] = {
      ...nextPresences[senderClientId],
      lastMessage: message.text,
      lastMessageAt: message.createdAt,
      lastSeen: Date.now(),
    };
  }

  return writeAndBroadcastSnapshot(
    {
      ...current,
      presences: nextPresences,
      messagesByRoom: {
        ...current.messagesByRoom,
        [roomId]: nextRoomMsgs,
      },
    },
    channel,
  );
}

/** Limpa o histórico de mensagens de uma sala (comando /limpar da Staff) */
export function clearRoomMessages(
  roomId: RoomId,
  channel: BroadcastChannel | null,
): SharedRoomsSnapshot {
  const current = readRoomsSnapshot();
  const allRooms = [...GLOBAL_ROOMS, ...current.customRooms];
  const roomDef = allRooms.find((r) => r.id === roomId);
  return writeAndBroadcastSnapshot(
    {
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
    },
    channel,
  );
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

  return writeAndBroadcastSnapshot(
    {
      ...current,
      customRooms: [room, ...current.customRooms],
      messagesByRoom: {
        ...current.messagesByRoom,
        [room.id]: [welcomeMsg],
      },
    },
    channel,
  );
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
        roomId: 'lounge_principal',
        x: 50,
        y: 72,
      };
    }
  });

  const nextMessages = { ...current.messagesByRoom };
  delete nextMessages[roomId];

  return writeAndBroadcastSnapshot(
    {
      ...current,
      presences: nextPresences,
      customRooms: current.customRooms.filter((r) => r.id !== roomId),
      messagesByRoom: nextMessages,
    },
    channel,
  );
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

  return writeAndBroadcastSnapshot(
    {
      ...current,
      customRooms: nextRooms,
      messagesByRoom: {
        ...current.messagesByRoom,
        [roomId]: [...prevMsgs, sysMsg].slice(-60),
      },
    },
    channel,
  );
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
      roomId: 'lounge_principal',
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

  return writeAndBroadcastSnapshot(
    {
      ...current,
      presences: nextPresences,
      messagesByRoom: {
        ...current.messagesByRoom,
        [roomId]: [...prevMsgs, kickMsg].slice(-60),
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
    },
    channel,
  );
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
