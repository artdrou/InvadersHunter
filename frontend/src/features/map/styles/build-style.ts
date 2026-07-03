import liberty from './liberty-base.json';
import { type MapPalette } from './palettes';

// A MapLibre style layer, narrowed to the bits we touch. `paint` holds the
// color properties; `source-layer` is the vector-tile category we group on;
// `layout` holds visibility.
type StyleLayer = {
  id: string;
  type: string;
  'source-layer'?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  [k: string]: unknown;
};
type Style = { layers: StyleLayer[]; [k: string]: unknown };

// Vector-tile categories that carry point-of-interest labels (shops, stations,
// airports…) — toggled together by the "map POIs" setting.
const POI_SOURCE_LAYERS = new Set(['poi', 'aerodrome_label']);

// Layers removed from the local styles for performance. This is a flat 2D
// hunting map, so these are pure per-frame cost with no benefit here:
//  - building-3d: 3D extrusion, the heaviest layer to re-render while panning
//    (the flat `building` footprints stay);
//  - natural_earth: shaded-relief raster we already hide — dropping it also
//    stops the tile fetch/composite;
//  - US road shields: never rendered in France, but still processed.
const DROPPED_LAYERS = new Set([
  'building-3d',
  'natural_earth',
  'highway-shield-us-interstate',
  'road_shield_us',
]);

export type BuildOptions = {
  /** Show POI labels. When false, POI layers are hidden. Default true. */
  showPoi?: boolean;
  /** Lean layer set for low-end devices — see isLiteDropped. Default false. */
  lite?: boolean;
};

/**
 * Extra layers dropped in "lite" mode for smoother panning on low-end devices:
 * road casings (the outlines around roads), rail-tie hatching, one-way arrows,
 * road number shields, and minor name labels. Road *surfaces* are kept, so the
 * network stays continuous (no gaps at bridges/tunnels) — only the fine detail
 * and extra per-frame label/collision work go.
 */
function isLiteDropped(id: string): boolean {
  return /_casing$/.test(id)
    || /_hatching$/.test(id)
    || id.startsWith('road_one_way_arrow')
    || id.startsWith('highway-shield')
    || id === 'highway-name-path'
    || id === 'highway-name-minor'
    || id === 'waterway_line_label'
    || id === 'water_name_line_label'
    || id === 'label_village';
}

/**
 * Rewrites one Liberty layer's colors from the palette, chosen by the layer's
 * semantic group (its `source-layer` plus a few id patterns). Any color-bearing
 * paint property (fill / line / background / extrusion / text + halo) is set to
 * the matching palette entry; everything else (geometry, zoom stops, filters) is
 * left untouched, so the map keeps the exact same POIs and layout as the light theme.
 *
 * `fill-pattern` (sprite hatch fills for wetland / pedestrian plazas) is dropped
 * so those areas render as a solid palette color, not light B/W stripes.
 * (The Natural Earth shaded-relief raster is removed wholesale in buildMapStyle.)
 */
function recolorLayer(layer: StyleLayer, p: MapPalette): StyleLayer {
  const id = layer.id;
  const sl = layer['source-layer'];
  const paint: Record<string, unknown> = { ...(layer.paint ?? {}) };

  // Solid fills only — drop any sprite hatch pattern so the flat color shows.
  const setFill = (c: string) => { paint['fill-color'] = c; delete paint['fill-pattern']; };
  const setLine = (c: string) => { paint['line-color'] = c; };
  const setText = (c: string) => {
    paint['text-color'] = c;
    if ('text-halo-color' in paint) paint['text-halo-color'] = p.labelHalo;
  };

  if (layer.type === 'background') {
    paint['background-color'] = p.background;
  } else if (sl === 'water' || sl === 'waterway') {
    if (layer.type === 'fill') setFill(p.water);
    else setLine(p.water);
  } else if (sl === 'water_name') {
    setText(p.waterLabel);
  } else if (id === 'park' || id === 'landcover_wood' || id === 'landcover_grass' || id === 'landcover_wetland') {
    setFill(p.greenery);
    if ('fill-outline-color' in paint) paint['fill-outline-color'] = p.greenery;
  } else if (id === 'park_outline') {
    setLine(p.greenery);
  } else if (sl === 'landuse' || sl === 'landcover' || sl === 'aeroway') {
    if (layer.type === 'fill') setFill(p.landuse);
    else setLine(p.landuse);
  } else if (sl === 'transportation') {
    if (layer.type === 'line') {
      if (/rail/.test(id)) setLine(p.rail);
      else if (/_casing/.test(id)) setLine(p.roadCasing);
      else setLine(p.road);
    } else if (layer.type === 'fill') {
      // Pedestrian plazas etc. — a patterned surface in Liberty.
      setFill(p.road);
    }
  } else if (sl === 'transportation_name') {
    setText(p.label);
  } else if (sl === 'building') {
    if (layer.type === 'fill-extrusion') paint['fill-extrusion-color'] = p.building;
    else {
      setFill(p.building);
      if ('fill-outline-color' in paint) paint['fill-outline-color'] = p.buildingOutline;
    }
  } else if (sl === 'boundary') {
    setLine(p.boundary);
  } else if (sl === 'poi') {
    setText(p.poi);
  } else if (sl === 'place') {
    setText(p.label);
  } else if (sl === 'aerodrome_label') {
    setText(p.poi);
  }

  return { ...layer, paint };
}

/**
 * The Liberty base style recolored from a palette — a keyless, fully local map
 * style (no MapTiler key, same OpenFreeMap tiles/POIs as the light theme).
 */
export function buildMapStyle(palette: MapPalette, { showPoi = true, lite = false }: BuildOptions = {}): object {
  const base = liberty as unknown as Style;
  return {
    ...base,
    layers: base.layers
      .filter((layer) => !DROPPED_LAYERS.has(layer.id))
      .filter((layer) => !lite || !isLiteDropped(layer.id))
      .map((layer) => {
        const recolored = recolorLayer(layer, palette);
        if (!showPoi && POI_SOURCE_LAYERS.has(layer['source-layer'] ?? '')) {
          return { ...recolored, layout: { ...(recolored.layout ?? {}), visibility: 'none' } };
        }
        return recolored;
      }),
  };
}
