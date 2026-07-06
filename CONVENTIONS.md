# Conventions

Engineering conventions for InvadersHunter. Keep this short and enforced — ESLint
(frontend) and the layered backend structure exist to back these rules up.

## Golden rules

- **One feature per file/folder.** A file does one thing; a folder groups one feature.
  When a component file passes ~300 lines or holds several sub-components, promote it
  to a folder (`Thing/index.tsx` + siblings).
- **No magic numbers or literal colors in components.** Every dimension, duration,
  z-index, radius, font size, and color comes from a token in
  `frontend/src/constants/theme.ts` (or a feature-local `constants.ts`). If you need a
  new value, name it there first.
- **Factorize duplication.** Two copies of the same block → extract a component/hook/util.

## Frontend

### File naming
- **Components** (files exporting a React component): `PascalCase.tsx`
  — e.g. `RoutingSheet.tsx`, `InvaderPopup.tsx`.
- **Everything else**: `kebab-case.ts` — hooks (`use-routing.ts`), stores (`store.ts`),
  types (`types.ts`), API clients (`*.api.ts`), services, utils.
- Platform variants keep the platform suffix: `web-map.native.tsx`, `use-color-scheme.web.ts`.
- Route files under `src/app/` follow Expo Router's naming (`[id].tsx`, `(tabs)`).

### Folder layout
```
features/<feature>/
  components/        # PascalCase components (or Component/ folders when large)
  hooks/             # use-*.ts
  services/          # <feature>.api.ts, etc.
  store.ts           # Zustand store (feature-scoped)
  types.ts           # feature types
  constants.ts       # feature-local constants (magic numbers live here, not inline)
  index.ts           # barrel — see caveat below
```
- Feature-specific hooks live in `features/<feature>/hooks/`; app-wide hooks in `src/hooks/`.
- Map layers use MapLibre RN components (`<ShapeSource>`/`<LineLayer>`), never the web
  `map.addSource/addLayer()` API.
- Coordinates are always `[longitude, latitude]` (ORS/MapLibre order).

### Barrels (`index.ts`)
- A barrel re-exports a feature's public surface. **Do not import a value through a
  barrel that creates a cross-feature require cycle** — it can resolve to `undefined` in
  the production bundle (this bit us once with `DEFAULT_FILTER`). Import cross-feature
  values from their source module, and keep shared cross-feature types in a neutral place.

### Styling
- Themed styles: `const styles = useThemedStyles(makeStyles)` where
  `makeStyles(theme)` returns a `StyleSheet.create({...})`. Don't hand-roll the
  `useMemo(() => makeStyles(theme), [theme])` dance.
- Colors come from theme tokens (`theme.bg`, `theme.accent`, …) or `Brand`. No raw hex
  in components.
- Spacing/radius/font/z-index/motion come from `Spacing`, `BorderRadius`, `FontSize`,
  `ButtonFontSize`, `ZIndex`, `Motion`.

### TypeScript
- `strict` is on. Avoid `any` — use a precise type or `unknown`. `eslint` warns on `any`.
- Prefer `catch {}` over `catch (err)` when the error is unused.

### Logging
- Use the shared `logger` (`src/services/logger.ts`), not raw `console.*`.

### Config & secrets
- All external URLs and keys live in `src/constants/config.ts`, sourced from
  `EXPO_PUBLIC_*` env vars. Never hardcode an API key in source.

### Lint
- `npm run lint` (ESLint 9 flat config, extends `eslint-config-expo`). Keep it at
  **zero errors**; drive warnings down as you touch files.

## Backend (FastAPI)

Layered, and already consistent — keep it that way:
- `api/routers/` — thin HTTP layer, no business logic.
- `services/` — business logic; raises domain exceptions; owns the DB session work.
- `schemas/` — Pydantic request/response models.
- `models/` — SQLAlchemy ORM models.
- `core/` — cross-cutting utils (`geo_utils`, `security`, `email`, `r2`, …).
- Name constants (`AGGREGATION_THRESHOLD`), don't inline domain magic numbers.
- Module docstrings describe the public API of a service. Keep them current.
- `snake_case` for modules, functions, variables; `PascalCase` for classes.

## Commits
- Small, focused commits; one concern each. Branch off `main` (we're on `fix/refactor`).
- Co-author line stays on Claude-authored commits.
