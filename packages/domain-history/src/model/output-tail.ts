/** D33: run output is stored up to 256 KiB (UTF-8 bytes), keeping the tail. */
export const OUTPUT_TAIL_LIMIT_BYTES = 256 * 1024;

export interface OutputTail {
  readonly tail: string;
  readonly truncated: boolean;
}

const isHighSurrogate = (unit: number) => unit >= 0xd8_00 && unit <= 0xdb_ff;
const isLowSurrogate = (unit: number) => unit >= 0xdc_00 && unit <= 0xdf_ff;

/**
 * Keeps the last `limit` bytes of `output`, never splitting a multi-byte character (the tail may be a few bytes shorter).
 * Pure ES: counts UTF-8 bytes from code units instead of using platform encoders.
 */
export function outputTail(output: string, limit = OUTPUT_TAIL_LIMIT_BYTES): OutputTail {
  const start = tailStart(output, limit);
  return start === 0 ? { tail: output, truncated: false } : { tail: output.slice(start), truncated: true };
}

/** The UTF-16 index where the longest suffix of `text` fitting in `limit` UTF-8 bytes starts, never splitting a character. */
function tailStart(text: string, limit: number) {
  let start = text.length;
  let used = 0;
  while (start > 0) {
    const unit = text.charCodeAt(start - 1);
    const isPair = isLowSurrogate(unit) && start > 1 && isHighSurrogate(text.charCodeAt(start - 2));
    const bytes = isPair ? 4 : utf8Width(unit);
    if (used + bytes > limit) break;
    used += bytes;
    start -= isPair ? 2 : 1;
  }
  return start;
}

/** UTF-8 width of a BMP code unit; a lone surrogate encodes as U+FFFD (3 bytes), like `TextEncoder`. */
function utf8Width(unit: number) {
  if (unit < 0x80) return 1;
  if (unit < 0x8_00) return 2;
  return 3;
}
