export type CommentStatus = 'visible' | 'hidden' | 'pending_review';

export type Comment = {
  id: number;
  invader_id: number;
  user_id: number;
  username: string;
  body: string;
  /**
   * "visible"        — passed auto-moderation, shown to everyone
   * "pending_review" — moderation unavailable at post time, or reported; still
   *                    listed, queued for admin review
   * "hidden"         — flagged by moderation/admin; the API never lists these,
   *                    but the poster's own client may receive it once (right
   *                    after posting) to explain why it won't appear
   */
  status: CommentStatus;
  created_at: string;
  likes: number;
  dislikes: number;
  /** The current user's reaction: 1 like, -1 dislike, 0 none (0 when anonymous). */
  my_reaction: number;
};

/** Reaction value sent to the API: 1 like, -1 dislike, 0 clear. */
export type ReactionValue = 1 | -1 | 0;

export type CommentSummary = {
  /** Number of listed comments (visible + pending_review). */
  count: number;
  /** Most-liked comment for the map popup; null when nothing has likes yet. */
  top: Comment | null;
};
