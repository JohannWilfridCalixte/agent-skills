/** A recorded config snapshot or run outcome, as stored and listed. */
export interface HistoryEntry {
  /** Full file content for config kinds; `null` for runs. */
  readonly content: null | string;
  readonly createdAt: string;
  /** Process exit code for runs; `null` for config kinds. */
  readonly exitCode: null | number;
  readonly id: string;
  readonly kind: HistoryKind;
  /** Last 256 KiB of run output; `null` for config kinds. */
  readonly outputTail: null | string;
  readonly scope: HistoryScope;
  readonly summary: string;
  /** `true` when run output was longer than the tail kept. */
  readonly truncated: boolean;
}

export type HistoryKind = NewHistoryEntry['kind'];

/** `global` or `project:<id>`. */
export type HistoryScope = string;

export interface NewConfigEntry {
  readonly content: string;
  readonly kind: 'config_restore' | 'config_write';
  readonly scope: HistoryScope;
  readonly summary: string;
}

/** What another domain records: a config write or restore with the content written, or a finished run with its full output. */
export type NewHistoryEntry = NewConfigEntry | NewRunEntry;

export interface NewRunEntry {
  readonly exitCode: number;
  readonly kind: 'run';
  /** Full output; the history log keeps only its tail. */
  readonly output: string;
  /** `true` when `output` already lacks its head (the run dropped lines before recording). */
  readonly outputTruncated?: boolean;
  readonly scope: HistoryScope;
  readonly summary: string;
}
