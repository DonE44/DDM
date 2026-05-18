param(
    [string]$AppFile = 'src/App.jsx',
    [string]$ResultsFile = 'docs/command-test-results.md',
    [string]$ReportDir = 'release'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path $AppFile)) {
    Write-Error "App file not found: $AppFile"
}

if (-not (Test-Path $ResultsFile)) {
    Write-Error "Results file not found: $ResultsFile"
}

if (-not (Test-Path $ReportDir)) {
    New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
}

$appText = Get-Content -Raw -Path $AppFile
$resultsLines = Get-Content -Path $ResultsFile

$commandIds = @()
foreach ($line in $resultsLines) {
    if ($line -cmatch '^\|\s*([a-z][a-z0-9-]*)\s*\|') {
        $id = $Matches[1]
        if ($id -ne 'command-id' -and $id -notmatch '^-+$') {
            $commandIds += $id
        }
    }
}

$commandIds = $commandIds | Select-Object -Unique

# Commands should be both handled and exposed via a menu item, toolbar button,
# or keyboard shortcut. Keep this list empty unless a deliberate internal-only
# command is added and documented with its reason.
$SingleWiredAllowed = @()

$missingHandlers = New-Object System.Collections.Generic.List[string]
$missingWiring = New-Object System.Collections.Generic.List[string]

foreach ($id in $commandIds) {
    $escapedId = [Regex]::Escape($id)
    $handlerPattern = "commandId === '$escapedId'"
    $quotedIdPattern = "['`"]$escapedId['`"]"

    $hasHandler = $appText -match $handlerPattern
    if (-not $hasHandler -and $id -match '^nudge-(left|right|up|down)-(1|10)$') {
        $hasHandler = $appText -match "commandId\.startsWith\('nudge-'\)"
    }

    if (-not $hasHandler) {
        [void]$missingHandlers.Add($id)
    }

    # Wiring is considered present when the command id appears in at least
    # two quoted string occurrences (typically handler + UI/menu definition).
    # Pattern commands can be wired by a keyboard/template invocation such as
    # runCommand(`nudge-${dir}-${amt}`).
    $quotedIdCount = [Regex]::Matches($appText, $quotedIdPattern).Count
    $hasPatternWiring = $false
    if ($id -match '^nudge-(left|right|up|down)-(1|10)$') {
        $hasPatternWiring = $appText -match 'runCommand\(`nudge-\$\{dirMap\[e\.key\]\}-\$\{amt\}`\)'
    }
    if ($quotedIdCount -lt 2 -and -not $hasPatternWiring -and $SingleWiredAllowed -notcontains $id) {
        [void]$missingWiring.Add($id)
    }
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$reportPath = Join-Path $ReportDir "command-audit-$timestamp.txt"
$latestReportPath = Join-Path $ReportDir 'command-audit-latest.txt'

$total = $commandIds.Count
$handlerMissingCount = $missingHandlers.Count
$wiringMissingCount = $missingWiring.Count
$ok = ($handlerMissingCount -eq 0 -and $wiringMissingCount -eq 0)

$lines = @()
$lines += "COMMAND_AUDIT_TIMESTAMP=$timestamp"
$lines += "APP_FILE=$AppFile"
$lines += "RESULTS_FILE=$ResultsFile"
$lines += "TOTAL_COMMANDS=$total"
$lines += "MISSING_HANDLERS=$handlerMissingCount"
$lines += "MISSING_WIRING=$wiringMissingCount"
$lines += "AUDIT_STATUS=$(if ($ok) { 'PASS' } else { 'FAIL' })"
$lines += ''

if ($handlerMissingCount -gt 0) {
    $lines += 'MISSING_HANDLER_COMMANDS:'
    $lines += ($missingHandlers | ForEach-Object { "- $_" })
    $lines += ''
}

if ($wiringMissingCount -gt 0) {
    $lines += 'MISSING_WIRING_COMMANDS:'
    $lines += ($missingWiring | ForEach-Object { "- $_" })
    $lines += ''
}

$lines += 'ALL_COMMANDS:'
$lines += ($commandIds | ForEach-Object { "- $_" })

$lines | Set-Content -Path $reportPath -Encoding ascii
$lines | Set-Content -Path $latestReportPath -Encoding ascii

Write-Output "Command audit report: $reportPath"
Write-Output "Command audit latest: $latestReportPath"

if (-not $ok) {
    exit 1
}

exit 0
