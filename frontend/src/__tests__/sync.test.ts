/**
 * Tests for sync.ts — flushPendingSyncs, syncAll, isNetworkError.
 *
 * The SQLite db and API calls are fully mocked so these run without a device.
 */

import { isNetworkError, flushPendingSyncs, syncAll, syncInvadersOnly, submitModifyRequestOfflineAware, submitCreateRequestOfflineAware } from '../services/sync';
import * as db from '../services/db';
import * as api from '../features/invaders/services/invaders.api';
import * as customApi from '../features/custom-invaders/services/custom-invaders.api';
import * as accountApi from '../features/auth/services/account.api';
import { GUEST_USER_ID } from '../features/auth/guest';
import type { PendingSync } from '../services/db';
import type { Capture } from '../features/invaders/types';
import type { CustomInvader } from '../features/custom-invaders/types';

jest.mock('../services/db');
jest.mock('../features/invaders/services/invaders.api');
jest.mock('../features/custom-invaders/services/custom-invaders.api');
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
const getAllCustomInvaders     = db.getAllCustomInvaders     as jest.Mock;
const upsertCustomInvaders     = db.upsertCustomInvaders     as jest.Mock;
const replaceCustomInvaders    = db.replaceCustomInvaders    as jest.Mock;
const deleteCustomInvadersByIds = db.deleteCustomInvadersByIds as jest.Mock;
const deleteCustomInvadersForUser = db.deleteCustomInvadersForUser as jest.Mock;

const claimGuestData   = accountApi.claimGuestData as jest.Mock;

const fetchCustomInvaders        = customApi.fetchCustomInvaders        as jest.Mock;
const fetchDeletedCustomInvaderIds = customApi.fetchDeletedCustomInvaderIds as jest.Mock;
const apiCreateCustom  = customApi.createCustomInvader as jest.Mock;
const apiUpdateCustom  = customApi.updateCustomInvader as jest.Mock;
const apiDeleteCustom  = customApi.deleteCustomInvader as jest.Mock;
const apiUploadCustomPhoto = customApi.uploadCustomInvaderPhoto as jest.Mock;
const getCustomInvaderById = db.getCustomInvaderById as jest.Mock;

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
  getAllCustomInvaders.mockResolvedValue([]);
  upsertCustomInvaders.mockResolvedValue(undefined);
  replaceCustomInvaders.mockResolvedValue(undefined);
  deleteCustomInvadersByIds.mockResolvedValue(undefined);
  deleteCustomInvadersForUser.mockResolvedValue(undefined);
  claimGuestData.mockResolvedValue({ custom_invaders: [] });
  apiSubmitModify.mockResolvedValue(undefined);
  apiSubmitCreate.mockResolvedValue(undefined);
  fetchInvaders.mockResolvedValue([]);
  fetchProgress.mockResolvedValue([]);
  fetchDeletedInvaderIds.mockResolvedValue([]);
  fetchUserRequests.mockResolvedValue([]);
  fetchCustomInvaders.mockResolvedValue([]);
  fetchDeletedCustomInvaderIds.mockResolvedValue([]);
  apiCreateCustom.mockResolvedValue(undefined);
  apiUpdateCustom.mockResolvedValue(undefined);
  apiDeleteCustom.mockResolvedValue(undefined);
  apiUploadCustomPhoto.mockResolvedValue('https://cdn.test/p.jpg');
  getCustomInvaderById.mockResolvedValue(null);
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

  function makeGuestCustom(overrides: Partial<CustomInvader> = {}): CustomInvader {
    return {
      id: -2000, user_id: GUEST_USER_ID, name: 'PA_9001', city: 'PA', number: 9001,
      image_url: null, description: null, points: 30, state: 'Good',
      latitude: 48.85, longitude: 2.35, date_pose: null, ...overrides,
    };
  }

  it('claims local guest captures then deletes them', async () => {
    getAllCaptures.mockImplementation(async (_db: unknown, userId: number) =>
      userId === GUEST_USER_ID ? [makeGuestCapture(), makeGuestCapture({ id: -1001, invader_id: 11 })] : [],
    );

    await syncAll(mockDb, 42);

    expect(claimGuestData).toHaveBeenCalledWith([
      { invader_id: 10, found_at: '2024-01-01T00:00:00Z' },
      { invader_id: 11, found_at: '2024-01-01T00:00:00Z' },
    ], []);
    expect(deleteCapturesForUser).toHaveBeenCalledWith(mockDb, GUEST_USER_ID);
  });

  it('does nothing when there is no guest data at all', async () => {
    await syncAll(mockDb, 42);

    expect(claimGuestData).not.toHaveBeenCalled();
    expect(deleteCapturesForUser).not.toHaveBeenCalled();
    expect(deleteCustomInvadersForUser).not.toHaveBeenCalled();
  });

  it('continues the sync and keeps guest rows when the server rejects the claim (e.g. old backend 404)', async () => {
    getAllCaptures.mockImplementation(async (_db: unknown, userId: number) =>
      userId === GUEST_USER_ID ? [makeGuestCapture()] : [],
    );
    claimGuestData.mockRejectedValue({ response: { status: 404 } });

    await syncAll(mockDb, 42);  // must NOT throw

    expect(deleteCapturesForUser).not.toHaveBeenCalled();
    expect(fetchProgress).toHaveBeenCalled();  // rest of the sync ran
  });

  it('keeps local guest captures when the claim fails (retried next sync)', async () => {
    getAllCaptures.mockImplementation(async (_db: unknown, userId: number) =>
      userId === GUEST_USER_ID ? [makeGuestCapture()] : [],
    );
    claimGuestData.mockRejectedValue({ code: 'ERR_NETWORK' });

    await expect(syncAll(mockDb, 42)).rejects.toBeTruthy();

    expect(deleteCapturesForUser).not.toHaveBeenCalled();
  });

  // ── custom invaders in the claim ────────────────────────────────────────────

  it('claims guest custom invaders even when there are no captures', async () => {
    getAllCustomInvaders.mockImplementation(async (_db: unknown, userId: number) =>
      userId === GUEST_USER_ID ? [makeGuestCustom()] : [],
    );

    await syncAll(mockDb, 42);

    expect(claimGuestData).toHaveBeenCalledWith([], [
      expect.objectContaining({ local_id: -2000, name: 'PA_9001', latitude: 48.85 }),
    ]);
    expect(deleteCustomInvadersForUser).toHaveBeenCalledWith(mockDb, GUEST_USER_ID);
  });

  it('rewrites claimed custom invaders onto their real server ids', async () => {
    getAllCustomInvaders.mockImplementation(async (_db: unknown, userId: number) =>
      userId === GUEST_USER_ID ? [makeGuestCustom()] : [],
    );
    claimGuestData.mockResolvedValue({
      custom_invaders: [
        { local_id: -2000, invader: { ...makeGuestCustom(), id: 77, user_id: 42 } },
      ],
    });

    await syncAll(mockDb, 42);

    // The temporary -2000 row is gone and the canonical id 77 row took its place
    expect(deleteCustomInvadersForUser).toHaveBeenCalledWith(mockDb, GUEST_USER_ID);
    expect(upsertCustomInvaders).toHaveBeenCalledWith(mockDb, [
      expect.objectContaining({ id: 77, user_id: 42, is_pending: 0 }),
    ]);
  });

  it('keeps guest custom invaders when the claim is rejected', async () => {
    getAllCustomInvaders.mockImplementation(async (_db: unknown, userId: number) =>
      userId === GUEST_USER_ID ? [makeGuestCustom()] : [],
    );
    claimGuestData.mockRejectedValue({ response: { status: 404 } });

    await syncAll(mockDb, 42);

    expect(deleteCustomInvadersForUser).not.toHaveBeenCalled();
  });
});

