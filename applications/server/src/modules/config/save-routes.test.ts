import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { ConfigPreviewResponse, ConfigSaveResponse, EffectiveConfigResponse, RawConfigResponse } from '@agentic/contract-http/config';
import { ProblemDetails } from '@agentic/contract-http/problem';

import { createTestApp } from '../../platform/testing/test-app.js';

let root = '';
let homeDir = '';
let projectDir = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentic-config-save-'));
  homeDir = join(root, 'home');
  projectDir = join(root, 'app');
  mkdirSync(projectDir);
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const projectFile = () => join(projectDir, '.agentic.json');

async function setup(project?: string) {
  if (project !== undefined) writeFileSync(projectFile(), project);
  const app = await createTestApp({ homeDir });
  const added = await app.request('/api/projects', { body: JSON.stringify({ path: projectDir }), headers: { 'content-type': 'application/json' }, method: 'POST' });
  const { id } = z.object({ id: z.string() }).parse(await added.json());
  const send = (method: 'POST' | 'PUT', path: string, body: unknown) =>
    app.request(path, { body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, method });
  return { ...app, scope: `project:${id}`, send };
}

describe('POST /api/config/:scope/preview (AC4)', () => {
  it('returns the diff against the file on disk and writes nothing', async () => {
    const { historyLog, scope, send } = await setup('{"output":"old"}');

    const response = await send('POST', `/api/config/${scope}/preview`, { output: 'new' });

    expect(response.status).toBe(200);
    const body = ConfigPreviewResponse.parse(await response.json());
    expect(body.diff.filter((line) => line.kind !== 'context').map((line) => `${line.kind} ${line.text}`)).toEqual([
      'removed {"output":"old"}',
      'added {',
      'added   "output": "new"',
      'added }',
    ]);
    expect(readFileSync(projectFile(), 'utf8')).toBe('{"output":"old"}');
    expect(await historyLog.list(scope)).toEqual([]);
  });

  it('reports issues and unknown keys without blocking the preview', async () => {
    const { scope, send } = await setup();

    const body = ConfigPreviewResponse.parse(await (await send('POST', `/api/config/${scope}/preview`, { commitWork: 'yes' })).json());

    expect(body).toMatchObject({ diff: [], issues: [{ path: 'commitWork' }], proposedText: null });
  });

  it('rejects a body that is not an object', async () => {
    const { scope, send } = await setup();

    expect((await send('POST', `/api/config/${scope}/preview`, [1])).status).toBe(422);
  });
});

describe('PUT /api/config/:scope', () => {
  it('writes only non-default values as 2-space JSON with a trailing newline, atomically, keeping the mode (AC5)', async () => {
    const { request, scope, send } = await setup('{}');
    chmodSync(projectFile(), 0o600);

    const response = await send('PUT', `/api/config/${scope}`, { commitWork: true, limits: { 'babysit.rounds': 5, 'review.iterations': 1 }, output: '.agentic/work' });

    expect(response.status).toBe(200);
    expect(ConfigSaveResponse.parse(await response.json())).toMatchObject({ changed: true, scope });
    expect(readFileSync(projectFile(), 'utf8')).toBe('{\n  "commitWork": true,\n  "limits": {\n    "review.iterations": 1\n  }\n}\n');
    expect(statSync(projectFile()).mode & 0o777).toBe(0o600);
    expect(readdirSync(projectDir)).toEqual(['.agentic.json']);

    const raw = RawConfigResponse.parse(await (await request(`/api/config/${scope}`)).json());
    const view = EffectiveConfigResponse.parse(await (await request(`/api/config/${scope}/effective`)).json());
    expect(raw.config).toEqual({ commitWork: true, limits: { 'review.iterations': 1 } });
    expect([view.config.commitWork, view.config.limits['review.iterations'], view.config.output]).toEqual([
      { origin: 'project', value: true },
      { origin: 'project', value: 1 },
      { origin: 'default', value: '.agentic/work' },
    ]);
  });

  it('creates the global file with mode 0644, creating its directory', async () => {
    const { send } = await setup();

    expect((await send('PUT', '/api/config/global', { worktrees: '../wt' })).status).toBe(200);

    const file = join(homeDir, 'config.json');
    expect(readFileSync(file, 'utf8')).toBe('{\n  "worktrees": "../wt"\n}\n');
    expect(statSync(file).mode & 0o777).toBe(0o644);
  });

  it('never creates a missing project directory', async () => {
    const { scope, send } = await setup();
    rmSync(projectDir, { recursive: true });

    const response = await send('PUT', `/api/config/${scope}`, { output: 'x' });

    expect(response.status).toBe(409);
    expect(ProblemDetails.parse(await response.json())).toMatchObject({ detail: expect.stringContaining('remove the project'), type: 'config_location_missing' });
    expect(existsSync(projectDir)).toBe(false);
  });

  it('answers a problem with a next step when the project file cannot be read', async () => {
    const { request, scope } = await setup('{}');
    chmodSync(projectFile(), 0o000);

    const response = await request(`/api/config/${scope}`);

    expect(response.status).toBe(422);
    expect(ProblemDetails.parse(await response.json())).toMatchObject({ detail: expect.stringContaining('permissions'), type: 'config_io_failed' });
  });

  it('keeps unknown keys untouched and reports them (AC6)', async () => {
    const { scope, send } = await setup('{"review":{"fix":true}}');

    const body = ConfigSaveResponse.parse(await (await send('PUT', `/api/config/${scope}`, { output: 'o', review: { fix: true } })).json());

    expect(body.unknownKeys).toEqual(['review']);
    expect(JSON.parse(readFileSync(projectFile(), 'utf8'))).toEqual({ output: 'o', review: { fix: true } });
  });

  it('blocks a wrong type, unknown harness or negative limit with field-level problems, file untouched (AC7)', async () => {
    const { historyLog, scope, send } = await setup('{"output":"kept"}');

    const response = await send('PUT', `/api/config/${scope}`, { limits: { 'review.iterations': -2 }, steps: { vim: {} }, worktrees: 3 });

    expect(response.status).toBe(422);
    const body = ProblemDetails.parse(await response.json());
    expect(body.type).toBe('config_invalid');
    expect(body.issues?.map((issue) => issue.path)).toEqual(['limits.review.iterations', 'steps.vim', 'worktrees']);
    expect(readFileSync(projectFile(), 'utf8')).toBe('{"output":"kept"}');
    expect(await historyLog.list(scope)).toEqual([]);
  });

  it('overwrites a file changed since load after snapshotting it, then records the new content (AC16)', async () => {
    const { historyLog, request, scope, send } = await setup('{"output":"loaded"}');
    await request(`/api/config/${scope}`);
    writeFileSync(projectFile(), '{"output":"changed on disk"}');

    expect((await send('PUT', `/api/config/${scope}`, { output: 'mine' })).status).toBe(200);

    expect(readFileSync(projectFile(), 'utf8')).toBe('{\n  "output": "mine"\n}\n');
    const entries = await historyLog.list(scope);
    expect(entries.map(({ content, kind }) => ({ content, kind }))).toEqual([
      { content: '{\n  "output": "mine"\n}\n', kind: 'config_write' },
      { content: '{"output":"changed on disk"}', kind: 'config_write' },
    ]);
  });

  it('answers 404 for an unknown project', async () => {
    const { send } = await setup();

    expect((await send('PUT', '/api/config/project:nope', {})).status).toBe(404);
  });
});
