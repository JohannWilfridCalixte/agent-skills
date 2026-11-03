import { describe, expect, it } from 'vitest';

import { formFromRaw, toEditedConfig } from './edited-config';

describe('edited config', () => {
  it('round-trips a file unchanged, unknown keys included', () => {
    const raw = {
      commitWork: false,
      knowledge: { extra: 1, root: 'kb' },
      limits: { 'review.iterations': 2 },
      output: 'out',
      profiles: [{ detect: ['package.json'], name: 'web', skills: ['react'] }],
      review: { fix: true },
      reviewers: ['a'],
      steps: { claude: { grill: { model: 'opus', temperature: 1 } } },
    };

    expect(toEditedConfig(raw, formFromRaw(raw))).toEqual(raw);
  });

  it('drops fields cleared in the form', () => {
    const raw = { knowledge: { root: 'kb' }, limits: { 'review.iterations': 2 }, output: 'out', steps: { claude: { grill: { model: 'opus' } } } };
    const form = { ...formFromRaw(raw), knowledgeRoot: '', limits: { 'review.iterations': '' }, output: '', steps: { claude: { grill: { effort: '', model: '' } } } };

    expect(toEditedConfig(raw, form)).toEqual({});
  });

  it('adds a step entry and a limit that were not in the file', () => {
    const form = { ...formFromRaw({}), limits: { 'review.iterations': '4' }, steps: { codex: { implement: { effort: 'high', model: '' } } } };

    expect(toEditedConfig({}, form)).toEqual({ limits: { 'review.iterations': 4 }, steps: { codex: { implement: { effort: 'high' } } } });
  });

  it('keeps an emptied list that was in the file, and omits one that was not', () => {
    const form = { ...formFromRaw({ reviewers: ['a'] }), reviewers: [] };

    expect(toEditedConfig({ reviewers: ['a'] }, form)).toEqual({ reviewers: [] });
  });
});
