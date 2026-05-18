<#
.SYNOPSIS
    FluxAura Studio Release Smoke Check - generates a full release-readiness report.
.DESCRIPTION
    Runs lint, build, installer artifact checks, and unpacked-app launch tests
    (normal mode + kiosk mode) then writes a consolidated report file.
.PARAMETER ReportDir
    Directory to write the report into. Defaults to .\release
.EXAMPLE
    powershell -NoProfile -File scripts\smoke-report.ps1
#>

param([string]$ReportDir = "release")

Set-StrictMode -Off
$ErrorActionPreference = "SilentlyContinue"

# Resolve project root and report directory first.
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
if (-not [System.IO.Path]::IsPathRooted($ReportDir)) {
    $ReportDir = Join-Path $projectRoot $ReportDir
}

# ---- helpers ----------------------------------------------------------------
$pass = 0
$fail = 0
$lines = [System.Collections.Generic.List[string]]::new()

function L([string]$text) { $lines.Add($text) }
function Sep() { L ("=" * 72) }
function OK([string]$label) {
    $script:pass++
    L ("  [PASS] $label")
}
function FAIL([string]$label) {
    $script:fail++
    L ("  [FAIL] $label")
}
function INFO([string]$label) { L ("  [INFO] $label") }
function Section([string]$title) { Sep; L "  $title"; Sep }

function Resolve-NpmCommand {
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if ($npm -and $npm.Source) {
        return $npm.Source
    }

    $candidates = @(
        (Join-Path $env:ProgramFiles 'nodejs\npm.cmd'),
        (Join-Path ${env:ProgramFiles(x86)} 'nodejs\npm.cmd')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Stop-FluxAuraStudioAndWait([int]$TimeoutSeconds = 10) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        # Re-issue kill commands while waiting to catch late-spawned child processes.
        foreach ($processName in @("FluxAura Studio", "SMME", "SMM200")) {
            Get-Process -Name $processName -ErrorAction SilentlyContinue | Stop-Process -Force
        }
        Start-Sleep -Milliseconds 500
        $remaining = @("FluxAura Studio", "SMME", "SMM200") |
            ForEach-Object { (Get-Process -Name $_ -ErrorAction SilentlyContinue | Measure-Object).Count } |
            Measure-Object -Sum |
            Select-Object -ExpandProperty Sum
        if ($remaining -eq 0) { return $true }
    } while ((Get-Date) -lt $deadline)
    return $false
}

