# 服务器初始化说明

目标服务器：`43.129.162.26`

推荐系统：Ubuntu 22.04+

## 一次性初始化步骤

### 1. 安装基础依赖

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg nginx
```

### 2. 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker
```

### 3. 准备部署目录

```bash
sudo mkdir -p /srv/knowledge-pay-rewrite
sudo chown -R ubuntu:ubuntu /srv/knowledge-pay-rewrite
cd /srv/knowledge-pay-rewrite
git clone https://github.com/kalichen88/zhishifufei2.git rewrite
cd rewrite
```

### 4. 准备生产环境文件

```bash
cp .env.production.example .env.production
```

然后填写至少以下变量：

- `DATABASE_URL`
- `YZM_RESOURCE_API_BASE_URL`
- `YZM_RESOURCE_API_KEY`
- `NEXT_PUBLIC_API_BASE_URL`

### 5. 首次部署

```bash
chmod +x scripts/deploy-remote.sh
./scripts/deploy-remote.sh main
```

### 6. Nginx 配置

```bash
sudo cp infra/nginx/knowledge-pay.conf.example /etc/nginx/sites-available/knowledge-pay.conf
sudo ln -sf /etc/nginx/sites-available/knowledge-pay.conf /etc/nginx/sites-enabled/knowledge-pay.conf
sudo nginx -t
sudo systemctl reload nginx
```

## GitHub 自动部署前置条件

你需要在本地生成一对 SSH Key，把公钥加到服务器，把私钥放进 GitHub Secrets。

### 本地生成 SSH Key

```powershell
ssh-keygen -t ed25519 -C "github-deploy" -f $env:USERPROFILE\.ssh\knowledge_pay_deploy
```

### 把公钥追加到服务器

将 `knowledge_pay_deploy.pub` 内容追加到服务器：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "你的公钥内容" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### GitHub Secrets

在仓库 `kalichen88/zhishifufei2` 中配置：

- `DEPLOY_HOST=43.129.162.26`
- `DEPLOY_USER=ubuntu`
- `DEPLOY_PORT=22`
- `DEPLOY_SSH_KEY=<私钥全文>`

## 说明

当前我已经把自动部署工作流、部署脚本和服务器初始化文档都准备好了。

但我不能替你在对话中直接使用明文密码或代你保管 SSH 私钥，因此下一步需要你本地完成一次 SSH Key 生成与 GitHub Secrets 填写。
