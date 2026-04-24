
export const InvaderState = {
  Pristine:        "pristine",
  SlightlyDegraded: "slightly degraded",
  Degraded:        "degraded",
  BadlyDegraded:   "badly degraded",
  Destroyed:       "destroyed",
  NotVisible:      "not visible",
} as const;

export type InvaderState = typeof InvaderState[keyof typeof InvaderState];

export const NON_FLASHABLE_STATES: InvaderState[] = [InvaderState.Destroyed, InvaderState.NotVisible];

export type Invader = {
  id: number;
  description: string;
  name: string;
  city?: string | null;
  number?: number | null;
  state: InvaderState | null;
  latitude: number;
  longitude: number;
  points: number | null;
  date_pose: string | null;
  image_url: string | null;
  updated_at?: string | null;
};

export type Capture = {
  id: number;
  invader_id: number;
  user_id: number;
  found_at: string;
  updated_at?: string | null;
  /** 1 = written offline, waiting to sync; 0 = confirmed by server */
  is_pending?: number;
};

export type InvaderWithState = Invader & {
  isCaptured: boolean;
  isPending: boolean;
  capturedAt?: string;
  progressId?: number;
};

export type UserRequest = {
  id: number;
  user_id: number;
  invader_id: number | null;
  request_type: string;
  status: string;
  proposed_name: string | null;
  updated_at: string | null;
};
