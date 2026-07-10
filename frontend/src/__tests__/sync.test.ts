/**
 * Tests for sync.ts — flushPendingSyncs, syncAll, isNetworkError.
 *
 * The SQLite db and API calls are fully mocked so these run without a device.
 */

import { isNetworkError, flushPendingSyncs, syncAll, syncInvadersOnly, submitModifyRequestOfflineAware, submitCreateRequestOfflineAware } from '../services/sync';
import * as db from '../services/db';
import * as api from '../features/invaders/services/invaders.api';
import * as accountApi from '../features/auth/services/account.api';
import { GUEST_USER_ID } from '../features/auth/guest';
import type { PendingSync } from '../services/db';
import type { Capture } from '../features/invaders/types';

jest.mock('../services/db');
jest.mock('../features/invaders/services/invaders.api');
jest.mock('../features/auth/services/account.api');

const mockDb = {} as any;

// Typed mocks
const getPendingSyncs  = db.getPendingSyncs  as jest.Mock;
const deletePendingSync = db.deletePendingSync as jest.Mock;
const deleteCapture    = db.deleteCapture    as jest.Mock;
const insertCapture    = db.insertCapture    as jest.Mock;
const getMeta          = db.getMeta          as jest.Mock;
const setMeta          = db.setMeta          as jest.Mock;
const upsertInvaders   = db.upsertInvaders   as jest.Mock;
const deleteInvadersByIds = db.deleteInvadersByIds as jest.Mock;
const replaceCaptures  = db.replaceCaptures  as jest.Mock;
const upsertCaptures   = db.upsertCaptures   as jest.Mock;
const replaceRequests  = db.replaceRequests  as jest.Mock;
const upsertRequests   = db.upsertRequests   as jest.Mock;
const getAllCaptures   = db.getAllCaptures   as jest.Mock;
const deleteCapturesForUser = db.deleteCapturesForUser as jest.Mock;

const claimCaptures    = accountApi.claimCaptures as jest.Mock;

const apiFlash         = api.flashInvader          as jest.Mock;
const apiUnflash       = api.unflashInvader        as jest.Mock;
const apiSubmitModify  = api.submitModifyRequest   as jest.Mock;
const apiSubmitCreate  = api.submitCreateRequest   as jest.Mock;
const fetchInvaders         = api.fetchInvaders         as jest.Mock;
const fetchProgress         = api.fetchProgress         as jest.Mock;
const fetchDeletedInvaderIds = api.fetchDeletedInvaderIds as jest.Mock;
const fetchUserRequests     = api.fetchUserRequests     as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Safe defaults
  getPendingSyncs.mockResolvedValue([]);
  deletePendingSync.mockResolvedValue(undefined);
  deleteCapture.mockResolvedValue(undefined);
  insertCapture.mockResolvedValue(undefined);
  getMeta.mockResolvedValue(null);
  setMeta.mockResolvedValue(undefined);
  upsertInvaders.mockResolvedValue(undefined);
  deleteInvadersByIds.mockResolvedValue(undefined);
  replaceCaptures.mockResolvedValue(undefined);
  upsertCaptures.mockResolvedValue(undefined);
  replaceRequests.mockResolvedValue(undefined);
  upsertRequests.mockResolvedValue(undefined);
  getAllCaptures.mockResolvedValue([]);
  deleteCapturesForUser.mockResolvedValue(undefined);
  claimCaptures.mockResolvedValue(undefined);
  apiSubmitModify.mockResolvedValue(undefined);
  apiSubmitCreate.mockResolvedValue(undefined);
  fetchInvaders.mockResolvedValue([]);
  fetchProgress.mockResolvedValue([]);
  fetchDeletedInvaderIds.mockResolvedValue([]);
  fetchUserRequests.mockResolvedValue([]);
});

// ── isNetworkError ────────────────────────────────────────────────────────────

describe('isNetworkError', () => {
  it('returns true for ERR_NETWORK code', () => {
    expect(isNetworkError({ code: 'ERR_NETWORK' })).toBe(true);
  });

  it('returns true for ECONNABORTED code', () => {
    expect(isNetworkError({ code: 'ECONNABORTED' })).toBe(true);
  });

  it('returns true for "Network Error" message', () => {
    expect(isNetworkError({ message: 'Network Error' })).toBe(true);
  });

  it('returns false for a 4xx HTTP error (server is reachable)', () => {
    expect(isNetworkError({ response: { status: 404 } })).toBe(false);
  });

  it('returns false for a 5xx HTTP error (server responded)', () => {
    expect(isNetworkError({ response: { status: 500 } })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isNetworkError(null)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isNetworkError('something went wrong')).toBe(false);
  });
});

