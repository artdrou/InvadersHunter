# Deployment & environments

Three fully separated tiers — each with its own app build, backend, and database.

## The model

```
feature/*  ──PR──▶  main  ──PR──▶  prod
(development)      (staging)      (production)
```

| Tier | Git branch | EAS profile → OTA channel | Backend (Railway env) | Backend URL | Neon branch |
|------|-----------|---------------------------|-----------------------|-------------|-------------|
| **development** | `feature/*` | `development` → `development` | `development` | `invader-hunter-development.up.railway.app` | `dev` |
| **staging** | `main` | `preview` → `preview` | `staging` | `invader-hunter-staging.up.railway.app` | `staging` |
| **production** | `prod` | `production` → `production` | `production` | `invader-hunter-production.up.railway.app` | `production` |

> The production env now has its own domain (`…-production.up.railway.app`). Testers who
> ran an older build pointed at `…-development` must move to a fresh **production** app
> build to reach the new URL — plan the in-app update / redistribution accordingly.

### Development flow

1. Build a feature on a `feature/*` branch (development app → dev backend + `dev` DB).
   The `development` build is a **standalone** internal APK (not a dev client) on the
   `development` OTA channel — iterate fast with `eas update --channel development`
   instead of a full native rebuild (rebuild only when native deps or the version change).
2. **PR → `main`.** CI must pass. Merging → **Railway auto-deploys the staging backend**
   (its GitHub source branch is `main`), and `ota-update.yml` OTA-updates the `preview`
   channel. Testers exercise the **preview** app.
3. When staging is solid, **PR `main` → `prod`** (gated by branch protection review).
   Merging → **Railway auto-deploys the production backend** (source branch `prod`).
   Ship the **production** app build to testers.

## Workflows

| File | Trigger | What it does |
|------|---------|--------------|
| `ci.yml` | PR/push to `main` & `prod` | Backend `pytest` + frontend `jest`. Required check. |
| `release.yml` | Manual | EAS-builds the APK for a chosen profile → GitHub Release → bumps `version.json` on `main`. |
| `ota-update.yml` | Push to `main` (`frontend/**`) | EAS Update to the `preview` channel. |
| `db-backup.yml` | 02:00 & 14:00 UTC daily + manual | `pg_dump` of the **production** DB → private R2 bucket. See [Backups](#backups). |

**Backend deploys are NOT done in GitHub Actions** — Railway's native GitHub integration
deploys each environment from its source branch (`development` ← a dev branch, `staging`
← `main`, `production` ← `prod`).

## Secrets

| Secret | Used by | Notes |
|--------|---------|-------|
| `EXPO_ACCESS_TOKEN_GITHUB` | release, ota | Expo access token. |
| `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_PROTOMAPS_KEY` / `EXPO_PUBLIC_ORS_KEY` | release, ota | Bundled into the JS build. |
| `GITHUB_TOKEN` | release | Automatic. |
| `PROD_DATABASE_URL` | db-backup | Neon `production` **direct** connection string (same as Railway production `DATABASE_URL`). |
| `BACKUP_R2_BUCKET` / `BACKUP_R2_ENDPOINT_URL` / `BACKUP_R2_ACCESS_KEY_ID` / `BACKUP_R2_SECRET_ACCESS_KEY` | db-backup | Private backup bucket + a token scoped to it only. |

No `RAILWAY_TOKEN_*` needed — Railway deploys via its own GitHub integration, not Actions.
If you already created them as environment secrets, they're now unused and can be deleted.

## Databases (Neon) — done

One Neon project, three branches (`dev`, `staging`, `production`) — copy-on-write from
`production`. Because the backend has no `create_all` (only idempotent `app/migrate.py`
on boot), always create envs by **branching**, never as empty databases (an empty DB
crashes on startup). Refresh a lower env from prod anytime with **Reset from parent**:

```bash
neonctl branches reset staging --parent --project-id <PID>
neonctl branches reset dev     --parent --project-id <PID>
```

Wire each branch's **direct** (non-`-pooler`) connection string as `DATABASE_URL`:
`dev` → local `backend/.env`; `staging` → Railway staging env; `production` → Railway
production env. (Direct, because the code hardcodes `channel_binding=require`, which
fights the pooler endpoint.)

## One-time setup checklist

**Railway** (three envs exist: `development` / `staging` / `production`):
- [x] Each env has its OWN `DATABASE_URL` (development → Neon `dev`, staging → Neon `staging`, production → Neon `production`; direct string, `channel_binding=require`).
- [x] Each env has its OWN R2 config (dev/staging → `invaderhunter-pictures-nonprod` with a scoped token; production → `invaderhunter-pictures`).
- [ ] **Configure the GitHub integration per env** — this is what deploys the backend now: set each environment's service source branch → `production` ← `prod`, `staging` ← `main`, `development` ← your dev branch (or deploy it manually).
- [ ] Later: separate `SECRET_KEY` per env (token isolation). Sharing the rest (MAIL_*, BREVO) is fine for now.

**GitHub** (environments named `invader-hunter-development` / `-staging` / `-production`, used by `release.yml` to gate production APK builds):
- [x] Environments created.
- [x] Required reviewer on `invader-hunter-production`.
- [ ] Branch protection on `main` and `prod`: require PR + the `Backend tests (pytest)` and `Frontend tests (jest)` checks (do this after the first CI run so the check names are selectable).

> The repo-level `DATABASE_URL` secret is **not used** by any workflow (CI runs on in-memory SQLite; the backend reads `DATABASE_URL` from Railway, not GitHub). Safe to leave or delete.

**Verify the app URLs** in `frontend/eas.json` match the real Railway domains before the first build of each profile.

## Backups

`db-backup.yml` dumps the production database twice a day (and on demand: Actions →
*Production DB backup* → **Run workflow**, e.g. before a risky migration) into a
**private** R2 bucket:

- `daily/` — every run, kept 30 days
- `monthly/` — first run of each month, kept 365 days

Each dump is checked (readable archive, tables present) before upload; a failed run
sends GitHub's "workflow failed" email. Scheduled workflows only run from `main`.

Second safety net: Neon's own **point-in-time restore** (Neon console → `production`
branch → *Restore*), limited to the plan's history window.

### One-time setup
1. Cloudflare → R2 → **Create bucket** `invaderhunter-db-backups`. Do **not** enable
   public access.
2. R2 → **Manage API tokens** → create a token with *Object Read & Write* on **that
   bucket only**. Note the Access Key ID, Secret, and the S3 endpoint
   (`https://<account-id>.r2.cloudflarestorage.com`).
3. GitHub → repo Settings → Secrets and variables → Actions → add the 5 secrets from the
   table above (repository secrets, so the scheduled run is not held by environment
   approvals).
4. Actions → *Production DB backup* → **Run workflow** once and check the bucket.

### Restore
Restore into a **new Neon branch** first, never straight over production:

```bash
# 1. Download the dump (R2 dashboard, or aws s3 cp ... --endpoint-url ...)
# 2. Neon console → create an empty branch "restore-test" (no data) → copy its direct URL
pg_restore --no-owner --no-privileges --dbname "<restore-test URL>" invadershunter-prod-<date>.dump
# 3. Check the data, then either point Railway production DATABASE_URL at that branch,
#    or restore over production with --clean --if-exists (destructive).
```

`pg_restore` must be the same major version as the workflow's `pg_dump` (`PG_MAJOR`)
or newer.

## Later (requested)

Scripts to copy DB between Neon branches and migrate/restore backups — to be added once
the branch↔env wiring above is confirmed stable.
