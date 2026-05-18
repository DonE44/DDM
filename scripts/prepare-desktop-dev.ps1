$ErrorActionPreference = "SilentlyContinue"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Stop any running desktop app instance from prior dev sessions.
foreach ($processName in @("FluxAura Studio", "SMME", "SMM200")) {
    Get-Process -Name $processName -ErrorAction SilentlyContinue | Stop-Process -Force
}

# Free the fixed Vite port expected by the Electron dev shell.
$owningPids = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
foreach ($owningPid in $owningPids) {
    Stop-Process -Id $owningPid -Force -ErrorAction SilentlyContinue
}

exit 0