// ── flushPendingSyncs ─────────────────────────────────────────────────────────

function makeFlashSync(overrides: Partial<PendingSync> = {}): PendingSync {
  return { id: 1, type: 'flash', invader_id: 10, capture_id: -1000, user_id: 42, created_at: '2024-01-01T00:00:00Z', ...overrides };
}

function makeUnflashSync(overrides: Partial<PendingSync> = {}): PendingSync {
  return { id: 2, type: 'unflash', invader_id: null, capture_id: 99, user_id: 42, created_at: '2024-01-01T00:00:00Z', ...overrides };
}

const serverCapture: Capture = { id: 500, invader_id: 10, user_id: 42, found_at: '2024-01-01T00:00:00Z', is_pending: 0 };

describe('flushPendingSyncs', () => {
  it('does nothing when queue is empty', async () => {
    getPendingSyncs.mockResolvedValue([]);
    await flushPendingSyncs(mockDb, 42);
    expect(apiFlash).not.toHaveBeenCalled();
    expect(apiUnflash).not.toHaveBeenCalled();
  });

  describe('flash', () => {
    it('calls apiFlash, swaps the temp capture for the server capture, removes pending sync', async () => {
      const sync = makeFlashSync();
      getPendingSyncs.mockResolvedValue([sync]);
      apiFlash.mockResolvedValue(serverCapture);

      await flushPendingSyncs(mockDb, 42);

      expect(apiFlash).toHaveBeenCalledWith(42, sync.invader_id);
      expect(deleteCapture).toHaveBeenCalledWith(mockDb, sync.capture_id);
      expect(insertCapture).toHaveBeenCalledWith(mockDb, serverCapture);
      expect(deletePendingSync).toHaveBeenCalledWith(mockDb, sync.id);
    });

    it('stops processing queue on network error', async () => {
      const sync1 = makeFlashSync({ id: 1, invader_id: 10 });
      const sync2 = makeFlashSync({ id: 2, invader_id: 11 });
      getPendingSyncs.mockResolvedValue([sync1, sync2]);
      apiFlash.mockRejectedValueOnce({ code: 'ERR_NETWORK' });

      await flushPendingSyncs(mockDb, 42);

      expect(apiFlash).toHaveBeenCalledTimes(1);
      expect(deletePendingSync).not.toHaveBeenCalled();
    });

    it('drops a server-rejected flash (non-network error) and continues with the next item', async () => {
      const sync1 = makeFlashSync({ id: 1, invader_id: 10 });
      const sync2 = makeUnflashSync({ id: 2 });
      getPendingSyncs.mockResolvedValue([sync1, sync2]);
      apiFlash.mockRejectedValueOnce({ response: { status: 409 } });
      apiUnflash.mockResolvedValue(undefined);

      await flushPendingSyncs(mockDb, 42);

      expect(deletePendingSync).toHaveBeenCalledWith(mockDb, sync1.id);
      expect(apiUnflash).toHaveBeenCalled();
      expect(deletePendingSync).toHaveBeenCalledWith(mockDb, sync2.id);
    });

    it('processes multiple flash items in FIFO order', async () => {
      const order: number[] = [];
      const syncs = [
        makeFlashSync({ id: 1, invader_id: 10, capture_id: -1 }),
        makeFlashSync({ id: 2, invader_id: 11, capture_id: -2 }),
        makeFlashSync({ id: 3, invader_id: 12, capture_id: -3 }),
      ];
      getPendingSyncs.mockResolvedValue(syncs);
      apiFlash.mockImplementation(async (_, invaderId) => {
        order.push(invaderId);
        return { ...serverCapture, id: invaderId * 10, invader_id: invaderId };
      });

      await flushPendingSyncs(mockDb, 42);

      expect(order).toEqual([10, 11, 12]);
    });
  });

  describe('unflash', () => {
    it('calls apiUnflash and removes pending sync', async () => {
      const sync = makeUnflashSync();
      getPendingSyncs.mockResolvedValue([sync]);
      apiUnflash.mockResolvedValue(undefined);

      await flushPendingSyncs(mockDb, 42);

      expect(apiUnflash).toHaveBeenCalledWith(sync.capture_id);
      expect(deletePendingSync).toHaveBeenCalledWith(mockDb, sync.id);
    });

    it('stops on network error without removing the pending sync', async () => {
      const sync = makeUnflashSync();
      getPendingSyncs.mockResolvedValue([sync]);
      apiUnflash.mockRejectedValue({ code: 'ERR_NETWORK' });

      await flushPendingSyncs(mockDb, 42);

      expect(deletePendingSync).not.toHaveBeenCalled();
    });
  });

  // ── modify_request / create_request flush ────────────────────────────────────

  describe('modify_request', () => {
    it('calls submitModifyRequest with parsed payload and removes pending sync', async () => {
      const payload = { invader_id: 5, proposed_state: 'Destroyed' };
      const sync = {
        id: 10, type: 'modify_request' as any, invader_id: 5, capture_id: null,
        user_id: 42, created_at: '2024-01-01T00:00:00Z', payload: JSON.stringify(payload),
      };
      getPendingSyncs.mockResolvedValue([sync]);

      await flushPendingSyncs(mockDb, 42);

      expect(apiSubmitModify).toHaveBeenCalledWith(payload);
      expect(deletePendingSync).toHaveBeenCalledWith(mockDb, sync.id);
    });

    it('stops queue on network error', async () => {
      const sync1 = { id: 10, type: 'modify_request' as any, invader_id: 5, capture_id: null, user_id: 42, created_at: '', payload: JSON.stringify({ invader_id: 5 }) };
      const sync2 = { id: 11, type: 'modify_request' as any, invader_id: 6, capture_id: null, user_id: 42, created_at: '', payload: JSON.stringify({ invader_id: 6 }) };
      getPendingSyncs.mockResolvedValue([sync1, sync2]);
      apiSubmitModify.mockRejectedValueOnce({ code: 'ERR_NETWORK' });

      await flushPendingSyncs(mockDb, 42);

      expect(apiSubmitModify).toHaveBeenCalledTimes(1);
      expect(deletePendingSync).not.toHaveBeenCalled();
    });

    it('drops item and continues on server rejection', async () => {
      const sync1 = { id: 10, type: 'modify_request' as any, invader_id: 5, capture_id: null, user_id: 42, created_at: '', payload: JSON.stringify({ invader_id: 5 }) };
      const sync2 = { id: 11, type: 'unflash' as any, invader_id: null, capture_id: 99, user_id: 42, created_at: '', payload: null };
      getPendingSyncs.mockResolvedValue([sync1, sync2]);
      apiSubmitModify.mockRejectedValueOnce({ response: { status: 422 } });
      apiUnflash.mockResolvedValue(undefined);

      await flushPendingSyncs(mockDb, 42);

      expect(deletePendingSync).toHaveBeenCalledWith(mockDb, sync1.id);
      expect(apiUnflash).toHaveBeenCalled();
      expect(deletePendingSync).toHaveBeenCalledWith(mockDb, sync2.id);
    });
  });

  describe('create_request', () => {
    it('calls submitCreateRequest with parsed payload and removes pending sync', async () => {
      const payload = { proposed_name: 'PA_999', proposed_latitude: 48.85, proposed_longitude: 2.35 };
      const sync = {
        id: 20, type: 'create_request' as any, invader_id: null, capture_id: null,
        user_id: 42, created_at: '2024-01-01T00:00:00Z', payload: JSON.stringify(payload),
      };
      getPendingSyncs.mockResolvedValue([sync]);

      await flushPendingSyncs(mockDb, 42);

      expect(apiSubmitCreate).toHaveBeenCalledWith(payload);
      expect(deletePendingSync).toHaveBeenCalledWith(mockDb, sync.id);
    });

    it('stops queue on network error', async () => {
      const sync = { id: 20, type: 'create_request' as any, invader_id: null, capture_id: null, user_id: 42, created_at: '', payload: JSON.stringify({ proposed_name: 'X', proposed_latitude: 0, proposed_longitude: 0 }) };
      getPendingSyncs.mockResolvedValue([sync]);
      apiSubmitCreate.mockRejectedValue({ code: 'ERR_NETWORK' });

      await flushPendingSyncs(mockDb, 42);

      expect(deletePendingSync).not.toHaveBeenCalled();
    });
  });
});

