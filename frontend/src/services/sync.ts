import type { SQLiteDatabase } from 'expo-sqlite';
import {
  getMeta, setMeta,
  upsertInvaders, deleteInvadersByIds, replaceCaptures, upsertCaptures, replaceRequests, upsertRequests,
  getPendingSyncs, deletePendingSync, deleteCapture, insertCapture, insertPendingSync,
  getAllCaptures, deleteCapturesForUser,
  getAllCustomInvaders, getCustomInvaderById, upsertCustomInvaders, replaceCustomInvaders,
  deleteCustomInvader, deleteCustomInvadersByIds, deleteCustomInvadersForUser,
} from './db';
import {
  fetchInvaders, fetchDeletedInvaderIds, fetchProgress, fetchUserRequests,
  flashInvader as apiFlash, unflashInvader as apiUnflash,
  submitModifyRequest as apiSubmitModify, submitCreateRequest as apiSubmitCreate,
  type ModifyRequestPayload, type CreateRequestPayload,
} from '@/features/invaders/services/invaders.api';
import {
  fetchCustomInvaders, fetchDeletedCustomInvaderIds,
  createCustomInvader as apiCreateCustom,
  updateCustomInvader as apiUpdateCustom,
  deleteCustomInvader as apiDeleteCustom,
  uploadCustomInvaderPhoto as apiUploadCustomPhoto,
} from '@/features/custom-invaders/services/custom-invaders.api';
import { isLocalPhoto } from '@/features/custom-invaders/types';
import type { CustomInvaderDraft } from '@/features/custom-invaders/types';
import { GUEST_USER_ID } from '@/features/auth/guest';
import { claimGuestData } from '@/features/auth/services/account.api';
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
      } else if (item.type === 'create_custom_invader') {
        // The local row holds a temporary negative id — swap it for the server one,
        // carrying over any photo still waiting on this device (pushPendingPhotos
        // uploads it once the row has a real id).
        const local = await getCustomInvaderById(db, item.invader_id!);
        const created = await apiCreateCustom(JSON.parse(item.payload!) as CustomInvaderDraft);
        await deleteCustomInvader(db, item.invader_id!);
        const photo = isLocalPhoto(local?.image_url) ? local!.image_url : created.image_url;
        await upsertCustomInvaders(db, [{ ...created, image_url: photo }]);
        await deletePendingSync(db, item.id);
      } else if (item.type === 'update_custom_invader') {
        const updated = await apiUpdateCustom(item.invader_id!, JSON.parse(item.payload!));
        await upsertCustomInvaders(db, [updated]);
        await deletePendingSync(db, item.id);
      } else if (item.type === 'delete_custom_invader') {
        await apiDeleteCustom(item.invader_id!);
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
 * Guest → account migration. If local guest data exists (captures and/or custom
 * invaders), bulk-import it into the authenticated account then drop the local
 * rows — the following sync pulls back the canonical server rows.
 * Self-healing: runs at the start of every authenticated sync, so a claim
 * that failed offline is retried automatically.
 *
 * Never lets a claim failure abort the rest of the sync: network errors
 * propagate (the whole sync retries later anyway), but a server rejection
 * (e.g. an older backend without /account/claim) just keeps the guest rows
 * for a future attempt.
 *
 * Custom invaders are claimed in the same call: they come back paired with the
 * temporary negative local id they were sent under, which is what lets the local
 * rows be rewritten onto their real server ids rather than duplicated.
 */
async function claimGuestDataLocally(db: SQLiteDatabase): Promise<void> {
  const [guestCaptures, guestCustom] = await Promise.all([
    getAllCaptures(db, GUEST_USER_ID),
    getAllCustomInvaders(db, GUEST_USER_ID),
  ]);
  if (guestCaptures.length === 0 && guestCustom.length === 0) return;

  let result;
  try {
    result = await claimGuestData(
      guestCaptures.map((c) => ({ invader_id: c.invader_id, found_at: c.found_at })),
      guestCustom.map((c) => ({
        local_id: c.id,
        name: c.name,
        city: c.city ?? null,
        number: c.number ?? null,
        description: c.description,
        points: c.points,
        state: c.state,
        latitude: c.latitude,
        longitude: c.longitude,
        date_pose: c.date_pose,
      })),
    );
  } catch (err) {
    if (isNetworkError(err)) throw err;
    return; // server rejected — keep local rows, retry on a later sync
  }

  // Drop the guest rows and re-insert the canonical ones under the real account.
  // Both steps must happen together: keeping a guest row after a successful
  // import would re-claim it (and duplicate the invader) on the next sync.
  await deleteCapturesForUser(db, GUEST_USER_ID);
  await deleteCustomInvadersForUser(db, GUEST_USER_ID);
  const claimed = result?.custom_invaders ?? [];
  if (claimed.length > 0) {
    // Photos never travel in the claim (they're still local files, and the guest
    // had no id to upload against). Carry them onto the canonical rows so
    // pushPendingPhotos can send them now that the ids are real.
    const photoByLocalId = new Map(
      guestCustom.filter((c) => isLocalPhoto(c.image_url)).map((c) => [c.id, c.image_url]),
    );
    await upsertCustomInvaders(db, claimed.map((c) => ({
      ...c.invader,
      image_url: photoByLocalId.get(c.local_id) ?? c.invader.image_url,
      is_pending: 0,
    })));
  }
}

/**
 * Upload personal-invader photos that are still local files.
 *
 * A photo can only be uploaded once its row has a real server id, so anything
 * created as a guest or while offline parks its file uri in image_url and waits
 * here. Running it on every sync makes this the single retry path for all of
 * them — guest claims, queue flushes, and uploads that simply failed.
 */
async function pushPendingPhotos(db: SQLiteDatabase, userId: number): Promise<void> {
  const rows = await getAllCustomInvaders(db, userId);
  for (const row of rows) {
    if (row.id < 0 || !isLocalPhoto(row.image_url)) continue;
    try {
      const url = await apiUploadCustomPhoto(row.id, row.image_url!);
      await upsertCustomInvaders(db, [{ ...row, image_url: url }]);
    } catch (err) {
      if (isNetworkError(err)) return; // still offline — retry on the next sync
      // The file is gone (cache evicted) or the server refused it. Drop the dead
      // reference rather than leave a broken image on the marker forever.
      await upsertCustomInvaders(db, [{ ...row, image_url: null }]);
    }
  }
}

export async function syncAll(db: SQLiteDatabase, userId: number): Promise<void> {
  // 0. Claim any guest-mode data left on this device (no-op in the common case)
  await claimGuestDataLocally(db);

  // 1. Push any pending offline operations first
  await flushPendingSyncs(db, userId);

  // 2. Read per-endpoint sync timestamps
  const [lastInvadersSync, lastProgressSync, lastRequestsSync, lastCustomSync] = await Promise.all([
    getMeta(db, 'last_invaders_sync'),
    getMeta(db, 'last_progress_sync'),
    getMeta(db, 'last_requests_sync'),
    getMeta(db, 'last_custom_invaders_sync'),
  ]);

  // 3. Fetch from server in parallel — delta when we have a timestamp, full otherwise
  // Deleted-IDs endpoint is best-effort: a failure must not abort the rest of the sync
  const [invaders, captures, requests, customInvaders] = await Promise.all([
    fetchInvaders(lastInvadersSync ?? undefined),
    fetchProgress(userId, lastProgressSync ?? undefined),
    fetchUserRequests(lastRequestsSync ?? undefined),
    fetchCustomInvaders(lastCustomSync ?? undefined),
  ]);
  let deletedIds: number[] = [];
  try {
    deletedIds = await fetchDeletedInvaderIds(lastInvadersSync ?? undefined);
  } catch {
    // endpoint unavailable (e.g. 422 on older deploy) — skip deletion step
  }
  let deletedCustomIds: number[] = [];
  try {
    deletedCustomIds = await fetchDeletedCustomInvaderIds(lastCustomSync ?? undefined);
  } catch {
    // endpoint unavailable — skip the custom-invader deletion step
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

  if (lastCustomSync) {
    await upsertCustomInvaders(db, customInvaders);
  } else {
    await replaceCustomInvaders(db, userId, customInvaders);
  }
  await deleteCustomInvadersByIds(db, deletedCustomIds);
  // Photos waiting on a server id (guest rows just claimed, offline creates just
  // flushed, earlier upload failures) — best-effort, never aborts the sync.
  await pushPendingPhotos(db, userId);

  await Promise.all([
    setMeta(db, 'last_invaders_sync', now),
    setMeta(db, 'last_progress_sync', now),
    setMeta(db, 'last_requests_sync', now),
    setMeta(db, 'last_custom_invaders_sync', now),
  ]);
}
