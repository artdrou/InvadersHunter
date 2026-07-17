import { useMemo } from 'react';
import { ShapeSource, SymbolLayer } from '@maplibre/maplibre-react-native';
import type { OnPressEvent } from '@maplibre/maplibre-react-native';
import type { ColorMode, GreyMode } from '@/features/map/filter';
import { useInvaderGeojson } from '@/features/map/hooks/use-invader-geojson';
import { useMarkerLayerStyle, useCustomPalette } from '@/features/map/components/invader-markers';
import { isMappable, toInvaderLike } from '../mapper';
import type { CustomInvader } from '../types';

// Personal invaders live in their own ShapeSource rather than the community one:
// their ids are a separate space (and negative until synced), so they'd collide
// with real invader ids in the shared marker layer's tap lookup. Mirrors the
// ISSMarker pattern.
//
// The markers go through the same geojson builder and layer style as community
// ones, so by default a personal invader looks exactly like a community invader
// of its tier. Two things can change that, both owner-driven: the icon carousel
// (per invader, via icon_shape) and the custom palette (global, opt-in on the
// marker customization screen).

type Props = {
  customInvaders: CustomInvader[];
  colorMode: ColorMode;
  greyMode: GreyMode;
  onPress: (invader: CustomInvader) => void;
};

export function CustomInvaderSource({ customInvaders, colorMode, greyMode, onPress }: Props) {
  const mappable = useMemo(() => customInvaders.filter(isMappable), [customInvaders]);
  const invaderLike = useMemo(() => mappable.map(toInvaderLike), [mappable]);
  const customPalette = useCustomPalette();
  const geojson = useInvaderGeojson(invaderLike, greyMode, colorMode, undefined, { customPalette });
  const markerLayerStyle = useMarkerLayerStyle();

  function handlePress(e: OnPressEvent) {
    const id = e.features?.[0]?.properties?.id;
    const invader = mappable.find((i) => i.id === id);
    if (invader) onPress(invader);
  }

  if (mappable.length === 0) return null;

  return (
    <ShapeSource id="custom-invaders" shape={geojson} onPress={handlePress}>
      <SymbolLayer id="custom-invader-markers" style={markerLayerStyle} />
    </ShapeSource>
  );
}
