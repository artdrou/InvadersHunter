# InvadersHunter — Frontend

React Native app built with Expo. Uses MapLibre for the map, Zustand for state management, and expo-sqlite for local offline storage.

---

## Stack

- Expo (React Native)
- Expo Router (file-based navigation)
- MapLibre GL (map rendering)
- Zustand (global state)
- expo-sqlite (local database)
- Axios (API client)
- i18next + react-i18next + expo-localization (FR / EN translations, device-language auto-detect)

### Native modules preinstalled for upcoming features

Bundled in the APK so future JS-only changes ship over EAS Update without a rebuild:

| Module | Used for |
|---|---|
| `expo-haptics` | Vibration feedback on flash success, emblem unlocks, button taps |
| `react-native-webview` | In-popup web pages (e.g. invader-spotter detail links) |
| `expo-notifications` | Local + push notifications (nearby invader, reward unlock) |
| `expo-secure-store` | Encrypted storage for auth refresh tokens |
| `expo-blur` | Frosted-glass overlays for modals and gamification UI |
| `expo-sharing` | Share achievements / flashed-invader cards |
| `expo-clipboard` | Copy invader names / share links |
| `expo-tracking-transparency` | iOS App Store requirement if analytics ever added |

---

## Local development setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Set environment variables

Create a `.env` file in the `frontend/` folder:

```ini
EXPO_PUBLIC_API_URL=https://invader-hunter-development.up.railway.app
```

For local backend development, replace the URL with `http://localhost:8000`.

### 3. Start the dev server

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your phone, or press `w` to open in the browser.

---

## Run tests

```bash
npm test
```

Tests cover pure utility functions. No native module mocks needed.

---

## Build an APK

Requires an Expo account and EAS CLI (`npm install -g eas-cli`).

```bash
eas build --profile preview --platform android
```

---

## Push an OTA update

Use this to ship a JavaScript-only update without releasing a new APK:

```bash
eas update --channel preview --message "describe your change"
```

---

## App structure

```
src/
  app/
    (tabs)/
      map.tsx         Main map screen
      invader.tsx     Invader list
      profile.tsx     User profile
      admin.tsx       Admin request list (admin only)
    admin/
      [id].tsx        Admin request detail
      pick-location   Map for choosing a corrected position
    login.tsx
    register.tsx
  features/
    invaders/         Types, store, API service
    admin/            Types, store, API service
    auth/             Zustand store (token + user, persisted)
    map/              Map component, popup, filter bar
  services/
    api-client.ts     Axios instance
    db.ts             expo-sqlite helpers
    sync.ts           Delta sync + offline queue flush
    connectivity.ts   Online/offline detection
  constants/
    theme.ts          Design tokens (colors, spacing, fonts)
```
