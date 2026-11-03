import type { CliExec } from '@agentic/adapter-cli-exec';
import type { CommandRunner, RunService, RunSpec } from '@agentic/domain-shared';

import type { ServerModule } from '../module.js';

import { fakeCliError } from '@agentic/adapter-cli-exec/testing';

import { compose } from '../../composition-root.js';
import { problem } from '../problem.js';

export const TEST_PORT = 8787;
export const TEST_HOST = `127.0.0.1:${String(TEST_PORT)}`;
const TEST_TOKEN = 'test-token-0123456789abcdef';

/** The fixed spec the test-only `test-runs` module starts. */
export const TEST_RUN_SPEC = { args: ['--version'], cli: 'claude', scope: 'global', summary: 'Test run' } as const satisfies RunSpec;

export interface TestAppOptions {
  /** Defaults to one where every CLI is missing, so no test runs a real CLI. */
  readonly cliExec?: CliExec;
  /** Drives runs; defaults to one over `cliExec`. */
  readonly commandRunner?: CommandRunner;
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
export async function createTestApp({ cliExec = missingCliExec, commandRunner, homeDir = '/nonexistent/agentic-test-home', modules = [], userHome = '/nonexistent/agentic-test-user' }: TestAppOptions = {}) {
  const logLines: string[] = [];
  const { app, db, historyLog } = await compose({
    cliExec,
    ...(commandRunner === undefined ? {} : { commandRunner }),
    extraModules: ({ runs }) => [testRunsModule(runs), ...modules],
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

/**
 * Test-only (never in the real registry): `POST /api/test-runs` starts `TEST_RUN_SPEC`, or the JSON body as a spec so
 * tests can show that validation rejects a non-closed spec before anything runs (AC26).
 */
function testRunsModule(runs: RunService) {
  return {
    name: 'test-runs',
    registerRoutes: (app) => {
      app.post('/', async (c) => {
        const body: unknown = c.req.header('content-type') === 'application/json' ? await c.req.json() : TEST_RUN_SPEC;
        // @ts-expect-error -- deliberately passes an unchecked value to prove the service validates at runtime.
        const started = runs.start(body);
        if (!started.ok) return problem(c, { detail: started.error.issues.join('; '), status: 422, title: 'Invalid run spec', type: started.error.type });
        return c.json(started.value, 201);
      });
    },
  } satisfies ServerModule;
}
