# Security Specification — Nocturne Vale Club Firestore Rules

## 1. Data Invariants
1. **Strict Authentication & Verified Email Gate**: Every Firestore read/write requires `request.auth != null`, and all user write operations require `request.auth.token.email_verified == true`.
2. **PII Isolation**: Private user data (`email`) resides exclusively in `/users/{userId}` and is readable/writable only by the owner (`request.auth.uid == userId`) or a verified admin (`isAdmin()`). Public profiles in `/publicProfiles/{userId}` contain zero PII.
3. **No Self-Assigned Roles or VIP Escalation**: On `/users/{userId}`, `role` is locked to `'player'`. On `/publicProfiles/{userId}` and `/playerProgress/{userId}`, non-admin users cannot escalate `isVip` or `starcoins`/`level` arbitrarily on update (only allowed cosmetic/display fields or admin override), and `/admins/{userId}` is writable only by a verified admin.
4. **Path & Document ID Integrity**: Every single-document operation validates `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars), and document `uid` / `authorUid` / `id` / `ticketId` fields must match the path parameter and `request.auth.uid`.
5. **Master Gate on Subcollections**: `/supportTickets/{ticketId}/messages/{messageId}` uses `get(/databases/$(database)/documents/supportTickets/$(ticketId))` to confirm the parent ticket exists, is not `resolved` (unless admin), and the actor is either the parent ticket's `authorUid` or `isAdmin()`.
6. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on create and remain immutable on update; `updatedAt` must equal `request.time` on create and update; `uid`, `authorUid`, and `id` are immutable after create.
7. **Secure List Queries**: Every `allow list` rule enforces ownership or admin privilege directly on `resource.data` (never blanket `allow list: if isSignedIn();`).
8. **Room DJ Sync Integrity (`/rooms/{roomId}/dj/{djDocId}`)**: DJ booth state requires a verified user, a valid parent `/rooms/{roomId}` document (`exists()`), server-validated timestamps (`startedAt` and `updatedAt` via `request.time`), `updatedByUid == request.auth.uid`, and a strictly bounded `queue` array (`size() <= 50`).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)

1. **Unauthenticated Read on Private Profile**: `GET /users/user_1` with `auth = null`.
2. **Unverified Email Write**: `CREATE /users/user_1` with `auth = { uid: 'user_1', token: { email_verified: false } }`.
3. **Self-Assigned Admin Role**: `CREATE /users/user_1` with `role: 'admin'` by `uid: 'user_1'`.
4. **Shadow / Ghost Field Injection**: `CREATE /users/user_1` including extra field `isSuperAdmin: true`.
5. **Cross-Owner Read (PII Leak)**: `GET /users/user_2` by `auth = { uid: 'user_1', token: { email_verified: true } }`.
6. **Unconstrained List Scrape on Tickets**: `LIST /supportTickets` without filtering `authorUid == request.auth.uid` by a non-admin user.
7. **Oversized ID Poisoning**: `CREATE /supportTickets/<150-char-invalid-id!@#>` by authenticated user.
8. **Fake Server Timestamp**: `CREATE /supportTickets/tkt_1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
9. **Identity Spoofing on Ticket**: `CREATE /supportTickets/tkt_1` with `authorUid: "other_user_uid"` while signed in as `user_1`.
10. **Terminal State Bypass**: `UPDATE /supportTickets/tkt_resolved` (already `status: 'resolved'`) by ticket author trying to reopen or alter `subject`.
11. **VIP / Currency Escalation on Update**: `UPDATE /publicProfiles/user_1` changing `isVip: true` by non-admin `user_1`.
12. **Orphan / Cross-User Subcollection Message**: `CREATE /supportTickets/nonexistent_or_other_ticket/messages/msg_1` by `user_1` who does not own the parent ticket.
