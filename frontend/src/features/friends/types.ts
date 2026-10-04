/** One row of the Social tab. `id` is the friendship id (accept / remove). */
export type FriendEntry = {
  id: number;
  user_id: number;
  username: string;
  flashed_count: number;
  since: string | null;
};

export type FriendsOverview = {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
};

export type FriendRequestResult = {
  id: number;
  status: 'pending' | 'accepted';
  /** True when they had already invited you: it became a friendship at once. */
  accepted: boolean;
};

/** A friend's game stats (no email / private settings). */
export type FriendProfile = {
  id: number;
  username: string;
  created_at: string | null;
  first_flash_at: string | null;
  last_flash_at: string | null;
  requests_sent: number;
  requests_accepted: number;
  comments: number;
  flashed_invader_ids: number[];
};

/** "friend" = their flashes instead of mine; "compare" = both, 4 colors. */
export type FriendMapMode = 'friend' | 'compare';

export type FriendMapView = {
  userId: number;
  username: string;
  flashedIds: number[];
  mode: FriendMapMode;
};
