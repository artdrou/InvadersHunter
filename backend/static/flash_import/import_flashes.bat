@echo off
setlocal
title HintVaders - Flash Import

set "SCRIPT_URL=https://invader-hunter-development.up.railway.app/static/flash_import/import_flashes.ps1"
set "SCRIPT_PATH=%TEMP%\hintvaders_import_flashes.ps1"

echo Downloading import script...
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri '%SCRIPT_URL%' -OutFile '%SCRIPT_PATH%' } catch { Write-Host $_; exit 1 }"
if errorlevel 1 (
  echo.
  echo ERROR: could not download the import script. Check your internet connection.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%"
echo.
pause
