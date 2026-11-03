export type { CatalogueContext, CatalogueRejection, CatalogueRequest, InstallAction, InstallMethod, InstallScope } from './model/catalogue.js';
export {
  AGENTIC_PLUGIN,
  AGENTIC_REPOSITORY_URL,
  AGENTIC_SOURCE,
  catalogueCommands,
  CURSOR_CLONE_FOLDER,
  cursorCloneDirectory,
  displayCommand,
  INSTALL_ACTIONS,
  INSTALL_METHODS,
  INSTALL_SCOPES,
} from './model/catalogue.js';
export type { Harness, HarnessPresence } from './model/harness.js';
export { HARNESS_CLI, HARNESS_FOLDER, HARNESSES, isHarness } from './model/harness.js';
export { CLAUDE_MODEL_ALIASES, parseAgentModels, parseCodexModels } from './model/parse-models.js';
export type { ParsedStatus } from './model/parse-status.js';
export { parseClaudePluginList, parseCodexPluginList, parseGitHead, parseSkillsList } from './model/parse-status.js';
export type { CliUnavailable, HarnessEnvironment } from './ports/harness-environment.js';
export type { CatalogueService, CatalogueServiceDependencies, InstallError, InstallRequest, InstallStatusEntry, StatusQuery } from './services/catalogue-service.js';
export { createCatalogueService } from './services/catalogue-service.js';
export type { InstallService } from './services/install-service.js';
export { createInstallService } from './services/install-service.js';
