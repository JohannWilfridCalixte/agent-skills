import type { HistoryLog } from '@agentic/domain-shared';

import type { ModuleContext, ServerModule } from './platform/module.js';

import { createConfigModule } from './modules/config/module.js';
import { createHistoryModule } from './modules/history/module.js';
import { createProjectsModule } from './modules/projects/module.js';
import { healthModule } from './platform/health.js';

const MODULE_NAME = /^[a-z][a-z0-9-]*$/;

export function assertModules(modules: readonly ServerModule[]) {
  const seen = new Set<string>();
  for (const module of modules) {
    if (!MODULE_NAME.test(module.name)) throw new Error(`Invalid module name "${module.name}"`);
    if (seen.has(module.name)) throw new Error(`Duplicate module "${module.name}"`);
    seen.add(module.name);
  }
}

/**
 * Feature modules in mount order, plus the shared ports and services other parts of the server use
 * (`serve` adds projects; config, install and vendoring record through `historyLog`).
 */
export function createModules(context: ModuleContext) {
  const projects = createProjectsModule(context);
  const history = createHistoryModule(context);
  const historyLog: HistoryLog = history.service;
  const config = createConfigModule(context, { history: historyLog, projects: projects.service });
  const modules: readonly ServerModule[] = [healthModule, projects, history, config];
  return { historyLog, modules, projects: projects.service };
}
