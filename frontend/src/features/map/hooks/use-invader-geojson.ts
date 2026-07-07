import { useMemo } from "react";
import type { InvaderWithState } from "@/features/invaders";
import type { GreyMode, ColorMode } from "../filter";
import { isNonFlashable as isStateNonFlashable } from "@/features/invaders/types";
import { ISS_INVADER_NAME } from "@/features/iss/constants";

const BASE_ICON_SIZE = 0.25;

const RARITY_VALUES = new Set([10, 20, 30, 40, 50, 100]);
const FALLBACK_RARITY = 30;

function resolveRarity(points: number | null | undefined): number {
  return points != null && RARITY_VALUES.has(points) ? points : FALLBACK_RARITY;
}

function isDimmed(invader: InvaderWithState, colorMode: ColorMode, greyMode: GreyMode): boolean {
  const isNonFlashable = isStateNonFlashable(invader.state);
  return (greyMode === "all" && isNonFlashable) ||
    (greyMode === "unflashed" && colorMode === "flash" && isNonFlashable && !invader.isCaptured);
}

export function resolveIconKey(invader: InvaderWithState, colorMode: ColorMode, greyMode: GreyMode): string {
  const rarity = resolveRarity(invader.points);
  if (isDimmed(invader, colorMode, greyMode)) return `marker-${rarity}pts-grey`;
  if (colorMode === "rarity") return `marker-${rarity}pts-rarity`;
  return `marker-${rarity}pts-flash-${invader.isCaptured ? "captured" : "uncaptured"}`;
}

// When building a multi-stop itinerary, tapped invaders are shown with a golden
// marker (per tier, so each keeps its own silhouette) to stand out against the
// red/blue markers.
function highlightIconKey(points: number | null | undefined): string {
  return `marker-${resolveRarity(points)}pts-highlight`;
}

export function useInvaderGeojson(invaders: InvaderWithState[], greyMode: GreyMode, colorMode: ColorMode, highlightedIds?: number[]) {
  return useMemo(() => {
    const highlightSet = highlightedIds && highlightedIds.length > 0 ? new Set(highlightedIds) : null;
    return {
    type: "FeatureCollection" as const,
    features: invaders.filter((invader) => invader.name !== ISS_INVADER_NAME && invader.latitude != null && invader.longitude != null).map((invader) => {
      const size = invader.points ? Math.min(24, 10 * Math.log10(invader.points)) : 12;
      const iconSize = (size / 12) * BASE_ICON_SIZE;
      const highlighted = highlightSet?.has(invader.id) ?? false;
      const iconKey = highlighted ? highlightIconKey(invader.points) : resolveIconKey(invader, colorMode, greyMode);
      const grey = !highlighted && isDimmed(invader, colorMode, greyMode) ? 1 : 0;
      return {
        type: "Feature" as const,
        id: String(invader.id),
        geometry: {
          type: "Point" as const,
          coordinates: [invader.longitude!, invader.latitude!],
        },
        properties: {
          id: invader.id,
          captured: invader.isCaptured ? 1 : 0,
          pending: !highlighted && invader.isPending ? 1 : 0,
          highlight: highlighted ? 1 : 0,
          grey,
          iconKey,
          iconSize,
        },
      };
    }),
    };
  }, [invaders, greyMode, colorMode, highlightedIds]);
}
