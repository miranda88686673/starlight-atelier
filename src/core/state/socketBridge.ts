/**
 * Ponte singleton entre os módulos de dados do Frontend e o servidor Node.js + Socket.io.
 * Evita loops de eco durante hidratação remota e garante que toda mutação seja sincronizada com o servidor.
 */

import type { Socket } from 'socket.io-client';
import type {
  DjMediaSyncPayload,
  PresenceHeartbeatRecord,
  ServerDatabaseDocument,
  StaffAuditLogEntry,
  StateSyncPatchPayload,
} from '../schemas/dbSchema';
import type {
  BanReviewRequest,
  PremiumOrder,
  PremiumPixConfig,
  RoomDjTrack,
  RoomHealthMetric,
  RoomId,
  SupportTicket,
} from '../../types/game';

export interface RoomTerminatedNotice {
  roomId: string;
  fallbackRoomId: string;
  evacuatedCount: number;
  reason: string;
  terminatedBy: string;
}

export type RemoteSyncListener = {
  onInit?: (snapshot: ServerDatabaseDocument) => void;
  onPatch?: (patch: StateSyncPatchPayload & { version?: number }) => void;
  onPresence?: (presences: Record<string, PresenceHeartbeatRecord>) => void;
  onDjSynced?: (data: { roomId: RoomId; track: RoomDjTrack | null }) => void;
  onAuditUpdated?: (logs: StaffAuditLogEntry[]) => void;
  onRoomHealthUpdated?: (metrics: RoomHealthMetric[]) => void;
  onRoomTerminated?: (notice: RoomTerminatedNotice) => void;
  onSupportTicketUpdated?: (tickets: SupportTicket[]) => void;
  onBanReviewUpdated?: (reviews: BanReviewRequest[]) => void;
  onPremiumOrdersUpdated?: (orders: PremiumOrder[]) => void;
  onPremiumPixUpdated?: (config: PremiumPixConfig) => void;
};

let activeSocket: Socket | null = null;
let applyingRemoteSync = false;
const listeners = new Set<RemoteSyncListener>();

export function setActiveSyncSocket(socket: Socket | null): void {
  activeSocket = socket;
}

export function getActiveSyncSocket(): Socket | null {
  return activeSocket;
}

export function isApplyingRemoteState(): boolean {
  return applyingRemoteSync;
}

export function runWithRemoteSyncLock(fn: () => void): void {
  applyingRemoteSync = true;
  try {
    fn();
  } finally {
    applyingRemoteSync = false;
  }
}

export function subscribeRemoteSync(listener: RemoteSyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyRemoteInit(snapshot: ServerDatabaseDocument): void {
  listeners.forEach((l) => l.onInit?.(snapshot));
}

export function notifyRemotePatch(
  patch: StateSyncPatchPayload & { version?: number },
): void {
  listeners.forEach((l) => l.onPatch?.(patch));
}

export function notifyRemotePresence(
  presences: Record<string, PresenceHeartbeatRecord>,
): void {
  listeners.forEach((l) => l.onPresence?.(presences));
}

export function notifyRemoteDjSynced(data: {
  roomId: RoomId;
  track: RoomDjTrack | null;
}): void {
  listeners.forEach((l) => l.onDjSynced?.(data));
}

export function notifyRemoteAuditUpdated(logs: StaffAuditLogEntry[]): void {
  listeners.forEach((l) => l.onAuditUpdated?.(logs));
}

export function notifyRemoteRoomHealth(metrics: RoomHealthMetric[]): void {
  listeners.forEach((l) => l.onRoomHealthUpdated?.(metrics));
}

export function notifyRemoteRoomTerminated(notice: RoomTerminatedNotice): void {
  listeners.forEach((l) => l.onRoomTerminated?.(notice));
}

export function notifyRemoteSupportTickets(tickets: SupportTicket[]): void {
  listeners.forEach((l) => l.onSupportTicketUpdated?.(tickets));
}

export function notifyRemoteBanReviews(reviews: BanReviewRequest[]): void {
  listeners.forEach((l) => l.onBanReviewUpdated?.(reviews));
}

export function notifyRemotePremiumOrders(orders: PremiumOrder[]): void {
  listeners.forEach((l) => l.onPremiumOrdersUpdated?.(orders));
}

export function notifyRemotePremiumPix(config: PremiumPixConfig): void {
  listeners.forEach((l) => l.onPremiumPixUpdated?.(config));
}

export function emitRoomTelemetryPing(roomId: RoomId, latencyMs = 28): void {
  if (activeSocket && activeSocket.connected && roomId) {
    activeSocket.emit('room:telemetry_ping', { roomId, latencyMs });
  }
}

/** Envia atualização parcial para o servidor Socket.io (com fallback REST se desconectado) */
export function emitStatePatchToServer(patch: StateSyncPatchPayload): void {
  if (applyingRemoteSync) return;

  if (activeSocket && activeSocket.connected) {
    activeSocket.emit('state:sync_patch', patch);
    return;
  }

  if (typeof fetch !== 'undefined') {
    void fetch('/api/state/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => undefined);
  }
}

/** Envia atualização de mídia sincronizada (YouTube DJ) pelo Socket.io */
export function emitDjMediaSyncToServer(
  payload: DjMediaSyncPayload | { roomId: RoomId; stop: true },
): void {
  if (applyingRemoteSync) return;
  if (activeSocket && activeSocket.connected) {
    activeSocket.emit('media:dj_sync', payload);
  }
}
