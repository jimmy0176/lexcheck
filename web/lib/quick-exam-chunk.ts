/**
 * 将长文本按自然边界切分为多块，单块不超过 maxChars。
 */
export function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const t = text.replace(/\r\n/g, "\n");
  if (t.length <= maxChars) return t ? [t] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < t.length) {
    const endLimit = Math.min(start + maxChars, t.length);
    if (endLimit >= t.length) {
      chunks.push(t.slice(start));
      break;
    }
    const window = t.slice(start, endLimit);
    let cut = findBestCutIndex(window, maxChars);
    if (cut <= 0) cut = Math.min(maxChars, window.length);
    const piece = t.slice(start, start + cut).trimEnd();
    if (piece.length > 0) chunks.push(piece);
    start += cut;
    while (start < t.length && (t[start] === "\n" || t[start] === " ")) start++;
  }
  return chunks;
}

function findBestCutIndex(window: string, maxChars: number): number {
  const hard = maxChars;
  const slice = window.slice(0, hard);
  const tripleNl = slice.lastIndexOf("\n\n\n");
  if (tripleNl > hard * 0.35) return tripleNl + 3;
  const doubleNl = slice.lastIndexOf("\n\n");
  if (doubleNl > hard * 0.35) return doubleNl + 2;
  const singleNl = slice.lastIndexOf("\n");
  if (singleNl > hard * 0.45) return singleNl + 1;
  const markers = ["## ", "# ", "第", "一、", "二、", "三、", "四、", "五、"];
  let best = -1;
  for (const m of markers) {
    const idx = slice.lastIndexOf(m);
    if (idx > hard * 0.3 && idx > best) best = idx;
  }
  if (best > 0) return best;
  return hard;
}
