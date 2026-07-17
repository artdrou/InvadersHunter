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
| **B** | Custom / perso invaders | 🟡 **En cours** — branche `feature/custom-invaders` (B1 + B2 codés, non mergés) |
| **C** | Mode ami | ⬜ **À faire** — pas commencé |

Suites vertes à date : **317 tests backend**, **209 tests frontend**.

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

## Track B — Custom / perso invaders 🟡

Codé sur la branche `feature/custom-invaders` (partie de `dev/OTA-force-foreground`),
**pas encore mergé ni testé sur device**. Établit le pattern « données custom locales
SQLite » dont C a besoin pour partager les custom invaders des amis.

### B1 — Backend ✅
1. `models/custom_invader.py` : `CustomInvader` (table dédiée, `user_id` FK CASCADE
   indexé) + `DeletedCustomInvader` (tombstones — un delete est invisible d'un delta
   sync sinon, même logique que `deleted_invaders`).
2. `schemas/custom_invader.py` + `services/custom_invader_service.py` : CRUD
   **owner-scoped** (l'owner vient du token, jamais du body). Row d'un autre user →
   **404, pas 403** : on ne divulgue pas son existence.
3. `api/routers/custom_invaders.py` : list (delta `updated_since`) / deleted / create /
   update / delete, tous authentifiés.
4. `migrate.py` : `CREATE TABLE IF NOT EXISTS` + index FK + index `(user_id, updated_at)`
   pour le delta + colonne `icon_shape`.
5. Claim guest étendu (`/account/claim` prend `custom_invaders`, renvoie
   `local_id → row canonique`). **Idempotent** (dédoublonnage nom+position) : le claim
   est rejoué à chaque sync, il doit survivre à une répétition.
6. **Photo R2** : `POST /upload/custom-invader-photo/{id}` (owner-scoped, crop 800×800,
   préfixe `customInvaders/`), cleanup best-effort de l'ancien objet au remplacement
   et à la suppression.
7. **32 tests** (`tests/test_custom_invaders.py`) : CRUD, isolation, delta, tombstones,
   claim idempotent, photo, `icon_shape`. Suite backend : **317 verts**.

### B2 — Frontend ✅
1. Table SQLite locale `custom_invaders` + CRUD dans `services/db.ts`.
2. UI create/edit — `CreateInvaderModal` **réutilisée** : un seul bouton « Créer » à
   l'appui long, puis un **toggle « invader perso »** dans le formulaire décide de la
   destination (communauté vs collection perso). Le **gate compte est sur le submit
   communautaire**, pas à l'ouverture : un invité peut créer un perso.
   Photo dans les deux modes.
3. Rendu carte : `CustomInvaderSource` — **ShapeSource dédiée** (les ids perso sont un
   espace séparé, et négatifs tant que non synchronisés → collision avec les ids
   communautaires dans la couche partagée), mais **même geojson builder et même layer
   style** que les invaders normaux : par défaut un perso est visuellement identique à
   un invader communautaire de son tier.
   `CustomInvaderPopup` : pas de flash / commentaires / contributeurs, juste edit+delete.
4. **Icône** : carrousel horizontal (`marker-customization/components/IconCarousel`)
   dans le formulaire quand le toggle perso est actif → `icon_shape` (une des 6
   silhouettes). `null` → suit `points`. Le mapper injecte `icon_shape` dans `points`
   côté carte : le pipeline clé le sprite sur `points`.
5. **Couleur custom** : nouvel état `custom` dans marker-customization (types,
   générateur, store, écran). **Opt-in** (`customColorEnabled`) : off → les persos
   rendent comme les communautaires ; on → cette palette gagne sur flash/rarity/grey
   pour tous les persos. ⚠️ Les sprites `-custom` **n'ont pas de fallback bundlé** :
   ils n'existent qu'après une génération, d'où le garde-fou `useCustomPalette()`
   (flag **et** set généré vivant) — sinon marqueurs blancs.
6. Sync delta (`last_custom_invaders_sync`) + file offline
   (`create/update/delete_custom_invader`).
7. **Photos différées** : une photo ne peut être uploadée qu'une fois la row dotée d'un
   id serveur. Invité/offline → l'URI locale est parquée dans `image_url` et
   `pushPendingPhotos()` (à chaque sync) fait l'upload dès que l'id est réel — chemin de
   reprise unique pour claim, flush de file et échecs d'upload. Échec non-réseau →
   `image_url` remis à null (pas d'image cassée à vie).
8. **Guest** : création locale sous `GUEST_USER_ID`, id négatif réécrit au claim.
9. **33 tests** front ajoutés (19 hook + 14 sync). Suite front : **209 verts**.

### Reste à faire sur B
- **Test sur device** — rien n'a été lancé dans l'app réelle (toggle, carrousel,
  marqueur, popup, photo, palette custom).
- **Bug pré-existant hérité** : « ajuster la position » démonte `CreateInvaderModal`
  (`setModal(null)` dans `use-map-create-flow`), donc le formulaire perd les champs
  saisis au retour. Existe déjà sur le flux communautaire ; en perso les champs sont
  repeuplés depuis la row en édition, mais les saisies non enregistrées sont perdues.

## Track C — Mode ami ⬜

La part *flash* (C1/C2-flash) est **indépendante de B** (les captures existent déjà) et
peut démarrer avant. La part *custom invaders* dépend de B.

### C1 — Backend : friendships
1. Table `friendships` (`user_id`, `friend_id`, `status` ∈ pending/accepted) + index FK.
2. Endpoints : request / accept / decline / remove / list.
3. `migrate.py` + tests.

### C2 — Backend : accès aux données des amis
1. Endpoint captures des amis — **accepted-only**.
2. Endpoint custom invaders des amis — **accepted-only** (dépend de B1, désormais posé :
   voir `custom_invader_service.list_for_user`, à doubler d'une variante « ami » qui
   scope sur une friendship acceptée plutôt que sur le token).

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
