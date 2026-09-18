import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  validateLibrary, resolveConfig, validateState, validatePlan, planRevision,
  frontier, coverage, impact, telemetry, validateKnowledge, checkResume,
  sealPlan, importPlan, saveState, validateAcceptance,
} from '../skills/use-workflow/scripts/agentic.mjs';
import { prepare, summarize } from '../skills/use-workflow/scripts/evaluate.mjs';

const root = path.resolve(import.meta.dirname, '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-contract-'));
const validPlan = () => {
  const plan = {
    schema_version: 1, spec_id: 'sample', prd: 'prd.md', technical_plan: 'technical-plan.md',
    requirements: [{ id: 'AC-001', text: 'Reject duplicate requests', status: 'active' }],
    tickets: [{ id: '01', title: 'Idempotent requests', path: 'tickets/01-request.md', blocked_by: [],
      requirements: ['AC-001'], files: ['src/request.mjs'], acceptance: ['Duplicate requests have one effect'] }],
    decisions: [], artifacts: [],
  };
  return { ...plan, revision: planRevision(plan) };
};
const validState = (plan = validPlan()) => ({
  schema_version: 2, state_version: 0, workflow: 'agentic:workflow:implement', run_id: '20260911-230000-abcd',
  topic: 'sample', output_path: '.agentic/output/implement/run', status: 'in_progress',
  started_at: '2026-09-11T23:00:00Z', updated_at: '2026-09-11T23:00:00Z', completed_at: null,
  current_step: 2, steps_completed: [], technical_skills_prompt: [], execution_context: {},
  repo: { root, branch: 'test', base_sha: 'a'.repeat(40), head_sha: 'b'.repeat(40) },
  plan: { path: 'docs/specs/sample/plan.json', revision: plan.revision, accepted_revision: plan.revision },
  tickets: { '01': { status: 'ready', owner: null, plan_revision: plan.revision, commit: null } },
  gates: [{ id: 'quiz', kind: 'plan_acceptance', status: 'approved', revision: plan.revision, scope: ['01'], evidence: 'User approved ticket 01' }],
  decisions: [], artifacts: {}, checks: [], requirements: {}, review_loops: {}, prs: {}, knowledge: {}, telemetry: {},
});
const rejects = (f, pattern) => assert.throws(f, pattern);

test('library installation closure, names, references and protected TypeScript hashes', () => {
  const result = validateLibrary(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.skills, 18);
  assert.equal(result.protected_files, 11);
});

test('nested dotted output and TS discovery work with empty selected profiles', () => {
  const config = { namespace: 'agentic', selectedProfiles: [], profiles: [
    { name: 'frontend', detect: ['src/**/*.ts'], skills: ['agentic:skill:typescript-engineer'] },
  ], ides: { codex: { outputFolder: '.agentic/output', highThinkingModelName: 'gpt-6-astra' } } };
  const result = resolveConfig(config, { root, host: 'codex', paths: ['src/app.ts'], role: 'high_thinking' });
  assert.equal(result.output_folder, '.agentic/output');
  assert.deepEqual(result.selected_profiles, ['frontend']);
  assert.ok(result.technical_skills_prompt.includes('agentic:skill:typescript-engineer'));
  assert.equal(result.model, 'gpt-6-astra');
});

test('profile order is stable; unknown selected profile and invalid paths fail visibly', () => {
  rejects(() => resolveConfig({ selectedProfiles: ['missing'], profiles: [] }, { root, paths: [] }), /profile/i);
  for (const p of ['../outside', '/tmp/outside', 'nested/../../outside']) {
    rejects(() => resolveConfig({ ides: { codex: { outputFolder: p } } }, { root, host: 'codex', paths: [] }), /path|relative|outside/i);
  }
  const r = tmp(); fs.symlinkSync(os.tmpdir(), path.join(r, 'escape'));
  rejects(() => resolveConfig({ ides: { codex: { outputFolder: 'escape/new' } } }, { root: r, host: 'codex', paths: [] }), /outside|symlink/i);
  fs.rmSync(r, { recursive: true });
});

