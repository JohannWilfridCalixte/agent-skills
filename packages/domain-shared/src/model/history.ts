/** A recorded config snapshot or run outcome; refined in T5. */
export interface HistoryEntry {
  readonly content: null | string;
  readonly createdAt: string;
  readonly exitCode: null | number;
  readonly id: string;
  readonly kind: HistoryKind;
  readonly outputTail: null | string;
  readonly scope: HistoryScope;
  readonly summary: string;
  readonly truncated: boolean;
}

export type HistoryKind = 'config' | 'run';

/** `global` or `project:<id>`. */
export type HistoryScope = string;

export type NewHistoryEntry = Omit<HistoryEntry, 'createdAt' | 'id'>;
