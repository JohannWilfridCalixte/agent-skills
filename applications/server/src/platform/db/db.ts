import type { Database as Schema } from './schema.js';

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { Database } from 'bun:sqlite';
import { Kysely, Migrator } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-sqlite';

import { MIGRATIONS } from './migrations/index.js';

export type AppDatabase = Kysely<Schema>;

/** Opens (creating its directory) and migrates the sqlite database (D22, D38). */
export async function openDatabase(path: string): Promise<AppDatabase> {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { create: true, strict: true });
  sqlite.run('PRAGMA journal_mode = WAL');
  sqlite.run('PRAGMA foreign_keys = ON');
  const db = new Kysely<Schema>({ dialect: new BunSqliteDialect({ database: sqlite }) });

  const migrator = new Migrator({ db, provider: { getMigrations: () => Promise.resolve({ ...MIGRATIONS }) } });
  const { error } = await migrator.migrateToLatest();
  if (error !== undefined) {
    await db.destroy();
    throw new Error('Database migration failed', { cause: error });
  }
  return db;
}
