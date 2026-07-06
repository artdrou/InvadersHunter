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

1. Build a feature on a `feature/*` branch. The **development** app build points at the
   dev backend + `dev` DB. Deploy that branch to the dev backend on demand via the
   **Deploy development** workflow (`workflow_dispatch`, pick the ref).
2. **PR → `main`.** CI must pass. Merging deploys the **staging** backend and (frontend
   changes) OTA-updates the `preview` channel. Testers exercise the **preview** app.
3. When staging is solid, **PR `main` → `prod`.** The `production` GitHub environment
   requires an approval; merging deploys the **production** backend. Ship the
   **production** app build to testers.

## Workflows

| File | Trigger | What it does |
|------|---------|--------------|
| `ci.yml` | PR/push to `main` & `prod` | Backend `pytest` + frontend `jest`. Required check. |
| `release.yml` | Manual | EAS-builds the APK for a chosen profile → GitHub Release → bumps `version.json` on `main`. |
| `deploy-development.yml` | Manual (pick ref) | `railway up` to the **development** env. |
| `deploy-staging.yml` | Push to `main` (`backend/**`) | `railway up` to the **staging** env. |
| `deploy-production.yml` | Push to `prod` (`backend/**`) | `railway up` to the **production** env (gated by env reviewer). |
| `ota-update.yml` | Push to `main` (`frontend/**`) | EAS Update to the `preview` channel. |

## Secrets

| Secret | Used by | Notes |
|--------|---------|-------|
| `EXPO_ACCESS_TOKEN_GITHUB` | release, ota | Expo access token. |
| `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_PROTOMAPS_KEY` / `EXPO_PUBLIC_ORS_KEY` | release, ota | Bundled into the JS build. |
| `RAILWAY_TOKEN_DEV` | deploy-development | Railway project token scoped to the `development` env. |
| `RAILWAY_TOKEN_STAGING` | deploy-staging | …scoped to the `staging` env. |
| `RAILWAY_TOKEN_PROD` | deploy-production | …scoped to the `production` env. |
| `GITHUB_TOKEN` | release | Automatic. |

Each deploy workflow **skips cleanly** if its token is unset, so you can land these files
before the envs exist.

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
- [ ] **CRITICAL — give each env its OWN `DATABASE_URL`** (they were copied from one env, so all three currently point at the same DB). Set `development` → Neon `dev`, `staging` → Neon `staging`, `production` → Neon `production`. Use the **direct** (non-`-pooler`) string with `channel_binding=require`.
- [ ] Domains: `invader-hunter-development` / `-staging` / `-production`.
- [x] Env-scoped **project token** per env → `RAILWAY_TOKEN_DEV/STAGING/PROD` (set as GitHub *environment* secrets).
- [ ] Later: separate `SECRET_KEY` per env (token isolation) and a separate **R2 bucket for production** (so dev/staging don't write into prod images). Sharing the rest (MAIL_*, BREVO) is fine for now.
- [ ] Disable Railway's native GitHub auto-deploy on any env these workflows own (avoid double deploys).

**GitHub** (environments named `invader-hunter-development` / `-staging` / `-production` — the workflows' `environment:` values match these exactly):
- [x] Environments created; `RAILWAY_TOKEN_*` set as environment secrets.
- [ ] Add a **required reviewer** on `invader-hunter-production`.
- [ ] Branch protection on `main` and `prod`: require PR + the `Backend tests (pytest)` and `Frontend tests (jest)` checks (do this after the first CI run so the check names are selectable).

> The repo-level `DATABASE_URL` secret is **not used** by any workflow (CI runs on in-memory SQLite; the backend reads `DATABASE_URL` from Railway, not GitHub). Safe to leave or delete.

**Verify the app URLs** in `frontend/eas.json` match the real Railway domains before the first build of each profile.

## Later (requested)

Scripts to copy DB between Neon branches and migrate/restore backups — to be added once
the branch↔env wiring above is confirmed stable.
