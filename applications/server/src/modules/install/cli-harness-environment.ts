import type { CliExec } from '@agentic/adapter-cli-exec';
import type { HarnessEnvironment } from '@agentic/domain-install';

import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { HARNESS_CLI } from '@agentic/domain-install';
import { err, ok } from '@agentic/kernel-result';

/** Probes are quick; model listing may hit the network. */
const TIMEOUT_MS = { models: 20_000, probe: 5000 } as const;
const MAX_OUTPUT_BYTES = 1024 * 1024;

/** Harness CLIs through `CliExec` (no shell, fixed args) and folders under `userHome`; failures become reasons. */
export function createCliHarnessEnvironment(cliExec: CliExec, userHome: string) {
  return {
    homeFolderExists: async (name) => {
      try {
        return (await stat(join(userHome, name))).isDirectory();
      } catch {
        return false;
      }
    },
    run: async (harness, args) => {
      try {
        const timeoutMs = args[0] === '--version' ? TIMEOUT_MS.probe : TIMEOUT_MS.models;
        const result = await cliExec.run({ args, cli: HARNESS_CLI[harness], maxOutputBytes: MAX_OUTPUT_BYTES, timeoutMs });
        return result.ok ? ok(result.value.stdout) : err({ reason: result.error.message });
      } catch (error) {
        return err({ reason: error instanceof Error ? error.message : String(error) });
      }
    },
  } satisfies HarnessEnvironment;
}
