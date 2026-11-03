export interface DiffLine {
  readonly kind: 'added' | 'context' | 'removed';
  readonly text: string;
}

const splitLines = (text: null | string) => {
  if (text === null || text === '') return [];
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
};

/**
 * Line diff of the file on disk (`null` when missing) against the proposed text, every line kept
 * (context included) so the viewer can fold it. LCS-based and deterministic: on ties removals come first.
 */
export function lineDiff(current: null | string, proposed: string): readonly DiffLine[] {
  const before = splitLines(current);
  const after = splitLines(proposed);
  const rows = before.length + 1;
  const cols = after.length + 1;
  const lcs = new Uint32Array(rows * cols);
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lcs[i * cols + j] = before[i] === after[j] ? (lcs[(i + 1) * cols + j + 1] ?? 0) + 1 : Math.max(lcs[(i + 1) * cols + j] ?? 0, lcs[i * cols + j + 1] ?? 0);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    const left = before[i];
    const right = after[j];
    if (left !== undefined && left === right) {
      lines.push({ kind: 'context', text: left });
      i++;
      j++;
    } else if (left !== undefined && (right === undefined || (lcs[(i + 1) * cols + j] ?? 0) >= (lcs[i * cols + j + 1] ?? 0))) {
      lines.push({ kind: 'removed', text: left });
      i++;
    } else if (right !== undefined) {
      lines.push({ kind: 'added', text: right });
      j++;
    }
  }
  return lines;
}