describe('syncAll — custom invaders delta', () => {
  it('full-replaces on first sync and upserts on a delta sync', async () => {
    const row = { id: 1, user_id: 42, name: 'PA_1' };
    fetchCustomInvaders.mockResolvedValue([row]);

    await syncAll(mockDb, 42);  // no meta → first sync
    expect(replaceCustomInvaders).toHaveBeenCalledWith(mockDb, 42, [row]);
    expect(upsertCustomInvaders).not.toHaveBeenCalled();

    jest.clearAllMocks();
    getMeta.mockImplementation(async (_db: unknown, key: string) =>
      key === 'last_custom_invaders_sync' ? '2024-06-01T00:00:00Z' : null,
    );
    fetchCustomInvaders.mockResolvedValue([row]);
    fetchDeletedCustomInvaderIds.mockResolvedValue([]);
    fetchInvaders.mockResolvedValue([]);
    fetchProgress.mockResolvedValue([]);
    fetchUserRequests.mockResolvedValue([]);
    fetchDeletedInvaderIds.mockResolvedValue([]);
    getAllCaptures.mockResolvedValue([]);
    getAllCustomInvaders.mockResolvedValue([]);

    await syncAll(mockDb, 42);
    expect(fetchCustomInvaders).toHaveBeenCalledWith('2024-06-01T00:00:00Z');
    expect(upsertCustomInvaders).toHaveBeenCalledWith(mockDb, [row]);
    expect(replaceCustomInvaders).not.toHaveBeenCalled();
  });

  it('prunes rows deleted from another device', async () => {
    fetchDeletedCustomInvaderIds.mockResolvedValue([5, 6]);

    await syncAll(mockDb, 42);

    expect(deleteCustomInvadersByIds).toHaveBeenCalledWith(mockDb, [5, 6]);
  });

  it('survives a backend without the deleted endpoint', async () => {
    fetchDeletedCustomInvaderIds.mockRejectedValue({ response: { status: 422 } });

    await syncAll(mockDb, 42);  // must NOT throw

    expect(deleteCustomInvadersByIds).toHaveBeenCalledWith(mockDb, []);
    expect(setMeta).toHaveBeenCalledWith(mockDb, 'last_custom_invaders_sync', expect.any(String));
  });
});

