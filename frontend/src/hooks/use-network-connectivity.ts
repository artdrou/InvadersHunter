import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useConnectivityStore } from '@/services/connectivity';

/**
 * Subscribes to NetInfo and keeps the connectivity store in sync.
 *
 * isOnline = internet AND backend reachable.
 * - internet lost → setOnline(false) immediately
 * - internet restored → trigger onReconnect (runSync); setOnline(true) only after
 *   sync succeeds (responsibility of the caller, not this hook)
 */
export function useNetworkConnectivity(onReconnect: () => void) {
  const setOnline = useConnectivityStore((s) => s.setOnline);
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      const isConnected = !!state.isConnected;

      if (!isConnected) {
        setOnline(false);
      } else if (wasConnected.current === false) {
        // internet restored — trigger sync; sync result owns setOnline(true)
        onReconnect();
      }

      wasConnected.current = isConnected;
    });
  }, [setOnline, onReconnect]);
}
