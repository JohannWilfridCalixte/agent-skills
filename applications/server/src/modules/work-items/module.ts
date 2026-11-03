import type { ProjectOutputResolver } from '@agentic/domain-shared';
import type { WorkItemSource } from '@agentic/domain-work-items';

import type { ServerModule } from '../../platform/module.js';

import { createWorkItemsService } from '@agentic/domain-work-items';

import { fsWorkItemSource } from './fs-work-item-source.js';
import { registerWorkItemsRoutes } from './routes.js';

export interface WorkItemsModuleDependencies {
  readonly outputs: ProjectOutputResolver;
  readonly source?: WorkItemSource;
}

/** Read-only work-item browse, nested under projects: `/api/projects/:projectId/work-items/…`. */
export function createWorkItemsModule({ outputs, source = fsWorkItemSource }: WorkItemsModuleDependencies) {
  const service = createWorkItemsService({ outputs, source });

  return {
    mountPath: '/api/projects',
    name: 'work-items',
    registerRoutes: (app) => {
      registerWorkItemsRoutes(app, service);
    },
  } satisfies ServerModule;
}
