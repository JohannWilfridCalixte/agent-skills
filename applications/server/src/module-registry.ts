import type { CliExec } from '@agentic/adapter-cli-exec';
import type { CommandRunner, HistoryLog, HistoryReader, ModelSource, RunService } from '@agentic/domain-shared';

import type { ModuleContext, ServerModule } from './platform/module.js';

import { createCommandRunner } from '@agentic/adapter-cli-exec';
import { createRunService } from '@agentic/domain-runs';

import { createConfigModule } from './modules/config/module.js';
import { createHistoryModule } from './modules/history/module.js';
import { createInstallModule } from './modules/install/module.js';
import { createProjectsModule } from './modules/projects/module.js';
import { createRunsModule } from './modules/runs/module.js';
import { healthModule } from './platform/health.js';

const MODULE_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * Feature modules in mount order, plus the shared ports and services other parts of the server use
 * (`serve` adds projects; config, install and vendoring record through `historyLog`; config warns
 * on unknown model ids through install's `ModelSource`; install and vendoring start runs through `runs`).
 */
export interface ModuleAdapters {
  readonly cliExec: CliExec;
  /** Defaults to `createCommandRunner(cliExec)`; tests pass a fake to drive runs step by step. */
  readonly commandRunner?: CommandRunner;
  /** The user's home, where harness config folders live. */
  readonly userHome: string;
}

export function assertModules(modules: readonly ServerModule[]) {
  const seen = new Set<string>();
  for (const module of modules) {
    if (!MODULE_NAME.test(module.name)) throw new Error(`Invalid module name "${module.name}"`);
    if (seen.has(module.name)) throw new Error(`Duplicate module "${module.name}"`);
    seen.add(module.name);
  }
}

export function createModules(context: ModuleContext, { cliExec, commandRunner = createCommandRunner(cliExec), userHome }: ModuleAdapters) {
  const projects = createProjectsModule(context);
  const history = createHistoryModule(context);
  const historyLog: HistoryLog = history.service;
  const historyReader: HistoryReader = {
    get: async (id) => {
      const found = await history.service.get(id);
      return found.ok ? found.value : undefined;
    },
  };
  const runs: RunService = createRunService({ history: historyLog, runner: commandRunner });
  const install = createInstallModule({ cliExec, projects: projects.service, runs, userHome });
  const models: ModelSource = install.service;
  const config = createConfigModule(context, { history: historyLog, historyReader, models, projects: projects.service });
  const modules: readonly ServerModule[] = [healthModule, projects, history, config, createRunsModule(runs), ...install.modules];
  return { historyLog, modules, projects: projects.service, runs };
}
