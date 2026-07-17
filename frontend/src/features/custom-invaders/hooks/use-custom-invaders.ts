import { useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
// Imported from source, not the feature barrel: that barrel re-exports UI
// components, which would drag the whole theme/CSS graph into this data hook.
import { useAuthStore } from '@/features/auth/store';
import { GUEST_USER_ID } from '@/features/auth/guest';
import {
  upsertCustomInvaders, deleteCustomInvader as dbDeleteCustomInvader,
  insertPendingSync, deletePendingSync, getPendingSyncs, updatePendingSyncPayload,
} from '@/services/db';
import { isNetworkError } from '@/services/sync';
import { logger } from '@/services/logger';
import {
  createCustomInvader as apiCreate,
  updateCustomInvader as apiUpdate,
  deleteCustomInvader as apiDelete,
  uploadCustomInvaderPhoto as apiUploadPhoto,
} from '../services/custom-invaders.api';
import { useCustomInvaderStore } from '../store';
import { isLocalOnly, isLocalPhoto } from '../types';
import type { CustomInvader, CustomInvaderDraft } from '../types';

/**
 * CRUD for personal invaders, offline-first like flash/unflash: every write hits
 * SQLite and the store immediately, then reaches the server (or gets queued in
 * pending_syncs when offline).
 *
 * Guest rows never leave the device — they live under GUEST_USER_ID with a
 * temporary negative id until the account claim rewrites them (see sync.ts).
 */
export function useCustomInvaders() {
  const db = useSQLiteContext();
  const customInvaders = useCustomInvaderStore((s) => s.customInvaders);
  const setCustomInvaders = useCustomInvaderStore((s) => s.setCustomInvaders);

  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const userId = user?.id ?? (isGuest ? GUEST_USER_ID : null);

  /** The queued create for a not-yet-synced row, if any. */
  const findPendingCreate = useCallback(async (localId: number, ownerId: number) => {
    const queue = await getPendingSyncs(db, ownerId);
    return queue.find((s) => s.type === 'create_custom_invader' && s.invader_id === localId);
  }, [db]);

  /**
   * Upload a locally-picked photo for a row that now has a server id. Best-effort:
   * the row keeps the local uri on failure and a later sync retries it
   * (pushPendingPhotos), so a flaky upload never blocks the write itself.
   */
  const uploadPhoto = useCallback(async (row: CustomInvader, uri: string): Promise<CustomInvader> => {
    try {
      const url = await apiUploadPhoto(row.id, uri);
      const withPhoto = { ...row, image_url: url };
      await upsertCustomInvaders(db, [withPhoto]);
      setCustomInvaders((prev) => prev.map((c) => (c.id === row.id ? withPhoto : c)));
      return withPhoto;
    } catch (err) {
      logger.warn('[custom-invaders] photo upload deferred:', err);
      return row;
    }
  }, [db, setCustomInvaders]);

  const createCustomInvader = useCallback(async (
    draft: CustomInvaderDraft,
    imageUri: string | null = null,
  ): Promise<CustomInvader | null> => {
    if (userId == null) return null;
    const isGuestRow = userId === GUEST_USER_ID;
    const tempId = -Date.now();
    const row: CustomInvader = {
      id: tempId,
      user_id: userId,
      name: draft.name,
      city: draft.city ?? null,
      number: draft.number ?? null,
      // Held as a local file uri until the row has a server id to upload against
      image_url: imageUri,
      description: draft.description ?? null,
      points: draft.points ?? null,
      state: (draft.state ?? null) as CustomInvader['state'],
      latitude: draft.latitude,
      longitude: draft.longitude,
      date_pose: draft.date_pose ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // A guest row isn't "waiting to sync" — local-only is its normal state.
      is_pending: isGuestRow ? 0 : 1,
    };
    await upsertCustomInvaders(db, [row]);
    setCustomInvaders((prev) => [...prev, row]);

    if (isGuestRow) return row; // stays local until the guest signs up

    try {
      const created = await apiCreate(draft);
      await dbDeleteCustomInvader(db, tempId);
      // Keep the local uri on the canonical row so the photo shows immediately
      // and survives if the upload below fails.
      const stored = { ...created, image_url: imageUri ?? created.image_url };
      await upsertCustomInvaders(db, [stored]);
      setCustomInvaders((prev) => prev.map((c) => (c.id === tempId ? stored : c)));
      return imageUri ? await uploadPhoto(stored, imageUri) : stored;
    } catch (err) {
      if (isNetworkError(err)) {
        await insertPendingSync(db, {
          type: 'create_custom_invader',
          invader_id: tempId,
          capture_id: null,
          user_id: userId,
          payload: JSON.stringify(draft),
        });
        return row; // stays pending, flushed on the next sync
      }
      // Server rejected it — undo the optimistic insert
      logger.warn('[custom-invaders] create rejected:', err);
      await dbDeleteCustomInvader(db, tempId);
      setCustomInvaders((prev) => prev.filter((c) => c.id !== tempId));
      throw err;
    }
  }, [db, userId, setCustomInvaders, uploadPhoto]);

  const updateCustomInvader = useCallback(async (
    id: number,
    fields: Partial<CustomInvaderDraft>,
    imageUri: string | null = null,
  ): Promise<void> => {
    if (userId == null) return;
    const previous = customInvaders.find((c) => c.id === id);
    if (!previous) return;

    // A freshly picked photo is a local uri; an unchanged one is already the
    // stored url and needs no re-upload.
    const newPhoto = isLocalPhoto(imageUri) && imageUri !== previous.image_url ? imageUri : null;
    const photoCleared = imageUri === null && previous.image_url != null;

    const merged: CustomInvader = {
      ...previous, ...fields,
      image_url: newPhoto ?? (photoCleared ? null : previous.image_url),
      updated_at: new Date().toISOString(),
    } as CustomInvader;
    await upsertCustomInvaders(db, [merged]);
    setCustomInvaders((prev) => prev.map((c) => (c.id === id ? merged : c)));

    if (userId === GUEST_USER_ID) return; // local-only

    // Still awaiting its create: rewrite that queued payload instead of queuing an
    // update against an id the server has never seen.
    if (isLocalOnly({ id })) {
      const pending = await findPendingCreate(id, userId);
      if (pending) {
        const draft = { ...JSON.parse(pending.payload!), ...fields };
        await updatePendingSyncPayload(db, pending.id, JSON.stringify(draft));
      }
      return;
    }

    // Clearing the photo is an explicit null the server must see; a new one is
    // sent by the upload endpoint instead (it sets image_url itself).
    const serverFields = photoCleared ? { ...fields, image_url: null } : fields;

    try {
      const updated = await apiUpdate(id, serverFields);
      const stored = newPhoto ? { ...updated, image_url: newPhoto } : updated;
      await upsertCustomInvaders(db, [stored]);
      setCustomInvaders((prev) => prev.map((c) => (c.id === id ? stored : c)));
      if (newPhoto) await uploadPhoto(stored, newPhoto);
    } catch (err) {
      if (isNetworkError(err)) {
        await insertPendingSync(db, {
          type: 'update_custom_invader',
          invader_id: id,
          capture_id: null,
          user_id: userId,
          payload: JSON.stringify(serverFields),
        });
        return;
      }
      logger.warn('[custom-invaders] update rejected, restoring:', err);
      await upsertCustomInvaders(db, [previous]);
      setCustomInvaders((prev) => prev.map((c) => (c.id === id ? previous : c)));
      throw err;
    }
  }, [db, userId, customInvaders, setCustomInvaders, findPendingCreate, uploadPhoto]);

  const removeCustomInvader = useCallback(async (id: number): Promise<void> => {
    if (userId == null) return;
    const previous = customInvaders.find((c) => c.id === id);
    if (!previous) return;

    await dbDeleteCustomInvader(db, id);
    setCustomInvaders((prev) => prev.filter((c) => c.id !== id));

    if (userId === GUEST_USER_ID) return; // local-only

    // Never reached the server: drop its queued create instead of asking the
    // server to delete an id it has never seen.
    if (isLocalOnly({ id })) {
      const pending = await findPendingCreate(id, userId);
      if (pending) await deletePendingSync(db, pending.id);
      return;
    }

    try {
      await apiDelete(id);
    } catch (err) {
      if (isNetworkError(err)) {
        await insertPendingSync(db, {
          type: 'delete_custom_invader',
          invader_id: id,
          capture_id: null,
          user_id: userId,
        });
        return;
      }
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        // Already gone server-side — the local delete was correct
        logger.warn('[custom-invaders] server row already gone, keeping local delete');
        return;
      }
      logger.warn('[custom-invaders] delete rejected, restoring:', err);
      await upsertCustomInvaders(db, [previous]);
      setCustomInvaders((prev) => [...prev, previous]);
      throw err;
    }
  }, [db, userId, customInvaders, setCustomInvaders, findPendingCreate]);

  return { customInvaders, createCustomInvader, updateCustomInvader, removeCustomInvader };
}
