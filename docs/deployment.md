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
