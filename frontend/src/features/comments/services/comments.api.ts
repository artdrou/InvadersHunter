import { api } from '@/services/api-client';
import type { Comment, CommentSummary, ReactionValue } from '../types';

/** Public — guests read the wall too. Excludes hidden comments, newest first. */
export async function fetchComments(invaderId: number): Promise<Comment[]> {
  const res = await api.get(`/invaders/${invaderId}/comments`);
  return res.data;
}

/**
 * Post a comment. Auto-moderated server-side: the returned `status` tells the
 * poster whether it's visible, queued (pending_review), or hidden.
 */
export async function postComment(invaderId: number, body: string): Promise<Comment> {
  const res = await api.post(`/invaders/${invaderId}/comments`, { body });
  return res.data;
}

/** Flag a comment for admin review. Returns the updated comment. */
export async function reportComment(commentId: number): Promise<Comment> {
  const res = await api.post(`/comments/${commentId}/report`);
  return res.data;
}

/** Owner-or-admin only. */
export async function deleteComment(commentId: number): Promise<void> {
  await api.delete(`/comments/${commentId}`);
}

/** Set the caller's reaction: 1 like, -1 dislike, 0 clear. Returns the updated comment. */
export async function reactToComment(commentId: number, value: ReactionValue): Promise<Comment> {
  const res = await api.post(`/comments/${commentId}/react`, { value });
  return res.data;
}

/** Count + top comment for an invader (drives the map-popup badge and top line). */
export async function fetchCommentSummary(invaderId: number): Promise<CommentSummary> {
  const res = await api.get(`/invaders/${invaderId}/comments/summary`);
  return res.data;
}
