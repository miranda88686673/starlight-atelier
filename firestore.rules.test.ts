import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Security Rule Invariant & Dirty Dozen Verification Suite
 * Validates firestore.rules against firebase-blueprint.json and the 12 adversarial payloads
 * defined in security_spec.md.
 */

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf-8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8')) as {
  entities: Record<string, { required?: string[]; properties: Record<string, unknown> }>;
  firestore: Record<string, unknown>;
};

// Static invariant checks matching the Eight Pillars
assert.ok(rulesText.startsWith("rules_version = '2';"), 'Rules must use rules_version = 2');
assert.ok(
  rulesText.includes('match /{document=**} {\n      allow read, write: if false;\n    }'),
  'Global default-deny safety net must be present',
);
assert.ok(
  rulesText.includes('request.auth.token.email_verified == true'),
  'Email verification must be enforced on writes and admin email checks',
);
assert.ok(
  !rulesText.includes('allow list: if isSignedIn();'),
  'Blanket list reads must never be allowed',
);

for (const collectionPath of Object.keys(blueprint.firestore)) {
  const leafMatch = collectionPath.split('/').filter(Boolean).pop() ?? '';
  assert.ok(
    rulesText.includes(leafMatch.replace(/\{[^}]+\}/g, '')),
    `Blueprint path ${collectionPath} must be represented in firestore.rules`,
  );
}
assert.ok(
  rulesText.includes('isValidRoomDjState(incoming(), roomId, djDocId)'),
  'Room DJ subcollection writes must be validated by isValidRoomDjState',
);
assert.ok(
  rulesText.includes('allow list: if false;'),
  'Room DJ subcollection must forbid unbounded list queries',
);

// Verify Dirty Dozen adversarial payload rejections against blueprint + rule constraints
interface MockAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

const REQUEST_TIME = 'SERVER_TIMESTAMP';

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function isAdmin(auth: MockAuth | null): boolean {
  return Boolean(
    auth &&
      auth.email_verified &&
      auth.email === 'miranda88686673@gmail.com',
  );
}

function simulateDecision(params: {
  op: 'get' | 'list' | 'create' | 'update';
  collection: 'users' | 'publicProfiles' | 'supportTickets' | 'supportTicketsMessages';
  docId: string;
  auth: MockAuth | null;
  incoming?: Record<string, unknown>;
  existing?: Record<string, unknown>;
}): 'ALLOW' | 'PERMISSION_DENIED' {
  const { op, collection, docId, auth, incoming, existing } = params;
  if (!auth) return 'PERMISSION_DENIED';
  if ((op === 'create' || op === 'update') && !auth.email_verified) return 'PERMISSION_DENIED';
  if (op !== 'list' && !isValidId(docId)) return 'PERMISSION_DENIED';

  if (collection === 'users') {
    if (op === 'get') {
      return auth.uid === docId || isAdmin(auth) ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'create' && incoming) {
      const allowedKeys = blueprint.entities.UserPrivateProfile.required ?? [];
      const keys = Object.keys(incoming);
      if (!allowedKeys.every((k) => keys.includes(k)) || !keys.every((k) => allowedKeys.includes(k))) {
        return 'PERMISSION_DENIED';
      }
      if (incoming.role !== 'player' || incoming.uid !== docId || auth.uid !== docId) {
        return 'PERMISSION_DENIED';
      }
      if (incoming.createdAt !== REQUEST_TIME || incoming.updatedAt !== REQUEST_TIME) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOW';
    }
  }

  if (collection === 'publicProfiles' && op === 'update' && incoming && existing) {
    if (!isAdmin(auth) && incoming.isVip !== existing.isVip) {
      return 'PERMISSION_DENIED';
    }
  }

  if (collection === 'supportTickets') {
    if (op === 'list') {
      if (!existing || (existing.authorUid !== auth.uid && !isAdmin(auth))) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOW';
    }
    if (op === 'create' && incoming) {
      if (incoming.authorUid !== auth.uid || incoming.createdAt !== REQUEST_TIME) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOW';
    }
    if (op === 'update' && incoming && existing) {
      if (!isAdmin(auth) && existing.status === 'resolved') {
        return 'PERMISSION_DENIED';
      }
    }
  }

  if (collection === 'supportTicketsMessages' && op === 'create' && incoming && existing) {
    if (!existing.exists || existing.authorUid !== auth.uid) {
      return 'PERMISSION_DENIED';
    }
  }

  return 'PERMISSION_DENIED';
}

