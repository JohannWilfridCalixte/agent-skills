import { describe, expect, it } from 'vitest';

import { parseResults } from './parse-results.js';

const SKILLS = [
  { name: 'grilling', ref: 'aaa', source: 'mattpocock/skills' },
  { name: 'tdd', ref: 'aaa', source: 'mattpocock/skills' },
  { name: 'ponytail', ref: 'bbb', source: 'DietrichGebert/ponytail' },
] as const;

/** Real `node scripts/vendor-skills.mjs verify` output shape (trimmed), with one failure. */
const VERIFY_OUTPUT = ['ok grilling', 'FAIL tdd: hash mismatch', 'FAIL ponytail: not pinned, run update ponytail'];

/** `check` output shape from the script: up-to-date sources list no skills. */
const CHECK_OUTPUT = [
  'mattpocock/skills: HEAD 1234567',
  '  grilling: unchanged',
  '  tdd: changed https://github.com/mattpocock/skills/compare/aaa...1234567',
  'DietrichGebert/ponytail: up to date (bbbbbbb)',
];

describe('parseResults', () => {
  it('reads verify ok and FAIL lines per skill', () => {
    expect(parseResults(VERIFY_OUTPUT, SKILLS)).toEqual([
      { detail: '', name: 'grilling', status: 'ok' },
      { detail: 'hash mismatch', name: 'tdd', status: 'drift' },
      { detail: 'not pinned, run update ponytail', name: 'ponytail', status: 'drift' },
    ]);
  });

  it('reads check lines, expanding an up-to-date source to its skills', () => {
    expect(parseResults(CHECK_OUTPUT, SKILLS)).toEqual([
      { detail: 'unchanged', name: 'grilling', status: 'ok' },
      { detail: 'changed https://github.com/mattpocock/skills/compare/aaa...1234567', name: 'tdd', status: 'drift' },
      { detail: 'up to date (bbbbbbb)', name: 'ponytail', status: 'ok' },
    ]);
  });

  it('marks missing upstream as an error', () => {
    expect(parseResults(['mattpocock/skills: HEAD 1234567', '  tdd: missing upstream'], SKILLS)).toContainEqual({ detail: 'missing upstream', name: 'tdd', status: 'error' });
  });

  it('gives every unreported skill the script error when it aborted', () => {
    const results = parseResults(['ok grilling', 'error: cannot resolve HEAD of mattpocock/skills'], SKILLS);

    expect(results).toEqual([
      { detail: '', name: 'grilling', status: 'ok' },
      { detail: 'cannot resolve HEAD of mattpocock/skills', name: 'tdd', status: 'error' },
      { detail: 'cannot resolve HEAD of mattpocock/skills', name: 'ponytail', status: 'error' },
    ]);
  });

  it('ignores unrelated lines and returns nothing for empty output', () => {
    expect(parseResults(['warning: no LICENSE found for x', 'random noise'], SKILLS)).toEqual([]);
    expect(parseResults([], SKILLS)).toEqual([]);
  });
});
