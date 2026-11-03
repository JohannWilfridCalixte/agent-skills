import type { RunService } from '@agentic/domain-shared';

import type { ServerModule } from '../../platform/module.js';

import { registerRunsRoutes } from './routes.js';

/** `/api/runs`: status, SSE events and cancel for runs other modules start through the shared `RunService`. */
export function createRunsModule(service: RunService, options: { readonly heartbeatMs?: number } = {}) {
  return {
    name: 'runs',
    registerRoutes: (app) => {
      registerRunsRoutes(app, service, options);
    },
  } satisfies ServerModule;
}
