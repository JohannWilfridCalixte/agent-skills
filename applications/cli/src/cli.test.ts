import type { CliIo } from './cli.js';

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { FakeCommandRunner } from '@agentic/domain-shared/testing';
import { ok } from '@agentic/kernel-result';
import { createTestApp, TEST_HOST } from '@agentic/server/src/platform/testing/test-app.js';

import { runCli } from './cli.js';

let root = '';
let homeDir = '';
let projectDir = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentic-cli-'));
  homeDir = join(root, 'home');
  projectDir = join(root, 'app');
  mkdirSync(homeDir);
  mkdirSync(projectDir);
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

interface Harness {
  readonly app: TestApp;
  readonly run: (...argv: string[]) => Promise<{ readonly code: number; readonly stderr: string; readonly stdout: string }>;
  readonly spawned: (readonly string[])[];
}

type TestApp = Awaited<ReturnType<typeof createTestApp>>;

async function addProject({ run }: Harness, path = projectDir) {
  const result = await run('projects', 'add', path, '--json');
  return (JSON.parse(result.stdout) as { readonly id: string }).id;
}

/** Seam 4 (D30): the CLI's injected fetch dispatches to the real app over an in-memory db; serve.json lives in a temp AGENTIC_HOME. */
async function setup({ commandRunner, serveFile = true }: { readonly commandRunner?: FakeCommandRunner; readonly serveFile?: boolean } = {}) {
  const app = await createTestApp({ homeDir, ...(commandRunner === undefined ? {} : { commandRunner }) });
  if (serveFile) writeFileSync(join(homeDir, 'serve.json'), JSON.stringify({ pid: 1, port: 8787, token: app.token }));
  const spawned: (readonly string[])[] = [];
  const run = async (...argv: string[]) => {
    let stdout = '';
    let stderr = '';
    const io: CliIo = {
      cwd: root,
      env: { AGENTIC_HOME: homeDir },
      fetch: async (input, init) => {
        // A real fetch derives Host from the URL; app.request does not, and the server rejects a missing Host.
        const headers = new Headers(init?.headers);
        headers.set('host', TEST_HOST);
        return app.app.request(input, { ...init, headers });
      },
      readFile: async (path) => readFile(path, 'utf8'),
      runtime: '/usr/local/bin/bun',
      serverEntry: '/repo/applications/server/src/main.ts',
      spawn: async (command) => {
        spawned.push(command);
        return 0;
      },
      stderr: (text) => {
        stderr += text;
      },
      stdout: (text) => {
        stdout += text;
      },
    };
    const code = await runCli(argv, io);
    return { code, stderr, stdout };
  };
  return { app, run, spawned } satisfies Harness;
}

function writeFile(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

describe('server discovery (AC24)', () => {
  const NOT_RUNNING = 'Server not running. Run `agentic serve` first.';

  it.each([
    [['projects', 'list']],
    [['config', 'effective']],
    [['config', 'get']],
    [['config', 'set', '--key', 'output', '--value', 'x']],
    [['models', 'claude']],
    [['install', 'status']],
    [['install', 'run', 'claude', 'update', '--yes']],
    [['history', 'list']],
    [['work-items', 'list', 'p1']],
    [['vendoring', 'status', 'p1']],
  ])('exits 3 with the serve hint when serve.json is missing: %p', async (argv) => {
    const { run } = await setup({ serveFile: false });

    const result = await run(...argv);

    expect(result.code).toBe(3);
    expect(result.stderr).toContain(NOT_RUNNING);
  });

  it('treats a stale serve.json (connection refused) as not running', async () => {
    writeFileSync(join(homeDir, 'serve.json'), JSON.stringify({ pid: 1, port: 8787, token: 'stale' }));
    let stderr = '';
    const io: CliIo = {
      cwd: root,
      env: { AGENTIC_HOME: homeDir },
      fetch: () => Promise.reject(new TypeError('Unable to connect. Is the computer able to access the url?')),
      readFile: async (path) => readFile(path, 'utf8'),
      runtime: 'bun',
      serverEntry: 'main.ts',
      spawn: () => Promise.resolve(0),
      stderr: (text) => {
        stderr += text;
      },
      stdout: () => {},
    };

    const code = await runCli(['history', 'list'], io);

    expect(code).toBe(3);
    expect(stderr).toContain(NOT_RUNNING);
    expect(stderr).not.toContain('stale');
  });
});

describe('serve', () => {
  it('spawns the server entry with development conditions and forwards its arguments', async () => {
    const harness = await setup({ serveFile: false });

    const result = await harness.run('serve', '--port', '9000', '--project', 'app');

    expect(result.code).toBe(0);
    expect(harness.spawned).toEqual([['/usr/local/bin/bun', '--conditions', 'development', '/repo/applications/server/src/main.ts', '--port', '9000', '--project', 'app']]);
  });
});

describe('projects', () => {
  it('adds a folder relative to the working directory, lists and removes it', async () => {
    const harness = await setup();
    const id = await addProject(harness, 'app');

    const listed = await harness.run('projects', 'list');
    const removed = await harness.run('projects', 'remove', id);

    expect(listed.stdout).toContain(`${id}  ${projectDir}`);
    expect(removed.code).toBe(0);
    expect((await harness.run('projects', 'list', '--json')).stdout).toContain('"projects": []');
  });

  it('prints the problem and exits 1 for a folder that does not exist', async () => {
    const { run } = await setup();

    const result = await run('projects', 'add', join(root, 'missing'));

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/not found|does not exist/i);
  });
});

