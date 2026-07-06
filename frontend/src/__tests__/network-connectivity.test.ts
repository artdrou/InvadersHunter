/**
 * Tests for useNetworkConnectivity.
 *
 * Behaviour:
 *  - NetInfo disconnected  → isOnline becomes false immediately
 *  - NetInfo connected after offline → onReconnect is called (sync triggered)
 *                                      isOnline stays false until sync confirms backend
 *  - NetInfo connected on first event (app start) → no onReconnect (no prior offline state)
 *
 * isOnline = internet reachable AND backend responded successfully.
 * This hook only owns the "false on disconnect" side; "true" is set by runSync on success.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useNetworkConnectivity } from '../hooks/use-network-connectivity';
import { useConnectivityStore } from '../services/connectivity';

// ── NetInfo mock ──────────────────────────────────────────────────────────────

let netInfoListener: ((state: { isConnected: boolean }) => void) | null = null;

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((cb: (state: { isConnected: boolean }) => void) => {
    netInfoListener = cb;
    return () => { netInfoListener = null; };
  }),
}));

function emitNetInfo(isConnected: boolean) {
  act(() => { netInfoListener!({ isConnected }); });
}

// Reset the connectivity store and listener between tests
beforeEach(() => {
  useConnectivityStore.setState({ isOnline: true });
  netInfoListener = null;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useNetworkConnectivity', () => {
  it('sets isOnline to false when network is lost', () => {
    const onReconnect = jest.fn();
    renderHook(() => useNetworkConnectivity(onReconnect));

    emitNetInfo(false);

    expect(useConnectivityStore.getState().isOnline).toBe(false);
  });

  it('does not call onReconnect when network is lost', () => {
    const onReconnect = jest.fn();
    renderHook(() => useNetworkConnectivity(onReconnect));

    emitNetInfo(false);

    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('calls onReconnect (triggers sync) when internet is restored after being offline', () => {
    const onReconnect = jest.fn();
    renderHook(() => useNetworkConnectivity(onReconnect));

    emitNetInfo(false);
    emitNetInfo(true);

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('does NOT set isOnline to true on internet restore — backend must confirm via sync', () => {
    // Internet is back but backend might still be unreachable.
    // Only runSync (called via onReconnect) should flip isOnline to true after success.
    const onReconnect = jest.fn();
    renderHook(() => useNetworkConnectivity(onReconnect));

    emitNetInfo(false); // goes offline → isOnline = false
    emitNetInfo(true);  // internet back — must NOT flip isOnline to true yet

    expect(useConnectivityStore.getState().isOnline).toBe(false);
  });

  it('does NOT call onReconnect on the first connected event (app start — no prior offline)', () => {
    const onReconnect = jest.fn();
    renderHook(() => useNetworkConnectivity(onReconnect));

    emitNetInfo(true); // first event, no prior state

    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('calls onReconnect each time the network is restored after an outage', () => {
    const onReconnect = jest.fn();
    renderHook(() => useNetworkConnectivity(onReconnect));

    emitNetInfo(false);
    emitNetInfo(true);
    emitNetInfo(false);
    emitNetInfo(true);

    expect(onReconnect).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes from NetInfo on unmount', () => {
    const onReconnect = jest.fn();
    const { unmount } = renderHook(() => useNetworkConnectivity(onReconnect));

    unmount();

    expect(netInfoListener).toBeNull();
  });
});
