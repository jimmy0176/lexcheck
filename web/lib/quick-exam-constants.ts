/** 三方速查（preliminary）合计正文不超过此值且文件数不超过 SYNC_MAX_FILES 时，同步单阶段完成。 */
export const QUICK_EXAM_SYNC_MAX_TOTAL_CHARS = Number(
  process.env.QUICK_EXAM_SYNC_MAX_TOTAL_CHARS ?? 48000
);

export const QUICK_EXAM_SYNC_MAX_FILES = Number(process.env.QUICK_EXAM_SYNC_MAX_FILES ?? 12);

/** 单块目标字符数（自然边界切分后再硬切）。 */
export const QUICK_EXAM_CHUNK_TARGET_CHARS = Number(
  process.env.QUICK_EXAM_CHUNK_TARGET_CHARS ?? 7000
);

/** 异步续跑时每次请求最多完成的「分块摘要」LLM 调用次数，避免单次 HTTP 超时。 */
export const QUICK_EXAM_CHUNKS_PER_STEP = Number(process.env.QUICK_EXAM_CHUNKS_PER_STEP ?? 2);

export const QUICK_EXAM_QUESTIONNAIRE_MAX_CHARS = 24000;