// ── submitModifyRequestOfflineAware ───────────────────────────────────────────

const insertPendingSync = db.insertPendingSync as jest.Mock;

beforeEach(() => {
  (db.insertPendingSync as jest.Mock).mockResolvedValue(undefined);
});

describe('submitModifyRequestOfflineAware', () => {
  const modifyPayload = { invader_id: 5, proposed_state: 'Destroyed' } as any;

  it('calls the API when online and does not queue', async () => {
    apiSubmitModify.mockResolvedValue(undefined);

    await submitModifyRequestOfflineAware(mockDb, 42, modifyPayload);

    expect(apiSubmitModify).toHaveBeenCalledWith(modifyPayload);
    expect(insertPendingSync).not.toHaveBeenCalled();
  });

  it('queues as modify_request when offline (network error)', async () => {
    apiSubmitModify.mockRejectedValue({ code: 'ERR_NETWORK' });

    await submitModifyRequestOfflineAware(mockDb, 42, modifyPayload);

    expect(insertPendingSync).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      type: 'modify_request',
      invader_id: 5,
      user_id: 42,
      payload: JSON.stringify(modifyPayload),
    }));
  });

  it('re-throws non-network errors (validation, 4xx)', async () => {
    apiSubmitModify.mockRejectedValue({ response: { status: 422 } });

    await expect(submitModifyRequestOfflineAware(mockDb, 42, modifyPayload))
      .rejects.toMatchObject({ response: { status: 422 } });
    expect(insertPendingSync).not.toHaveBeenCalled();
  });
});

