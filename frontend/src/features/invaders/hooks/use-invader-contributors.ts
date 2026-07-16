import { useEffect, useState } from 'react';
import { fetchInvaderContributors } from '../services/invaders.api';
import type { InvaderContributors } from '../types';

/**
 * Contributors of an invader — who discovered it and who updated it
 * (community attribution derived from approved requests, see backend
 * GET /invaders/{id}/contributors).
 *
 * Network-only and fail-silent: offline or on an older backend the hook just
 * returns null and the UI omits the attribution lines. A session-scoped cache
 * avoids refetching every time the same popup reopens.
 */
const cache = new Map<number, InvaderContributors>();

export function useInvaderContributors(invaderId: number | null): InvaderContributors | null {
  const [contributors, setContributors] = useState<InvaderContributors | null>(
    invaderId != null ? cache.get(invaderId) ?? null : null,
  );

  useEffect(() => {
    if (invaderId == null) {
      setContributors(null);
      return;
    }
    const cached = cache.get(invaderId);
    if (cached) {
      setContributors(cached);
      return;
    }
    let cancelled = false;
    setContributors(null);
    fetchInvaderContributors(invaderId)
      .then((c) => {
        cache.set(invaderId, c);
        if (!cancelled) setContributors(c);
      })
      .catch(() => {}); // offline / older backend — silently omit
    return () => { cancelled = true; };
  }, [invaderId]);

  return contributors;
}
