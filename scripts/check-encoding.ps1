# 检查 PostgreSQL 数据库是否为 UTF-8，并列出可能损坏的文本记录
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Find-Psql {
  $candidates = @(
    'C:\Program Files\PostgreSQL\17\bin\psql.exe',
    'C:\Program Files\PostgreSQL\16\bin\psql.exe',
    'C:\Program Files\PostgreSQL\15\bin\psql.exe',
    'psql'
  )
  foreach ($path in $candidates) {
    if (Get-Command $path -ErrorAction SilentlyContinue) {
      return $path
    }
  }
  throw '未找到 psql，请确认 PostgreSQL 已安装并在 PATH 中。'
}

$psql = Find-Psql
$env:PGPASSWORD = $env:PGPASSWORD ?? 'overbuild'

Write-Host '=== 数据库编码 ===' -ForegroundColor Cyan
& $psql -U overbuild -h 127.0.0.1 -d overbuild -c @"
SELECT datname AS database,
       pg_encoding_to_char(encoding) AS encoding
FROM pg_database
WHERE datname = 'overbuild';
"@

Write-Host ''
Write-Host '=== 可能损坏的项目名称（含连续问号）===' -ForegroundColor Cyan
& $psql -U overbuild -h 127.0.0.1 -d overbuild -c @"
SELECT code, name, status
FROM projects
WHERE deleted_at IS NULL
  AND name ~ '\?{2,}'
ORDER BY created_at;
"@

Write-Host ''
Write-Host '若 encoding 不是 UTF8，请重建数据库后执行：' -ForegroundColor Yellow
Write-Host '  npm run db:setup' -ForegroundColor Yellow
Write-Host '若仅有少量问号名称，可执行：' -ForegroundColor Yellow
Write-Host '  npm run db:fix-text' -ForegroundColor Yellow
Write-Host '  npm run db:seed' -ForegroundColor Yellow
