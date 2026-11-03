import type { Kysely } from 'kysely';

import { sql } from 'kysely';

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable('history').execute();
  await db.schema.dropTable('projects').execute();
}

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable('projects')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('path', 'text', (column) => column.notNull().unique())
    .addColumn('created_at', 'text', (column) => column.notNull())
    .execute();

  await db.schema
    .createTable('history')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('scope', 'text', (column) => column.notNull())
    .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('config', 'run')`))
    .addColumn('summary', 'text', (column) => column.notNull())
    .addColumn('content', 'text')
    .addColumn('exit_code', 'integer')
    .addColumn('output_tail', 'text')
    .addColumn('truncated', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (column) => column.notNull())
    .execute();

  await db.schema.createIndex('history_scope_created_at').on('history').columns(['scope', 'created_at']).execute();
}
