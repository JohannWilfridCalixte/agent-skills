import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { createFakeCliExec, fakeCliError, fakeOutput } from '@agentic/adapter-cli-exec/testing';
import { HarnessesResponse, ModelsResponse } from '@agentic/contract-http/install';
import { ProblemDetails } from '@agentic/contract-http/problem';

import { createTestApp } from '../../platform/testing/test-app.js';

let userHome = '';

beforeEach(() => {
  userHome = mkdtempSync(join(tmpdir(), 'agentic-install-'));
});

afterEach(() => {
  rmSync(userHome, { force: true, recursive: true });
});

const AGENT_MODELS = 'Available models\n\nauto - Auto (default)\ngpt-5.2 - GPT-5.2\n\nTip: use --model <id> to switch.\n';

describe('GET /api/models?harness= (AC9)', () => {
  it('lists the cursor models from `agent models`', async () => {
    const cliExec = createFakeCliExec([{ args: ['models'], cli: 'agent', result: fakeOutput(AGENT_MODELS) }]);
    const { request } = await createTestApp({ cliExec, userHome });

    const response = await request('/api/models?harness=cursor');

    expect(response.status).toBe(200);
    expect(ModelsResponse.parse(await response.json())).toEqual({ available: true, harness: 'cursor', ids: ['auto', 'gpt-5.2'] });
  });

  it('lists the claude aliases', async () => {
    const { request } = await createTestApp({ userHome });

    const response = await request('/api/models?harness=claude');

    expect(ModelsResponse.parse(await response.json())).toEqual({ available: true, harness: 'claude', ids: ['opus', 'sonnet', 'haiku'] });
  });

  it('falls back with a reason when the CLI is missing', async () => {
    const cliExec = createFakeCliExec([{ args: ['debug', 'models'], cli: 'codex', result: fakeCliError('codex', 'not_found', { message: 'codex is not on PATH' }) }]);
    const { request } = await createTestApp({ cliExec, userHome });

    const response = await request('/api/models?harness=codex');

    expect(response.status).toBe(200);
    expect(ModelsResponse.parse(await response.json())).toEqual({ available: false, harness: 'codex', reason: 'codex models unavailable: codex is not on PATH' });
  });

  it('falls back with a reason when the CLI fails', async () => {
    const cliExec = createFakeCliExec([{ args: ['models'], cli: 'agent', result: fakeCliError('agent', 'failed', { message: 'agent exited with code 1' }) }]);
    const { request } = await createTestApp({ cliExec, userHome });

    const body = ModelsResponse.parse(await (await request('/api/models?harness=cursor')).json());

    expect(body).toEqual({ available: false, harness: 'cursor', reason: 'cursor models unavailable: agent exited with code 1' });
  });

  it('answers 422 for an unknown harness', async () => {
    const { request } = await createTestApp({ userHome });

    const response = await request('/api/models?harness=vim');

    expect(response.status).toBe(422);
    expect(ProblemDetails.parse(await response.json()).type).toBe('validation_failed');
  });
});

describe('GET /api/install/harnesses (AC10)', () => {
  it('reports each harness present or absent with a reason', async () => {
    mkdirSync(join(userHome, '.codex'));
    const cliExec = createFakeCliExec([
      { args: ['--version'], cli: 'agent', result: fakeCliError('agent', 'not_found') },
      { args: ['--version'], cli: 'claude', result: fakeOutput('2.1.0 (Claude Code)\n') },
      { args: ['--version'], cli: 'codex', result: fakeCliError('codex', 'not_found') },
    ]);
    const { request } = await createTestApp({ cliExec, userHome });

    const response = await request('/api/install/harnesses');

    expect(response.status).toBe(200);
    const { harnesses } = HarnessesResponse.parse(await response.json());
    expect(harnesses.map(({ harness, present, reason }) => ({ harness, present, reason }))).toEqual([
      { harness: 'cursor', present: false, reason: 'agent CLI not found and ~/.cursor missing' },
      { harness: 'claude', present: true, reason: 'claude CLI found (2.1.0 (Claude Code))' },
      { harness: 'codex', present: true, reason: '~/.codex exists; codex CLI not found' },
    ]);
  });
});
