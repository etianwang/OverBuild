# Local test: npm CI + optional Docker Compose smoke test
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

function Write-Step([string]$Message) {
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-DockerAvailable {
  return [bool](Get-Command docker -ErrorAction SilentlyContinue)
}

Write-Step '1/3 npm CI (lint / typecheck / test / build)'
npm run lint
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
npm run test
npm run test:e2e
npm run build
Write-Host 'PASS: npm CI' -ForegroundColor Green

Write-Step '2/3 Docker check'
if (-not (Test-DockerAvailable)) {
  Write-Host 'SKIP: Docker not found. Install Docker Desktop first.' -ForegroundColor Yellow
  Write-Host '  https://www.docker.com/products/docker-desktop/' -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'npm CI passed. You can run dev servers:' -ForegroundColor Yellow
  Write-Host '  npm run dev:api' -ForegroundColor Yellow
  Write-Host '  npm run dev:web' -ForegroundColor Yellow
  exit 0
}

docker compose version | Out-Host
Write-Step '3/3 Docker Compose build and smoke test'
docker compose config | Out-Null
Write-Host 'PASS: compose config' -ForegroundColor Green

docker compose build
if ($LASTEXITCODE -ne 0) {
  throw 'docker compose build failed'
}
Write-Host 'PASS: docker compose build' -ForegroundColor Green

docker compose up -d
try {
  Write-Host 'Seeding database (first run)...' -ForegroundColor DarkGray
  docker compose exec -T api sh -c 'cd /app && npx prisma db seed' | Out-Host

  $deadline = (Get-Date).AddMinutes(3)
  $healthy = $false
  while ((Get-Date) -lt $deadline) {
    $raw = docker compose ps --format json 2>$null
    $items = @()
    foreach ($line in ($raw -split "`n")) {
      if ($line.Trim()) { $items += ($line | ConvertFrom-Json) }
    }
    $api = $items | Where-Object { $_.Service -eq 'api' } | Select-Object -First 1
    if ($api -and $api.Health -eq 'healthy') {
      $healthy = $true
      break
    }
    Start-Sleep -Seconds 5
  }

  if (-not $healthy) {
    docker compose ps
    docker compose logs api --tail 80
    throw 'API service did not become healthy within 3 minutes'
  }

  $health = Invoke-RestMethod -Uri 'http://localhost:3001/api/v1/health' -TimeoutSec 10
  if ($health.data.status -ne 'ok') {
    throw "Unexpected health response: $($health | ConvertTo-Json -Compress)"
  }
  Write-Host "PASS: API health -> $($health.data.status)" -ForegroundColor Green

  $webStatus = Invoke-WebRequest -Uri 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 15
  if ($webStatus.StatusCode -ne 200) {
    throw "Web /login returned $($webStatus.StatusCode)"
  }
  Write-Host 'PASS: Web /login -> 200' -ForegroundColor Green
  Write-Host ''
  Write-Host 'DONE: Docker local test passed' -ForegroundColor Green
  Write-Host '  Web: http://localhost:3000'
  Write-Host '  API: http://localhost:3001/api/v1/health'
}
finally {
  docker compose down
}
