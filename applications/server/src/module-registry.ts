import type { ServerModule } from './platform/module.js';

import { healthModule } from './platform/health.js';

const MODULE_NAME = /^[a-z][a-z0-9-]*$/;

/** Feature modules in mount order; T4+ append theirs here. */
export const MODULES: readonly ServerModule[] = [healthModule];

export function assertModules(modules: readonly ServerModule[]) {
  const seen = new Set<string>();
  for (const module of modules) {
    if (!MODULE_NAME.test(module.name)) throw new Error(`Invalid module name "${module.name}"`);
    if (seen.has(module.name)) throw new Error(`Duplicate module "${module.name}"`);
    seen.add(module.name);
  }
}
