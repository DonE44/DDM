<#
.SYNOPSIS
    Reliability-first core validation for FluxAura Studio.
.DESCRIPTION
    Validates foundational readiness only:
      1) project structure
      2) lint
    3) command wiring/handler audit
    4) web build
    5) desktop unpacked build availability
    6) normal launch/stop
    7) kiosk launch/stop
    Writes a single report and exits non-zero on failure.
.PARAMETER ReportDir
    Directory where the report is written. Defaults to release.
#>

param([string]$ReportDir = "release")

Set-StrictMode -Off
$ErrorActionPreference = "SilentlyContinue"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
if (-not [System.IO.Path]::IsPathRooted($ReportDir)) {
    $ReportDir = Join-Path $projectRoot $ReportDir
}
if (-not (Test-Path $ReportDir)) {
    New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
}

$pass = 0
$fail = 0
$lines = [System.Collections.Generic.List[string]]::new()

function L([string]$text) { $lines.Add($text) }
function Sep() { L ("=" * 72) }
function OK([string]$label) { $script:pass++; L ("  [PASS] $label") }
function FAIL([string]$label) { $script:fail++; L ("  [FAIL] $label") }
function INFO([string]$label) { L ("  [INFO] $label") }
function Section([string]$title) { Sep; L ("  " + $title); Sep }

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

