param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$BuilderArgs
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$localBin = Join-Path $root "node_modules\.bin\electron-builder.cmd"

if (-not (Test-Path $localBin)) {
  throw "electron-builder was not found at $localBin. Run npm install before building."
}

$cacheRoot = Join-Path $root "release\.cache"
$electronCache = Join-Path $cacheRoot "electron"
$builderCache = Join-Path $cacheRoot "electron-builder"

New-Item -ItemType Directory -Force -Path $electronCache, $builderCache | Out-Null

$env:ELECTRON_CACHE = $electronCache
$env:ELECTRON_BUILDER_CACHE = $builderCache

& $localBin @BuilderArgs
exit $LASTEXITCODE