// ── submitCreateRequestOfflineAware ──────────────────────────────────────────

describe('submitCreateRequestOfflineAware', () => {
  const createPayload = { proposed_name: 'PA_999', proposed_latitude: 48.85, proposed_longitude: 2.35 } as any;

  it('calls the API when online, returns the UserRequest and does not queue', async () => {
    const req = { id: 1, user_id: 42, invader_id: null, request_type: 'create', status: 'pending', proposed_name: 'PA_999', updated_at: null };
    apiSubmitCreate.mockResolvedValue(req);

    const result = await submitCreateRequestOfflineAware(mockDb, 42, createPayload);

    expect(apiSubmitCreate).toHaveBeenCalledWith(createPayload);
    expect(insertPendingSync).not.toHaveBeenCalled();
    expect(result).toEqual(req);
  });

  it('queues as create_request when offline and returns null', async () => {
    apiSubmitCreate.mockRejectedValue({ code: 'ERR_NETWORK' });

    const result = await submitCreateRequestOfflineAware(mockDb, 42, createPayload);

    expect(insertPendingSync).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      type: 'create_request',
      invader_id: null,
      user_id: 42,
      payload: JSON.stringify(createPayload),
    }));
    expect(result).toBeNull();
  });

  it('re-throws non-network errors', async () => {
    apiSubmitCreate.mockRejectedValue({ response: { status: 400 } });

    await expect(submitCreateRequestOfflineAware(mockDb, 42, createPayload))
      .rejects.toMatchObject({ response: { status: 400 } });
    expect(insertPendingSync).not.toHaveBeenCalled();
  });
});

// ── syncAll ───────────────────────────────────────────────────────────────────

