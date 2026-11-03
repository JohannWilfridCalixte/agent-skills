/** D33: run output is stored up to 256 KiB (UTF-8 bytes), keeping the tail. */
export const OUTPUT_TAIL_LIMIT_BYTES = 256 * 1024;

export interface OutputTail {
  readonly tail: string;
  readonly truncated: boolean;
}

const isContinuationByte = (byte: number) => (byte & 0b1100_0000) === 0b1000_0000;

/** Keeps the last `limit` bytes of `output`, never splitting a multi-byte character (the tail may be a few bytes shorter). */
export function outputTail(output: string, limit = OUTPUT_TAIL_LIMIT_BYTES): OutputTail {
  const bytes = new TextEncoder().encode(output);
  if (bytes.length <= limit) return { tail: output, truncated: false };

  let start = bytes.length - limit;
  while (start < bytes.length && isContinuationByte(bytes[start] ?? 0)) start += 1;
  return { tail: new TextDecoder().decode(bytes.subarray(start)), truncated: true };
}