test('unavailable explicit model is a recorded fallback, never a claim of configured execution', () => {
  const r = resolveConfig({ ides: { codex: { qaModelName: 'not-installed' } } },
    { root, host: 'codex', paths: [], role: 'qa', available_models: ['actual'], default_model: 'actual' });
  assert.equal(r.model, 'actual'); assert.match(r.fallback_reason, /not-installed/);
});

test('state accepts escalation and skill lists, rejects stale prompt strings and completed blocked work', () => {
  const s = validState(); s.status = 'escalated'; assert.deepEqual(validateState(s), []);
  s.technical_skills_prompt = 'Load TypeScript'; assert.ok(validateState(s).length);
  s.technical_skills_prompt = []; s.status = 'completed'; s.completed_at = s.updated_at;
  assert.ok(validateState(s).some(e => /ticket|gate|review/i.test(e)));
});

test('state writes are atomic with revision compare-and-swap and legal transitions', () => {
  const dir = tmp(), p = path.join(dir, 'workflow-state.yaml');
  const s = validState(); saveState(p, s, { expected_version: null });
  const first = JSON.parse(fs.readFileSync(p)); assert.equal(first.state_version, 1);
  saveState(p, { ...first, status: 'blocked' }, { expected_version: 1 });
  rejects(() => saveState(p, first, { expected_version: 1 }), /version|concurrent|stale/i);
  assert.equal(JSON.parse(fs.readFileSync(p)).status, 'blocked');
  fs.rmSync(dir, { recursive: true });
});

test('ticket validation catches duplicate IDs, missing deps, cycles, unknown criteria and file overlap', () => {
  for (const mutate of [
    p => p.tickets.push(structuredClone(p.tickets[0])),
    p => p.tickets[0].blocked_by.push('99'),
    p => p.tickets[0].blocked_by.push('01'),
    p => p.tickets[0].requirements.push('AC-999'),
    p => p.tickets.push({ ...structuredClone(p.tickets[0]), id: '02' }),
  ]) { const p = validPlan(); mutate(p); p.revision = planRevision(p); assert.ok(validatePlan(p).length); }
});

test('scheduler excludes running owners and applies capacity before dispatch', () => {
  const p = validPlan(); p.tickets.push({ ...structuredClone(p.tickets[0]), id: '02', path: 'tickets/02.md', files: ['src/other.mjs'] });
  p.revision = planRevision(p); const s = validState(p);
  s.gates[0].scope = ['01', '02'];
  s.tickets['01'].status = 'in_progress'; s.tickets['01'].owner = 'worker-01';
  s.tickets['02'] = { status: 'ready', owner: null, plan_revision: p.revision, commit: null };
  assert.deepEqual(frontier(p, s, 1).ready, []);
  assert.deepEqual(frontier(p, s, 2).ready, ['02']);
  s.tickets['01'].status = 'ready'; assert.deepEqual(frontier(p, s, 2).ready, ['02']);
});

test('green tests alone do not fulfill acceptance criteria; stale evidence is unverified', () => {
  const p = validPlan(), s = validState(p);
  s.checks = [{ id: 'check-1', command: 'node --test', status: 'passed', revision: 'b'.repeat(40),
    plan_revision: p.revision, exit_code: 0, output_path: 'check.txt', requirements: ['AC-001'] }];
  assert.equal(coverage(p, s).requirements[0].status, 'unverified');
  s.requirements['AC-001'] = { status: 'satisfied', evidence: [{ check_id: 'check-1', criterion: 'Duplicate invocation produced exactly one recorded side effect', revision: 'b'.repeat(40) }] };
  assert.equal(coverage(p, s).requirements[0].status, 'satisfied');
  s.checks[0].plan_revision = 'old'; assert.equal(coverage(p, s).requirements[0].status, 'unverified');
});

test('durable acceptance rejects stale revisions, partial scope and missing approval evidence', () => {
  const p = validPlan(), s = validState(p);
  const receipt = { schema_version: 1, spec_id: p.spec_id, revision: p.revision, accepted_at: s.updated_at, gates: s.gates };
  assert.deepEqual(validateAcceptance(p, receipt), []);
  receipt.revision = 'stale'; assert.ok(validateAcceptance(p, receipt).length);
  receipt.revision = p.revision; receipt.gates[0].scope = []; assert.ok(validateAcceptance(p, receipt).length);
  receipt.gates[0].scope = ['01']; receipt.gates[0].evidence = ''; assert.ok(validateAcceptance(p, receipt).length);
});

