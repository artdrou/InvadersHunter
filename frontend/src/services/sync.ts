import type { SQLiteDatabase } from 'expo-sqlite';
import {
  getMeta, setMeta,
  upsertInvaders, deleteInvadersByIds, replaceCaptures, upsertCaptures, replaceRequests, upsertRequests,
  getPendingSyncs, deletePendingSync, deleteCapture, insertCapture,
} from './db';
import {
  fetchInvaders, fetchDeletedInvaderIds, fetchProgress, fetchUserRequests,
  flashInvader as apiFlash, unflashInvader as apiUnflash,
} from '@/features/invaders/services/invaders.api';

export function isNetworkError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as any).code;
  const message = (err as any).message ?? '';
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
        // Swap the temp local capture for the real server one
        await deleteCapture(db, item.capture_id!);
        await insertCapture(db, capture);
        await deletePendingSync(db, item.id);
      } else if (item.type === 'unflash') {
        await apiUnflash(item.capture_id!);
        await deletePendingSync(db, item.id);
      }
    } catch (err) {
      if (isNetworkError(err)) break; // still offline — try again later
      // Server rejected it (conflict, 404, etc.) — drop and move on
      await deletePendingSync(db, item.id);
    }
  }
}

export async function syncAll(db: SQLiteDatabase, userId: number): Promise<void> {
  // 1. Push any pending offline operations first
  await flushPendingSyncs(db, userId);

  // 2. Read per-endpoint sync timestamps
  const [lastInvadersSync, lastProgressSync, lastRequestsSync] = await Promise.all([
    getMeta(db, 'last_invaders_sync'),
    getMeta(db, 'last_progress_sync'),
    getMeta(db, 'last_requests_sync'),
  ]);

  // 3. Fetch from server in parallel — delta when we have a timestamp, full otherwise
  const [invaders, deletedIds, captures, requests] = await Promise.all([
    fetchInvaders(lastInvadersSync ?? undefined),
    fetchDeletedInvaderIds(lastInvadersSync ?? undefined),
    fetchProgress(userId, lastProgressSync ?? undefined),
    fetchUserRequests(lastRequestsSync ?? undefined),
  ]);

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
