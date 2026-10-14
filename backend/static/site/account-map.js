// InvadersHunter — web account: the map tab (draft, issue #59).
//
// Mirrors the app's map (frontend/src/features/map):
// - style: OpenFreeMap "Liberty" (the base of the app's bundled liberty-base.json),
//   recolored group by group from the app's dark / light palette (styles/build-style.ts,
//   styles/palettes.ts);
// - markers: the app's sprites (marker-<points>pts-flash-captured / -uncaptured / -grey),
//   sized by points like hooks/use-invader-geojson.ts, clustered like
//   components/InvaderClusterSource.tsx.
// MapLibre GL JS is loaded on first use, so the stats tab doesn't pay for it.

const MAPLIBRE = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.20.2/dist/maplibre-gl';
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// styles/palettes.ts → darkMapPalette / lightMapPalette
const PALETTES = {
  dark: {
    background: '#0b1120', water: '#103050', waterLabel: '#5fa8d8', greenery: '#14352b',
    landuse: '#0e1a2e', road: '#34527d', roadCasing: '#1b2f4d', rail: '#3b4a63',
    building: '#111d33', buildingOutline: '#233b5c', boundary: '#41618f',
    label: '#cdd9f0', labelHalo: '#0a0f1e', poi: '#8fa6cc',
  },
  light: {
    background: '#f8f4f0', water: '#a0c8f0', waterLabel: '#4a6a9a', greenery: '#d6e8c4',
    landuse: '#ece3d5', road: '#ffffff', roadCasing: '#d4cdbf', rail: '#c0c0c0',
    building: '#e2ded7', buildingOutline: '#d0c9bd', boundary: '#9aa0aa',
    label: '#333333', labelHalo: '#ffffff', poi: '#666666',
  },
};
// build-style.ts → DROPPED_LAYERS (+ the 3D buildings, opt-in in the app)
const DROPPED = new Set(['natural_earth', 'highway-shield-us-interstate', 'road_shield_us', 'building-3d']);

// components/InvaderClusterSource.tsx → ClusterColor
const CLUSTER = { haloCaptured: '#002fa7', haloDefault: '#a300b3', bubbleCaptured: '#1cf0ff', bubbleDefault: '#ff0062' };
const RARITIES = [10, 20, 30, 40, 50, 100];
const NON_FLASHABLE = ['destroyed', 'not visible'];

/** build-style.ts → recolorLayer(): one Liberty layer recolored from the palette. */
function recolor(layer, p) {
  const id = layer.id;
  const sl = layer['source-layer'];
  const paint = { ...(layer.paint || {}) };
  const fill = (c) => { paint['fill-color'] = c; delete paint['fill-pattern']; };
  // Only line layers take line-color: MapLibre GL JS rejects it on symbol layers
  // (the native SDK in the app silently ignores it).
  const line = (c) => { if (layer.type === 'line') paint['line-color'] = c; };
  const text = (c) => { paint['text-color'] = c; if ('text-halo-color' in paint) paint['text-halo-color'] = p.labelHalo; };

  if (layer.type === 'background') paint['background-color'] = p.background;
  else if (sl === 'water' || sl === 'waterway') (layer.type === 'fill' ? fill : line)(p.water);
  else if (sl === 'water_name') text(p.waterLabel);
  else if (['park', 'landcover_wood', 'landcover_grass', 'landcover_wetland'].includes(id)) {
    fill(p.greenery);
    if ('fill-outline-color' in paint) paint['fill-outline-color'] = p.greenery;
  } else if (id === 'park_outline') line(p.greenery);
  else if (sl === 'landuse' || sl === 'landcover' || sl === 'aeroway') (layer.type === 'fill' ? fill : line)(p.landuse);
  else if (sl === 'transportation') {
    if (layer.type === 'line') line(/rail/.test(id) ? p.rail : /_casing/.test(id) ? p.roadCasing : p.road);
    else if (layer.type === 'fill') fill(p.road);
  } else if (sl === 'transportation_name') text(p.label);
  else if (sl === 'building') {
    if (layer.type === 'fill-extrusion') paint['fill-extrusion-color'] = p.building;
    else {
      fill(p.building);
      if ('fill-outline-color' in paint) paint['fill-outline-color'] = p.buildingOutline;
    }
  } else if (sl === 'boundary') line(p.boundary);
  else if (sl === 'poi' || sl === 'aerodrome_label') text(p.poi);
  else if (sl === 'place') text(p.label);
  return { ...layer, paint };
}

