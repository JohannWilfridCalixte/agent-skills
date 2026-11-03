import type { HistoryEntry, HistoryScope, NewHistoryEntry } from '../model/history.js';

/** Append-only record of config writes and runs; other domains record through it without importing `domain-history`. */
export interface HistoryLog {
  /** Newest first; at most `limit` entries when given. */
  list(scope: HistoryScope, options?: { readonly limit?: number }): Promise<readonly HistoryEntry[]>;
  record(entry: NewHistoryEntry): Promise<HistoryEntry>;
}
