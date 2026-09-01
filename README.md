# 知识付费系统重写工程

## 当前阶段

当前已完成：

- Monorepo 基础骨架
- 前台 `web`
- 后台 `admin`
- API `api`
- 资源接入模块首版
- Prisma 数据模型首版

## 启动前准备

1. 复制 `.env.example` 为 `.env`
2. 复制 `apps/admin/.env.example` 为 `apps/admin/.env.local`
3. 复制 `apps/web/.env.example` 为 `apps/web/.env.local`
4. 启动本地 PostgreSQL：`npm run db:up`
5. 在 `apps/api` 下执行 Prisma 初始化

### 本地云转码 mock

本地联调时不需要真实云转码环境：

1. 先启动 mock：`npm run mock:cloud`（默认 `http://127.0.0.1:9800`，签名校验与正式一致）
2. `rewrite/.env` 中保持：

```text
YZM_RESOURCE_API_BASE=http://127.0.0.1:9800
YZM_RESOURCE_API_KEY=local-dev-key
```

### 支付（彩虹易支付协议）

已实现聚合支付对接（`apps/api/src/modules/payments`）：

- `GET /api/payments/epay/create?orderNo=xxx&type=alipay|wxpay|qqpay` → 返回收银台跳转链接（MD5 签名）
- `GET /api/payments/epay/notify` → 异步回调验签，标记订单支付并发放权益（幂等），应答 `success`
- `GET /api/payments/epay/return` → 支付完成后回跳前台用户中心

本地联调用 mock 网关：`npm run mock:epay`（`http://127.0.0.1:9801`，校验签名后自动回调）。

生产环境在 `.env.production` 配置：

```text
EPAY_API_URL=https://你的易支付网关
EPAY_PID=商户ID
EPAY_KEY=商户密钥
PAY_API_PUBLIC_BASE_URL=https://你的域名/api
PAY_WEB_BASE_URL=https://你的域名
```

## 数据库初始化

推荐顺序：

1. 启动数据库

```bash
npm run db:up
```

2. 执行迁移

```bash
npm run prisma:migrate:dev --workspace=@app/api
```

3. 若只想快速同步结构，也可以使用：

```bash
npm run prisma:push --workspace=@app/api
```

4. 生成 Prisma Client

```bash
npm run prisma:generate --workspace=@app/api
```

PostgreSQL 默认配置：

- host: `127.0.0.1`
- port: `5432`
- database: `knowledge_pay_rewrite`
- user: `postgres`
- password: `postgres`

后台管理端默认 API 地址：

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3002/api`

前台站点默认 API 地址：

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3002/api`

## 当前资源接入模块能力

- `GET /api/media-ingestion/sign-get`
- `POST /api/media-ingestion/sign-post`
- `POST /api/media-ingestion/verify-webhook`
- `POST /api/media-ingestion/preview-sync`
- `POST /api/media-ingestion/persist-sync`
- `POST /api/media-ingestion/sync-remote`
- `POST /api/media-ingestion/renew-plan`
- `POST /api/media-ingestion/renew-remote`
- `GET /api/media-ingestion/assets`
- `POST /api/media-ingestion/webhook`
- `POST /api/media-ingestion/import-csv`
- `POST /api/media-ingestion/playback-authorize`
- `POST /api/media-ingestion/content-config`
- `GET /api/media-ingestion/content-configs`
- `GET /api/media-ingestion/content-catalog`
- `GET /api/media-ingestion/content-detail`
- `POST /api/media-ingestion/grant-membership`
- `POST /api/media-ingestion/grant-purchase`
- `GET /api/media-ingestion/viewer-profile`

## 当前前台能力

- `/content` 内容目录
- `/content/[cloudVid]` 内容详情、下单、模拟支付完成、跳转播放
- `/play` 播放测试与订单测试
- `/me` 用户中心、会员状态、权益与订单查看

## 简化登录态

- 前台通过浏览器本地存储保存当前 `viewerKey`
- `content`、`play`、`me` 页面自动共享同一个 `viewerKey`
- 便于你在验收时跨页面连续测试购买、支付、授权与播放

## 代理分销体系

### 模型与规则

- 两级分销：用户首次下单时通过 `referralCode`（代理邀请码）绑定代理，绑定后不可改绑
- 订单支付成功后按万分比结算：直属代理拿 `commissionRateL1`（默认 30%），其上级拿 `commissionRateL2`（默认 10%），均可在后台调整
- 佣金与余额变更在支付完成事务内完成，依赖 `agentId+orderId+level` 唯一约束保证回调重放幂等
- 提现最低 ￥10：申请时事务内先冻结余额，管理员拒绝时自动退回，通过即完成提现

### 接口

- 管理端（AdminAuthGuard）：`POST /api/agents`、`GET /api/agents`、`PATCH /api/agents/:id`、`POST /api/agents/:id/reset-password`、`GET /api/agents/withdrawals`、`POST /api/agents/withdrawals/review`
- 代理端（AgentAuthGuard，JWT `typ=agent` 与管理端隔离）：`POST /api/agent-auth/login`、`GET /api/agent-portal/profile|stats|commissions|withdrawals`、`POST /api/agent-portal/withdrawals`

### 页面

- Web：`/agent/login` 代理登录、`/agent/portal` 代理中心（余额/推广数/分润明细/提现）
- Web：内容页支持推广链接 `?aid=邀请码`，首次访问后长期缓存归因
- Admin：`/agents` 代理管理（创建/改比例/停启用/提现审核）

## 生产部署建议

推荐先按 Docker Compose 方式部署，便于本地与服务器保持一致。

### 方式一：直接在服务器部署 Docker Compose

