import type { Hono } from 'hono';

import type { AppEnv } from './app-env.js';
import type { AppDatabase } from './db/db.js';

/** What a feature module may build its adapters from. */
export interface ModuleContext {
  readonly db: AppDatabase;
}

/** A feature slice, mounted at `/api/<name>`; routes are relative to that prefix. */
export interface ServerModule {
  readonly name: string;
  registerRoutes(app: Hono<AppEnv>): void;
}
