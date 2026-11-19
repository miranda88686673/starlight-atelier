import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  AvatarGender,
  PlayerProgressState,
  RoomChatMessage,
  RoomDjQueuedTrack,
  RoomDjTrack,
  RoomId,
  ServerRegion,
  SupportTicket,
  UserAccount,
  UserRole,
} from './types/game';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

// ── Blueprint-synchronized sanitizers (mirrors firebase-blueprint.json) ──
const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_USERNAME_REGEX = /^[a-zA-Z0-9_.\- ]+$/;
const VALID_GENDERS: readonly AvatarGender[] = ['feminino', 'masculino', 'neutro'];
const VALID_REGIONS: readonly ServerRegion[] = ['BR', 'ES', 'EN'];
const VALID_CATEGORIES = ['login', 'economia', 'ban_review', 'bug', 'geral'] as const;
const ADMIN_OWNER_EMAIL = 'miranda88686673@gmail.com';

function sanitizeId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length >= 1 && VALID_ID_REGEX.test(cleaned)
    ? cleaned
    : `${fallbackPrefix}_${Date.now()}`;
}

function sanitizeUsername(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_.\- ]/g, '')
    .slice(0, 24);
  if (cleaned.length >= 3 && VALID_USERNAME_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `Player_${Date.now().toString().slice(-4)}`;
}

function sanitizeDisplayName(raw: string, fallbackUsername: string): string {
  const cleaned = raw.trim().slice(0, 32);
  return cleaned.length >= 2 ? cleaned : fallbackUsername.slice(0, 32);
}

function pickGender(gender?: AvatarGender): AvatarGender {
  return gender && VALID_GENDERS.includes(gender) ? gender : 'feminino';
}

function pickRegion(region?: ServerRegion): ServerRegion {
  return region && VALID_REGIONS.includes(region) ? region : 'BR';
}