# ---- header -----------------------------------------------------------------
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$reportFile = Join-Path $ReportDir ("smoke-report-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".txt")

L ""
L "  FluxAura Studio Release Smoke Report"
L "  Generated: $timestamp"
L "  Machine  : $env:COMPUTERNAME"
L "  User     : $env:USERNAME"
Sep

$npmCmd = Resolve-NpmCommand
if ($npmCmd) {
    $npmDir = Split-Path -Parent $npmCmd
    if ($env:Path -notlike "*$npmDir*") {
        $env:Path = "$npmDir;$env:Path"
    }
}

# ---- section 1: project files -----------------------------------------------
Section "1. Project File Checks"

$requiredFiles = @(
    "package.json",
    "electron\main.cjs",
    "electron\preload.cjs",
    "electron\media-capabilities.cjs",
    "src\App.jsx",
    "vite.config.js",
    "index.html"
)
foreach ($f in $requiredFiles) {
    if (Test-Path $f) { OK "Exists: $f" } else { FAIL "Missing: $f" }
}

# ---- section 2: lint --------------------------------------------------------
Section "2. Lint Check (eslint)"

if ($npmCmd) {
    $lintOut = & $npmCmd run lint 2>&1
    $lintExit = $LASTEXITCODE
} else {
    $lintOut = @('npm not found in PATH or default install locations')
    $lintExit = 1
}
if ($lintExit -eq 0) {
    OK "ESLint passed (exit 0)"
} else {
    FAIL "ESLint failed (exit $lintExit)"
    foreach ($ln in ($lintOut | Select-Object -Last 20)) { INFO "  $ln" }
}

# ---- section 3: vite build --------------------------------------------------
Section "3. Web Build (vite build)"

if ($npmCmd) {
    $buildOut = & $npmCmd run build 2>&1
    $buildExit = $LASTEXITCODE
} else {
    $buildOut = @('npm not found in PATH or default install locations')
    $buildExit = 1
}
if ($buildExit -eq 0) {
    OK "Vite build passed (exit 0)"
    $jsAsset = Get-ChildItem "dist\assets\*.js" -ErrorAction SilentlyContinue | Select-Object -First 1
    $cssAsset = Get-ChildItem "dist\assets\*.css" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($jsAsset)  { INFO "JS  asset: $($jsAsset.Name)  ($([Math]::Round($jsAsset.Length/1KB,1)) KB)" }
    if ($cssAsset) { INFO "CSS asset: $($cssAsset.Name) ($([Math]::Round($cssAsset.Length/1KB,1)) KB)" }
} else {
    FAIL "Vite build failed (exit $buildExit)"
    foreach ($ln in ($buildOut | Select-Object -Last 20)) { INFO "  $ln" }
}

# ---- section 4: installer artifact ------------------------------------------
Section "4. Installer Artifact"

$setupGlob = Get-ChildItem "$ReportDir\*.exe" -ErrorAction SilentlyContinue |
             Where-Object { $_.Name -like "*Setup*" } |
             Sort-Object LastWriteTime -Descending |
             Select-Object -First 1

if ($setupGlob) {
    OK "Setup exe found: $($setupGlob.Name)"
    INFO "Size : $([Math]::Round($setupGlob.Length/1MB,2)) MB"
    $hash = Get-FileHash -Path $setupGlob.FullName -Algorithm SHA256
    INFO "SHA256: $($hash.Hash)"
    $blockmap = $setupGlob.FullName + ".blockmap"
    if (Test-Path $blockmap) { OK "Blockmap present" } else { FAIL "Blockmap missing" }
} else {
    FAIL "No Setup .exe found in $ReportDir"
}

# ---- section 5: unpacked runtime --------------------------------------------
Section "5. Unpacked Runtime"

$unpackedExe = "$ReportDir\win-unpacked\FluxAura Studio.exe"
if (Test-Path $unpackedExe) {
    OK "Unpacked exe found: $unpackedExe"
    $item = Get-Item $unpackedExe
    INFO "Size: $([Math]::Round($item.Length/1MB,2)) MB"
} else {
    FAIL "Unpacked exe missing: $unpackedExe"
}

$runtimeFiles = @("ffmpeg.dll", "libEGL.dll", "icudtl.dat", "resources.pak")
foreach ($rf in $runtimeFiles) {
    $rp = "$ReportDir\win-unpacked\$rf"
    if (Test-Path $rp) { OK "Runtime file: $rf" } else { FAIL "Runtime file missing: $rf" }
}

# ---- section 6: resources / app bundle -------------------------------------
Section "6. App Bundle (asar)"

$asar = "$ReportDir\win-unpacked\resources\app.asar"
if (Test-Path $asar) {
    $asarItem = Get-Item $asar
    OK "app.asar present ($([Math]::Round($asarItem.Length/1MB,2)) MB)"
} else {
    FAIL "app.asar missing at $asar"
}

# ---- section 7: normal-mode launch ------------------------------------------
Section "7. Launch Test - Normal Mode"

Stop-FluxAuraStudioAndWait 5 | Out-Null

if (Test-Path $unpackedExe) {
    Start-Process -FilePath $unpackedExe
    Start-Sleep -Seconds 8
    $cnt = (Get-Process -Name "FluxAura Studio" -ErrorAction SilentlyContinue | Measure-Object).Count
    INFO "Process count after 8 s: $cnt"
    if ($cnt -gt 0) {
        OK "App launched and running in normal mode"
    } else {
        FAIL "App did not start (no FluxAura Studio process found)"
    }
    if (Stop-FluxAuraStudioAndWait 12) { OK "All FluxAura Studio processes stopped cleanly" } else {
        $afterCnt = (Get-Process -Name "FluxAura Studio" -ErrorAction SilentlyContinue | Measure-Object).Count
        FAIL "Processes still running after stop ($afterCnt)"
    }
} else {
    FAIL "Skipped - unpacked exe not found"
}

# ---- section 8: kiosk-mode launch -------------------------------------------
Section "8. Launch Test - Kiosk Mode"

Stop-FluxAuraStudioAndWait 5 | Out-Null

if (Test-Path $unpackedExe) {
    $kioskFlag = '--kiosk'
    Start-Process -FilePath $unpackedExe -ArgumentList $kioskFlag
    Start-Sleep -Seconds 8
    $cnt = (Get-Process -Name "FluxAura Studio" -ErrorAction SilentlyContinue | Measure-Object).Count
    INFO "Process count after 8 s: $cnt"
    if ($cnt -gt 0) {
        OK "App launched and running in kiosk mode"
    } else {
        FAIL "App did not start in kiosk mode"
    }
    if (Stop-FluxAuraStudioAndWait 12) { OK "All FluxAura Studio kiosk processes stopped cleanly" } else {
        $afterCnt = (Get-Process -Name "FluxAura Studio" -ErrorAction SilentlyContinue | Measure-Object).Count
        FAIL "Processes still running after kiosk stop ($afterCnt)"
    }
} else {
    FAIL "Skipped - unpacked exe not found"
}

# ---- section 9: stage preset sanity (source check) -------------------------
Section "9. Stage Preset Config (source check)"

$appJsx = "src\App.jsx"
if (Test-Path $appJsx) {
    $content = Get-Content $appJsx -Raw
    $presets = @("640", "800", "1024", "1280", "1920")
    foreach ($p in $presets) {
        if ($content -match "width: $p") { OK "Stage preset $p width defined" } else { FAIL "Stage preset $p width missing" }
    }
    if ($content -match "STAGE_PRESETS") { OK "STAGE_PRESETS constant present" } else { FAIL "STAGE_PRESETS constant missing" }
    if ($content -match "stagePreset") { OK "stagePreset state present" } else { FAIL "stagePreset state missing" }
} else {
    FAIL "src\App.jsx not found"
}

# ---- section 10: electron config sanity -------------------------------------
Section "10. Electron Config Sanity"

$mainCjs = "electron\main.cjs"
if (Test-Path $mainCjs) {
    $mainContent = Get-Content $mainCjs -Raw
    if ($mainContent -match "START_KIOSK") { OK "Kiosk mode flag present in main.cjs" } else { FAIL "Kiosk mode flag missing" }
    if ($mainContent -match "media-capabilities.cjs") { OK "Media capabilities module imported" } else { FAIL "Media capabilities module not imported" }
    if ($mainContent -match "app:media-capability") { OK "media-capability IPC handler present" } else { FAIL "media-capability IPC handler missing" }
    if ($mainContent -match "app:set-kiosk-mode") { OK "set-kiosk-mode IPC handler present" } else { FAIL "set-kiosk-mode IPC handler missing" }
} else {
    FAIL "electron\main.cjs not found"
}

$preloadCjs = "electron\preload.cjs"
if (Test-Path $preloadCjs) {
    $preloadContent = Get-Content $preloadCjs -Raw
    if ($preloadContent -match "mediaCapability") { OK "mediaCapability exposed in preload" } else { FAIL "mediaCapability missing from preload" }
    if ($preloadContent -match "setKioskMode") { OK "setKioskMode exposed in preload" } else { FAIL "setKioskMode missing from preload" }
} else {
    FAIL "electron\preload.cjs not found"
}

# ---- summary ----------------------------------------------------------------
Sep
$total = $pass + $fail
$marker = if ($fail -eq 0) { "RELEASE READY" } else { "ISSUES FOUND" }
L ""
L "  SUMMARY: $marker"
L "  Passed : $pass / $total"
L "  Failed : $fail / $total"
L ""
Sep
L ""

# ---- write report -----------------------------------------------------------
$lines | Set-Content -Path $reportFile -Encoding utf8
Write-Output "Report: $reportFile"
Write-Output "PASSED=$pass   FAILED=$fail   STATUS=$marker"
