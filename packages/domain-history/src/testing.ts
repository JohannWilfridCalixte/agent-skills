import type { HistoryEntry, HistoryScope } from '@agentic/domain-shared';

import type { HistoryRepository } from './ports/history-repository.js';

export class InMemoryHistoryRepository implements HistoryRepository {
  readonly rows: HistoryEntry[] = [];

  findById(id: string) {
    return Promise.resolve(this.rows.find((entry) => entry.id === id));
  }

  insert(entry: HistoryEntry) {
    this.rows.push(entry);
    return Promise.resolve();
  }

  listByScope(scope: HistoryScope, limit: number | undefined) {
    const matching = this.rows
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.scope === scope)
      .sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt) || b.index - a.index)
      .map(({ entry }) => entry);
    return Promise.resolve(limit === undefined ? matching : matching.slice(0, limit));
  }
}
