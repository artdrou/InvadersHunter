# Flash Import Tool

## Web page (recommended)

`web/` — browser importer, served at `/flash-import/web`. Talks to the phone
over WebUSB (Chrome / Edge / Opera on desktop), so nothing to install and it
works on Windows, macOS and Linux. Flow: detect phone → log in → analyse
(mirror preview) → sync with backup (`GET /flash-import/snapshot`), verify,
and automatic revert (`POST /flash-import/restore`) on failure.

- `web/phone.js` is generated: edit `dev/flash-import-web/src/phone.js`, then
  `cd dev/flash-import-web && npm install && npm run build`.
- Tutorial screenshots go in `web/img/` (see `web/img/README.md`).
- The page only ever calls the backend that serves it (same origin).

## Windows tool (fallback)

PC-side companion for the InvadersHunter "Import flashes" feature.

- `import_flashes.bat` — entry point. User downloads this single file from the
  app, double-clicks it. It fetches the latest `.ps1` from the backend and runs it.
- `import_flashes.ps1` — PowerShell logic. Auto-downloads Android platform-tools
  (adb) into `%LOCALAPPDATA%\InvadersHunter\platform-tools` on first run.
  No Python or other prerequisite required.

Both files are served by the backend under `/static/tools/flash_import/`.

## Per-environment builds

`builds/InvadersHunter-FlashImport-<env>.exe` — one exe per backend
(development / staging / production), each with its API URL baked in. The app
always downloads `/static/flash_import/InvadersHunter-FlashImport.exe`; the
backend answers with the build matching the host it was reached at.

Rebuild all three after any change to `import_flashes.ps1`:

    powershell -ExecutionPolicy Bypass -File build_exes.ps1
