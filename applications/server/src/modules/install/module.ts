import type { CliExec } from '@agentic/adapter-cli-exec';

import type { ServerModule } from '../../platform/module.js';

import { createInstallService } from '@agentic/domain-install';

import { createCliHarnessEnvironment } from './cli-harness-environment.js';
import { registerInstallRoutes, registerModelsRoutes } from './routes.js';

export interface InstallModuleDependencies {
  readonly cliExec: CliExec;
  /** The user's home: harness config folders (`~/.cursor`, `~/.claude`, `~/.codex`) live here. */
  readonly userHome: string;
}

/**
 * Harness detection (`/api/install`) and model lists (`/api/models`). `service` doubles as the shared
 * `ModelSource` that config uses for unknown-model warnings.
 */
export function createInstallModule({ cliExec, userHome }: InstallModuleDependencies) {
  const service = createInstallService(createCliHarnessEnvironment(cliExec, userHome));
  const install = { name: 'install', registerRoutes: (app) => {
    registerInstallRoutes(app, service);
  } } satisfies ServerModule;
  const models = { name: 'models', registerRoutes: (app) => {
    registerModelsRoutes(app, service);
  } } satisfies ServerModule;
  return { modules: [install, models], service };
}
