import { useEffect, useRef, useState } from 'react';
import { lookupUsername } from '../services/friends.api';
import type { FriendLookup } from '../types';

const DEBOUNCE_MS = 400;
const MIN_LENGTH = 3; // usernames are at least 3 characters

export type UsernameLookupState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'found'; match: FriendLookup }
  | { status: 'not_found' };

/**
 * Checks, shortly after typing stops, whether a user has exactly this name
 * (any capitalization). Answers to an older text are dropped. Network errors
 * fall back to idle: the Send flow still reports the real error.
 */
export function useUsernameLookup(text: string, enabled: boolean): UsernameLookupState {
  const [state, setState] = useState<UsernameLookupState>({ status: 'idle' });
  const requestRef = useRef(0);

  useEffect(() => {
    const name = text.trim();
    const request = ++requestRef.current;
    if (!enabled || name.length < MIN_LENGTH) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const match = await lookupUsername(name);
        if (request !== requestRef.current) return;
        setState(match ? { status: 'found', match } : { status: 'not_found' });
      } catch {
        if (request === requestRef.current) setState({ status: 'idle' });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, enabled]);

  return state;
}