describe('config', () => {
  it('prints the effective config with origins', async () => {
    const { run } = await setup();

    const result = await run('config', 'effective');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('output = .agentic/work (default)');
  });

  it('prints the raw file with --json as validated JSON', async () => {
    writeFileSync(join(homeDir, 'config.json'), JSON.stringify({ output: 'docs/work' }));
    const { run } = await setup();

    const result = await run('config', 'get', '--json');

    expect(JSON.parse(result.stdout)).toMatchObject({ config: { output: 'docs/work' }, exists: true, scope: 'global' });
  });

  it('reads a project scope through --project', async () => {
    const harness = await setup();
    const id = await addProject(harness);

    const result = await harness.run('config', 'effective', '--project', id, '--json');

    expect(JSON.parse(result.stdout)).toMatchObject({ scope: `project:${id}` });
  });

  it('previews the diff and writes nothing without --yes', async () => {
    const { run } = await setup();

    const result = await run('config', 'set', '--key', 'output', '--value', 'docs/work');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('+   "output": "docs/work"');
    expect(result.stdout).toContain('Nothing written');
    expect(existsSync(join(homeDir, 'config.json'))).toBe(false);
  });

  it('writes after the preview with --yes', async () => {
    const { run } = await setup();

    const result = await run('config', 'set', '--key', 'output', '--value', 'docs/work', '--yes');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Saved global config');
    expect(JSON.parse(readFileSync(join(homeDir, 'config.json'), 'utf8'))).toEqual({ output: 'docs/work' });
  });

  it('takes the edited file from --file', async () => {
    const edited = join(root, 'edited.json');
    writeFileSync(edited, JSON.stringify({ reviewers: ['a', 'b'] }));
    const { run } = await setup();

    const result = await run('config', 'set', '--file', edited, '--yes');

    expect(result.code).toBe(0);
    expect(JSON.parse(readFileSync(join(homeDir, 'config.json'), 'utf8'))).toEqual({ reviewers: ['a', 'b'] });
  });

  it('prints the issues and writes nothing for an invalid edit, even with --yes', async () => {
    const { run } = await setup();

    const result = await run('config', 'set', '--key', 'commitWork', '--value', '"yes"', '--yes');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('commitWork');
    expect(existsSync(join(homeDir, 'config.json'))).toBe(false);
  });
});

describe('models', () => {
  it('lists the ids for a harness', async () => {
    const { run } = await setup();

    const result = await run('models', 'claude');

    expect(result.stdout).toBe('opus\nsonnet\nhaiku\n');
  });
});

describe('install', () => {
  it('prints the status of every method', async () => {
    const { run } = await setup();

    const result = await run('install', 'status');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('claude  plugin  unknown');
  });

  it('previews the exact commands', async () => {
    const { run } = await setup();

    const result = await run('install', 'preview', 'claude', 'update');

    expect(result.stdout).toBe('claude plugin marketplace update agentic\nclaude plugin update agentic@agentic\n');
  });

  it('prints the preview, runs nothing and exits 2 without --yes', async () => {
    const runner = new FakeCommandRunner();
    const { run } = await setup({ commandRunner: runner });

    const result = await run('install', 'run', 'claude', 'update');

    expect(result.code).toBe(2);
    expect(result.stdout).toContain('claude plugin update agentic@agentic');
    expect(result.stdout).toContain('Nothing ran');
    expect(runner.commands).toEqual([]);
  });

  it('streams the run output and exits 0 when it succeeds', async () => {
    const runner = new FakeCommandRunner({ lines: [{ line: 'updated', type: 'stdout' }], result: ok({ exitCode: 0 }) });
    const { run } = await setup({ commandRunner: runner });

    const result = await run('install', 'run', 'claude', 'update', '--yes');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('updated\nupdated\n');
    expect(runner.commands).toHaveLength(2);
  });

  it("exits with the run's exit code when it fails", async () => {
    const runner = new FakeCommandRunner({ lines: [{ line: 'marketplace not found', type: 'stderr' }], result: ok({ exitCode: 4 }) });
    const { run } = await setup({ commandRunner: runner });

    const result = await run('install', 'run', 'claude', 'update', '--yes');

    expect(result.code).toBe(4);
    expect(result.stderr).toContain('marketplace not found');
  });
});

