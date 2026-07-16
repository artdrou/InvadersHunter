import { useCallback, useEffect, useState } from 'react';
import { fetchInvaderOverview, type InvaderOverview } from '../services/invaders.api';

/**
 * Contributors + comment summary for an invader popup, in one request. Merges
 * what used to be two calls (useInvaderContributors + useInvaderCommentSummary).
 * Network-only and fail-silent — offline or on an older backend it returns null
 * and the UI omits the attribution/badge. A session cache avoids refetching on
 * every popup reopen; `refresh` busts it (e.g. after posting from the wall).
 */
const cache = new Map<number, InvaderOverview>();

export function useInvaderOverview(invaderId: number | null) {
  const [overview, setOverview] = useState<InvaderOverview | null>(
    invaderId != null ? cache.get(invaderId) ?? null : null,
  );

  const fetchInto = useCallback((id: number) => {
    fetchInvaderOverview(id)
      .then((o) => {
        cache.set(id, o);
        setOverview(o);
      })
      .catch(() => {}); // offline / older backend — silently omit
  }, []);

  useEffect(() => {
    if (invaderId == null) {
      setOverview(null);
      return;
    }
    const cached = cache.get(invaderId);
    setOverview(cached ?? null);
    if (!cached) fetchInto(invaderId);
  }, [invaderId, fetchInto]);

  const refresh = useCallback(() => {
    if (invaderId == null) return;
    cache.delete(invaderId);
    fetchInto(invaderId);
  }, [invaderId, fetchInto]);

  return { overview, refresh };
}
