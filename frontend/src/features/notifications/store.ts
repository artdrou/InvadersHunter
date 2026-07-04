import { create } from 'zustand';

/**
 * Tracks this device's currently-registered Expo push token so it can be
 * unregistered from the backend on logout. Intentionally not persisted:
 * the registration hook re-derives and re-registers it on every app start.
 */
type NotificationsState = {
  currentToken: string | null;
  setCurrentToken: (token: string | null) => void;
  /** Last error from the registration attempt this session, surfaced on the
   * Notifications settings screen so failures are diagnosable without adb. */
  lastRegistrationError: string | null;
  setLastRegistrationError: (message: string | null) => void;
};

export const useNotificationsStore = create<NotificationsState>((set) => ({
  currentToken: null,
  setCurrentToken: (token) => set({ currentToken: token }),
  lastRegistrationError: null,
  setLastRegistrationError: (message) => set({ lastRegistrationError: message }),
}));
