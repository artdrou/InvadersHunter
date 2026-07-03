import liberty from './liberty-base.json';
import { type MapPalette } from './palettes';

// A MapLibre style layer, narrowed to the bits we touch. `paint` holds the
// color properties; `source-layer` is the vector-tile category we group on.
type StyleLayer = {
  id: string;
  type: string;
  'source-layer'?: string;
  paint?: Record<string, unknown>;
  [k: string]: unknown;
};
type Style = { layers: StyleLayer[]; [k: string]: unknown };

/**
 * Rewrites one Liberty layer's colors from the palette, chosen by the layer's
 * semantic group (its `source-layer` plus a few id patterns). Any color-bearing
 * paint property (fill / line / background / extrusion / text + halo) is set to
 * the matching palette entry; everything else (geometry, zoom stops, filters) is
 * left untouched, so the map keeps the exact same POIs and layout as the light theme.
 */
function recolorLayer(layer: StyleLayer, p: MapPalette): StyleLayer {
  const id = layer.id;
  const sl = layer['source-layer'];
  const paint: Record<string, unknown> = { ...(layer.paint ?? {}) };

  const setFill = (c: string) => { paint['fill-color'] = c; };
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
  } else if (id === 'park' || id === 'landcover_wood' || id === 'landcover_grass') {
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
export function buildMapStyle(palette: MapPalette): object {
  const base = liberty as unknown as Style;
  return {
    ...base,
    layers: base.layers.map((layer) => recolorLayer(layer, palette)),
  };
}
