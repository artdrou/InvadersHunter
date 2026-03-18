import type { Invader, InvaderWithState, Capture} from "./types";

export function mapInvadersWithProgress(
  invaders: Invader[],
  progress: Capture[]
): InvaderWithState[] {
  return invaders.map((inv) => {
    const isCaptured = progress.some((p) => p.invader_id === inv.id);

    return {
      ...inv,
      isCaptured
    };
  });
}