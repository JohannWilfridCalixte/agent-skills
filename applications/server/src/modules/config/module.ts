import type { ConfigStore } from '@agentic/domain-config';
import type { ProjectRegistry } from '@agentic/domain-shared';

import type { ModuleContext, ServerModule } from '../../platform/module.js';

import { createConfigService } from '@agentic/domain-config';

import { createFsConfigStore } from './fs-config-store.js';
import { registerConfigRoutes } from './routes.js';

export interface ConfigModuleDependencies {
  readonly projects: ProjectRegistry;
  readonly store?: ConfigStore;
}

/** Global and project config files, resolved from `homeDir` and known projects only. */
export function createConfigModule(context: ModuleContext, { projects, store = createFsConfigStore(context.homeDir) }: ConfigModuleDependencies) {
  const service = createConfigService({ projects, store });

  return {
    name: 'config',
    registerRoutes: (app) => {
      registerConfigRoutes(app, service);
    },
    service,
  } satisfies ServerModule & { readonly service: typeof service };
}
