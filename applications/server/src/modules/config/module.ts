import type { ConfigStore, ModelCatalog } from '@agentic/domain-config';
import type { HistoryLog, HistoryReader, ProjectRegistry } from '@agentic/domain-shared';

import type { ModuleContext, ServerModule } from '../../platform/module.js';

import { createConfigService } from '@agentic/domain-config';

import { createFsConfigStore } from './fs-config-store.js';
import { registerConfigRoutes } from './routes.js';

export interface ConfigModuleDependencies {
  readonly history: HistoryLog;
  readonly historyReader: HistoryReader;
  readonly models?: ModelCatalog;
  readonly projects: ProjectRegistry;
  readonly store?: ConfigStore;
}

/** Global and project config files, resolved from `homeDir` and known projects only. */
export function createConfigModule(context: ModuleContext, { history, historyReader, models, projects, store = createFsConfigStore(context.homeDir) }: ConfigModuleDependencies) {
  const service = createConfigService({ history, historyReader, projects, store, ...(models === undefined ? {} : { models }) });

  return {
    name: 'config',
    registerRoutes: (app) => {
      registerConfigRoutes(app, service);
    },
    service,
  } satisfies ServerModule & { readonly service: typeof service };
}
