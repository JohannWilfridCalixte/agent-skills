import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { EffectiveConfigResponse, RawConfigResponse } from '@agentic/contract-http/config';
import { ProblemDetails } from '@agentic/contract-http/problem';

import { createTestApp } from '../../platform/testing/test-app.js';

let root = '';
let homeDir = '';
let projectDir = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentic-config-'));
  homeDir = join(root, 'home');
  projectDir = join(root, 'app');
  mkdirSync(homeDir);
  mkdirSync(projectDir);
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

async function expectProblem(response: Response, status: number, type: string) {
  expect(response.status).toBe(status);
  const body = ProblemDetails.parse(await response.json());
  expect(body.type).toBe(type);
  return body;
}

async function setup({ global, project }: { readonly global?: string; readonly project?: string } = {}) {
  if (global !== undefined) writeFileSync(join(homeDir, 'config.json'), global);
  if (project !== undefined) writeFileSync(join(projectDir, '.agentic.json'), project);
  const app = await createTestApp({ homeDir });
  const added = await app.request('/api/projects', {
    body: JSON.stringify({ path: projectDir }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  const { id } = z.object({ id: z.string() }).parse(await added.json());
  return { ...app, scope: `project:${id}` };
}

describe('GET /api/config/:scope/effective (AC3)', () => {
  it('merges global under the project file and reports each origin', async () => {
    const { request, scope } = await setup({
      global: JSON.stringify({
        limits: { 'babysit.rounds': 9 },
        output: 'g-out',
        reviewers: ['a', 'b'],
        steps: { claude: { implement: { effort: 'high', model: 'opus' } } },
      }),
      project: JSON.stringify({ limits: { 'review.iterations': 1 }, review: { fix: true }, reviewers: ['c'], steps: { claude: { implement: { model: 'sonnet' } } } }),
    });

    const response = await request(`/api/config/${scope}/effective`);

    expect(response.status).toBe(200);
    const body = EffectiveConfigResponse.parse(await response.json());
    expect(body.scope).toBe(scope);
    expect(body.config.output).toEqual({ origin: 'global', value: 'g-out' });
    expect(body.config.commitWork).toEqual({ origin: 'default', value: false });
    expect(body.config.reviewers).toEqual({ origin: 'project', value: ['c'] });
    expect(body.config.limits['review.iterations']).toEqual({ origin: 'project', value: 1 });
    expect(body.config.limits['babysit.rounds']).toEqual({ origin: 'global', value: 9 });
    expect(body.config.limits['implement.retries']).toEqual({ origin: 'default', value: 2 });
    expect(body.config.steps['claude']?.['implement']).toEqual({ effort: { origin: 'global', value: 'high' }, model: { origin: 'project', value: 'sonnet' } });
    expect(body.unknownKeys).toEqual([{ path: 'review', scope: 'project' }]);
  });

  it('treats missing files as empty: every value is a default', async () => {
    const { request, scope } = await setup();

    const global = EffectiveConfigResponse.parse(await (await request('/api/config/global/effective')).json());
    const project = EffectiveConfigResponse.parse(await (await request(`/api/config/${scope}/effective`)).json());

    expect(global.config.output).toEqual({ origin: 'default', value: '.agentic/work' });
    expect(project.config.knowledge.root).toEqual({ origin: 'default', value: 'docs' });
  });
});

describe('GET /api/config/:scope', () => {
  it('returns the file text, parsed object and flagged unknown keys', async () => {
    const text = '{\n  "output": "x",\n  "review": { "fix": true }\n}\n';
    const { request } = await setup({ global: text });

    const body = RawConfigResponse.parse(await (await request('/api/config/global')).json());

    expect(body).toEqual({ config: { output: 'x', review: { fix: true } }, exists: true, scope: 'global', text, unknownKeys: ['review'] });
  });

  it('reports a missing project file as not existing', async () => {
    const { request, scope } = await setup();

    const body = RawConfigResponse.parse(await (await request(`/api/config/${scope}`)).json());

    expect(body).toEqual({ config: {}, exists: false, scope, text: null, unknownKeys: [] });
  });

  it('answers config_unreadable for invalid JSON and for a schema-invalid file', async () => {
    const { request, scope } = await setup({ global: '{oops', project: '{"limits":{"review.iterations":-1}}' });

    await expectProblem(await request('/api/config/global'), 422, 'config_unreadable');
    const schema = await expectProblem(await request(`/api/config/${scope}/effective`), 422, 'config_unreadable');
    expect(schema.issues).toEqual([{ message: 'Expected a non-negative number', path: 'limits.review.iterations' }]);
  });

  it('rejects unknown projects and scopes that are not global or project:<id>', async () => {
    const { request } = await setup();

    await expectProblem(await request('/api/config/project:unknown'), 404, 'project_not_found');
    await expectProblem(await request(`/api/config/${encodeURIComponent('/etc/passwd')}/effective`), 422, 'invalid_scope');
  });
});
