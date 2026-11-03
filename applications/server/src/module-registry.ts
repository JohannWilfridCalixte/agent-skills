import type { ModuleContext, ServerModule } from './platform/module.js';

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

/** Feature modules in mount order, plus the services other parts of the server (e.g. `serve`) use. */
export function createModules(context: ModuleContext) {
  const projects = createProjectsModule(context);
  const modules: readonly ServerModule[] = [healthModule, projects];
  return { modules, projects: projects.service };
}
