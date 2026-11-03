import type { Result } from '@agentic/kernel-result';

import type { Harness } from '../model/harness.js';

/** Why a harness CLI call gave no usable output (missing, failing, timed out). */
export interface CliUnavailable {
  readonly reason: string;
}

/** The machine as seen by detection: run a harness's own CLI, look for its config folder. */
export interface HarnessEnvironment {
  /** Whether `~/<name>` exists. */
  homeFolderExists(name: string): Promise<boolean>;
  /** Runs the harness's CLI with fixed args; resolves to stdout, never rejects. */
  run(harness: Harness, args: readonly string[]): Promise<Result<string, CliUnavailable>>;
}
