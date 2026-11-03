import type { ConfigFile } from './config-file.js';

import { describe, expect, it } from 'vitest';

import { parseConfigFile } from './config-file.js';
import { BUILT_IN_PROFILES, DEFAULT_REVIEWERS } from './defaults.js';
import { delta } from './delta.js';
import { effective } from './effective.js';

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

  it('keeps a built-in-equal profile carrying an unknown key, and reports it', () => {
    const { content, unknownKeys } = contentOf({ profiles: [{ ...BUILT_IN_PROFILES[0], extra: 1 }] });

    expect(content).toEqual({ profiles: [{ ...BUILT_IN_PROFILES[0], extra: 1 }] });
    expect(unknownKeys).toEqual(['profiles.0.extra']);
  });

  it('keeps only the unknown-bearing entry of a mixed profile list', () => {
    const { content } = contentOf({ output: 'new', profiles: [{ name: 'custom', skills: ['x'] }, { ...BUILT_IN_PROFILES[0], future: { keep: 42 } }] });

    expect(content).toEqual({ output: 'new', profiles: [{ name: 'custom', skills: ['x'] }, { ...BUILT_IN_PROFILES[0], future: { keep: 42 } }] });
  });

  it('keeps unknown keys nested in step and knowledge entries', () => {
    const { content } = contentOf({ knowledge: { root: 'docs', x: 1 }, steps: { claude: { explore: { effort: 'medium', y: 2 } } } });

    expect(content).toEqual({ knowledge: { x: 1 }, steps: { claude: { explore: { y: 2 } } } });
  });

  const shifted = { profiles: [BUILT_IN_PROFILES[0], { ...BUILT_IN_PROFILES[1], future: 1 }] };
  it.each([
    [undefined, undefined],
    [{ output: 'g', profiles: [...BUILT_IN_PROFILES] }, undefined],
    [undefined, shifted],
  ])('every reported unknown key exists in the written text (global %#)', (global, input) => {
    const raw = input ?? {
      knowledge: { root: 'docs', u1: 1 },
      limits: { 'review.iterations': 3 },
      output: '.agentic/work',
      profiles: [{ ...BUILT_IN_PROFILES[0], u2: { deep: true } }, { name: 'c', skills: [], u3: [] }],
      steps: { claude: { 'explore': { effort: 'medium', u4: 'a' }, 'review': {}, 'review.x': { model: 'm', u5: null } } },
      u7: 'top',
    };
    const result = delta(raw, global === undefined ? undefined : (parseConfigFile(global) as { value: ConfigFile }).value);
    if (!result.ok) throw new Error('invalid');
    const written: unknown = JSON.parse(result.value.text);
    // Resolves a dotted path by segments, joining segments when a key itself holds a dot (`review.x`).
    const at = (value: unknown, path: string): unknown => {
      const walk = (node: unknown, segments: readonly string[]): unknown => {
        if (segments.length === 0) return node;
        if (typeof node !== 'object' || node === null) return Symbol.for('missing');
        for (let size = 1; size <= segments.length; size += 1) {
          const key = segments.slice(0, size).join('.');
          if (key in node) {
            const found = walk((node as Record<string, unknown>)[key], segments.slice(size));
            if (found !== Symbol.for('missing')) return found;
          }
        }
        return Symbol.for('missing');
      };
      return walk(value, path.split('.'));
    };

    if (input === undefined) expect(result.value.unknownKeys.length).toBeGreaterThanOrEqual(6);
    else expect(result.value.unknownKeys).toEqual(['profiles.0.future']);
    expect(written).not.toHaveProperty(['steps', 'claude', 'review']);
    for (const key of result.value.unknownKeys) expect({ key, value: at(written, key) }).not.toEqual({ key, value: Symbol.for('missing') });
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

describe('delta against the global file (project scope)', () => {
  const globalFile = (raw: unknown) => {
    const parsed = parseConfigFile(raw);
    if (!parsed.ok) throw new Error('bad fixture');
    return parsed.value;
  };

  it('keeps a project value equal to a built-in default when it overrides a non-default global value', () => {
    const result = delta({ limits: { 'review.iterations': 3 }, output: '.agentic/work' }, globalFile({ limits: { 'review.iterations': 5 }, output: 'elsewhere' }));

    expect(result.ok && result.value.content).toEqual({ limits: { 'review.iterations': 3 }, output: '.agentic/work' });
  });

  it('keeps a project value equal to a non-default global value (pinned)', () => {
    const result = delta({ limits: { 'review.iterations': 5 }, worktrees: '../wt' }, globalFile({ limits: { 'review.iterations': 5 }, worktrees: '../wt' }));

    expect(result.ok && result.value.content).toEqual({ limits: { 'review.iterations': 5 }, worktrees: '../wt' });
  });

  it('saves an unchanged project file unchanged when global has the same values', () => {
    const project = { commitWork: true, output: 'out', reviewers: ['code-review'] };
    const result = delta(project, globalFile({ output: 'out', reviewers: ['code-review'] }));

    expect(result.ok && result.value.content).toEqual(project);
  });

  it('drops a project value equal to the built-in default when global does not differ', () => {
    const result = delta({ output: '.agentic/work', worktrees: '../wt' }, globalFile({ worktrees: '../other' }));

    expect(result.ok && result.value.content).toEqual({ worktrees: '../wt' });
  });

  it('keeps a profile with unknown keys equal to the global profile, and reports the key', () => {
    const result = delta({ profiles: [{ name: 'custom', note: 'keep me', skills: ['x'] }] }, globalFile({ profiles: [{ name: 'custom', skills: ['x'] }] }));
    if (!result.ok) throw new Error('invalid');

    expect(JSON.parse(result.value.text)).toEqual({ profiles: [{ name: 'custom', note: 'keep me', skills: ['x'] }] });
    expect(result.value.unknownKeys).toEqual(['profiles.0.note']);
  });

  /** Strips origins: what agents would actually use, field by field and per step leaf. */
  const meaning = (global: ConfigFile, project: ConfigFile) => {
    const { steps, unknownKeys: _unknown, ...fields } = effective(global, project);
    const values = JSON.parse(JSON.stringify(fields, (_key, value: unknown) => (isSourced(value) ? value.value : value))) as unknown;
    const stepValues = Object.fromEntries(
      Object.entries(steps).map(([harness, keys]) => [harness, Object.fromEntries(Object.entries(keys).map(([key, step]) => [key, { effort: step.effort?.value, harness: step.harness?.value ?? harness, model: step.model?.value }]))]),
    );
    return { stepValues, values };
  };

  const cases: readonly { readonly edited: Record<string, unknown>; readonly global: Record<string, unknown>; readonly name: string }[] = [
    { edited: { output: 'pinned' }, global: { output: 'pinned' }, name: 'simple field equal to global' },
    { edited: { limits: { 'babysit.rounds': 5, 'review.iterations': 3 } }, global: { limits: { 'review.iterations': 9 } }, name: 'limits' },
    { edited: { steps: { claude: { 'review': { model: 'r' }, 'review.super-review': { effort: 'high', model: 'frontier' } } } }, global: { steps: { claude: { review: { model: 'g' } } } }, name: 'steps with parent' },
    { edited: { reviewers: [...DEFAULT_REVIEWERS] }, global: { reviewers: ['code-review'] }, name: 'reviewers reset to default' },
    { edited: { selectedProfiles: [] }, global: { selectedProfiles: ['typescript'] }, name: 'selectedProfiles emptied' },
    { edited: { profiles: [] }, global: { profiles: [{ name: 'custom', skills: ['x'] }] }, name: 'profiles [] suppresses a global custom profile' },
    { edited: { profiles: [BUILT_IN_PROFILES[0]] }, global: { profiles: [{ name: 'typescript', skills: ['mine'] }] }, name: 'resets a globally overridden built-in profile' },
    { edited: { knowledge: { extra: 42, root: 'kb' } }, global: { knowledge: { root: 'kb' } }, name: 'knowledge root with an unknown sibling' },
    { edited: { knowledge: { root: 'kb' } }, global: { knowledge: { root: 'kb' } }, name: 'knowledge root equal to global' },
  ];

  it.each(cases)('keeps the effective meaning after a save: $name', ({ edited, global }) => {
    const globalConfig = globalFile(global);
    const result = delta(edited, globalConfig);
    if (!result.ok) throw new Error(JSON.stringify(result.error));

    const written = globalFile(JSON.parse(result.value.text));

    expect(meaning(globalConfig, written)).toEqual(meaning(globalConfig, globalFile(edited)));
  });

  it('keeps unknown knowledge siblings and the root they need', () => {
    const result = delta({ knowledge: { extra: 42, root: 'kb' } }, globalFile({ knowledge: { root: 'kb' } }));

    expect(result.ok && result.value.content).toEqual({ knowledge: { extra: 42, root: 'kb' } });
  });

  it('keeps non-default project values even when the global file gives the same result', () => {
    const edited = { knowledge: { root: 'kb' }, steps: { claude: { 'review.super-review': { model: 'r' } } } };
    const result = delta(edited, globalFile({ knowledge: { root: 'kb' }, steps: { claude: { review: { model: 'r' } } } }));

    expect(result.ok && result.value.content).toEqual(edited);
  });
});

const isSourced = (value: unknown): value is { readonly value: unknown } => typeof value === 'object' && value !== null && 'origin' in value && 'value' in value;
