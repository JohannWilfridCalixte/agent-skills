import type { Kysely } from 'kysely';

import { sql } from 'kysely';

export async function down(db: Kysely<unknown>) {
  await rebuild(db, `kind in ('config', 'run')`, sql`case kind when 'run' then 'run' else 'config' end`);
}

/** Sqlite cannot alter a check constraint: rebuild `history` with the T5 kinds, mapping `config` to `config_write`. */
export async function up(db: Kysely<unknown>) {
  await rebuild(db, `kind in ('config_write', 'config_restore', 'run')`, sql`case kind when 'config' then 'config_write' else kind end`);
}

async function rebuild(db: Kysely<unknown>, check: string, kind: ReturnType<typeof sql>) {
  await db.schema
    .createTable('history_next')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('scope', 'text', (column) => column.notNull())
    .addColumn('kind', 'text', (column) => column.notNull().check(sql.raw(check)))
    .addColumn('summary', 'text', (column) => column.notNull())
    .addColumn('content', 'text')
    .addColumn('exit_code', 'integer')
    .addColumn('output_tail', 'text')
    .addColumn('truncated', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (column) => column.notNull())
    .execute();
  await sql`insert into history_next (id, scope, kind, summary, content, exit_code, output_tail, truncated, created_at)
    select id, scope, ${kind}, summary, content, exit_code, output_tail, truncated, created_at from history`.execute(db);
  await db.schema.dropTable('history').execute();
  await db.schema.alterTable('history_next').renameTo('history').execute();
  await db.schema.createIndex('history_scope_created_at').on('history').columns(['scope', 'created_at']).execute();
}
