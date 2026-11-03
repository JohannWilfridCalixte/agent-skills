import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { createProjectsService } from '@agentic/domain-projects';
import { InMemoryProjectRepository } from '@agentic/domain-projects/testing';

import { fsDirectoryProbe } from './modules/projects/fs-directory-probe.js';
import { createLogger } from './platform/log.js';
import { bindServer, parseServeArgs, registerStartFolder, removeServeFile, serve, serveFilePath, writeServeFile } from './serve.js';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentic-serve-'));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

function projectsWithLog() {
  const lines: string[] = [];
  const projects = createProjectsService({
    directoryProbe: fsDirectoryProbe,
    newId: () => 'id-1',
    now: () => new Date('2026-11-03T10:00:00.000Z'),
    repository: new InMemoryProjectRepository(),
  });
  return { lines, logger: createLogger((line) => lines.push(line)), projects };
}

describe('serve.json lifecycle (AC1)', () => {
  it('creates the missing home directory and writes port, token and pid with mode 0600', () => {
    const path = serveFilePath(join(root, 'home', '.agentic'));

    writeServeFile(path, { pid: 42, port: 8787, token: 'secret' });

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ pid: 42, port: 8787, token: 'secret' });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it('tightens the mode of a stale file it overwrites', () => {
    const path = serveFilePath(root);
    writeFileSync(path, '{}', { mode: 0o644 });

    writeServeFile(path, { pid: 1, port: 9000, token: 't' });

    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it('removes the file, and tolerates it being gone already', () => {
    const path = serveFilePath(root);
    writeServeFile(path, { pid: 1, port: 8787, token: 't' });

    removeServeFile(path);
    removeServeFile(path);

    expect(existsSync(path)).toBe(false);
  });
});

describe('start folder registration (AC1)', () => {
  it('registers a valid folder once, then reports it as known', async () => {
    const { logger, projects } = projectsWithLog();

    expect(await registerStartFolder(projects, root, logger)).toBe('registered');
    expect(await registerStartFolder(projects, root, logger)).toBe('already_known');
    expect((await projects.list()).map((project) => project.path)).toEqual([root]);
  });

  it('skips a missing folder with a warning and registers nothing', async () => {
    const { lines, logger, projects } = projectsWithLog();

    expect(await registerStartFolder(projects, join(root, 'missing'), logger)).toBe('invalid');
    expect(await projects.list()).toEqual([]);
    expect(lines.join('\n')).toContain('start_folder_not_registered');
  });
});

describe('serve arguments', () => {
  it('defaults the project to cwd and resolves --project against it', () => {
    mkdirSync(join(root, 'app'));

    expect(parseServeArgs([], root)).toEqual({ ok: true, value: { port: undefined, projectDir: root } });
    expect(parseServeArgs(['--project', 'app', '--port', '9000'], root)).toEqual({ ok: true, value: { port: 9000, projectDir: join(root, 'app') } });
  });

  it('rejects an invalid port', () => {
    expect(parseServeArgs(['--port', 'eighty'], root).ok).toBe(false);
  });
});

describe('bindServer (AC1)', () => {
  it('reports a busy port instead of picking another one', async () => {
    const first = bindServer(() => new Response('first'), 0);
    if (!first.ok) throw new Error('could not bind an ephemeral port');
    const busyPort = first.value.port ?? 0;

    const second = bindServer(() => new Response('second'), busyPort);

    expect(second.ok ? undefined : second.error.type).toBe('port_in_use');
    await first.value.stop(true);
  });
});

describe('serve startup on a busy port (D38)', () => {
  it('fails with exit code 1 and creates neither the database nor serve.json', async () => {
    const blocker = Bun.serve({ fetch: () => new Response('busy'), hostname: '127.0.0.1', port: 0 });
    const homeDir = join(root, 'home');
    const errors: string[] = [];
    try {
      const exitCode = await serve({
        argv: ['--port', String(blocker.port), '--project', root],
        cwd: root,
        env: { AGENTIC_HOME: homeDir },
        logSink: () => undefined,
        stderr: (text) => errors.push(text),
        stdout: () => undefined,
      });

      expect(exitCode).toBe(1);
      expect(errors.join('')).toContain('already in use');
      expect(existsSync(join(homeDir, 'agentic.db'))).toBe(false);
      expect(existsSync(serveFilePath(homeDir))).toBe(false);
    } finally {
      await blocker.stop(true);
    }
  });
});
