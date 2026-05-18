$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Initialize-NodePath {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        return
    }

    $nodeCandidates = @(
        (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe')
    )

    foreach ($nodePath in $nodeCandidates) {
        if ($nodePath -and (Test-Path $nodePath)) {
            $nodeDir = Split-Path -Parent $nodePath
            $env:Path = "$nodeDir;$env:Path"
            return
        }
    }
}

Initialize-NodePath

function Resolve-NodeCommand([string]$CommandName) {
    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        return $cmd.Source
    }

    $candidates = @(
        (Join-Path $repoRoot "node_modules\.bin\$CommandName.cmd"),
        (Join-Path $env:ProgramFiles "nodejs\$CommandName.cmd"),
        (Join-Path ${env:ProgramFiles(x86)} "nodejs\$CommandName.cmd")
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            $candidateDir = Split-Path -Parent $candidate
            if ($env:Path -notlike "*$candidateDir*") {
                $env:Path = "$candidateDir;$env:Path"
            }
            return $candidate
        }
    }

    throw "Could not find $CommandName. Install Node.js/npm or add it to PATH."
}

$viteCmd = Resolve-NodeCommand 'vite'
$electronCmd = Resolve-NodeCommand 'electron'

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'prepare-desktop-dev.ps1')
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

# --- Log paths ---
$releaseDir = Join-Path $repoRoot 'release'
if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
}
$viteOutLog = Join-Path $releaseDir 'desktop-dev-vite.out.log'
$viteErrLog = Join-Path $releaseDir 'desktop-dev-vite.err.log'
foreach ($logPath in @($viteOutLog, $viteErrLog)) {
    if (Test-Path $logPath) { Remove-Item $logPath -Force -ErrorAction SilentlyContinue }
}

# --- Helper: dump Vite logs to console ---
function Show-ViteLogs {
    foreach ($logPath in @($viteOutLog, $viteErrLog)) {
        if (Test-Path $logPath) { Get-Content $logPath | Write-Output }
    }
}

# --- Kill any stale process holding port 5173 from a previous session ---
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 400

# --- Start Vite dev server (using splatting to avoid PATH/cmd lookup issues) ---
$startParams = @{
    FilePath               = $viteCmd
    ArgumentList           = @('--host', '127.0.0.1', '--port', '5173', '--strictPort', '--force')
    WorkingDirectory       = $repoRoot
    RedirectStandardOutput = $viteOutLog
    RedirectStandardError  = $viteErrLog
    PassThru               = $true
}
$viteProcess = Start-Process @startParams

# Default exit code - overwritten after Electron runs successfully
$electronExit = 1

try {
    # --- Wait for Vite to start listening (60 s timeout) ---
    $deadline = (Get-Date).AddSeconds(60)
    do {
        Start-Sleep -Milliseconds 500

        if ($viteProcess.HasExited) {
            Show-ViteLogs
            throw "Vite dev server exited before becoming ready (exit code $($viteProcess.ExitCode))."
        }

        $listening = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
        if ($listening) { break }

    } while ((Get-Date) -lt $deadline)

    # Final check after loop - covers the case where the deadline was reached
    $listening = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
    if (-not $listening) {
        Show-ViteLogs
        throw "Timed out waiting for Vite dev server on port 5173."
    }

    Write-Host "[FluxAura Studio] Vite ready at http://127.0.0.1:5173 - launching Electron..."

    # --- Launch Electron, passing the Vite URL via environment variable ---
    # VS Code sets ELECTRON_RUN_AS_NODE=1 in its terminal - must clear before launching
    # or Electron runs as plain Node.js and all Electron APIs are unavailable.
    $env:ELECTRON_RUN_AS_NODE = $null

    $env:FLUXAURA_STUDIO_DEV_URL = 'http://127.0.0.1:5173'
    & $electronCmd .
    $electronExit = $LASTEXITCODE
}
finally {
    # --- Clean up: stop Vite process and free port 5173 ---
    if ($null -ne $viteProcess -and -not $viteProcess.HasExited) {
        $parentId = $viteProcess.Id
        # Kill child processes spawned by the cmd.exe wrapper first
        Get-CimInstance -ClassName Win32_Process -Filter "ParentProcessId=$parentId" -ErrorAction SilentlyContinue |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
    }
    # Belt-and-braces: ensure port 5173 is free for the next run
    Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}

exit $electronExit
