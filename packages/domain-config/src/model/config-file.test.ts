import { describe, expect, it } from 'vitest';

import { parseConfigFile } from './config-file.js';

describe('parseConfigFile', () => {
  it('reads every documented field', () => {
    const raw = {
      commitWork: true,
      knowledge: { root: 'kb' },
      limits: { 'review.iterations': 4 },
      output: 'work',
      profiles: [{ detect: ['src/domain'], name: 'backend', skills: ['agentic-clean-architecture'] }],
      reviewers: ['code-review'],
      selectedProfiles: ['backend'],
      steps: { claude: { 'review.super-review': { effort: 'high', harness: 'codex', model: 'gpt-6.1-sol' } } },
      worktrees: '../wt',
    };

    const parsed = parseConfigFile(raw);

    expect(parsed).toEqual({ ok: true, value: { raw, unknownKeys: [], values: raw } });
  });

  it('keeps unknown keys in raw and flags them by dotted path (AC6)', () => {
    const raw = { knowledge: { extra: 1 }, review: { fix: true }, steps: { claude: { grill: { temperature: 1 } } } };

    const parsed = parseConfigFile(raw);

    expect(parsed.ok && parsed.value.raw).toBe(raw);
    expect(parsed.ok && parsed.value.unknownKeys).toEqual(['knowledge.extra', 'review', 'steps.claude.grill.temperature']);
  });

  it('reports field-level issues for wrong types, unknown harness keys and negative limits (AC7)', () => {
    const parsed = parseConfigFile({
      commitWork: 'yes',
      limits: { 'review.iterations': -1 },
      steps: { claude: { implement: { harness: 'vim', model: 3 } }, emacs: {} },
    });

    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error.map((issue) => issue.path)).toEqual([
      'commitWork',
      'limits.review.iterations',
      'steps.claude.implement.harness',
      'steps.claude.implement.model',
      'steps.emacs',
    ]);
  });

  it('rejects a non-object document', () => {
    expect(parseConfigFile([1]).ok).toBe(false);
  });
});