1. 复制 `rewrite/.env.production.example` 为 `rewrite/.env.production`
2. 按实际服务器地址、数据库密码、云转码 API 参数填写环境变量
3. 在服务器执行：

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production up -d
```

说明：

- `web` 默认端口 `3000`
- `admin` 默认端口 `3001`
- `api` 默认端口 `3002`
- `postgres` 为容器内服务

### 生产镜像与部署要点（本地已验证）

- 三个服务镜像（`Dockerfile.api|web|admin`）均已完成构建，并通过 compose 冒烟测试
  （health 检查、管理端登录、CSV 入库、下单支付、代理分润全部通过）
- API 容器启动时自动执行 `prisma migrate deploy`，生产禁止使用 `db push`
- Prisma 在 alpine 镜像中需要 `apk add openssl`；国内网络建议设置
  `PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma`（API Dockerfile 已内置）
- `NEXT_PUBLIC_API_BASE_URL` 在 Next.js 中是构建期常量，已通过 compose build args 注入，
  修改公网 API 地址后需要重新构建 web/admin 镜像
- compose 中已配置 `image: knowledge-pay-*:local` 本地镜像名，`deploy-remote.sh` 会在服务器
  上以 `--build` 方式重新构建，首次部署无需手动推送镜像

### 方式二：GitHub 推送到服务器

适合后续频繁发版，建议这样做：

1. 将 `rewrite/` 推送到 GitHub 仓库
2. 服务器仅保留部署目录和 `.env.production`
3. 每次发布时在服务器执行：

```bash
git pull
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production up -d --build
```

后续可以再补：

- GitHub Actions 通过 SSH 自动拉取并重启容器
- Nginx 反向代理 `3000/3001/3002`
- 域名与 HTTPS

### 部署脚本

仓库中已提供：

- `scripts/deploy-remote.ps1`
- `scripts/deploy-remote.sh`
- `.github/workflows/deploy.yml`
- `infra/nginx/knowledge-pay.conf.example`
- `docs/deployment.md`

#### PowerShell 手动部署

适合你先手动调试验收，再上线：

```powershell
./scripts/deploy-remote.ps1 -Branch main
```

脚本会执行：

- 拉取指定分支
- 安装依赖
- 构建 API / Admin / Web
- 使用 `docker compose` 重建并启动生产容器

#### Linux 手动部署

```bash
chmod +x scripts/deploy-remote.sh
./scripts/deploy-remote.sh main
```

更适合标准 Linux 服务器。

#### GitHub Actions 自动部署

如果后续要做“推送即发布”，在 GitHub 仓库配置以下 secrets：

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PORT`

然后在服务器准备：

- 项目目录，例如 `/srv/knowledge-pay-rewrite/rewrite`
- `.env.production`
- Docker / Docker Compose

每次推送 `main` 分支后，就会自动 SSH 到服务器执行拉取和重启。

#### Nginx 反向代理

示例文件：

- `infra/nginx/knowledge-pay.conf.example`

默认路由设计：

- `/` -> `web:3000`
- `/admin/` -> `admin:3001`
- `/api/` -> `api:3002/api/`

如果你后续要接 HTTPS，推荐配合：

- Nginx + Certbot
- 或云厂商负载均衡 / CDN 证书

## 生产编排优化

目前已改为更适合正式服务器的镜像构建方式：

- API 使用 `Dockerfile.api`
- Web 使用 `Dockerfile.web`
- Admin 使用 `Dockerfile.admin`

相比直接在容器启动时 `npm install`：

- 启动更快
- 结构更稳定
- 更适合 GitHub 推送后重建镜像
- 更符合生产部署习惯

### 当前限制

- 现在这套生产编排更适合测试验收与第一版上线准备
- 真实支付通道、对象存储/CDN、Nginx、进程监控、备份策略还可以继续补强

## Prisma 目标表

- `CloudMediaAsset`
- `CloudSyncCursor`
- `CloudWebhookEvent`
- `CsvImportBatch`
- `ContentItem`
- `ViewerAccount`
- `ViewerMembership`
- `PlaybackEntitlement`

## 最小播放权限测试流程

1. 在后台资源中心同步资源，确保 `cloudVid` 已入库
2. 在后台资源中心保存内容访问配置：
   - `FREE`
   - `VIP`
   - `PAID`
3. 如需测试 VIP：
   - 发放一个 `viewerKey`
   - 给该 `viewerKey` 发放 VIP 授权
4. 如需测试已购：
   - 发放一个 `viewerKey`
   - 给该 `viewerKey` 发放购买授权
5. 打开前台播放测试页：

```text
/play?vid=<cloudVid>
```

6. 在页面中填写对应的 `viewerKey` 并请求播放授权

## 下一步

- 接入真实云转码资源 API
- 接入真实彩虹易支付商户参数
- 配置生产域名与 HTTPS
- 配置数据库定时备份与基础监控

## 线上部署记录

生产环境已按 Docker Compose + Nginx 部署：

- API：宿主机 `3002`，推荐通过 `80/api/` 访问
- Web：宿主机 `3000`，推荐通过 `80` 访问
- Admin：宿主机 `3001`，推荐通过 `8081` 访问
- PostgreSQL：容器内网运行，数据卷持久化

线上验收已覆盖 API 健康、Web/Admin 页面、后台登录、CSV 入库、内容配置、代理创建/登录、PAID 内容下单与支付完成、一级分润、提现冻结/拒绝退款。生产凭证与外部服务商参数只保存在服务器 `.env.production` 中，不要提交到仓库。

更多服务器运维命令见 `docs/deployment.md`。
