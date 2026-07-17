# Roadmap — features sociales

État au **2026-07-17**. Ce document est le point de reprise pour la suite du chantier :
il résume la demande initiale, ce qui est livré, et les étapes précises de ce qui reste.

## La demande initiale

Cinq features sociales, livrées en **multi-branche / multi-PR** (≈14 PR au découpage
d'origine). Chaque branche `feature/*` → `main` (staging) → `prod`.

Contrainte transverse : **toutes les migrations DB sont additives**.
- Back : append idempotent dans `backend/app/migrate.py` (`ADD COLUMN IF NOT EXISTS`,
  `CREATE TABLE IF NOT EXISTS`). Postgres n'indexe pas les FK automatiquement → créer
  les index à la main.
- Front : check `PRAGMA table_info` dans `frontend/src/services/db.ts`.

Les 5 features telles que demandées :

1. **Guest mode** — usage SQLite-only sans compte ; les features nécessitant un user
   (requests, amis, commentaires, flash serveur) bloquées derrière un prompt « créer un
   compte ». Création de compte à tout moment → merge des données locales vers le compte.
2. **Custom / perso invaders** — un user ajoute un invader labelé « personnel », stocké
   dans une **nouvelle table `custom_invaders`** liée au user (PAS dans `invaders`).
3. **Mode ami** — friendship (request/accept), accès aux **flashs** et **custom invaders**
   des amis pour affichage carte ; stats plus tard.
4. **Mur de commentaires** — sur chaque popup invader ; post/description/astuce ;
   **modération auto** (anti-insultes).
5. **« Découvert / mis à jour par USER »** — sur popup si le user est le 1er soumetteur
   d'un create/modify approuvé.

## État global

| Track | Feature | État |
|---|---|---|
| **A** | Guest mode | ✅ **Livré** — mergé dans `main` (PR #15) |
| **E** | Découvert / mis à jour par | ✅ **Livré** — mergé dans `main` (PR #15) |
| **D** | Mur de commentaires | ✅ **Livré** — sur `main` (commits `ab709e8` → `19ac9ff`) |
| **B** | Custom / perso invaders | ⬜ **À faire** — pas commencé |
| **C** | Mode ami | ⬜ **À faire** — pas commencé |

Suites vertes à date : **285 tests backend**, **176 tests frontend**.

---

# Ce qui est fait

## Track A — Guest mode ✅

Mergé via **PR #15** (branche `feature/guest-mode`, qui embarquait aussi Track E).

- **A1 back** — `POST /account/claim` (bulk-import des captures, idempotent, `found_at`
  préservé) + sécurisation de `/progress` et `/users` (owner-or-admin ; faille de
  self-escalation `is_admin` corrigée ; `register` reste public).
- **A2 front** — `isGuest` + `enterGuestMode()` dans l'authStore (persisté), bouton
  « Continuer sans compte » sur login, bypass du guard `_layout`, flash/unflash local-only
  sous `GUEST_USER_ID = 0` (`features/auth/guest.ts`), `syncInvadersOnly()` (GET /invaders
  public), hook `useRequireAccount()` (Alert + CTA `/register`) sur modif/création/
  notifications/sync, section Compte des réglages → CTA créer un compte, news accessibles
  en invité.
- **A3 front** — claim intégré en tête de `syncAll()` : self-healing (retry à chaque sync,
  idempotent). Pas de code dans les écrans login/register — le 1er sync post-signup migre tout.

⚠️ **Dette connue** : les CRUD `/invaders` restent **sans auth** (hors scope à l'époque,
à auditer séparément).

## Track E — Découvert / mis à jour par ✅

Mergé via **PR #15** (le travail a fini sur `feature/guest-mode` et est parti avec elle).

- Popup carte + `InvaderInfoPanel` : lignes « Découvert par X » / « Mis à jour par Y »
  (dernier de `modified_by`, liste chronologique ascendante), centrées.
- Data layer préexistant : `GET /invaders/{id}/contributors`
  (`admin_request_service.get_invader_contributors`). ISS exclu.
- Le hook `useInvaderContributors` a depuis été **remplacé par `useInvaderOverview`** (voir
  Track D) — l'ancien endpoint `/contributors` est conservé pour compatibilité avec les
  builds OTA déjà déployés.

## Track D — Mur de commentaires ✅

Sur `main` (commits `ab709e8` back → `19ac9ff`), posé par rebase au-dessus du merge PR #15.

### Backend
- **Modèles** — `invader_comment.py` (`invader_id`/`user_id` FK CASCADE indexés, `status`
  ∈ visible/hidden/pending_review, `flagged_categories`, `reports`, compteurs `likes`/
  `dislikes`) + `comment_reaction.py` (une réaction par couple (comment, user), contrainte
  unique, `value` ∈ {1, -1}).
- **Modération** — `moderation_service.check_text` : OpenAI `omni-moderation-latest`,
  **fail-safe** (ne lève jamais ; toute erreur → `None`). Logge status + body OpenAI
  (jamais la clé) pour rendre les échecs visibles dans les logs Railway.
- **Service** — `comment_service` : create (clean→`visible` / flagged→`hidden` / modération
  indisponible→`pending_review`), list (exclut `hidden`, newest first), report
  (visible→`pending_review`), delete (**owner-or-admin** : un admin supprime tous les
  commentaires), `set_reaction` (toggle/switch, compteurs dénormalisés tenus à jour),
  `get_summary` (count + top commentaire).
- **Endpoints** — `comments.py` (GET public via `get_current_user_optional`, POST/report/
  delete authentifiés), `POST /comments/{id}/react`, `GET /invaders/{id}/comments/summary`,
  et `GET /invaders/{id}/overview` (agrégat BFF : contributors + résumé commentaires en
  **une seule requête** par popup).
- **Dépendance** — `get_current_user_optional` ajoutée (renvoie `None` au lieu de lever).

### Frontend
- Module `features/comments` : api + `useInvaderComments` + `InvaderCommentsModal`
  plein écran, ouverte depuis le popup carte (icône chat) et `InvaderInfoPanel`.
- Lecture publique ; post/report/delete/réactions gatés compte via `useRequireAccount`
  (le mur se ferme avant d'ouvrir le gate pour éviter l'empilement de modales).
- Post moderation-aware : `visible`→apparaît / `pending_review`→apparaît + tag « en revue » /
  `hidden`→pas listé + notice au posteur.
- Like/dislike mutuellement exclusifs, toggle au re-tap. **Top commentaire** (plus de likes)
  épinglé en haut du mur + affiché dans le popup ; **un commentaire unique est top par
  défaut**, sans like requis.
- Bulle de comptage (`CommentCountBadge`) sur l'icône commentaire — accent par défaut,
  **rouge s'il y a du nouveau** (`seen-store` persisté).
- Barre de saisie toujours au-dessus du clavier (`behavior="padding"`).
- Timestamps serveur parsés UTC, formatés sans `Intl` (Hermes). i18n fr/en.

### ⚠️ Gotcha OpenAI (diagnostiqué 2026-07-16) — à connaître absolument

La modération est **gratuite** (0 $/appel) **mais** l'API OpenAI exige un **compte activé**
(moyen de paiement + un peu de crédit). Sans billing → **HTTP 429 « Too Many Requests »**
dès la 1ʳᵉ requête → `check_text()` renvoie `None` → **tout tombe en `pending_review`**.

Symptôme : « en attente de modération » partout alors que la clé est valide.
**429 ≠ 401** : la clé authentifie très bien, c'est le quota/billing qui bloque.
Fix : moyen de paiement + ~5 $ sur `platform.openai.com/settings/organization/billing`.

`OPENAI_API_KEY` doit être un secret **Railway** (présent sur le service *development*).
Sans clé → tout en `pending_review`, jamais bloquant.

---

# Ce qui reste à faire

## Track B — Custom / perso invaders ⬜

À faire **avant C** : établit le pattern « données custom locales SQLite » dont C a besoin
pour partager les custom invaders des amis.

### B1 — Backend
1. Modèle `custom_invaders` : table dédiée liée au user (**pas** dans `invaders`), avec
   les champs d'un invader (name, latitude, longitude, points, state, image…) + `user_id`
   FK CASCADE **indexé**.
2. Schémas Pydantic + CRUD **owner-scoped** (un user ne voit/modifie que les siens).
3. Inclusion dans le **sync delta** (meta timestamps, même modèle que les autres endpoints).
4. `migrate.py` : `CREATE TABLE IF NOT EXISTS` + index FK.
5. Tests (create/list/update/delete owner-scoped + isolation entre users + sync delta).

### B2 — Frontend
1. Table SQLite locale (check `PRAGMA table_info` dans `services/db.ts`).
2. UI create/edit — **réutiliser `CreateInvaderModal`**.
3. Rendu carte : marqueur visuellement distinct + label « perso ».
4. Sync via le delta B1.
5. **Guest** : création en local, **id local négatif temporaire réécrit au claim**
   (cf. décision 4). Se branche sur le gate de Track A.

## Track C — Mode ami ⬜

La part *flash* (C1/C2-flash) est **indépendante de B** (les captures existent déjà) et
peut démarrer avant. La part *custom invaders* dépend de B.

### C1 — Backend : friendships
1. Table `friendships` (`user_id`, `friend_id`, `status` ∈ pending/accepted) + index FK.
2. Endpoints : request / accept / decline / remove / list.
3. `migrate.py` + tests.

### C2 — Backend : accès aux données des amis
1. Endpoint captures des amis — **accepted-only**.
2. Endpoint custom invaders des amis — **accepted-only** (dépend de B1).

### C3 — Frontend : UI amis
Liste / ajout par username / demandes en attente + store + api.

### C4 — Frontend : carte
Layer flashs des amis + overlay custom invaders des amis, avec toggles.

## Ordre recommandé

```
B1 → B2 → C1 → C2 → C3 → C4
```
La part flash de C (C1 + C2-flash + C3) peut se paralléliser avec B si besoin.

---

# Décisions tranchées (2026-07-10, validées)

1. **Modération auto (D)** — **OpenAI Moderation API** (`omni-moderation-latest`) :
   gratuite, REST simple, multilingue (FR bien couvert), 13 catégories scorées, accepte
   aussi les images (futur). Fail-safe : API down → commentaire accepté + `pending_review`,
   jamais bloquant. Plan B = Perspective API (gratuite mais setup GCloud + quota 1 QPS).
   Pas d'endpoint de modération gratuit côté Anthropic.
2. **Placement découvert-par (E)** — **les deux** : popup carte (forme courte) + panneau
   détail (forme complète created_by + modified_by).
3. **Privacy amis (C)** — **accepted-only**, pas de toggle de partage supplémentaire.
4. **Sentinelle guest (A)** — **`user_id = 0`** (constante `GUEST_USER_ID`) dans SQLite +
   `POST /account/claim` transactionnel au signup : le serveur importe en bulk et renvoie
   les lignes canoniques qui remplacent les lignes locales (pas de replay de
   `pending_syncs`, pas de colonne `is_guest`). Custom invaders guest : **id local négatif
   temporaire réécrit au claim**.

# Ancrages code utiles

- **Auth** — JWT bearer + refresh, `get_current_user` / `get_current_user_optional`
  (`backend/app/dependencies.py`). Front : `authStore` (`token`/`refreshToken`/`user`/
  `_hasHydrated`). Guard `app/_layout.tsx` (bypass guest en place).
- **SQLite** — `SQLiteProvider` + `initDb` (`services/db.ts`) : tables meta, invaders,
  captures, user_requests, pending_syncs. Captures indexées par `user_id` numérique.
- **Sync** — `syncAll(db, userId)` : delta par endpoint via meta timestamps + flush
  `pending_syncs`. Le claim guest est en tête de `syncAll`.
- **Attribution** — modèle `source` (community/admin/scraper), réutilisable.
- **Popup** — `features/map/components/InvaderPopup/PopupView.tsx` ; fiche détail :
  `features/invaders/components/InvaderInfoPanel.tsx`. Les deux consomment
  `useInvaderOverview` (1 requête : contributors + résumé commentaires).

# Chantiers connexes (hors des 5 features)

- **OTA forcée au premier plan** — en cours sur `dev/OTA-force-foreground` (1 commit devant
  `main`). Hook `useOtaReload` : au retour au premier plan après ≥3 min en arrière-plan,
  check → fetch → `reloadAsync`. Règle le cas des users qui ne ferment jamais l'app.
  ⚠️ Le hook voyage **dans le bundle OTA** : la cohorte actuelle doit faire **un cold start**
  pour l'amorcer ; ensuite tout est automatique.
- **Séparation dev/prod** — pas de vraie séparation back/front ; `eas.json` câblé avec
  3 backends distincts. Robustification à planifier.
- **Tâches gated-build** (nécessitent un rebuild APK, pas OTA-ables) : splash screen
  (plugin `expo-splash-screen`, asset prêt), mise à jour des deps (`expo install --check`,
  ~29 paquets périmés / 1 check expo-doctor en échec, non bloquant).
- **Color picker perso** — remplacer la grille de swatches (`ColorPickerModal`) par un vrai
  color picker (`reanimated-color-picker`), OTA-able.

# Rappel versions (pièges release)

Trois « versions » indépendantes — voir `docs/RELEASE-NOTES.md` pour le workflow complet :

| Version | Rôle | Pour une OTA |
|---|---|---|
| `app.json` `version` | pilote le `runtimeVersion` (policy `appVersion`) → **quels builds reçoivent l'OTA** | **ne pas toucher** (sinon l'APK installé ne reçoit jamais l'OTA) |
| `backend/static/apk/version.json` | pilote le popup « télécharger le nouvel APK » | **ne pas toucher** (sinon on propose un APK inutile) |
| `releases.ts` (changelog) | pilote **uniquement** le popup « Quoi de neuf » | **la seule à stamper** |
