# Release notes — workflow

Les patchnotes affichées dans l'app (popup « Quoi de neuf ? » + page Réglages → À propos → Notes de version) ont une seule source de vérité :

```
frontend/src/features/changelog/releases.ts
```

## Pendant le développement

Chaque PR **visible par l'utilisateur** ajoute une ligne (fr + en, même ordre) dans l'entrée `UNRELEASED` en tête du tableau `RELEASES` :

```ts
{
  version: UNRELEASED,
  date: null,
  items: {
    fr: ['Ma nouvelle feature expliquée pour les joueurs', ...],
    en: ['My new feature explained for players', ...],
  },
},
```

Règles :
- Écrire pour les joueurs, pas pour les devs (pas de « refactor X », pas de noms de fichiers).
- Les changements internes (CI, tests, refactors) ne vont **pas** dans le changelog.
- Une ligne par feature, courte ; fr et en synchronisés ligne à ligne.

## À la release (staging ou prod, APK ou OTA)

1. Renommer `UNRELEASED` avec la version expédiée (doit correspondre à
   `backend/static/apk/version.json` pour un build APK) et renseigner `date`.
2. Recréer une entrée `UNRELEASED` vide au-dessus.
3. Livrer (build EAS ou OTA) — rien d'autre à faire.

## Comment l'affichage fonctionne

- **Popup** (`WhatsNewModal`, montée dans `_layout`) : comparée au store persisté
  `changelog-storage.lastSeenVersion`. Si la dernière release stampée du fichier
  est plus récente que ce que l'utilisateur a vu → popup une seule fois.
  Les installations fraîches ne voient pas de popup (marquage silencieux).
- **Page** (`/settings/changelog`) : historique complet des releases stampées.
- Le fichier voyage avec le bundle JS → fonctionne pour les releases **APK et OTA**
  (pas besoin de bump de version native pour qu'une OTA affiche ses notes :
  c'est la version stampée dans `releases.ts` qui fait foi).

## Lien avec la page News

La page News (`/news`) reste le canal des annonces & nouveautés invaders
(source backend). Le changelog est complémentaire : notes de version produit,
embarquées dans l'app, disponibles hors-ligne.
