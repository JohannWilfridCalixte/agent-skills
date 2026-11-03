import type { CliExec } from '@agentic/adapter-cli-exec';
import type { CommandRunner, RunService } from '@agentic/domain-shared';

import type { LogFields, Logger, LogSink } from './platform/log.js';
import type { ServerModule } from './platform/module.js';
import type { Settings } from './settings.js';

import { homedir } from 'node:os';

import { createCliExec } from '@agentic/adapter-cli-exec';

import { createModules } from './module-registry.js';
import { openDatabase } from './platform/db/db.js';
import { createLogger, SERVICE_NAME } from './platform/log.js';
import { createApp } from './server.js';

export interface CompositionInput {
  /** Defaults to the real `createCliExec`; tests pass a fake. */
  readonly cliExec?: CliExec;
  /** Defaults to one over `cliExec`; tests pass a fake to drive runs step by step. */
  readonly commandRunner?: CommandRunner;
  /** Mounted after the feature modules; the factory form gets the shared services (tests start runs this way). */
  readonly extraModules?: ((services: { readonly runs: RunService }) => readonly ServerModule[]) | readonly ServerModule[];
  readonly logSink: LogSink;
  readonly settings: Settings;
  readonly token: string;
  /** Defaults to `os.homedir()`. */
  readonly userHome?: string;
  /** Built SPA to serve at `/`; none by default. */
  readonly webRoot?: string | undefined;
}

/** Wires real adapters (sqlite, logger) into the app; tests use the same path with `:memory:`. */
export async function compose({ cliExec, commandRunner, extraModules = [], logSink, settings, token, userHome = homedir(), webRoot }: CompositionInput) {
  const db = await openDatabase(settings.dbPath);
  const logger = createLogger(logSink, { environment: settings.environment, service_name: SERVICE_NAME, service_revision: settings.serviceRevision });
  const adapters = { cliExec: cliExec ?? createCliExec({ logger: cliLogger(logger) }), logger, userHome, ...(commandRunner === undefined ? {} : { commandRunner }) };
  const { historyLog, modules, projects, runs } = createModules({ db, homeDir: settings.homeDir }, adapters);
  const extra = typeof extraModules === 'function' ? extraModules({ runs }) : extraModules;
  const app = createApp({ logger, modules: [...modules, ...extra], port: settings.port, token, webRoot });
  return { app, db, historyLog, logger, projects, runs };
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
