import type { Result } from '@agentic/kernel-result';

/** Closed list of executables this app may launch. `node`/`bun` run repository scripts (vendor-skills.mjs). */
export const CLI_NAMES = ['agent', 'claude', 'codex', 'git', 'npx', 'node', 'bun'] as const;
export type CliName = (typeof CLI_NAMES)[number];

export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

export interface CliCommand {
  readonly args: readonly string[];
  readonly cli: CliName;
  readonly correlationId?: string;
  readonly cwd?: string;
  /** Added on top of the inherited allowlist; values are never logged. */
  readonly env?: Readonly<Record<string, string>>;
  /** Combined stdout+stderr bytes kept before the process tree is killed. */
  readonly maxOutputBytes?: number;
  readonly stdin?: string;
  readonly timeoutMs?: number;
}

export type CliEvent =
  | { readonly durationMs: number; readonly exitCode: number; readonly type: 'exit' }
  | { readonly line: string; readonly type: 'stderr' | 'stdout' };

export interface CliExec {
  run(command: CliCommand): Promise<Result<CliOutput, CliExecError>>;
  stream(command: CliCommand): CliStream;
}

export interface CliExecError {
  readonly cli: CliName;
  readonly exitCode: null | number;
  readonly hint?: string;
  readonly message: string;
  readonly stderrTail: string;
  /** True when output was dropped from the head to respect `maxOutputBytes`. */
  readonly truncated?: boolean;
  readonly type: CliExecErrorType;
}

export type CliExecErrorType = 'cancelled' | 'failed' | 'invalid_output' | 'not_found' | 'not_installed' | 'output_too_large' | 'timeout';

export interface CliOutput {
  readonly durationMs: number;
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

export interface CliStream {
  cancel(): void;
  readonly events: AsyncIterable<CliEvent>;
  readonly result: Promise<Result<CliOutput, CliExecError>>;
}

export const isCliName = (value: string): value is CliName => (CLI_NAMES as readonly string[]).includes(value);
