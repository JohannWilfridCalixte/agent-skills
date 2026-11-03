import type { Hono } from 'hono';

import type { AppEnv } from './app-env.js';
import type { AppDatabase } from './db/db.js';

/** What a feature module may build its adapters from. */
export interface ModuleContext {
  readonly db: AppDatabase;
  /** `AGENTIC_HOME` or `~/.agentic`; holds the global `config.json`. */
  readonly homeDir: string;
}

/** A feature slice, mounted at `/api/<name>` (or `mountPath`); routes are relative to that prefix. */
export interface ServerModule {
  /** Overrides `/api/<name>` for a slice nested under another resource (work-items lives under `/api/projects`). */
  readonly mountPath?: `/api/${string}`;
  readonly name: string;
  registerRoutes(app: Hono<AppEnv>): void;
}