function Stop-FluxAuraStudioAndWait([int]$TimeoutSeconds = 12) {
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

function Test-FluxAuraStudioLaunch(
    [string]$ExePath,
    [string[]]$LaunchArgs = @(),
    [int]$Attempts = 2,
    [int]$WaitSeconds = 8,
    [string]$ModeLabel = "mode"
) {
    # VS Code (itself an Electron app) exports ELECTRON_RUN_AS_NODE=1 into its child
    # processes.  That flag causes electron.exe to behave as a bare Node.js runtime
    # instead of an Electron GUI app, so FluxAura Studio.exe exits in <1 s before any JS runs.
    # Clear the variable for the duration of this function and restore it afterwards.
    $savedRunAsNode = $env:ELECTRON_RUN_AS_NODE
    Remove-Item env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

    try {
        for ($i = 1; $i -le $Attempts; $i++) {
            Stop-FluxAuraStudioAndWait 8 | Out-Null

            $proc = if ($LaunchArgs.Count -gt 0) {
                Start-Process -FilePath $ExePath -ArgumentList $LaunchArgs -PassThru
            } else {
                Start-Process -FilePath $ExePath -PassThru
            }

            Start-Sleep -Seconds $WaitSeconds

            $aliveByPid = $false
            if ($proc -and $proc.Id) {
                $aliveByPid = [bool](Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)
            }
            $aliveByName = (Get-Process -Name "FluxAura Studio" -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0

            INFO ("" + $ModeLabel + " attempt " + $i + ": aliveByPid=" + $aliveByPid + " aliveByName=" + $aliveByName)

            if ($aliveByPid -or $aliveByName) {
                return $true
            }
        }
        return $false
    } finally {
        if ($null -ne $savedRunAsNode) { $env:ELECTRON_RUN_AS_NODE = $savedRunAsNode }
    }
}

$reportFile = Join-Path $ReportDir ("core-validation-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".txt")
$npmCmd = Resolve-NpmCommand

if ($npmCmd) {
    $npmDir = Split-Path -Parent $npmCmd
    if ($env:Path -notlike "*$npmDir*") {
        $env:Path = "$npmDir;$env:Path"
    }
}

L ""
L "  FluxAura Studio Core Validation Report"
L ("  Generated: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
L ("  Machine  : " + $env:COMPUTERNAME)
L ("  User     : " + $env:USERNAME)
Sep

Section "1. Core Project Files"
$requiredFiles = @(
    "package.json",
    "electron\main.cjs",
    "electron\preload.cjs",
    "src\App.jsx",
    "scripts\prepare-desktop-build.ps1"
)
foreach ($f in $requiredFiles) {
    if (Test-Path $f) { OK ("Exists: " + $f) } else { FAIL ("Missing: " + $f) }
}

Section "2. Lint"
$lintOut = if ($npmCmd) { & $npmCmd run lint 2>&1 } else { @('npm not found in PATH or default install locations') }
if ($LASTEXITCODE -eq 0) {
    OK "ESLint passed"
} else {
    FAIL ("ESLint failed (exit " + $LASTEXITCODE + ")")
    foreach ($ln in ($lintOut | Select-Object -Last 20)) { INFO ("  " + $ln) }
}

Section "3. Command Audit"
$auditOut = if ($npmCmd) { & $npmCmd run commands:audit 2>&1 } else { @('npm not found in PATH or default install locations') }
if ($LASTEXITCODE -eq 0) {
    OK "Command audit passed"
} else {
    FAIL ("Command audit failed (exit " + $LASTEXITCODE + ")")
    foreach ($ln in ($auditOut | Select-Object -Last 20)) { INFO ("  " + $ln) }
}

Section "4. Web Build"
$buildOut = if ($npmCmd) { & $npmCmd run build 2>&1 } else { @('npm not found in PATH or default install locations') }
if ($LASTEXITCODE -eq 0) {
    OK "Vite build passed"
} else {
    FAIL ("Vite build failed (exit " + $LASTEXITCODE + ")")
    foreach ($ln in ($buildOut | Select-Object -Last 20)) { INFO ("  " + $ln) }
}

Section "5. Desktop Unpacked Runtime"
$unpackedExe = Join-Path $ReportDir "win-unpacked\FluxAura Studio.exe"
if (-not (Test-Path $unpackedExe)) {
    INFO "Unpacked app missing; running desktop:pack to produce runtime"

    $packAttempts = 2
    $packSucceeded = $false
    for ($attempt = 1; $attempt -le $packAttempts; $attempt++) {
        INFO ("desktop:pack attempt " + $attempt + " of " + $packAttempts)

        # Ensure stale/locked unpacked output is cleaned before each pack attempt.
        $prepOut = if ($npmCmd) { & $npmCmd run desktop:prepare 2>&1 } else { @('npm not found in PATH or default install locations') }
        if ($LASTEXITCODE -ne 0) {
            INFO ("desktop:prepare failed before pack attempt " + $attempt + " (exit " + $LASTEXITCODE + ")")
            foreach ($ln in ($prepOut | Select-Object -Last 10)) { INFO ("  " + $ln) }
            continue
        }

        $packOut = if ($npmCmd) { & $npmCmd run desktop:pack 2>&1 } else { @('npm not found in PATH or default install locations') }
        if ($LASTEXITCODE -eq 0) {
            OK ("desktop:pack passed on attempt " + $attempt)
            $packSucceeded = $true
            break
        }

        INFO ("desktop:pack failed on attempt " + $attempt + " (exit " + $LASTEXITCODE + ")")
        foreach ($ln in ($packOut | Select-Object -Last 15)) { INFO ("  " + $ln) }
        Start-Sleep -Seconds 1
    }

    if (-not $packSucceeded) {
        FAIL "desktop:pack failed after retries"
    }
}

if (Test-Path $unpackedExe) {
    OK "Unpacked executable available"
    INFO ("Path: " + $unpackedExe)
} else {
    FAIL ("Unpacked executable missing: " + $unpackedExe)
}

Section "6. Launch - Normal"
Stop-FluxAuraStudioAndWait 5 | Out-Null
if (Test-Path $unpackedExe) {
    $normalLaunched = Test-FluxAuraStudioLaunch -ExePath $unpackedExe -Attempts 3 -WaitSeconds 8 -ModeLabel "normal"
    if ($normalLaunched) { OK "Normal mode launched" } else { FAIL "Normal mode failed to launch after retries" }
    if (Stop-FluxAuraStudioAndWait 30) { OK "Normal mode stopped cleanly" } else {
        $remaining = (Get-Process -Name "FluxAura Studio" -ErrorAction SilentlyContinue | Measure-Object).Count
        FAIL ("Normal mode left processes running (" + $remaining + ")")
    }
} else {
    FAIL "Skipped normal launch: runtime missing"
}

Section "7. Launch - Kiosk"
Stop-FluxAuraStudioAndWait 5 | Out-Null
if (Test-Path $unpackedExe) {
    $kioskLaunched = Test-FluxAuraStudioLaunch -ExePath $unpackedExe -LaunchArgs @('--kiosk') -Attempts 2 -WaitSeconds 8 -ModeLabel "kiosk"
    if ($kioskLaunched) { OK "Kiosk mode launched" } else { FAIL "Kiosk mode failed to launch after retries" }
    if (Stop-FluxAuraStudioAndWait 30) { OK "Kiosk mode stopped cleanly" } else {
        $remaining = (Get-Process -Name "FluxAura Studio" -ErrorAction SilentlyContinue | Measure-Object).Count
        FAIL ("Kiosk mode left processes running (" + $remaining + ")")
    }
} else {
    FAIL "Skipped kiosk launch: runtime missing"
}

Sep
$total = $pass + $fail
$status = if ($fail -eq 0) { "CORE READY" } else { "CORE ISSUES" }
L ""
L ("  SUMMARY: " + $status)
L ("  Passed : " + $pass + " / " + $total)
L ("  Failed : " + $fail + " / " + $total)
L ""
Sep
L ""

$lines | Set-Content -Path $reportFile -Encoding utf8
Write-Output ("Report: " + $reportFile)
Write-Output ("PASSED=" + $pass + " FAILED=" + $fail + " STATUS=" + $status)

if ($fail -gt 0) { exit 1 }
exit 0
