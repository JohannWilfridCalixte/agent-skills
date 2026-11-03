import type { CliExec } from '@agentic/adapter-cli-exec';

import type { ServerModule } from '../module.js';

import { fakeCliError } from '@agentic/adapter-cli-exec/testing';

import { compose } from '../../composition-root.js';

export const TEST_PORT = 8787;
export const TEST_HOST = `127.0.0.1:${String(TEST_PORT)}`;
const TEST_TOKEN = 'test-token-0123456789abcdef';

export interface TestAppOptions {
  /** Defaults to one where every CLI is missing, so no test runs a real CLI. */
  readonly cliExec?: CliExec;
  /** `AGENTIC_HOME` for the run (global `config.json` lives here); defaults to a path that does not exist. */
  readonly homeDir?: string;
  readonly modules?: readonly ServerModule[];
  /** Home holding harness config folders; defaults to a path that does not exist. */
  readonly userHome?: string;
}

const missingCliExec: CliExec = {
  run: (command) => Promise.resolve(fakeCliError(command.cli, 'not_found')),
  stream: () => {
    throw new Error('createTestApp: pass a cliExec to stream');
  },
};

/**
 * The real app over an in-memory sqlite (D30). `request()` adds a valid Host and the bearer token;
 * pass `host` or `authorization` in `init.headers` to override them (empty string removes the token).
 */
export async function createTestApp({ cliExec = missingCliExec, homeDir = '/nonexistent/agentic-test-home', modules = [], userHome = '/nonexistent/agentic-test-user' }: TestAppOptions = {}) {
  const logLines: string[] = [];
  const { app, db, historyLog } = await compose({
    cliExec,
    extraModules: modules,
    logSink: (line) => logLines.push(line),
    settings: { dbPath: ':memory:', homeDir, port: TEST_PORT },
    token: TEST_TOKEN,
    userHome,
  });

  const request = (path: string, init: RequestInit = {}) => {
    const headers = new Headers({ authorization: `Bearer ${TEST_TOKEN}`, host: TEST_HOST });
    for (const [name, value] of new Headers(init.headers)) headers.set(name, value);
    if (headers.get('authorization') === '') headers.delete('authorization');
    return app.request(`http://${TEST_HOST}${path}`, { ...init, headers });
  };

  return { app, db, historyLog, logLines, request, token: TEST_TOKEN };
}
