import { InvaderState } from "@/features/invaders";

/** Condition options offered in the edit form, in display order. */
export const STATE_OPTIONS = [
  InvaderState.Good,
  InvaderState.SlightlyDegraded,
  InvaderState.Degraded,
  InvaderState.BadlyDegraded,
  InvaderState.Destroyed,
  InvaderState.NotVisible,
  InvaderState.Unknown,
] as const;

/** Maps a state value to its i18n key. */
export const STATE_KEYS: Record<string, string> = {
  [InvaderState.Good]:             "states.Good",
  [InvaderState.SlightlyDegraded]: "states.SlightlyDegraded",
  [InvaderState.Degraded]:         "states.Degraded",
  [InvaderState.BadlyDegraded]:    "states.BadlyDegraded",
  [InvaderState.Destroyed]:        "states.Destroyed",
  [InvaderState.NotVisible]:       "states.NotVisible",
  [InvaderState.Unknown]:          "states.Unknown",
};
