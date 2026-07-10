import type { SQLiteDatabase } from 'expo-sqlite';
import {
  getMeta, setMeta,
  upsertInvaders, deleteInvadersByIds, replaceCaptures, upsertCaptures, replaceRequests, upsertRequests,
  getPendingSyncs, deletePendingSync, deleteCapture, insertCapture, insertPendingSync,
  getAllCaptures, deleteCapturesForUser,
} from './db';
import {
  fetchInvaders, fetchDeletedInvaderIds, fetchProgress, fetchUserRequests,
  flashInvader as apiFlash, unflashInvader as apiUnflash,
  submitModifyRequest as apiSubmitModify, submitCreateRequest as apiSubmitCreate,
  type ModifyRequestPayload, type CreateRequestPayload,
} from '@/features/invaders/services/invaders.api';
import { GUEST_USER_ID } from '@/features/auth/guest';
import { claimCaptures } from '@/features/auth/services/account.api';
import type { UserRequest } from '@/features/invaders/types';

export function isNetworkError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { code, message } = err as { code?: string; message?: string };
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    message === 'Network Error'
  );
}

/**
 * Flush queued offline operations in order.
 * Stops at the first network error (still offline) — will retry on next sync.
 * Non-network errors (e.g. 409 conflict) are dropped: the server rejected them.
 */
export async function flushPendingSyncs(db: SQLiteDatabase, userId: number): Promise<void> {
  const queue = await getPendingSyncs(db, userId);

  for (const item of queue) {
    try {
      if (item.type === 'flash') {
        const capture = await apiFlash(userId, item.invader_id!);
        await deleteCapture(db, item.capture_id!);
        await insertCapture(db, capture);
        await deletePendingSync(db, item.id);
      } else if (item.type === 'unflash') {
        await apiUnflash(item.capture_id!);
        await deletePendingSync(db, item.id);
      } else if (item.type === 'modify_request') {
        await apiSubmitModify(JSON.parse(item.payload!) as ModifyRequestPayload);
        await deletePendingSync(db, item.id);
      } else if (item.type === 'create_request') {
        await apiSubmitCreate(JSON.parse(item.payload!) as CreateRequestPayload);
        await deletePendingSync(db, item.id);
      }
    } catch (err) {
      if (isNetworkError(err)) break; // still offline — try again later
      // Server rejected it (conflict, 404, etc.) — drop and move on
      await deletePendingSync(db, item.id);
    }
  }
}

// ── Offline-aware request submission ─────────────────────────────────────────

/**
 * Returns the created UserRequest when online, null when queued offline.
 * Callers that need the request id (e.g. photo upload) must handle null.
 */
export async function submitModifyRequestOfflineAware(
  db: SQLiteDatabase,
  userId: number,
  payload: ModifyRequestPayload,
): Promise<UserRequest | null> {
  try {
    return await apiSubmitModify(payload);
  } catch (err) {
    if (isNetworkError(err)) {
      await insertPendingSync(db, {
        type: 'modify_request',
        invader_id: payload.invader_id,
        capture_id: null,
        user_id: userId,
        payload: JSON.stringify(payload),
      });
      return null;
    }
    throw err;
  }
}

/**
 * Returns the created UserRequest when online, null when queued offline.
 * Callers that need the request id (e.g. photo upload) must handle null.
 */
export async function submitCreateRequestOfflineAware(
  db: SQLiteDatabase,
  userId: number,
  payload: CreateRequestPayload,
): Promise<import('@/features/invaders/types').UserRequest | null> {
  try {
    return await apiSubmitCreate(payload);
  } catch (err) {
    if (isNetworkError(err)) {
      await insertPendingSync(db, {
        type: 'create_request',
        invader_id: null,
        capture_id: null,
        user_id: userId,
        payload: JSON.stringify(payload),
      });
      return null;
    }
    throw err;
  }
}

// ── Guest mode ────────────────────────────────────────────────────────────────

/**
 * Guest sync: invaders only (GET /invaders/ is public). Captures stay local
 * under GUEST_USER_ID until the guest creates an account.
 */
export async function syncInvadersOnly(db: SQLiteDatabase): Promise<void> {
  const lastInvadersSync = await getMeta(db, 'last_invaders_sync');
  const now = new Date().toISOString();

  const invaders = await fetchInvaders(lastInvadersSync ?? undefined);
  let deletedIds: number[] = [];
  try {
    deletedIds = await fetchDeletedInvaderIds(lastInvadersSync ?? undefined);
  } catch {
    // endpoint unavailable — skip deletion step
  }

  await upsertInvaders(db, invaders);
  await deleteInvadersByIds(db, deletedIds);
  await setMeta(db, 'last_invaders_sync', now);
}

/**
 * Guest → account migration. If local guest captures exist, bulk-import them
 * into the authenticated account (idempotent server-side) then drop the local
 * rows — the following sync pulls back the canonical server rows.
 * Self-healing: runs at the start of every authenticated sync, so a claim
 * that failed offline is retried automatically.
 */
async function claimGuestCaptures(db: SQLiteDatabase): Promise<void> {
  const guestRows = await getAllCaptures(db, GUEST_USER_ID);
  if (guestRows.length === 0) return;
  await claimCaptures(
    guestRows.map((c) => ({ invader_id: c.invader_id, found_at: c.found_at })),
  );
  await deleteCapturesForUser(db, GUEST_USER_ID);
}

export async function syncAll(db: SQLiteDatabase, userId: number): Promise<void> {
  // 0. Claim any guest-mode data left on this device (no-op in the common case)
  await claimGuestCaptures(db);

  // 1. Push any pending offline operations first
  await flushPendingSyncs(db, userId);

  // 2. Read per-endpoint sync timestamps
  const [lastInvadersSync, lastProgressSync, lastRequestsSync] = await Promise.all([
    getMeta(db, 'last_invaders_sync'),
    getMeta(db, 'last_progress_sync'),
    getMeta(db, 'last_requests_sync'),
  ]);

  // 3. Fetch from server in parallel — delta when we have a timestamp, full otherwise
  // Deleted-IDs endpoint is best-effort: a failure must not abort the rest of the sync
  const [invaders, captures, requests] = await Promise.all([
    fetchInvaders(lastInvadersSync ?? undefined),
    fetchProgress(userId, lastProgressSync ?? undefined),
    fetchUserRequests(lastRequestsSync ?? undefined),
  ]);
  let deletedIds: number[] = [];
  try {
    deletedIds = await fetchDeletedInvaderIds(lastInvadersSync ?? undefined);
  } catch {
    // endpoint unavailable (e.g. 422 on older deploy) — skip deletion step
  }

  // 4. Write to SQLite: upsert for delta syncs, full replace for first sync
  const now = new Date().toISOString();

  await upsertInvaders(db, invaders);
  await deleteInvadersByIds(db, deletedIds);

  if (lastProgressSync) {
    await upsertCaptures(db, captures);
  } else {
    await replaceCaptures(db, userId, captures);
  }

  if (lastRequestsSync) {
    await upsertRequests(db, requests);
  } else {
    await replaceRequests(db, userId, requests);
  }

  await Promise.all([
    setMeta(db, 'last_invaders_sync', now),
    setMeta(db, 'last_progress_sync', now),
    setMeta(db, 'last_requests_sync', now),
  ]);
}
