/**
 * 生成 lib/generated/app-version.json：构建号取当前 git 提交数，无需手动维护。
 * 在 npm run dev / npm run build 前自动执行（package.json 的 predev / prebuild）。
 *
 * 用法（在 web 目录）：node scripts/generate-app-version.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");
const OUT_DIR = join(WEB_ROOT, "lib", "generated");
const OUT_FILE = join(OUT_DIR, "app-version.json");

function run(cmd, fallback) {
  try {
    return execSync(cmd, { cwd: WEB_ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return fallback;
  }
}

const commitCount = Number(run("git rev-list --count HEAD", "0")) || 0;
const commitSha = run("git rev-parse --short HEAD", "unknown");

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_FILE,
  JSON.stringify({ commitCount, commitSha, generatedAt: new Date().toISOString() }, null, 2) + "\n"
);
