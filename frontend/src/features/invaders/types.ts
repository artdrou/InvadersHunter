
export type Invader = {
  id: number;
  description: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  points: number;
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
