$ErrorActionPreference = "SilentlyContinue"

# Reliability-first cleanup for repeatable desktop builds.
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Quietly clear known current and legacy process names; do not fail if none are present.
foreach ($processName in @("FluxAura Studio", "SMME", "SMM200")) {
    Get-Process -Name $processName -ErrorAction SilentlyContinue | Stop-Process -Force
}

# Kill only processes whose executable path is inside this repo release folder.
$releaseRoot = Join-Path $repoRoot "release"
$targetPrefix = ($releaseRoot + "\\").ToLowerInvariant()
$locked = Get-Process -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Path -and ($_.Path.ToLowerInvariant().StartsWith($targetPrefix))
    }
foreach ($p in $locked) {
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}

if (Test-Path "release/win-unpacked") {
    $removed = $false
    for ($i = 1; $i -le 6; $i++) {
        Remove-Item -Recurse -Force "release/win-unpacked" -ErrorAction SilentlyContinue
        if (-not (Test-Path "release/win-unpacked")) {
            $removed = $true
            break
        }

        # One more targeted kill pass, then retry.
        $locked = Get-Process -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Path -and ($_.Path.ToLowerInvariant().StartsWith($targetPrefix))
            }
        foreach ($p in $locked) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Milliseconds 500
    }

    if (-not $removed -and (Test-Path "release/win-unpacked")) {
        Write-Error "Unable to remove release/win-unpacked after retries (file lock persists)."
        exit 1
    }
}

exit 0
