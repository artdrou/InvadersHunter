import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuthStore } from '@/features/auth';
import {
  getAllInvaders, getAllCaptures,
  insertCapture, deleteCapture,
  insertPendingSync, deletePendingSync, getPendingSyncs,
} from '@/services/db';
import { syncAll, isNetworkError } from '@/services/sync';
import { useConnectivityStore } from '@/services/connectivity';
import { flashInvader as apiFlash, unflashInvader as apiUnflash } from '../services/invaders.api';
import type { Invader, Capture } from '../types';

export type SyncError = 'network' | 'other' | null;

export function useInvaderData() {
  const db = useSQLiteContext();
  const [invaders, setInvaders] = useState<Invader[]>([]);
  const [progress, setProgress] = useState<Capture[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<SyncError>(null);

  const user = useAuthStore((s) => s.user);
  const setOnline = useConnectivityStore((s) => s.setOnline);
  const cancelledRef = useRef(false);
  const syncingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const loadFromDb = useCallback(async (userId: number) => {
    const [inv, prog] = await Promise.all([
      getAllInvaders(db),
      getAllCaptures(db, userId),
    ]);
    if (!cancelledRef.current) {
      setInvaders(inv);
      setProgress(prog);
    }
  }, [db]);

  const runSync = useCallback(async (userId: number) => {
    if (syncingRef.current) return;
    clearRetry();
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await syncAll(db, userId);
      await loadFromDb(userId);
      setSyncError(null);
      setOnline(true);
    } catch (err) {
      // Always reload from DB even on failure — clears stale pending states
      await loadFromDb(userId).catch(() => {});
      console.warn('[sync] failed:', err);
      if (isNetworkError(err)) {
        setSyncError('network');
        setOnline(false);
        if (!cancelledRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            runSync(userId);
          }, 30_000);
        }
      } else {
        setSyncError('other');
      }
    } finally {
      syncingRef.current = false;
      if (!cancelledRef.current) setIsSyncing(false);
    }
  }, [db, loadFromDb, clearRetry, setOnline]);

  // On mount: load from SQLite instantly, then sync in background
  useEffect(() => {
    if (!user) return;
    cancelledRef.current = false;
    loadFromDb(user.id);
    runSync(user.id);
    return () => {
      cancelledRef.current = true;
      clearRetry();
    };
  }, [user, loadFromDb, runSync, clearRetry]);

  // On app foreground: sync immediately (also clears any pending retry timer)
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runSync(user.id);
    });
    return () => sub.remove();
  }, [user, runSync]);

  // ── Flash ───────────────────────────────────────────────────────────────────

  const flash = useCallback(async (userId: number, invaderId: number): Promise<Capture> => {
    // Optimistic: save locally first for instant UI response
    const tempId = -Date.now();
    const tempCapture: Capture = {
      id: tempId,
      invader_id: invaderId,
      user_id: userId,
      found_at: new Date().toISOString(),
      is_pending: 1,
    };
    await insertCapture(db, tempCapture);
    setProgress((prev) => [...prev, tempCapture]);

    // Confirm with backend in background — no pending queue until we know it's needed
    apiFlash(userId, invaderId)
      .then(async (capture) => {
        await deleteCapture(db, tempId);
        await insertCapture(db, capture);
        if (!cancelledRef.current) {
          setProgress((prev) => prev.map((p) => p.id === tempId ? capture : p));
        }
      })
      .catch(async (err) => {
        if (isNetworkError(err)) {
          // Offline: add to pending queue, runSync will flush when back online
          await insertPendingSync(db, { type: 'flash', invader_id: invaderId, capture_id: tempId, user_id: userId });
        } else {
          // Backend rejected (e.g. already captured): revert optimistic state
          await deleteCapture(db, tempId);
          if (!cancelledRef.current) {
            setProgress((prev) => prev.filter((p) => p.id !== tempId));
          }
        }
      });

    return tempCapture;
  }, [db, cancelledRef]);

  // ── Unflash ─────────────────────────────────────────────────────────────────

  const unflash = useCallback(async (progressId: number): Promise<void> => {
    const cap = progress.find((p) => p.id === progressId);
    if (!cap) return;

    // If this is a pending optimistic flash, cancel both sides locally
    if (cap.is_pending === 1) {
      const queue = await getPendingSyncs(db, cap.user_id);
      const pendingFlash = queue.find((s) => s.type === 'flash' && s.capture_id === progressId);
      await deleteCapture(db, progressId);
      if (pendingFlash) await deletePendingSync(db, pendingFlash.id);
      if (!cancelledRef.current) setProgress((prev) => prev.filter((p) => p.id !== progressId));
      return;
    }

    // Optimistic: remove from UI immediately
    await deleteCapture(db, progressId);
    if (!cancelledRef.current) setProgress((prev) => prev.filter((p) => p.id !== progressId));

    // Confirm with backend in background
    apiUnflash(progressId).catch(async (err) => {
      if (isNetworkError(err)) {
        await insertPendingSync(db, { type: 'unflash', invader_id: null, capture_id: progressId, user_id: cap.user_id });
      } else {
        // Backend rejected: revert optimistic state
        await insertCapture(db, cap);
        if (!cancelledRef.current) setProgress((prev) => [...prev, cap]);
      }
    });
  }, [db, progress]);

  return { invaders, progress, isSyncing, syncError, flash, unflash };
}
