import { useCallback, useEffect, useState } from 'react';
import { fetchCommentSummary } from '../services/comments.api';
import type { CommentSummary } from '../types';

/**
 * Comment count + top comment for an invader, for the map popup / detail panel
 * (badge and pinned top line). Network-only and fail-silent — offline or on an
 * older backend it just returns null and the UI omits the badge/line. A
 * session cache avoids refetching every time the same popup reopens; `refresh`
 * busts it (e.g. after the user posts from the wall).
 */
const cache = new Map<number, CommentSummary>();

export function useInvaderCommentSummary(invaderId: number | null) {
  const [summary, setSummary] = useState<CommentSummary | null>(
    invaderId != null ? cache.get(invaderId) ?? null : null,
  );

  const fetchInto = useCallback((id: number) => {
    fetchCommentSummary(id)
      .then((s) => {
        cache.set(id, s);
        setSummary(s);
      })
      .catch(() => {}); // offline / older backend — silently omit
  }, []);

  useEffect(() => {
    if (invaderId == null) {
      setSummary(null);
      return;
    }
    const cached = cache.get(invaderId);
    setSummary(cached ?? null);
    if (!cached) fetchInto(invaderId);
  }, [invaderId, fetchInto]);

  const refresh = useCallback(() => {
    if (invaderId == null) return;
    cache.delete(invaderId);
    fetchInto(invaderId);
  }, [invaderId, fetchInto]);

  return { summary, refresh };
}
