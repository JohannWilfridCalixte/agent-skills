import type { ModelListing } from '@agentic/domain-shared';

import type { Harness } from '../model/harness.js';
import type { HarnessEnvironment } from '../ports/harness-environment.js';

import { HARNESS_CLI, HARNESS_FOLDER, HARNESSES, presence } from '../model/harness.js';
import { CLAUDE_MODEL_ALIASES, parseAgentModels, parseCodexModels } from '../model/parse-models.js';

const MODEL_COMMANDS = {
  codex: { args: ['debug', 'models'], parse: parseCodexModels },
  cursor: { args: ['models'], parse: parseAgentModels },
} as const;

export type InstallService = ReturnType<typeof createInstallService>;

/** Harness detection and model lists; every failure becomes data with a reason, never an exception. */
export function createInstallService(environment: HarnessEnvironment) {
  const detect = async (harness: Harness) => {
    const [version, folder] = await Promise.all([environment.run(harness, ['--version']), environment.homeFolderExists(HARNESS_FOLDER[harness])]);
    return presence(harness, version.ok ? version.value.trim() : undefined, folder);
  };

  const models = async (harness: Harness) => {
    if (harness === 'claude') return { available: true, ids: CLAUDE_MODEL_ALIASES } satisfies ModelListing;
    const command = MODEL_COMMANDS[harness];
    const output = await environment.run(harness, command.args);
    if (!output.ok) return { available: false, reason: `${harness} models unavailable: ${output.error.reason}` } satisfies ModelListing;
    const ids = command.parse(output.value);
    if (ids.length === 0) return { available: false, reason: `${HARNESS_CLI[harness]} ${command.args.join(' ')} listed no model ids` } satisfies ModelListing;
    return { available: true, ids } satisfies ModelListing;
  };

  return {
    harnesses: () => Promise.all(HARNESSES.map(detect)),
    models,
  };
}
