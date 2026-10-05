# Builds one InvadersHunter-FlashImport exe per backend environment.
#
# Each exe has its environment's API URL baked in, so a user always imports
# into the database of the app they downloaded the tool from. The backend
# serves the matching exe based on the host it was reached at (see
# app/services/flash_import_service.py:tool_exe_for_host).
#
# Run after every change to import_flashes.ps1 (requires: Install-Module ps2exe):
#   powershell -ExecutionPolicy Bypass -File build_exes.ps1

$ErrorActionPreference = 'Stop'
$here   = $PSScriptRoot
$source = Get-Content (Join-Path $here 'import_flashes.ps1') -Raw
$outDir = Join-Path $here 'builds'
New-Item -ItemType Directory -Force $outDir | Out-Null

foreach ($envName in 'development', 'staging', 'production') {
  $url = "https://invader-hunter-$envName.up.railway.app"
  $patched = $source -replace "(?m)^\`$ApiUrl\s*=.*$", "`$ApiUrl              = '$url'"
  if ($patched -notmatch [regex]::Escape("'$url'")) { throw "Could not set ApiUrl for $envName" }

  $tmp = Join-Path $env:TEMP "import_flashes.$envName.ps1"
  Set-Content -Path $tmp -Value $patched -Encoding UTF8
  $out = Join-Path $outDir "InvadersHunter-FlashImport-$envName.exe"
  Invoke-ps2exe -inputFile $tmp -outputFile $out | Out-Null
  Remove-Item $tmp
  Write-Host "$envName -> $out"
}
