import type { ModuleContext, ServerModule } from '../../platform/module.js';

import { randomUUID } from 'node:crypto';

import { createHistoryService } from '@agentic/domain-history';

import { createHistoryRepository } from './db/repository.js';
import { registerHistoryRoutes } from './routes.js';

/** History over the `history` table; `service` also serves as the shared `HistoryLog` other modules record through. */
export function createHistoryModule(context: ModuleContext) {
  const service = createHistoryService({ newId: randomUUID, now: () => new Date(), repository: createHistoryRepository(context.db) });

  return {
    name: 'history',
    registerRoutes: (app) => {
      registerHistoryRoutes(app, service);
    },
    service,
  } satisfies ServerModule & { readonly service: typeof service };
}
