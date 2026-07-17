import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuthStore, GUEST_USER_ID } from '@/features/auth';
import {
  getAllInvaders, getAllCaptures, getAllCustomInvaders,
  insertCapture, deleteCapture,
  insertPendingSync, deletePendingSync, getPendingSyncs,
} from '@/services/db';
import { useCustomInvaderStore } from '@/features/custom-invaders/store';
import { syncAll, syncInvadersOnly, isNetworkError, submitModifyRequestOfflineAware, submitCreateRequestOfflineAware } from '@/services/sync';
import { useConnectivityStore } from '@/services/connectivity';
import { logger } from '@/services/logger';
import { useNetworkConnectivity } from '@/hooks/use-network-connectivity';
import { flashInvader as apiFlash, unflashInvader as apiUnflash, type ModifyRequestPayload, type CreateRequestPayload } from '../services/invaders.api';
import { useInvaderStore } from '../store';
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
  const syncingRef     = useRef(false);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef  = useRef<number>(RETRY_BASE_MS);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Single load path for everything the map reads — personal invaders included,
  // so they refresh on the same cycle as invaders/captures (mount, sync, retry).
  const loadFromDb = useCallback(async (userId: number) => {
    const [inv, prog, custom] = await Promise.all([
      getAllInvaders(db),
      getAllCaptures(db, userId),
      getAllCustomInvaders(db, userId),
    ]);
    setInvaders(inv);
    setProgress(prog);
    useCustomInvaderStore.getState().setCustomInvaders(custom);
  }, [db, setInvaders, setProgress]);

  const runSync = useCallback(async (userId: number) => {
    if (syncingRef.current) return;
    clearRetry();
    syncingRef.current = true;
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
      retryDelayRef.current = RETRY_BASE_MS;
      setSyncError(null);
      setOnline(true);
    } catch (err) {
      await loadFromDb(userId).catch(() => {});
      logger.warn('[sync] failed:', err);
      if (isNetworkError(err)) {
        setSyncError('network');
        setOnline(false);
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, RETRY_MAX_MS);
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          runSync(userId);
        }, delay);
      } else {
        setSyncError('other');
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [db, loadFromDb, clearRetry, setOnline, setIsSyncing, setSyncError]);

  // Trigger a sync whenever NetInfo detects an offline → online transition
  useNetworkConnectivity(useCallback(() => {
    if (userId != null) {
      lastSyncAt = 0;
      runSync(userId);
    }
  }, [userId, runSync]));

  // On mount: load from SQLite instantly, then sync in background
  useEffect(() => {
    if (userId == null) return;
    loadFromDb(userId);
    runSync(userId);
    return () => { clearRetry(); };
  }, [userId, loadFromDb, runSync, clearRetry]);

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
