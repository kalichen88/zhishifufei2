param(
  [string]$Branch = "main",
  [string]$ComposeFile = "infra/docker/docker-compose.prod.yml",
  [string]$EnvFile = ".env.production"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
  throw "未找到 $EnvFile，请先基于 .env.production.example 创建生产环境配置。"
}

Write-Host "[deploy] 拉取最新代码分支 $Branch"
git fetch origin $Branch
git checkout $Branch
git pull origin $Branch

Write-Host "[deploy] 使用 npm.cmd 安装依赖"
& npm.cmd install
if ($LASTEXITCODE -ne 0) {
  throw "npm install 执行失败"
}

Write-Host "[deploy] 构建 API/Admin/Web"
& npm.cmd run build --workspace=@app/api
if ($LASTEXITCODE -ne 0) {
  throw "API 构建失败"
}

& npm.cmd run build --workspace=@app/admin
if ($LASTEXITCODE -ne 0) {
  throw "Admin 构建失败"
}

& npm.cmd run build --workspace=@app/web
if ($LASTEXITCODE -ne 0) {
  throw "Web 构建失败"
}

Write-Host "[deploy] 启动生产容器"
docker compose -f $ComposeFile --env-file $EnvFile up -d --build
if ($LASTEXITCODE -ne 0) {
  throw "Docker Compose 启动失败"
}

Write-Host "[deploy] 部署完成"
