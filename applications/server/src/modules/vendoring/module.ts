import type { ProjectRegistry, RunService } from '@agentic/domain-shared';
import type { VendorSource } from '@agentic/domain-vendoring';

import type { ServerModule } from '../../platform/module.js';

import { createVendoringService } from '@agentic/domain-vendoring';

import { fsVendorSource } from './fs-vendor-source.js';
import { registerVendoringRoutes } from './routes.js';

export interface VendoringModuleDependencies {
  readonly projects: ProjectRegistry;
  /** check, verify and update run here, recorded under `project:<id>`. */
  readonly runs: RunService;
  readonly source?: VendorSource;
}

/** Vendored skills of a project (`/api/vendoring/:projectId/…`): list, preview and confirmed runs. */
export function createVendoringModule({ projects, runs, source = fsVendorSource }: VendoringModuleDependencies) {
  const service = createVendoringService({ projects, runs, source });
  return {
    name: 'vendoring',
    registerRoutes: (app) => {
      registerVendoringRoutes(app, service);
    },
  } satisfies ServerModule;
}
