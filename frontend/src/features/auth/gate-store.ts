import { create } from 'zustand';

/**
 * Visibility of the account-gate modal (guest tapped an account-only feature).
 * The modal itself is mounted once in the root layout — see AccountGateModal.
 */
type AccountGateState = {
  visible: boolean;
  open: () => void;
  close: () => void;
};

export const useAccountGateStore = create<AccountGateState>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));
