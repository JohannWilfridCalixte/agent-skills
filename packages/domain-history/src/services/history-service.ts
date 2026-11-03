import type { HistoryEntry, HistoryLog, HistoryScope, NewHistoryEntry } from '@agentic/domain-shared';

import type { HistoryRepository } from '../ports/history-repository.js';

import { err, ok } from '@agentic/kernel-result';

import { outputTail } from '../model/output-tail.js';

export type HistoryService = ReturnType<typeof createHistoryService>;

export interface HistoryServiceDependencies {
  readonly newId: () => string;
  readonly now: () => Date;
  readonly repository: HistoryRepository;
}

/** History entries. Implements the shared `HistoryLog` port that config, install and vendoring record through. */
export function createHistoryService({ newId, now, repository }: HistoryServiceDependencies) {
  const toEntry = (entry: NewHistoryEntry): HistoryEntry => {
    const base = { createdAt: now().toISOString(), id: newId(), kind: entry.kind, scope: entry.scope, summary: entry.summary };
    switch (entry.kind) {
      case 'config_restore':
      case 'config_write': {
        return { ...base, content: entry.content, exitCode: null, outputTail: null, truncated: false };
      }
      case 'run': {
        const { tail, truncated } = outputTail(entry.output);
        return { ...base, content: null, exitCode: entry.exitCode, outputTail: tail, truncated };
      }
      default: {
        return entry satisfies never;
      }
    }
  };

  const log = {
    list: (scope: HistoryScope, { limit }: { readonly limit?: number } = {}) => repository.listByScope(scope, limit),
    record: async (entry: NewHistoryEntry) => {
      const recorded = toEntry(entry);
      await repository.insert(recorded);
      return recorded;
    },
  } satisfies HistoryLog;

  const get = async (id: string) => {
    const entry = await repository.findById(id);
    return entry === undefined ? err({ id, type: 'history_entry_not_found' } as const) : ok(entry);
  };

  return { ...log, get };
}
