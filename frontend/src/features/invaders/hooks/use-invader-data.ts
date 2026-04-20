import { useCallback, useEffect, useRef } from 'react';
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
import { useInvaderStore } from '../store';
import type { Capture } from '../types';

export type SyncError = 'network' | 'other' | null;

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
  const setOnline = useConnectivityStore((s) => s.setOnline);
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
    setInvaders(inv);
    setProgress(prog);
  }, [db, setInvaders, setProgress]);

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
      await loadFromDb(userId).catch(() => {});
      console.warn('[sync] failed:', err);
      if (isNetworkError(err)) {
        setSyncError('network');
        setOnline(false);
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          runSync(userId);
        }, 30_000);
      } else {
        setSyncError('other');
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [db, loadFromDb, clearRetry, setOnline, setIsSyncing, setSyncError]);

  // On mount: load from SQLite instantly, then sync in background
  useEffect(() => {
    if (!user) return;
    loadFromDb(user.id);
    runSync(user.id);
    return () => { clearRetry(); };
  }, [user, loadFromDb, runSync, clearRetry]);

  // On app foreground: sync immediately
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runSync(user.id);
    });
    return () => sub.remove();
  }, [user, runSync]);

  // ── Flash ───────────────────────────────────────────────────────────────────

  const flash = useCallback(async (userId: number, invaderId: number): Promise<Capture> => {
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

  const unflash = useCallback(async (progressId: number): Promise<void> => {
    const cap = progress.find((p) => p.id === progressId);
    if (!cap) return;

    if (cap.is_pending === 1) {
      const queue = await getPendingSyncs(db, cap.user_id);
      const pendingFlash = queue.find((s) => s.type === 'flash' && s.capture_id === progressId);
      await deleteCapture(db, progressId);
      if (pendingFlash) await deletePendingSync(db, pendingFlash.id);
      setProgress((prev) => prev.filter((p) => p.id !== progressId));
      return;
    }

    await deleteCapture(db, progressId);
    setProgress((prev) => prev.filter((p) => p.id !== progressId));

    apiUnflash(progressId).catch(async (err) => {
      if (isNetworkError(err)) {
        await insertPendingSync(db, { type: 'unflash', invader_id: null, capture_id: progressId, user_id: cap.user_id });
      } else {
        await insertCapture(db, cap);
        setProgress((prev) => [...prev, cap]);
      }
    });
  }, [db, progress, setProgress]);

  return { invaders, progress, isSyncing, syncError, flash, unflash };
}
