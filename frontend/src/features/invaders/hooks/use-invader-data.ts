import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuthStore, GUEST_USER_ID } from '@/features/auth';
import {
  getAllInvaders, getAllCaptures,
  insertCapture, deleteCapture,
  insertPendingSync, deletePendingSync, getPendingSyncs,
} from '@/services/db';
import { syncAll, syncInvadersOnly, isNetworkError, submitModifyRequestOfflineAware, submitCreateRequestOfflineAware } from '@/services/sync';
import { useConnectivityStore } from '@/services/connectivity';
import { logger } from '@/services/logger';
import { useNetworkConnectivity } from '@/hooks/use-network-connectivity';
import { flashInvader as apiFlash, unflashInvader as apiUnflash, type ModifyRequestPayload, type CreateRequestPayload } from '../services/invaders.api';
import { useInvaderStore } from '../store';
import { createSingleFlight } from '@/services/single-flight';
import type { Capture } from '../types';

export type SyncError = 'network' | 'other' | null;

// Module-level: survives hook remounts, resets on app restart (desired).
// TODO: add delta sync (updated_since) for fetchProgress and fetchUserRequests
//       once the backend exposes those parameters — that will eliminate full
//       list re-fetches for progress and user requests on every sync cycle.
let lastSyncAt = 0;
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between foreground syncs
const RETRY_BASE_MS    = 30_000;
const RETRY_MAX_MS     = 5 * 60_000;    // cap backoff at 5 minutes

// App-wide, shared by every screen using this hook (map, list, community page…):
// - one sync at a time: overlapping syncs made a screen read the captures table
//   while another rewrote it (one SQLite connection sees the open transaction):
//   empty progress, all invaders red, then fixed by the next read
// - whose data the shared store holds: a screen mounting later reuses it instead
//   of re-reading SQLite (and of starting yet another sync)
const sync = createSingleFlight();
let loadedForUser: number | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = RETRY_BASE_MS;

