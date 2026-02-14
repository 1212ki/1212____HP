$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcDir = Join-Path $here "..\\1212-design-system\\dist"
$dstDir = Join-Path $here "assets\\css"

$files = @(
  "1212-music.tokens.css",
  "1212-music.tokens.json"
)

foreach ($f in $files) {
  $src = Join-Path $srcDir $f
  $dst = Join-Path $dstDir $f
  if (-not (Test-Path -LiteralPath $src)) {
    throw "Missing source file: $src"
  }
  Copy-Item -LiteralPath $src -Destination $dst -Force
}

Write-Host "Synced design tokens to $dstDir"