test('no plan acceptance gate means the scheduler cannot dispatch', () => {
  const p = validPlan(), s = validState(p); s.gates = [];
  rejects(() => frontier(p, s), /acceptance|approval|approved/i);
});

test('historical failed checks do not hide current required failures or prevent valid completion', () => {
  const s = validState(); s.tickets['01'].status = 'integrated'; s.status = 'completed'; s.completed_at = s.updated_at;
  s.history = { checks: [{ id: 'red-1', required: true, status: 'failed', revision: 'old' }], gates: [], review_loops: [] };
  assert.deepEqual(validateState(s), []);
  s.checks = [{ id: 'current-1', command: 'test', required: true, status: 'failed', exit_code: 1, revision: 'current' }];
  assert.ok(validateState(s).some(e => /required/.test(e)));
});

test('eval samples are isolated and repeated; aggregation keeps unknown telemetry null', () => {
  const dir = tmp(), dest = path.join(dir, 'samples');
  const result = prepare(root, [{ id: 'sample', skills: [], prompt: 'Answer this bounded question.' }], dest, 'no-library', 5);
  assert.equal(result.samples, 5); assert.equal(fs.existsSync(path.join(dest, 'sample-1/library')), false);
  const rows = Array.from({ length: 5 }, (_, i) => ({ sample_id: `sample-${i + 1}`, case_id: 'sample', condition: 'no-library',
    model: 'actual', effort: 'high', host_overlay: 'overlay', transcript: `result-${i}.md`, reviewer: 'independent', pass: i > 0, failed_criteria: i ? [] : ['criterion'], elapsed_ms: null }));
  const summary = summarize(rows); assert.equal(summary.groups[0].passes, 4); assert.equal(summary.groups[0].median_elapsed_ms, null);
  rejects(() => summarize([...rows, rows[0]]), /Duplicate/); fs.rmSync(dir, { recursive: true });
});

test('plan change invalidates affected tickets and dependents but retains unrelated work', () => {
  const old = validPlan(); old.requirements.push({ id: 'AC-002', text: 'Display status', status: 'active' });
  old.tickets.push({ ...structuredClone(old.tickets[0]), id: '02', files: ['src/ui.mjs'], path: 'tickets/02.md', requirements: ['AC-002'] });
  old.tickets.push({ ...structuredClone(old.tickets[0]), id: '03', files: ['src/integration.mjs'], path: 'tickets/03.md', blocked_by: ['01'] });
  old.revision = planRevision(old); const next = structuredClone(old); next.requirements[0].text = 'Deduplicate concurrent requests'; next.revision = planRevision(next);
  const result = impact(old, next); assert.deepEqual(result.affected_tickets, ['01', '03']); assert.deepEqual(result.retained_tickets, ['02']);
});

test('sealing accepted artifacts binds all markdown content, not only plan metadata', () => {
  const dir = tmp(); fs.mkdirSync(path.join(dir, 'tickets'));
  const p = validPlan(); for (const f of [p.prd, p.technical_plan, p.tickets[0].path]) fs.writeFileSync(path.join(dir, f), '# Accepted scope\n');
  const file = path.join(dir, 'plan.json'); fs.writeFileSync(file, JSON.stringify(p)); sealPlan(file);
  const sealed = JSON.parse(fs.readFileSync(file)); assert.deepEqual(validatePlan(sealed, dir), []);
  fs.appendFileSync(path.join(dir, p.prd), 'New requirement\n'); assert.ok(validatePlan(sealed, dir).some(e => /hash|revision|changed/i.test(e)));
  fs.rmSync(dir, { recursive: true });
});

