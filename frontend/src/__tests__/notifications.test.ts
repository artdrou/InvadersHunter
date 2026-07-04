import { resolveNotificationTapScreen } from '../features/notifications/notification-handler';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/services/api-client', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import {
  registerPushToken,
  unregisterPushToken,
  fetchMyNotificationPrefs,
  updateMyNotificationPrefs,
  fetchGlobalNotificationSettings,
  updateGlobalNotificationSettings,
} from '../features/notifications/services/notifications.api';

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPatch.mockReset();
  mockDelete.mockReset();
});

// ── resolveNotificationTapScreen ───────────────────────────────────────────────

describe('resolveNotificationTapScreen', () => {
  it('returns the screen carried by the notification data', () => {
    expect(resolveNotificationTapScreen({ screen: '/news' })).toBe('/news');
  });

  it('defaults to /news when data is undefined', () => {
    expect(resolveNotificationTapScreen(undefined)).toBe('/news');
  });

  it('defaults to /news when data is null', () => {
    expect(resolveNotificationTapScreen(null)).toBe('/news');
  });

  it('defaults to /news when screen is missing', () => {
    expect(resolveNotificationTapScreen({ invader_id: 5 })).toBe('/news');
  });
});

// ── notifications.api ─────────────────────────────────────────────────────────

describe('registerPushToken', () => {
  it('posts the token and platform', async () => {
    mockPost.mockResolvedValue({ data: {} });
    await registerPushToken('ExponentPushToken[a]', 'ios');
    expect(mockPost).toHaveBeenCalledWith('/notifications/push-token', {
      token: 'ExponentPushToken[a]',
      platform: 'ios',
    });
  });
});

describe('unregisterPushToken', () => {
  it('deletes by URL-encoded token', async () => {
    mockDelete.mockResolvedValue({ data: {} });
    await unregisterPushToken('ExponentPushToken[a/b]');
    expect(mockDelete).toHaveBeenCalledWith('/notifications/push-token/ExponentPushToken%5Ba%2Fb%5D');
  });
});

describe('fetchMyNotificationPrefs', () => {
  it('returns the parsed prefs', async () => {
    mockGet.mockResolvedValue({ data: { notifications_enabled: false } });
    const prefs = await fetchMyNotificationPrefs();
    expect(mockGet).toHaveBeenCalledWith('/notifications/me');
    expect(prefs).toEqual({ notifications_enabled: false });
  });
});

describe('updateMyNotificationPrefs', () => {
  it('patches the enabled flag', async () => {
    mockPatch.mockResolvedValue({ data: { notifications_enabled: true } });
    const prefs = await updateMyNotificationPrefs(true);
    expect(mockPatch).toHaveBeenCalledWith('/notifications/me', { notifications_enabled: true });
    expect(prefs).toEqual({ notifications_enabled: true });
  });
});

describe('fetchGlobalNotificationSettings', () => {
  it('returns the parsed global settings', async () => {
    const data = { enabled: true, notify_on_create: true, notify_on_update: false, updated_at: null };
    mockGet.mockResolvedValue({ data });
    const settings = await fetchGlobalNotificationSettings();
    expect(mockGet).toHaveBeenCalledWith('/notifications/settings');
    expect(settings).toEqual(data);
  });
});

describe('updateGlobalNotificationSettings', () => {
  it('patches only the provided fields', async () => {
    mockPatch.mockResolvedValue({ data: { enabled: false, notify_on_create: true, notify_on_update: true, updated_at: null } });
    await updateGlobalNotificationSettings({ enabled: false });
    expect(mockPatch).toHaveBeenCalledWith('/notifications/settings', { enabled: false });
  });
});
