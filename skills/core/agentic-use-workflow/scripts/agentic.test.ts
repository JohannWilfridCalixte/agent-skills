import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scriptPath = join(import.meta.dir, 'agentic.ts');

interface RunOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
  readonly stdin?: string;
}

interface TestEvent {
  readonly ts?: string;
  readonly run?: string;
  readonly workflow?: string;
  readonly step?: string | null;
  readonly type: string;
  readonly task?: string;
  readonly agent?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly summary?: string;
  readonly data?: Record<string, unknown>;
}

const forbiddenGh = join(mkdtempSync(join(tmpdir(), 'agentic-nogh-')), 'gh');
writeFileSync(forbiddenGh, '#!/bin/sh\necho "real gh is forbidden in tests" >&2\nexit 1\n');
chmodSync(forbiddenGh, 0o755);

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
    env: { ...process.env, AGENTIC_OUTPUT: outputRoot, AGENTIC_GH: forbiddenGh, ...options.env },
    stdin: options.stdin === undefined ? undefined : Buffer.from(options.stdin),
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

  test('records the realpath of the cwd in data.cwd', () => {
    const real = join(sandbox, 'real');
    mkdirSync(real);
    const link = join(sandbox, 'link');
    symlinkSync(real, link);
    agentic(['start', 'to-spec', '--harness', 'claude', '--work', 'demo', '--title', 'T'], { cwd: link });

    const [name] = readdirSync(outputRoot);
    expect(readLog(name)[0].data).toEqual({ title: 'T', cwd: realpathSync(real) });
  });

  test('from a linked worktree warns once on stderr and suggests put', () => {
    const main = join(sandbox, 'main');
    const linked = join(sandbox, 'linked');
    mkdirSync(main);
    git(main, ['init', '-q', '-b', 'main']);
    git(main, ['commit', '-q', '--allow-empty', '-m', 'init']);
    git(main, ['worktree', 'add', '-q', '-b', 'feature', linked]);

    const result = agentic(['start', 'implement', '--harness', 'claude', '--work', 'demo'], { cwd: linked });

    expect(result.code).toBe(0);
    expect(result.err.trim().split('\n')).toHaveLength(1);
    expect(result.err).toContain('put');
  });

  test.each(['implement', 'review', 'babysit-pr'])('%s with a playbook run open warns naming the playbook command', (workflow) => {
    writeLog('20261108-demo', [{ run: 'aaaa', workflow: 'implement-feature', type: 'started' }]);

    const result = agentic(['start', workflow, '--harness', 'claude', '--work', 'demo']);

    expect(result.code).toBe(0);
    expect(result.err).toContain('/agentic-implement-feature 20261108-demo');
  });

  test('no warning once the playbook run is closed', () => {
    writeLog('20261108-demo', [
      { run: 'aaaa', workflow: 'implement-feature', type: 'started' },
      { run: 'aaaa', workflow: 'implement-feature', type: 'completed' },
    ]);

    expect(agentic(['start', 'implement', '--harness', 'claude', '--work', 'demo']).err).toBe('');
  });

  test('from the main checkout prints no warning', () => {
    const main = join(sandbox, 'main');
    mkdirSync(main);
    git(main, ['init', '-q', '-b', 'main']);

    expect(agentic(['start', 'implement', '--harness', 'claude', '--work', 'demo'], { cwd: main }).err).toBe('');
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

  test('started without step stores the realpath cwd in data.cwd', () => {
    writeLog('20261108-demo', []);
    agentic(['event', '--type', 'started', '--workflow', 'review', '--harness', 'claude', '--summary', 's', '--work', 'demo', '--data', '{"title":"T"}']);

    expect(readLog('20261108-demo')[0].data).toEqual({ title: 'T', cwd: sandbox });
  });

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

  describe('run resolution', () => {
    const playbookRun = [{ run: 'aaaa', workflow: 'implement-feature', type: 'started' }];

    test('started without step mints a run', () => {
      writeLog('20261108-demo', playbookRun);

      const result = agentic(['event', '--work', 'demo', '--type', 'started', '--workflow', 'implement', '--summary', 'child']);

      expect(result.code).toBe(0);
      const event = JSON.parse(result.out);
      expect(event.run).toMatch(/^[0-9a-f]{4}$/);
      expect(event.run).not.toBe('aaaa');
      expect(event).toMatchObject({ workflow: 'implement', step: null, harness: 'claude' });
    });

    test('child completed keeps playbook run open', () => {
      writeLog('20261108-demo', [
        ...playbookRun,
        { run: 'bbbb', workflow: 'implement', type: 'started' },
        { run: 'bbbb', workflow: 'implement', type: 'completed' },
      ]);

      const result = agentic(['event', '--work', 'demo', '--type', 'note', '--summary', 'after child']);

      expect(result.code).toBe(0);
      expect(JSON.parse(result.out)).toMatchObject({ run: 'aaaa', workflow: 'implement-feature' });
    });

    test('innermost open run wins while a child is open', () => {
      writeLog('20261108-demo', [...playbookRun, { run: 'bbbb', workflow: 'implement', type: 'started' }]);

      const result = agentic(['event', '--work', 'demo', '--type', 'note', '--summary', 'in child']);

      expect(JSON.parse(result.out)).toMatchObject({ run: 'bbbb', workflow: 'implement' });
    });

    test('--workflow filters run', () => {
      writeLog('20261108-demo', [...playbookRun, { run: 'bbbb', workflow: 'implement', type: 'started' }]);

      const result = agentic([
        'event', '--work', 'demo', '--type', 'started', '--workflow', 'implement-feature', '--step', 'implement', '--summary', 'step',
      ]);

      expect(result.code).toBe(0);
      expect(JSON.parse(result.out)).toMatchObject({ run: 'aaaa', workflow: 'implement-feature', step: 'implement' });
    });
  });

  describe('workflow without a matching start', () => {
    const playbookRun = [{ run: 'aaaa', workflow: 'implement-feature', type: 'started' }];
    const eventFlags = (type: string, workflow: string) => ['event', '--work', 'demo', '--type', type, '--workflow', workflow, '--summary', 's'];

    test('cleanup started, note and completed share the cleanup run', () => {
      writeLog('20261108-demo', playbookRun);

      const started = JSON.parse(agentic(eventFlags('started', 'cleanup')).out);
      const note = agentic(eventFlags('note', 'cleanup'));
      const completed = agentic(eventFlags('completed', 'cleanup'));

      expect(note.code).toBe(0);
      expect(completed.code).toBe(0);
      expect(JSON.parse(note.out)).toMatchObject({ run: started.run, workflow: 'cleanup' });
      expect(JSON.parse(completed.out)).toMatchObject({ run: started.run, workflow: 'cleanup' });
    });

    test('--workflow with no start of that workflow falls back to the current run', () => {
      writeLog('20261108-demo', playbookRun);

      const result = agentic(eventFlags('note', 'implement'));

      expect(result.code).toBe(0);
      expect(JSON.parse(result.out)).toMatchObject({ run: 'aaaa', workflow: 'implement' });
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

  test('status: a later workflow-level completed clears a stale blocked', () => {
    const state = deriveState([
      { type: 'started', workflow: 'implement' },
      { type: 'failed', workflow: 'implement', step: 'checks', data: { reason: 'red tree', blocked: true } },
      { type: 'started', workflow: 'implement' },
      { type: 'completed', workflow: 'implement' },
    ]);
    expect(state.status).toBe('in_progress');
  });

  test('status: babysit-pr completed while a playbook run is open stays in_progress', () => {
    const playbook = { run: 'aaaa', workflow: 'implement-feature', type: 'started' };
    const asWorkflow = deriveState([playbook, { run: 'bbbb', workflow: 'babysit-pr', type: 'started' }, { run: 'bbbb', workflow: 'babysit-pr', type: 'completed' }]);
    const asStep = deriveState([playbook, { run: 'aaaa', workflow: 'implement-feature', step: 'babysit-pr', type: 'completed' }]);
    expect(asWorkflow.status).toBe('in_progress');
    expect(asStep.status).toBe('in_progress');
  });

  test('status: playbook completed is done, and so is a standalone babysit-pr completed', () => {
    const playbook = deriveState([
      { run: 'aaaa', workflow: 'implement-feature', type: 'started' },
      { run: 'bbbb', workflow: 'babysit-pr', type: 'started' },
      { run: 'bbbb', workflow: 'babysit-pr', type: 'completed' },
      { run: 'aaaa', workflow: 'implement-feature', type: 'completed' },
    ]);
    const standalone = deriveState([{ run: 'cccc', workflow: 'babysit-pr', type: 'started' }, { run: 'cccc', workflow: 'babysit-pr', type: 'completed' }]);
    expect(playbook.status).toBe('done');
    expect(standalone.status).toBe('done');
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

  test('units: tracked by step and task under a playbook workflow; baseline checks and orchestrator milestone ignored', () => {
    const state = deriveState([
      { type: 'started', workflow: 'implement-feature' },
      { type: 'completed', workflow: 'implement-feature', step: 'checks', summary: 'baseline green' },
      { type: 'completed', workflow: 'implement-feature', step: 'implement', summary: 'milestone' },
      { type: 'started', workflow: 'implement-feature', step: 'implement', task: 'T1', agent: 'impl-T1' },
      { type: 'completed', workflow: 'implement-feature', step: 'checks', task: 'T1' },
      { type: 'started', workflow: 'implement-feature', step: 'implement', task: 'T2', agent: 'impl-T2' },
    ]);
    expect(state.units).toEqual({ T1: 'done', T2: 'in_progress' });
  });

  test('units: a completed unit counts done once its PR merges, even without checks', () => {
    const state = deriveState([
      { type: 'started', workflow: 'implement-feature' },
      { type: 'started', step: 'implement', task: 'T1', agent: 'impl-T1' },
      { type: 'completed', step: 'implement', task: 'T1', agent: 'impl-T1' },
      { type: 'started', step: 'implement', task: 'T2', agent: 'impl-T2' },
      { type: 'completed', workflow: 'babysit-pr', step: 'merge', summary: 'merged PR 7' },
      { type: 'started', step: 'implement', task: 'T3', agent: 'impl-T3' },
      { type: 'completed', step: 'implement', task: 'T3', agent: 'impl-T3' },
    ]);
    expect(state.units).toEqual({ T1: 'done', T2: 'in_progress', T3: 'in_progress' });
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

describe('state derivation: unconfirmed decisions', () => {
  const flagged = (id: string): TestEvent => ({ type: 'decision', data: { id, tag: 'structural', unconfirmed: true } });

  test('a flagged decision is listed', () => {
    expect(deriveState([flagged('D3')]).unconfirmed).toEqual(['D3']);
  });

  test('a gate event naming the decision removes it', () => {
    const gate = (data: Record<string, unknown>): TestEvent => ({ type: 'gate', step: 'gate', data });

    expect(deriveState([flagged('D3'), flagged('D4'), gate({ decision: 'D3', outcome: 'confirm' })]).unconfirmed).toEqual(['D4']);
    expect(deriveState([flagged('D3'), flagged('D4'), gate({ passed: true, decisions: ['D3'] })]).unconfirmed).toEqual(['D4']);
  });

  test('unflagged decisions are ignored', () => {
    expect(deriveState([{ type: 'decision', data: { id: 'D1', tag: 'minor' } }]).unconfirmed).toEqual([]);
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

  test('open playbook with tickets names the playbook command and the first ticket with a unit not done', () => {
    writeLog(name, [
      { run: 'aaaa', workflow: 'implement-feature', type: 'started', summary: 'started' },
      { run: 'bbbb', workflow: 'implement', type: 'started', summary: 'implement started' },
      { run: 'bbbb', step: 'checks', task: 'T1', type: 'completed', summary: 'green after T1' },
      { run: 'bbbb', workflow: 'implement', type: 'completed', summary: 'implement done' },
      { run: 'aaaa', type: 'artifact', summary: 'tickets', data: { tickets: { tasks: { T1: '#10', T2: '#11' } } } },
    ]);

    const output = lines(resume().out);

    expect(output.at(-1)).toBe(`next: /agentic-implement-feature ${name}, next ticket #11 (T2)`);
  });

  test('next ticket skips units done under the playbook workflow', () => {
    writeLog(name, [
      { workflow: 'implement-feature', type: 'started', summary: 'started' },
      { workflow: 'implement-feature', step: 'implement', task: 'T1', type: 'started', summary: 'T1 started' },
      { workflow: 'implement-feature', step: 'checks', task: 'T1', type: 'completed', summary: 'green after T1' },
      { workflow: 'implement-feature', type: 'artifact', summary: 'tickets', data: { tickets: { tasks: { T1: '#1', T2: '#2' } } } },
    ]);

    const output = lines(resume().out);

    expect(output.at(-1)).toBe(`next: /agentic-implement-feature ${name}, next ticket #2 (T2)`);
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

  describe('unconfirmed', () => {
    const grillStep: TestEvent = { workflow: 'grill-tech', step: 'grill', type: 'started' };

    test('structural with no open grill step is flagged and listed in state', () => {
      writeLog(name, [...started, { workflow: 'implement', step: 'implement', type: 'started' }]);

      decide();

      expect(readLog(name).at(-1).data.unconfirmed).toBe(true);
      expect(readState(name).unconfirmed).toEqual(['D1']);
    });

    test('structural inside an open grill step is not flagged', () => {
      writeLog(name, [...started, grillStep]);

      decide();

      expect(readLog(name).at(-1).data).not.toHaveProperty('unconfirmed');
      expect(readState(name).unconfirmed).toEqual([]);
    });

    test('a grill step that completed no longer counts as open', () => {
      writeLog(name, [...started, grillStep, { ...grillStep, type: 'completed' }]);

      decide();

      expect(readLog(name).at(-1).data.unconfirmed).toBe(true);
    });

    test('structural whose own step starts with grill is not flagged without an open grill step', () => {
      writeLog(name, [...started, { workflow: 'implement', step: 'implement', type: 'started' }]);

      decide([], [...base, '--step', 'grill']);

      expect(readLog(name).at(-1).data).not.toHaveProperty('unconfirmed');
      expect(readState(name).unconfirmed).toEqual([]);
    });

    test('structural with a non-grill own step is flagged', () => {
      writeLog(name, [...started, { workflow: 'implement', step: 'implement', type: 'started' }]);

      decide([], [...base, '--step', 'implement']);

      expect(readLog(name).at(-1).data.unconfirmed).toBe(true);
    });

    test('minor is never flagged', () => {
      writeLog(name, [...started, { workflow: 'implement', step: 'implement', type: 'started' }]);

      decide([], flagsWith('--tag', 'minor'));

      expect(readLog(name).at(-1).data).not.toHaveProperty('unconfirmed');
      expect(readState(name).unconfirmed).toEqual([]);
    });
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

const surveyNote: TestEvent = { step: 'survey', type: 'note', summary: 'survey done' };
const gateLog = join(mkdtempSync(join(tmpdir(), 'agentic-gatelog-')), 'abc1234.log');
writeFileSync(gateLog, 'verify green\n');
const greenBaseline: TestEvent = { workflow: 'implement', step: 'checks', type: 'completed', data: { sha: 'abc1234', baseline: true, log: gateLog } };
const mergedEvent: TestEvent = { workflow: 'babysit-pr', step: 'merge', type: 'completed', summary: 'merged PR 7' };

const seedGate = (name: string) => {
  const lines = [surveyNote, greenBaseline].map((event) =>
    JSON.stringify({ ts: '2026-11-08T10:00:30Z', work: name, run: 'a3f9', harness: 'claude', workflow: 'implement', summary: 'x', ...event }),
  );
  appendFileSync(join(itemDir(name), 'events.jsonl'), `${lines.join('\n')}\n`);
};

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
    seedGate(name);

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

  test.each(['implement', 'review.ub-mode', 'context.docs'])('accepts key %s', (key) => {
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
    ['write', 'sonnet', 'medium'],
    ['plan', 'opus', 'high'],
    ['review.anything', 'sonnet', 'medium'],
  ])('claude tier for %s is %s/%s', (key, model, effort) => {
    expect(tier(key)).toEqual([model, effort]);
  });

  test('unknown key exits 1 listing valid keys, no event written', () => {
    const result = step('nope');

    expect(result.code).toBe(1);
    expect(result.err).toContain('unknown step key "nope"');
    for (const key of ['implement', 'write', 'plan', 'review']) expect(result.err).toContain(key);
    expect(readLog(name)).toHaveLength(3);
  });

  test('config row makes a custom key valid', () => {
    writeConfig({ steps: { claude: { mine: { model: 'haiku', effort: 'low' } } } });

    expect(tier('mine')).toEqual(['haiku', 'low']);
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

  test('started event records data.skills = profile skills plus --skills', () => {
    writeConfig({ profiles: [{ name: 'p', skills: ['a', 'b'] }], selectedProfiles: ['p'] });
    step('implement', ['--skills', 'b,tdd']);

    expect(readLog(name).at(-1)?.data).toMatchObject({ skills: ['a', 'b', 'tdd'] });
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

  test.each([
    ['claude-opus-5-5', 'opus'],
    ['claude-sonnet-5-5', 'sonnet'],
    ['claude-haiku-4-5', 'haiku'],
    ['opus', 'opus'],
  ])('Claude prints alias for configured %s, event keeps it', (configured, alias) => {
    writeConfig({ steps: { claude: { review: { model: configured, effort: 'high' } } } });

    const result = step('review.review-i18n');

    expect(result.out).toContain(`Model: ${alias} · Effort: high`);
    expect(result.out).toContain(`next: Agent model=${alias} effort=high\n`);
    expect(readLog(name).at(-1)?.model).toBe(configured);
  });

  test('harness defaults to the latest run harness', () => {
    writeLog(name, [{ workflow: 'implement', type: 'started' }]);
    const log = readLog(name);
    writeFileSync(join(itemDir(name), 'events.jsonl'), `${JSON.stringify({ ...log[0], harness: 'cursor' })}\n`);
    seedGate(name);

    const result = agentic(['step', 'implement', '--work', 'demo'], { env: { HOME: home } });

    expect(result.out).toContain('next: Task model=code[effort=medium]');
  });

  describe('implement preconditions', () => {
    const hubSet: TestEvent = { type: 'artifact', step: 'start', data: { name: 'hub', hub: 42 } };
    const stepAfter = (events: readonly TestEvent[], extra: readonly string[] = []) => {
      writeLog(name, [...started, hubSet, ...events]);

      return agentic(['step', 'implement', '--work', 'demo', ...extra], { env: { HOME: home } });
    };

    test('no survey note: exit 1 naming it, no event', () => {
      const result = stepAfter([greenBaseline]);

      expect(result.code).toBe(1);
      expect(result.err).toContain('note --step survey');
      expect(readLog(name)).toHaveLength(3);
    });

    test('no hub: survey not required', () => {
      writeLog(name, [...started, greenBaseline]);

      expect(agentic(['step', 'implement', '--work', 'demo'], { env: { HOME: home } }).code).toBe(0);
    });

    test('no green baseline: exit 1 naming gate --baseline, no event', () => {
      const result = stepAfter([surveyNote, { ...greenBaseline, type: 'failed' }, { ...greenBaseline, data: { sha: 'abc1234' } }]);

      expect(result.code).toBe(1);
      expect(result.err).toContain('gate --baseline');
      expect(readLog(name)).toHaveLength(5);
    });

    test('survey and baseline in the current run: brief printed', () => {
      const result = stepAfter([surveyNote, greenBaseline]);

      expect(result.code).toBe(0);
      expect(result.out).toContain('Agent: impl-implement');
    });

    test('survey and baseline in another run do not count', () => {
      const result = stepAfter([{ ...surveyNote, run: 'b111' }, { ...greenBaseline, run: 'b111' }]);

      expect(result.code).toBe(1);
    });

    test('survey and baseline in an open parent run count for a child run', () => {
      const result = stepAfter([surveyNote, greenBaseline, { run: 'c222', workflow: 'implement', type: 'started' }]);

      expect(result.code).toBe(0);
      expect(readLog(name).at(-1)).toMatchObject({ run: 'c222', step: 'implement' });
    });

    test('a hand-logged baseline without a gate log file does not count', () => {
      const handLogged = { ...greenBaseline, data: { sha: 'abc1234', baseline: true } };
      const missingFile = { ...greenBaseline, data: { sha: 'abc1234', baseline: true, log: join(sandbox, 'missing.log') } };

      expect(stepAfter([surveyNote, handLogged]).code).toBe(1);
      expect(stepAfter([surveyNote, missingFile]).err).toContain('gate --baseline');
    });

    test('survey and baseline from before the latest merge do not unlock the next PR', () => {
      const result = stepAfter([surveyNote, greenBaseline, mergedEvent]);

      expect(result.code).toBe(1);
      expect(result.err).toContain('survey');
    });

    test('a baseline alone is not enough after a merge: new survey needed, then new baseline', () => {
      expect(stepAfter([surveyNote, greenBaseline, mergedEvent, surveyNote]).err).toContain('gate --baseline');
      expect(stepAfter([surveyNote, greenBaseline, mergedEvent, surveyNote, greenBaseline]).code).toBe(0);
    });

    test('fix-list unit is exempt', () => {
      const repo = join(sandbox, 'repo');
      mkdirSync(repo);
      git(repo, ['init', '-q']);
      writeLog(name, [{ workflow: 'implement', type: 'started', data: { workspace: { path: '/ws/main-branch', branch: 'feat/demo' } } }]);
      agentic(['state', '--work', 'demo']);

      const result = agentic(['step', 'implement', '--work', 'demo', '--unit', 'fix-1.2'], { cwd: repo, env: { HOME: home } });

      expect(result.code).toBe(0);
    });

    test('other step keys are unaffected', () => {
      writeLog(name, started);

      expect(agentic(['step', 'plan', '--work', 'demo'], { env: { HOME: home } }).code).toBe(0);
    });
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
    seedGate(name);
    agentic(['state', '--work', 'demo']);

    return agentic(['step', 'implement', '--work', 'demo', ...extra], { cwd: repo(), env: { HOME: home() } });
  };

  test('brief workspace is the unit worktree and the add command is printed', () => {
    writeLog(name, [workspaceEvent]);

    const result = stepUnit();

    expect(result.code).toBe(0);
    expect(result.out).toContain(`Workspace: ${unitPath('T5')}`);
    expect(result.out).toContain(`worktree: git worktree add -b feat/demo--T5 ${unitPath('T5')} feat/demo\nnext: `);
    expect(result.out).toContain('"task":"T5","agent":"impl-T5"');
  });

  test('the printed add command works while the work branch exists', () => {
    git(repo(), ['-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'base']);
    git(repo(), ['branch', 'feat/demo']);
    writeLog(name, [workspaceEvent]);

    const command = stepUnit().out.match(/^worktree: (.+)$/m)?.[1] ?? '';

    expect(Bun.spawnSync(['sh', '-c', command], { cwd: repo(), stderr: 'pipe' }).exitCode).toBe(0);
  });

  test('started event records the worktree and the unit implies the task', () => {
    writeLog(name, [workspaceEvent]);

    stepUnit();

    expect(readLog(name).at(-1)).toMatchObject({
      type: 'started',
      task: 'T5',
      data: { worktree: { path: unitPath('T5'), branch: 'feat/demo--T5' } },
    });
  });

  test('config worktrees is resolved against the main checkout with {repo}', () => {
    writeFileSync(join(repo(), '.agentic.json'), JSON.stringify({ worktrees: '../trees/{repo}' }));
    writeLog(name, [workspaceEvent]);

    expect(stepUnit().out).toContain(`worktree: git worktree add -b feat/demo--T5 ${unitPath('T5', join(sandbox, 'trees', 'repo'))} feat/demo`);
  });

  test('without a recorded workspace exits 1 and logs nothing', () => {
    writeLog(name, [{ workflow: 'implement', type: 'started' }]);

    const result = stepUnit();

    expect(result.code).toBe(1);
    expect(result.err).toContain('--unit needs');
    expect(readLog(name)).toHaveLength(3);
  });

  test('without --unit no worktree line and no worktree data', () => {
    writeLog(name, [workspaceEvent]);

    const result = stepUnit(['--task', 'T5']);

    expect(result.out).not.toContain('worktree:');
    expect(readLog(name).at(-1)?.data).toEqual({ skills: [] });
  });

  const unitStarted = (unit: string): TestEvent => ({
    step: 'implement',
    task: unit,
    type: 'started',
    data: { worktree: { path: `/wt/${unit}`, branch: `feat/demo--${unit}` } },
  });
  const resumeLines = () => agentic(['resume', '--work', 'demo'], { cwd: repo() }).out.trimEnd().split('\n');
  const createUnitBranches = (...units: readonly string[]) => {
    git(repo(), ['-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'base']);
    for (const unit of units) git(repo(), ['branch', `feat/demo--${unit}`]);
  };

  test('resume lists pending units in started order with merge-back commands', () => {
    createUnitBranches('T2', 'T3');
    writeLog(name, [workspaceEvent, unitStarted('T2'), unitStarted('T3')]);

    const lines = resumeLines();
    const start = lines.indexOf('merge-back:');

    expect(lines.slice(start, start + 7)).toEqual([
      'merge-back:',
      '  git merge --no-ff feat/demo--T2',
      '  git worktree remove /wt/T2',
      '  git branch -d feat/demo--T2',
      '  git merge --no-ff feat/demo--T3',
      '  git worktree remove /wt/T3',
      '  git branch -d feat/demo--T3',
    ]);
    expect(lines.at(-1)).toStartWith('next: ');
  });

  test('a unit run in place (its branch never created) is not listed', () => {
    createUnitBranches('T3');
    writeLog(name, [workspaceEvent, unitStarted('T2'), unitStarted('T3')]);

    const output = resumeLines().join('\n');

    expect(output).not.toContain('feat/demo--T2');
    expect(output).toContain('git merge --no-ff feat/demo--T3');
  });

  test('a unit with a later checks completion is no longer pending', () => {
    createUnitBranches('T2', 'T3');
    writeLog(name, [workspaceEvent, unitStarted('T2'), unitStarted('T3'), { step: 'checks', task: 'T2', type: 'completed' }]);

    const output = resumeLines().join('\n');

    expect(output).not.toContain('feat/demo--T2');
    expect(output).toContain('git merge --no-ff feat/demo--T3');
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

    test('default security paths match policy code', () => {
      write('db/policies/tenant.sql');
      commit('work');

      expect(names(eligible(['--iteration', '2']))).toEqual(['review-access-tenant-isolation']);
    });

    test('default security paths ignore docs', () => {
      write('documentation/compliance/policies/retention.md');
      write('docs/auth/login.md');
      commit('work');

      expect(names(eligible(['--iteration', '2']))).toEqual([]);
    });

    test('security settings in the gate file override the defaults', () => {
      write('.agentic/review-gates.json', JSON.stringify({ ...gates, security: { reviewers: ['code-review'], paths: ['src/api/**'] } }));
      write('src/api/route.ts', 'changed');
      commit('work');

      expect(names(eligible(['--iteration', '2']))).toEqual(['code-review']);
    });
  });

  describe('logged list', () => {
    test('default run logs one note carrying the reviewer names', () => {
      eligible();

      const events = readLog(name);
      expect(events).toHaveLength(2);
      expect(events[1]).toMatchObject({
        type: 'note',
        step: 'review',
        data: { reviewers: ['code-review', 'review-access-tenant-isolation'] },
      });
    });

    test('--only logs the on-demand reviewer in the list', () => {
      eligible(['--only', 'review-i18n']);

      expect(readLog(name).at(-1)?.data).toMatchObject({
        reviewers: ['code-review', 'review-access-tenant-isolation', 'review-i18n'],
      });
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
        data: { reason: 'big refactor', reviewers: names(result) },
      });
    });

    test('without a current run exits 1 and logs nothing', () => {
      writeLog(name, []);

      const result = eligible(['--all', '--reason', 'r']);

      expect(result.code).toBe(1);
      expect(result.err).toContain('run: required');
    });

    test('without a work item prints the same stdout and writes no event', () => {
      const withItem = eligible();
      rmSync(itemDir(name), { recursive: true });

      expect(eligible().out).toBe(withItem.out);
      expect(existsSync(itemDir(name))).toBe(false);
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

  describe('after milestone events', () => {
    const final = 'hub sync failed: retry `hub sync`, then tell the user';
    const run = (args: readonly string[], options: RunOptions = {}) =>
      agentic([...args, '--work', 'demo'], { ...options, env: fakeGhEnv() });
    const event = (...args: string[]) => run(['event', '--summary', 'x', ...args]);
    const syncPosts = () => writes('POST').filter((line) => line.includes('repos/o/r/issues/12/comments'));
    const failGh = () => writeFileSync(join(ghDir, 'failures'), 'always');

    test('an artifact event syncs the hub', () => {
      const result = event('--type', 'artifact', '--step', 'plan', '--data', '{"name":"plan","path":"plan.md"}');

      expect(result.code).toBe(0);
      expect(syncPosts()).toHaveLength(3);
    });

    test.each([
      ['note', ['--type', 'note', '--step', 'plan']],
      ['progress', ['--type', 'progress', '--step', 'plan']],
      ['workflow-level note', ['--type', 'note']],
    ])('a %s event does not sync', (_label, args) => {
      expect(event(...args).code).toBe(0);
      expect(ghLog()).toEqual([]);
    });

    test('no hub, no sync', () => {
      writeLog(name, [{ type: 'started', step: null }]);

      expect(event('--type', 'artifact', '--step', 'plan').code).toBe(0);
      expect(ghLog()).toEqual([]);
    });

    test.each(['completed', 'failed', 'decision', 'escalation', 'gate'])('a %s event syncs', (type) => {
      expect(event('--type', type, '--step', 'plan', '--data', '{"reason":"r"}').code).toBe(0);
      expect(syncPosts()).toHaveLength(3);
    });

    test('a failed sync on a milestone keeps exit 0 and logs one note with the reason, without looping', () => {
      failGh();

      const result = event('--type', 'artifact', '--step', 'plan');

      expect(result.code).toBe(0);
      const notes = readLog(name).filter((entry) => entry.type === 'note');
      expect(notes).toHaveLength(1);
      expect(notes[0].data.reason).toContain('no such host');
      expect(writes('POST')).toHaveLength(4);
    });

    test('a failed sync after a workflow-level completed exits 1 and still logs the note', () => {
      failGh();

      const result = event('--type', 'completed');

      expect(result.code).toBe(1);
      expect(result.err).toContain(final);
      expect(readLog(name).filter((entry) => entry.type === 'note')).toHaveLength(1);
    });

    test('a failed sync after a workflow-level failed exits 1', () => {
      failGh();

      const result = event('--type', 'failed', '--data', '{"reason":"boom"}');

      expect(result.code).toBe(1);
      expect(result.err).toContain(final);
    });

    test('decide syncs the hub', () => {
      const result = run(['decide', '--tag', 'minor', '--focus', 'tech', '--q', 'q', '--a', 'a', '--why', 'w']);

      expect(result.code).toBe(0);
      expect(syncPosts()).toHaveLength(3);
    });

    test('put syncs the hub', () => {
      const result = run(['put', 'plan.md'], { stdin: '# Plan\n' });

      expect(result.code).toBe(0);
      expect(syncPosts()).toHaveLength(4);
    });

    test('gate syncs the hub, even when red', () => {
      const repo = join(sandbox, 'repo');
      mkdirSync(repo);
      git(repo, ['init', '-q', '-b', 'main']);
      writeFileSync(join(repo, '.agentic.json'), JSON.stringify({ verify: 'exit 1' }));
      git(repo, ['add', '.']);
      git(repo, ['commit', '-q', '-m', 'init']);

      const result = run(['gate', '--task', 'T1'], { cwd: repo });

      expect(result.code).toBe(1);
      expect(syncPosts()).toHaveLength(3);
    });

    test('gate red with a hub prints at most 10 lines', () => {
      const repo = join(sandbox, 'repo');
      mkdirSync(repo);
      git(repo, ['init', '-q', '-b', 'main']);
      writeFileSync(join(repo, '.agentic.json'), JSON.stringify({ verify: 'for i in $(seq 1 30); do echo "line $i"; done; exit 1' }));
      git(repo, ['add', '.']);
      git(repo, ['commit', '-q', '-m', 'init']);

      const result = run(['gate', '--task', 'T1'], { cwd: repo });

      expect(result.code).toBe(1);
      expect(syncPosts()).toHaveLength(3);
      expect(result.out.trimEnd().split('\n').length).toBeLessThanOrEqual(10);
    });

    test('automatic sync prints nothing on stdout beyond the command output', () => {
      const result = event('--type', 'artifact', '--step', 'plan', '--data', '{"name":"plan","path":"plan.md"}');

      expect(syncPosts()).toHaveLength(3);
      expect(result.out.trimEnd().split('\n')).toHaveLength(1);
      expect(result.out).not.toContain('created');
    });

    test('the explicit hub sync command still works', () => {
      expect(sync().code).toBe(0);
      expect(syncPosts()).toHaveLength(3);
    });
  });
});

describe('put', () => {
  const name = '20261108-demo';
  const put = (path: string, stdin: string, options: RunOptions = {}) =>
    agentic(['put', path, '--work', 'demo'], { ...options, stdin });
  const reviewHeader = 'verdict: changes-requested — blocker 1 · major 2 · minor 3 · nit 4 · needs-user 0\n\n## Findings\n';

  beforeEach(() => {
    writeLog(name, [{ type: 'started', step: null }]);
  });

  test('writes stdin to the item file and logs an artifact', () => {
    const result = put('plan.md', '# Plan\n');

    expect(result.code).toBe(0);
    expect(readFileSync(join(itemDir(name), 'plan.md'), 'utf8')).toBe('# Plan\n');
    expect(readLog(name).at(-1)).toMatchObject({ type: 'artifact', run: 'a3f9', data: { name: 'plan', path: 'plan.md' } });
    expect(readState(name).artifacts.plan).toBe('plan.md');
  });

  test('creates nested directories for allowlisted folders', () => {
    expect(put('briefs/T1.md', 'brief').code).toBe(0);
    expect(readFileSync(join(itemDir(name), 'briefs', 'T1.md'), 'utf8')).toBe('brief');
    expect(put('reports/impl-T1.md', 'report').code).toBe(0);
    expect(readFileSync(join(itemDir(name), 'reports', 'impl-T1.md'), 'utf8')).toBe('report');
  });

  test('a review report also logs completed with counts from its header', () => {
    const result = put('reviews/2-review-security.md', reviewHeader);

    expect(result.code).toBe(0);
    const [artifact, completed] = readLog(name).slice(-2);
    expect(artifact).toMatchObject({ type: 'artifact', data: { path: 'reviews/2-review-security.md' } });
    expect(completed).toMatchObject({
      type: 'completed',
      step: 'review.review-security',
      iteration: 2,
      data: { counts: { blocker: 1, major: 2, minor: 3, nit: 4 } },
    });
  });

  test('a review fix list logs no completed event', () => {
    put('reviews/2-fix.md', reviewHeader);

    expect(readLog(name).map((event) => event.type)).toEqual(['started', 'artifact']);
  });

  test.each(['../x', 'src/a.ts', 'briefs/../../x.md', '/etc/passwd', 'notes.md'])('%s is refused, nothing written', (path) => {
    const result = put(path, 'x');

    expect(result.code).toBe(1);
    expect(readdirSync(itemDir(name)).sort()).toEqual(['events.jsonl']);
    expect(readLog(name)).toHaveLength(1);
  });

  test('no work item exits 1', () => {
    const result = agentic(['put', 'plan.md'], { stdin: 'x' });

    expect(result.code).toBe(1);
  });

  test('missing path argument exits 2', () => {
    expect(agentic(['put', '--work', 'demo'], { stdin: 'x' }).code).toBe(2);
  });

  test('from a linked worktree writes into the main checkout item', () => {
    const main = join(sandbox, 'main');
    const linked = join(sandbox, 'linked');
    mkdirSync(main);
    git(main, ['init', '-q', '-b', 'main']);
    git(main, ['commit', '-q', '--allow-empty', '-m', 'init']);
    git(main, ['worktree', 'add', '-q', '-b', 'feature', linked]);
    const mainItem = join(main, '.agentic', 'work', name);
    mkdirSync(mainItem, { recursive: true });
    writeFileSync(
      join(mainItem, 'events.jsonl'),
      `${JSON.stringify({ ts: '2026-11-08T10:00:00Z', work: name, run: 'a3f9', harness: 'claude', workflow: 'implement', step: null, type: 'started', summary: 'x' })}\n`,
    );

    const result = agentic(['put', 'plan.md', '--work', 'demo'], { cwd: linked, stdin: '# Plan\n', env: { AGENTIC_OUTPUT: undefined } });

    expect(result.code).toBe(0);
    expect(readFileSync(join(mainItem, 'plan.md'), 'utf8')).toBe('# Plan\n');
    expect(existsSync(join(linked, '.agentic'))).toBe(false);
  });
});

describe('gate', () => {
  const name = '20261108-demo';
  let repo = '';
  let counter = '';

  const headSha = (cwd: string) =>
    Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd, stdout: 'pipe' }).stdout.toString().trim();

  const setupRepo = (cwd: string, config: Record<string, unknown>) => {
    mkdirSync(cwd, { recursive: true });
    git(cwd, ['init', '-q', '-b', 'main']);
    writeFileSync(join(cwd, '.agentic.json'), JSON.stringify(config));
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-q', '-m', 'init']);
  };

  const fakeVerify = (body: string) => {
    const script = join(sandbox, 'verify.sh');
    writeFileSync(script, `echo run >> ${counter}\n${body}\n`);

    return { verify: `sh ${script}` };
  };

  const runs = () => (existsSync(counter) ? readFileSync(counter, 'utf8').split('\n').filter(Boolean).length : 0);
  const gate = (args: readonly string[]) => agentic(['gate', ...args, '--work', 'demo'], { cwd: repo });

  beforeEach(() => {
    repo = join(sandbox, 'repo');
    counter = join(sandbox, 'counter');
    writeLog(name, [{ type: 'started', step: null }]);
  });

  test('green: exit 0, log kept in the item, one checks completed per task', () => {
    setupRepo(repo, fakeVerify('echo all good'));

    const result = gate(['--task', 'T1,T2']);

    expect(result.code).toBe(0);
    const sha = headSha(repo);
    expect(readFileSync(join(itemDir(name), 'gates', `${sha}.log`), 'utf8')).toContain('all good');
    const checks = readLog(name).filter((event) => event.step === 'checks');
    expect(checks.map((event) => [event.task, event.type, event.workflow])).toEqual([
      ['T1', 'completed', 'implement'],
      ['T2', 'completed', 'implement'],
    ]);
    expect(checks[0].data).toMatchObject({ sha, log: join(itemDir(name), 'gates', `${sha}.log`) });
    expect(runs()).toBe(1);
  });

  test('red: exit 1, at most 10 lines with the log path, checks failed per task', () => {
    setupRepo(repo, fakeVerify('for i in $(seq 1 30); do echo "line $i"; done\nexit 1'));

    const result = gate(['--task', 'T1,T2']);

    const sha = headSha(repo);
    const logPath = join(itemDir(name), 'gates', `${sha}.log`);
    expect(result.code).toBe(1);
    expect(result.out.trimEnd().split('\n').length).toBeLessThanOrEqual(10);
    expect(result.out).toContain(logPath);
    expect(readFileSync(logPath, 'utf8')).toContain('line 1\n');
    const checks = readLog(name).filter((event) => event.step === 'checks');
    expect(checks.map((event) => [event.task, event.type])).toEqual([
      ['T1', 'failed'],
      ['T2', 'failed'],
    ]);
    expect(checks[0].data).toMatchObject({ sha, log: logPath });
  });

  test('a green SHA is not run again but still logs its tasks', () => {
    setupRepo(repo, fakeVerify('echo ok'));
    gate(['--task', 'T1']);

    const result = gate(['--task', 'T2']);

    expect(result.code).toBe(0);
    expect(runs()).toBe(1);
    expect(readLog(name).filter((event) => event.step === 'checks').map((event) => event.task)).toEqual(['T1', 'T2']);
  });

  test('a hand-logged checks completed without a log file does not skip verify', () => {
    setupRepo(repo, fakeVerify('echo ok'));
    const sha = headSha(repo);
    agentic(['event', '--type', 'completed', '--step', 'checks', '--summary', 'x', '--data', JSON.stringify({ sha }), '--work', 'demo'], { cwd: repo });
    agentic(['event', '--type', 'completed', '--step', 'checks', '--summary', 'x', '--data', JSON.stringify({ sha, log: join(sandbox, 'nope.log') }), '--work', 'demo'], { cwd: repo });

    const result = gate(['--task', 'T1']);

    expect(result.code).toBe(0);
    expect(runs()).toBe(1);
  });

  test('a reused green SHA records the reused event ts and its log', () => {
    setupRepo(repo, fakeVerify('echo ok'));
    gate(['--task', 'T1']);
    const first = readLog(name).find((event) => event.step === 'checks');

    gate(['--task', 'T2']);

    const reused = readLog(name).filter((event) => event.step === 'checks').at(-1);
    expect(reused.data).toMatchObject({ reused: first.ts, log: first.data.log });
    expect(first.data.reused).toBeUndefined();
  });

  test('a red SHA is run again', () => {
    setupRepo(repo, fakeVerify('exit 1'));
    gate(['--task', 'T1']);
    gate(['--task', 'T1']);

    expect(runs()).toBe(2);
  });

  test('--baseline logs one checks event without task', () => {
    setupRepo(repo, fakeVerify('echo ok'));

    const result = gate(['--baseline']);

    expect(result.code).toBe(0);
    const checks = readLog(name).filter((event) => event.step === 'checks');
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ type: 'completed', workflow: 'implement', data: { baseline: true, sha: headSha(repo) } });
    expect(checks[0].task).toBeUndefined();
  });

  test('no verify key exits 1 naming it, nothing logged', () => {
    setupRepo(repo, {});

    const result = gate(['--baseline']);

    expect(result.code).toBe(1);
    expect(result.err).toContain('verify');
    expect(readLog(name)).toHaveLength(1);
  });

  test('dirty tree exits 1 without running verify', () => {
    setupRepo(repo, fakeVerify('echo ok'));
    writeFileSync(join(repo, 'stray.txt'), 'x');

    const result = gate(['--baseline']);

    expect(result.code).toBe(1);
    expect(result.err).toContain('dirty');
    expect(runs()).toBe(0);
  });

  test('neither --task nor --baseline, or both, exits 2', () => {
    setupRepo(repo, fakeVerify('echo ok'));

    expect(gate([]).code).toBe(2);
    expect(gate(['--task', 'T1', '--baseline']).code).toBe(2);
  });

  test('from a linked worktree writes the log into the main-checkout item', () => {
    const main = join(sandbox, 'main');
    const linked = join(sandbox, 'linked');
    setupRepo(main, fakeVerify('echo ok'));
    git(main, ['worktree', 'add', '-q', '-b', 'feature', linked]);
    const mainItem = join(main, '.agentic', 'work', name);
    mkdirSync(mainItem, { recursive: true });
    writeFileSync(
      join(mainItem, 'events.jsonl'),
      `${JSON.stringify({ ts: '2026-11-08T10:00:00Z', work: name, run: 'a3f9', harness: 'claude', workflow: 'implement', step: null, type: 'started', summary: 'x' })}\n`,
    );

    const result = agentic(['gate', '--baseline', '--work', 'demo'], { cwd: linked, env: { AGENTIC_OUTPUT: undefined } });

    expect(result.code).toBe(0);
    expect(existsSync(join(mainItem, 'gates', `${headSha(linked)}.log`))).toBe(true);
    expect(existsSync(join(linked, '.agentic'))).toBe(false);
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

  test('artifact path outside the item is a gap', () => {
    writeLog(name, [
      ...readyEvents(),
      { type: 'artifact', step: 'implement', data: { name: 'stray', path: '/outside/elsewhere/plan.md' } },
      { type: 'artifact', step: 'implement', data: { name: 'escape', path: '../other/plan.md' } },
      { type: 'artifact', step: 'implement', data: { name: 'fine', path: 'reviews/1-a.md' } },
    ]);

    const result = check();

    expect(result.code).toBe(1);
    expect(missing(result.out)).toEqual([
      'missing: artifact outside the work item: /outside/elsewhere/plan.md',
      'missing: artifact outside the work item: ../other/plan.md',
    ]);
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
      {
        workflow: 'implement',
        type: 'started',
        step: 'implement',
        agent: 'impl-T9',
        model: 'claude-sonnet-5-5',
        effort: 'medium',
        data: { skills: ['tdd', 'house-style'] },
      },
      ...extra,
    ]);

  const briefLines = (omit: readonly string[] = []) =>
    [
      'Step: implement',
      `Work item: ${itemDir(name)}`,
      'Agent: impl-T9 · Model: sonnet · Effort: medium',
      'Load skills: house-style, tdd',
      'Skills: load each via the Skill tool.',
      'Progress: append a line to events.jsonl',
    ]
      .filter((line) => !omit.some((prefix) => line.startsWith(prefix)))
      .join('\n');

  const payload = (prompt: string, extra: Record<string, unknown> = {}, toolInput: Record<string, unknown> = {}) =>
    JSON.stringify({ cwd: workspace, tool_name: 'Agent', tool_input: { prompt, model: 'sonnet', effort: 'medium', ...toolInput }, ...extra });

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

  test('an item recorded at the main checkout does not capture a linked worktree no item owns', () => {
    git(sandbox, ['init', '-q', '-b', 'main']);
    git(sandbox, ['commit', '-q', '--allow-empty', '-m', 'init']);
    const linked = join(sandbox, 'trees', 'other');
    git(sandbox, ['worktree', 'add', '-q', '-b', 'other', linked]);
    writeLog(name, [{ workflow: 'implement', type: 'started', data: { cwd: sandbox } }]);

    expect(hook(payload(briefLines(['Load skills']), { cwd: realpathSync(linked) }))).toEqual({ code: 0, out: '', err: '' });
  });

  test('the item named by the brief wins over another matching item', () => {
    openItem();
    writeLog('20261101-other', [{ ts: '2026-11-09T10:00:00Z', type: 'started', data: { workspace: { path: workspace, branch: 'b' } } }]);

    expect(hook(payload(briefLines()))).toEqual({ code: 0, out: '', err: '' });
  });

  describe('review spawns', () => {
    const reviewBrief = (reviewer: string) =>
      briefLines().replace('Step: implement', `Step: review.${reviewer}`).replace('Agent: impl-T9', `Agent: review.${reviewer}-1`);
    const reviewStarted = (reviewer: string) => ({
      workflow: 'implement',
      type: 'started' as const,
      step: `review.${reviewer}`,
      agent: `review.${reviewer}-1`,
      model: 'claude-sonnet-5-5',
      effort: 'medium',
      data: { skills: ['tdd', 'house-style'] },
    });
    const listed = (...reviewers: string[]) => ({ workflow: 'implement', type: 'note' as const, step: 'review', data: { reviewers } });

    test('allows a reviewer in the latest logged list', () => {
      openItem([listed('code-review', 'review-i18n'), reviewStarted('review-i18n')]);

      expect(hook(payload(reviewBrief('review-i18n'))).code).toBe(0);
    });

    test('denies a reviewer outside the latest list, naming the list', () => {
      openItem([listed('code-review'), reviewStarted('review-i18n')]);
      const result = hook(payload(reviewBrief('review-i18n')));

      expect(result.code).toBe(2);
      expect(result.err).toContain('review-i18n');
      expect(result.err).toContain('code-review');
    });

    test('only the latest list counts', () => {
      openItem([listed('review-i18n'), listed('code-review'), reviewStarted('review-i18n')]);

      expect(hook(payload(reviewBrief('review-i18n'))).code).toBe(2);
    });

    test('denies when no list was logged, asking for review eligible', () => {
      openItem([reviewStarted('code-review')]);
      const result = hook(payload(reviewBrief('code-review')));

      expect(result.code).toBe(2);
      expect(result.err).toContain('review eligible');
    });

    test('non-review steps are unaffected by the list', () => {
      openItem([listed('code-review')]);

      expect(hook(payload(briefLines())).code).toBe(0);
    });
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

  describe('claude model, effort and skills check', () => {
    const fixtureInput = async (toolInput: Record<string, unknown>, prompt = briefLines()) => {
      const base = JSON.parse(await Bun.file(join(import.meta.dir, 'fixtures', 'hook-claude-spawn.json')).text());
      const { effort: _effort, ...rest } = base.tool_input;

      return JSON.stringify({ ...base, cwd: workspace, tool_input: { ...rest, prompt, ...toolInput } });
    };

    test('allows when model alias, effort and skill set equal the started event, skill order aside', async () => {
      openItem();

      expect(hook(await fixtureInput({ model: 'sonnet', effort: 'medium' }))).toEqual({ code: 0, out: '', err: '' });
      expect(hook(await fixtureInput({ model: 'sonnet', effort: 'medium' }, briefLines().replace('house-style, tdd', 'tdd, house-style'))).code).toBe(0);
    });

    test('denies a missing effort, printing the expected values and logging a note', async () => {
      openItem();
      const result = hook(await fixtureInput({ model: 'sonnet' }));

      expect(result.code).toBe(2);
      expect(JSON.parse(result.out).hookSpecificOutput.permissionDecision).toBe('deny');
      expect(result.err).toContain('effort medium (got none)');
      expect(result.err).toContain('expected: model sonnet, effort medium, Load skills: tdd, house-style');
      expect(readLog(name).at(-1)).toMatchObject({ type: 'note', step: 'hook', data: { agent: 'impl-T9' } });
    });

    test('model compares after alias normalisation', async () => {
      openItem();
      const mismatch = hook(await fixtureInput({ model: 'opus', effort: 'medium' }));

      expect(mismatch.code).toBe(2);
      expect(mismatch.err).toContain('model sonnet (got opus)');
      expect(hook(await fixtureInput({ model: 'claude-sonnet-5-5', effort: 'medium' })).code).toBe(0);
    });

    test('denies a different effort', async () => {
      openItem();
      const result = hook(await fixtureInput({ model: 'sonnet', effort: 'high' }));

      expect(result.code).toBe(2);
      expect(result.err).toContain('effort medium (got high)');
    });

    test('denies a Load skills set that differs from data.skills', async () => {
      openItem();
      const result = hook(await fixtureInput({ model: 'sonnet', effort: 'medium' }, briefLines().replace('house-style, tdd', 'tdd')));

      expect(result.code).toBe(2);
      expect(result.err).toContain('Load skills: tdd, house-style');
    });

    test('denies a pointer-only brief with no inline Load skills line', async () => {
      openItem();
      const result = hook(await fixtureInput({ model: 'sonnet', effort: 'medium' }, briefLines(['Load skills'])));

      expect(result.code).toBe(2);
      expect(result.err).toContain('Load skills:');
      expect(readLog(name).at(-1)?.summary).toContain('Load skills:');
    });

    test('cursor and codex do not check model, effort or skills', () => {
      openItem();

      expect(hook(JSON.stringify({ cwd: workspace, prompt: briefLines(['Load skills']) }), ['--harness', 'cursor']).code).toBe(0);
      expect(hook(JSON.stringify({ cwd: workspace, tool_name: 'Agent', tool_input: { prompt: briefLines(['Load skills']) } }), ['--harness', 'codex']).code).toBe(0);
    });
  });

  describe('claude session start', () => {
    const sessionStart = async (toolInput: Record<string, unknown>, prompt = briefLines()) => {
      const base = JSON.parse(await Bun.file(join(import.meta.dir, 'fixtures', 'hook-claude-spawn-session.json')).text());

      return JSON.stringify({ ...base, cwd: workspace, tool_input: { ...base.tool_input, prompt, ...toolInput } });
    };

    test('allows when brief, full model id and effort match the started event', async () => {
      openItem();

      expect(hook(await sessionStart({ model: 'claude-sonnet-5-5', effort: 'medium' }))).toEqual({ code: 0, out: '', err: '' });
    });

    test('denies a different model or effort, printing the expected values', async () => {
      openItem();
      const model = hook(await sessionStart({ model: 'claude-opus-5-5', effort: 'medium' }));
      const effort = hook(await sessionStart({ model: 'claude-sonnet-5-5', effort: 'high' }));

      expect(model.code).toBe(2);
      expect(JSON.parse(model.out).hookSpecificOutput.permissionDecision).toBe('deny');
      expect(model.err).toContain('model sonnet (got claude-opus-5-5)');
      expect(effort.code).toBe(2);
      expect(effort.err).toContain('effort medium (got high)');
    });

    test('denies a brief missing its checked lines', async () => {
      openItem();
      const result = hook(await sessionStart({ model: 'claude-sonnet-5-5', effort: 'medium' }, briefLines(['Skills', 'Load skills'])));

      expect(result.code).toBe(2);
      expect(result.err).toContain('Skills:');
      expect(result.err).toContain('Load skills:');
    });

    test('a review session obeys the eligible list', async () => {
      openItem([
        { workflow: 'implement', type: 'note', step: 'review', data: { reviewers: ['code-review'] } },
        { workflow: 'implement', type: 'started', step: 'review.review-i18n', agent: 'review.review-i18n-1', model: 'sonnet', effort: 'medium', data: { skills: ['tdd', 'house-style'] } },
      ]);
      const brief = briefLines().replace('Step: implement', 'Step: review.review-i18n').replace('Agent: impl-T9', 'Agent: review.review-i18n-1');
      const result = hook(await sessionStart({ model: 'claude-sonnet-5-5', effort: 'medium' }, brief));

      expect(result.code).toBe(2);
      expect(result.err).toContain('review-i18n in the latest review eligible list');
    });

    test('other harnesses ignore the session tool', async () => {
      openItem();
      const input = await sessionStart({}, briefLines(['Skills']));

      expect(hook(input, ['--harness', 'codex']).code).toBe(0);
      expect(hook(input, ['--harness', 'cursor']).code).toBe(0);
    });
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

  test('injected text is the resume output followed by the card', () => {
    const resumed = agentic(['resume', '--work', 'demo']).out;

    expect(`${contextOf(compact(startEvent()).out)}\n`.startsWith(resumed)).toBe(true);
  });

  describe('card', () => {
    const cardOf = (out: string) => {
      const lines = contextOf(out).split('\n');

      return lines.slice(lines.findIndex((line) => line.startsWith('next:')) + 1);
    };

    test('has at most 6 lines with the fixed rules and the next skill call', () => {
      const card = cardOf(compact(startEvent()).out);

      expect(card.length).toBeLessThanOrEqual(6);
      expect(card.join('\n')).toContain(`/agentic-implement ${name}`);
      expect(card.join('\n')).toContain('log only through the helper (`step` before every spawn, `gate` for checks, `put` for files)');
      expect(card.join('\n')).toContain('pass model and effort exactly as printed');
      expect(card.join('\n')).toContain('survey note (hub set) and baseline gate before implement');
    });

    test('lists unconfirmed decisions', () => {
      writeLog(name, [
        { type: 'started', data: { workspace: { path: workspace, branch: 'b' } } },
        { type: 'decision', data: { id: 'D3', tag: 'structural', unconfirmed: true } },
      ]);

      expect(cardOf(compact(startEvent()).out)).toContain('unconfirmed: D3');
    });

    test('says unconfirmed: none when all are confirmed', () => {
      expect(cardOf(compact(startEvent()).out)).toContain('unconfirmed: none');
    });

    test('resume alone carries no card', () => {
      expect(agentic(['resume', '--work', 'demo']).out).not.toContain('pass model and effort');
    });
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

  test('an item recorded at the main checkout does not capture a linked worktree under it', () => {
    writeLog('20261101-old', [{ type: 'started', data: { cwd: sandbox } }]);

    expect(contextOf(compact(startEvent()).out)).toContain(`work: ${name}`);
  });

  const initMainWithLinkedWorktree = () => {
    git(sandbox, ['init', '-q', '-b', 'main']);
    git(sandbox, ['commit', '-q', '--allow-empty', '-m', 'init']);
    const linked = join(sandbox, 'trees', 'other');
    git(sandbox, ['worktree', 'add', '-q', '-b', 'other', linked]);

    return realpathSync(linked);
  };

  test('an item recorded at the main checkout does not capture a linked worktree no item owns', () => {
    const linked = initMainWithLinkedWorktree();
    writeLog('20261101-old', [{ type: 'started', data: { cwd: sandbox } }]);
    rmSync(itemDir(name), { recursive: true });
    const before = readLog('20261101-old').length;

    expect(compact(startEvent({ cwd: linked }))).toEqual({ code: 0, out: '', err: '' });
    expect(readLog('20261101-old')).toHaveLength(before);
  });

  test('an item recorded at the main checkout matches a plain subfolder of it', () => {
    initMainWithLinkedWorktree();
    writeLog('20261101-old', [{ type: 'started', data: { cwd: sandbox } }]);
    rmSync(itemDir(name), { recursive: true });
    const subfolder = join(sandbox, 'documentation');
    mkdirSync(subfolder);

    expect(contextOf(compact(startEvent({ cwd: subfolder })).out)).toContain('work: 20261101-old');
  });

  test('an item recorded at the main checkout still matches the main checkout itself', () => {
    writeLog('20261101-old', [{ type: 'started', data: { cwd: sandbox } }]);

    expect(contextOf(compact(startEvent({ cwd: sandbox })).out)).toContain('work: 20261101-old');
  });

  test('two items matching the same root: latest workflow-level started wins', () => {
    writeLog('20261101-old', [{ ts: '2026-11-07T10:00:00Z', type: 'started', data: { workspace: { path: workspace, branch: 'b' } } }]);

    expect(contextOf(compact(startEvent()).out)).toContain(`work: ${name}`);
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

  test('logs exactly one hook note', () => {
    const before = readLog(name).length;
    compact(startEvent());

    const added = readLog(name).slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ type: 'note', step: 'hook', data: { hook: 'compact' } });
  });

  test('unrelated cwd logs nothing', () => {
    const before = readLog(name).length;
    compact(startEvent({ cwd: sandbox }));

    expect(readLog(name)).toHaveLength(before);
  });

  test('matches a subfolder of the workspace', () => {
    const sub = join(workspace, 'src', 'deep');
    mkdirSync(sub, { recursive: true });

    expect(contextOf(compact(startEvent({ cwd: sub })).out)).toContain(`work: ${name}`);
  });

  test('a sibling sharing the path prefix is not inside', () => {
    mkdirSync(`${workspace}x`);

    expect(compact(startEvent({ cwd: `${workspace}x` }))).toEqual({ code: 0, out: '', err: '' });
  });

  test('matches the recorded session cwd when it differs from workspace.path', () => {
    const session = join(sandbox, 'session');
    mkdirSync(session);
    writeLog(name, [{ type: 'started', data: { cwd: session, workspace: { path: workspace, branch: 'b' } } }]);

    expect(contextOf(compact(startEvent({ cwd: session })).out)).toContain(`work: ${name}`);
  });

  test('matches while a nested child run is completed', () => {
    writeLog(name, [
      { type: 'started', data: { cwd: workspace } },
      { type: 'started', run: 'b111', workflow: 'to-spec', data: { cwd: workspace } },
      { type: 'completed', run: 'b111', workflow: 'to-spec' },
    ]);

    expect(contextOf(compact(startEvent()).out)).toContain(`work: ${name}`);
  });

  test('a closed run no longer matches', () => {
    writeLog(name, [{ type: 'started', data: { cwd: workspace } }, { type: 'completed' }]);

    expect(compact(startEvent())).toEqual({ code: 0, out: '', err: '' });
  });
});

describe('hook subagent-stop', () => {
  const name = '20261108-demo';
  const fixtureDir = join(import.meta.dir, 'fixtures');
  let workspace = '';
  let transcriptPath = '';

  beforeEach(() => {
    workspace = join(sandbox, 'ws');
    mkdirSync(workspace);
    transcriptPath = join(sandbox, 'agent-transcript.jsonl');
    writeLog(name, [
      { workflow: 'implement', type: 'started', data: { workspace: { path: workspace, branch: 'b' } } },
      { workflow: 'implement', type: 'started', step: 'implement', agent: 'impl-T9', data: { skills: ['tdd', 'house-style'] } },
    ]);
  });

  const fixtureLines = async () => (await Bun.file(join(fixtureDir, 'subagent-transcript.jsonl')).text()).trim().split('\n');

  const writeTranscript = async (drop: readonly number[], prompt = 'Agent: impl-T9 · Model: sonnet\n\nTask: demo') => {
    const lines = await fixtureLines();
    const first = JSON.parse(lines[0] ?? '{}');
    first.message.content = prompt;
    const kept = [JSON.stringify(first), ...lines.slice(1).filter((_, index) => !drop.includes(index + 1))];
    await Bun.write(transcriptPath, `${kept.join('\n')}\n`);
  };

  const payload = async (extra: Record<string, unknown> = {}) => ({
    ...JSON.parse(await Bun.file(join(fixtureDir, 'hook-claude-subagent-stop.json')).text()),
    cwd: workspace,
    agent_transcript_path: transcriptPath,
    ...extra,
  });

  const stop = (input: Record<string, unknown>) => {
    const result = Bun.spawnSync([process.execPath, scriptPath, 'hook', 'subagent-stop', '--harness', 'claude'], {
      cwd: sandbox,
      env: { ...process.env, AGENTIC_OUTPUT: outputRoot },
      stdin: new TextEncoder().encode(JSON.stringify(input)),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
  };

  const notes = () => readLog(name).filter((event) => event.type === 'note');

  test('missing skill, not yet active: block once naming the skill', async () => {
    await writeTranscript([2]);
    const before = readLog(name).length;
    const result = stop(await payload({ stop_hook_active: false }));

    expect(result.code).toBe(0);
    const decision = JSON.parse(result.out);
    expect(decision.decision).toBe('block');
    expect(decision.reason).toContain('house-style');
    expect(decision.reason).not.toContain('tdd,');
    expect(readLog(name).length).toBe(before);
  });

  test('missing skill, already active: allow and log a note', async () => {
    await writeTranscript([2]);
    const result = stop(await payload({ stop_hook_active: true }));

    expect(result).toEqual({ code: 0, out: '', err: '' });
    expect(notes().at(-1)?.data).toEqual({ agent: 'impl-T9', missing: ['house-style'] });
  });

  test('all loaded through a Skill call and a SKILL.md Read: silent, no event', async () => {
    await writeTranscript([]);
    const before = readLog(name).length;

    expect(stop(await payload())).toEqual({ code: 0, out: '', err: '' });
    expect(readLog(name).length).toBe(before);
  });

  test('both loads missing names both skills', async () => {
    await writeTranscript([1, 2]);

    expect(JSON.parse(stop(await payload()).out).reason).toMatch(/tdd.*house-style|house-style.*tdd/);
  });

  test('no item for the agent label: silent', async () => {
    await writeTranscript([1, 2], 'Agent: someone-else\n\nTask: demo');

    expect(stop(await payload())).toEqual({ code: 0, out: '', err: '' });
  });

  test('no matching work item: silent', async () => {
    await writeTranscript([1, 2]);

    expect(stop(await payload({ cwd: sandbox }))).toEqual({ code: 0, out: '', err: '' });
  });

  test('payload without transcript path: note only', async () => {
    const before = readLog(name).length;
    const { agent_transcript_path: _omitted, ...rest } = await payload();
    const result = stop(rest);

    expect(result).toEqual({ code: 0, out: '', err: '' });
    expect(readLog(name).length).toBe(before + 1);
    expect(notes().at(-1)?.step).toBe('hook');
  });

  test('unreadable transcript or empty stdin: exit 0, silent', async () => {
    expect(stop(await payload({ agent_transcript_path: join(sandbox, 'missing.jsonl') }))).toEqual({ code: 0, out: '', err: '' });
    expect(stop({})).toEqual({ code: 0, out: '', err: '' });
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
      { workflow: 'implement', type: 'started', step: 'implement', agent: 'impl-T9', model: 'sonnet', effort: 'low', data: { skills: ['tdd'] } },
    ]);
  });

  const brief = (omitSkills = false) =>
    [
      'Step: implement',
      `Work item: ${itemDir(name)}`,
      'Agent: impl-T9 · Model: sonnet · Effort: medium',
      'Load skills: tdd',
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

  test('every fixture declares its source: captured for Claude, doc-derived otherwise', async () => {
    for (const file of new Bun.Glob('hook-*.json').scanSync(fixtureDir)) {
      const source = String((await fixture(file))._source);
      if (file === 'hook-claude-ask.json') expect(source).toContain('doc-derived from code.claude.com/docs/en/hooks');
      else if (file.startsWith('hook-claude-')) expect(source).toMatch(/^captured \d{4}-\d{2}-\d{2}, Claude Code \d+\.\d+\.\d+/);
      else expect(source).toContain('doc-derived 2026-11-08, not captured');
    }
  });

  test('captured claude fixtures carry the fields the hooks rely on', async () => {
    const stop = await fixture('hook-claude-subagent-stop.json');
    expect(stop.hook_event_name).toBe('SubagentStop');
    expect(typeof stop.agent_transcript_path).toBe('string');
    expect(typeof stop.stop_hook_active).toBe('boolean');
    expect(typeof stop.cwd).toBe('string');
    const spawnInput = (await fixture('hook-claude-spawn.json')).tool_input as Record<string, unknown>;
    expect(spawnInput.model).toBe('sonnet');
    expect(spawnInput.effort).toBe('low');
  });

  test('claude session-start fixture: complete brief allows, missing Skills denies', async () => {
    const base = await fixture('hook-claude-spawn-session.json');
    const withBrief = (prompt: string) => ({ ...base, cwd: workspace, tool_input: { ...(base.tool_input as object), prompt } });

    expect(run('spawn', 'claude', withBrief(brief()))).toEqual({ code: 0, out: '', err: '' });
    const denied = run('spawn', 'claude', withBrief(brief(true)));
    expect(denied.code).toBe(2);
    expect(JSON.parse(denied.out).hookSpecificOutput.permissionDecisionReason).toContain('Skills:');
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

describe('merge', () => {
  const name = '20261108-demo';
  const prUrl = 'https://github.com/o/r/pull/7';
  const head = 'a'.repeat(40);
  let repo = '';
  let ghPath = '';
  let ghLog = '';

  const green = { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS', startedAt: '2026-11-08T10:00:00Z', completedAt: '2026-11-08T10:05:00Z' };
  const billingBlocked = { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE', startedAt: '2026-11-08T10:00:00Z', completedAt: '2026-11-08T10:00:02Z' };
  const vercel = { __typename: 'StatusContext', context: 'Vercel', state: 'SUCCESS' };
  const skipped = { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SKIPPED', startedAt: '2026-11-08T10:00:00Z', completedAt: '2026-11-08T10:00:00Z' };
  const runs = { workflow_runs: [{ id: 43749663937, name: 'CI', conclusion: 'failure' }] };
  const unstartedJobs = { jobs: [{ id: 1, conclusion: 'failure', steps: [] }, { id: 2, conclusion: 'failure', steps: [] }] };
  const startedJobs = { jobs: [{ id: 1, conclusion: 'success', steps: [{ name: 'Set up job', conclusion: 'success' }] }, { id: 2, conclusion: 'failure', steps: [] }] };
  const red = { ...green, conclusion: 'FAILURE' };

  const view = (overrides: Record<string, unknown> = {}) => ({ mergeable: 'MERGEABLE', headRefOid: head, statusCheckRollup: [green], ...overrides });

  const cleanReview = (counts = { blocker: 0, major: 0, minor: 1, nit: 0 }, reviewedHead = head): readonly TestEvent[] => [
    { type: 'started', step: null, workflow: 'review', run: 'b001' },
    { type: 'completed', step: 'review.code-review', workflow: 'review', run: 'b001', iteration: 1, data: { counts } },
    { type: 'completed', step: null, workflow: 'review', run: 'b001', data: { head: reviewedHead } },
  ];

  const prEvent: TestEvent = { type: 'artifact', step: 'implement', data: { name: 'pr', pr: { url: prUrl, round: 1 } } };

  const merge = (rollup: Record<string, unknown> = view(), actions: { runs: unknown; jobs: unknown } = { runs, jobs: startedJobs }) =>
    agentic(['merge', '--work', 'demo'], {
      cwd: repo,
      env: { AGENTIC_GH: ghPath, FAKE_VIEW: JSON.stringify(rollup), FAKE_RUNS: JSON.stringify(actions.runs), FAKE_JOBS: JSON.stringify(actions.jobs), FAKE_GH_LOG: ghLog },
    });
  const billingBlockedActions = { runs, jobs: unstartedJobs };
  const billingBlockedCheck = { ...billingBlocked, name: 'verify', workflowName: 'CI', detailsUrl: 'https://github.com/o/r/actions/runs/1001/job/1' };

  const ghCalls = () => (existsSync(ghLog) ? readFileSync(ghLog, 'utf8').split('\n').filter(Boolean) : []);
  const mergeCalls = () => ghCalls().filter((call) => call.startsWith('pr merge'));
  const writeMarker = (sha: string, content = sha) => {
    const dir = join(repo, '.git', 'agentic', 'ci-pass');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, sha), content);
  };

  beforeEach(() => {
    repo = join(sandbox, 'repo');
    mkdirSync(repo);
    git(repo, ['init', '-q', '-b', 'main']);
    git(repo, ['commit', '-q', '--allow-empty', '-m', 'init']);
    ghLog = join(sandbox, 'gh.log');
    ghPath = join(sandbox, 'gh');
    writeFileSync(ghPath, '#!/bin/bash\necho "$*" >> "$FAKE_GH_LOG"\n[ "$2" = view ] && echo "$FAKE_VIEW"\n[ "$1" = api ] && case "$2" in *"/jobs") echo "$FAKE_JOBS" ;; *) echo "$FAKE_RUNS" ;; esac\nexit 0\n');
    chmodSync(ghPath, 0o755);
    writeLog(name, [prEvent, ...cleanReview()]);
  });

  test('clean review, mergeable, green checks: squash-merges pinned to head', () => {
    const result = merge();

    expect(result.code).toBe(0);
    expect(mergeCalls()).toEqual([`pr merge 7 --squash --match-head-commit ${head}`]);
    const logged = readLog(name).at(-1);
    expect(logged).toMatchObject({ workflow: 'babysit-pr', step: 'merge', type: 'completed', data: { pr: 7, head, proof: 'github-checks' } });
  });

  test('Actions blocked (jobs without steps) and marker for head: merges with local-ci proof', () => {
    writeMarker(head);

    const result = merge(view({ statusCheckRollup: [billingBlockedCheck, skipped, vercel] }), billingBlockedActions);

    expect(result.code).toBe(0);
    expect(mergeCalls()).toHaveLength(1);
    expect(readLog(name).at(-1)).toMatchObject({ data: { pr: 7, head, proof: 'local-ci' } });
  });

  test('Actions blocked without marker refuses', () => {
    const result = merge(view({ statusCheckRollup: [billingBlockedCheck, vercel] }), billingBlockedActions);

    expect(result.code).toBe(1);
    expect(result.err).toContain(`no CI proof for head ${head}`);
    expect(mergeCalls()).toEqual([]);
  });

  test('no workflow run on head and marker: local-ci proof', () => {
    writeMarker(head);

    expect(merge(view({ statusCheckRollup: [] }), { runs: { workflow_runs: [] }, jobs: { jobs: [] } }).code).toBe(0);
    expect(readLog(name).at(-1)).toMatchObject({ data: { proof: 'local-ci' } });
  });

  test('marker for another sha refuses', () => {
    writeMarker('b'.repeat(40));

    const result = merge(view({ statusCheckRollup: [billingBlocked] }), billingBlockedActions);

    expect(result.code).toBe(1);
    expect(result.err).toContain(`no CI proof for head ${head}`);
    expect(mergeCalls()).toEqual([]);
  });

  test('marker holding another sha refuses', () => {
    writeMarker(head, 'b'.repeat(40));

    expect(merge(view({ statusCheckRollup: [] }), { runs: { workflow_runs: [] }, jobs: { jobs: [] } }).code).toBe(1);
    expect(mergeCalls()).toEqual([]);
  });

  test('a job with steps and a failed check refuses even with a marker', () => {
    writeMarker(head);

    const result = merge(view({ statusCheckRollup: [green, red] }));

    expect(result.code).toBe(1);
    expect(result.err).toContain('checks not green');
    expect(mergeCalls()).toEqual([]);
  });

  test('a job with steps and a check still running refuses', () => {
    const running = { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '', startedAt: '2026-11-08T10:00:00Z', completedAt: '0001-01-01T00:00:00Z' };

    expect(merge(view({ statusCheckRollup: [running] })).code).toBe(1);
    expect(mergeCalls()).toEqual([]);
  });

  test('conflict refuses', () => {
    const result = merge(view({ mergeable: 'CONFLICTING' }));

    expect(result.code).toBe(1);
    expect(result.err).toContain('conflict');
    expect(mergeCalls()).toEqual([]);
  });

  test('unknown mergeable refuses', () => {
    expect(merge(view({ mergeable: 'UNKNOWN' })).code).toBe(1);
    expect(mergeCalls()).toEqual([]);
  });

  test('latest review failed refuses', () => {
    writeLog(name, [prEvent, ...cleanReview(), { type: 'started', step: null, workflow: 'review', run: 'b002' }, { type: 'failed', step: null, workflow: 'review', run: 'b002' }]);

    const result = merge();

    expect(result.code).toBe(1);
    expect(result.err).toContain('review not clean');
    expect(mergeCalls()).toEqual([]);
  });

  test('latest review not completed refuses', () => {
    writeLog(name, [prEvent, ...cleanReview(), { type: 'started', step: null, workflow: 'review', run: 'b002' }]);

    expect(merge().code).toBe(1);
    expect(mergeCalls()).toEqual([]);
  });

  test('no review logged refuses', () => {
    writeLog(name, [prEvent]);

    expect(merge().err).toContain('review not clean');
    expect(mergeCalls()).toEqual([]);
  });

  test('blocker or major left in the last iteration refuses', () => {
    writeLog(name, [prEvent, ...cleanReview({ blocker: 0, major: 1, minor: 0, nit: 0 })]);

    const result = merge();

    expect(result.code).toBe(1);
    expect(result.err).toContain('review not clean');
    expect(mergeCalls()).toEqual([]);
  });

  test('only the last iteration counts', () => {
    writeLog(name, [
      prEvent,
      { type: 'started', step: null, workflow: 'review', run: 'b001' },
      { type: 'completed', step: 'review.code-review', workflow: 'review', run: 'b001', iteration: 1, data: { counts: { blocker: 2, major: 1, minor: 0, nit: 0 } } },
      { type: 'completed', step: 'review.code-review', workflow: 'review', run: 'b001', iteration: 2, data: { counts: { blocker: 0, major: 0, minor: 0, nit: 0 } } },
      { type: 'completed', step: null, workflow: 'review', run: 'b001', data: { head } },
    ]);

    expect(merge().code).toBe(0);
  });

  test('playbook review step completed counts as a clean review', () => {
    writeLog(name, [
      prEvent,
      { type: 'started', step: 'review', workflow: 'implement-feature', run: 'c001' },
      { type: 'completed', step: 'review.code-review', workflow: 'implement-feature', run: 'c001', iteration: 1, data: { counts: { blocker: 0, major: 0, minor: 0, nit: 0 } } },
      { type: 'completed', step: 'review', workflow: 'implement-feature', run: 'c001', data: { head } },
    ]);

    expect(merge().code).toBe(0);
    expect(mergeCalls()).toHaveLength(1);
  });

  test('a clean review of another head refuses', () => {
    writeLog(name, [prEvent, ...cleanReview(undefined, 'b'.repeat(40))]);

    const result = merge();

    expect(result.code).toBe(1);
    expect(result.err).toContain(`review not clean for head ${head}`);
    expect(mergeCalls()).toEqual([]);
  });

  test('a clean review without a recorded head refuses', () => {
    writeLog(name, [prEvent, ...cleanReview().map((event) => (event.data?.head === undefined ? event : { ...event, data: {} }))]);

    expect(merge().err).toContain(`review not clean for head ${head}`);
    expect(mergeCalls()).toEqual([]);
  });

  test('the helper records the checkout head on a review completed event', () => {
    writeLog(name, [{ type: 'started', step: null, workflow: 'review', run: 'b001' }]);

    const result = agentic(['event', '--type', 'completed', '--step', 'review', '--summary', 'x', '--work', 'demo'], { cwd: repo });

    const sha = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: repo, stdout: 'pipe' }).stdout.toString().trim();
    expect(result.code).toBe(0);
    expect(readLog(name).at(-1).data.head).toBe(sha);
    const workflowLevel = agentic(['event', '--type', 'completed', '--workflow', 'review', '--summary', 'x', '--work', 'demo'], { cwd: repo });
    expect(workflowLevel.code).toBe(0);
    expect(readLog(name).at(-1).data.head).toBe(sha);
  });

  describe('review bound to the patch, not the sha', () => {
    const headOf = () => Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: repo, stdout: 'pipe' }).stdout.toString().trim();
    const workspaceEvent: TestEvent = { type: 'progress', step: 'implement', data: { workspace: { kind: 'worktree', branch: 'feat', base: 'main', path: repo } } };

    const commitFile = (file: string, content: string) => {
      writeFileSync(join(repo, file), content);
      git(repo, ['add', file]);
      git(repo, ['commit', '-q', '-m', file]);
    };

    const reviewAtCheckout = () => {
      writeLog(name, [prEvent, workspaceEvent, { type: 'started', step: null, workflow: 'review', run: 'b001' }, ...cleanReview().slice(1, 2)]);
      expect(agentic(['event', '--type', 'completed', '--step', 'review', '--summary', 'x', '--work', 'demo'], { cwd: repo }).code).toBe(0);
    };

    const mergeAt = (prHead: string) => merge(view({ headRefOid: prHead }));

    beforeEach(() => {
      git(repo, ['checkout', '-q', '-b', 'feat']);
      commitFile('feature.txt', 'feature\n');
    });

    test('the review completed event records the patch id', () => {
      reviewAtCheckout();

      expect(readLog(name).at(-1).data.patchId).toMatch(/^[0-9a-f]{40}$/);
    });

    test('a backdated review completed event (--ts) is not stamped with the current head', () => {
      writeLog(name, [prEvent, workspaceEvent, { type: 'started', step: null, workflow: 'review', run: 'b001' }, ...cleanReview().slice(1, 2)]);

      const result = agentic(['event', '--type', 'completed', '--step', 'review', '--summary', 'x', '--ts', '2026-01-01T00:00:00Z', '--work', 'demo'], { cwd: repo });

      expect(result.code).toBe(0);
      expect(readLog(name).at(-1).data ?? {}).not.toHaveProperty('head');
      expect(readLog(name).at(-1).data ?? {}).not.toHaveProperty('patchId');
    });

    test('a backdated review completed event drops head and patch id passed in --data and records recordedAt', () => {
      writeLog(name, [prEvent, workspaceEvent, { type: 'started', step: null, workflow: 'review', run: 'b001' }, ...cleanReview().slice(1, 2)]);
      const data = JSON.stringify({ head: 'a'.repeat(40), patchId: 'b'.repeat(40) });

      agentic(['event', '--type', 'completed', '--step', 'review', '--summary', 'x', '--ts', '2026-01-01T00:00:00Z', '--data', data, '--work', 'demo'], { cwd: repo });

      const recorded = readLog(name).at(-1).data;
      expect(recorded).not.toHaveProperty('head');
      expect(recorded).not.toHaveProperty('patchId');
      expect(recorded.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    test('merge refuses when the only review completed event is backdated', () => {
      writeLog(name, [prEvent, workspaceEvent, { type: 'started', step: null, workflow: 'review', run: 'b001' }]);
      agentic(['event', '--type', 'completed', '--step', 'review', '--summary', 'x', '--ts', '2026-01-01T00:00:00Z', '--data', JSON.stringify({ head }), '--work', 'demo'], { cwd: repo });

      const result = merge();

      expect(result.code).not.toBe(0);
      expect(result.err).toContain('review not clean for head');
    });

    test('a conflict-free rebase onto a moved base keeps the review valid', () => {
      reviewAtCheckout();
      const reviewed = headOf();
      git(repo, ['checkout', '-q', 'main']);
      commitFile('other.txt', 'other\n');
      git(repo, ['checkout', '-q', 'feat']);
      git(repo, ['rebase', '-q', 'main']);
      const rebased = headOf();
      expect(rebased).not.toBe(reviewed);

      const result = mergeAt(rebased);

      expect(result.code).toBe(0);
      expect(mergeCalls()).toEqual([`pr merge 7 --squash --match-head-commit ${rebased}`]);
    });

    test('a diff over 1 MiB records the patch id and survives a rebase', () => {
      commitFile('big.txt', 'x'.repeat(79).concat('\n').repeat(30_000));
      reviewAtCheckout();
      expect(readLog(name).at(-1).data.patchId).toMatch(/^[0-9a-f]{40}$/);
      git(repo, ['checkout', '-q', 'main']);
      commitFile('other.txt', 'other\n');
      git(repo, ['checkout', '-q', 'feat']);
      git(repo, ['rebase', '-q', 'main']);
      const rebased = headOf();

      const result = mergeAt(rebased);

      expect(result.code).toBe(0);
      expect(mergeCalls()).toEqual([`pr merge 7 --squash --match-head-commit ${rebased}`]);
    });

    test('a whitespace-only change after the review refuses', () => {
      reviewAtCheckout();
      commitFile('feature.txt', '    feature\n');

      const result = mergeAt(headOf());

      expect(result.code).toBe(1);
      expect(result.err).toContain('review not clean');
      expect(mergeCalls()).toEqual([]);
    });

    test('a review closed without a computable patch id logs a note saying so', () => {
      writeLog(name, [prEvent, { type: 'started', step: null, workflow: 'review', run: 'b001' }]);

      agentic(['event', '--type', 'completed', '--step', 'review', '--summary', 'x', '--work', 'demo'], { cwd: repo });

      const notes = readLog(name).filter((event) => event.type === 'note' && String(event.summary).includes('patch-id'));
      expect(notes).toHaveLength(1);
    });

    test('a code change after the review refuses', () => {
      reviewAtCheckout();
      commitFile('extra.txt', 'extra\n');

      const result = mergeAt(headOf());

      expect(result.code).toBe(1);
      expect(result.err).toContain('review not clean');
      expect(mergeCalls()).toEqual([]);
    });

    test('a local checkout behind the PR head refuses', () => {
      reviewAtCheckout();

      const result = mergeAt('c'.repeat(40));

      expect(result.code).toBe(1);
      expect(result.err).toContain('checkout not at PR head');
      expect(mergeCalls()).toEqual([]);
    });
  });

  test('a red non-Actions status on the marker path refuses', () => {
    writeMarker(head);
    const failing = { __typename: 'StatusContext', context: 'Vercel', state: 'FAILURE' };

    const result = merge(view({ statusCheckRollup: [billingBlockedCheck, failing] }), billingBlockedActions);

    expect(result.code).toBe(1);
    expect(result.err).toContain('checks not green: Vercel');
    expect(mergeCalls()).toEqual([]);
  });

  test('a red third-party check run on the marker path refuses', () => {
    writeMarker(head);
    const thirdParty = { __typename: 'CheckRun', name: 'sonar', workflowName: '', detailsUrl: 'https://sonar.example/1', status: 'COMPLETED', conclusion: 'FAILURE' };

    expect(merge(view({ statusCheckRollup: [billingBlockedCheck, thirdParty] }), billingBlockedActions).code).toBe(1);
    expect(mergeCalls()).toEqual([]);
  });

  test('no PR in state refuses', () => {
    writeLog(name, cleanReview());

    const result = merge();

    expect(result.code).toBe(1);
    expect(result.err).toContain('no pr');
    expect(ghCalls()).toEqual([]);
  });

  test('a refusal logs no merge event', () => {
    merge(view({ mergeable: 'CONFLICTING' }));

    expect(readLog(name).some((event) => event.step === 'merge')).toBe(false);
  });

  test('arguments are a usage error', () => {
    expect(agentic(['merge', 'extra', '--work', 'demo']).code).toBe(2);
  });
});

const managerDir = () => join(outputRoot, '_manager');
const managerState = () => JSON.parse(readFileSync(join(managerDir(), 'state.json'), 'utf8'));
const managerLog = () =>
  readFileSync(join(managerDir(), 'events.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line));

const manager = (args: readonly string[], options: RunOptions = {}) => agentic(['manager', ...args], options);

const managerOk = (args: readonly string[], options: RunOptions = {}) => {
  const result = manager(args, options);
  expect(result.err).toBe('');
  expect(result.code).toBe(0);

  return result.out;
};

const writeManagerLog = (events: readonly Record<string, unknown>[]) => {
  mkdirSync(managerDir(), { recursive: true });
  const lines = events.map((event, index) => JSON.stringify({ ts: `2026-11-21T10:00:${String(index).padStart(2, '0')}Z`, ...event }));
  writeFileSync(join(managerDir(), 'events.jsonl'), `${lines.join('\n')}\n`);
};

const unitAdd = (id: string, extra: Record<string, unknown> = {}) => ({
  type: 'unit-add',
  id,
  title: `title of ${id}`,
  kind: 'free',
  model: 'opus',
  effort: 'high',
  deps: [],
  presets: {},
  ...extra,
});

const unitSet = (id: string, changes: Record<string, unknown>) => ({ type: 'unit-set', id, ...changes });

const startedLedger = (extra: readonly Record<string, unknown>[] = []) =>
  writeManagerLog([{ type: 'start', cwd: sandbox }, ...extra]);

const writeProjectConfig = (config: object) => writeFileSync(join(sandbox, '.agentic.json'), JSON.stringify(config));

describe('manager start', () => {
  test('creates the ledger, records the cwd and prints heartbeat then status', () => {
    const out = managerOk(['start']);

    expect(out.split('\n')[0]).toBe('heartbeat: 15m');
    expect(out).toContain('attention: none');
    expect(readFileSync(join(managerDir(), 'decisions.md'), 'utf8')).toContain('# Manager decisions');
    expect(managerLog()).toHaveLength(1);
    expect(managerLog()[0]).toMatchObject({ type: 'start', cwd: sandbox });
    expect(managerState().cwd).toBe(sandbox);
  });

  test('a second run from the same cwd appends nothing', () => {
    managerOk(['start']);
    managerOk(['start']);

    expect(managerLog()).toHaveLength(1);
  });

  test('a run from another cwd records the new cwd', () => {
    managerOk(['start']);
    const other = join(sandbox, 'other');
    mkdirSync(other);
    managerOk(['start'], { cwd: other });

    expect(managerLog()).toHaveLength(2);
    expect(managerState().cwd).toBe(other);
  });

  test('heartbeat comes from limits, project over user', () => {
    const home = join(sandbox, 'home');
    mkdirSync(join(home, '.agentic'), { recursive: true });
    writeFileSync(join(home, '.agentic', 'config.json'), JSON.stringify({ limits: { 'manager.heartbeat': 20, 'manager.parallel': 2 } }));
    writeProjectConfig({ limits: { 'manager.heartbeat': 30 } });

    expect(managerOk(['start'], { env: { HOME: home } }).split('\n')[0]).toBe('heartbeat: 30m');
  });

  test.each([
    ['status'],
    ['brief', 'a'],
    ['unit', 'add', 'a', '--title', 't', '--kind', 'free'],
  ])('other commands need a ledger: manager %s', (...args) => {
    const result = manager(args);

    expect(result.code).toBe(1);
    expect(result.err).toContain('no manager ledger: run manager start');
  });
});

describe('manager unit add', () => {
  beforeEach(() => {
    managerOk(['start']);
  });

  const add = (id: string, flags: readonly string[]) => manager(['unit', 'add', id, '--title', `title ${id}`, ...flags]);

  test('queues a free unit with the built-in unit tier', () => {
    expect(managerOk(['unit', 'add', 'a', '--title', 'First', '--kind', 'free'])).toBe('unit a queued model opus effort high\n');
    expect(managerState().units.a).toMatchObject({ title: 'First', kind: 'free', state: 'queued', model: 'opus', effort: 'high', attended: false });
    expect(managerLog().at(-1)).toMatchObject({ type: 'unit-add', id: 'a' });
  });

  test('a playbook unit strips the agentic- prefix and stores input, deps, presets and for', () => {
    managerOk(['unit', 'add', 'base', '--title', 'Base', '--kind', 'free']);
    managerOk([
      'unit', 'add', 'dbg', '--title', 'Debug', '--kind', 'playbook', '--playbook', 'agentic-debug', '--input', 'login 500',
      '--deps', 'base', '--dep-mode', 'wait', '--preset', 'mode=light', '--preset', 'tickets=no', '--for', 'base',
    ]);

    expect(managerState().units.dbg).toMatchObject({
      playbook: 'debug', input: 'login 500', deps: ['base'], depMode: 'wait', presets: { mode: 'light', tickets: 'no' }, for: 'base',
    });
  });

  test('a sidequest uses unit.sidequest: sonnet / high', () => {
    expect(managerOk(['unit', 'add', 's', '--title', 'Side', '--kind', 'sidequest'])).toBe('unit s queued model sonnet effort high\n');
  });

  test('steps.claude.unit overrides a playbook unit', () => {
    writeProjectConfig({ steps: { claude: { unit: { model: 'sonnet', effort: 'low' } } } });

    expect(add('a', ['--kind', 'playbook', '--playbook', 'debug']).out).toBe('unit a queued model sonnet effort low\n');
  });

  test('steps.claude["unit.debug"] overrides only debug units', () => {
    writeProjectConfig({ steps: { claude: { 'unit.debug': { model: 'haiku', effort: 'low' } } } });

    expect(add('a', ['--kind', 'playbook', '--playbook', 'debug']).out).toBe('unit a queued model haiku effort low\n');
    expect(add('b', ['--kind', 'playbook', '--playbook', 'implement-feature']).out).toBe('unit b queued model opus effort high\n');
  });

  test('--model and --effort win', () => {
    writeProjectConfig({ steps: { claude: { unit: { model: 'sonnet' } } } });

    expect(add('a', ['--kind', 'free', '--model', 'haiku', '--effort', 'max']).out).toBe('unit a queued model haiku effort max\n');
  });

  test.each([
    ['bad id', 'Bad_Id', ['--kind', 'free']],
    ['bad kind', 'a', ['--kind', 'weird']],
    ['playbook kind without --playbook', 'a', ['--kind', 'playbook']],
    ['unknown playbook', 'a', ['--kind', 'playbook', '--playbook', 'nope']],
    ['--playbook on a free unit', 'a', ['--kind', 'free', '--playbook', 'debug']],
    ['unknown dep', 'a', ['--kind', 'free', '--deps', 'ghost', '--dep-mode', 'wait']],
    ['--deps without --dep-mode', 'a', ['--kind', 'free', '--deps', 'x']],
    ['bad dep-mode', 'a', ['--kind', 'free', '--deps', 'x', '--dep-mode', 'later']],
    ['unknown --for', 'a', ['--kind', 'sidequest', '--for', 'ghost']],
    ['bad preset', 'a', ['--kind', 'free', '--preset', 'novalue']],
    ['empty title', 'a', ['--kind', 'free', '--title', '']],
  ])('%s exits 1', (_label, id, flags) => {
    managerOk(['unit', 'add', 'x', '--title', 'X', '--kind', 'free']);

    expect(manager(['unit', 'add', id, '--title', 'T', ...flags]).code).toBe(1);
    expect(Object.keys(managerState().units)).toEqual(['x']);
  });

  test('a duplicate id exits 1', () => {
    expect(add('a', ['--kind', 'free']).code).toBe(0);
    expect(add('a', ['--kind', 'free']).code).toBe(1);
  });

  test('missing --title or --kind exits 2', () => {
    expect(manager(['unit', 'add', 'a', '--kind', 'free']).code).toBe(2);
    expect(manager(['unit', 'add', 'a', '--title', 'T']).code).toBe(2);
  });
});

describe('manager unit set', () => {
  beforeEach(() => {
    startedLedger([unitAdd('a'), unitAdd('b')]);
  });

  test('updates only the given fields', () => {
    const out = managerOk(['unit', 'set', 'a', '--state', 'running', '--branch', 'feat-a', '--session', 'local_1']);

    expect(out).toBe('unit a updated: state, session, branch\n');
    expect(managerState().units.a).toMatchObject({ state: 'running', branch: 'feat-a', session: 'local_1', model: 'opus', title: 'title of a' });
    expect(managerLog().at(-1)).toEqual({ ts: expect.any(String), type: 'unit-set', id: 'a', state: 'running', branch: 'feat-a', session: 'local_1' });
  });

  test('sets pr, summary, model, effort, attended and paused-by', () => {
    managerOk(['unit', 'set', 'a', '--pr', 'https://x/pull/1', '--summary', 'done it', '--model', 'sonnet', '--effort', 'low', '--attended', 'true', '--paused-by', 'b']);

    expect(managerState().units.a).toMatchObject({ pr: 'https://x/pull/1', summary: 'done it', model: 'sonnet', effort: 'low', attended: true, pausedBy: ['b'] });
  });

  test('--path is stored as realpath when it exists', () => {
    const real = join(sandbox, 'real');
    mkdirSync(real);
    symlinkSync(real, join(sandbox, 'link'));
    managerOk(['unit', 'set', 'a', '--path', join(sandbox, 'link')]);
    managerOk(['unit', 'set', 'b', '--path', join(sandbox, 'missing')]);

    expect(managerState().units.a.path).toBe(real);
    expect(managerState().units.b.path).toBe(join(sandbox, 'missing'));
  });

  test.each([
    ['unknown unit', ['ghost', '--state', 'running']],
    ['bad state', ['a', '--state', 'sleeping']],
    ['bad attended', ['a', '--attended', 'maybe']],
    ['unknown paused-by', ['a', '--paused-by', 'ghost']],
  ])('%s exits 1 and changes nothing', (_label, args) => {
    const before = managerLog().length;

    expect(manager(['unit', 'set', ...args]).code).toBe(1);
    expect(managerLog()).toHaveLength(before);
  });

  test('no field given exits 2', () => {
    expect(manager(['unit', 'set', 'a']).code).toBe(2);
  });
});

describe('manager brief', () => {
  const relayLines = (id: string) => [
    '## Relay protocol',
    'Start the final message of every turn with one status line, then its block:',
    '',
    `- \`Unit ${id}: question\` — numbered questions, each with options, your recommended one first. Use it wherever a skill asks the user or calls a question tool, then end your turn. The answer arrives as a message from the manager.`,
    `- \`Unit ${id}: sidequest\` — a project-global problem outside your scope: what, where, whether it blocks you, your workaround if you continue. Report it; its fix belongs to another unit.`,
    `- \`Unit ${id}: pr-ready\` — PR url, checks and review state.`,
    `- \`Unit ${id}: blocked\` — what stopped you, what you need.`,
    `- \`Unit ${id}: working\` — you are idle only because your own background work runs; this line alone. The manager stays silent; the heartbeat still sees your progress.`,
    `- \`Unit ${id}: done\` — what changed, commits or PR, anything unverified.`,
    '',
    'Merge a PR only at the head sha for which a manager message relays the owner\'s yes; head moved since → report `pr-ready` again.',
  ];

  test('prints the start line and the exact playbook prompt', () => {
    startedLedger([
      unitAdd('other', { title: 'Other work', state: 'queued' }),
      unitAdd('fix', {
        title: 'Fix login',
        kind: 'playbook',
        playbook: 'debug',
        input: 'login 500',
        model: 'sonnet',
        effort: 'medium',
        presets: { mode: 'light', workspace: 'current' },
      }),
    ]);

    const expected = [
      'start_session: model=sonnet effort=medium use_worktree=true branch_name=fix',
      '--- prompt ---',
      'Manager unit: fix',
      'Work item: none',
      '',
      'You are work unit fix of an agents-manager session: Fix login. The owner talks only to the manager; the manager relays.',
      '',
      '## Task',
      '/agentic-debug login 500',
      '',
      'Already decided by the owner; use these as answers and ask only what is still open:',
      '- mode: light',
      '- workspace: current',
      '',
      'Other units in this repo; their areas are theirs:',
      '- other (queued): Other work',
      '',
      ...relayLines('fix'),
      '',
    ].join('\n');

    expect(managerOk(['brief', 'fix'])).toBe(expected);
  });

  test('a free unit prints its input as the task; a sidequest names its raiser; merged siblings are left out', () => {
    startedLedger([
      unitAdd('raiser', { state: 'merged' }),
      unitAdd('side', { kind: 'sidequest', input: 'repair the flaky seed', for: 'raiser' }),
    ]);
    const out = managerOk(['brief', 'side']);

    expect(out).toContain('## Task\nrepair the flaky seed\nRaised by unit raiser.\n');
    expect(out).not.toContain('Other units in this repo');
    expect(out).not.toContain('Already decided');
  });

  test('wait and stacked deps; stacked adds source_branch', () => {
    startedLedger([
      unitAdd('base', { state: 'running', branch: 'base-branch' }),
      unitAdd('w', { deps: ['base'], depMode: 'wait' }),
      unitAdd('s', { deps: ['base'], depMode: 'stacked' }),
    ]);
    const wait = managerOk(['brief', 'w']);
    const stacked = managerOk(['brief', 's']);

    expect(wait.split('\n')[0]).toBe('start_session: model=opus effort=high use_worktree=true branch_name=w');
    expect(wait).toContain('Depends on base (wait). Hold implementation until the manager relays that base merged: stop before writing code and report `blocked`.');
    expect(stacked.split('\n')[0]).toBe('start_session: model=opus effort=high use_worktree=true branch_name=s source_branch=base-branch');
    expect(stacked).toContain('Depends on base (stacked). Your branch starts from base-branch; retarget your PR after base merges.');
  });

  test('a stacked dep without a recorded branch exits 1', () => {
    startedLedger([unitAdd('base'), unitAdd('s', { deps: ['base'], depMode: 'stacked' })]);

    expect(manager(['brief', 's']).code).toBe(1);
  });

  test('an attended unit gets the unused question bullet', () => {
    startedLedger([unitAdd('a', { attended: true })]);

    expect(managerOk(['brief', 'a'])).toContain('- `Unit a: question` — unused: the owner answers you in this session directly.\n- `Unit a: sidequest`');
  });

  test('unknown unit exits 1', () => {
    startedLedger();

    expect(manager(['brief', 'ghost']).code).toBe(1);
  });
});

describe('manager question', () => {
  beforeEach(() => {
    startedLedger([unitAdd('a'), unitAdd('b', { presets: { mode: 'light' } })]);
  });

  const open = (unit: string, text: string, extra: readonly string[] = []) => managerOk(['question', 'open', unit, '--text', text, ...extra]);

  test('opens numbered questions with options', () => {
    expect(open('a', 'Which db?', ['--option', 'pg', '--option', 'mysql'])).toBe('Q1\n');
    expect(open('b', 'Which ui?')).toBe('Q2\n');
    expect(managerState().questions).toEqual({
      Q1: { unit: 'a', text: 'Which db?', options: ['pg', 'mysql'] },
      Q2: { unit: 'b', text: 'Which ui?', options: [] },
    });
  });

  test('unknown unit or empty text exits 1', () => {
    expect(manager(['question', 'open', 'ghost', '--text', 'x']).code).toBe(1);
    expect(manager(['question', 'open', 'a', '--text', '']).code).toBe(1);
  });

  test('an owner answer appends to decisions.md with basis owner', () => {
    open('a', 'Which db?');

    expect(managerOk(['question', 'answer', 'Q1', '--answer', 'pg', '--by', 'user'])).toBe('Q1 answered by user\n');
    expect(readFileSync(join(managerDir(), 'decisions.md'), 'utf8')).toContain('## Q1 · a · user\n**Q:** Which db?\n**A:** pg\n**Basis:** owner\n');
    expect(managerState().questions.Q1).toMatchObject({ answer: 'pg', by: 'user' });
  });

  test('a manager answer needs a valid basis', () => {
    open('a', 'Which db?');
    open('b', 'Which mode?');
    managerOk(['rule', 'add', 'always pg']);
    const answer = (q: string, basis: readonly string[]) => manager(['question', 'answer', q, '--answer', 'x', '--by', 'manager', ...basis]);

    expect(answer('Q1', []).code).toBe(1);
    expect(answer('Q1', ['--basis', 'R9']).code).toBe(1);
    expect(answer('Q1', ['--basis', 'Q2']).code).toBe(1);
    expect(answer('Q1', ['--basis', 'preset:mode']).code).toBe(1);
    expect(answer('Q2', ['--basis', 'preset:mode']).code).toBe(0);
    expect(answer('Q1', ['--basis', 'R1']).code).toBe(0);
    expect(managerState().questions.Q1).toMatchObject({ by: 'manager', basis: 'R1' });
    expect(readFileSync(join(managerDir(), 'decisions.md'), 'utf8')).toContain('## Q1 · a · manager\n**Q:** Which db?\n**A:** x\n**Basis:** R1\n');
  });

  test('an answered question is a valid basis; answering twice, unknown id or bad --by exits 1', () => {
    open('a', 'Which db?');
    open('b', 'Same db?');
    managerOk(['question', 'answer', 'Q1', '--answer', 'pg', '--by', 'user']);

    expect(manager(['question', 'answer', 'Q2', '--answer', 'pg', '--by', 'manager', '--basis', 'Q1']).code).toBe(0);
    expect(manager(['question', 'answer', 'Q1', '--answer', 'x', '--by', 'user']).code).toBe(1);
    expect(manager(['question', 'answer', 'Q9', '--answer', 'x', '--by', 'user']).code).toBe(1);
    expect(manager(['question', 'answer', 'Q2', '--answer', 'x', '--by', 'robot']).code).toBe(1);
  });
});

describe('manager rule and backlog', () => {
  beforeEach(() => {
    startedLedger([unitAdd('a'), unitAdd('b')]);
  });

  test('rules are numbered', () => {
    expect(managerOk(['rule', 'add', 'always pg'])).toBe('R1\n');
    expect(managerOk(['rule', 'add', 'never mock'])).toBe('R2\n');
    expect(managerState().rules).toEqual({ R1: 'always pg', R2: 'never mock' });
    expect(manager(['rule', 'add', '']).code).toBe(1);
  });

  test('backlog add and set', () => {
    expect(managerOk(['backlog', 'add', '--title', 'flaky seed', '--from', 'a', '--context', 'seen in CI', '--ticket', 'https://t/1'])).toBe('B1\n');
    expect(managerState().backlog.B1).toMatchObject({ title: 'flaky seed', from: ['a'], context: 'seen in CI', ticket: 'https://t/1', state: 'open' });

    expect(managerOk(['backlog', 'set', 'B1', '--state', 'started', '--from', 'b', '--ticket', 'https://t/2'])).toBe('B1 updated\n');
    expect(managerState().backlog.B1).toMatchObject({ from: ['a', 'b'], state: 'started', ticket: 'https://t/2' });
  });

  test.each([
    ['add unknown --from', ['backlog', 'add', '--title', 't', '--from', 'ghost']],
    ['add empty title', ['backlog', 'add', '--title', '', '--from', 'a']],
    ['set unknown id', ['backlog', 'set', 'B9', '--state', 'dropped']],
    ['set bad state', ['backlog', 'set', 'B1', '--state', 'later']],
    ['set unknown --from', ['backlog', 'set', 'B1', '--from', 'ghost']],
  ])('%s exits 1', (_label, args) => {
    managerOk(['backlog', 'add', '--title', 't', '--from', 'a']);

    expect(manager(args).code).toBe(1);
  });

  test('backlog set with no field exits 2', () => {
    managerOk(['backlog', 'add', '--title', 't', '--from', 'a']);

    expect(manager(['backlog', 'set', 'B1']).code).toBe(2);
  });
});

describe('manager beat', () => {
  beforeEach(() => {
    startedLedger([unitAdd('a', { state: 'running' }), unitAdd('b', { state: 'queued' })]);
  });

  const beat = (...flags: readonly string[]) => managerOk(['beat', ...flags]);

  test('ladder: ok, nudge, stop-resume, ask, ask', () => {
    const lines = ['a=m1', 'a=m1', 'a=m1', 'a=m1', 'a=m1'].map((seen) => beat('--seen', seen));

    expect(lines).toEqual([
      'a ok (misses 0)\n',
      'a nudge (misses 1)\n',
      'a stop-resume (misses 2)\n',
      'a ask (misses 3)\n',
      'a ask (misses 4)\n',
    ]);
  });

  test('a changed marker resets the ladder', () => {
    beat('--seen', 'a=m1');
    beat('--seen', 'a=m1');

    expect(beat('--seen', 'a=m2')).toBe('a ok (misses 0)\n');
    expect(managerState().units.a).toMatchObject({ marker: 'm2', misses: 0 });
  });

  test('a beat while not running is idle and resets the count', () => {
    beat('--seen', 'a=m1');
    beat('--seen', 'a=m1');
    managerOk(['unit', 'set', 'a', '--state', 'paused']);

    expect(beat('--seen', 'a=m1')).toBe('a idle paused\n');
    managerOk(['unit', 'set', 'a', '--state', 'running']);
    expect(beat('--seen', 'a=m1')).toBe('a nudge (misses 1)\n');
  });

  test('running units not seen are unseen; units seen but idle are listed in order', () => {
    expect(beat('--seen', 'b=x')).toBe('b idle queued\na unseen\n');
  });

  test('usage at or above manager.usage asks the owner', () => {
    expect(beat('--usage', '79')).not.toContain('usage');
    expect(beat('--usage', '80')).toContain('usage 80% >= 80%: ask owner before starting queued units (continue / pause queue / downgrade models)');
    expect(managerState().usage).toBe(80);
  });

  test('usage limit comes from config', () => {
    writeProjectConfig({ limits: { 'manager.usage': 50 } });

    expect(beat('--usage', '60')).toContain('usage 60% >= 50%');
  });

  test.each([
    ['unknown unit', ['--seen', 'ghost=m']],
    ['no marker', ['--seen', 'a']],
    ['bad usage', ['--usage', 'lots']],
    ['usage over 100', ['--usage', '101']],
  ])('%s exits 1', (_label, flags) => {
    expect(manager(['beat', ...flags]).code).toBe(1);
  });
});

describe('manager status', () => {
  const status = () => managerOk(['status']);

  test('prints the unit table', () => {
    startedLedger([
      unitAdd('a', { kind: 'playbook', playbook: 'debug', model: 'sonnet', effort: 'medium' }),
      unitSet('a', { state: 'running', branch: 'feat-a', attended: true }),
      { type: 'question-open', id: 'Q1', unit: 'a', text: 'Which db?', options: [] },
      unitAdd('b'),
      unitSet('b', { state: 'pr', pr: 'https://x/pull/2' }),
    ]);
    const lines = status().split('\n');

    expect(lines[0]).toBe('unit | state | kind | model/effort | branch/PR | attended | question');
    expect(lines[1]).toBe('a | running | playbook | sonnet/medium | feat-a | yes | Q1');
    expect(lines[2]).toBe('b | pr | free | opus/high | https://x/pull/2 | no | -');
  });

  test('records a status event', () => {
    startedLedger([unitAdd('a')]);
    status();

    expect(managerLog().at(-1)).toMatchObject({ type: 'status', released: [], offered: [] });
  });

  test('question, stale, merge-yes lines in order', () => {
    startedLedger([
      unitAdd('a', { state: 'running' }),
      unitAdd('b', { state: 'pr', pr: 'https://x/pull/2' }),
      { type: 'question-open', id: 'Q1', unit: 'a', text: 'Which db?', options: [] },
      { type: 'beat', seen: { a: 'm' } },
      { type: 'beat', seen: { a: 'm' } },
    ]);
    const out = status();

    expect(out).toContain('question Q1 a: Which db?');
    expect(out).toContain('stale a: nudge');
    expect(out).toContain('merge-yes b: https://x/pull/2');
    expect(out.indexOf('question Q1')).toBeLessThan(out.indexOf('stale a'));
    expect(out.indexOf('stale a')).toBeLessThan(out.indexOf('merge-yes b'));
  });

  test('answered questions leave the question list', () => {
    startedLedger([
      unitAdd('a'),
      { type: 'question-open', id: 'Q1', unit: 'a', text: 'Which db?', options: [] },
      { type: 'question-answer', id: 'Q1', answer: 'pg', by: 'user' },
    ]);

    expect(status()).not.toContain('question Q1');
  });

  describe('start lines', () => {
    const queued = (n: number) => Array.from({ length: n }, (_, index) => unitAdd(`q${index + 1}`));
    const active = (n: number) => Array.from({ length: n }, (_, index) => unitAdd(`r${index + 1}`, { state: 'running' }));

    test('queued units start under the default parallel cap of 4, in add order, counting listed ones', () => {
      startedLedger([...active(2), ...queued(4)]);
      const out = status();

      expect(out).toContain('start q1');
      expect(out).toContain('start q2');
      expect(out).not.toContain('start q3');
      expect(out.indexOf('start q1')).toBeLessThan(out.indexOf('start q2'));
    });

    test('waiting and pr units count as active; paused ones free the slot', () => {
      startedLedger([unitAdd('w', { state: 'waiting' }), unitAdd('p', { state: 'pr' }), unitAdd('z', { state: 'paused' }), ...active(1), ...queued(2)]);
      const out = status();

      expect(out).toContain('start q1');
      expect(out).not.toContain('start q2');
    });

    test('a queued sidequest starts ahead of earlier queued units', () => {
      writeProjectConfig({ limits: { 'manager.parallel': 2 } });
      startedLedger([...active(1), unitAdd('b'), unitAdd('sq', { kind: 'sidequest' })]);
      const out = status();

      expect(out).toContain('start sq');
      expect(out).not.toContain('start b');
    });

    test('the project parallel limit is honoured', () => {
      writeProjectConfig({ limits: { 'manager.parallel': 1 } });
      startedLedger([...active(1), ...queued(1)]);

      expect(status()).not.toContain('start q1');
    });

    test('a stacked dep needs a recorded branch and a started dep; a wait dep does not block', () => {
      startedLedger([
        unitAdd('base', { state: 'running' }),
        unitAdd('nobranch', { state: 'queued' }),
        unitAdd('stack-a', { deps: ['base'], depMode: 'stacked' }),
        unitAdd('stack-b', { deps: ['nobranch'], depMode: 'stacked' }),
        unitAdd('wait-c', { deps: ['nobranch'], depMode: 'wait' }),
        unitSet('base', { branch: 'base-b' }),
      ]);
      const out = status();

      expect(out).toContain('start stack-a');
      expect(out).not.toContain('start stack-b');
      expect(out).toContain('start wait-c');
    });
  });

  test('hold then release once for an active unit with a wait dep', () => {
    startedLedger([unitAdd('base', { state: 'running' }), unitAdd('w', { state: 'running', deps: ['base'], depMode: 'wait' })]);

    expect(status()).toContain('hold w: implementation waits for base');

    managerOk(['unit', 'set', 'base', '--state', 'merged']);
    const released = status();
    expect(released).toContain('release w: base merged, update onto the new base');
    expect(released).not.toContain('hold w');
    expect(managerState().released).toEqual(['w']);
    expect(status()).not.toContain('release w');
  });

  test('resume of a paused unit once its paused-by unit merged', () => {
    startedLedger([unitAdd('side', { state: 'running' }), unitAdd('a', { state: 'paused', pausedBy: 'side' })]);
    expect(status()).not.toContain('resume a');

    managerOk(['unit', 'set', 'side', '--state', 'merged']);
    expect(status()).toContain('resume a: side merged');
  });

  test('resume of a unit paused by several sidequests once all merged', () => {
    startedLedger([
      unitAdd('sq1', { state: 'running' }),
      unitAdd('sq2', { state: 'running' }),
      unitAdd('c', { state: 'paused', pausedBy: 'sq1' }),
    ]);
    managerOk(['unit', 'set', 'c', '--paused-by', 'sq2']);
    managerOk(['unit', 'set', 'sq2', '--state', 'merged']);
    expect(status()).not.toContain('resume c');

    managerOk(['unit', 'set', 'sq1', '--state', 'merged']);
    expect(status()).toContain('resume c: sq1, sq2 merged');
  });

  test('usage line from the latest beat', () => {
    startedLedger([unitAdd('a'), { type: 'beat', seen: {}, usage: 85 }]);

    expect(status()).toContain('usage 85%: ask owner before starting queued units');
  });

  test('backlog re-offer when a unit finishes or a raiser is added, then quiet until the next trigger', () => {
    startedLedger([unitAdd('a', { state: 'running' }), unitAdd('b', { state: 'running' })]);
    managerOk(['backlog', 'add', '--title', 'flaky seed', '--from', 'a']);
    expect(status()).not.toContain('re-offer');

    managerOk(['unit', 'set', 'b', '--state', 'done']);
    expect(status()).toContain('re-offer B1: flaky seed');
    expect(status()).not.toContain('re-offer');

    managerOk(['backlog', 'set', 'B1', '--from', 'b']);
    expect(status()).toContain('re-offer B1: flaky seed');
    managerOk(['backlog', 'set', 'B1', '--state', 'dropped']);
    managerOk(['unit', 'set', 'a', '--state', 'done']);
    expect(status()).not.toContain('re-offer');
  });

  test('manager answers since the previous status', () => {
    startedLedger([
      unitAdd('a'),
      { type: 'rule-add', id: 'R1', text: 'always pg' },
      { type: 'question-open', id: 'Q1', unit: 'a', text: 'Which db?', options: [] },
      { type: 'question-answer', id: 'Q1', answer: 'pg', by: 'manager', basis: 'R1' },
      { type: 'question-open', id: 'Q2', unit: 'a', text: 'Which ui?', options: [] },
      { type: 'question-answer', id: 'Q2', answer: 'web', by: 'user' },
    ]);
    const first = status();

    expect(first).toContain('answered Q1 a by manager: pg (basis R1)');
    expect(first).not.toContain('answered Q2');
    expect(status()).not.toContain('answered Q1');
  });

  test('state.json is re-derived from the hand-written log', () => {
    startedLedger([unitAdd('a'), unitSet('a', { state: 'running', path: '/p' })]);
    status();

    expect(managerState().units.a).toMatchObject({ state: 'running', path: '/p', misses: 0 });
    expect(managerState().cwd).toBe(sandbox);
  });
});

describe('manager ledger and work items', () => {
  test('_manager is not a work item for --work resolution', () => {
    managerOk(['start']);
    writeLog('20261108-demo', [{ type: 'started' }]);

    expect(agentic(['state', '--work', 'manager']).code).toBe(2);
    expect(agentic(['state', '--work', 'demo']).code).toBe(0);
  });

  test('_manager does not count for cwd matching or in the candidate list', () => {
    const workspace = join(sandbox, 'ws');
    mkdirSync(workspace);
    managerOk(['start']);
    writeFileSync(join(managerDir(), 'state.json'), JSON.stringify({ workspace: { path: workspace } }));
    writeLog('20261108-demo', [{ type: 'started' }]);
    writeFileSync(join(itemDir('20261108-demo'), 'state.json'), JSON.stringify({ workspace: { path: workspace } }));

    expect(JSON.parse(agentic(['state'], { cwd: workspace }).out).work).toBe('20261108-demo');
    expect(agentic(['state']).err).not.toContain('_manager');
  });
});

describe('manager hooks', () => {
  const unitPath = () => join(sandbox, 'trees', 'a');
  const startSessionPayload = (prompt: string, toolInput: Record<string, unknown> = {}) =>
    JSON.stringify({
      cwd: sandbox,
      tool_name: 'mcp__ccd_session__start_session',
      tool_input: { prompt, model: 'claude-opus-4-7', effort: 'high', ...toolInput },
    });

  const runHook = (subcommand: string, payload: Record<string, unknown> | string, cwd = sandbox) => {
    const result = Bun.spawnSync([process.execPath, scriptPath, 'hook', subcommand, '--harness', 'claude'], {
      cwd,
      env: { ...process.env, AGENTIC_OUTPUT: outputRoot },
      stdin: new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload)),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
  };

  const silent = { code: 0, out: '', err: '' };

  const ledgerWithUnit = (extra: Record<string, unknown> = {}) => {
    mkdirSync(unitPath(), { recursive: true });
    startedLedger([unitAdd('a', { path: unitPath(), state: 'running', model: 'opus', effort: 'high', ...extra })]);
  };

  describe('spawn', () => {
    const spawn = (prompt: string, toolInput: Record<string, unknown> = {}) => runHook('spawn', startSessionPayload(prompt, toolInput));

    const promptOf = (id = 'a') => {
      const out = Bun.spawnSync([process.execPath, scriptPath, 'manager', 'brief', id], {
        cwd: sandbox,
        env: { ...process.env, AGENTIC_OUTPUT: outputRoot },
      }).stdout.toString();

      return out.slice(out.indexOf('Manager unit:'));
    };

    test('no ledger with a Manager unit line denies naming the brief command', () => {
      const result = spawn('Manager unit: a\nWork item: none\n\nanything');

      expect(result.code).toBe(2);
      expect(result.err).toContain('manager brief a');
    });

    test('no ledger keeps a prompt without the line unchanged', () => {
      expect(spawn('Work item: none\n\nTask: look around')).toEqual(silent);
    });

    test('from the manager cwd a prompt without the line denies naming both forms', () => {
      ledgerWithUnit();
      const result = spawn('Work item: none\n\nTask: look around');

      expect(result.code).toBe(2);
      expect(result.err).toContain('Manager unit: <id>');
      expect(result.err).toContain('Manager unit: none');
      expect(result.err).toContain('manager brief');
    });

    test('from the manager cwd Manager unit: none skips the manager check', () => {
      ledgerWithUnit();

      expect(spawn('Manager unit: none\nWork item: none\n\nTask: look around')).toEqual(silent);
    });

    test('an Agent spawn from the manager cwd without the line is unchanged', () => {
      ledgerWithUnit();

      expect(runHook('spawn', { cwd: sandbox, tool_name: 'Agent', tool_input: { prompt: 'Task: look around' } })).toEqual(silent);
    });

    test('from another cwd a prompt without the line is unchanged', () => {
      ledgerWithUnit();

      expect(runHook('spawn', { ...JSON.parse(startSessionPayload('Task: x')), cwd: unitPath() })).toEqual(silent);
    });

    test('Manager unit: none still runs the work-item checks', () => {
      const workspace = join(sandbox, 'ws');
      mkdirSync(workspace);
      writeLog('20261108-demo', [{ workflow: 'implement', type: 'started', data: { workspace: { path: workspace, branch: 'b' } } }]);
      const brief = `Manager unit: none\nStep: implement\nWork item: ${itemDir('20261108-demo')}`;
      const result = runHook('spawn', { ...JSON.parse(startSessionPayload(brief)), cwd: workspace });

      expect(result.code).toBe(2);
      expect(result.err).toContain('spawn blocked');
    });

    test('a corrupt ledger line is skipped and the brief still checks', () => {
      ledgerWithUnit();
      const prompt = promptOf();
      appendFileSync(join(managerDir(), 'events.jsonl'), '{"ts":"2026-11-21T11:00:00Z","type":"unit-s');

      expect(spawn(prompt)).toEqual(silent);
      expect(spawn('Manager unit: ghost\nWork item: none').code).toBe(2);
    });

    test('an unreadable ledger denies a Manager unit brief', () => {
      ledgerWithUnit();
      const prompt = promptOf();
      rmSync(join(managerDir(), 'events.jsonl'));
      mkdirSync(join(managerDir(), 'events.jsonl'));

      expect(spawn(prompt).code).toBe(2);
    });

    test('the printed brief with matching model and effort allows', () => {
      ledgerWithUnit();

      expect(spawn(promptOf())).toEqual(silent);
    });

    test('a model alias equals the ledger full id', () => {
      ledgerWithUnit({ model: 'claude-opus-4-7' });

      expect(spawn(promptOf(), { model: 'opus' })).toEqual(silent);
    });

    test('an attended brief carries its own relay block', () => {
      ledgerWithUnit({ attended: true });

      expect(spawn(promptOf())).toEqual(silent);
    });

    test('unknown unit denies naming the brief command', () => {
      ledgerWithUnit();
      const result = spawn('Manager unit: ghost\nWork item: none');

      expect(result.code).toBe(2);
      expect(result.err).toContain('ghost');
      expect(result.err).toContain('manager brief ghost');
      expect(JSON.parse(result.out).hookSpecificOutput.permissionDecision).toBe('deny');
    });

    test('missing Work item: none denies', () => {
      ledgerWithUnit();
      const result = spawn(promptOf().replace('Work item: none', 'Work item: x'));

      expect(result.code).toBe(2);
      expect(result.err).toContain('Work item: none');
    });

    test('an altered relay block denies', () => {
      ledgerWithUnit();
      const result = spawn(promptOf().replace('Merge a PR only at', 'Merge a PR anytime at'));

      expect(result.code).toBe(2);
      expect(result.err).toContain('relay protocol');
    });

    test('an attended relay block on a non-attended unit denies', () => {
      ledgerWithUnit({ attended: true });
      const attended = promptOf();
      ledgerWithUnit();

      expect(spawn(attended).code).toBe(2);
    });

    test('model mismatch denies with the expected model, effort and fix', () => {
      ledgerWithUnit();
      const result = spawn(promptOf(), { model: 'sonnet' });

      expect(result.code).toBe(2);
      expect(result.err).toContain('model opus (got sonnet)');
      expect(result.err).toContain('effort high');
      expect(result.err).toContain(`bun ${scriptPath} manager brief a`);
    });

    test('effort mismatch denies', () => {
      ledgerWithUnit();
      const result = spawn(promptOf(), { effort: 'low' });

      expect(result.code).toBe(2);
      expect(result.err).toContain('effort high (got low)');
    });

    test('other tools are ignored', () => {
      ledgerWithUnit();

      expect(runHook('spawn', { cwd: sandbox, tool_name: 'Bash', tool_input: { prompt: 'Manager unit: ghost' } })).toEqual(silent);
    });
  });

  describe('compact', () => {
    const compactPayload = (cwd: string) => ({ cwd, hook_event_name: 'SessionStart', source: 'compact' });
    const contextOf = (out: string) => JSON.parse(out).hookSpecificOutput.additionalContext as string;

    test('the manager cwd gets the status text and records no event', () => {
      ledgerWithUnit();
      const before = managerLog().length;
      const result = runHook('compact', compactPayload(sandbox));

      expect(result.code).toBe(0);
      expect(contextOf(result.out)).toContain('attention:');
      expect(managerLog()).toHaveLength(before);
    });

    test('inside a non-attended unit path gets its relay block', () => {
      ledgerWithUnit();
      const nested = join(unitPath(), 'src');
      mkdirSync(nested);
      const result = runHook('compact', compactPayload(nested));

      expect(contextOf(result.out)).toContain('## Relay protocol');
      expect(contextOf(result.out)).toContain('`Unit a: question` — numbered questions');
    });

    test('an attended unit gets nothing from the manager', () => {
      ledgerWithUnit({ attended: true });

      expect(runHook('compact', compactPayload(unitPath()))).toEqual(silent);
    });

    test('a finished unit gets nothing', () => {
      ledgerWithUnit({ state: 'merged' });

      expect(runHook('compact', compactPayload(unitPath()))).toEqual(silent);
    });

    test('the most specific unit path wins', () => {
      ledgerWithUnit();
      const inner = join(unitPath(), 'inner');
      mkdirSync(inner);
      writeManagerLog([
        { type: 'start', cwd: sandbox },
        unitAdd('a', { path: unitPath(), state: 'running' }),
        unitAdd('b', { path: inner, state: 'running' }),
      ]);

      expect(contextOf(runHook('compact', compactPayload(inner)).out)).toContain('`Unit b: question`');
    });

    test('a unit cwd that is also a work-item workspace gets both texts', () => {
      ledgerWithUnit();
      writeLog('20261108-demo', [{ type: 'started', data: { workspace: { path: unitPath(), branch: 'b' } } }]);
      const text = contextOf(runHook('compact', compactPayload(unitPath())).out);

      expect(text).toContain('## Relay protocol');
      expect(text).toContain('work: 20261108-demo');
    });

    test('unrelated cwd with a ledger gives today output', () => {
      ledgerWithUnit();
      const other = join(sandbox, 'elsewhere');
      mkdirSync(other);

      expect(runHook('compact', compactPayload(other))).toEqual(silent);
    });

    test('a corrupt ledger still injects the work-item resume', () => {
      const workspace = join(sandbox, 'ws');
      mkdirSync(workspace);
      writeLog('20261108-demo', [{ type: 'started', data: { workspace: { path: workspace, branch: 'b' } } }]);
      startedLedger();
      appendFileSync(join(managerDir(), 'events.jsonl'), 'not json\n');
      const result = runHook('compact', compactPayload(workspace));

      expect(result.code).toBe(0);
      expect(contextOf(result.out)).toContain('work: 20261108-demo');
    });

    test('no ledger keeps the work-item resume only', () => {
      const workspace = join(sandbox, 'ws');
      mkdirSync(workspace);
      writeLog('20261108-demo', [{ type: 'started', data: { workspace: { path: workspace, branch: 'b' } } }]);
      const text = contextOf(runHook('compact', compactPayload(workspace)).out);

      expect(text).toContain('work: 20261108-demo');
      expect(text).not.toContain('Relay protocol');
    });
  });

  describe('ask', () => {
    const askPayload = (cwd: string, extra: Record<string, unknown> = {}) => ({
      cwd,
      hook_event_name: 'PreToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: { questions: [{ question: 'Which?', header: 'h', options: [], multiSelect: false }] },
      ...extra,
    });

    test('denies inside an active non-attended unit path', () => {
      ledgerWithUnit();
      const result = runHook('ask', askPayload(unitPath()));
      const reason = JSON.parse(result.out).hookSpecificOutput.permissionDecisionReason as string;

      expect(result.code).toBe(2);
      expect(reason).toContain('relayed unit a');
      expect(reason).toContain('`Unit a: question`');
      expect(reason).toContain('the manager relays it to the owner');
    });

    test('denies from a nested cwd', () => {
      ledgerWithUnit();
      const nested = join(unitPath(), 'src');
      mkdirSync(nested);

      expect(runHook('ask', askPayload(nested)).code).toBe(2);
    });

    test.each(['running', 'waiting', 'pr', 'paused'])('denies a %s unit', (state) => {
      ledgerWithUnit({ state });

      expect(runHook('ask', askPayload(unitPath())).code).toBe(2);
    });

    test('a corrupt ledger line is skipped: the unit is still denied', () => {
      ledgerWithUnit();
      appendFileSync(join(managerDir(), 'events.jsonl'), '{"ts":"x","type":\n');

      expect(runHook('ask', askPayload(unitPath())).code).toBe(2);
    });

    test('an unreadable ledger allows', () => {
      ledgerWithUnit();
      rmSync(join(managerDir(), 'events.jsonl'));
      mkdirSync(join(managerDir(), 'events.jsonl'));

      expect(runHook('ask', askPayload(unitPath()))).toEqual(silent);
    });

    describe('first turn before the path is recorded', () => {
      const queuedOnBranch = (branch: string, extra: Record<string, unknown> = {}) => {
        const checkout = join(sandbox, 'checkouts', 'first');
        mkdirSync(checkout, { recursive: true });
        git(checkout, ['init', '-q', '-b', branch]);
        startedLedger([unitAdd('a', extra)]);

        return checkout;
      };

      test('denies a queued unit whose id is the branch', () => {
        expect(runHook('ask', askPayload(queuedOnBranch('a'))).code).toBe(2);
      });

      test('denies on the app-prefixed and suffixed branch', () => {
        expect(runHook('ask', askPayload(queuedOnBranch('claude/a-8a68c6'))).code).toBe(2);
      });

      test('denies on the recorded branch', () => {
        expect(runHook('ask', askPayload(queuedOnBranch('feature/login', { branch: 'feature/login' }))).code).toBe(2);
      });

      test('allows an unrelated branch', () => {
        expect(runHook('ask', askPayload(queuedOnBranch('claude/ab-8a68c6')))).toEqual(silent);
      });

      test('allows an attended unit', () => {
        expect(runHook('ask', askPayload(queuedOnBranch('a', { attended: true })))).toEqual(silent);
      });

      test('the longest matching id wins', () => {
        const checkout = join(sandbox, 'checkouts', 'longest');
        mkdirSync(checkout, { recursive: true });
        git(checkout, ['init', '-q', '-b', 'a-b']);
        startedLedger([unitAdd('a'), unitAdd('a-b')]);

        expect(JSON.parse(runHook('ask', askPayload(checkout)).out).hookSpecificOutput.permissionDecisionReason).toContain('relayed unit a-b');
      });

      test('the path match wins over the branch match', () => {
        mkdirSync(unitPath(), { recursive: true });
        git(unitPath(), ['init', '-q', '-b', 'b']);
        startedLedger([unitAdd('a', { path: unitPath(), state: 'running' }), unitAdd('b')]);

        expect(JSON.parse(runHook('ask', askPayload(unitPath())).out).hookSpecificOutput.permissionDecisionReason).toContain('relayed unit a');
      });

      test('a linked worktree nested in a unit path is not that unit', () => {
        git(sandbox, ['init', '-q', '-b', 'main']);
        git(sandbox, ['commit', '-q', '--allow-empty', '-m', 'init']);
        const nested = join(sandbox, 'trees', 'nested');
        git(sandbox, ['worktree', 'add', '-q', '-b', 'nested', nested]);
        startedLedger([unitAdd('a', { path: join(sandbox, 'trees'), state: 'running' })]);

        expect(runHook('ask', askPayload(realpathSync(nested)))).toEqual(silent);
      });
    });

    test('allows without a ledger', () => {
      expect(runHook('ask', askPayload(unitPath()))).toEqual(silent);
    });

    test('allows an attended unit', () => {
      ledgerWithUnit({ attended: true });

      expect(runHook('ask', askPayload(unitPath()))).toEqual(silent);
    });

    test.each(['merged', 'done'])('allows a %s unit', (state) => {
      ledgerWithUnit({ state });

      expect(runHook('ask', askPayload(unitPath()))).toEqual(silent);
    });

    test('allows the manager cwd', () => {
      ledgerWithUnit();

      expect(runHook('ask', askPayload(sandbox))).toEqual(silent);
    });

    test('allows a unit whose path equals the manager cwd', () => {
      startedLedger([unitAdd('a', { path: sandbox, state: 'running' })]);

      expect(runHook('ask', askPayload(sandbox))).toEqual(silent);
    });

    test('allows an unrelated cwd', () => {
      ledgerWithUnit();
      const other = join(sandbox, 'elsewhere');
      mkdirSync(other);

      expect(runHook('ask', askPayload(other))).toEqual(silent);
    });

    test('allows another tool name', () => {
      ledgerWithUnit();

      expect(runHook('ask', askPayload(unitPath(), { tool_name: 'Bash' }))).toEqual(silent);
    });

    test('allows an unreadable payload', () => {
      ledgerWithUnit();

      expect(runHook('ask', 'not json')).toEqual(silent);
    });

    test('doc-derived fixture: denies from a unit path', async () => {
      ledgerWithUnit();
      const fixture = JSON.parse(await Bun.file(join(import.meta.dir, 'fixtures', 'hook-claude-ask.json')).text());

      expect(fixture._source).toContain('doc-derived');
      expect(fixture.tool_name).toBe('AskUserQuestion');
      expect(runHook('ask', { ...fixture, cwd: unitPath() }).code).toBe(2);
      expect(runHook('ask', { ...fixture, cwd: '/repo' })).toEqual(silent);
    });
  });
});

describe('manager review fixes', () => {
  test('a summary set on a finished unit does not re-offer the backlog', () => {
    startedLedger([unitAdd('a', { state: 'merged' })]);
    managerOk(['backlog', 'add', '--title', 'flaky seed', '--from', 'a']);
    managerOk(['status']);
    managerOk(['unit', 'set', 'a', '--summary', 'shipped']);
    managerOk(['unit', 'set', 'a', '--state', 'merged']);

    expect(managerOk(['status'])).not.toContain('re-offer');
  });

  test('a unit turning merged still re-offers the backlog', () => {
    startedLedger([unitAdd('a', { state: 'running' })]);
    managerOk(['backlog', 'add', '--title', 'flaky seed', '--from', 'a']);
    managerOk(['status']);
    managerOk(['unit', 'set', 'a', '--state', 'merged']);

    expect(managerOk(['status'])).toContain('re-offer B1');
  });

  describe('numeric unit ids keep add order', () => {
    beforeEach(() => {
      writeProjectConfig({ limits: { 'manager.parallel': 1 } });
      startedLedger([unitAdd('b'), unitAdd('42'), unitAdd('7')]);
    });

    test('start lines follow add order under the cap', () => {
      const out = managerOk(['status']);

      expect(out).toContain('start b');
      expect(out).not.toContain('start 7');
      expect(out).not.toContain('start 42');
    });

    test('the status table, brief siblings and unseen lines follow add order', () => {
      const rows = managerOk(['status']).split('\n').slice(1, 4).map((row) => row.split(' | ')[0]);
      expect(rows).toEqual(['b', '42', '7']);

      expect(managerOk(['brief', 'b']).match(/^- (\S+) \(queued\)/gm)).toEqual(['- 42 (queued)', '- 7 (queued)']);

      managerOk(['unit', 'set', '7', '--state', 'running']);
      managerOk(['unit', 'set', '42', '--state', 'running']);
      expect(managerOk(['beat'])).toBe('42 unseen\n7 unseen\n');
    });
  });

  describe('prototype keys are not ledger entries', () => {
    beforeEach(() => {
      startedLedger([unitAdd('a'), { type: 'question-open', id: 'Q1', unit: 'a', text: 'Which db?', options: [] }]);
    });

    test.each([
      ['unit set constructor', ['unit', 'set', 'constructor', '--state', 'running']],
      ['unit add with a prototype dep', ['unit', 'add', 'b', '--title', 't', '--kind', 'free', '--deps', 'toString', '--dep-mode', 'wait']],
      ['question answer __proto__', ['question', 'answer', '__proto__', '--answer', 'x', '--by', 'user']],
      ['manager answer on preset:toString', ['question', 'answer', 'Q1', '--by', 'manager', '--answer', 'x', '--basis', 'preset:toString']],
    ])('%s exits 1 and appends nothing', (_label, args) => {
      const before = managerLog().length;

      expect(manager(args).code).toBe(1);
      expect(managerLog()).toHaveLength(before);
    });
  });

  test('unit id none is reserved', () => {
    managerOk(['start']);

    expect(manager(['unit', 'add', 'none', '--title', 't', '--kind', 'free']).code).toBe(1);
  });

  describe('manager commands from a unit session', () => {
    const unitPath = () => join(sandbox, 'trees', 'a');
    const fromUnit = (args: readonly string[]) => manager(args, { cwd: unitPath() });

    beforeEach(() => {
      mkdirSync(unitPath(), { recursive: true });
      startedLedger([
        unitAdd('a', { path: unitPath(), state: 'running' }),
        { type: 'question-open', id: 'Q1', unit: 'a', text: 'Which db?', options: [] },
      ]);
    });

    test.each([
      ['start', ['start']],
      ['unit set', ['unit', 'set', 'a', '--attended', 'true']],
      ['question answer', ['question', 'answer', 'Q1', '--by', 'user', '--answer', 'pg']],
      ['rule add', ['rule', 'add', 'always pg']],
      ['backlog add', ['backlog', 'add', '--title', 't', '--from', 'a']],
      ['beat', ['beat']],
      ['status', ['status']],
    ])('%s exits 1 and appends nothing', (_label, args) => {
      const before = managerLog().length;
      const result = fromUnit(args);

      expect(result.code).toBe(1);
      expect(result.err).toContain('manager session only');
      expect(managerLog()).toHaveLength(before);
    });

    test('the manager cwd still works', () => {
      managerOk(['rule', 'add', 'always pg']);

      expect(managerLog().at(-1)).toMatchObject({ type: 'rule-add' });
    });

    test('a unit whose path equals the manager cwd does not block the manager', () => {
      startedLedger([unitAdd('a', { path: sandbox, state: 'running' })]);

      managerOk(['rule', 'add', 'always pg']);
    });

    test('a queued unit found by branch is refused too', () => {
      const checkout = join(sandbox, 'checkouts', 'first');
      mkdirSync(checkout, { recursive: true });
      git(checkout, ['init', '-q', '-b', 'claude/b-8a68c6']);
      startedLedger([unitAdd('b')]);

      expect(manager(['rule', 'add', 'x'], { cwd: checkout }).code).toBe(1);
    });
  });
});
