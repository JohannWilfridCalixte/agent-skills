import type { HistoryEntry, HistoryScope, NewHistoryEntry } from '../model/history.js';

/** Config writes and runs. Refined in T5. */
export interface HistoryLog {
  list(scope: HistoryScope): Promise<readonly HistoryEntry[]>;
  record(entry: NewHistoryEntry): Promise<HistoryEntry>;
}
