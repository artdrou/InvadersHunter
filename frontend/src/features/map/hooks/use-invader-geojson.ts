import { useMemo } from "react";
import type { InvaderWithState } from "@/features/invaders";

const BASE_ICON_SIZE = 0.35;

export function useInvaderGeojson(invaders: InvaderWithState[]) {
  return useMemo(() => ({
    type: "FeatureCollection" as const,
    features: invaders.map((invader) => {
      const size = invader.points ? Math.min(24, 10 * Math.log10(invader.points)) : 12;
      const iconSize = (size / 12) * BASE_ICON_SIZE;
      return {
        type: "Feature" as const,
        id: String(invader.id),
        geometry: {
          type: "Point" as const,
          coordinates: [invader.longitude, invader.latitude],
        },
        properties: {
          id: invader.id,
          captured: invader.isCaptured ? 1 : 0,
          iconSize,
        },
      };
    }),
  }), [invaders]);
}
