# Project module local acceptance (API)
$ErrorActionPreference = "Stop"
$base = "http://localhost:3001/api/v1"

$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$token = $login.data.accessToken
$adminId = $login.data.user.id
$h = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

$code = "PRJ-ACPT-" + (Get-Date -Format "HHmmss")
$body = @{ code = $code; name = "Acceptance Project"; status = "planning"; managerId = $adminId; location = "Douala" } | ConvertTo-Json
$p = Invoke-RestMethod -Method Post -Uri "$base/projects" -Headers $h -Body $body
$projectId = $p.data.id
Write-Output "PASS: 1. create $code -> $projectId"

try {
  Invoke-RestMethod -Method Post -Uri "$base/projects" -Headers $h -Body $body | Out-Null
  Write-Output "FAIL: 2. unique code"
} catch {
  Write-Output "PASS: 2. unique code"
}

$u = Invoke-RestMethod -Method Put -Uri "$base/projects/$projectId" -Headers $h -Body (@{ name = "Acceptance-Edited"; status = "active" } | ConvertTo-Json)
if ($u.data.status -eq "active") { Write-Output "PASS: 3. update" } else { Write-Output "FAIL: 3. update" }

$list = Invoke-RestMethod -Uri "$base/projects?q=$code" -Headers $h
Write-Output "PASS: 4. search total=$($list.data.total)"

$detail = Invoke-RestMethod -Uri "$base/projects/$projectId" -Headers $h
Write-Output "PASS: 5. detail $($detail.data.name)"

$z = Invoke-RestMethod -Method Post -Uri "$base/projects/$projectId/zones" -Headers $h -Body '{"name":"Zone A"}'
$zoneId = $z.data.id
Invoke-RestMethod -Method Put -Uri "$base/projects/$projectId/zones/$zoneId" -Headers $h -Body '{"name":"Zone A-Edit"}' | Out-Null
$zones = Invoke-RestMethod -Uri "$base/projects/$projectId/zones" -Headers $h
Write-Output "PASS: 6. zones count=$($zones.data.Count)"

$m = Invoke-RestMethod -Method Post -Uri "$base/projects/$projectId/members" -Headers $h -Body (@{ userId = $adminId; role = "engineer" } | ConvertTo-Json)
Write-Output "PASS: 7. member role=$($m.data.role)"

$ms = Invoke-RestMethod -Method Post -Uri "$base/projects/$projectId/milestones" -Headers $h -Body '{"name":"Foundation","dueDate":"2026-12-31"}'
$msId = $ms.data.id
Invoke-RestMethod -Method Put -Uri "$base/projects/$projectId/milestones/$msId" -Headers $h -Body '{"status":"completed"}' | Out-Null
Write-Output "PASS: 8. milestone completed"

Invoke-RestMethod -Uri "$base/projects/$projectId/profit" -Headers $h | Out-Null
Invoke-RestMethod -Uri "$base/projects/$projectId/cost-analysis" -Headers $h | Out-Null
Invoke-RestMethod -Uri "$base/projects/$projectId/summary" -Headers $h | Out-Null
Write-Output "PASS: 9. profit/cost/summary"

$exportRes = Invoke-WebRequest -Uri "$base/projects/export?q=$code" -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 15 -UseBasicParsing
Write-Output "PASS: 10. CSV export bytes=$($exportRes.RawContentLength)"

$audit = Invoke-RestMethod -Uri "$base/audit-logs?module=project&page=1&pageSize=10" -Headers $h
Write-Output "PASS: 11. audit total=$($audit.data.total)"

try {
  Invoke-RestMethod -Uri "$base/projects" -TimeoutSec 5 | Out-Null
  Write-Output "FAIL: 12. 401"
} catch {
  Write-Output "PASS: 12. 401 unauthenticated"
}

Invoke-RestMethod -Method Delete -Uri "$base/projects/$projectId" -Headers $h | Out-Null
try {
  Invoke-RestMethod -Uri "$base/projects/$projectId" -Headers $h -TimeoutSec 5 | Out-Null
  Write-Output "FAIL: 13. soft delete"
} catch {
  Write-Output "PASS: 13. soft delete"
}

Write-Output "DONE projectId=$projectId"
