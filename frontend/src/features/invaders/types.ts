
export type Invader = {
  id: number;
  description: string;
  name: string;
  state: string | null;
  latitude: number;
  longitude: number;
  points: number | null;
  date_pose: string | null;
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
