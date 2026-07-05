#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'

function Find-PostgresRoot {
  $root = 'C:\Program Files\PostgreSQL'
  if (-not (Test-Path $root)) {
    throw "PostgreSQL not found: $root"
  }

  $versionDir = Get-ChildItem $root -Directory | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $versionDir) {
    throw 'PostgreSQL version directory not found'
  }

  return $versionDir.FullName
}

$pgRoot = Find-PostgresRoot
$pgHba = Join-Path $pgRoot 'data\pg_hba.conf'
$psql = Join-Path $pgRoot 'bin\psql.exe'
$service = Get-Service -Name 'postgresql*' -ErrorAction Stop | Select-Object -First 1
$projectRoot = Split-Path $PSScriptRoot -Parent
$sqlFile = Join-Path $projectRoot 'scripts\setup-db.sql'
$backup = "$pgHba.overbuild.bak"

if (-not (Test-Path $psql)) {
  throw "psql not found: $psql"
}
if (-not (Test-Path $pgHba)) {
  throw "pg_hba.conf not found: $pgHba"
}

Write-Host "Using PostgreSQL at $pgRoot"
Write-Host 'Backing up pg_hba.conf...'
Copy-Item $pgHba $backup -Force

Write-Host 'Enabling localhost trust auth...'
(Get-Content $pgHba) -replace 'scram-sha-256', 'trust' | Set-Content $pgHba

Write-Host 'Restarting PostgreSQL service...'
Restart-Service $service.Name -Force
Start-Sleep -Seconds 3

try {
  Write-Host 'Creating overbuild role...'
  & $psql -U postgres -h 127.0.0.1 -v ON_ERROR_STOP=1 -f $sqlFile

  $raw = & $psql -U postgres -h 127.0.0.1 -tAc "SELECT 1 FROM pg_database WHERE datname = 'overbuild'"
  $dbExists = ''
  if ($null -ne $raw) {
    $dbExists = [string]$raw
    $dbExists = $dbExists.Trim()
  }

  if ($dbExists -ne '1') {
    Write-Host 'Creating database overbuild...'
    & $psql -U postgres -h 127.0.0.1 -v ON_ERROR_STOP=1 -c "CREATE DATABASE overbuild OWNER overbuild;"
  } else {
    Write-Host 'Database overbuild already exists'
  }

  & $psql -U postgres -h 127.0.0.1 -c "GRANT ALL PRIVILEGES ON DATABASE overbuild TO overbuild;"
}
finally {
  Write-Host 'Restoring scram-sha-256 auth...'
  Copy-Item $backup $pgHba -Force
  Restart-Service $service.Name -Force
  Start-Sleep -Seconds 2
}

$env:PGPASSWORD = 'overbuild'
Write-Host 'Verifying connection...'
& $psql -U overbuild -h 127.0.0.1 -d overbuild -c "SELECT current_user, current_database();"

Set-Location $projectRoot
Write-Host 'Running prisma migrate deploy...'
npx prisma migrate deploy

Write-Host 'Running prisma seed...'
npx prisma db seed

Write-Host ''
Write-Host 'Done.'
Write-Host 'DATABASE_URL=postgresql://overbuild:overbuild@localhost:5432/overbuild'
Write-Host 'Default login: admin / admin123'
