/**
 * 从仓库根目录 `_dd_template_extract/`（由「尽调报告_14个MD模板_含中间JSON层设计.zip」解压）生成
 * `web/lib/dd-segment-default-templates.json`
 *
 * 用法（在 web 目录）：node scripts/build-dd-default-templates.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");
const REPO_ROOT = join(__dirname, "..", "..");
const EXTRACT_DIR = join(REPO_ROOT, "_dd_template_extract");
const OUT_FILE = join(WEB_ROOT, "lib", "dd-segment-default-templates.json");

const PROMPT_HEADER = /^#\s*Prompt（提示词）\s*\r?\n/;
const OUTPUT_HEADER = /^#\s*Output Template（输出模板）\s*\r?\n/m;

function splitOutputByH2(outputBlock) {
  const text = outputBlock.trim();
  if (!text) return [{ title: "全文", body: "" }];
  const indices = [];
  const re = /^## (.+)$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    indices.push({ title: m[1].trim(), index: m.index });
  }
  if (indices.length === 0) return [{ title: "全文", body: text }];
  const blocks = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].index;
    const end = i + 1 < indices.length ? indices[i + 1].index : text.length;
    const block = text.slice(start, end).trim();
    const nl = block.indexOf("\n");
    const body = nl === -1 ? "" : block.slice(nl + 1).trim();
    blocks.push({ title: indices[i].title, body });
  }
  return blocks;
}

function parseMd(content) {
  const normalized = content.replace(/^\uFEFF/, "");
  const om = normalized.match(OUTPUT_HEADER);
  if (!om || om.index === undefined) {
    throw new Error("缺少 # Output Template（输出模板） 区块");
  }
  const before = normalized.slice(0, om.index);
  const after = normalized.slice(om.index + om[0].length);
  let prompt = before.replace(PROMPT_HEADER, "").trim();
  if (prompt.startsWith("#")) prompt = prompt.replace(/^#\s+[^\n]+\n?/, "").trim();
  const outputFull = after.trim();
  const outputSubsections = splitOutputByH2(outputFull);
  return { prompt, outputFull, outputSubsections };
}

function main() {
  if (!existsSync(EXTRACT_DIR)) {
    console.error("未找到解压目录:", EXTRACT_DIR);
    console.error("请先将 zip 解压到仓库根目录 _dd_template_extract/");
    process.exit(1);
  }
  const names = readdirSync(EXTRACT_DIR).filter((f) => /^\d{2}_.*\.md$/i.test(f));
  names.sort();
  const byKey = {};
  for (const name of names) {
    const mm = name.match(/^(\d{2})_/);
    if (!mm) continue;
    const num = mm[1];
    const n = parseInt(num, 10);
    if (n < 1 || n > 14) continue;
    const sectionKey = `dd_${num.toString().padStart(2, "0")}`;
    const raw = readFileSync(join(EXTRACT_DIR, name), "utf8");
    try {
      byKey[sectionKey] = parseMd(raw);
    } catch (e) {
      console.error(sectionKey, name, e.message);
      process.exit(1);
    }
  }
  const keys = Object.keys(byKey).sort();
  if (keys.length !== 14) {
    console.error("期望 14 个分部，实际:", keys.length, keys);
    process.exit(1);
  }
  writeFileSync(OUT_FILE, JSON.stringify(byKey, null, 2), "utf8");
  console.log("Wrote", OUT_FILE, keys.length, "sections");
}

main();
