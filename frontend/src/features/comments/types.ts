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
};
