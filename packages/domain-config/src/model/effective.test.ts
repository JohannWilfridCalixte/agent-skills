import type { ConfigFile } from './config-file.js';

import { describe, expect, it } from 'vitest';

import { EMPTY_CONFIG_FILE, parseConfigFile } from './config-file.js';
import { BUILT_IN_PROFILES, DEFAULT_REVIEWERS } from './defaults.js';
import { effective } from './effective.js';

function file(raw: Record<string, unknown>): ConfigFile {
  const parsed = parseConfigFile(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  return parsed.value;
}

describe('effective (AC3)', () => {
  it('reports every field as default when both files are empty', () => {
    const view = effective(EMPTY_CONFIG_FILE, EMPTY_CONFIG_FILE);

    expect(view.output).toEqual({ origin: 'default', value: '.agentic/work' });
    expect(view.commitWork).toEqual({ origin: 'default', value: false });
    expect(view.worktrees).toEqual({ origin: 'default', value: '../{repo}-worktrees' });
    expect(view.knowledge.root).toEqual({ origin: 'default', value: 'docs' });
    expect(view.profiles).toEqual({ origin: 'default', value: BUILT_IN_PROFILES });
    expect(view.selectedProfiles).toEqual({ origin: 'default', value: [] });
    expect(view.reviewers).toEqual({ origin: 'default', value: DEFAULT_REVIEWERS });
    expect(view.limits['review.iterations']).toEqual({ origin: 'default', value: 3 });
    expect(view.steps.claude['grill']).toEqual({ effort: { origin: 'default', value: 'high' }, model: { origin: 'default', value: 'frontier' } });
    expect(view.steps.cursor['context.code']).toEqual({ effort: { origin: 'default', value: 'medium' }, model: { origin: 'default', value: 'grok-4.7-medium' } });
    expect(view.steps.codex['chore']).toEqual({ effort: { origin: 'default', value: 'low' }, model: { origin: 'default', value: 'gpt-6-luna' } });
  });

  it('lets a project top-level key replace the global value whole', () => {
    const view = effective(file({ output: 'g', reviewers: ['a', 'b'], worktrees: 'gw' }), file({ reviewers: ['c'], worktrees: 'pw' }));

    expect(view.output).toEqual({ origin: 'global', value: 'g' });
    expect(view.reviewers).toEqual({ origin: 'project', value: ['c'] });
    expect(view.worktrees).toEqual({ origin: 'project', value: 'pw' });
  });

  it('replaces knowledge whole: a project knowledge object without root falls back to the default', () => {
    expect(effective(file({ knowledge: { root: 'kb' } })).knowledge.root).toEqual({ origin: 'global', value: 'kb' });
    expect(effective(file({ knowledge: { root: 'kb' } }), file({ knowledge: {} })).knowledge.root).toEqual({ origin: 'default', value: 'docs' });
  });

  it('merges steps per harness and step key, with an origin per leaf', () => {
    const global = file({ steps: { claude: { implement: { effort: 'high', model: 'opus' }, tickets: { model: 'haiku' } } } });
    const project = file({ steps: { claude: { 'implement': { model: 'sonnet' }, 'review.ub-mode': { harness: 'codex' } } } });

    const { steps } = effective(global, project);

    expect(steps.claude['implement']).toEqual({ effort: { origin: 'global', value: 'high' }, model: { origin: 'project', value: 'sonnet' } });
    expect(steps.claude['tickets']).toEqual({ effort: { origin: 'default', value: 'low' }, model: { origin: 'global', value: 'haiku' } });
    expect(steps.claude['review.ub-mode']).toEqual({ harness: { origin: 'project', value: 'codex' } });
    expect(steps.cursor['implement']).toEqual({ effort: { origin: 'default', value: 'medium' }, model: { origin: 'default', value: 'code' } });
  });

  it('merges limits per key and keeps extra limit keys', () => {
    const view = effective(file({ limits: { 'babysit.rounds': 9, 'review.iterations': 1 } }), file({ limits: { 'extra.key': 7, 'review.iterations': 2 } }));

    expect(view.limits).toEqual({
      'babysit.rounds': { origin: 'global', value: 9 },
      'crossHarness.timeout': { origin: 'default', value: 600 },
      'extra.key': { origin: 'project', value: 7 },
      'implement.retries': { origin: 'default', value: 2 },
      'review.iterations': { origin: 'project', value: 2 },
    });
  });

  it('adds configured profiles to the built-ins, a same-name profile replacing one', () => {
    const backend = { name: 'backend', skills: ['agentic-clean-architecture'] };
    const typescript = { name: 'typescript', skills: ['agentic-typescript-engineer'] };

    const view = effective(EMPTY_CONFIG_FILE, file({ profiles: [backend, typescript] }));

    expect(view.profiles.origin).toBe('project');
    expect(view.profiles.value).toEqual([typescript, BUILT_IN_PROFILES[1], backend]);
  });

  it('flags unknown keys per scope', () => {
    expect(effective(file({ x: 1 }), file({ review: { fix: true } })).unknownKeys).toEqual([
      { path: 'x', scope: 'global' },
      { path: 'review', scope: 'project' },
    ]);
  });
});
