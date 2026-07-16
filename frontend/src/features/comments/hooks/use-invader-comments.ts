import { useCallback, useEffect, useState } from 'react';
import {
  fetchComments,
  postComment,
  reportComment,
  deleteComment,
  reactToComment,
} from '../services/comments.api';
import type { Comment, ReactionValue } from '../types';

type State = {
  comments: Comment[];
  loading: boolean;
  error: boolean;
};

const EMPTY: State = { comments: [], loading: false, error: false };

/**
 * Comment wall state for one invader. Fetches once when `enabled` flips on
 * (i.e. the modal opens) and exposes optimistic add/report/delete that keep the
 * local list in sync without a full refetch.
 */
export function useInvaderComments(invaderId: number | null, enabled: boolean) {
  const [state, setState] = useState<State>(EMPTY);

  const load = useCallback(() => {
    if (invaderId == null) return;
    setState((s) => ({ ...s, loading: true, error: false }));
    fetchComments(invaderId)
      .then((comments) => setState({ comments, loading: false, error: false }))
      .catch(() => setState((s) => ({ ...s, loading: false, error: true })));
  }, [invaderId]);

  useEffect(() => {
    if (enabled && invaderId != null) load();
    if (!enabled) setState(EMPTY); // drop stale data so reopening always refetches
  }, [enabled, invaderId, load]);

  /** Post a comment. Hidden results are not inserted (they're never listed). */
  const add = useCallback(
    async (body: string): Promise<Comment | null> => {
      if (invaderId == null) return null;
      const created = await postComment(invaderId, body);
      if (created.status !== 'hidden') {
        setState((s) => ({ ...s, comments: [created, ...s.comments] }));
      }
      return created;
    },
    [invaderId],
  );

  const remove = useCallback(async (commentId: number) => {
    await deleteComment(commentId);
    setState((s) => ({ ...s, comments: s.comments.filter((c) => c.id !== commentId) }));
  }, []);

  const report = useCallback(async (commentId: number): Promise<Comment> => {
    const updated = await reportComment(commentId);
    setState((s) => ({
      ...s,
      comments: s.comments.map((c) => (c.id === updated.id ? updated : c)),
    }));
    return updated;
  }, []);

  const react = useCallback(async (commentId: number, value: ReactionValue): Promise<Comment> => {
    const updated = await reactToComment(commentId, value);
    setState((s) => ({
      ...s,
      comments: s.comments.map((c) => (c.id === updated.id ? updated : c)),
    }));
    return updated;
  }, []);

  return { ...state, reload: load, add, remove, report, react };
}
