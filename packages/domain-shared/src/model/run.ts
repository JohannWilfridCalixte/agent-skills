import type { Command, CommandCli } from './command.js';
import type { HistoryScope } from './history.js';

export type CancelRunError = RunNotFound | RunNotRunning;

export interface InvalidRunSpec {
  readonly issues: readonly string[];
  readonly type: 'invalid_run_spec';
}

/** Buffered for replay; a run ends with `exit` (when the process exited) then `status`. */
export type RunEvent =
  | { readonly exitCode: number; readonly type: 'exit' }
  | { readonly line: string; readonly type: 'stderr' | 'stdout' }
  | { readonly status: RunStatus; readonly type: 'status' };

export interface RunNotFound {
  readonly id: string;
  readonly type: 'run_not_found';
}

export interface RunNotRunning {
  readonly id: string;
  readonly status: RunStatus;
  readonly type: 'run_not_running';
}

/** A closed, typed description of a run, built by the calling module from validated enums (D34). */
export interface RunSpec {
  readonly args: readonly string[];
  readonly cli: CommandCli;
  readonly cwd?: string;
  /** Commands run after this one, in order, each only when the previous exited 0; same run, one history entry. */
  readonly next?: readonly Command[];
  /** History scope the outcome is recorded under: `global` or `project:<id>`. */
  readonly scope: HistoryScope;
  /** One-line description for history: `Install claude plugin`. */
  readonly summary: string;
}

export type RunStatus = 'cancelled' | 'failed' | 'running' | 'succeeded';

export interface RunSummary {
  readonly exitCode?: number;
  readonly finishedAt?: string;
  readonly id: string;
  readonly startedAt: string;
  readonly status: RunStatus;
}

export interface RunView extends RunSummary {
  /** Output lines buffered so far (bounded tail). */
  readonly output: readonly string[];
}
