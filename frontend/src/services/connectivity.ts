import { create } from 'zustand';

type ConnectivityState = {
  isOnline: boolean;
  setOnline: (v: boolean) => void;
};

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  isOnline: true, // optimistic default — avoids a flash on startup
  setOnline: (v) => set({ isOnline: v }),
}));
