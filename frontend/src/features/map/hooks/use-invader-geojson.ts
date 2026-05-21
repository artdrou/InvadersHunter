import { useMemo } from "react";
import type { InvaderWithState } from "@/features/invaders";
import type { GreyMode, ColorMode } from "../components/map-filter-bar";
import { NON_FLASHABLE_STATES } from "@/features/invaders/types";
import { ISS_INVADER_NAME } from "@/features/iss/constants";

const BASE_ICON_SIZE = 0.25;

const RARITY_ICON: Record<number, string> = {
  10:  "marker-10pts",
  20:  "marker-20pts",
  30:  "marker-30pts",
  40:  "marker-40pts",
  50:  "marker-50pts",
  100: "marker-100pts",
};

function resolveIconKey(invader: InvaderWithState, colorMode: ColorMode, greyMode: GreyMode): string {
  const isNonFlashable = NON_FLASHABLE_STATES.includes(invader.state ?? "");
  const dimmed =
    (greyMode === "all" && isNonFlashable) ||
    (greyMode === "unflashed" && colorMode === "flash" && isNonFlashable && !invader.isCaptured);

  if (dimmed) return "marker-grey";

  if (colorMode === "rarity") {
    return RARITY_ICON[invader.points ?? 0] ?? (invader.isCaptured ? "marker-captured" : "marker-uncaptured");
  }

  return invader.isCaptured ? "marker-captured" : "marker-uncaptured";
}

export function useInvaderGeojson(invaders: InvaderWithState[], greyMode: GreyMode, colorMode: ColorMode) {
  return useMemo(() => ({
    type: "FeatureCollection" as const,
    features: invaders.filter((invader) => invader.name !== ISS_INVADER_NAME && invader.latitude != null && invader.longitude != null).map((invader) => {
      const size = invader.points ? Math.min(24, 10 * Math.log10(invader.points)) : 12;
      const iconSize = (size / 12) * BASE_ICON_SIZE;
      const iconKey = resolveIconKey(invader, colorMode, greyMode);
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
          pending: invader.isPending ? 1 : 0,
          iconKey,
          iconSize,
        },
      };
    }),
  }), [invaders, greyMode, colorMode]);
}
