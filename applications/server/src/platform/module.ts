import type { Hono } from 'hono';

import type { AppEnv } from './app-env.js';

/** A feature slice, mounted at `/api/<name>`; routes are relative to that prefix. */
export interface ServerModule {
  readonly name: string;
  registerRoutes(app: Hono<AppEnv>): void;
}
