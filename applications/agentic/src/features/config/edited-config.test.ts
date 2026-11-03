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

  it.each([
    { profiles: [{ future: { keep: 42 }, name: 'custom', skills: ['code-review'] }] },
    { profiles: [{ detect: [], extra: 1, name: 'web', skills: ['react'] }] },
    { profiles: [{ detect: ['**/{src,test}/**/*.ts'], name: 'ts', skills: [] }] },
    { knowledge: { nested: { a: [1] }, root: 'kb' }, reviewers: [], steps: { codex: { grill: { model: 'o3', tags: ['x'] } }, other: { y: 1 } } },
  ])('round-trips %j losslessly', (raw) => {
    expect(toEditedConfig(raw, formFromRaw(raw))).toEqual(raw);
  });

  const profiles = [
    { detect: ['**/{src,test}/**/*.ts'], future: { keep: 42 }, name: 'a', skills: ['x'] },
    { detect: [], extra: 1, name: 'b', skills: ['y'] },
    { name: 'c', nested: { deep: true }, skills: [] },
  ];

  it('keeps every profile intact when an unrelated field changes', () => {
    const raw = { output: 'out', profiles };
    expect(toEditedConfig(raw, { ...formFromRaw(raw), output: 'new' })).toEqual({ output: 'new', profiles });
  });

  it('overlays a renamed profile on its own original object', () => {
    const raw = { profiles };
    const form = formFromRaw(raw);
    const renamed = { ...form, profiles: form.profiles.map((profile, index) => (index === 1 ? { ...profile, name: 'b2' } : profile)) };
    expect(toEditedConfig(raw, renamed)).toEqual({ profiles: [profiles[0], { ...profiles[1], name: 'b2' }, profiles[2]] });
  });

  it('keeps unknown properties with their profile when one is removed or the order changes', () => {
    const raw = { profiles };
    const form = formFromRaw(raw);
    expect(toEditedConfig(raw, { ...form, profiles: form.profiles.filter((_, index) => index !== 0) })).toEqual({ profiles: [profiles[1], profiles[2]] });
    expect(toEditedConfig(raw, { ...form, profiles: [...form.profiles].reverse() })).toEqual({ profiles: [...profiles].reverse() });
  });

  it('adds a new profile with only the edited fields', () => {
    const form = formFromRaw({});
    expect(toEditedConfig({}, { ...form, profiles: [{ detect: ['a/**'], name: 'n', raw: {}, skills: ['s'] }] })).toEqual({ profiles: [{ detect: ['a/**'], name: 'n', skills: ['s'] }] });
  });
});
