#!/usr/bin/env bash
# 一键启动全栈 Docker（构建 + 启动 + 迁移 + 种子数据）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "未找到 .env，正在从 .env.example 复制..."
  cp .env.example .env
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

DATA_DIR="${DATA_DIR:-./data}"
mkdir -p "${DATA_DIR}/postgres" "${DATA_DIR}/redis" "${DATA_DIR}/uploads"
echo "==> 数据目录: ${DATA_DIR}"

echo "==> 构建并启动全部服务..."
docker compose up -d --build

echo "==> 等待 API 健康..."
deadline=$((SECONDS + 180))
until curl -sf http://127.0.0.1:3001/api/v1/health >/dev/null 2>&1; do
  if (( SECONDS > deadline )); then
    echo "API 未在预期时间内就绪。"
    docker compose logs api --tail 50
    exit 1
  fi
  sleep 3
done

echo "==> 写入演示数据（migrate 由 api entrypoint 自动执行）..."
docker compose exec -T api sh -c 'cd /app && npx prisma db seed'

echo ""
echo "全栈已启动。"
echo "  数据目录: ${DATA_DIR}"
echo "  Web:      http://localhost:3000"
echo "  API:      http://localhost:3001/api/v1/health"
echo "  Swagger:  http://localhost:3001/api/docs"
echo "  登录:     admin / admin123"
