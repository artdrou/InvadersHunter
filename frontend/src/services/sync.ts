import type { SQLiteDatabase } from 'expo-sqlite';
import {
  getMeta, setMeta,
  upsertInvaders, replaceCaptures, replaceRequests,
  getPendingSyncs, deletePendingSync, deleteCapture, insertCapture,
} from './db';
import {
  fetchInvaders, fetchProgress, fetchUserRequests,
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

  // 2. Fetch from server in parallel
  const lastSync = await getMeta(db, 'last_sync');
  const [invaders, captures, requests] = await Promise.all([
    fetchInvaders(lastSync ?? undefined),
    fetchProgress(userId),
    fetchUserRequests(),
  ]);

  // 3. Write to SQLite sequentially
  await upsertInvaders(db, invaders);
  await replaceCaptures(db, userId, captures);
  await replaceRequests(db, userId, requests);

  await setMeta(db, 'last_sync', new Date().toISOString());
}
