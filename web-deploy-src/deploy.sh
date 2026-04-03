#!/usr/bin/env bash
set -euo pipefail

# One-command deploy script for server-side update flow.
# Expected upload path:
#   /opt/lexcheck/web-deploy.zip
# Expected app path:
#   /opt/lexcheck/web

BASE_DIR="/opt/lexcheck"
APP_DIR="$BASE_DIR/web"
ZIP_FILE="$BASE_DIR/web-deploy.zip"
BACKUP_DIR="$BASE_DIR/backups"
PM2_NAME="lexcheck-web"

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