export function useInvaderData() {
  const db = useSQLiteContext();

  const invaders = useInvaderStore((s) => s.invaders);
  const progress = useInvaderStore((s) => s.progress);
  const isSyncing = useInvaderStore((s) => s.isSyncing);
  const syncError = useInvaderStore((s) => s.syncError);
  const setInvaders = useInvaderStore((s) => s.setInvaders);
  const setProgress = useInvaderStore((s) => s.setProgress);
  const setIsSyncing = useInvaderStore((s) => s.setIsSyncing);
  const setSyncError = useInvaderStore((s) => s.setSyncError);

  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  // Guest data lives in SQLite under the sentinel id; null = logged out entirely
  const userId = user?.id ?? (isGuest ? GUEST_USER_ID : null);
  const setOnline = useConnectivityStore((s) => s.setOnline);
  const syncTrigger = useInvaderStore((s) => s.syncTrigger);
  const clearRetry = useCallback(() => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }, []);

  const loadFromDb = useCallback(async (userId: number) => {
    const [inv, prog] = await Promise.all([
      getAllInvaders(db),
      getAllCaptures(db, userId),
    ]);
    setInvaders(inv);
    setProgress(prog);
    loadedForUser = userId;
  }, [db, setInvaders, setProgress]);

  const runSync = useCallback((userId: number): Promise<void> => sync.run(async () => {
    clearRetry();
    setIsSyncing(true);
    try {
      // Guests only pull the public invader list; their captures never sync
      if (userId === GUEST_USER_ID) {
        await syncInvadersOnly(db);
      } else {
        await syncAll(db, userId);
      }
      await loadFromDb(userId);
      lastSyncAt = Date.now();
      retryDelay = RETRY_BASE_MS;
      setSyncError(null);
      setOnline(true);
    } catch (err) {
      await loadFromDb(userId).catch(() => {});
      logger.warn('[sync] failed:', err);
      if (isNetworkError(err)) {
        setSyncError('network');
        setOnline(false);
        const delay = retryDelay;
        retryDelay = Math.min(delay * 2, RETRY_MAX_MS);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          runSync(userId);
        }, delay);
      } else {
        setSyncError('other');
      }
    } finally {
      setIsSyncing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [db, loadFromDb, clearRetry, setOnline, setIsSyncing, setSyncError]);

  // Trigger a sync whenever NetInfo detects an offline → online transition
  useNetworkConnectivity(useCallback(() => {
    if (userId != null) {
      lastSyncAt = 0;
      runSync(userId);
    }
  }, [userId, runSync]));

  // On mount: the first screen (or another account) shows the local data at once,
  // then syncs; a screen mounting later reuses the shared store, and only syncs if
  // the data is stale. The retry timer is app-wide: one screen unmounting keeps it.
  useEffect(() => {
    if (userId == null) return;
    const otherAccount = loadedForUser !== userId;
    if (otherAccount && !sync.running) loadFromDb(userId);
    if (otherAccount || Date.now() - lastSyncAt >= SYNC_COOLDOWN_MS) runSync(userId);
  }, [userId, loadFromDb, runSync]);

  // On app foreground: sync only if data is stale (> 5 min since last sync)
  useEffect(() => {
    if (userId == null) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (Date.now() - lastSyncAt < SYNC_COOLDOWN_MS) return;
      runSync(userId);
    });
    return () => sub.remove();
  }, [userId, runSync]);

  // Manual sync requested from UI — skip cooldown
  const isFirstTrigger = useRef(true);
  useEffect(() => {
    if (isFirstTrigger.current) { isFirstTrigger.current = false; return; }
    if (userId == null) return;
    lastSyncAt = 0;
    runSync(userId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncTrigger]);

  // ── Flash ───────────────────────────────────────────────────────────────────

  const flash = useCallback(async (userId: number, invaderId: number): Promise<Capture> => {
    const tempId = -Date.now();
    const isGuestFlash = userId === GUEST_USER_ID;
    const tempCapture: Capture = {
      id: tempId,
      invader_id: invaderId,
      user_id: userId,
      found_at: new Date().toISOString(),
      // Guest captures are local-only by design — not "pending server sync"
      is_pending: isGuestFlash ? 0 : 1,
    };
    await insertCapture(db, tempCapture);
    setProgress((prev) => [...prev, tempCapture]);

    if (isGuestFlash) return tempCapture; // stays local until the guest signs up

    apiFlash(userId, invaderId)
      .then(async (capture) => {
        await deleteCapture(db, tempId);
        await insertCapture(db, capture);
        setProgress((prev) => prev.map((p) => p.id === tempId ? capture : p));
      })
      .catch(async (err) => {
        if (isNetworkError(err)) {
          await insertPendingSync(db, { type: 'flash', invader_id: invaderId, capture_id: tempId, user_id: userId });
        } else {
          const res = (err as { response?: { status?: number; data?: unknown } })?.response;
          logger.warn('[flash] server rejected, reverting:', res?.status, JSON.stringify(res?.data), `user=${userId} invader=${invaderId}`);
          await deleteCapture(db, tempId);
          setProgress((prev) => prev.filter((p) => p.id !== tempId));
        }
      });

    return tempCapture;
  }, [db, setProgress]);

  // ── Unflash ─────────────────────────────────────────────────────────────────

  /**
   * Returns false when nothing was removed (stale progressId — e.g. the row
   * was replaced by a sync between popup open and the tap). Callers must not
   * flip their local UI state in that case.
   */
  const unflash = useCallback(async (progressId: number): Promise<boolean> => {
    const cap = progress.find((p) => p.id === progressId);
    if (!cap) return false;

    if (cap.user_id === GUEST_USER_ID) {
      // Guest capture: purely local, nothing queued server-side
      await deleteCapture(db, progressId);
      setProgress((prev) => prev.filter((p) => p.id !== progressId));
      return true;
    }

    if (cap.is_pending === 1) {
      const queue = await getPendingSyncs(db, cap.user_id);
      const pendingFlash = queue.find((s) => s.type === 'flash' && s.capture_id === progressId);
      await deleteCapture(db, progressId);
      if (pendingFlash) await deletePendingSync(db, pendingFlash.id);
      setProgress((prev) => prev.filter((p) => p.id !== progressId));
      return true;
    }

    await deleteCapture(db, progressId);
    setProgress((prev) => prev.filter((p) => p.id !== progressId));

    apiUnflash(progressId).catch(async (err) => {
      if (isNetworkError(err)) {
        await insertPendingSync(db, { type: 'unflash', invader_id: null, capture_id: progressId, user_id: cap.user_id });
      } else if ((err as { response?: { status?: number } })?.response?.status === 404) {
        // Row already gone server-side — the local delete was correct, don't
        // resurrect a phantom capture (kept the marker stuck on "flashed").
        logger.warn('[unflash] server row already gone, keeping local delete');
      } else {
        logger.warn('[unflash] server rejected, restoring capture:', err);
        await insertCapture(db, cap);
        setProgress((prev) => [...prev, cap]);
      }
    });
    return true;
  }, [db, progress, setProgress]);

  const submitModifyRequest = useCallback(
    (payload: ModifyRequestPayload) => submitModifyRequestOfflineAware(db, user!.id, payload),
    [db, user],
  );

  const submitCreateRequest = useCallback(
    (payload: CreateRequestPayload) => submitCreateRequestOfflineAware(db, user!.id, payload),
    [db, user],
  );

  return { invaders, progress, isSyncing, syncError, flash, unflash, submitModifyRequest, submitCreateRequest };
}
