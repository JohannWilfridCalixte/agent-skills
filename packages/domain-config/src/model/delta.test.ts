import { describe, expect, it } from 'vitest';

import { parseConfigFile } from './config-file.js';
import { BUILT_IN_PROFILES, DEFAULT_REVIEWERS } from './defaults.js';
import { delta } from './delta.js';

const contentOf = (edited: unknown) => {
  const result = delta(edited);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
};

describe('delta (AC5, AC6)', () => {
  it('drops every value equal to its default, even one the file already had', () => {
    const { content, text } = contentOf({
      commitWork: false,
      knowledge: { root: 'docs' },
      limits: { 'babysit.rounds': 5, 'review.iterations': 4 },
      output: '.agentic/work',
      profiles: [...BUILT_IN_PROFILES],
      reviewers: [...DEFAULT_REVIEWERS],
      selectedProfiles: [],
      steps: { claude: { explore: { effort: 'medium', model: 'sonnet' }, implement: { effort: 'medium', harness: 'claude', model: 'opus' } } },
      worktrees: '../{repo}-worktrees',
    });

    expect(content).toEqual({ limits: { 'review.iterations': 4 }, steps: { claude: { implement: { model: 'opus' } } } });
    expect(text).toBe('{\n  "steps": {\n    "claude": {\n      "implement": {\n        "model": "opus"\n      }\n    }\n  },\n  "limits": {\n    "review.iterations": 4\n  }\n}\n');
  });

  it('writes an all-default config as an empty object', () => {
    expect(contentOf({ output: '.agentic/work' }).text).toBe('{}\n');
  });

  it('keeps unknown keys untouched, top-level and nested, and flags them', () => {
    const { content, unknownKeys } = contentOf({ knowledge: { extra: [1], root: 'docs' }, output: 'out', review: { fix: true } });

    expect(content).toEqual({ knowledge: { extra: [1] }, output: 'out', review: { fix: true } });
    expect(unknownKeys).toEqual(['knowledge.extra', 'review']);
  });

  it('writes fields in documented order, unknown keys last', () => {
    expect(Object.keys(contentOf({ output: 'o', review: {}, worktrees: 'w' }).content)).toEqual(['output', 'worktrees', 'review']);
  });

  it('produces content that parses back to the same values', () => {
    const { content } = contentOf({ commitWork: true, steps: { codex: { grill: { effort: 'low', harness: 'claude' } } } });

    expect(parseConfigFile(content)).toMatchObject({ ok: true, value: { values: { commitWork: true, steps: { codex: { grill: { effort: 'low', harness: 'claude' } } } } } });
  });

  it('blocks with field-level issues (AC7)', () => {
    const result = delta({ limits: { 'review.iterations': 'x' }, steps: { claude: { implement: { effort: 1 } }, vim: {} } });

    expect(!result.ok && result.error.map((issue) => issue.path)).toEqual(['limits.review.iterations', 'steps.claude.implement.effort', 'steps.vim']);
  });
});
