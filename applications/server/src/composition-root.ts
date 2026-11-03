import type { CliExec } from '@agentic/adapter-cli-exec';

import type { LogFields, Logger, LogSink } from './platform/log.js';
import type { ServerModule } from './platform/module.js';
import type { Settings } from './settings.js';

import { homedir } from 'node:os';

import { createCliExec } from '@agentic/adapter-cli-exec';

import { createModules } from './module-registry.js';
import { openDatabase } from './platform/db/db.js';
import { createLogger } from './platform/log.js';
import { createApp } from './server.js';

export interface CompositionInput {
  /** Defaults to the real `createCliExec`; tests pass a fake. */
  readonly cliExec?: CliExec;
  readonly extraModules?: readonly ServerModule[];
  readonly logSink: LogSink;
  readonly settings: Settings;
  readonly token: string;
  /** Defaults to `os.homedir()`. */
  readonly userHome?: string;
}

/** Wires real adapters (sqlite, logger) into the app; tests use the same path with `:memory:`. */
export async function compose({ cliExec, extraModules = [], logSink, settings, token, userHome = homedir() }: CompositionInput) {
  const db = await openDatabase(settings.dbPath);
  const logger = createLogger(logSink);
  const { historyLog, modules, projects } = createModules({ db, homeDir: settings.homeDir }, { cliExec: cliExec ?? createCliExec({ logger: cliLogger(logger) }), userHome });
  const app = createApp({ logger, modules: [...modules, ...extraModules], port: settings.port, token });
  return { app, db, historyLog, logger, projects };
}

/** Keeps the primitive fields cli-exec logs (cli, redacted args, exit code, duration). */
function cliLogger(logger: Logger) {
  return {
    info: (message: string, fields: Readonly<Record<string, unknown>>) => {
      const primitives: Record<string, LogFields[string]> = {};
      for (const [name, value] of Object.entries(fields)) {
        primitives[name] = value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' ? value : JSON.stringify(value);
      }
      logger.info(message, primitives);
    },
  };
}
