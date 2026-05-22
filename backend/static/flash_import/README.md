# Flash Import Tool (Windows)

PC-side companion for the InvadersHunter "Import flashes" feature.

- `import_flashes.bat` — entry point. User downloads this single file from the
  app, double-clicks it. It fetches the latest `.ps1` from the backend and runs it.
- `import_flashes.ps1` — PowerShell logic. Auto-downloads Android platform-tools
  (adb) into `%LOCALAPPDATA%\InvadersHunter\platform-tools` on first run.
  No Python or other prerequisite required.

Both files are served by the backend under `/static/tools/flash_import/`.
