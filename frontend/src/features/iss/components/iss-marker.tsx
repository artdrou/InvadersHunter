import { ShapeSource, SymbolLayer } from '@maplibre/maplibre-react-native';
import type { InvaderWithState } from '@/features/invaders';
import type { ColorMode, GreyMode } from '@/features/map/components/map-filter-bar';
import { useIssPosition } from '../hooks/use-iss-position';

type Props = {
  issInvader: InvaderWithState;
  colorMode: ColorMode;
  greyMode: GreyMode;
  onPress: (invader: InvaderWithState) => void;
};

export function ISSMarker({ issInvader, onPress }: Props) {
  const position = useIssPosition();

  if (!position) return null;

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: String(issInvader.id),
        geometry: { type: 'Point', coordinates: position },
        properties: {
          id: issInvader.id,
          captured: issInvader.isCaptured ? 1 : 0,
          pending: issInvader.isPending ? 1 : 0,
          iconKey: issInvader.isCaptured ? 'marker-captured' : 'marker-uncaptured',
          iconSize: 0.3,
        },
      },
    ],
  };

  return (
    <ShapeSource
      id="iss-marker"
      shape={geojson}
      onPress={() => onPress(issInvader)}
    >
      <SymbolLayer
        id="iss-symbol"
        style={{
          iconImage: ['get', 'iconKey'],
          iconSize: ['get', 'iconSize'],
          iconOpacity: ['case', ['==', ['get', 'pending'], 1], 0.45, 1.0],
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
        }}
      />
    </ShapeSource>
  );
}
