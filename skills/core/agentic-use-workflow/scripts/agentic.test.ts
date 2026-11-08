import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scriptPath = join(import.meta.dir, 'agentic.ts');

interface RunOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
}

interface TestEvent {
  readonly ts?: string;
  readonly workflow?: string;
  readonly step?: string | null;
  readonly type: string;
  readonly task?: string;
  readonly agent?: string;
  readonly model?: string;
  readonly summary?: string;
  readonly data?: Record<string, unknown>;
}

let sandbox = '';
let outputRoot = '';

beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-test-')));
  outputRoot = join(sandbox, 'work');
  mkdirSync(outputRoot);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

const agentic = (args: readonly string[], options: RunOptions = {}) => {
  const result = Bun.spawnSync([process.execPath, scriptPath, ...args], {
    cwd: options.cwd ?? sandbox,
    env: { ...process.env, AGENTIC_OUTPUT: outputRoot, ...options.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
};

const itemDir = (name: string) => join(outputRoot, name);

const writeLog = (name: string, events: readonly TestEvent[]) => {
  mkdirSync(itemDir(name), { recursive: true });
  const lines = events.map((event, index) =>
    JSON.stringify({
      ts: `2026-11-08T10:00:${String(index).padStart(2, '0')}Z`,
      work: name,
      run: 'a3f9',
      harness: 'claude',
      workflow: 'implement',
      step: null,
      summary: 'x',
      ...event,
    }),
  );
  writeFileSync(join(itemDir(name), 'events.jsonl'), `${lines.join('\n')}\n`);
};

const readState = (name: string) => JSON.parse(readFileSync(join(itemDir(name), 'state.json'), 'utf8'));

const readLog = (name: string) =>
  readFileSync(join(itemDir(name), 'events.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line));

const deriveState = (events: readonly TestEvent[], name = '20261108-demo') => {
  writeLog(name, events);
  const result = agentic(['state', '--work', 'demo']);
  expect(result.code).toBe(0);

  return readState(name);
};

const git = (cwd: string, args: readonly string[]) => {
  const result = Bun.spawnSync(['git', ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  });
  expect(result.exitCode).toBe(0);
};

describe('usage and exit codes', () => {
  test('no args prints usage to stderr, exit 2', () => {
    const result = agentic([]);
    expect(result.code).toBe(2);
    expect(result.err).toContain('usage');
  });

  test('unknown command exits 2', () => {
    expect(agentic(['nope']).code).toBe(2);
  });

  test('unknown flag exits 2', () => {
    writeLog('20261108-demo', [{ type: 'started' }]);
    expect(agentic(['state', '--work', 'demo', '--bogus', 'x']).code).toBe(2);
  });

  test('missing required flag exits 2', () => {
    const result = agentic(['start', 'implement', '--work', 'demo']);
    expect(result.code).toBe(2);
    expect(result.err).toContain('--harness');
  });

  test('source imports only node:/bun: builtins and never uses console', () => {
    const source = readFileSync(scriptPath, 'utf8');
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(specifier).toMatch(/^(node|bun):/);
    expect(source).not.toMatch(/console\./);
  });
});

describe('root and work item resolution', () => {
  test('AGENTIC_OUTPUT overrides the output root', () => {
    const result = agentic(['start', 'implement', '--harness', 'claude', '--work', 'demo']);
    expect(result.code).toBe(0);
    const [created] = readdirSync(outputRoot);
    expect(created).toMatch(/^\d{8}-demo$/);
  });

  test('from a linked worktree the root is the main checkout .agentic/work', () => {
    const main = join(sandbox, 'main');
    const linked = join(sandbox, 'linked');
    mkdirSync(main);
    git(main, ['init', '-q', '-b', 'main']);
    git(main, ['commit', '-q', '--allow-empty', '-m', 'init']);
    git(main, ['worktree', 'add', '-q', '-b', 'feature', linked]);

    const result = agentic(['start', 'implement', '--harness', 'cursor', '--work', 'demo'], {
      cwd: linked,
      env: { AGENTIC_OUTPUT: undefined },
    });

    expect(result.code).toBe(0);
    expect(existsSync(join(linked, '.agentic'))).toBe(false);
    const [created] = readdirSync(join(main, '.agentic', 'work'));
    expect(created).toMatch(/-demo$/);
  });

  test('.agentic.json output in the main checkout overrides the default', () => {
    const main = join(sandbox, 'main');
    mkdirSync(main);
    git(main, ['init', '-q', '-b', 'main']);
    writeFileSync(join(main, '.agentic.json'), JSON.stringify({ output: 'custom/out' }));

    const result = agentic(['start', 'implement', '--harness', 'claude', '--work', 'demo'], {
      cwd: main,
      env: { AGENTIC_OUTPUT: undefined },
    });

    expect(result.code).toBe(0);
    expect(readdirSync(join(main, 'custom', 'out'))[0]).toMatch(/-demo$/);
  });

  test('--work matches the exact name or a -slug suffix', () => {
    writeLog('20261108-demo', [{ type: 'started' }]);
    expect(agentic(['state', '--work', 'demo']).code).toBe(0);
    expect(agentic(['state', '--work', '20261108-demo']).code).toBe(0);
  });

  test('--work matching several items exits 2 and lists them', () => {
    writeLog('20261107-demo', [{ type: 'started' }]);
    writeLog('20261108-demo', [{ type: 'started' }]);
    const result = agentic(['state', '--work', 'demo']);
    expect(result.code).toBe(2);
    expect(result.err).toContain('20261107-demo');
    expect(result.err).toContain('20261108-demo');
  });

  test('--work matching nothing exits 2 for commands other than start', () => {
    expect(agentic(['state', '--work', 'ghost']).code).toBe(2);
  });

  test('archived items are not matched', () => {
    mkdirSync(join(outputRoot, '_archive', '20261101-demo'), { recursive: true });
    expect(agentic(['state', '--work', 'demo']).code).toBe(2);
  });

  test('without --work picks the item whose workspace.path is the cwd', () => {
    const workspace = join(sandbox, 'ws');
    mkdirSync(workspace);
    writeLog('20261108-a', [{ type: 'started' }]);
    writeLog('20261108-b', [{ type: 'started' }]);
    writeFileSync(join(itemDir('20261108-b'), 'state.json'), JSON.stringify({ workspace: { path: workspace } }));

    const result = agentic(['state'], { cwd: workspace });

    expect(result.code).toBe(0);
    expect(existsSync(join(itemDir('20261108-b'), 'state.json'))).toBe(true);
    expect(JSON.parse(result.out).work).toBe('20261108-b');
  });

  test('without --work and no cwd match exits 1 listing candidates', () => {
    writeLog('20261108-a', [{ type: 'started' }]);
    const result = agentic(['state']);
    expect(result.code).toBe(1);
    expect(result.err).toContain('20261108-a');
  });
});

describe('start', () => {
  test('mints a run, appends a workflow-level started event, prints the run', () => {
    const result = agentic(['start', 'to-spec', '--harness', 'codex', '--work', 'demo']);
    expect(result.code).toBe(0);
    const run = result.out.trim().replace(/^run /, '');
    expect(run).toMatch(/^[0-9a-f]{4}$/);

    const [name] = readdirSync(outputRoot);
    const [event] = readLog(name);
    expect(event).toMatchObject({ work: name, run, harness: 'codex', workflow: 'to-spec', step: null, type: 'started' });
    expect(event.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(readState(name)).toMatchObject({ phase: 'to-spec', status: 'in_progress', phases: { 'to-spec': 'in_progress' } });
  });

  test('every start mints a fresh run', () => {
    writeLog('20261108-demo', [{ type: 'started' }]);
    const runs = new Set<string>(['a3f9']);
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = agentic(['start', 'implement', '--harness', 'claude', '--work', 'demo']);
      runs.add(result.out.trim());
    }
    expect(runs.size).toBe(6);
  });

  test('--title lands in data and state', () => {
    writeLog('20261108-demo', []);
    agentic(['start', 'to-spec', '--harness', 'claude', '--work', 'demo', '--title', 'Tenant export']);
    expect(readState('20261108-demo').title).toBe('Tenant export');
  });

  test('unknown workflow exits 1 and creates nothing', () => {
    const result = agentic(['start', 'bogus', '--harness', 'claude', '--work', 'demo']);
    expect(result.code).toBe(1);
    expect(readdirSync(outputRoot)).toEqual([]);
  });

  test('unknown harness exits 1', () => {
    expect(agentic(['start', 'implement', '--harness', 'vim', '--work', 'demo']).code).toBe(1);
  });
});

describe('event', () => {
  const started = { type: 'started', workflow: 'implement', step: null } as const;

  test('fills ts/work/run/harness/workflow from the current run and appends one line', () => {
    writeLog('20261108-demo', [started]);
    const before = readFileSync(join(itemDir('20261108-demo'), 'events.jsonl'), 'utf8');

    const result = agentic([
      'event', '--work', 'demo', '--type', 'progress', '--step', 'implement', '--task', 'T1',
      '--agent', 'impl-T1', '--summary', 'tests written', '--data', '{"tests":3}',
    ]);

    expect(result.code).toBe(0);
    const after = readFileSync(join(itemDir('20261108-demo'), 'events.jsonl'), 'utf8');
    expect(after.startsWith(before)).toBe(true);
    const appended = after.slice(before.length);
    expect(appended.endsWith('\n')).toBe(true);
    expect(result.out.trim()).toBe(appended.trim());
    expect(JSON.parse(appended)).toMatchObject({
      work: '20261108-demo', run: 'a3f9', harness: 'claude', workflow: 'implement', step: 'implement',
      task: 'T1', type: 'progress', agent: 'impl-T1', summary: 'tests written', data: { tests: 3 },
    });
  });

  test('step defaults to null; explicit --run/--harness/--workflow/--ts/--iteration override', () => {
    writeLog('20261108-demo', [started]);
    const result = agentic([
      'event', '--work', 'demo', '--type', 'note', '--summary', 's', '--run', 'beef', '--harness', 'cursor',
      '--workflow', 'review', '--ts', '2026-11-08T12:00:00Z', '--iteration', '2',
    ]);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out)).toMatchObject({
      step: null, run: 'beef', harness: 'cursor', workflow: 'review', ts: '2026-11-08T12:00:00Z', iteration: 2,
    });
  });

  test('re-derives state.json after appending', () => {
    writeLog('20261108-demo', [started]);
    agentic(['event', '--work', 'demo', '--type', 'completed', '--summary', 'done']);
    expect(readState('20261108-demo').status).toBe('in_progress');
    expect(readState('20261108-demo').updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  const invalidCases: readonly (readonly [string, readonly string[], string])[] = [
    ['bad type', ['--type', 'oops', '--summary', 's'], 'type'],
    ['missing summary', ['--type', 'note'], 'summary'],
    ['empty summary', ['--type', 'note', '--summary', ''], 'summary'],
    ['bad run', ['--type', 'note', '--summary', 's', '--run', 'zzzz'], 'run'],
    ['bad harness', ['--type', 'note', '--summary', 's', '--harness', 'vim'], 'harness'],
    ['bad workflow', ['--type', 'note', '--summary', 's', '--workflow', 'nope'], 'workflow'],
    ['bad ts', ['--type', 'note', '--summary', 's', '--ts', 'yesterday'], 'ts'],
    ['bad iteration', ['--type', 'note', '--summary', 's', '--iteration', 'x'], 'iteration'],
    ['data not json', ['--type', 'note', '--summary', 's', '--data', '{nope'], 'data'],
    ['data not an object', ['--type', 'note', '--summary', 's', '--data', '[1]'], 'data'],
    ['failed without reason', ['--type', 'failed', '--summary', 's'], 'data.reason'],
  ];

  for (const [label, flags, field] of invalidCases) {
    test(`invalid (${label}) exits 1 naming ${field}, writes nothing`, () => {
      writeLog('20261108-demo', [started]);
      const before = readFileSync(join(itemDir('20261108-demo'), 'events.jsonl'), 'utf8');

      const result = agentic(['event', '--work', 'demo', ...flags]);

      expect(result.code).toBe(1);
      expect(result.err).toContain(field);
      expect(readFileSync(join(itemDir('20261108-demo'), 'events.jsonl'), 'utf8')).toBe(before);
    });
  }

  test('without a current run and no --run exits 1', () => {
    mkdirSync(itemDir('20261108-demo'));
    const result = agentic(['event', '--work', 'demo', '--type', 'note', '--summary', 's']);
    expect(result.code).toBe(1);
    expect(result.err).toContain('run');
  });

  test('missing --type exits 2', () => {
    writeLog('20261108-demo', [started]);
    expect(agentic(['event', '--work', 'demo', '--summary', 's']).code).toBe(2);
  });
});

describe('state derivation', () => {
  test('phase = workflow of latest workflow-level started; phases track each workflow', () => {
    const state = deriveState([
      { type: 'started', workflow: 'to-spec' },
      { type: 'completed', workflow: 'to-spec' },
      { type: 'started', workflow: 'to-plan' },
      { type: 'progress', workflow: 'to-plan', step: 'x' },
    ]);
    expect(state.phase).toBe('to-plan');
    expect(state.phases).toEqual({ 'to-spec': 'done', 'to-plan': 'in_progress' });
    expect(state.work).toBe('20261108-demo');
  });

  test('failed workflow-level event gives phase failed and status failed', () => {
    const state = deriveState([
      { type: 'started', workflow: 'to-spec' },
      { type: 'failed', workflow: 'to-spec', data: { reason: 'x' } },
    ]);
    expect(state.phases['to-spec']).toBe('failed');
    expect(state.status).toBe('failed');
  });

  test('status: done for babysit-pr and playbook completion, in_progress otherwise', () => {
    expect(deriveState([{ type: 'started', workflow: 'babysit-pr' }, { type: 'completed', workflow: 'babysit-pr' }]).status).toBe('done');
    expect(deriveState([{ type: 'started', workflow: 'debug' }, { type: 'completed', workflow: 'debug' }]).status).toBe('done');
    expect(deriveState([{ type: 'started', workflow: 'to-spec' }, { type: 'completed', workflow: 'to-spec' }]).status).toBe('in_progress');
  });

  test('a new pass after completed reads as not done', () => {
    const state = deriveState([
      { type: 'started', workflow: 'debug' },
      { type: 'completed', workflow: 'debug' },
      { type: 'started', workflow: 'debug' },
    ]);
    expect(state.status).toBe('in_progress');
  });

  test('status: blocked when the latest failed has data.blocked', () => {
    const state = deriveState([
      { type: 'started', workflow: 'implement' },
      { type: 'failed', workflow: 'implement', step: 'checks', data: { reason: 'red tree', blocked: true } },
    ]);
    expect(state.status).toBe('blocked');
  });

  test('status: awaiting_decision wins over blocked while an escalation is open; resolved clears it', () => {
    const open = { type: 'escalation', data: { id: 'D4', status: 'open', ref: 'adr.md' }, summary: 'Exports stored 30 days' };
    const blocked = { type: 'failed', data: { reason: 'r', blocked: true } };
    const state = deriveState([{ type: 'started' }, blocked, open]);
    expect(state.status).toBe('awaiting_decision');
    expect(state.escalations).toEqual([{ id: 'D4', summary: 'Exports stored 30 days', status: 'open', ref: 'adr.md' }]);

    const resolved = deriveState([
      { type: 'started' },
      open,
      { type: 'escalation', data: { id: 'D4', status: 'resolved', ref: 'adr.md' }, summary: 'ok' },
    ]);
    expect(resolved.status).toBe('in_progress');
    expect(resolved.escalations).toHaveLength(1);
    expect(resolved.escalations[0].status).toBe('resolved');
  });

  test('archived once cleanup completes, identified by workflow, step or data.skill; cleanup does not touch phases/steps', () => {
    const state = deriveState([
      { type: 'started', workflow: 'debug' },
      { type: 'started', workflow: 'debug', step: 'diagnose' },
      { type: 'completed', workflow: 'debug', step: 'diagnose' },
      { type: 'started', workflow: 'implement', data: { skill: 'cleanup' } },
      { type: 'completed', workflow: 'implement', data: { skill: 'cleanup' } },
    ]);
    expect(state.status).toBe('archived');
    expect(state.phase).toBe('debug');
    expect(state.phases).toEqual({ debug: 'in_progress' });
    expect(state.steps).toEqual({ diagnose: 'done' });
  });

  test('cleanup started alone does not archive nor change status', () => {
    const state = deriveState([
      { type: 'started', workflow: 'babysit-pr' },
      { type: 'completed', workflow: 'babysit-pr' },
      { type: 'started', workflow: 'cleanup' },
    ]);
    expect(state.status).toBe('done');
  });

  test('steps: per playbook pass, reset by that playbook workflow-level completed', () => {
    const during = deriveState([
      { type: 'started', workflow: 'implement-feature' },
      { type: 'started', workflow: 'implement-feature', step: 'start' },
      { type: 'completed', workflow: 'implement-feature', step: 'start' },
      { type: 'started', workflow: 'implement-feature', step: 'to-spec' },
      { type: 'started', workflow: 'to-spec', step: 'grill' },
    ]);
    expect(during.steps).toEqual({ start: 'done', 'to-spec': 'in_progress' });

    const after = deriveState([
      { type: 'started', workflow: 'implement-feature' },
      { type: 'completed', workflow: 'implement-feature', step: 'start' },
      { type: 'completed', workflow: 'implement-feature' },
    ]);
    expect(after.steps).toEqual({});
  });

  test('units: started -> in_progress, green checks -> done, failed, skipped, interrupted -> pending', () => {
    const state = deriveState([
      { type: 'started', workflow: 'implement' },
      { type: 'started', step: 'implement', task: 'T1', agent: 'impl-T1' },
      { type: 'started', step: 'implement', task: 'T2', agent: 'impl-T2' },
      { type: 'completed', step: 'implement', task: 'T1', agent: 'impl-T1' },
      { type: 'completed', step: 'checks', task: 'T1' },
      { type: 'started', step: 'implement', task: 'T3', agent: 'impl-T3' },
      { type: 'failed', step: 'implement', task: 'T3', data: { reason: 'x' } },
      { type: 'failed', step: 'checks', task: 'T2', data: { reason: 'red' } },
      { type: 'decision', task: 'T4', data: { choice: { key: 'unit.T4', value: 'skip' } } },
      { type: 'started', step: 'implement', task: 'T5', agent: 'impl-T5' },
      { type: 'failed', step: 'implement', task: 'T5', data: { reason: 'cut', interrupted: true } },
    ]);
    expect(state.units).toEqual({ T1: 'done', T2: 'in_progress', T3: 'failed', T4: 'skipped' });
  });

  test('choices keep the latest value per key; workspace/title/artifacts/hub/updated', () => {
    const workspace = { kind: 'worktree', branch: 'feat/x', base: 'main', path: '/p' };
    const state = deriveState([
      { type: 'started', workflow: 'to-spec', data: { title: 'Old' } },
      { type: 'decision', data: { choice: { key: 'tickets', value: 'no' } } },
      { type: 'decision', data: { choice: { key: 'tickets', value: 'yes' } } },
      { type: 'decision', data: { workspace } },
      { type: 'artifact', data: { name: 'spec', path: 'spec.md' } },
      { type: 'artifact', data: { tickets: { parent: '#9', tasks: { T1: '#10' } } } },
      { type: 'artifact', data: { issues: { parent: '#1', children: { a: '#2' } } } },
      { type: 'artifact', data: { pr: { url: 'https://x/pr/1', round: 2 } } },
      { type: 'artifact', data: { hub: 135 } },
      { type: 'note', data: { title: 'New' } },
    ]);
    expect(state.choices).toEqual({ tickets: 'yes' });
    expect(state.workspace).toEqual(workspace);
    expect(state.title).toBe('New');
    expect(state.artifacts).toEqual({ spec: 'spec.md' });
    expect(state.tickets).toEqual({ parent: '#9', tasks: { T1: '#10' } });
    expect(state.issues).toEqual({ parent: '#1', children: { a: '#2' } });
    expect(state.pr).toEqual({ url: 'https://x/pr/1', round: 2 });
    expect(state.hub).toBe(135);
    expect(state.updated).toBe('2026-11-08T10:00:09Z');
  });

  test('defaults when the log has no such data', () => {
    const state = deriveState([{ type: 'started', workflow: 'to-spec' }]);
    expect(state).toMatchObject({
      title: null, workspace: null, artifacts: {}, escalations: [], hub: null, steps: {}, units: {}, choices: {},
      tickets: { parent: null, tasks: {} }, issues: { parent: null, children: {} }, pr: { url: null, round: 0 },
    });
  });

  test('a stale hand-edited state.json is overwritten from the log; stdout is the state', () => {
    writeLog('20261108-demo', [{ type: 'started', workflow: 'to-spec' }]);
    writeFileSync(join(itemDir('20261108-demo'), 'state.json'), JSON.stringify({ status: 'done', phase: 'zzz', extra: 1 }));

    const result = agentic(['state', '--work', 'demo']);

    expect(result.code).toBe(0);
    const state = readState('20261108-demo');
    expect(state.phase).toBe('to-spec');
    expect(state.status).toBe('in_progress');
    expect(state.extra).toBeUndefined();
    expect(JSON.parse(result.out)).toEqual(state);
  });

  test('a corrupt events.jsonl line exits 1 naming the line', () => {
    writeLog('20261108-demo', [{ type: 'started' }]);
    appendFileSync(join(itemDir('20261108-demo'), 'events.jsonl'), '{broken\n');
    const result = agentic(['state', '--work', 'demo']);
    expect(result.code).toBe(1);
    expect(result.err).toContain('line 2');
  });
});

describe('resume', () => {
  const name = '20261108-demo';
  const midImplement: readonly TestEvent[] = [
    { workflow: 'implement', type: 'started', summary: 'implement started' },
    { step: 'implement', task: 'T1', type: 'started', agent: 'impl-T1', summary: 'T1 started' },
    { step: 'implement', task: 'T1', type: 'completed', agent: 'impl-T1', summary: 'T1 done' },
    { step: 'checks', task: 'T1', type: 'completed', summary: 'green after T1' },
    { step: 'implement', task: 'T2', type: 'started', agent: 'impl-T2', summary: 'T2 started: resume command' },
  ];

  const writePlan = (ids: readonly string[]) =>
    writeFileSync(join(itemDir(name), 'plan.md'), ids.map((id) => `### ${id} — unit\n- **Goal:** x\n`).join('\n'));

  const resume = () => agentic(['resume', '--work', 'demo']);
  const lines = (out: string) => out.trimEnd().split('\n');

  test('summarizes a mid-implement item in at most 15 lines ending with next', () => {
    writeLog(name, midImplement);
    writePlan(['T1', 'T2', 'T3']);

    const result = resume();
    const output = lines(result.out);

    expect(result.code).toBe(0);
    expect(output.length).toBeLessThanOrEqual(15);
    expect(output).toContain(`work: ${name}`);
    expect(output).toContain('status: in_progress');
    expect(output).toContain('phase: implement');
    expect(output).toContain('step: implement T2 (impl-T2) started: T2 started: resume command');
    expect(output).toContain('pending: T2, T3');
    expect(output.at(-1)).toBe(`next: /agentic-implement ${name}`);
  });

  test('lists the last 3 events, one line each', () => {
    writeLog(name, midImplement);
    writePlan(['T1', 'T2']);

    const eventLines = lines(resume().out).filter((line) => line.startsWith('event: '));

    expect(eventLines).toHaveLength(3);
    expect(eventLines.at(-1)).toContain('started implement/T2 T2 started: resume command');
  });

  test('closes the step once completed', () => {
    writeLog(name, [...midImplement, { step: 'implement', task: 'T2', type: 'completed', summary: 'T2 done' }]);

    expect(lines(resume().out)).toContain('step: none');
  });

  test('open escalation drives the next command', () => {
    writeLog(name, [
      ...midImplement,
      { type: 'escalation', summary: 'ADR needed for hooks', data: { id: 'D4', status: 'open', ref: 'adr/0051.md' } },
    ]);
    writePlan(['T1', 'T2']);

    const output = lines(resume().out);

    expect(output).toContain('status: awaiting_decision');
    expect(output).toContain('escalations: 1 open: D4 ADR needed for hooks');
    expect(output.at(-1)).toBe(`next: resolve escalation D4 (ref adr/0051.md), then /agentic-implement ${name}`);
  });

  test('all units done points to review', () => {
    writeLog(name, [
      ...midImplement,
      { step: 'implement', task: 'T2', type: 'completed', summary: 'T2 done' },
      { step: 'checks', task: 'T2', type: 'completed', summary: 'green after T2' },
    ]);
    writePlan(['T1', 'T2']);

    const output = lines(resume().out);

    expect(output).toContain('pending: none');
    expect(output.at(-1)).toBe(`next: /agentic-review ${name}`);
  });

  test('completed playbook points to cleanup', () => {
    writeLog(name, [
      { workflow: 'implement-feature', type: 'started', summary: 'started' },
      { workflow: 'implement-feature', type: 'completed', summary: 'finished' },
    ]);

    const output = lines(resume().out);

    expect(output).toContain('status: done');
    expect(output.at(-1)).toBe(`next: /agentic-cleanup ${name}`);
  });

  test('redacts secret-shaped text', () => {
    const secrets = [
      'sk-abcdefghijklmnopqrstuvwxyz123456',
      'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      'AKIAABCDEFGHIJKLMNOP',
      '-----BEGIN RSA PRIVATE KEY-----',
      'password=hunter2',
      'token=abc',
      'a'.repeat(32),
    ];
    writeLog(name, [
      { workflow: 'implement', type: 'started', summary: 'started' },
      ...secrets.map((secret) => ({ step: 'implement', task: 'T1', type: 'progress', summary: `leak ${secret} end` })),
    ]);

    const result = resume();

    expect(result.code).toBe(0);
    for (const secret of secrets) expect(result.out).not.toContain(secret);
    expect(result.out).toContain('[redacted]');
  });

  test('truncates long summaries to 160 chars per line', () => {
    writeLog(name, [{ workflow: 'implement', type: 'started', summary: `long ${'word '.repeat(100)}` }]);

    for (const line of lines(resume().out)) expect(line.length).toBeLessThanOrEqual(160);
  });

  test('never writes', () => {
    writeLog(name, midImplement);

    resume();

    expect(existsSync(join(itemDir(name), 'state.json'))).toBe(false);
  });

  test('exits 1 with one line when no work item resolves', () => {
    const result = agentic(['resume']);

    expect(result.code).toBe(1);
    expect(result.err.trimEnd().split('\n')).toHaveLength(1);
  });
});

describe('decide', () => {
  const name = '20261108-demo';
  const decisionsPath = () => join(itemDir(name), 'decisions.md');
  const base = ['--tag', 'structural', '--focus', 'tech', '--q', 'Where?', '--a', 'Here', '--why', 'Because'];
  const decide = (extra: readonly string[] = [], flags: readonly string[] = base) => agentic(['decide', '--work', 'demo', ...flags, ...extra]);
  const started: TestEvent[] = [{ workflow: 'grill-tech', type: 'started' }];

  test('appends the next D entry in the exact format and logs a decision event', () => {
    writeLog(name, started);
    writeFileSync(decisionsPath(), '# Decisions\n\n## D1 · minor · product\n**Q:** a\n**A:** b\n**Why:** c\n');

    const result = decide();

    expect(result.code).toBe(0);
    expect(result.out).toBe('D2\n');
    expect(readFileSync(decisionsPath(), 'utf8')).toBe(
      '# Decisions\n\n## D1 · minor · product\n**Q:** a\n**A:** b\n**Why:** c\n\n## D2 · structural · tech\n**Q:** Where?\n**A:** Here\n**Why:** Because\n',
    );
    const event = readLog(name).at(-1);
    expect(event).toMatchObject({
      type: 'decision',
      run: 'a3f9',
      harness: 'claude',
      workflow: 'grill-tech',
      summary: 'D2: Where?',
      data: { id: 'D2', question: 'Where?', answer: 'Here', tag: 'structural', focus: 'tech' },
    });
    expect(event.data).not.toHaveProperty('supersedes');
  });

  test('numbering continues from the highest id', () => {
    writeLog(name, started);
    writeFileSync(decisionsPath(), '# Decisions\n\n## D9 · minor · tech\n**Q:** a\n**A:** b\n**Why:** c\n');

    expect(decide().out).toBe('D10\n');
  });

  test('origin and supersedes variants', () => {
    writeLog(name, started);
    writeFileSync(decisionsPath(), '# Decisions\n\n## D1 · minor · tech\n**Q:** a\n**A:** b\n**Why:** c\n');
    const before = readFileSync(decisionsPath(), 'utf8');

    const result = decide(['--origin', 'recommended', '--supersedes', 'D1']);

    expect(result.code).toBe(0);
    const after = readFileSync(decisionsPath(), 'utf8');
    expect(after.startsWith(before)).toBe(true);
    expect(after.slice(before.length)).toBe(
      '\n## D2 · structural · tech\n**Q:** Where?\n**A:** Here (origin: recommended)\n**Why:** Because\n**Supersedes:** D1\n',
    );
    expect(readLog(name).at(-1).data.supersedes).toBe('D1');
  });

  test('missing decisions.md is created with a header and starts at D1', () => {
    writeLog(name, started);

    expect(decide().out).toBe('D1\n');
    expect(readFileSync(decisionsPath(), 'utf8')).toBe('# Decisions\n\n## D1 · structural · tech\n**Q:** Where?\n**A:** Here\n**Why:** Because\n');
  });

  test('step defaults to the open grill step, --step overrides, else null', () => {
    writeLog(name, [{ workflow: 'grill-tech', type: 'started' }, { workflow: 'grill-tech', step: 'grill', type: 'started' }]);
    decide();
    decide(['--step', 'other']);
    expect(readLog(name).slice(-2).map((event) => event.step)).toEqual(['grill', 'other']);

    writeLog(name, started);
    decide();
    expect(readLog(name).at(-1).step).toBeNull();
  });

  const flagsWith = (name: string, value: string) => base.map((item, index) => (base[index - 1] === name ? value : item));
  const withoutFlag = (name: string) => base.filter((item, index) => item !== name && base[index - 1] !== name);
  const invalid: readonly (readonly [string, readonly string[]])[] = [
    ['bad tag', flagsWith('--tag', 'huge')],
    ['bad focus', flagsWith('--focus', 'ux')],
    ['missing --q', withoutFlag('--q')],
    ['missing --why', withoutFlag('--why')],
    ['bad supersedes shape', [...base, '--supersedes', 'x1']],
    ['unknown supersedes id', [...base, '--supersedes', 'D7']],
  ];

  for (const [label, flags] of invalid) {
    test(`${label}: exit 1, nothing written`, () => {
      writeLog(name, started);
      const log = readFileSync(join(itemDir(name), 'events.jsonl'), 'utf8');
      const decisions = '# Decisions\n\n## D1 · minor · tech\n**Q:** a\n**A:** b\n**Why:** c\n';
      writeFileSync(decisionsPath(), decisions);

      const result = decide([], flags);

      expect(result.code).toBe(1);
      expect(readFileSync(decisionsPath(), 'utf8')).toBe(decisions);
      expect(readFileSync(join(itemDir(name), 'events.jsonl'), 'utf8')).toBe(log);
    });
  }

  test('no started run: exit 1, decisions.md not created', () => {
    mkdirSync(itemDir(name), { recursive: true });

    expect(decide().code).toBe(1);
    expect(existsSync(decisionsPath())).toBe(false);
  });
});

describe('step', () => {
  const name = '20261108-demo';
  const started: TestEvent[] = [{ workflow: 'implement', type: 'started' }];
  const templatePath = join(import.meta.dir, '..', 'references', 'brief-template.md');
  let home = '';

  beforeEach(() => {
    home = join(sandbox, 'home');
    mkdirSync(home);
  });

  const writeConfig = (config: object) => writeFileSync(join(sandbox, '.agentic.json'), JSON.stringify(config));
  const step = (key: string, extra: readonly string[] = []) => {
    writeLog(name, started);

    return agentic(['step', key, '--work', 'demo', ...extra], { env: { HOME: home } });
  };
  const tier = (key: string, extra: readonly string[] = []) => {
    const result = step(key, extra);
    expect(result.code).toBe(0);

    return result.out.match(/Model: (.+) · Effort: (.+)\n/)?.slice(1, 3);
  };

  test('template file holds exactly one fenced block', () => {
    const fences = readFileSync(templatePath, 'utf8').split('\n').filter((line) => line.startsWith('```'));

    expect(fences).toHaveLength(2);
  });

  test.each(['implement', 'review.ub-mode', 'context.docs', 'a1', 'x.y-z'])('accepts key %s', (key) => {
    expect(step(key).code).toBe(0);
  });

  test.each(['Implement', '1abc', 'a..b', 'a.', 'a b', '.a'])('rejects key %s with exit 1', (key) => {
    const result = agentic(['step', key, '--work', 'demo'], { env: { HOME: home } });

    expect(result.code).toBe(1);
    expect(result.err).toContain('invalid step key');
  });

  test.each([
    ['implement', 'sonnet', 'medium'],
    ['explore', 'sonnet', 'medium'],
    ['context.docs', 'sonnet', 'medium'],
    ['review', 'sonnet', 'medium'],
    ['review.ub-mode', 'sonnet', 'medium'],
    ['review.review-i18n', 'sonnet', 'medium'],
    ['review.code-review', 'opus', 'high'],
    ['review.review-access-tenant-isolation', 'opus', 'high'],
    ['audit', 'opus', 'high'],
    ['grill', 'opus', 'high'],
    ['chore', 'haiku', 'low'],
  ])('claude tier for %s is %s/%s', (key, model, effort) => {
    expect(tier(key)).toEqual([model, effort]);
  });

  test('config steps.claude.<key> wins over the built-in tier', () => {
    writeConfig({ steps: { claude: { implement: { model: 'opus', effort: 'high' } } } });

    expect(tier('implement')).toEqual(['opus', 'high']);
  });

  test('config parent entry applies to child keys, child entry beats it', () => {
    writeConfig({ steps: { claude: { review: { model: 'haiku' }, 'review.ub-mode': { effort: 'low' } } } });

    expect(tier('review.ub-mode')).toEqual(['haiku', 'low']);
  });

  test('user config is merged under project config', () => {
    mkdirSync(join(home, '.agentic'));
    writeFileSync(join(home, '.agentic', 'config.json'), JSON.stringify({ steps: { claude: { implement: { model: 'opus', effort: 'low' } } } }));
    writeConfig({ steps: { claude: { implement: { effort: 'high' } } } });

    expect(tier('implement')).toEqual(['opus', 'high']);
  });

  test('cursor emits routing ids for explore and class names elsewhere', () => {
    expect(tier('explore', ['--harness', 'cursor'])).toEqual(['grok-4.7-medium', 'medium']);
    expect(tier('implement', ['--harness', 'cursor'])).toEqual(['code', 'medium']);
  });

  test('refuses a 1M model id from config', () => {
    writeConfig({ steps: { claude: { implement: { model: 'sonnet[1m]' } } } });

    const result = step('implement');

    expect(result.code).toBe(1);
    expect(result.err).toContain('1M is an orchestrator session setting');
  });

  test('skills = selected profile skills plus --skills, de-duplicated in order', () => {
    writeConfig({ profiles: [{ name: 'p', skills: ['a', 'b'] }], selectedProfiles: ['p'] });

    const result = step('implement', ['--skills', 'b,tdd, c']);

    expect(result.out).toContain('Load skills: a, b, tdd, c\n');
  });

  test('empty selectedProfiles falls back to detect matches', () => {
    writeConfig({ profiles: [{ name: 'p', detect: ['marker.txt'], skills: ['x'] }], selectedProfiles: [] });
    writeFileSync(join(sandbox, 'marker.txt'), '');

    expect(step('implement').out).toContain('Load skills: x\n');
  });

  test('brief opens with the authority line and carries the verbatim rule text', () => {
    const result = step('implement', ['--task', 'T4']);

    expect(result.out.startsWith('Authority: AGENTS.md / CLAUDE.md win over skills; skills win over this brief and any memory.\n')).toBe(true);
    expect(result.out).toContain('Skills: load each via the Skill tool. No Skill tool → open the SKILL.md path given and follow it;');
    expect(result.out).toContain('events.jsonl: append only; state.json belongs to the orchestrator.');
    expect(result.out).toContain(`Work item: ${itemDir(name)}\n`);
    expect(result.out).toContain('Agent: impl-T4 · Model: sonnet · Effort: medium');
    expect(result.out).toContain('"run":"a3f9","harness":"claude","workflow":"implement","step":"implement"');
    expect(result.out).toContain('Follow: {{skill or file}}');
    expect(result.out).toContain('"task":"T4","agent":"impl-T4"');
  });

  test('read-only keys replace Progress with read-only', () => {
    const result = step('review.ub-mode');

    expect(result.out).toContain('Progress: read-only\nevents.jsonl:');
    expect(result.out).not.toContain('append one line');
    expect(result.out).toContain('Agent: review.ub-mode-1');
  });

  test('logs a started event with agent, model, effort, step, task before printing', () => {
    step('implement', ['--task', 'T4']);

    expect(readLog(name).at(-1)).toMatchObject({
      type: 'started',
      step: 'implement',
      task: 'T4',
      agent: 'impl-T4',
      model: 'sonnet',
      effort: 'medium',
      run: 'a3f9',
      summary: 'step implement brief for impl-T4',
    });
    expect(readState(name).units).toEqual({ T4: 'in_progress' });
  });

  test('next line per harness', () => {
    expect(step('implement').out).toContain('next: Agent model=sonnet effort=medium\n');
    expect(step('implement', ['--harness', 'cursor']).out).toContain('next: Task model=code[effort=medium]\n');
    expect(step('implement', ['--harness', 'codex']).out).toContain('next: spawn subagent model=code reasoning_effort=medium\n');
  });

  test('harness defaults to the latest run harness', () => {
    writeLog(name, [{ workflow: 'implement', type: 'started' }]);
    const log = readLog(name);
    writeFileSync(join(itemDir(name), 'events.jsonl'), `${JSON.stringify({ ...log[0], harness: 'cursor' })}\n`);

    const result = agentic(['step', 'implement', '--work', 'demo'], { env: { HOME: home } });

    expect(result.out).toContain('next: Task model=code[effort=medium]');
  });

  test('without a resolvable work item exits 1 listing candidates', () => {
    writeLog(name, started);

    const result = agentic(['step', 'implement'], { env: { HOME: home } });

    expect(result.code).toBe(1);
    expect(result.err).toContain(name);
  });
});

describe('parallel units', () => {
  const name = '20261108-demo';
  const workspaceEvent: TestEvent = {
    workflow: 'implement',
    type: 'started',
    data: { workspace: { path: '/ws/main-branch', branch: 'feat/demo' } },
  };
  const repo = () => join(sandbox, 'repo');
  const home = () => join(sandbox, 'home');
  const unitPath = (unit: string, base = join(sandbox, 'repo-worktrees')) => join(base, `${name}-${unit}`);

  beforeEach(() => {
    mkdirSync(repo());
    mkdirSync(home());
    git(repo(), ['init', '-q']);
  });

  const stepUnit = (extra: readonly string[] = ['--unit', 'T5']) => {
    agentic(['state', '--work', 'demo']);

    return agentic(['step', 'implement', '--work', 'demo', ...extra], { cwd: repo(), env: { HOME: home() } });
  };

  test('brief workspace is the unit worktree and the add command is printed', () => {
    writeLog(name, [workspaceEvent]);

    const result = stepUnit();

    expect(result.code).toBe(0);
    expect(result.out).toContain(`Workspace: ${unitPath('T5')}`);
    expect(result.out).toContain(`worktree: git worktree add -b feat/demo/T5 ${unitPath('T5')} feat/demo\nnext: `);
    expect(result.out).toContain('"task":"T5","agent":"impl-T5"');
  });

  test('started event records the worktree and the unit implies the task', () => {
    writeLog(name, [workspaceEvent]);

    stepUnit();

    expect(readLog(name).at(-1)).toMatchObject({
      type: 'started',
      task: 'T5',
      data: { worktree: { path: unitPath('T5'), branch: 'feat/demo/T5' } },
    });
  });

  test('config worktrees is resolved against the main checkout with {repo}', () => {
    writeFileSync(join(repo(), '.agentic.json'), JSON.stringify({ worktrees: '../trees/{repo}' }));
    writeLog(name, [workspaceEvent]);

    expect(stepUnit().out).toContain(`worktree: git worktree add -b feat/demo/T5 ${unitPath('T5', join(sandbox, 'trees', 'repo'))} feat/demo`);
  });

  test('without a recorded workspace exits 1 and logs nothing', () => {
    writeLog(name, [{ workflow: 'implement', type: 'started' }]);

    const result = stepUnit();

    expect(result.code).toBe(1);
    expect(result.err).toContain('--unit needs');
    expect(readLog(name)).toHaveLength(1);
  });

  test('without --unit no worktree line and no data', () => {
    writeLog(name, [workspaceEvent]);

    const result = stepUnit(['--task', 'T5']);

    expect(result.out).not.toContain('worktree:');
    expect(readLog(name).at(-1)?.data).toBeUndefined();
  });

  const unitStarted = (unit: string): TestEvent => ({
    step: 'implement',
    task: unit,
    type: 'started',
    data: { worktree: { path: `/wt/${unit}`, branch: `feat/demo/${unit}` } },
  });
  const resumeLines = () => agentic(['resume', '--work', 'demo']).out.trimEnd().split('\n');

  test('resume lists pending units in started order with merge-back commands', () => {
    writeLog(name, [workspaceEvent, unitStarted('T2'), unitStarted('T3')]);

    const lines = resumeLines();
    const start = lines.indexOf('merge-back:');

    expect(lines.slice(start, start + 7)).toEqual([
      'merge-back:',
      '  git merge --no-ff feat/demo/T2',
      '  git worktree remove /wt/T2',
      '  git branch -d feat/demo/T2',
      '  git merge --no-ff feat/demo/T3',
      '  git worktree remove /wt/T3',
      '  git branch -d feat/demo/T3',
    ]);
    expect(lines.at(-1)).toStartWith('next: ');
  });

  test('a unit with a later checks completion is no longer pending', () => {
    writeLog(name, [workspaceEvent, unitStarted('T2'), unitStarted('T3'), { step: 'checks', task: 'T2', type: 'completed' }]);

    const output = resumeLines().join('\n');

    expect(output).not.toContain('feat/demo/T2');
    expect(output).toContain('git merge --no-ff feat/demo/T3');
  });

  test('no worktree units prints merge-back: none', () => {
    writeLog(name, [workspaceEvent]);

    expect(resumeLines()).toContain('merge-back: none');
  });
});

describe('review eligible', () => {
  const name = '20261108-demo';
  const gates = {
    alwaysOn: [{ skill: 'code-review' }, { skill: 'review-access-tenant-isolation' }],
    conditional: [
      { skill: 'review-api-contract', triggers: { changed: ['src/api/**'], added: [] } },
      { skill: 'review-seeds-devx', triggers: { changed: ['seed/**'], added: ['packages/*/package.json'] } },
      { skill: 'review-docs', triggers: { changed: ['docs/**'], added: [] } },
    ],
    onDemand: [{ skill: 'review-i18n' }],
    ciChecks: [{ name: 'docs-ci' }],
  };
  const repo = () => join(sandbox, 'repo');
  const write = (path: string, content = 'x') => {
    mkdirSync(join(repo(), path, '..'), { recursive: true });
    writeFileSync(join(repo(), path), content);
  };
  const commit = (message: string) => {
    git(repo(), ['add', '-A']);
    git(repo(), ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message]);
  };
  const eligible = (extra: readonly string[] = []) => agentic(['review', 'eligible', '--base', 'base', '--work', 'demo', ...extra], { cwd: repo() });
  const names = (result: { out: string }) => JSON.parse(result.out).reviewers.map((reviewer: { name: string }) => reviewer.name);

  beforeEach(() => {
    mkdirSync(repo());
    git(repo(), ['init', '-q', '-b', 'main']);
    write('.agentic/review-gates.json', JSON.stringify(gates));
    write('src/api/route.ts');
    write('src/auth/login.ts');
    commit('base');
    git(repo(), ['tag', 'base']);
    writeLog(name, [{ type: 'started' }]);
  });

  test('alwaysOn only on an empty diff, one JSON line', () => {
    const result = eligible();

    expect(result.code).toBe(0);
    expect(result.out).toBe(
      `${JSON.stringify({
        reviewers: [
          { name: 'code-review', reason: 'alwaysOn' },
          { name: 'review-access-tenant-isolation', reason: 'alwaysOn' },
        ],
      })}\n`,
    );
  });

  test('conditional reviewers join on changed and added globs, in gate-file order, doc-style absent', () => {
    write('src/api/route.ts', 'changed');
    write('packages/billing/package.json');
    commit('work');

    const result = eligible();

    expect(JSON.parse(result.out).reviewers).toEqual([
      { name: 'code-review', reason: 'alwaysOn' },
      { name: 'review-access-tenant-isolation', reason: 'alwaysOn' },
      { name: 'review-api-contract', reason: 'changed: src/api/route.ts' },
      { name: 'review-seeds-devx', reason: 'added: packages/billing/package.json' },
    ]);
  });

  test('an added glob does not match a merely changed file', () => {
    write('src/api/route.ts', 'changed');
    commit('work');

    expect(names(eligible())).not.toContain('review-seeds-devx');
  });

  test('onDemand only through --only, unknown name exits 1', () => {
    expect(names(eligible())).not.toContain('review-i18n');
    expect(JSON.parse(eligible(['--only', 'review-i18n']).out).reviewers.at(-1)).toEqual({ name: 'review-i18n', reason: 'onDemand: --only' });

    const unknown = eligible(['--only', 'nope']);
    expect(unknown.code).toBe(1);
    expect(unknown.err).toContain('nope');
  });

  test('missing --base and bad --iteration exit 2', () => {
    expect(agentic(['review', 'eligible', '--work', 'demo'], { cwd: repo() }).code).toBe(2);
    expect(eligible(['--iteration', '0']).code).toBe(2);
  });

  describe('iteration', () => {
    const report = (iteration: number, reviewer: string, verdict: string) => {
      mkdirSync(join(itemDir(name), 'reviews'), { recursive: true });
      writeFileSync(join(itemDir(name), 'reviews', `${iteration}-${reviewer}.md`), `verdict: ${verdict}\n\n## Findings\n`);
    };

    test('only reviewers with changes-requested in the previous report re-run', () => {
      report(1, 'code-review', 'changes-requested (1 major)');
      report(1, 'review-access-tenant-isolation', 'pass');

      expect(JSON.parse(eligible(['--iteration', '2']).out).reviewers).toEqual([
        { name: 'code-review', reason: 'changes-requested in reviews/1-code-review.md' },
      ]);
    });

    test('a reviewer without a report is not included', () => {
      expect(names(eligible(['--iteration', '2']))).toEqual([]);
    });

    test('security reviewers join when auth paths changed', () => {
      write('src/auth/login.ts', 'changed');
      commit('work');

      expect(JSON.parse(eligible(['--iteration', '2']).out).reviewers).toEqual([
        { name: 'review-access-tenant-isolation', reason: 'security: auth/tenant paths changed' },
      ]);
    });

    test('security settings in the gate file override the defaults', () => {
      write('.agentic/review-gates.json', JSON.stringify({ ...gates, security: { reviewers: ['code-review'], paths: ['src/api/**'] } }));
      write('src/api/route.ts', 'changed');
      commit('work');

      expect(names(eligible(['--iteration', '2']))).toEqual(['code-review']);
    });
  });

  describe('--all', () => {
    test('without --reason exits 2', () => {
      expect(eligible(['--all']).code).toBe(2);
    });

    test('returns every entry except ciChecks and logs a note event', () => {
      const result = eligible(['--all', '--reason', 'big refactor']);

      expect(names(result)).toEqual([
        'code-review',
        'review-access-tenant-isolation',
        'review-api-contract',
        'review-seeds-devx',
        'review-docs',
        'review-i18n',
      ]);
      expect(JSON.parse(result.out).reviewers[0].reason).toBe('widened: big refactor');
      expect(readLog(name).at(-1)).toMatchObject({
        type: 'note',
        step: 'review',
        summary: 'review eligible --all: big refactor',
        data: { reason: 'big refactor' },
      });
    });

    test('without a current run exits 1 and logs nothing', () => {
      writeLog(name, []);

      const result = eligible(['--all', '--reason', 'r']);

      expect(result.code).toBe(1);
      expect(result.err).toContain('run: required');
    });

    test('the plain command writes no event', () => {
      eligible();

      expect(readLog(name)).toHaveLength(1);
    });
  });

  describe('fallback', () => {
    test('uses .agentic.json reviewers when review-gates.json is absent', () => {
      rmSync(join(repo(), '.agentic', 'review-gates.json'));
      write('.agentic.json', JSON.stringify({ reviewers: ['code-review', 'ub-mode'] }));

      expect(JSON.parse(eligible().out).reviewers).toEqual([
        { name: 'code-review', reason: 'fallback: no review-gates.json' },
        { name: 'ub-mode', reason: 'fallback: no review-gates.json' },
      ]);
    });

    test('neither file exits 1 with a reason', () => {
      rmSync(join(repo(), '.agentic', 'review-gates.json'));

      const result = eligible();

      expect(result.code).toBe(1);
      expect(result.err).toContain('review-gates.json');
    });
  });
});

describe('hub sync', () => {
  const name = '20261108-demo';
  const fakeGhScript = `#!/bin/bash
echo "$*" >> "$FAKE_GH_DIR/log"
args="$*"
case "$args" in
  "repo view"*) echo o/r ;;
  "api user"*) echo me ;;
  *"-X POST"*)
    failures=$(cat "$FAKE_GH_DIR/failures" 2>/dev/null || echo 0)
    if [ "$failures" != "0" ]; then
      [ "$failures" != "always" ] && echo $((failures - 1)) > "$FAKE_GH_DIR/failures"
      echo "dial tcp: lookup api.github.com: no such host" >&2
      exit 1
    fi
    bodyFile="\${args##*body=@}"
    cp "$bodyFile" "$FAKE_GH_DIR/last-body"
    marker=$(head -n 1 "$bodyFile")
    id=$(( $(wc -l < "$FAKE_GH_DIR/comments" 2>/dev/null || echo 0) + 1 ))
    printf '%s\\t%s\\n' "$id" "$marker" >> "$FAKE_GH_DIR/comments"
    ;;
  *"-X PATCH"*) ;;
  *"--paginate"*)
    marker=$(echo "$args" | sed -E 's/.*startswith\\("(.*)"\\).*/\\1/')
    [ -f "$FAKE_GH_DIR/comments" ] && awk -F'\\t' -v m="$marker" '$2==m{print $1}' "$FAKE_GH_DIR/comments"
    ;;
esac
exit 0
`;
  let ghDir = '';

  const fakeGhEnv = () => ({ AGENTIC_GH: join(ghDir, 'gh'), FAKE_GH_DIR: ghDir, AGENTIC_RETRY_MS: '1' });
  const ghLog = () => (existsSync(join(ghDir, 'log')) ? readFileSync(join(ghDir, 'log'), 'utf8').split('\n').filter(Boolean) : []);
  const writes = (verb: 'POST' | 'PATCH') => ghLog().filter((line) => line.includes(`-X ${verb}`));
  const sync = (...args: string[]) => agentic(['hub', 'sync', '--work', 'demo', ...args], { env: fakeGhEnv() });

  beforeEach(() => {
    ghDir = join(sandbox, 'gh');
    mkdirSync(ghDir);
    writeFileSync(join(ghDir, 'gh'), fakeGhScript);
    chmodSync(join(ghDir, 'gh'), 0o755);
    writeLog(name, [
      { type: 'started', step: null, model: 'sonnet' },
      { type: 'artifact', step: 'plan', data: { name: 'plan', path: 'plan.md', hub: 12 } },
    ]);
    writeFileSync(join(itemDir(name), 'decisions.md'), '# Decisions\nD1 ok\n');
  });

  test('AC15: first run creates three marker comments, second run only updates them', () => {
    const first = sync();
    expect(first.code).toBe(0);
    const markers = first.out.split('\n').filter(Boolean).map((line) => line.replace(/^created | \(\d+ chars\)$/g, ''));
    expect(markers).toEqual([
      '<!-- agentic:file decisions.md -->',
      '<!-- agentic:file state.json -->',
      '<!-- agentic:run a3f9 -->',
    ]);
    expect(writes('POST')).toHaveLength(3);

    const second = sync();
    expect(second.code).toBe(0);
    expect(second.out).toContain('updated <!-- agentic:run a3f9 -->');
    expect(writes('POST')).toHaveLength(3);
    expect(writes('PATCH')).toHaveLength(3);
  });

  test('run comment carries header line and events, posted to the hub issue', () => {
    sync();

    expect(ghLog().some((line) => line.includes('repos/o/r/issues/12/comments'))).toBe(true);
    const lastBody = readFileSync(join(ghDir, 'last-body'), 'utf8');
    expect(lastBody).toStartWith('<!-- agentic:run a3f9 -->\nimplement · claude · sonnet · @me\n```jsonl\n');
    expect(lastBody).toContain('"type":"artifact"');
  });

  test('AC16: a token in a mirrored file blocks every write and prints a redacted line', () => {
    const token = `ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2'}`;
    writeFileSync(join(itemDir(name), 'decisions.md'), `# Decisions\nkey ${token}\n`);

    const result = sync();

    expect(result.code).toBe(1);
    expect(result.err + result.out).toContain('deny-list: decisions.md:2: key ghp_…');
    expect(result.err + result.out).not.toContain(token);
    expect(writes('POST')).toHaveLength(0);
    expect(writes('PATCH')).toHaveLength(0);
  });

  test('AC17: network failure retries three times then exits 1 with command and error', () => {
    writeFileSync(join(ghDir, 'failures'), 'always');

    const result = sync();

    expect(result.code).toBe(1);
    expect(result.err).toContain('api -X POST repos/o/r/issues/12/comments');
    expect(result.err).toContain('no such host');
    expect(writes('POST')).toHaveLength(4);
  });

  test('AC17: two transient failures then success exits 0', () => {
    writeFileSync(join(ghDir, 'failures'), '2');

    const result = sync();

    expect(result.code).toBe(0);
    expect(writes('POST')).toHaveLength(5);
  });

  test('a body over 60000 chars is split into part comments', () => {
    writeFileSync(join(itemDir(name), 'decisions.md'), 'line of text\n'.repeat(6000));

    const result = sync();

    expect(result.code).toBe(0);
    expect(result.out).toContain('<!-- agentic:file decisions.md -->');
    expect(result.out).toContain('<!-- agentic:file decisions.md part 2 -->');
  });

  test('no hub in state is skipped with exit 0', () => {
    writeLog(name, [{ type: 'started', step: null }]);

    const result = sync();

    expect(result.code).toBe(0);
    expect(result.out).toContain('skipped: no hub');
    expect(ghLog()).toHaveLength(0);
  });

  test('gh not found is skipped with exit 0', () => {
    const result = agentic(['hub', 'sync', '--work', 'demo'], { env: { AGENTIC_GH: join(sandbox, 'missing-gh') } });

    expect(result.code).toBe(0);
    expect(result.out).toContain('skipped: gh not found');
  });

  test('hub from a choice decision (live shape) is derived and synced', () => {
    const decision = { type: 'decision', data: { kind: 'choice', key: 'hub', value: 135 } } as const;
    expect(deriveState([decision]).hub).toBe(135);

    writeLog(name, [{ type: 'started', step: null, model: 'sonnet' }, decision]);
    const result = sync();

    expect(result.out).not.toContain('skipped');
    expect(result.code).toBe(0);
  });

  test('unknown --run exits 1 without writes', () => {
    const result = sync('--run', 'ffff');

    expect(result.code).toBe(1);
    expect(writes('POST')).toHaveLength(0);
  });
});

describe('cleanup check', () => {
  const name = '20261108-demo';
  const prUrl = 'https://github.com/o/r/pull/7';
  let repo = '';
  let ghPath = '';

  const readyEvents = (workspace: Record<string, unknown> = { path: join(sandbox, 'gone-worktree'), branch: 'gone-branch' }): readonly TestEvent[] => [
    { type: 'started', step: null, data: { workspace } },
    { type: 'artifact', step: 'implement', data: { name: 'pr', pr: { url: prUrl, round: 1 } } },
    { type: 'completed', step: null },
    { type: 'started', step: 'cleanup', workflow: 'cleanup' },
  ];

  const check = (prState = 'MERGED', ...args: string[]) =>
    agentic(['cleanup', 'check', '--work', 'demo', ...args], {
      cwd: repo,
      env: { AGENTIC_GH: ghPath, FAKE_PR: JSON.stringify({ state: prState, mergedAt: '2026-11-08T12:00:00Z' }) },
    });

  const missing = (out: string) => out.split('\n').filter((line) => line.startsWith('missing: '));

  beforeEach(() => {
    repo = join(sandbox, 'repo');
    mkdirSync(repo);
    git(repo, ['init', '-q', '-b', 'main']);
    git(repo, ['commit', '-q', '--allow-empty', '-m', 'init']);
    ghPath = join(sandbox, 'gh');
    writeFileSync(ghPath, '#!/bin/bash\necho "$FAKE_PR"\n');
    chmodSync(ghPath, 0o755);
    writeLog(name, readyEvents());
  });

  test('AC18: all preconditions hold, exits 0 with ready line', () => {
    const result = check();

    expect(result.code).toBe(0);
    expect(result.out).toBe('ready: all cleanup preconditions hold\n');
  });

  test('gh not found skips only the PR state check', () => {
    const result = agentic(['cleanup', 'check', '--work', 'demo'], { cwd: repo, env: { AGENTIC_GH: join(sandbox, 'missing-gh') } });

    expect(result.code).toBe(0);
    expect(result.out).toContain('skipped: PR state check, gh not found (GitHub-only)');
    expect(result.out).toContain('ready: all cleanup preconditions hold');
  });

  test('gh not found still reports the other gaps', () => {
    writeLog(name, readyEvents({ path: join(sandbox, 'gone-worktree'), branch: 'main' }));

    const result = agentic(['cleanup', 'check', '--work', 'demo'], { cwd: repo, env: { AGENTIC_GH: join(sandbox, 'missing-gh') } });

    expect(result.code).toBe(1);
    expect(result.out).toContain('skipped: PR state check');
    expect(missing(result.out)).toEqual(['missing: branch still exists: main']);
  });

  test('workflow not completed names the latest workflow-level event', () => {
    writeLog(name, [
      { type: 'started', step: null, data: { workspace: { path: join(sandbox, 'gone-worktree'), branch: 'gone-branch' } } },
      { type: 'artifact', step: 'implement', data: { name: 'pr', pr: { url: prUrl } } },
      { type: 'failed', step: null },
    ]);

    const result = check();

    expect(result.code).toBe(1);
    expect(missing(result.out)).toEqual(['missing: workflow not completed: latest workflow-level event is failed (implement)']);
  });

  test('no workflow-level event is a gap', () => {
    writeLog(name, [{ type: 'progress', step: 'implement', data: { workspace: { path: join(sandbox, 'gone-worktree'), branch: 'gone-branch' }, pr: {} } }]);

    const result = check();

    expect(missing(result.out)).toContain('missing: workflow not completed: no workflow-level event');
  });

  test('missing pr url is a gap and gh is not needed', () => {
    writeLog(name, [
      { type: 'started', step: null, data: { workspace: { path: join(sandbox, 'gone-worktree'), branch: 'gone-branch' } } },
      { type: 'completed', step: null },
    ]);

    const result = check();

    expect(result.code).toBe(1);
    expect(missing(result.out)).toEqual(['missing: no pr url logged']);
  });

  test('open pr is a gap', () => {
    const result = check('OPEN');

    expect(result.code).toBe(1);
    expect(missing(result.out)).toEqual(['missing: pr not merged: OPEN']);
  });

  test('gh failure text is reported as a gap', () => {
    writeFileSync(ghPath, '#!/bin/bash\necho "no such pr" >&2\nexit 1\n');

    const result = check();

    expect(result.code).toBe(1);
    expect(missing(result.out)).toHaveLength(1);
    expect(missing(result.out)[0]).toContain('no such pr');
  });

  test('existing branch is a gap', () => {
    git(repo, ['branch', 'gone-branch']);

    const result = check();

    expect(result.code).toBe(1);
    expect(missing(result.out)).toEqual(['missing: branch still exists: gone-branch']);
  });

  test('listed worktree is a gap', () => {
    const path = join(sandbox, 'live-worktree');
    git(repo, ['worktree', 'add', '-q', '--detach', path]);
    writeLog(name, readyEvents({ path, branch: 'gone-branch' }));

    const result = check();

    expect(result.code).toBe(1);
    expect(missing(result.out)).toEqual([`missing: worktree still present: ${path}`]);
  });

  test('no workspace logged gives branch and path gaps', () => {
    writeLog(name, readyEvents().map((event, index) => (index === 0 ? { ...event, data: {} } : event)));

    const result = check();

    expect(result.code).toBe(1);
    expect(missing(result.out)).toEqual(['missing: no workspace branch logged', 'missing: no workspace path logged']);
  });

  test('stray .run and .tmp files are listed one per file', () => {
    mkdirSync(join(itemDir(name), 'sub'));
    writeFileSync(join(itemDir(name), 'a.run'), '');
    writeFileSync(join(itemDir(name), 'sub', 'b.tmp'), '');
    writeFileSync(join(itemDir(name), 'keep.md'), '');

    const result = check();

    expect(result.code).toBe(1);
    expect(missing(result.out)).toEqual(['missing: stray file: a.run', 'missing: stray file: sub/b.tmp']);
  });

  test('unknown flag exits 2', () => {
    const result = check('MERGED', '--bogus');

    expect(result.code).toBe(2);
  });

  test('help lists cleanup check', () => {
    expect(agentic(['--help']).err + agentic(['--help']).out).toContain('cleanup check');
  });
});

describe('hook spawn', () => {
  const name = '20261108-demo';
  const hookScript = join(import.meta.dir, 'hook.sh');
  let workspace = '';

  beforeEach(() => {
    workspace = join(sandbox, 'ws');
    mkdirSync(workspace);
  });

  const openItem = (extra: readonly TestEvent[] = []) =>
    writeLog(name, [
      { workflow: 'implement', type: 'started', data: { workspace: { path: workspace, branch: 'b' } } },
      { workflow: 'implement', type: 'started', step: 'implement', agent: 'impl-T9', model: 'sonnet' },
      ...extra,
    ]);

  const briefLines = (omit: readonly string[] = []) =>
    [
      'Step: implement',
      `Work item: ${itemDir(name)}`,
      'Agent: impl-T9 · Model: sonnet · Effort: medium',
      'Skills: load each via the Skill tool.',
      'Progress: append a line to events.jsonl',
    ]
      .filter((line) => !omit.some((prefix) => line.startsWith(prefix)))
      .join('\n');

  const payload = (prompt: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ cwd: workspace, tool_name: 'Agent', tool_input: { prompt }, ...extra });

  const hook = (input: string, args: readonly string[] = [], cwd = sandbox) => {
    const result = Bun.spawnSync([process.execPath, scriptPath, 'hook', 'spawn', ...args], {
      cwd,
      env: { ...process.env, AGENTIC_OUTPUT: outputRoot },
      stdin: new TextEncoder().encode(input),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
  };

  test('allows a complete brief with a prior started event silently', () => {
    openItem();

    expect(hook(payload(briefLines()))).toEqual({ code: 0, out: '', err: '' });
  });

  test('read-only word replaces the Progress line', () => {
    openItem();

    expect(hook(payload(`${briefLines(['Progress'])}\nProgress: read-only`)).code).toBe(0);
    expect(hook(payload(`${briefLines(['Progress'])}\nThis agent is read-only.`)).code).toBe(0);
  });

  test.each([
    ['Step', 'Step:'],
    ['Work item', 'Work item:'],
    ['Skills', 'Skills:'],
    ['Progress', 'Progress:'],
    ['Agent', 'Agent:'],
  ])('denies a brief missing %s', (prefix, named) => {
    openItem();
    const result = hook(payload(briefLines([prefix])));

    expect(result.code).toBe(2);
    expect(result.err).toContain(named);
    const decision = JSON.parse(result.out).hookSpecificOutput;
    expect(decision.permissionDecision).toBe('deny');
    expect(decision.hookEventName).toBe('PreToolUse');
    expect(decision.permissionDecisionReason).toContain('agentic.ts step');
  });

  test('deny message carries the step command and expected model and effort', () => {
    openItem();
    const result = hook(payload(briefLines(['Skills'])));

    expect(result.err).toContain(`${scriptPath} step implement --unit`);
    expect(result.err).not.toContain('.agents/skills');
    expect(result.err).toContain('--agent impl-T9 --work 20261108-demo');
    expect(result.err).toContain('model sonnet');
    expect(result.err).toContain('effort medium');
  });

  test('denies when the agent label has no prior started event', () => {
    openItem();
    const result = hook(payload(briefLines().replace('impl-T9', 'impl-T10')));

    expect(result.code).toBe(2);
    expect(result.err).toContain('started event');
  });

  test('denies a work item path that does not exist or is archived', () => {
    openItem();
    const missing = hook(payload(briefLines().replace(itemDir(name), join(outputRoot, 'nope'))));
    const archived = hook(payload(briefLines().replace(itemDir(name), join(outputRoot, '_archive', name))));

    expect(missing.code).toBe(2);
    expect(archived.code).toBe(2);
  });

  test('Work item: none allows silently', () => {
    openItem();

    expect(hook(payload('Step: x\nWork item: none'))).toEqual({ code: 0, out: '', err: '' });
  });

  test('cwd matching no open item allows and writes nothing', () => {
    openItem();
    const before = readFileSync(join(itemDir(name), 'events.jsonl'), 'utf8');
    const result = hook(payload('nothing', { cwd: sandbox }));

    expect(result).toEqual({ code: 0, out: '', err: '' });
    expect(readFileSync(join(itemDir(name), 'events.jsonl'), 'utf8')).toBe(before);
  });

  test('a completed run is not open', () => {
    openItem([{ workflow: 'implement', type: 'completed' }]);

    expect(hook(payload('nothing')).code).toBe(0);
  });

  test('item without workspace matches the main checkout cwd', () => {
    writeLog(name, [{ workflow: 'implement', type: 'started' }]);

    expect(hook(payload('nothing'), [], sandbox).code).toBe(0);
    expect(hook(payload('nothing', { cwd: sandbox })).code).toBe(2);
  });

  test('--work forces the item', () => {
    openItem();

    expect(hook(payload('nothing', { cwd: sandbox }), ['--work', 'demo']).code).toBe(2);
  });

  test('tool other than Agent is allowed', () => {
    openItem();

    expect(hook(payload('nothing', { tool_name: 'Bash' }))).toEqual({ code: 0, out: '', err: '' });
  });

  test('cursor deny prints permission json and exits 0', () => {
    openItem();
    const result = hook(JSON.stringify({ cwd: workspace, prompt: briefLines(['Skills']) }), ['--harness', 'cursor']);

    expect(result.code).toBe(0);
    expect(result.err).toBe('');
    const decision = JSON.parse(result.out);
    expect(decision.permission).toBe('deny');
    expect(decision.user_message).toContain('Skills:');
    expect(Object.keys(decision).sort()).toEqual(['permission', 'user_message']);
  });

  test('cursor complete brief allows', () => {
    openItem();

    expect(hook(JSON.stringify({ cwd: workspace, prompt: briefLines() }), ['--harness', 'cursor']).code).toBe(0);
  });

  test('deny appends exactly one note event to the named item', () => {
    openItem();
    const before = readLog(name).length;
    hook(payload(briefLines(['Skills', 'Progress'])));
    const events = readLog(name);

    expect(events).toHaveLength(before + 1);
    expect(events.at(-1)).toMatchObject({
      type: 'note',
      step: 'hook',
      harness: 'claude',
      workflow: 'implement',
      work: name,
      summary: 'spawn blocked: missing Skills:, Progress:',
      data: { agent: 'impl-T9' },
    });
  });

  test('deny naming no existing item writes nothing', () => {
    openItem();
    const before = readFileSync(join(itemDir(name), 'events.jsonl'), 'utf8');
    hook(payload(briefLines().replace(itemDir(name), join(outputRoot, 'nope'))));

    expect(readFileSync(join(itemDir(name), 'events.jsonl'), 'utf8')).toBe(before);
    expect(existsSync(join(outputRoot, 'nope'))).toBe(false);
  });

  test.each(['', 'not json', '[1]'])('malformed stdin %p allows silently', (input) => {
    openItem();

    expect(hook(input)).toEqual({ code: 0, out: '', err: '' });
  });

  test('unknown flag exits 2', () => {
    expect(hook('{}', ['--bogus']).code).toBe(2);
  });

  test('hook.sh is executable', () => {
    expect(statSync(hookScript).mode & 0o111).not.toBe(0);
  });

  test('hook.sh skips quietly when bun is missing', () => {
    const emptyBin = join(sandbox, 'bin');
    mkdirSync(emptyBin);
    const result = Bun.spawnSync(['/bin/sh', hookScript, 'spawn'], {
      env: { PATH: emptyBin },
      stdin: new TextEncoder().encode('{}'),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toBe('agentic hook skipped: bun not installed\n');
  });

  test('hook.sh reaches the helper when bun is present', () => {
    const result = Bun.spawnSync(['/bin/sh', hookScript, 'spawn', '--bogus'], {
      env: { ...process.env, PATH: `${join(process.execPath, '..')}:${process.env.PATH}` },
      stdin: new TextEncoder().encode('{}'),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(2);
  });
});

describe('hook compact', () => {
  const name = '20261108-demo';
  let workspace = '';

  beforeEach(() => {
    workspace = join(sandbox, 'ws');
    mkdirSync(workspace);
    writeLog(name, [{ type: 'started', data: { workspace: { path: workspace, branch: 'b' } } }]);
  });

  const compact = (input: string, args: readonly string[] = [], cwd = sandbox) => {
    const result = Bun.spawnSync([process.execPath, scriptPath, 'hook', 'compact', ...args], {
      cwd,
      env: { ...process.env, AGENTIC_OUTPUT: outputRoot },
      stdin: new TextEncoder().encode(input),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
  };

  const startEvent = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({ cwd: workspace, hook_event_name: 'SessionStart', source: 'compact', ...extra });

  const contextOf = (out: string) => JSON.parse(out).hookSpecificOutput.additionalContext as string;

  test('claude compact injects the resume text', () => {
    const result = compact(startEvent());

    expect(result.code).toBe(0);
    expect(result.out.endsWith('\n')).toBe(true);
    expect(JSON.parse(result.out).hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(contextOf(result.out)).toContain(`work: ${name}`);
    expect(contextOf(result.out)).toContain('next:');
  });

  test('injected text matches resume output', () => {
    const resumed = agentic(['resume', '--work', 'demo']).out;

    expect(`${contextOf(compact(startEvent()).out)}\n`).toBe(resumed);
  });

  test('claude ignores other sources and events', () => {
    expect(compact(startEvent({ source: 'startup' }))).toEqual({ code: 0, out: '', err: '' });
    expect(compact(startEvent({ hook_event_name: 'UserPromptSubmit' }))).toEqual({ code: 0, out: '', err: '' });
  });

  test('missing event name is treated as SessionStart', () => {
    expect(contextOf(compact(JSON.stringify({ cwd: workspace, source: 'compact' })).out)).toContain(`work: ${name}`);
  });

  test('codex matches the claude shape and rule', () => {
    expect(contextOf(compact(startEvent(), ['--harness', 'codex']).out)).toContain(`work: ${name}`);
    expect(compact(startEvent({ source: 'startup' }), ['--harness', 'codex']).out).toBe('');
  });

  test('cursor injects on every sessionStart without a source filter', () => {
    const result = compact(JSON.stringify({ cwd: workspace, hook_event_name: 'sessionStart' }), ['--harness', 'cursor']);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.out).additional_context).toContain(`work: ${name}`);
    expect(compact(JSON.stringify({ cwd: workspace }), ['--harness', 'cursor']).out).toContain('additional_context');
    expect(compact(JSON.stringify({ cwd: workspace, hook_event_name: 'stop' }), ['--harness', 'cursor']).out).toBe('');
  });

  test('cwd matching no open item is silent', () => {
    expect(compact(startEvent({ cwd: sandbox }))).toEqual({ code: 0, out: '', err: '' });
  });

  test('malformed or empty stdin is silent', () => {
    expect(compact('not json')).toEqual({ code: 0, out: '', err: '' });
    expect(compact('')).toEqual({ code: 0, out: '', err: '' });
  });

  test('invalid harness exits 2', () => {
    expect(compact(startEvent(), ['--harness', 'vim']).code).toBe(2);
  });

  test('--work overrides cwd scoping', () => {
    expect(contextOf(compact(startEvent({ cwd: sandbox }), ['--work', 'demo']).out)).toContain(`work: ${name}`);
  });

  test('logs no events', () => {
    const before = readLog(name).length;
    compact(startEvent());

    expect(readLog(name)).toHaveLength(before);
  });
});

describe('hook fixtures (doc-derived stdin shapes)', () => {
  const name = '20261108-demo';
  const fixtureDir = join(import.meta.dir, 'fixtures');
  let workspace = '';

  beforeEach(() => {
    workspace = join(sandbox, 'ws');
    mkdirSync(workspace);
    writeLog(name, [
      { workflow: 'implement', type: 'started', data: { workspace: { path: workspace, branch: 'b' } } },
      { workflow: 'implement', type: 'started', step: 'implement', agent: 'impl-T9', model: 'sonnet' },
    ]);
  });

  const brief = (omitSkills = false) =>
    [
      'Step: implement',
      `Work item: ${itemDir(name)}`,
      'Agent: impl-T9 · Model: sonnet · Effort: medium',
      ...(omitSkills ? [] : ['Skills: load each via the Skill tool.']),
      'Progress: append a line to events.jsonl',
    ].join('\n');

  const fixture = async (file: string): Promise<Record<string, unknown>> => JSON.parse(await Bun.file(join(fixtureDir, file)).text());

  const run = (subcommand: string, harness: string, payload: Record<string, unknown>) => {
    const result = Bun.spawnSync([process.execPath, scriptPath, 'hook', subcommand, '--harness', harness], {
      cwd: sandbox,
      env: { ...process.env, AGENTIC_OUTPUT: outputRoot },
      stdin: new TextEncoder().encode(JSON.stringify(payload)),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
  };

  test('every fixture declares its doc-derived source', async () => {
    for (const file of new Bun.Glob('hook-*.json').scanSync(fixtureDir)) {
      expect(String((await fixture(file))._source)).toContain('doc-derived 2026-11-08, not captured');
    }
  });

  test('claude spawn fixture: complete brief allows, missing Skills denies; unknown keys ignored', async () => {
    const base = await fixture('hook-claude-spawn.json');
    const withBrief = (prompt: string) => ({ ...base, cwd: workspace, tool_input: { ...(base.tool_input as object), prompt } });

    expect(run('spawn', 'claude', withBrief(brief()))).toEqual({ code: 0, out: '', err: '' });
    const denied = run('spawn', 'claude', withBrief(brief(true)));
    expect(denied.code).toBe(2);
    const decision = JSON.parse(denied.out);
    expect(Object.keys(decision)).toEqual(['hookSpecificOutput']);
    expect(decision.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(decision.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(decision.hookSpecificOutput.permissionDecisionReason).toContain('Skills:');
  });

  test('codex spawn fixture: spawn_agent with tool_input.message', async () => {
    const base = await fixture('hook-codex-spawn.json');
    const withBrief = (prompt: string, extra: Record<string, unknown> = {}) => ({ ...base, cwd: workspace, tool_input: { message: prompt }, ...extra });

    expect(run('spawn', 'codex', withBrief(brief()))).toEqual({ code: 0, out: '', err: '' });
    const denied = run('spawn', 'codex', withBrief(brief(true)));
    expect(denied.code).toBe(2);
    expect(JSON.parse(denied.out).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  test('codex accepts Agent and spawn_agent, reads prompt before message, ignores other tools', async () => {
    const base = await fixture('hook-codex-spawn.json');
    const send = (tool_name: string, tool_input: Record<string, unknown>) => run('spawn', 'codex', { ...base, cwd: workspace, tool_name, tool_input });

    expect(send('Agent', { prompt: brief(true) }).code).toBe(2);
    expect(send('spawn_agent', { prompt: brief(true), message: brief() }).code).toBe(2);
    expect(send('spawn_agent', { prompt: brief(), message: brief(true) }).code).toBe(0);
    expect(send('agent', { prompt: brief(true) }).code).toBe(0);
    expect(send('Bash', { prompt: brief(true) }).code).toBe(0);
  });

  test('cursor subagentStart fixture: task is the prompt, cwd from workspace_roots[0]', async () => {
    const base = await fixture('hook-cursor-subagent-start.json');
    const withTask = (task: string) => ({ ...base, workspace_roots: [workspace, '/elsewhere'], task });

    expect(run('spawn', 'cursor', withTask(brief()))).toEqual({ code: 0, out: '', err: '' });
    const denied = run('spawn', 'cursor', withTask(brief(true)));
    expect(denied.code).toBe(0);
    const decision = JSON.parse(denied.out);
    expect(Object.keys(decision).sort()).toEqual(['permission', 'user_message']);
    expect(decision.permission).toBe('deny');
    expect(decision.user_message).toContain('Skills:');
  });

  test('cursor payload without a matching workspace root is silent', async () => {
    const base = await fixture('hook-cursor-subagent-start.json');

    expect(run('spawn', 'cursor', { ...base, task: brief(true) })).toEqual({ code: 0, out: '', err: '' });
  });

  test.each(['claude', 'codex'])('%s session-start fixture injects resume on compact', async (harness) => {
    const base = await fixture(`hook-${harness}-session-start.json`);
    const result = run('compact', harness, { ...base, cwd: workspace });
    const output = JSON.parse(result.out);

    expect(Object.keys(output)).toEqual(['hookSpecificOutput']);
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toContain(`work: ${name}`);
    expect(run('compact', harness, { ...base, cwd: workspace, source: 'startup' }).out).toBe('');
  });

  test('cursor session-start fixture injects additional_context, cwd from workspace_roots[0]', async () => {
    const base = await fixture('hook-cursor-session-start.json');
    const result = run('compact', 'cursor', { ...base, workspace_roots: [workspace] });
    const output = JSON.parse(result.out);

    expect(Object.keys(output)).toEqual(['additional_context']);
    expect(output.additional_context).toContain(`work: ${name}`);
  });

  test('cursor compact ignores the undocumented event field', async () => {
    const base = await fixture('hook-cursor-session-start.json');
    const { hook_event_name: _ignored, ...rest } = base;

    expect(run('compact', 'cursor', { ...rest, workspace_roots: [workspace], event: 'stop' }).out).toContain('additional_context');
  });
});
