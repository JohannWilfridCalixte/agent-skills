import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';
import { sql } from 'kysely';

import { openDatabase } from './db.js';

async function tableNames(path: string) {
  const db = await openDatabase(path);
  const result = await sql<{ name: string }>`select name from sqlite_master where type = 'table' order by name`.execute(db);
  await db.destroy();
  return result.rows.map((row) => row.name);
}

describe('openDatabase', () => {
  it('applies the migrations to an in-memory database', async () => {
    expect(await tableNames(':memory:')).toEqual(expect.arrayContaining(['history', 'projects']));
  });

  it('creates the database directory and is idempotent across restarts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'agentic-db-'));
    try {
      const path = join(root, 'nested', 'agentic.db');

      expect(await tableNames(path)).toEqual(expect.arrayContaining(['history', 'projects']));
      expect(await tableNames(path)).toEqual(expect.arrayContaining(['history', 'projects']));
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('enforces a unique project path', async () => {
    const db = await openDatabase(':memory:');
    const row = { created_at: '2026-01-01T00:00:00.000Z', path: '/work/app' };
    await db.insertInto('projects').values({ ...row, id: 'a' }).execute();

    expect(db.insertInto('projects').values({ ...row, id: 'b' }).execute()).rejects.toThrow(/UNIQUE/);
    await db.destroy();
  });
});
