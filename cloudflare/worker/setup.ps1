$ErrorActionPreference = "Stop"

function Require-Env($name) {
  $value = [Environment]::GetEnvironmentVariable($name, "Process")
  if ([string]::IsNullOrWhiteSpace($value)) {
    $value = [Environment]::GetEnvironmentVariable($name, "User")
  }
  if ([string]::IsNullOrWhiteSpace($value)) {
    $value = [Environment]::GetEnvironmentVariable($name, "Machine")
  }
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "$name が未設定です。先に setx $name `"<token>`" を実行してください。"
  }
  return $value
}

Write-Host "== 1212 Homepage Worker Setup ==" -ForegroundColor Cyan

$token = Require-Env "CLOUDFLARE_API_TOKEN"
Write-Host "CLOUDFLARE_API_TOKEN: OK" -ForegroundColor Green

$accountId = [Environment]::GetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", "Process")
if ([string]::IsNullOrWhiteSpace($accountId)) {
  $accountId = [Environment]::GetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", "User")
}
if (-not [string]::IsNullOrWhiteSpace($accountId)) {
  $env:CLOUDFLARE_ACCOUNT_ID = $accountId
  Write-Host "CLOUDFLARE_ACCOUNT_ID: $accountId" -ForegroundColor Green
} else {
  Write-Host "CLOUDFLARE_ACCOUNT_ID が未設定です（設定済みなら memberships エラー回避に有効）" -ForegroundColor Yellow
}

$wranglerToml = Join-Path $PSScriptRoot "wrangler.toml"
if (-not (Test-Path $wranglerToml)) {
  throw "wrangler.toml がありません。wrangler.toml.example から作成してください。"
}

$toml = Get-Content -LiteralPath $wranglerToml -Raw
$tomlAccountId = ""
if ($toml -match 'account_id\s*=\s*"([^"]+)"') {
  $tomlAccountId = $Matches[1]
}
$hasAccountEnv = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", "Process"))
if (-not $hasAccountEnv -and -not [string]::IsNullOrWhiteSpace($tomlAccountId)) {
  $env:CLOUDFLARE_ACCOUNT_ID = $tomlAccountId
  Write-Host "wrangler.toml の account_id を利用します: $tomlAccountId" -ForegroundColor Green
}
$needsDbId = $toml -match 'database_id\s*=\s*"REPLACE_WITH_D1_DATABASE_ID"'

if ($needsDbId) {
  Write-Host "D1を作成します..." -ForegroundColor Yellow
  $createOutput = npx wrangler d1 create itsuki-homepage 2>&1 | Out-String
  Write-Host $createOutput

  if ($createOutput -notmatch 'database_id\s*=\s*"([^"]+)"') {
    throw "database_id の取得に失敗しました。出力を確認してください。"
  }
  $databaseId = $Matches[1]
  $toml = $toml -replace 'database_id\s*=\s*"REPLACE_WITH_D1_DATABASE_ID"', "database_id = `"$databaseId`""
  Set-Content -LiteralPath $wranglerToml -Value $toml -Encoding UTF8
  Write-Host "database_id を wrangler.toml に反映しました: $databaseId" -ForegroundColor Green
} else {
  Write-Host "database_id は設定済みです。" -ForegroundColor Green
}

Write-Host "D1スキーマを適用します..." -ForegroundColor Yellow
npx wrangler d1 execute itsuki-homepage --file=./schema.sql --remote

Write-Host ""
Write-Host "次の手順:" -ForegroundColor Cyan
Write-Host "1) wrangler secret put X_CONSUMER_KEY"
Write-Host "2) wrangler secret put X_CONSUMER_SECRET"
Write-Host "3) wrangler secret put X_ACCESS_TOKEN"
Write-Host "4) wrangler secret put X_ACCESS_TOKEN_SECRET"
Write-Host "5) npx wrangler deploy"
