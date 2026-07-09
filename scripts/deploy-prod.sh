#!/usr/bin/env bash
# OverBuild 生产部署（Ubuntu + 宝塔面板 + Docker Compose）
# 宝塔已自带 Nginx（80/443），勿使用 docker compose --profile prod（会占用 80 端口冲突）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "未找到 .env，请复制 .env.docker.example 并修改后重试。"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

DATA_DIR="${DATA_DIR:-/www/wwwroot/overbuild/data}"
mkdir -p "${DATA_DIR}/postgres" "${DATA_DIR}/redis" "${DATA_DIR}/uploads"
echo "==> 数据目录: ${DATA_DIR}"

echo "==> 构建并启动 Docker 服务（Web:3000 API:3001，仅本机访问）..."
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

echo "==> 写入演示数据（幂等）..."
docker compose exec -T api sh -c 'cd /app && npx prisma db seed' || true

echo ""
echo "Docker 服务已启动。请在宝塔面板完成反向代理："
echo "  1. 网站 → 添加站点（你的域名）"
echo "  2. 网站 → 设置 → SSL → Let's Encrypt 申请证书"
echo "  3. 网站 → 配置文件 → 粘贴 deploy/baota/nginx-site.conf 内容"
echo "  4. 安全 → 防火墙：仅开放 80、443、22，关闭 3000/3001/5432/6379"
echo ""
echo "  本机健康检查: curl http://127.0.0.1:3001/api/v1/health"
echo "  上线后访问:   https://你的域名"
