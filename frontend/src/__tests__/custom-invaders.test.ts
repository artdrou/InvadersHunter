/**
 * Tests for useCustomInvaders — personal invaders CRUD.
 *
 * The interesting cases are the ones where local and server state can drift:
 * guest rows that must never leave the device, and rows edited or deleted while
 * their original create is still sitting in the offline queue.
 */
import { renderHook, act } from '@testing-library/react-native';

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('../services/db');
jest.mock('../features/custom-invaders/services/custom-invaders.api');

import * as db from '../services/db';
import * as api from '../features/custom-invaders/services/custom-invaders.api';
import { useCustomInvaders } from '../features/custom-invaders/hooks/use-custom-invaders';
import { useCustomInvaderStore } from '../features/custom-invaders/store';
import { useAuthStore } from '../features/auth/store';
import { GUEST_USER_ID } from '../features/auth/guest';
import type { CustomInvaderDraft } from '../features/custom-invaders/types';

const upsertCustomInvaders = db.upsertCustomInvaders as jest.Mock;
const deleteCustomInvader  = db.deleteCustomInvader  as jest.Mock;
const insertPendingSync    = db.insertPendingSync    as jest.Mock;
const deletePendingSync    = db.deletePendingSync    as jest.Mock;
const getPendingSyncs      = db.getPendingSyncs      as jest.Mock;
const updatePendingSyncPayload = db.updatePendingSyncPayload as jest.Mock;

const apiCreate = api.createCustomInvader as jest.Mock;
const apiUpdate = api.updateCustomInvader as jest.Mock;
const apiDelete = api.deleteCustomInvader as jest.Mock;

const NETWORK_ERROR = { code: 'ERR_NETWORK' };

function draft(over: Partial<CustomInvaderDraft> = {}): CustomInvaderDraft {
  return { name: 'PA_9001', city: 'PA', number: 9001, points: 30, state: 'Good', latitude: 48.85, longitude: 2.35, ...over };
}

/** Sign in as a real account (default) or as a guest. */
function setUser(id: number | null, isGuest = false) {
  useAuthStore.setState({
    user: id != null ? ({ id, username: 'alice', email: 'a@b.c', is_admin: false } as never) : null,
    isGuest,
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  useCustomInvaderStore.setState({ customInvaders: [] });
  setUser(42);
  upsertCustomInvaders.mockResolvedValue(undefined);
  deleteCustomInvader.mockResolvedValue(undefined);
  insertPendingSync.mockResolvedValue(undefined);
  deletePendingSync.mockResolvedValue(undefined);
  getPendingSyncs.mockResolvedValue([]);
  updatePendingSyncPayload.mockResolvedValue(undefined);
});

// ── create ─────────────────────────────────────────────────────────────────────

describe('createCustomInvader', () => {
  it('replaces the optimistic row with the server one', async () => {
    apiCreate.mockResolvedValue({ id: 88, user_id: 42, name: 'PA_9001' });
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.createCustomInvader(draft()); });

    expect(apiCreate).toHaveBeenCalledWith(draft());
    expect(result.current.customInvaders).toEqual([
      expect.objectContaining({ id: 88, user_id: 42 }),
    ]);
  });

  it('keeps a guest row local and never calls the server', async () => {
    setUser(null, true);
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.createCustomInvader(draft()); });

    expect(apiCreate).not.toHaveBeenCalled();
    const [row] = result.current.customInvaders;
    expect(row.user_id).toBe(GUEST_USER_ID);
    expect(row.id).toBeLessThan(0);
    // Local-only is a guest row's normal state, not a pending sync
    expect(row.is_pending).toBe(0);
  });

  it('queues the create when offline and keeps the row visible', async () => {
    apiCreate.mockRejectedValue(NETWORK_ERROR);
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.createCustomInvader(draft()); });

    expect(result.current.customInvaders).toHaveLength(1);
    expect(result.current.customInvaders[0].is_pending).toBe(1);
    expect(insertPendingSync).toHaveBeenCalledWith({}, expect.objectContaining({
      type: 'create_custom_invader',
      user_id: 42,
      payload: JSON.stringify(draft()),
    }));
  });

  it('rolls the row back when the server rejects it', async () => {
    apiCreate.mockRejectedValue({ response: { status: 422 } });
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => {
      await expect(result.current.createCustomInvader(draft())).rejects.toBeTruthy();
    });

    expect(result.current.customInvaders).toEqual([]);
    expect(deleteCustomInvader).toHaveBeenCalled();
    expect(insertPendingSync).not.toHaveBeenCalled();
  });

  it('does nothing when logged out entirely', async () => {
    setUser(null, false);
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => {
      expect(await result.current.createCustomInvader(draft())).toBeNull();
    });
    expect(apiCreate).not.toHaveBeenCalled();
  });
});

// ── update ─────────────────────────────────────────────────────────────────────

