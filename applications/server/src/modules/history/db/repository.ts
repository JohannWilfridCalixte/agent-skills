import type { HistoryRepository } from '@agentic/domain-history';
import type { HistoryEntry } from '@agentic/domain-shared';

import type { AppDatabase } from '../../../platform/db/db.js';
import type { HistoryTable } from '../../../platform/db/schema.js';

import { sql } from 'kysely';

const toEntry = (row: HistoryTable) =>
  ({
    content: row.content,
    createdAt: row.created_at,
    exitCode: row.exit_code,
    id: row.id,
    kind: row.kind,
    outputTail: row.output_tail,
    scope: row.scope,
    summary: row.summary,
    truncated: row.truncated === 1,
  }) satisfies HistoryEntry;

/** `history` table (D6, D15), append-only. Ties on `created_at` break on rowid so the latest insert lists first. */
export function createHistoryRepository(db: AppDatabase) {
  return {
    findById: async (id) => {
      const row = await db.selectFrom('history').selectAll().where('id', '=', id).executeTakeFirst();
      return row === undefined ? undefined : toEntry(row);
    },
    insert: async (entry) => {
      await db
        .insertInto('history')
        .values({
          content: entry.content,
          created_at: entry.createdAt,
          exit_code: entry.exitCode,
          id: entry.id,
          kind: entry.kind,
          output_tail: entry.outputTail,
          scope: entry.scope,
          summary: entry.summary,
          truncated: entry.truncated ? 1 : 0,
        })
        .execute();
    },
    listByScope: async (scope, limit) => {
      let query = db.selectFrom('history').selectAll().where('scope', '=', scope).orderBy('created_at', 'desc').orderBy(sql`rowid`, 'desc');
      if (limit !== undefined) query = query.limit(limit);
      const rows = await query.execute();
      return rows.map(toEntry);
    },
  } satisfies HistoryRepository;
}
