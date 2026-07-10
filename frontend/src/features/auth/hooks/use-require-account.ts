import { useCallback } from 'react';
import { useAuthStore } from '../store';
import { useAccountGateStore } from '../gate-store';

/**
 * Gate an action behind having an account.
 *
 * Authenticated users run the action directly. Guests get the app-styled
 * AccountGateModal offering to create an account (→ /register) — the guest's
 * local data is migrated automatically after signup.
 */
export function useRequireAccount() {
  const isGuest = useAuthStore((s) => s.isGuest);

  return useCallback(
    (action: () => void) => {
      if (!isGuest) {
        action();
        return;
      }
      useAccountGateStore.getState().open();
    },
    [isGuest],
  );
}
