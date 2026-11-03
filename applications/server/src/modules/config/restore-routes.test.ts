import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { ConfigRestorePreviewResponse, ConfigRestoreResponse } from '@agentic/contract-http/config';
import { ProblemDetails } from '@agentic/contract-http/problem';

import { createTestApp } from '../../platform/testing/test-app.js';

let root = '';
let homeDir = '';
let projectDir = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentic-config-restore-'));
  homeDir = join(root, 'home');
  projectDir = join(root, 'app');
  mkdirSync(projectDir);
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const projectFile = () => join(projectDir, '.agentic.json');

async function setup() {
  const app = await createTestApp({ homeDir });
  const added = await app.request('/api/projects', { body: JSON.stringify({ path: projectDir }), headers: { 'content-type': 'application/json' }, method: 'POST' });
  const { id } = z.object({ id: z.string() }).parse(await added.json());
  const post = (path: string, init: RequestInit = {}) => app.request(path, { ...init, method: 'POST' });
  const put = (scope: string, body: unknown) => app.request(`/api/config/${scope}`, { body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, method: 'PUT' });
  return { ...app, post, put, scope: `project:${id}` };
}

describe('POST /api/config/restore/:id/preview (AC17)', () => {
  it('shows the diff of the file on disk against the entry content and writes nothing', async () => {
    const { historyLog, post, put, scope } = await setup();
    await put(scope, { output: 'first' });
    await put(scope, { output: 'second' });
    const entries = await historyLog.list(scope);
    const first = entries.at(-1);
    const before = readFileSync(projectFile(), 'utf8');

    const response = await post(`/api/config/restore/${first?.id ?? ''}/preview`);

    expect(response.status).toBe(200);
    const body = ConfigRestorePreviewResponse.parse(await response.json());
    expect(body.diff.filter((line) => line.kind !== 'context').map((line) => `${line.kind} ${line.text}`)).toEqual(['removed   "output": "second"', 'added   "output": "first"']);
    expect(body).toMatchObject({ entryId: first?.id, proposedText: '{\n  "output": "first"\n}\n', scope });
    expect(readFileSync(projectFile(), 'utf8')).toBe(before);
    expect(await historyLog.list(scope)).toHaveLength(entries.length);
  });
});

describe('POST /api/config/restore/:id (AC17)', () => {
  it('writes the old content, snapshots the pre-restore content and records a new entry, leaving the original untouched', async () => {
    const { historyLog, post, put, scope } = await setup();
    await put(scope, { output: 'first' });
    const [first] = await historyLog.list(scope);
    writeFileSync(projectFile(), '{"output":"edited by hand"}');

    const response = await post(`/api/config/restore/${first?.id ?? ''}`);

    expect(response.status).toBe(200);
    const body = ConfigRestoreResponse.parse(await response.json());
    expect(body).toMatchObject({ changed: true, restoredFrom: first?.id, scope, text: '{\n  "output": "first"\n}\n' });
    expect(readFileSync(projectFile(), 'utf8')).toBe('{\n  "output": "first"\n}\n');
    const entries = await historyLog.list(scope);
    expect(entries.map(({ content, kind }) => ({ content, kind }))).toEqual([
      { content: '{\n  "output": "first"\n}\n', kind: 'config_restore' },
      { content: '{"output":"edited by hand"}', kind: 'config_write' },
      { content: '{\n  "output": "first"\n}\n', kind: 'config_write' },
    ]);
    expect(entries[0]?.summary).toContain(first?.id ?? 'missing');
    expect(entries[2]).toEqual(first);
  });

  it('is undoable: restoring the pre-restore snapshot returns the file to its state before the restore', async () => {
    const { historyLog, post, put, scope } = await setup();
    await put(scope, { output: 'first' });
    await put(scope, { output: 'second' });
    const [, first] = await historyLog.list(scope);
    await post(`/api/config/restore/${first?.id ?? ''}`);
    const snapshot = (await historyLog.list(scope)).find((entry) => entry.content === '{\n  "output": "second"\n}\n' && entry.summary.includes('before restore'));

    expect((await post(`/api/config/restore/${snapshot?.id ?? ''}`)).status).toBe(200);

    expect(readFileSync(projectFile(), 'utf8')).toBe('{\n  "output": "second"\n}\n');
  });

  it('answers 422 entry_not_restorable for a run entry', async () => {
    const { historyLog, post } = await setup();
    const run = await historyLog.record({ exitCode: 0, kind: 'run', output: 'ok', scope: 'global', summary: 'Install' });

    const response = await post(`/api/config/restore/${run.id}`);

    expect(response.status).toBe(422);
    expect(ProblemDetails.parse(await response.json()).type).toBe('entry_not_restorable');
  });

  it('answers 404 for an unknown entry, on preview and confirm', async () => {
    const { post } = await setup();

    expect([(await post('/api/config/restore/nope/preview')).status, (await post('/api/config/restore/nope')).status]).toEqual([404, 404]);
  });

  it('answers 422 with issues for stored content that is no longer a valid config, file untouched', async () => {
    const { historyLog, post, put, scope } = await setup();
    await put(scope, { output: 'kept' });
    const broken = await historyLog.record({ content: '{"commitWork":"yes"}', kind: 'config_write', scope, summary: 'old' });

    const response = await post(`/api/config/restore/${broken.id}`);

    expect(response.status).toBe(422);
    const body = ProblemDetails.parse(await response.json());
    expect(body.issues?.map((issue) => issue.path)).toEqual(['commitWork']);
    expect(readFileSync(projectFile(), 'utf8')).toBe('{\n  "output": "kept"\n}\n');
    expect(await historyLog.list(scope)).toHaveLength(2);
  });

  it('requires the bearer token', async () => {
    const { post } = await setup();

    expect((await post('/api/config/restore/nope', { headers: { authorization: '' } })).status).toBe(401);
  });
});

describe('PUT /api/config/project:<id> baseline', () => {
  it('keeps a project value equal to the built-in default when it overrides a non-default global value', async () => {
    const { put, scope } = await setup();
    await put('global', { limits: { 'review.iterations': 5 } });

    expect((await put(scope, { limits: { 'review.iterations': 3 } })).status).toBe(200);

    expect(JSON.parse(readFileSync(projectFile(), 'utf8'))).toEqual({ limits: { 'review.iterations': 3 } });
  });
});
