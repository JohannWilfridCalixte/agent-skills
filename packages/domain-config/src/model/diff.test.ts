import { describe, expect, it } from 'vitest';

import { lineDiff } from './diff.js';

describe('lineDiff', () => {
  it('marks every line added when the file is missing', () => {
    expect(lineDiff(null, '{\n}\n')).toEqual([
      { kind: 'added', text: '{' },
      { kind: 'added', text: '}' },
    ]);
  });

  it('keeps shared lines as context and lists removals before additions', () => {
    expect(lineDiff('{\n  "a": 1\n}\n', '{\n  "a": 2,\n  "b": 3\n}\n')).toEqual([
      { kind: 'context', text: '{' },
      { kind: 'removed', text: '  "a": 1' },
      { kind: 'added', text: '  "a": 2,' },
      { kind: 'added', text: '  "b": 3' },
      { kind: 'context', text: '}' },
    ]);
  });

  it('is all context for identical text', () => {
    expect(lineDiff('x\ny\n', 'x\ny\n').every((line) => line.kind === 'context')).toBe(true);
  });
});