async function buildStyle(theme) {
  const base = await (await fetch(STYLE_URL)).json();
  return { ...base, layers: base.layers.filter((l) => !DROPPED.has(l.id)).map((l) => recolor(l, PALETTES[theme])) };
}

let libPromise = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = `${MAPLIBRE}.css`;
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = `${MAPLIBRE}.js`;
      js.onload = () => resolve(window.maplibregl);
      js.onerror = () => { libPromise = null; reject(new Error('maplibre')); };
      document.head.appendChild(js);
    });
  }
  return libPromise;
}

const rarityOf = (pts) => (RARITIES.includes(pts) ? pts : 30);
// hooks/use-invader-geojson.ts: size from points, BASE_ICON_SIZE 0.25 on 128 px sprites
const iconSizeOf = (pts) => ((pts ? Math.min(24, 10 * Math.log10(pts)) : 12) / 12) * 0.25;

/**
 * Mount the map in `container`. `data`: { invaders, flashedIds: Set, foundAt: Map(id → iso) }.
 * `ui`: { t, tt, esc, fmtDate } from the page. Returns { setFilter, resize }.
 */
export async function mountMap(container, data, ui) {
  const maplibregl = await loadMapLibre();
  const theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const style = await buildStyle(theme);

  const located = data.invaders.filter((i) => i.latitude != null && i.longitude != null);
  const byId = new Map(located.map((i) => [i.id, i]));
  const filter = { status: 'all', condition: 'any', points: new Set(RARITIES) };

  const features = () => ({
    type: 'FeatureCollection',
    features: located.filter((inv) => {
      const captured = data.flashedIds.has(inv.id);
      const flashable = !NON_FLASHABLE.includes((inv.state || '').toLowerCase());
      if (filter.status === 'flashed' && !captured) return false;
      if (filter.status === 'unflashed' && captured) return false;
      if (filter.condition === 'flashable' && !flashable) return false;
      if (filter.condition === 'unflashable' && flashable) return false;
      return filter.points.has(rarityOf(inv.points));
    }).map((inv) => {
      const captured = data.flashedIds.has(inv.id);
      const grey = !captured && NON_FLASHABLE.includes((inv.state || '').toLowerCase());
      const r = rarityOf(inv.points);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [inv.longitude, inv.latitude] },
        properties: {
          id: inv.id,
          captured: captured ? 1 : 0,
          iconKey: grey ? `marker-${r}pts-grey` : `marker-${r}pts-flash-${captured ? 'captured' : 'uncaptured'}`,
          iconSize: iconSizeOf(inv.points),
          grey: grey ? 1 : 0,
        },
      };
    }),
  });

  const map = new maplibregl.Map({
    container, style, attributionControl: { compact: true },
    center: [2.3488, 48.8534], zoom: 12, maxZoom: 19,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
  map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'bottom-right');

  await new Promise((resolve) => map.on('load', resolve));

  await Promise.all(RARITIES.flatMap((r) => ['flash-captured', 'flash-uncaptured', 'grey'].map(async (v) => {
    const key = `marker-${r}pts-${v}`;
    const img = await map.loadImage(`img/markers/${key}.png`);
    map.addImage(key, img.data);
  })));

  map.addSource('invaders', {
    type: 'geojson', data: features(),
    cluster: true, clusterRadius: 50, clusterMaxZoom: 13,
    clusterProperties: { all_captured: ['all', ['==', ['get', 'captured'], 1]] },
  });
  map.addLayer({
    id: 'cluster-halo', type: 'circle', source: 'invaders', filter: ['has', 'point_count'],
    paint: {
      'circle-radius': ['step', ['get', 'point_count'], 28, 10, 34, 50, 42, 200, 50],
      'circle-color': ['case', ['get', 'all_captured'], CLUSTER.haloCaptured, CLUSTER.haloDefault],
      'circle-opacity': 0.45, 'circle-blur': 0.6,
    },
  });
  map.addLayer({
    id: 'cluster-circle', type: 'circle', source: 'invaders', filter: ['has', 'point_count'],
    paint: {
      'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28, 200, 34],
      'circle-color': ['case', ['get', 'all_captured'], CLUSTER.bubbleCaptured, CLUSTER.bubbleDefault],
      'circle-opacity': 0.95,
    },
  });
  map.addLayer({
    id: 'cluster-count', type: 'symbol', source: 'invaders', filter: ['has', 'point_count'],
    layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 13, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true },
    paint: { 'text-color': '#ffffff' },
  });
  map.addLayer({
    id: 'invader-markers', type: 'symbol', source: 'invaders', filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['get', 'iconKey'], 'icon-size': ['get', 'iconSize'],
      'icon-allow-overlap': true, 'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': ['case', ['==', ['get', 'grey'], 1], 0.8, 1] },
  });

  // Start on the city the user flashed most (fallback: Paris).
  const flashed = located.filter((i) => data.flashedIds.has(i.id));
  if (flashed.length) {
    const count = new Map();
    for (const i of flashed) { const c = i.name.split('_')[0]; count.set(c, (count.get(c) || 0) + 1); }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const pts = located.filter((i) => i.name.split('_')[0] === top);
    const b = new maplibregl.LngLatBounds();
    pts.forEach((i) => b.extend([i.longitude, i.latitude]));
    map.fitBounds(b, { padding: 40, maxZoom: 14, duration: 0 });
  }

  // Cluster tap → zoom in; marker tap → the invader's card.
  map.on('click', 'cluster-circle', async (e) => {
    const f = e.features[0];
    const zoom = await map.getSource('invaders').getClusterExpansionZoom(f.properties.cluster_id);
    map.easeTo({ center: f.geometry.coordinates, zoom });
  });
  let popup = null;
  map.on('click', 'invader-markers', (e) => {
    const inv = byId.get(e.features[0].properties.id);
    if (!inv) return;
    popup?.remove();
    popup = new maplibregl.Popup({ className: 'inv-popup', maxWidth: '300px', offset: 18 })
      .setLngLat([inv.longitude, inv.latitude])
      .setHTML(cardHtml(inv, data, ui))
      .addTo(map);
  });
  for (const layer of ['cluster-circle', 'invader-markers']) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  }

  return {
    setFilter(next) {
      Object.assign(filter, next);
      map.getSource('invaders').setData(features());
    },
    resize: () => map.resize(),
    count: () => features().features.length,
  };
}

/** The invader card, like the app's InvaderPopup (photo, points, state, dates, directions). */
function cardHtml(inv, data, { t, esc, fmtDate }) {
  const found = data.foundAt.get(inv.id);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${inv.latitude},${inv.longitude}&travelmode=walking`;
  const row = (label, value) => `<div class="ip-row"><span>${t(label)}</span><b>${esc(value)}</b></div>`;
  return `
    <div class="ip">
      <h3>${esc(inv.name)}</h3>
      ${inv.image_url ? `<img src="${esc(inv.image_url)}" alt="" loading="lazy">` : ''}
      ${row('map.points', inv.points ?? '—')}
      ${row('map.state', inv.state || '—')}
      ${row('map.posed', inv.date_pose ? fmtDate(inv.date_pose) : '—')}
      ${row('map.flashed', found ? fmtDate(found) : '—')}
      <a class="btn btn-secondary btn-sm" href="${directions}" target="_blank" rel="noopener">${t('map.directions')}</a>
    </div>`;
}
