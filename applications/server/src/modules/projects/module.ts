import type { DirectoryProbe } from '@agentic/domain-projects';

import type { ModuleContext, ServerModule } from '../../platform/module.js';

import { randomUUID } from 'node:crypto';

import { createProjectsService } from '@agentic/domain-projects';

import { createProjectRepository } from './db/repository.js';
import { fsDirectoryProbe } from './fs-directory-probe.js';
import { registerProjectsRoutes } from './routes.js';

export interface ProjectsModuleOptions {
  readonly directoryProbe?: DirectoryProbe;
}

/** Known projects over the `projects` table; `service` also serves as the shared `ProjectRegistry`. */
export function createProjectsModule(context: ModuleContext, { directoryProbe = fsDirectoryProbe }: ProjectsModuleOptions = {}) {
  const service = createProjectsService({
    directoryProbe,
    newId: randomUUID,
    now: () => new Date(),
    repository: createProjectRepository(context.db),
  });

  return {
    name: 'projects',
    registerRoutes: (app) => {
      registerProjectsRoutes(app, service);
    },
    service,
  } satisfies ServerModule & { readonly service: typeof service };
}
