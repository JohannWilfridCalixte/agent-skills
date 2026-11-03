import type { HistoryEntry, HistoryScope } from '@agentic/domain-shared';

/** Append-only storage of history entries. */
export interface HistoryRepository {
  findById(id: string): Promise<HistoryEntry | undefined>;
  insert(entry: HistoryEntry): Promise<void>;
  /** Newest first (ties keep insertion order reversed); at most `limit` when given. */
  listByScope(scope: HistoryScope, limit: number | undefined): Promise<readonly HistoryEntry[]>;
}