describe('history', () => {
  it('lists entries and restores one only with --yes', async () => {
    const { run } = await setup();
    await run('config', 'set', '--key', 'output', '--value', 'first', '--yes');
    await run('config', 'set', '--key', 'output', '--value', 'second', '--yes');
    const entries = JSON.parse((await run('history', 'list', '--json')).stdout) as { readonly entries: readonly { readonly content: string; readonly id: string }[] };
    const first = entries.entries.find((entry) => entry.content.includes('"first"'));
    if (first === undefined) throw new Error('no history entry for the first write');

    const listed = await run('history', 'list');
    const previewed = await run('history', 'restore', first.id);
    const unchanged = readFileSync(join(homeDir, 'config.json'), 'utf8');
    const restored = await run('history', 'restore', first.id, '--yes');

    expect(listed.stdout).toContain(first.id);
    expect(previewed.stdout).toContain('+   "output": "first"');
    expect(previewed.stdout).toContain('Nothing written');
    expect(unchanged).toContain('"second"');
    expect(restored.code).toBe(0);
    expect(JSON.parse(readFileSync(join(homeDir, 'config.json'), 'utf8'))).toEqual({ output: 'first' });
  });
});

describe('work-items', () => {
  it('lists, shows and reads a doc by name, reviews included', async () => {
    const item = join(projectDir, '.agentic/work/20261103-export');
    writeFile(join(item, 'state.json'), JSON.stringify({ phase: 'implement', status: 'in_progress', title: 'Export', updated: '2026-11-03T09:00:00Z' }));
    writeFile(join(item, 'spec.md'), '# Export spec\n');
    writeFile(join(item, 'reviews/1-code.md'), '# Review one\n');
    const harness = await setup();
    const id = await addProject(harness);

    const listed = await harness.run('work-items', 'list', id);
    const shown = await harness.run('work-items', 'show', id, '20261103-export');
    const doc = await harness.run('work-items', 'doc', id, '20261103-export', 'reviews/1-code.md');

    expect(listed.stdout).toContain('20261103-export');
    expect(listed.stdout).toContain('Export');
    expect(shown.stdout).toContain('reviews/1-code.md');
    expect(doc.stdout).toBe('# Review one\n');
  });
});

describe('vendoring', () => {
  it('previews update without --yes, runs nothing and exits 2', async () => {
    writeFileSync(join(projectDir, 'vendor.json'), JSON.stringify({ skills: [{ into: 'skills/flow', skill: 'tdd', source: 'mattpocock/skills' }] }));
    const runner = new FakeCommandRunner();
    const harness = await setup({ commandRunner: runner });
    const id = await addProject(harness);

    const result = await harness.run('vendoring', 'update', '--skill', 'tdd', id);

    expect(result.code).toBe(2);
    expect(result.stdout).toContain('node scripts/vendor-skills.mjs update');
    expect(runner.commands).toEqual([]);
  });

  it('lists the vendored skills', async () => {
    writeFileSync(join(projectDir, 'vendor.json'), JSON.stringify({ skills: [{ into: 'skills/flow', skill: 'tdd', source: 'mattpocock/skills' }] }));
    const harness = await setup();
    const id = await addProject(harness);

    const result = await harness.run('vendoring', 'status', id);

    expect(result.stdout).toContain('tdd');
    expect(result.stdout).toContain('mattpocock/skills');
  });
});

describe('the token', () => {
  it('never appears in stdout or stderr', async () => {
    const runner = new FakeCommandRunner({ lines: [{ line: 'x', type: 'stdout' }], result: ok({ exitCode: 1 }) });
    const harness = await setup({ commandRunner: runner });
    const outputs = [
      await harness.run('projects', 'list'),
      await harness.run('config', 'effective', '--json'),
      await harness.run('install', 'run', 'claude', 'update', '--yes'),
      await harness.run('projects', 'add', '/nope'),
    ];

    for (const output of outputs) {
      expect(output.stdout).not.toContain(harness.app.token);
      expect(output.stderr).not.toContain(harness.app.token);
    }
  });
});
