/** Public domain in front of the production backend (Cloudflare DNS → Railway). */
const PUBLIC_DOMAIN = 'hintvaders.app';

/**
 * Address of the browser importer (WebUSB page served by the backend) for the
 * backend this app talks to: the page imports into the database of the server
 * that serves it. Production gets the short public domain, dev / staging their
 * Railway URL.
 */
export function webImporterUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  let host = '';
  try {
    host = new URL(base).host.split('.')[0];
  } catch {
    // not a URL: keep the base as is
  }
  if (host.endsWith('-production')) return `https://${PUBLIC_DOMAIN}/flash-importer`;
  return `${base}/flash-importer`;
}

/** The URL without its scheme, for display (shorter to read and type). */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}