describe('syncAll — deferred personal-invader photos', () => {
  const LOCAL_URI = 'file:///tmp/photo.jpg';

  function row(over: Record<string, unknown> = {}) {
    return { id: 88, user_id: 42, name: 'PA_1', image_url: LOCAL_URI, ...over };
  }

  it('uploads photos still held as local files', async () => {
    getAllCustomInvaders.mockResolvedValue([row()]);

    await syncAll(mockDb, 42);

    expect(apiUploadCustomPhoto).toHaveBeenCalledWith(88, LOCAL_URI);
    expect(upsertCustomInvaders).toHaveBeenCalledWith(mockDb, [
      expect.objectContaining({ id: 88, image_url: 'https://cdn.test/p.jpg' }),
    ]);
  });

  it('skips rows that are already uploaded or have no server id yet', async () => {
    getAllCustomInvaders.mockResolvedValue([
      row({ image_url: 'https://cdn.test/already.jpg' }),
      row({ id: -2000 }),          // never reached the server — nothing to upload against
      row({ id: 89, image_url: null }),
    ]);

    await syncAll(mockDb, 42);

    expect(apiUploadCustomPhoto).not.toHaveBeenCalled();
  });

  it('keeps the local uri on a network error so the next sync retries', async () => {
    getAllCustomInvaders.mockResolvedValue([row()]);
    apiUploadCustomPhoto.mockRejectedValue({ code: 'ERR_NETWORK' });

    await syncAll(mockDb, 42);  // must NOT throw

    expect(upsertCustomInvaders).not.toHaveBeenCalledWith(mockDb, [
      expect.objectContaining({ image_url: null }),
    ]);
  });

  it('drops a dead file reference when the server refuses it', async () => {
    getAllCustomInvaders.mockResolvedValue([row()]);
    apiUploadCustomPhoto.mockRejectedValue(new Error('Upload failed (422)'));

    await syncAll(mockDb, 42);

    // No broken image left stuck on the marker forever
    expect(upsertCustomInvaders).toHaveBeenCalledWith(mockDb, [
      expect.objectContaining({ id: 88, image_url: null }),
    ]);
  });
});

describe('flushPendingSyncs — custom invaders', () => {
  function queue(item: Partial<PendingSync>): PendingSync {
    return {
      id: 1, type: 'create_custom_invader', invader_id: -2000, capture_id: null,
      user_id: 42, created_at: '2024-01-01T00:00:00Z', payload: '{"name":"PA_1"}',
      ...item,
    } as PendingSync;
  }

  it('swaps the temporary local row for the server one on create', async () => {
    getPendingSyncs.mockResolvedValue([queue({})]);
    apiCreateCustom.mockResolvedValue({ id: 88, user_id: 42, name: 'PA_1' });

    await flushPendingSyncs(mockDb, 42);

    expect(apiCreateCustom).toHaveBeenCalledWith({ name: 'PA_1' });
    expect(db.deleteCustomInvader).toHaveBeenCalledWith(mockDb, -2000);
    expect(upsertCustomInvaders).toHaveBeenCalledWith(mockDb, [{ id: 88, user_id: 42, name: 'PA_1' }]);
    expect(deletePendingSync).toHaveBeenCalledWith(mockDb, 1);
  });

  it('pushes a queued update and stores the server response', async () => {
    getPendingSyncs.mockResolvedValue([
      queue({ type: 'update_custom_invader', invader_id: 88, payload: '{"points":50}' }),
    ]);
    apiUpdateCustom.mockResolvedValue({ id: 88, points: 50 });

    await flushPendingSyncs(mockDb, 42);

    expect(apiUpdateCustom).toHaveBeenCalledWith(88, { points: 50 });
    expect(upsertCustomInvaders).toHaveBeenCalledWith(mockDb, [{ id: 88, points: 50 }]);
  });

  it('pushes a queued delete', async () => {
    getPendingSyncs.mockResolvedValue([
      queue({ type: 'delete_custom_invader', invader_id: 88, payload: null }),
    ]);

    await flushPendingSyncs(mockDb, 42);

    expect(apiDeleteCustom).toHaveBeenCalledWith(88);
    expect(deletePendingSync).toHaveBeenCalledWith(mockDb, 1);
  });

  it('stops at a network error so the create is retried later', async () => {
    getPendingSyncs.mockResolvedValue([queue({})]);
    apiCreateCustom.mockRejectedValue({ code: 'ERR_NETWORK' });

    await flushPendingSyncs(mockDb, 42);

    expect(deletePendingSync).not.toHaveBeenCalled();
  });
});
