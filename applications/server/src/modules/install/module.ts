import type { CliExec } from '@agentic/adapter-cli-exec';
import type { ProjectRegistry, RunService } from '@agentic/domain-shared';

import type { ServerModule } from '../../platform/module.js';

import { createCatalogueService, createInstallService } from '@agentic/domain-install';

import { createCliHarnessEnvironment } from './cli-harness-environment.js';
import { registerInstallRoutes, registerModelsRoutes } from './routes.js';

export interface InstallModuleDependencies {
  readonly cliExec: CliExec;
  /** Resolves `projectId` for project-scoped skills installs. */
  readonly projects: ProjectRegistry;
  /** Install and update commands run here (one run per ordered sequence). */
  readonly runs: RunService;
  /** The user's home: harness config folders (`~/.cursor`, `~/.claude`, `~/.codex`) and the Cursor clone live here. */
  readonly userHome: string;
}

/**
 * Harness detection, catalogue preview/run/status (`/api/install`) and model lists (`/api/models`). `service`
 * doubles as the shared `ModelSource` that config uses for unknown-model warnings.
 */
export function createInstallModule({ cliExec, projects, runs, userHome }: InstallModuleDependencies) {
  const environment = createCliHarnessEnvironment(cliExec, userHome);
  const service = createInstallService(environment);
  const catalogue = createCatalogueService({ environment, projects, runs, userHome });
  const install = { name: 'install', registerRoutes: (app) => {
    registerInstallRoutes(app, service, catalogue);
  } } satisfies ServerModule;
  const models = { name: 'models', registerRoutes: (app) => {
    registerModelsRoutes(app, service);
  } } satisfies ServerModule;
  return { modules: [install, models], service };
}
