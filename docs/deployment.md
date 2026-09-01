# 部署说明

## 推荐方式

当前推荐使用以下组合：

- GitHub 作为代码源
- 服务器通过 `git pull` 获取代码
- Docker Compose 统一拉起 `postgres / api / admin / web`
- Nginx 做反向代理与 HTTPS

## 生产部署文件

- `Dockerfile.api`
- `Dockerfile.admin`
- `Dockerfile.web`
- `infra/docker/docker-compose.prod.yml`
- `infra/nginx/knowledge-pay.conf.example`
- `scripts/deploy-remote.sh`
- `scripts/deploy-remote.ps1`

## 环境变量

在服务器根目录准备 `.env.production`，可参考 `.env.production.example`。

关键变量：

- `DATABASE_URL`
- `YZM_RESOURCE_API_BASE_URL`
- `YZM_RESOURCE_API_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

## Linux 服务器手动部署

```bash
chmod +x scripts/deploy-remote.sh
./scripts/deploy-remote.sh main
```

## Windows 服务器手动部署

```powershell
./scripts/deploy-remote.ps1 -Branch main
```

## GitHub 自动部署

GitHub Actions 已提供模板：`.github/workflows/deploy.yml`

你需要在仓库中配置：

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PORT`

## Nginx 建议

建议：

- 主站绑定 `/`
- 后台绑定 `/admin/`
- API 绑定 `/api/`

配置示例见：`infra/nginx/knowledge-pay.conf.example`

## 当前说明

当前这套方案已经适合测试验收和第一版上线准备。

后续还可继续增强：

- HTTPS 自动签发
- 生产数据库备份
- 监控与告警
- 灰度发布

## 已完成的线上部署记录

2026-09-01 已在 Ubuntu 服务器完成第一版部署：

- 代码来源：GitHub `main` 分支
- 运行方式：Docker Compose 生产编排
- 数据库：PostgreSQL 16 容器，数据卷持久化
- 服务端口：前台 `80`，后台 `8081`，API 通过 `80/api/` 访问
- Nginx：宿主机反向代理，配置位于 `/etc/nginx/sites-enabled/`
- 生产配置：服务器项目根目录 `.env.production`，不要提交到 Git
- 服务器已启用约 2G swap，并写入 `/etc/fstab`

已通过线上验收：

- API 健康检查：`/api/health`
- 前台首页、后台登录页
- 后台登录、CSV 批量入库、内容配置
- 创建代理、代理登录
- PAID 内容下单、支付完成、购买授权
- 一级代理分润金额正确
- 提现申请、余额冻结、管理员拒绝、余额退回

### 服务器更新命令

```bash
cd /srv/knowledge-pay-rewrite/rewrite
git pull origin main
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production up -d --build api
```

只更新 API 时可以按上面的命令重建 `api`；如果 Web、Admin 的构建参数或依赖也变了，再把服务名改成 `web admin`，或使用 `--build` 重建全部服务。