test('external plan import creates durable drafts and never fabricates approval', () => {
  const dir = tmp(), dest = path.join(dir, 'spec');
  const source = { spec_id: 'imported', product: '# Product\nA behavior', technical: '# Design\nA boundary',
    requirements: [{ id: 'AC-001', text: 'Perform behavior', status: 'active' }],
    tickets: [{ id: '01', title: 'Behavior', blocked_by: [], requirements: ['AC-001'], files: ['src/a.mjs'], acceptance: ['Observed behavior'] }], decisions: [] };
  importPlan(source, dest); assert.ok(fs.existsSync(path.join(dest, 'plan.json')));
  const p = JSON.parse(fs.readFileSync(path.join(dest, 'plan.json'))); assert.deepEqual(validatePlan(p, dest), []); assert.equal(p.approved, undefined);
  rejects(() => importPlan(source, dest), /exist|overwrite/i);
  fs.rmSync(dir, { recursive: true });
});

test('telemetry deduplicates events, counts only recorded observations, and rejects secret fields', () => {
  const events = [{ id: '1', run_id: 'r', timestamp: '2026-09-11T23:00:00Z', type: 'skill_read', model: 'm', effort: 'high', duration_ms: 30 },
    { id: '2', run_id: 'r', timestamp: '2026-09-11T23:00:01Z', type: 'review_round', duration_ms: 70 }];
  const result = telemetry([...events, events[0]]); assert.equal(result.events, 2); assert.equal(result.counts.skill_read, 1); assert.equal(result.tokens, null);
  rejects(() => telemetry([{ ...events[0], prompt: 'password=secret' }]), /field|sensitive|prompt/i);
});

test('knowledge validator detects broken successor links and duplicate numbers', () => {
  const dir = tmp(); fs.mkdirSync(path.join(dir, 'tech/adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'tech/adr/0001-old.md'), '# ADR\n**Status:** Superseded by [0002](0002-new.md)\n');
  fs.writeFileSync(path.join(dir, 'tech/adr/0001-duplicate.md'), '# ADR\n');
  const result = validateKnowledge(dir); assert.ok(result.errors.some(e => /0002|link/i.test(e))); assert.ok(result.errors.some(e => /duplicate/i.test(e)));
  fs.rmSync(dir, { recursive: true });
});

test('reachable reverted commit does not establish resumed acceptance', () => {
  const dir = tmp(); const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(dir, 'feature.txt'), 'before'); git('add', 'feature.txt'); git('commit', '-m', 'base');
  fs.writeFileSync(path.join(dir, 'feature.txt'), 'after'); git('add', 'feature.txt'); git('commit', '-m', 'feature'); const sha = git('rev-parse', 'HEAD');
  git('revert', '--no-edit', sha);
  const p = validPlan(), s = validState(p); s.repo.root = dir; s.repo.branch = git('branch', '--show-current');
  s.tickets['01'] = { status: 'committed', owner: null, plan_revision: p.revision, commit: sha };
  const result = checkResume(p, s); assert.equal(result.tickets[0].reachable, true); assert.equal(result.tickets[0].skippable, false);
  fs.rmSync(dir, { recursive: true });
});

test('parallel worktrees isolate integration and preserve unrelated staged files', () => {
  const dir = tmp(), a = path.join(dir, 'lane-a'), b = path.join(dir, 'lane-b'), repo = path.join(dir, 'repo'); fs.mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'base'); fs.writeFileSync(path.join(repo, 'b.txt'), 'base'); git('add', '.'); git('commit', '-m', 'base');
  git('worktree', 'add', '--detach', a); git('worktree', 'add', '--detach', b);
  fs.writeFileSync(path.join(a, 'a.txt'), 'ready'); fs.writeFileSync(path.join(b, 'b.txt'), 'unfinished');
  const patch = execFileSync('git', ['diff', '--binary', '--', 'a.txt'], { cwd: a });
  execFileSync('git', ['apply', '--index', '-'], { cwd: repo, input: patch });
  assert.equal(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8'), 'ready'); assert.equal(fs.readFileSync(path.join(repo, 'b.txt'), 'utf8'), 'base');
  assert.equal(git('diff', '--cached', '--name-only'), 'a.txt'); assert.equal(fs.readFileSync(path.join(b, 'b.txt'), 'utf8'), 'unfinished');
  git('worktree', 'remove', '--force', a); git('worktree', 'remove', '--force', b); fs.rmSync(dir, { recursive: true });
});
