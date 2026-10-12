// Parses a position typed or pasted by the user, in any common format:
//   48.8566, 2.3522          48,8566 2,3522 (French decimals)     -33.86 151.21
//   48.8566N 2.3522E         N 48.8566 E 2.3522                   2.3522, 48.8566 (lon first, when obvious)
//   48°51'24"N 2°21'08"E     48° 51.4' N, 2° 21.13' E            48 51 24 N 2 21 8 E
//   Google / Apple / OSM links (…@48.85,2.35,17z  ?q=48.85,2.35  #map=17/48.85/2.35)  geo:48.85,2.35
// Returns null when the text can't be read as exactly one valid lat/lon pair.

export type LatLon = { lat: number; lon: number };

type Component = { parts: number[]; negative: boolean; hemi: string | null };

const URL_PATTERNS: RegExp[] = [
  /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  /[?&](?:q|ll|sll|query|center|daddr|destination|mlat)=(-?\d+(?:\.\d+)?)(?:,|%2C|&mlon=)\s*(-?\d+(?:\.\d+)?)/i,
  /map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/,
  /geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
];

function valid(lat: number, lon: number): LatLon | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function fromUrl(text: string): LatLon | null | undefined {
  for (const re of URL_PATTERNS) {
    const m = text.match(re);
    if (m) return valid(parseFloat(m[1]), parseFloat(m[2]));
  }
  // A link without readable coordinates (short link, place page…) is not a position.
  return /:\/\//.test(text) ? null : undefined;
}

function toDecimal(c: Component): number | null {
  const [d, m = 0, s = 0] = c.parts;
  if (c.parts.length > 3 || m >= 60 || s >= 60) return null;
  if (c.parts.length > 1 && !Number.isInteger(d)) return null;
  const value = Math.abs(d) + m / 60 + s / 3600;
  const negative = c.negative || c.hemi === "S" || c.hemi === "W" || c.hemi === "O";
  return negative ? -value : value;
}

export function parseCoordinates(input: string): LatLon | null {
  const raw = input.trim();
  if (!raw) return null;

  const url = fromUrl(raw);
  if (url !== undefined) return url;

  let text = raw
    .toUpperCase()
    .replace(/[º˚]/g, "°")
    .replace(/[′’‘`´]/g, "'")
    .replace(/[″”“]|''/g, '"')
    .replace(/\b(LATITUDE|LONGITUDE|LAT|LONG|LON|LNG)\b/g, " ")
    .replace(/\bDEG\b/g, "°");

  // Decimal commas ("48,8566 2,3522"): only when no dot is used and the commas
  // clearly sit inside numbers — otherwise "48.85,2.35" or "48,2" use it as separator.
  if (!text.includes(".") && ((text.match(/\d,\d/g)?.length ?? 0) >= 2 || text.includes(";"))) {
    text = text.replace(/(\d),(\d)/g, "$1.$2");
  }
  // Any word left (place names, notes…) means it isn't just a position.
  if (/[A-Z]{2,}/.test(text)) return null;

  const tokens = text.match(/-?\d+(?:\.\d+)?|[°'"]|[NSEWO]/g) ?? [];
  const hasUnits = tokens.some((t) => t === "°" || t === "'" || t === '"');
  const hasHemi = tokens.some((t) => /^[NSEWO]$/.test(t));

  let components: Component[] = [];
  if (!hasUnits && !hasHemi) {
    // Bare numbers: 2 → decimal pair, 4 → deg/min pairs, 6 → deg/min/sec.
    const nums = tokens.map(parseFloat);
    if (![2, 4, 6].includes(nums.length)) return null;
    const half = nums.length / 2;
    components = [nums.slice(0, half), nums.slice(half)].map((parts) => ({
      parts: parts.map(Math.abs), negative: parts[0] < 0, hemi: null,
    }));
  } else {
    let cur: Component = { parts: [], negative: false, hemi: null };
    const close = () => {
      if (cur.parts.length > 0) components.push(cur);
      cur = { parts: [], negative: false, hemi: null };
    };
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (/^[NSEWO]$/.test(tok)) {
        if (cur.parts.length > 0 && cur.hemi === null) { cur.hemi = tok; close(); }
        else { close(); cur.hemi = tok; }
        continue;
      }
      if (tok === "°" || tok === "'" || tok === '"') continue;
      const n = parseFloat(tok);
      const unit = tokens[i + 1];
      // A new degree value (or a 4th number) starts the next coordinate.
      if ((unit === "°" && cur.parts.length > 0) || cur.parts.length === 3) close();
      if (cur.parts.length === 0) cur.negative = n < 0;
      cur.parts.push(Math.abs(n));
    }
    close();
  }

  if (components.length !== 2) return null;
  const [a, b] = components;
  const va = toDecimal(a);
  const vb = toDecimal(b);
  if (va === null || vb === null) return null;

  const isLon = (c: Component) => c.hemi === "E" || c.hemi === "W" || c.hemi === "O";
  const isLat = (c: Component) => c.hemi === "N" || c.hemi === "S";
  if (isLon(a) || isLat(b)) {
    if (isLat(a) || isLon(b)) return null; // both on the same axis
    return valid(vb, va);
  }
  // No hemisphere: lat first (Google order) unless only lon-first fits.
  if (!hasHemi && Math.abs(va) > 90 && Math.abs(vb) <= 90) return valid(vb, va);
  return valid(va, vb);
}
