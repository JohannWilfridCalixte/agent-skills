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

    expect(await registerStartFolder(projects, root, logger)).toEqual({ projectId: 'id-1', status: 'registered' });
    expect(await registerStartFolder(projects, root, logger)).toEqual({ projectId: 'id-1', status: 'already_known' });
    expect((await projects.list()).map((project) => project.path)).toEqual([root]);
  });

  it('skips a missing folder with a warning and registers nothing', async () => {
    const { lines, logger, projects } = projectsWithLog();

    expect(await registerStartFolder(projects, join(root, 'missing'), logger)).toEqual({ status: 'invalid' });
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
      const result = await serve({
        argv: ['--port', String(blocker.port), '--project', root],
        cwd: root,
        env: { AGENTIC_HOME: homeDir },
        logSink: () => undefined,
        stderr: (text) => errors.push(text),
        stdout: () => undefined,
      });

      expect(result).toEqual({ exitCode: 1 });
      expect(errors.join('')).toContain('already in use');
      expect(existsSync(join(homeDir, 'agentic.db'))).toBe(false);
      expect(existsSync(serveFilePath(homeDir))).toBe(false);
    } finally {
      await blocker.stop(true);
    }
  });
});

async function freePort() {
  const probe = Bun.serve({ fetch: () => new Response(''), hostname: '127.0.0.1', port: 0 });
  const port = probe.port ?? 0;
  await probe.stop(true);
  return port;
}

async function startServe(homeDir: string) {
  const output: string[] = [];
  const started = await serve({
    argv: ['--port', String(await freePort()), '--project', root],
    cwd: root,
    env: { AGENTIC_HOME: homeDir },
    logSink: () => undefined,
    stderr: () => undefined,
    stdout: (text) => output.push(text),
  });
  if (!('stop' in started)) throw new Error(`serve failed with exit code ${String(started.exitCode)}`);
  return { output: output.join(''), stop: started.stop };
}

describe('serve startup (AC1, D28)', () => {
  it('prints a URL that opens the UI on the registered start folder', async () => {
    const homeDir = join(root, 'home');
    const { output, stop } = await startServe(homeDir);
    try {
      const listed = await fetch(`${/http:\/\/[^/]+/.exec(output)?.[0] ?? ''}/api/projects`);
      const { projects } = (await listed.json()) as { projects: { id: string; path: string }[] };

      expect(projects.map((project) => project.path)).toEqual([root]);
      expect(output).toMatch(new RegExp(String.raw`/#token=[\w-]+&project=${projects[0]?.id ?? 'none'}\n$`));
    } finally {
      await stop();
    }
  });

  it('creates the home directory 0700 and the database and serve.json 0600', async () => {
    const homeDir = join(root, 'home');
    const { stop } = await startServe(homeDir);
    try {
      expect(statSync(homeDir).mode & 0o777).toBe(0o700);
      expect(statSync(join(homeDir, 'agentic.db')).mode & 0o777).toBe(0o600);
      for (const sidecar of ['agentic.db-wal', 'agentic.db-shm']) {
        if (existsSync(join(homeDir, sidecar))) expect(statSync(join(homeDir, sidecar)).mode & 0o777).toBe(0o600);
      }
      expect(statSync(serveFilePath(homeDir)).mode & 0o777).toBe(0o600);
    } finally {
      await stop();
    }
  });
});
