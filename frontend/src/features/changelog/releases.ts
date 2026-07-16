/**
 * Release notes — single source of truth for in-app patch notes.
 *
 * ── Workflow (full guide: docs/RELEASE-NOTES.md) ─────────────────────────────
 * 1. While developing: every user-facing PR appends one line (fr + en) to the
 *    UNRELEASED entry below. Internal/CI changes don't belong here.
 * 2. At release time (staging/prod build or OTA): rename UNRELEASED to the
 *    version being shipped (must match version.json for APK builds), set the
 *    date, and add a fresh empty UNRELEASED entry above it.
 * 3. Nothing else to do — the WhatsNewModal pops once per new version (it
 *    compares the latest published version here against the last one the
 *    user saw), and the full history lives in Settings → About → Release notes.
 *
 * This file ships with the JS bundle, so it works for both APK and OTA
 * releases. Keep entries short, user-facing, and written for players.
 */

export const UNRELEASED = 'unreleased';

export type ReleaseNotes = {
  /** Semver of the shipped release, or UNRELEASED for the accumulation buffer. */
  version: string;
  /** ISO date (YYYY-MM-DD) of the release; null while unreleased. */
  date: string | null;
  /** Patch notes per language — keep fr and en in sync line-for-line. */
  items: { fr: string[]; en: string[] };
};

export const RELEASES: ReleaseNotes[] = [
  {
    version: UNRELEASED,
    date: null,
    items: {
      fr: [
        'Mur de commentaires sur chaque invader : publie un mot, aime ou n’aime pas, avec commentaire vedette et modération automatique',
        'Chaque invader affiche qui l’a découvert et qui l’a mis à jour (popup carte et fiche détail)',
        'Mode invité : utilise l’app sans compte, tes flashs restent sur ton téléphone et sont transférés si tu crées un compte',
        'Nouvelle icône globe sur les invaders : ouvre la fiche invader-spotter.art correspondante',
        'Personnalisation des marqueurs : interface compacte et opacité réglable par état',
        'Réglages simplifiés et notes de version consultables dans l’app',
        'Sécurité renforcée côté serveur (flashs et comptes)',
      ],
      en: [
        'Comment wall on every invader: post a note, like or dislike, with a highlighted top comment and automatic moderation',
        'Each invader now shows who discovered it and who last updated it (map popup and detail panel)',
        'Guest mode: use the app without an account, your flashes stay on your phone and transfer when you sign up',
        'New globe icon on invaders: opens the matching invader-spotter.art page',
        'Marker customization: compact UI and per-state opacity',
        'Streamlined settings and in-app release notes',
        'Hardened server-side security (flashes and accounts)',
      ],
    },
  },
  {
    version: '0.1.0',
    date: '2026-07-06',
    items: {
      fr: [
        'Première version publique : carte interactive, mosaïque de collection, flashs hors-ligne, itinéraires, page News et notifications',
      ],
      en: [
        'First public release: interactive map, collection mosaic, offline flashes, routing, News feed and notifications',
      ],
    },
  },
];

/** Stamped releases only (the UNRELEASED buffer is never shown to users). */
export function publishedReleases(): ReleaseNotes[] {
  return RELEASES.filter((r) => r.version !== UNRELEASED);
}

/** Most recent stamped release, or null if none exists yet. */
export function latestRelease(): ReleaseNotes | null {
  return publishedReleases()[0] ?? null;
}

/** Pick the notes list matching the app language (fallback: en). */
export function notesForLanguage(release: ReleaseNotes, language: string): string[] {
  return language.startsWith('fr') ? release.items.fr : release.items.en;
}
