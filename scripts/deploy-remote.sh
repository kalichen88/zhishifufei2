#!/usr/bin/env sh

set -eu

BRANCH="${1:-main}"
COMPOSE_FILE="infra/docker/docker-compose.prod.yml"
ENV_FILE=".env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "未找到 $ENV_FILE，请先基于 .env.production.example 创建生产环境配置。" >&2
  exit 1
fi

echo "[deploy] 拉取最新代码分支 $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "[deploy] 构建并重启生产容器"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "[deploy] 部署完成"
