// Central registry of external service endpoints and their keys.
// Environment-specific values come from EXPO_PUBLIC_* vars (see .env.example);
// no secret is hardcoded here.
//
// Map styles are built locally from a bundled OpenFreeMap Liberty base — see
// features/map/styles (resolveMapStyle / MAP_THEMES). No hosted style URLs.

/** OpenRouteService (directions / distance matrix). */
export const ORS_BASE_URL = 'https://api.openrouteservice.org';
export const ORS_KEY = process.env.EXPO_PUBLIC_ORS_KEY ?? '';

/** Nominatim geocoding endpoint (address search). */
export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

/** Deep link to Google Maps walking/driving directions toward a coordinate. */
export const GOOGLE_MAPS_DIR_URL = (lat: number | null, lon: number | null): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

/** Instagram hashtag page for an invader (its name, lowercased). */
export const INSTAGRAM_TAG_URL = (name: string): string =>
  `https://www.instagram.com/explore/tags/${name.toLowerCase()}/`;

// ─── InvaderSpotter (invader-spotter.art) ──────────────────────────────────────
// Opens the site's real single-invader page. The mechanics, reverse-engineered from the
// site's own `lienm(ville, numero)` click handler:
//   • A single invader is a POST to listing.php with the CITY as a field NAME (not `ville=`),
//     the number in `numero`, and `mode=si` (single) — e.g. `LIL=&numero=3&mode=si` → LIL_03.
//     `mode=si` makes `numero` an EXACT match (without it, `numero` is a broken prefix filter).
//   • The request MUST carry a Referer from the site, and react-native-webview DROPS custom
//     headers on POST `source` requests — so we POST via a self-submitting <form> loaded as
//     `source={{ html, baseUrl: INVADER_SPOTTER_REFERER }}`, which sends a valid Referer/Origin.
//   • Paris has no plain `PA` field — it's split into arrondissement/banlieue fields
//     (PA01–PA20, PA77, PA92–PA95), and the number alone isn't unique across cities for low
//     numbers. So for Paris we first browse the page holding the invader (pagination is
//     sequential by number, 50/page → page = ceil(N/50)), read its arrondissement from the
//     row's `lienv("PA","NN")` link, then resubmit the exact `PANN=&numero=N&mode=si` search.
// The two-step Paris resolution runs inside the WebView (see INVADER_SPOTTER_RESOLVE_JS),
// masked by a loading overlay until the final page posts 'ready'.

export const INVADER_SPOTTER_LISTING_URL = 'https://www.invader-spotter.art/listing.php';
/** Used as the WebView `baseUrl` so the auto-submitted POST gets a valid Referer/Origin. */
export const INVADER_SPOTTER_REFERER = 'https://www.invader-spotter.art/cherche.php';
/** Message a resolved page posts back to signal the final single-invader page is shown. */
export const INVADER_SPOTTER_READY = 'spotter-ready';

/** Invaders shown per listing page (fixed by the site). */
const SPOTTER_PAGE_SIZE = 50;

/** Parse an invader code like "AIX_01" / "PA_1234" → { ville, number }. */
function parseInvaderCode(name: string): { ville: string; number: number } {
  const sep = name.lastIndexOf('_');
  const ville = sep >= 0 ? name.slice(0, sep) : name;
  const parsed = sep >= 0 ? parseInt(name.slice(sep + 1), 10) : NaN;
  return { ville: ville.toUpperCase(), number: Number.isNaN(parsed) ? 0 : parsed };
}

/**
 * Initial self-submitting form.
 *  - Non-Paris: the exact single-invader search (`<CITY>=&numero=N&mode=si`) — one hop.
 *  - Paris: browse the listing page holding the invader; INVADER_SPOTTER_RESOLVE_JS then reads
 *    its arrondissement and resubmits the exact search.
 * Load as `source={{ html, baseUrl: INVADER_SPOTTER_REFERER }}`.
 */
export const INVADER_SPOTTER_FORM_HTML = (name: string): string => {
  const { ville, number } = parseInvaderCode(name);
  const isParis = ville === 'PA';
  const field = (n: string, v: string) => `<input type="hidden" name="${n}" value="${v}">`;
  const inputs = isParis
    ? field('ville', 'PA') + field('arron', '00') + field('mode', 'lst')
      + field('rang', '100') + field('page', String(Math.max(1, Math.ceil(number / SPOTTER_PAGE_SIZE))))
    : field(ville, '') + field('numero', String(number)) + field('mode', 'si')
      + field('arron', '00') + field('page', '1');
  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1"></head>'
    + `<body><form id="f" method="POST" action="${INVADER_SPOTTER_LISTING_URL}">`
    + inputs
    + '</form><script>document.getElementById(\'f\').submit();</script></body></html>';
};

/**
 * Injected on every page load (via `injectedJavaScript`). On a listing.php result page:
 *  - If it's a Paris browse page (many rows), find the invader's row, read its arrondissement
 *    from `lienv("PA","NN")`, and resubmit the exact `PANN=&numero=N&mode=si` search.
 *  - Otherwise (the final single-invader page, or non-Paris) post INVADER_SPOTTER_READY so the
 *    loading overlay lifts. Skips the intermediate self-submitting form page (baseUrl).
 */
export const INVADER_SPOTTER_RESOLVE_JS = (name: string): string => {
  const { ville, number } = parseInvaderCode(name);
  const isParis = ville === 'PA';
  return `(function(){
    function ready(){ try{ window.ReactNativeWebView.postMessage(${JSON.stringify(INVADER_SPOTTER_READY)}); }catch(e){} }
    try{
      if(location.href.indexOf('listing.php')<0) return;  // still the auto-submit form page
      var CITY=${JSON.stringify(ville)}, NUM=${number}, ISPARIS=${isParis};
      var modeInput=document.querySelector('input[name="mode"]');
      var isSi=!!(modeInput&&modeInput.value==='si');   // already the exact single-invader page
      if(ISPARIS && !isSi){                              // Paris browse page → resolve arrondissement
        var hauts=document.querySelectorAll('tr.haut'), target=null;
        for(var i=0;i<hauts.length;i++){
          var b=hauts[i].querySelector('b'), code=b?b.textContent:'';
          var m=code.match(/([A-Za-z0-9]+)_(\\d+)/);
          if(m&&m[1].toUpperCase()===CITY&&parseInt(m[2],10)===NUM){ target=hauts[i]; break; }
        }
        // Read the arrondissement from the row's lienv("PA","NN") link. Use getAttribute (raw
        // value) — innerHTML would re-encode the inner quotes to &quot; and break the match.
        var link=target&&target.querySelector('a[href*="lienv"]');
        var href=link?(link.getAttribute('href')||''):'';
        var am=href.match(/lienv\\([^)]*,\\s*['"]?(\\d+)['"]?\\s*\\)/);
        if(am){
          var f=document.createElement('form'); f.method='POST'; f.action=${JSON.stringify(INVADER_SPOTTER_LISTING_URL)};
          var vals={};vals['PA'+am[1]]='';vals['numero']=String(NUM);vals['mode']='si';vals['arron']='00';vals['page']='1';
          for(var k in vals){ var e=document.createElement('input'); e.type='hidden'; e.name=k; e.value=vals[k]; f.appendChild(e); }
          document.body.appendChild(f); f.submit(); return;
        }
      }
      ready();
    }catch(e){ ready(); }
  })();true;`;
};
