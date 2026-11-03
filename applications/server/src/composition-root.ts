import type { LogSink } from './platform/log.js';
import type { ServerModule } from './platform/module.js';
import type { Settings } from './settings.js';

import { createModules } from './module-registry.js';
import { openDatabase } from './platform/db/db.js';
import { createLogger } from './platform/log.js';
import { createApp } from './server.js';

export interface CompositionInput {
  readonly extraModules?: readonly ServerModule[];
  readonly logSink: LogSink;
  readonly settings: Settings;
  readonly token: string;
}

/** Wires real adapters (sqlite, logger) into the app; tests use the same path with `:memory:`. */
export async function compose({ extraModules = [], logSink, settings, token }: CompositionInput) {
  const db = await openDatabase(settings.dbPath);
  const logger = createLogger(logSink);
  const { modules, projects } = createModules({ db });
  const app = createApp({ logger, modules: [...modules, ...extraModules], port: settings.port, token });
  return { app, db, logger, projects };
}