describe('syncAll', () => {
  it('flushes pending syncs before fetching from server', async () => {
    const callOrder: string[] = [];
    getPendingSyncs.mockImplementation(async () => { callOrder.push('flush'); return []; });
    fetchInvaders.mockImplementation(async () => { callOrder.push('fetch'); return []; });

    await syncAll(mockDb, 42);

    expect(callOrder.indexOf('flush')).toBeLessThan(callOrder.indexOf('fetch'));
  });

  it('does a full sync (no delta) when no timestamp is stored', async () => {
    getMeta.mockResolvedValue(null);

    await syncAll(mockDb, 42);

    expect(fetchInvaders).toHaveBeenCalledWith(undefined);
    expect(fetchProgress).toHaveBeenCalledWith(42, undefined);
    expect(replaceCaptures).toHaveBeenCalled();
    expect(upsertCaptures).not.toHaveBeenCalled();
  });

  it('does a delta sync when a timestamp is stored', async () => {
    const ts = '2024-06-01T00:00:00Z';
    getMeta.mockResolvedValue(ts);

    await syncAll(mockDb, 42);

    expect(fetchInvaders).toHaveBeenCalledWith(ts);
    expect(fetchProgress).toHaveBeenCalledWith(42, ts);
    expect(upsertCaptures).toHaveBeenCalled();
    expect(replaceCaptures).not.toHaveBeenCalled();
  });

  it('saves a new sync timestamp after a successful sync', async () => {
    await syncAll(mockDb, 42);

    expect(setMeta).toHaveBeenCalledWith(mockDb, 'last_invaders_sync', expect.any(String));
    expect(setMeta).toHaveBeenCalledWith(mockDb, 'last_progress_sync', expect.any(String));
    expect(setMeta).toHaveBeenCalledWith(mockDb, 'last_requests_sync', expect.any(String));
  });

  it('does not save timestamp when a network error occurs', async () => {
    fetchInvaders.mockRejectedValue({ code: 'ERR_NETWORK' });

    await expect(syncAll(mockDb, 42)).rejects.toBeTruthy();

    expect(setMeta).not.toHaveBeenCalled();
  });
});

// ── Guest mode ────────────────────────────────────────────────────────────────

describe('syncInvadersOnly (guest sync)', () => {
  it('fetches and stores invaders without touching progress or requests', async () => {
    fetchInvaders.mockResolvedValue([{ id: 1 }]);
    fetchDeletedInvaderIds.mockResolvedValue([2]);

    await syncInvadersOnly(mockDb);

    expect(upsertInvaders).toHaveBeenCalledWith(mockDb, [{ id: 1 }]);
    expect(deleteInvadersByIds).toHaveBeenCalledWith(mockDb, [2]);
    expect(setMeta).toHaveBeenCalledWith(mockDb, 'last_invaders_sync', expect.any(String));
    expect(fetchProgress).not.toHaveBeenCalled();
    expect(fetchUserRequests).not.toHaveBeenCalled();
    expect(setMeta).not.toHaveBeenCalledWith(mockDb, 'last_progress_sync', expect.any(String));
  });

  it('does a delta fetch when a timestamp is stored', async () => {
    getMeta.mockResolvedValue('2024-06-01T00:00:00Z');

    await syncInvadersOnly(mockDb);

    expect(fetchInvaders).toHaveBeenCalledWith('2024-06-01T00:00:00Z');
  });
});

describe('syncAll — guest → account claim', () => {
  function makeGuestCapture(overrides: Partial<Capture> = {}): Capture {
    return { id: -1000, invader_id: 10, user_id: GUEST_USER_ID, found_at: '2024-01-01T00:00:00Z', ...overrides };
  }

  it('claims local guest captures then deletes them', async () => {
    getAllCaptures.mockImplementation(async (_db: unknown, userId: number) =>
      userId === GUEST_USER_ID ? [makeGuestCapture(), makeGuestCapture({ id: -1001, invader_id: 11 })] : [],
    );

    await syncAll(mockDb, 42);

    expect(claimCaptures).toHaveBeenCalledWith([
      { invader_id: 10, found_at: '2024-01-01T00:00:00Z' },
      { invader_id: 11, found_at: '2024-01-01T00:00:00Z' },
    ]);
    expect(deleteCapturesForUser).toHaveBeenCalledWith(mockDb, GUEST_USER_ID);
  });

  it('does nothing when there are no guest captures', async () => {
    await syncAll(mockDb, 42);

    expect(claimCaptures).not.toHaveBeenCalled();
    expect(deleteCapturesForUser).not.toHaveBeenCalled();
  });

  it('keeps local guest captures when the claim fails (retried next sync)', async () => {
    getAllCaptures.mockImplementation(async (_db: unknown, userId: number) =>
      userId === GUEST_USER_ID ? [makeGuestCapture()] : [],
    );
    claimCaptures.mockRejectedValue({ code: 'ERR_NETWORK' });

    await expect(syncAll(mockDb, 42)).rejects.toBeTruthy();

    expect(deleteCapturesForUser).not.toHaveBeenCalled();
  });
});
