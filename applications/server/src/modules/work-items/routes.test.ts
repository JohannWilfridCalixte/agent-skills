import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { ProblemDetails } from '@agentic/contract-http/problem';
import { WorkItemDetail, WorkItemDoc, WorkItemList } from '@agentic/contract-http/work-items';

import { createTestApp } from '../../platform/testing/test-app.js';

let root = '';
let homeDir = '';
let projectDir = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentic-work-items-'));
  homeDir = join(root, 'home');
  projectDir = join(root, 'app');
  mkdirSync(homeDir);
  mkdirSync(projectDir);
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

function writeFile(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function writeItem(folder: string, files: Readonly<Record<string, string>>) {
  for (const [name, text] of Object.entries(files)) writeFile(join(folder, name), text);
}

const state = (fields: Record<string, unknown>) => JSON.stringify({ phase: 'implement', status: 'in_progress', title: 'Item', updated: '2026-11-01T10:00:00Z', work: 'x', ...fields });
const event = (summary: string) => JSON.stringify({ harness: 'claude', run: 'a3f9', step: null, summary, ts: '2026-11-01T10:00:00Z', type: 'progress', work: 'x', workflow: 'implement' });

async function expectProblem(response: Response, status: number, type: string) {
  expect(response.status).toBe(status);
  expect(ProblemDetails.parse(await response.json()).type).toBe(type);
}

async function setup({ projectConfig }: { readonly projectConfig?: string } = {}) {
  if (projectConfig !== undefined) writeFileSync(join(projectDir, '.agentic.json'), projectConfig);
  const app = await createTestApp({ homeDir });
  const added = await app.request('/api/projects', { body: JSON.stringify({ path: projectDir }), headers: { 'content-type': 'application/json' }, method: 'POST' });
  const { id } = z.object({ id: z.string() }).parse(await added.json());
  return { ...app, base: `/api/projects/${id}/work-items` };
}

describe('GET /api/projects/:projectId/work-items (AC18, AC20)', () => {
  it('lists active and _archive items under the default output with their status, newest first', async () => {
    const output = join(projectDir, '.agentic/work');
    writeItem(join(output, '20261103-export'), { 'state.json': state({ status: 'in_progress', title: 'Export', updated: '2026-11-03T09:00:00Z' }) });
    writeItem(join(output, '_archive', '20261020-login'), { 'state.json': state({ phase: 'cleanup', status: 'completed', title: 'Login', updated: '2026-10-25T00:00:00Z' }) });
    const { base, request } = await setup();

    const response = await request(base);

    expect(response.status).toBe(200);
    expect(WorkItemList.parse(await response.json()).items).toEqual([
      { archived: false, slug: '20261103-export', state: { phase: 'implement', readable: true, status: 'in_progress', title: 'Export', updated: '2026-11-03T09:00:00Z' } },
      { archived: true, slug: '20261020-login', state: { phase: 'cleanup', readable: true, status: 'completed', title: 'Login', updated: '2026-10-25T00:00:00Z' } },
    ]);
  });

  it('reads the output folder from the effective config', async () => {
    writeItem(join(projectDir, 'custom-out', '20261103-x'), { 'state.json': state({}) });
    const { base, request } = await setup({ projectConfig: JSON.stringify({ output: 'custom-out' }) });

    const list = WorkItemList.parse(await (await request(base)).json());

    expect(list.items.map((item) => item.slug)).toEqual(['20261103-x']);
  });

  it('answers an empty list when the output folder is missing', async () => {
    const { base, request } = await setup();

    const response = await request(base);

    expect(response.status).toBe(200);
    expect(WorkItemList.parse(await response.json())).toEqual({ items: [] });
  });

  it('lists an item with malformed state.json as unreadable while the others still render', async () => {
    const output = join(projectDir, '.agentic/work');
    writeItem(join(output, '20261103-good'), { 'state.json': state({ updated: '2026-11-03T00:00:00Z' }) });
    writeItem(join(output, '20261102-broken'), { 'state.json': '{"status": "in_prog' });

    const { base, request } = await setup();
    const list = WorkItemList.parse(await (await request(base)).json());

    expect(list.items.map((item) => [item.slug, item.state])).toEqual([
      ['20261103-good', { phase: 'implement', readable: true, status: 'in_progress', title: 'Item', updated: '2026-11-03T00:00:00Z' }],
      ['20261102-broken', { readable: false, reason: 'invalid_json' }],
    ]);
  });

  it('does not list an item folder that is a symlink pointing outside the output folder', async () => {
    const output = join(projectDir, '.agentic/work');
    writeItem(join(root, 'outside', '20261103-secret'), { 'state.json': state({}) });
    mkdirSync(output, { recursive: true });
    symlinkSync(join(root, 'outside', '20261103-secret'), join(output, '20261103-secret'));
    const { base, request } = await setup();

    const list = WorkItemList.parse(await (await request(base)).json());

    expect(list.items).toEqual([]);
  });

  it('answers 404 for an unknown project', async () => {
    const { request } = await setup();

    await expectProblem(await request('/api/projects/unknown/work-items'), 404, 'project_not_found');
  });
});

describe('GET /api/projects/:projectId/work-items/:slug (AC19)', () => {
  it('returns the events timeline and the docs present', async () => {
    writeItem(join(projectDir, '.agentic/work', '20261103-export'), {
      'decisions.md': '# Decisions',
      'events.jsonl': `${event('started')}\n{broken\n${event('done')}\n`,
      'plan.md': '# Plan',
      'reviews/1-code-review.md': '# Review',
      'spec.md': '# Spec',
      'state.json': state({}),
    });
    const { base, request } = await setup();

    const response = await request(`${base}/20261103-export`);

    expect(response.status).toBe(200);
    const detail = WorkItemDetail.parse(await response.json());
    expect(detail.docs).toEqual(['decisions', 'plan', 'reviews/1-code-review.md', 'spec']);
    expect(detail.timeline.events.map((entry) => entry['summary'])).toEqual(['started', 'done']);
    expect(detail.timeline).toMatchObject({ malformed: 1, truncated: false });
  });

  it('tail-truncates events over the cap and sets the flag', async () => {
    const lines = Array.from({ length: 1005 }, (_, index) => event(`e${String(index)}`));
    writeItem(join(projectDir, '.agentic/work', '20261103-busy'), { 'events.jsonl': `${lines.join('\n')}\n` });
    const { base, request } = await setup();

    const detail = WorkItemDetail.parse(await (await request(`${base}/20261103-busy`)).json());

    expect(detail.timeline.truncated).toBe(true);
    expect(detail.timeline.events).toHaveLength(1000);
    expect(detail.timeline.events[0]?.['summary']).toBe('e5');
  });

  it('reads at most the last 5 MB of events', async () => {
    const big = JSON.stringify({ padding: 'x'.repeat(5 * 1024 * 1024), type: 'note' });
    writeItem(join(projectDir, '.agentic/work', '20261103-big'), { 'events.jsonl': `${big}\n${event('last')}\n` });
    const { base, request } = await setup();

    const detail = WorkItemDetail.parse(await (await request(`${base}/20261103-big`)).json());

    expect(detail.timeline).toEqual({ events: [JSON.parse(event('last'))], malformed: 0, truncated: true });
  });

  it.each(['a..b', '..%2F..%2Fetc', '.hidden'])('rejects slug %s with 422', async (slug) => {
    const { base, request } = await setup();

    await expectProblem(await request(`${base}/${slug}`), 422, 'invalid_slug');
  });

  it('answers 404 for a missing item', async () => {
    const { base, request } = await setup();

    await expectProblem(await request(`${base}/20261103-nope`), 404, 'work_item_not_found');
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('has no %s endpoint', async (method) => {
    writeItem(join(projectDir, '.agentic/work', '20261103-export'), { 'state.json': state({}) });
    const { base, request } = await setup();

    for (const path of [base, `${base}/20261103-export`, `${base}/20261103-export/docs/spec`]) {
      const response = await request(path, { body: '{}', headers: { 'content-type': 'application/json' }, method });
      expect([404, 405]).toContain(response.status);
    }
  });
});

describe('GET /api/projects/:projectId/work-items/:slug/docs/:name (AC19, AC20)', () => {
  it('returns a doc read-only', async () => {
    writeItem(join(projectDir, '.agentic/work', '20261103-export'), { 'spec.md': '# Spec\n' });
    const { base, request } = await setup();

    const response = await request(`${base}/20261103-export/docs/spec`);

    expect(response.status).toBe(200);
    expect(WorkItemDoc.parse(await response.json())).toEqual({ name: 'spec', text: '# Spec\n', truncated: false });
  });

  it('returns a review file from an archived item', async () => {
    writeItem(join(projectDir, '.agentic/work', '_archive', '20261001-old'), { 'reviews/2-fix.md': 'fix list' });
    const { base, request } = await setup();

    const doc = WorkItemDoc.parse(await (await request(`${base}/20261001-old/docs/reviews%2F2-fix.md`)).json());

    expect(doc.text).toBe('fix list');
  });

  it('caps a doc at 1 MB', async () => {
    writeItem(join(projectDir, '.agentic/work', '20261103-export'), { 'plan.md': 'a'.repeat(1024 * 1024 + 10) });
    const { base, request } = await setup();

    const doc = WorkItemDoc.parse(await (await request(`${base}/20261103-export/docs/plan`)).json());

    expect(doc.truncated).toBe(true);
    expect(doc.text).toHaveLength(1024 * 1024);
  });

  it.each(['reviews%2F..md', 'reviews%2F..%2F..%2Fstate.json', 'state.json', 'notes'])('rejects doc name %s with 422', async (name) => {
    writeItem(join(projectDir, '.agentic/work', '20261103-export'), { 'spec.md': '# Spec' });
    const { base, request } = await setup();

    await expectProblem(await request(`${base}/20261103-export/docs/${name}`), 422, 'invalid_doc_name');
  });

  it('answers 404 for a doc the item does not have', async () => {
    writeItem(join(projectDir, '.agentic/work', '20261103-export'), { 'spec.md': '# Spec' });
    const { base, request } = await setup();

    await expectProblem(await request(`${base}/20261103-export/docs/plan`), 404, 'doc_not_found');
  });

  it('refuses a doc that is a symlink pointing outside the output folder', async () => {
    writeFile(join(root, 'secret.md'), 'secret');
    const item = join(projectDir, '.agentic/work', '20261103-export');
    writeItem(item, { 'state.json': state({}) });
    symlinkSync(join(root, 'secret.md'), join(item, 'spec.md'));
    const { base, request } = await setup();

    await expectProblem(await request(`${base}/20261103-export/docs/spec`), 404, 'doc_not_found');
  });
});
