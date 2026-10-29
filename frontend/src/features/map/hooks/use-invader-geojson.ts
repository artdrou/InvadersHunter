import { useMemo } from "react";
import type { InvaderWithState } from "@/features/invaders";
import type { GreyMode, ColorMode } from "../filter";
import { InvaderState, isNonFlashable as isStateNonFlashable } from "@/features/invaders/types";
import { STATE_GROUP_SUFFIX, type StateGroup } from "@/features/marker-customization/types";
import { ISS_INVADER_NAME } from "@/features/iss/constants";

const BASE_ICON_SIZE = 0.25;

const RARITY_VALUES = new Set([10, 20, 30, 40, 50, 100]);
const FALLBACK_RARITY = 30;

function resolveRarity(points: number | null | undefined): number {
  return points != null && RARITY_VALUES.has(points) ? points : FALLBACK_RARITY;
}

function isDimmed(invader: InvaderWithState, colorMode: ColorMode, greyMode: GreyMode): boolean {
  const isNonFlashable = isStateNonFlashable(invader.state);
  const flashedByAnyone = invader.isCaptured || invader.friendCaptured === true;
  return (greyMode === "all" && isNonFlashable) ||
    (greyMode === "unflashed" && colorMode === "flash" && isNonFlashable && !flashedByAnyone);
}

// Shared map: both flashed → captured (blue), neither → uncaptured (red),
// only me → green, only my friend → orange.
function flashSuffix(invader: InvaderWithState): string {
  if (invader.friendCaptured === undefined) return invader.isCaptured ? "captured" : "uncaptured";
  if (invader.isCaptured && invader.friendCaptured) return "captured";
  if (invader.isCaptured) return "mine";
  if (invader.friendCaptured) return "friend";
  return "uncaptured";
}

// States with their own silhouette (marker customization: Destroyed → ghost by
// default). Tolerant of legacy lowercase values, like isNonFlashable.
function stateGroup(state: string | null | undefined): StateGroup | null {
  const s = state?.toLowerCase();
  if (s === InvaderState.Destroyed.toLowerCase()) return "destroyed";
  if (s === InvaderState.NotVisible.toLowerCase()) return "notVisible";
  return null;
}

// Every key exists for both groups (a group left on its points' shape repeats the tier sprite).
function withStateSuffix(key: string, invader: InvaderWithState): string {
  const group = stateGroup(invader.state);
  return group ? `${key}-${STATE_GROUP_SUFFIX[group]}` : key;
}

export function resolveIconKey(invader: InvaderWithState, colorMode: ColorMode, greyMode: GreyMode): string {
  const rarity = resolveRarity(invader.points);
  if (isDimmed(invader, colorMode, greyMode)) return withStateSuffix(`marker-${rarity}pts-grey`, invader);
  if (colorMode === "rarity") return withStateSuffix(`marker-${rarity}pts-rarity`, invader);
  return withStateSuffix(`marker-${rarity}pts-flash-${flashSuffix(invader)}`, invader);
}

// When building a multi-stop itinerary, tapped invaders are shown with a golden
// marker (per tier, so each keeps its own silhouette) to stand out against the
// red/blue markers.
function highlightIconKey(invader: InvaderWithState): string {
  return withStateSuffix(`marker-${resolveRarity(invader.points)}pts-highlight`, invader);
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
      const iconKey = highlighted ? highlightIconKey(invader) : resolveIconKey(invader, colorMode, greyMode);
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
          // On the shared map a cluster turns blue only when both of us flashed everything in it.
          captured: invader.isCaptured && invader.friendCaptured !== false ? 1 : 0,
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
