import type { Result } from '@agentic/kernel-result';

/** Closed list of executables a command may launch (mirrors `adapter-cli-exec` `CLI_NAMES`). */
export const COMMAND_CLIS = ['agent', 'claude', 'codex', 'git', 'npx', 'node', 'bun'] as const;
/** A command built from validated enums by the calling domain: never a raw shell string (D34). */
export interface Command {
  readonly args: readonly string[];
  readonly cli: CommandCli;
  readonly cwd?: string;
}

export type CommandCli = (typeof COMMAND_CLIS)[number];

/**
 * Why a command produced no exit code. A process that exited (zero or not) is an outcome, not an error;
 * `exitCode` is set only when the process exited before the failure was detected.
 */
export interface CommandError {
  readonly exitCode: null | number;
  readonly message: string;
  readonly type: 'cancelled' | 'not_found' | 'not_installed' | 'output_too_large' | 'timeout' | 'unexpected';
}

export interface CommandLine {
  readonly line: string;
  readonly type: 'stderr' | 'stdout';
}

/** The process exited with this code. */
export interface CommandOutcome {
  readonly exitCode: number;
}

export interface CommandStream {
  cancel(): void;
  /** stdout/stderr lines in arrival order; ends when the process ends. */
  readonly lines: AsyncIterable<CommandLine>;
  readonly result: Promise<Result<CommandOutcome, CommandError>>;
}

export const isCommandCli = (value: unknown): value is CommandCli => typeof value === 'string' && (COMMAND_CLIS as readonly string[]).includes(value);
