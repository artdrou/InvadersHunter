import type { Invader, InvaderWithState, Capture} from "./types";

export function mapInvadersWithProgress(
  invaders: Invader[],
  progress: Capture[]
): InvaderWithState[] {
  return invaders.map((inv) => {
    const capture = progress.find((p) => p.invader_id === inv.id);

    return {
      ...inv,
      isCaptured: !!capture,
      capturedAt: capture?.found_at,
      progressId: capture?.id,
    };
  });
}