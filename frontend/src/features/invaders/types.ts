
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
  invader_id: number;
  user_id: number;
};

export type InvaderWithState = Invader & {
  isCaptured: boolean;
};
