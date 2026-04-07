
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
  state: InvaderState | null;
  latitude: number;
  longitude: number;
  points: number | null;
  date_pose: string | null;
  image_url: string | null;
};

export type Capture = {
  id: number;
  invader_id: number;
  user_id: number;
  found_at: string;
};

export type InvaderWithState = Invader & {
  isCaptured: boolean;
  capturedAt?: string;
  progressId?: number;
};
