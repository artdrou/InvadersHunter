# InvadersHunter - Flash Import (PowerShell)
# ===========================================
# Self-contained: no Python required. Auto-downloads Android platform-tools (adb)
# on first run into the user's local app data.
#
# Invoked via import_flashes.bat which the user downloads from the InvadersHunter app.

$ErrorActionPreference = 'Stop'

# Force TLS 1.2 for older Windows 10 builds when calling Invoke-WebRequest
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$ApiUrl              = 'https://invader-hunter-development.up.railway.app'
$FlashInvadersPkg    = 'com.ltu.flashInvader'
$CandidatePaths      = @(
  "/sdcard/Android/data/$FlashInvadersPkg/files/Pictures",
  "/sdcard/Android/data/$FlashInvadersPkg/files/Flashes",
  "/sdcard/Android/data/$FlashInvadersPkg/files",
  "/sdcard/Android/data/$FlashInvadersPkg/cache"
)
$ToolsDir            = Join-Path $env:LOCALAPPDATA 'InvadersHunter\platform-tools'
$AdbExe              = Join-Path $ToolsDir 'adb.exe'
$PlatformToolsUrl    = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip'

function Write-Step($msg) { Write-Host ""; Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-Err ($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red }
function Pause-And-Exit($code) {
  Write-Host ""
  Read-Host "Press Enter to close this window"
  exit $code
}

# ---- adb bootstrap ----------------------------------------------------------
function Ensure-Adb {
  if (Test-Path $AdbExe) { return }
  Write-Step "Downloading Android platform-tools (one-time, ~10 MB)..."
  $zipPath = Join-Path $env:TEMP 'platform-tools.zip'
  Invoke-WebRequest -UseBasicParsing -Uri $PlatformToolsUrl -OutFile $zipPath
  $parent = Split-Path $ToolsDir -Parent
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
  if (Test-Path $ToolsDir) { Remove-Item -Recurse -Force $ToolsDir }
  Expand-Archive -Path $zipPath -DestinationPath $parent -Force
  Remove-Item $zipPath -Force
  if (-not (Test-Path $AdbExe)) { throw "adb.exe not found after extraction." }
}

function Invoke-Adb {
  param([Parameter(Mandatory)][string[]]$Args)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $AdbExe
  $psi.Arguments = ($Args | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $p = [System.Diagnostics.Process]::Start($psi)
  $out = $p.StandardOutput.ReadToEnd()
  $err = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  return [pscustomobject]@{ Out = $out; Err = $err; Code = $p.ExitCode }
}

# ---- main -------------------------------------------------------------------
Write-Host "============================================================"
Write-Host " InvadersHunter - Flash Import"
Write-Host "============================================================"

$apiUrl = $ApiUrl.TrimEnd('/')

$username = Read-Host "Username"
if ([string]::IsNullOrWhiteSpace($username)) { Write-Err "username required."; Pause-And-Exit 1 }
$securePwd = Read-Host "Password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
if ([string]::IsNullOrEmpty($password)) { Write-Err "password required."; Pause-And-Exit 1 }

Ensure-Adb

Write-Step "Checking phone connection..."
# Kick the server so we always see the freshest device state, then wait up to 60s
# while the user accepts the "Allow USB debugging" RSA prompt on the phone.
Invoke-Adb @('start-server') | Out-Null
$deadline = (Get-Date).AddSeconds(60)
$promptShown = $false
while ($true) {
  $devs = Invoke-Adb @('devices')
  $lines = $devs.Out -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^List of' }
  $authorized   = $lines | Where-Object { $_ -match "`tdevice$" }
  $unauthorized = $lines | Where-Object { $_ -match "`tunauthorized$" }
  $offline      = $lines | Where-Object { $_ -match "`toffline$" }

  if ($authorized) {
    Write-Host "Device OK."
    break
  }
  if ($unauthorized -and -not $promptShown) {
    Write-Host "Waiting for you to tap 'Allow' (and check 'Always allow') on the phone..." -ForegroundColor Yellow
    $promptShown = $true
  } elseif (-not $unauthorized -and -not $offline -and -not $promptShown) {
    Write-Host "Waiting for the phone to connect (USB cable + USB debugging ON)..." -ForegroundColor Yellow
    $promptShown = $true
  }
  if ((Get-Date) -gt $deadline) {
    Write-Err "timed out waiting for an authorized Android device."
    Write-Host "  - Connect your phone via USB"
    Write-Host "  - Enable USB debugging in developer options"
    Write-Host "  - Accept the RSA prompt on the phone"
    Pause-And-Exit 1
  }
  Start-Sleep -Seconds 2
}

Write-Step "Listing FlashInvaders files..."
$names = @()
foreach ($path in $CandidatePaths) {
  $r = Invoke-Adb @('shell', 'ls', '-1', $path)
  $candidate = $r.Out -split "`n" |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and ($_ -notmatch '^ls:') -and ($_ -notmatch 'No such file') }
  if ($candidate.Count -gt 0) {
    Write-Host "Found $($candidate.Count) files in $path"
    $names = $candidate
    break
  }
}
if (-not $names -or $names.Count -eq 0) {
  Write-Err "could not find the FlashInvaders flashes folder."
  Write-Host "  - Make sure the FlashInvaders app is installed with at least one flash."
  Write-Host "  - Android 11+ scoped storage may block access; a rooted device may be required."
  Pause-And-Exit 1
}

Write-Step "Logging in to InvadersHunter..."
try {
  $login = Invoke-RestMethod -Method Post -Uri "$apiUrl/auth/login" `
    -ContentType 'application/json' `
    -Body (@{ username = $username; password = $password } | ConvertTo-Json)
} catch {
  Write-Err "login failed: $($_.Exception.Message)"
  Pause-And-Exit 1
}
$token = $login.access_token
if (-not $token) { Write-Err "login response missing access_token."; Pause-And-Exit 1 }

Write-Step "Sending $($names.Count) names to $apiUrl/flash-import/ ..."
try {
  $res = Invoke-RestMethod -Method Post -Uri "$apiUrl/flash-import/" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType 'application/json' `
    -Body (@{ names = $names } | ConvertTo-Json)
} catch {
  Write-Err "import failed: $($_.Exception.Message)"
  Pause-And-Exit 1
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host ("  Imported       : {0}" -f $res.imported)
Write-Host ("  Already flashed: {0}" -f $res.already_flashed)
Write-Host ("  Unknown        : {0}" -f $res.unknown.Count)
if ($res.unknown.Count -gt 0) {
  $preview = ($res.unknown | Select-Object -First 10) -join ', '
  $more = if ($res.unknown.Count -gt 10) { " (+$($res.unknown.Count - 10) more)" } else { '' }
  Write-Host "  Unknown names  : $preview$more"
}
Write-Host ""
Write-Host "Flashes imported. Re-run this whenever you want to sync new flashes." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: open the InvadersHunter app on your phone and tap 'Sync now'" -ForegroundColor Yellow
Write-Host "           on the Profile page to pull your new flashes into the app." -ForegroundColor Yellow
Pause-And-Exit 0
