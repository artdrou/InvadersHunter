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
    } catch (err) {
      console.warn('[sync] failed:', err);
      if (isNetworkError(err)) {
        setSyncError('network');
        // Retry in 30s — catches reconnection without needing to background the app
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
  }, [db, loadFromDb, clearRetry]);

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
    try {
      const capture = await apiFlash(userId, invaderId);
      await insertCapture(db, capture);
      setProgress((prev) => [...prev, capture]);
      return capture;
    } catch (err) {
      if (!isNetworkError(err)) throw err;

      const tempId = -Date.now();
      const tempCapture: Capture = {
        id: tempId,
        invader_id: invaderId,
        user_id: userId,
        found_at: new Date().toISOString(),
        is_pending: 1,
      };
      await insertCapture(db, tempCapture);
      await insertPendingSync(db, { type: 'flash', invader_id: invaderId, capture_id: tempId, user_id: userId });
      setProgress((prev) => [...prev, tempCapture]);
      return tempCapture;
    }
  }, [db]);

  // ── Unflash ─────────────────────────────────────────────────────────────────

  const unflash = useCallback(async (progressId: number): Promise<void> => {
    const isPending = progress.some((p) => p.id === progressId && p.is_pending === 1);

    if (isPending) {
      const queue = await getPendingSyncs(db, progress.find((p) => p.id === progressId)!.user_id);
      const pendingFlash = queue.find((s) => s.type === 'flash' && s.capture_id === progressId);
      await deleteCapture(db, progressId);
      if (pendingFlash) await deletePendingSync(db, pendingFlash.id);
      setProgress((prev) => prev.filter((p) => p.id !== progressId));
      return;
    }

    try {
      await apiUnflash(progressId);
      await deleteCapture(db, progressId);
      setProgress((prev) => prev.filter((p) => p.id !== progressId));
    } catch (err) {
      if (!isNetworkError(err)) throw err;

      await deleteCapture(db, progressId);
      const cap = progress.find((p) => p.id === progressId);
      if (cap) {
        await insertPendingSync(db, { type: 'unflash', invader_id: null, capture_id: progressId, user_id: cap.user_id });
      }
      setProgress((prev) => prev.filter((p) => p.id !== progressId));
    }
  }, [db, progress]);

  return { invaders, progress, isSyncing, syncError, flash, unflash };
}