describe('updateCustomInvader', () => {
  function seed(id: number, is_pending = 0) {
    useCustomInvaderStore.setState({
      customInvaders: [{ ...draft(), id, user_id: 42, image_url: null, description: null, date_pose: null, is_pending } as never],
    });
  }

  it('sends the update and stores the server response', async () => {
    seed(88);
    apiUpdate.mockResolvedValue({ id: 88, user_id: 42, points: 50 });
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.updateCustomInvader(88, { points: 50 }); });

    expect(apiUpdate).toHaveBeenCalledWith(88, { points: 50 });
    expect(result.current.customInvaders[0]).toEqual(expect.objectContaining({ points: 50 }));
  });

  it('rewrites the queued create instead of queuing an update the server cannot apply', async () => {
    // A row still awaiting its create has an id the server has never seen —
    // queuing an update against it would 404 on flush.
    seed(-2000, 1);
    getPendingSyncs.mockResolvedValue([
      { id: 7, type: 'create_custom_invader', invader_id: -2000, user_id: 42, payload: JSON.stringify(draft()) },
    ]);
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.updateCustomInvader(-2000, { points: 50 }); });

    expect(apiUpdate).not.toHaveBeenCalled();
    expect(insertPendingSync).not.toHaveBeenCalled();
    expect(updatePendingSyncPayload).toHaveBeenCalledWith(
      {}, 7, JSON.stringify({ ...draft(), points: 50 }),
    );
  });

  it('queues the update when offline', async () => {
    seed(88);
    apiUpdate.mockRejectedValue(NETWORK_ERROR);
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.updateCustomInvader(88, { points: 50 }); });

    expect(insertPendingSync).toHaveBeenCalledWith({}, expect.objectContaining({
      type: 'update_custom_invader', invader_id: 88, payload: JSON.stringify({ points: 50 }),
    }));
    expect(result.current.customInvaders[0].points).toBe(50); // stays optimistic
  });

  it('restores the previous values when the server rejects the update', async () => {
    seed(88);
    apiUpdate.mockRejectedValue({ response: { status: 422 } });
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => {
      await expect(result.current.updateCustomInvader(88, { points: 50 })).rejects.toBeTruthy();
    });

    expect(result.current.customInvaders[0].points).toBe(30);
  });

  it('stays local for a guest', async () => {
    setUser(null, true);
    useCustomInvaderStore.setState({
      customInvaders: [{ ...draft(), id: -1, user_id: GUEST_USER_ID } as never],
    });
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.updateCustomInvader(-1, { points: 50 }); });

    expect(apiUpdate).not.toHaveBeenCalled();
    expect(insertPendingSync).not.toHaveBeenCalled();
    expect(result.current.customInvaders[0].points).toBe(50);
  });
});

// ── delete ─────────────────────────────────────────────────────────────────────

describe('removeCustomInvader', () => {
  function seed(id: number) {
    useCustomInvaderStore.setState({
      customInvaders: [{ ...draft(), id, user_id: 42, image_url: null, description: null, date_pose: null } as never],
    });
  }

  it('deletes locally and server-side', async () => {
    seed(88);
    apiDelete.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.removeCustomInvader(88); });

    expect(apiDelete).toHaveBeenCalledWith(88);
    expect(result.current.customInvaders).toEqual([]);
  });

  it('drops the queued create for a row the server never saw', async () => {
    seed(-2000);
    getPendingSyncs.mockResolvedValue([
      { id: 7, type: 'create_custom_invader', invader_id: -2000, user_id: 42, payload: '{}' },
    ]);
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.removeCustomInvader(-2000); });

    expect(apiDelete).not.toHaveBeenCalled();
    expect(deletePendingSync).toHaveBeenCalledWith({}, 7);
    expect(result.current.customInvaders).toEqual([]);
  });

  it('queues the delete when offline', async () => {
    seed(88);
    apiDelete.mockRejectedValue(NETWORK_ERROR);
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.removeCustomInvader(88); });

    expect(insertPendingSync).toHaveBeenCalledWith({}, expect.objectContaining({
      type: 'delete_custom_invader', invader_id: 88,
    }));
    expect(result.current.customInvaders).toEqual([]);
  });

  it('keeps the local delete when the row is already gone server-side', async () => {
    seed(88);
    apiDelete.mockRejectedValue({ response: { status: 404 } });
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => { await result.current.removeCustomInvader(88); });

    expect(result.current.customInvaders).toEqual([]); // no phantom row resurrected
  });

  it('restores the row when the server rejects the delete', async () => {
    seed(88);
    apiDelete.mockRejectedValue({ response: { status: 500 } });
    const { result } = renderHook(() => useCustomInvaders());

    await act(async () => {
      await expect(result.current.removeCustomInvader(88)).rejects.toBeTruthy();
    });

    expect(result.current.customInvaders).toHaveLength(1);
  });
});
