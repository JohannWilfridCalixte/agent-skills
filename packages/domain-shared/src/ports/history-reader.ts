import type { HistoryEntry } from '../model/history.js';

/** Reads one history entry by id (config restore reads snapshots through it without importing `domain-history`). */
export interface HistoryReader {
  /** `undefined` when no entry has this id. */
  get(id: string): Promise<HistoryEntry | undefined>;
}
