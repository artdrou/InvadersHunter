import { useMemo } from 'react';
import { ShapeSource, CircleLayer, SymbolLayer } from '@maplibre/maplibre-react-native';
import type { OnPressEvent } from '@maplibre/maplibre-react-native';
import { useTranslation } from 'react-i18next';
import { Brand, White } from '@/constants/theme';
import { customIconKey, isMappable } from '../mapper';
import type { CustomInvader } from '../types';

// Personal invaders live in their own ShapeSource rather than the community one.
// Two reasons: their ids are a separate space (and negative until synced), so
// they'd collide with real invader ids in the shared marker layer; and they must
// stay visually apart from the community dataset rather than melt into its
// clusters. Mirrors the ISSMarker pattern.

const HALO_COLOR = Brand.yellow;

type Props = {
  customInvaders: CustomInvader[];
  onPress: (invader: CustomInvader) => void;
};

export function CustomInvaderSource({ customInvaders, onPress }: Props) {
  const { t } = useTranslation();
  const mappable = useMemo(() => customInvaders.filter(isMappable), [customInvaders]);

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: mappable.map((invader) => ({
      type: 'Feature' as const,
      id: String(invader.id),
      geometry: {
        type: 'Point' as const,
        coordinates: [invader.longitude, invader.latitude],
      },
      properties: {
        id: invader.id,
        iconKey: customIconKey(invader.points),
        // Dimmed while the row hasn't reached the server yet — same language as
        // a pending flash.
        pending: invader.is_pending === 1 ? 1 : 0,
        label: t('customInvaders.markerLabel'),
      },
    })),
  }), [mappable, t]);

  if (mappable.length === 0) return null;

  function handlePress(e: OnPressEvent) {
    const id = e.features?.[0]?.properties?.id;
    const invader = mappable.find((i) => i.id === id);
    if (invader) onPress(invader);
  }

  return (
    <ShapeSource id="custom-invaders" shape={geojson} onPress={handlePress}>
      {/* Golden halo behind the sprite — the "this one is yours" signal that
          tells a personal invader apart from the community markers at a glance. */}
      <CircleLayer
        id="custom-invader-halo"
        style={{
          circleRadius: 16,
          circleColor: HALO_COLOR,
          circleOpacity: 0.35,
          circleBlur: 0.5,
        }}
      />
      <SymbolLayer
        id="custom-invader-markers"
        style={{
          iconImage: ['get', 'iconKey'],
          iconSize: 0.25,
          iconOpacity: ['case', ['==', ['get', 'pending'], 1], 0.45, 1.0],
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
          // "perso" tag under the sprite — the halo says *something* is special,
          // the label says what.
          textField: ['get', 'label'],
          textSize: 10,
          textFont: ['Noto Sans Bold'],
          textColor: White,
          textHaloColor: HALO_COLOR,
          textHaloWidth: 1.2,
          textOffset: [0, 1.6],
          textAnchor: 'top',
          textAllowOverlap: true,
          textIgnorePlacement: true,
        }}
      />
    </ShapeSource>
  );
}
