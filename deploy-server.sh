#!/usr/bin/env bash
set -euo pipefail

# 必须放在 /opt/lexcheck/deploy.sh（不要放在 web/ 里执行，否则会删掉脚本自身）。
# Expected upload path:
#   /opt/lexcheck/web-deploy.zip
# Expected app path:
#   /opt/lexcheck/web

BASE_DIR="/opt/lexcheck"
APP_DIR="$BASE_DIR/web"
ZIP_FILE="$BASE_DIR/web-deploy.zip"
BACKUP_DIR="$BASE_DIR/backups"
PM2_NAME="lexcheck-web"

# 若 SSH 会话仍停留在已被删的 $APP_DIR 上，getcwd 会报错；先切到有效目录
cd "$BASE_DIR" 2>/dev/null || cd /

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$SCRIPT_DIR" == "$APP_DIR" ]]; then
  echo "ERROR: 不能把 deploy 脚本放在 $APP_DIR（部署会清空该目录）。请放在 $BASE_DIR/deploy.sh。"
  exit 1
fi

echo "==> Starting deploy at $(date '+%F %T')"

if [[ ! -f "$ZIP_FILE" ]]; then
  echo "ERROR: $ZIP_FILE not found. Please upload web-deploy.zip first."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

if [[ -d "$APP_DIR" ]]; then
  TS="$(date +%F_%H%M%S)"
  echo "==> Backing up current app to $BACKUP_DIR/web_$TS"
  cp -a "$APP_DIR" "$BACKUP_DIR/web_$TS"
fi

echo "==> Preparing app directory"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"

echo "==> Unzipping package"
# Windows zip 常含反斜杠路径，unzip 可能以 1 退出（仅警告）；set -e 会误判为失败
set +e
unzip -oq "$ZIP_FILE" -d "$APP_DIR"
UNZIP_EC=$?
set -e
if [[ "$UNZIP_EC" -ne 0 && "$UNZIP_EC" -ne 1 ]]; then
  echo "ERROR: unzip failed with exit code $UNZIP_EC"
  exit "$UNZIP_EC"
fi

cd "$APP_DIR"

echo "==> Environment file (zip 通常不含 .env，从 $BASE_DIR 注入)"
if [[ -f "$BASE_DIR/.env.production" ]]; then
  cp "$BASE_DIR/.env.production" "$APP_DIR/.env"
  echo "    Copied .env.production -> web/.env"
elif [[ -f "$BASE_DIR/.env" ]]; then
  cp "$BASE_DIR/.env" "$APP_DIR/.env"
  echo "    Copied .env -> web/.env"
fi
if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "ERROR: $APP_DIR/.env 缺失，Prisma 需要 DATABASE_URL。"
  echo "在服务器执行: sudo nano $BASE_DIR/.env.production"
  echo "写入至少一行 DATABASE_URL=postgresql://... 以及 DEEPSEEK_API_KEY 等，保存后重新 deploy。"
  exit 1
fi

echo "==> Installing dependencies"
npm install

echo "==> Syncing Prisma schema"
npx prisma db push

echo "==> Building Next.js app"
npm run build

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  echo "==> Restarting PM2 app: $PM2_NAME"
  pm2 restart "$PM2_NAME"
else
  echo "==> Starting PM2 app: $PM2_NAME"
  pm2 start npm --name "$PM2_NAME" -- start -- -p 3000
fi

pm2 save

echo "==> Deploy finished successfully"
pm2 status