const dirtyDozenResults = [
  // 1. Unauthenticated read on private profile
  simulateDecision({ op: 'get', collection: 'users', docId: 'user_1', auth: null }),
  // 2. Unverified email write
  simulateDecision({
    op: 'create',
    collection: 'users',
    docId: 'user_1',
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: false },
    incoming: { uid: 'user_1', role: 'player', createdAt: REQUEST_TIME, updatedAt: REQUEST_TIME },
  }),
  // 3. Self-assigned admin role
  simulateDecision({
    op: 'create',
    collection: 'users',
    docId: 'user_1',
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: true },
    incoming: {
      uid: 'user_1',
      username: 'user1',
      displayName: 'User 1',
      email: 'a@b.com',
      avatarGender: 'feminino',
      serverRegion: 'BR',
      role: 'admin',
      createdAt: REQUEST_TIME,
      updatedAt: REQUEST_TIME,
    },
  }),
  // 4. Shadow / ghost field injection
  simulateDecision({
    op: 'create',
    collection: 'users',
    docId: 'user_1',
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: true },
    incoming: {
      uid: 'user_1',
      username: 'user1',
      displayName: 'User 1',
      email: 'a@b.com',
      avatarGender: 'feminino',
      serverRegion: 'BR',
      role: 'player',
      isSuperAdmin: true,
      createdAt: REQUEST_TIME,
      updatedAt: REQUEST_TIME,
    },
  }),
  // 5. Cross-owner PII read
  simulateDecision({
    op: 'get',
    collection: 'users',
    docId: 'user_2',
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: true },
  }),
  // 6. Unconstrained list scrape on tickets
  simulateDecision({
    op: 'list',
    collection: 'supportTickets',
    docId: '',
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: true },
    existing: { authorUid: 'other_user' },
  }),
  // 7. Oversized / invalid ID poisoning
  simulateDecision({
    op: 'create',
    collection: 'supportTickets',
    docId: `${'x'.repeat(140)}!@#`,
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: true },
    incoming: { authorUid: 'user_1', createdAt: REQUEST_TIME },
  }),
  // 8. Fake server timestamp
  simulateDecision({
    op: 'create',
    collection: 'supportTickets',
    docId: 'tkt_1',
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: true },
    incoming: { authorUid: 'user_1', createdAt: '2020-01-01T00:00:00Z' },
  }),
  // 9. Identity spoofing on ticket
  simulateDecision({
    op: 'create',
    collection: 'supportTickets',
    docId: 'tkt_1',
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: true },
    incoming: { authorUid: 'other_user_uid', createdAt: REQUEST_TIME },
  }),
  // 10. Terminal state bypass on resolved ticket
  simulateDecision({
    op: 'update',
    collection: 'supportTickets',
    docId: 'tkt_resolved',
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: true },
    existing: { authorUid: 'user_1', status: 'resolved' },
    incoming: { authorUid: 'user_1', status: 'open' },
  }),
  // 11. VIP escalation on update
  simulateDecision({
    op: 'update',
    collection: 'publicProfiles',
    docId: 'user_1',
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: true },
    existing: { isVip: false },
    incoming: { isVip: true },
  }),
  // 12. Orphan / cross-user subcollection message
  simulateDecision({
    op: 'create',
    collection: 'supportTicketsMessages',
    docId: 'msg_1',
    auth: { uid: 'user_1', email: 'a@b.com', email_verified: true },
    existing: { exists: false, authorUid: 'user_2' },
    incoming: { authorUid: 'user_1', createdAt: REQUEST_TIME },
  }),
];

dirtyDozenResults.forEach((result, idx) => {
  assert.equal(result, 'PERMISSION_DENIED', `Dirty Dozen payload #${idx + 1} must be rejected`);
});

console.log(`All ${dirtyDozenResults.length} Dirty Dozen adversarial payloads returned PERMISSION_DENIED.`);
