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
    expect(steps.claude['review.ub-mode']).toEqual({ effort: { origin: 'default', value: 'medium' }, harness: { origin: 'project', value: 'codex' }, model: { origin: 'default', value: 'code' } });
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

describe('effective step resolution (config.md Resolution)', () => {
  it('falls back to the configured parent key: review for review.x, explore for context.*', () => {
    const { steps } = effective(file({ steps: { claude: { explore: { model: 'my-explore' }, review: { effort: 'low', model: 'my-review' } } } }));

    expect(steps.claude['review.super-review']).toEqual({ effort: { from: 'review', origin: 'global', value: 'low' }, model: { from: 'review', origin: 'global', value: 'my-review' } });
    expect(steps.claude['context.code']).toEqual({ effort: { origin: 'default', value: 'medium' }, model: { from: 'explore', origin: 'global', value: 'my-explore' } });
  });

  it('prefers an explicit key over its parent, project over global, per leaf', () => {
    const { steps } = effective(file({ steps: { cursor: { review: { model: 'composer-2.5' } } } }), file({ steps: { cursor: { 'review.claude-security-review': { effort: 'high', model: 'claude-opus-5-5' } } } }));

    expect(steps.cursor['review.super-review']).toEqual({ effort: { origin: 'default', value: 'high' }, model: { from: 'review', origin: 'global', value: 'composer-2.5' } });
    expect(steps.cursor['review.claude-security-review']).toEqual({ effort: { origin: 'project', value: 'high' }, model: { origin: 'project', value: 'claude-opus-5-5' } });
  });

  it('gives an unknown child its parent built-in default', () => {
    const { steps } = effective(file({ steps: { claude: { 'review.custom': { harness: 'claude' } } } }));

    expect(steps.claude['review.custom']).toEqual({ effort: { origin: 'default', value: 'medium' }, harness: { origin: 'global', value: 'claude' }, model: { origin: 'default', value: 'code' } });
  });

  it('maps a routing default to the target harness when a parent routes elsewhere', () => {
    const { steps } = effective(file({ steps: { claude: { explore: { harness: 'codex' } } } }));

    expect(steps.claude['context.docs']).toEqual({ effort: { origin: 'default', value: 'medium' }, harness: { from: 'explore', origin: 'global', value: 'codex' }, model: { origin: 'default', value: 'gpt-6.1-sol' } });
  });
});
