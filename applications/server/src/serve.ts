import type { ProjectsService } from '@agentic/domain-projects';

import type { Logger, LogSink } from './platform/log.js';

import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { err, ok } from '@agentic/kernel-result';

import { compose } from './composition-root.js';
import { DEFAULT_WEB_ROOT, hasWebUi } from './platform/web-ui.js';
import { loadSettings } from './settings.js';

export interface ServeFile {
  readonly pid: number;
  readonly port: number;
  readonly token: string;
}

export interface ServeIo {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly logSink: LogSink;
  readonly stderr: (text: string) => void;
  readonly stdout: (text: string) => void;
}

const HOSTNAME = '127.0.0.1';

export const serveFilePath = (homeDir: string) => join(homeDir, 'serve.json');

/** Binds 127.0.0.1 only; a busy port is an error (D38), never an auto-picked port. */
export function bindServer(fetch: (request: Request) => Promise<Response> | Response, port: number) {
  try {
    return ok(Bun.serve({ fetch, hostname: HOSTNAME, port }));
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : '';
    return err({ cause: error, type: code === 'EADDRINUSE' ? 'port_in_use' : 'bind_failed' });
  }
}

/** `--project <dir>` (relative to cwd) or cwd itself. */
export function parseServeArgs(argv: readonly string[], cwd: string) {
  const { values } = parseArgs({
    args: [...argv],
    options: { port: { type: 'string' }, project: { type: 'string' } },
    strict: true,
  });
  const port = values.port === undefined ? undefined : Number(values.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65_535)) return err({ type: 'invalid_port', value: values.port ?? '' });
  return ok({ port, projectDir: resolve(cwd, values.project ?? '.') });
}

/** Registers the folder serve started in, when valid and not yet known; never fails the start. */
export async function registerStartFolder(projects: Pick<ProjectsService, 'add'>, folder: string, logger: Logger) {
  const added = await projects.add(folder);
  if (added.ok) {
    logger.info('project_registered', { project_id: added.value.id });
    return 'registered';
  }
  const reason = added.error.type;
  switch (reason) {
    case 'path_not_absolute':
    case 'path_not_directory':
    case 'path_not_found': {
      logger.warn('start_folder_not_registered', { reason });
      return 'invalid';
    }
    case 'project_already_known': {
      return 'already_known';
    }
    default: {
      return reason satisfies never;
    }
  }
}

export function removeServeFile(path: string) {
  rmSync(path, { force: true });
}

/** `agentic serve`: start the API, register the folder, publish port and token, clean up on exit. Resolves to the exit code on startup failure. */
export async function serve(io: ServeIo) {
  const settings = loadSettings(io.env);
  const args = parseServeArgs(io.argv, io.cwd);
  if (!args.ok) {
    io.stderr(`Invalid --port "${args.error.value}": expected an integer between 1 and 65535.\n`);
    return 1;
  }
  const port = args.value.port ?? settings.port;
  const token = randomBytes(32).toString('base64url');

  /** Bind before opening the database, so a busy port leaves nothing behind (D38). */
  let handle: (request: Request) => Promise<Response> | Response = () => new Response('Starting', { status: 503 });
  const bound = bindServer((request) => handle(request), port);
  if (!bound.ok) {
    io.stderr(
      bound.error.type === 'port_in_use'
        ? `Port ${String(port)} on ${HOSTNAME} is already in use. Stop the other process or choose another port with --port or AGENTIC_PORT.\n`
        : `Could not listen on ${HOSTNAME}:${String(port)}.\n`,
    );
    return 1;
  }
  const server = bound.value;

  const webRoot = hasWebUi(DEFAULT_WEB_ROOT) ? DEFAULT_WEB_ROOT : undefined;
  if (webRoot === undefined) io.stderr('Web UI not built; run `bun run build`\n');
  const { app, db, logger, projects } = await compose({ logSink: io.logSink, settings: { ...settings, port }, token, webRoot });
  handle = app.fetch;

  await registerStartFolder(projects, args.value.projectDir, logger);

  const servePath = serveFilePath(settings.homeDir);
  writeServeFile(servePath, { pid: process.pid, port, token });
  logger.info('server_started', { port });
  io.stdout(`agentic is running at http://${HOSTNAME}:${String(port)}/#token=${token}\n`);

  process.once('exit', () => {
    removeServeFile(servePath);
  });
  const shutdown = () => {
    removeServeFile(servePath);
    void server
      .stop()
      .then(() => db.destroy())
      .finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return undefined;
}

/** Writes `serve.json` readable by the user only (D28); creates the directory (0700) when missing. */
export function writeServeFile(path: string, file: ServeFile) {
  mkdirSync(resolve(path, '..'), { mode: 0o700, recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}
