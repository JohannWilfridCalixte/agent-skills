import type { ServerModule } from '../module.js';

import { compose } from '../../composition-root.js';

export const TEST_PORT = 8787;
export const TEST_HOST = `127.0.0.1:${String(TEST_PORT)}`;
const TEST_TOKEN = 'test-token-0123456789abcdef';

export interface TestAppOptions {
  readonly modules?: readonly ServerModule[];
}

/**
 * The real app over an in-memory sqlite (D30). `request()` adds a valid Host and the bearer token;
 * pass `host` or `authorization` in `init.headers` to override them (empty string removes the token).
 */
export async function createTestApp({ modules = [] }: TestAppOptions = {}) {
  const logLines: string[] = [];
  const { app, db, historyLog } = await compose({
    extraModules: modules,
    logSink: (line) => logLines.push(line),
    settings: { dbPath: ':memory:', homeDir: '/nonexistent/agentic-test-home', port: TEST_PORT },
    token: TEST_TOKEN,
  });

  const request = (path: string, init: RequestInit = {}) => {
    const headers = new Headers({ authorization: `Bearer ${TEST_TOKEN}`, host: TEST_HOST });
    for (const [name, value] of new Headers(init.headers)) headers.set(name, value);
    if (headers.get('authorization') === '') headers.delete('authorization');
    return app.request(`http://${TEST_HOST}${path}`, { ...init, headers });
  };

  return { app, db, historyLog, logLines, request, token: TEST_TOKEN };
}