export async function syncAuthenticatedUserToFirestore(params: {
  uid: string;
  account: UserAccount;
  progress: PlayerProgressState;
}): Promise<void> {
  const current = auth.currentUser;
  if (!current || !current.emailVerified || current.uid !== params.uid) {
    return;
  }

  const uid = sanitizeId(params.uid, 'user');
  const username = sanitizeUsername(params.account.username);
  const displayName = sanitizeDisplayName(params.account.displayName, username);
  const email = (current.email || params.account.email || '').trim().slice(0, 160);
  if (email.length < 5) return;

  const avatarGender = pickGender(params.progress.avatarGender ?? params.account.avatarGender);
  const serverRegion = pickRegion(params.account.serverRegion);
  const isVerifiedAdmin =
    current.email?.toLowerCase() === ADMIN_OWNER_EMAIL && current.emailVerified;

  // 1. /users/{userId} (PII isolated)
  const userPath = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const existingUser = await getDoc(userRef);
    if (!existingUser.exists()) {
      await setDoc(userRef, {
        uid,
        username,
        displayName,
        email,
        avatarGender,
        serverRegion,
        role: 'player',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        username,
        displayName,
        avatarGender,
        serverRegion,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  // 2. /publicProfiles/{userId} (No PII)
  const publicPath = `publicProfiles/${uid}`;
  try {
    const publicRef = doc(db, 'publicProfiles', uid);
    const existingPublic = await getDoc(publicRef);
    const safeLevel = Math.max(1, Math.min(999, Math.round(params.progress.level || 1)));
    const safeVip = Boolean(params.account.isVip);
    if (!existingPublic.exists()) {
      await setDoc(publicRef, {
        uid,
        username,
        displayName,
        avatarGender,
        serverRegion,
        level: isVerifiedAdmin ? safeLevel : 1,
        isVip: isVerifiedAdmin ? safeVip : false,
        updatedAt: serverTimestamp(),
      });
    } else {
      const updatePayload: Record<string, unknown> = {
        username,
        displayName,
        avatarGender,
        serverRegion,
        updatedAt: serverTimestamp(),
      };
      if (isVerifiedAdmin) {
        updatePayload.level = safeLevel;
        updatePayload.isVip = safeVip;
      }
      await updateDoc(publicRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  // 3. /playerProgress/{userId}
  const progressPath = `playerProgress/${uid}`;
  try {
    const progRef = doc(db, 'playerProgress', uid);
    const existingProg = await getDoc(progRef);
    const safeSkin = sanitizeId(params.progress.skinTone || 'pessego', 'pessego').slice(0, 32);
    if (!existingProg.exists()) {
      await setDoc(progRef, {
        uid,
        starcoins: isVerifiedAdmin
          ? Math.max(0, Math.min(100000000, Math.round(params.progress.starcoins ?? 1200)))
          : 1200,
        level: isVerifiedAdmin
          ? Math.max(1, Math.min(999, Math.round(params.progress.level ?? 1)))
          : 1,
        xp: isVerifiedAdmin
          ? Math.max(0, Math.min(100000000, Math.round(params.progress.xp ?? 0)))
          : 0,
        skinTone: safeSkin,
        avatarGender,
        updatedAt: serverTimestamp(),
      });
    } else {
      const updatePayload: Record<string, unknown> = {
        skinTone: safeSkin,
        avatarGender,
        updatedAt: serverTimestamp(),
      };
      if (isVerifiedAdmin) {
        updatePayload.starcoins = Math.max(
          0,
          Math.min(100000000, Math.round(params.progress.starcoins ?? 1200)),
        );
        updatePayload.level = Math.max(1, Math.min(999, Math.round(params.progress.level ?? 1)));
        updatePayload.xp = Math.max(0, Math.min(100000000, Math.round(params.progress.xp ?? 0)));
      }
      await updateDoc(progRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, progressPath);
  }
}

export async function createSupportTicketInFirestore(ticket: {
  id: string;
  requesterUsername: string;
  category: SupportTicket['category'];
  serverRegion: ServerRegion;
  subject: string;
  firstMessageText?: string;
}): Promise<void> {
  const current = auth.currentUser;
  if (!current || !current.emailVerified) return;

  const ticketId = sanitizeId(ticket.id, 'tkt');
  const authorUid = sanitizeId(current.uid, 'usr');
  const requesterUsername = ticket.requesterUsername.trim().slice(0, 48) || 'Jogador';
  const subject = ticket.subject.trim().slice(0, 120) || 'Ticket de Suporte';
  const category =
    ticket.category && (VALID_CATEGORIES as readonly string[]).includes(ticket.category)
      ? ticket.category
      : 'geral';
  const serverRegion = pickRegion(ticket.serverRegion);

  const ticketPath = `supportTickets/${ticketId}`;
  try {
    await setDoc(doc(db, 'supportTickets', ticketId), {
      id: ticketId,
      authorUid,
      requesterUsername: requesterUsername.length >= 2 ? requesterUsername : 'Jogador',
      category,
      serverRegion,
      subject: subject.length >= 2 ? subject : 'Suporte',
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ticketPath);
  }

  const msgText = (ticket.firstMessageText || '').trim().slice(0, 800);
  if (msgText) {
    const messageId = sanitizeId(`tmsg_${Date.now()}`, 'tmsg');
    const msgPath = `supportTickets/${ticketId}/messages/${messageId}`;
    try {
      await setDoc(doc(db, 'supportTickets', ticketId, 'messages', messageId), {
        id: messageId,
        ticketId,
        ticketAuthorUid: authorUid,
        authorUid,
        senderRole: 'player',
        senderName: requesterUsername.slice(0, 48) || 'Jogador',
        text: msgText,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, msgPath);
    }
  }
}

export function subscribeUserProgressFromFirestore(
  uid: string,
  onProgress: (data: { skinTone?: string; avatarGender?: AvatarGender; level?: number; starcoins?: number }) => void,
): Unsubscribe {
  const safeUid = sanitizeId(uid, 'usr');
  const path = `playerProgress/${safeUid}`;
  return onSnapshot(
    doc(db, 'playerProgress', safeUid),
    (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        onProgress({
          skinTone: typeof d.skinTone === 'string' ? d.skinTone : undefined,
          avatarGender: pickGender(d.avatarGender as AvatarGender | undefined),
          level: typeof d.level === 'number' ? d.level : undefined,
          starcoins: typeof d.starcoins === 'number' ? d.starcoins : undefined,
        });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}

export async function listMyFirestoreTickets(uid: string): Promise<Array<Record<string, unknown>>> {
  const safeUid = sanitizeId(uid, 'usr');
  const path = 'supportTickets';
  try {
    const q = query(collection(db, path), where('authorUid', '==', safeUid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function resolveFirestoreTimestampMs(raw: unknown, fallbackId?: string): number {
  if (raw instanceof Timestamp) {
    return raw.toMillis();
  }
  if (
    raw &&
    typeof raw === 'object' &&
    'toMillis' in raw &&
    typeof (raw as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (raw as { toMillis: () => number }).toMillis();
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (fallbackId) {
    const match = /^msg_(?:[a-z]+_)?(\d{10,15})/.exec(fallbackId);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return Date.now();
}

export async function sendRoomMessageToFirestore(params: {
  id?: string;
  roomId: RoomId;
  senderUsername: string;
  senderRole?: UserRole | 'system';
  isVip?: boolean;
  text: string;
}): Promise<string | null> {
  const current = auth.currentUser;
  if (!current || !current.emailVerified) {
    return null;
  }

  const safeText = params.text.trim().slice(0, 180);
  if (!safeText) {
    return null;
  }

  const rawId =
    params.id?.trim() ||
    `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let messageId = sanitizeId(rawId, 'msg');
  if (messageId.length < 3) {
    messageId = `msg_${messageId}_${Date.now()}`.slice(0, 128);
  }

  const safeRoomId = sanitizeId(params.roomId || 'lounge_party', 'lounge').slice(0, 64);
  const authorUid = sanitizeId(current.uid, 'usr');
  const cleanedSender = params.senderUsername.trim().slice(0, 48);
  const senderUsername = cleanedSender.length >= 2 ? cleanedSender : 'Jogador';

  const isVerifiedAdmin =
    current.email?.toLowerCase() === ADMIN_OWNER_EMAIL && current.emailVerified;

  let senderRole: 'player' | 'admin' | 'system' = 'player';
  if (isVerifiedAdmin && (params.senderRole === 'admin' || params.senderRole === 'system')) {
    senderRole = params.senderRole;
  }

  let safeIsVip = Boolean(params.isVip);
  if (safeIsVip && !isVerifiedAdmin) {
    try {
      const pubSnap = await getDoc(doc(db, 'publicProfiles', authorUid));
      safeIsVip = Boolean(pubSnap.exists() && pubSnap.data()?.isVip === true);
    } catch {
      safeIsVip = false;
    }
  }

  const path = `messages/${messageId}`;
  try {
    await setDoc(doc(db, 'messages', messageId), {
      id: messageId,
      roomId: safeRoomId,
      authorUid,
      senderUsername,
      senderRole,
      isVip: safeIsVip,
      text: safeText,
      createdAt: serverTimestamp(),
    });
    return messageId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeRoomMessagesFromFirestore(
  roomId: RoomId,
  onMessages: (messages: RoomChatMessage[]) => void,
): Unsubscribe {
  const safeRoomId = sanitizeId(roomId || 'lounge_party', 'lounge').slice(0, 64);
  const q = query(
    collection(db, 'messages'),
    where('roomId', '==', safeRoomId),
    limit(80),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const mapped: RoomChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const text = typeof d.text === 'string' ? d.text.trim() : '';
        const senderUsername =
          typeof d.senderUsername === 'string' ? d.senderUsername.trim() : '';
        if (!text || !senderUsername) return;

        const rawRole = d.senderRole;
        const senderRole: UserRole | 'system' =
          rawRole === 'admin' || rawRole === 'system' ? rawRole : 'player';

        mapped.push({
          id: typeof d.id === 'string' && d.id ? d.id : docSnap.id,
          roomId: typeof d.roomId === 'string' && d.roomId ? d.roomId : safeRoomId,
          senderUsername,
          senderRole,
          senderIsVip: Boolean(d.isVip),
          text,
          createdAt: resolveFirestoreTimestampMs(d.createdAt, docSnap.id),
        });
      });

      mapped.sort((a, b) => {
        if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
        return a.id.localeCompare(b.id);
      });
      onMessages(mapped);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    },
  );
}

export async function clearRoomMessagesInFirestore(roomId: RoomId): Promise<void> {
  const current = auth.currentUser;
  if (!current || !current.emailVerified) return;

  const isVerifiedAdmin =
    current.email?.toLowerCase() === ADMIN_OWNER_EMAIL && current.emailVerified;
  if (!isVerifiedAdmin) return;

  const safeRoomId = sanitizeId(roomId || 'lounge_party', 'lounge').slice(0, 64);
  const path = 'messages';
  try {
    const q = query(
      collection(db, path),
      where('roomId', '==', safeRoomId),
      limit(100),
    );
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((docSnap) => deleteDoc(doc(db, path, docSnap.id))),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncRoomDjStateToFirestore(
  roomId: RoomId,
  track: RoomDjTrack | null,
): Promise<void> {
  const current = auth.currentUser;
  if (!current || !current.emailVerified) return;
  const safeRoomId = sanitizeId(roomId || 'lounge_party', 'lounge').slice(0, 64);
  const authorUid = sanitizeId(current.uid, 'usr');

  const roomDocRef = doc(db, 'rooms', safeRoomId);
  const djDocRef = doc(db, 'rooms', safeRoomId, 'dj', 'current');

  try {
    await setDoc(
      roomDocRef,
      {
        id: safeRoomId,
        roomId: safeRoomId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    if (!track || !track.videoId) {
      await setDoc(djDocRef, {
        id: 'current',
        roomId: safeRoomId,
        videoId: '',
        youtubeUrl: '',
        title: '',
        addedBy: '',
        updatedByUid: authorUid,
        isPlaying: false,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        queue: [],
      });
      return;
    }

    await setDoc(djDocRef, {
      id: 'current',
      roomId: safeRoomId,
      videoId: track.videoId.slice(0, 32),
      youtubeUrl: (track.youtubeUrl || '').slice(0, 256),
      title: (track.title || '').slice(0, 140),
      addedBy: (track.addedBy || 'DJ').slice(0, 48),
      updatedByUid: authorUid,
      isPlaying: Boolean(track.isPlaying),
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      queue: Array.isArray(track.queue) ? track.queue.slice(0, 50) : [],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${safeRoomId}/dj/current`);
  }
}

export function subscribeRoomDjStateFromFirestore(
  roomId: RoomId,
  onTrack: (track: RoomDjTrack | null) => void,
): Unsubscribe {
  const safeRoomId = sanitizeId(roomId || 'lounge_party', 'lounge').slice(0, 64);
  const djDocRef = doc(db, 'rooms', safeRoomId, 'dj', 'current');
  const path = `rooms/${safeRoomId}/dj/current`;

  return onSnapshot(
    djDocRef,
    { includeMetadataChanges: true },
    (snap) => {
      if (!snap.exists()) {
        onTrack(null);
        return;
      }
      const d = snap.data({ serverTimestamps: 'estimate' });
      const videoId = typeof d.videoId === 'string' ? d.videoId.trim() : '';
      if (!videoId || d.isPlaying === false) {
        onTrack(null);
        return;
      }
      const startedAt = resolveFirestoreTimestampMs(d.startedAt);
      const queue = Array.isArray(d.queue) ? (d.queue as RoomDjQueuedTrack[]) : [];
      onTrack({
        videoId,
        youtubeUrl: typeof d.youtubeUrl === 'string' ? d.youtubeUrl : `https://www.youtube.com/watch?v=${videoId}`,
        title: typeof d.title === 'string' ? d.title : 'Música DJ',
        addedBy: typeof d.addedBy === 'string' ? d.addedBy : 'DJ',
        startedAt,
        isPlaying: Boolean(d.isPlaying),
        queue,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}

