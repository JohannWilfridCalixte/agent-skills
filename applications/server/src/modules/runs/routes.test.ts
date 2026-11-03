import { describe, expect, it } from 'bun:test';

import { ProblemDetails } from '@agentic/contract-http/problem';
import { RunDetail, RunEvent, RunSummary } from '@agentic/contract-http/runs';
import { FakeCommandRunner } from '@agentic/domain-shared/testing';
import { err, ok } from '@agentic/kernel-result';

import { createTestApp, TEST_RUN_SPEC } from '../../platform/testing/test-app.js';

type Request = Awaited<ReturnType<typeof createTestApp>>['request'];

/** Parses an SSE body into `{event, data}` frames; reads until the server closes the stream. */
async function readEvents(response: Response) {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((frame) => frame.trim() !== '')
    .map((frame) => {
      const fields = Object.fromEntries(frame.split('\n').map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()]));
      return { data: RunEvent.parse(JSON.parse(String(fields['data']))), event: fields['event'] };
    });
}

async function startRun(request: Request, body?: unknown) {
  const response = await request('/api/test-runs', { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) });
  return { response, run: response.status === 201 ? RunSummary.parse(await response.json()) : undefined };
}

async function waitForStatus(request: Request, id: string, status: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const detail = RunDetail.parse(await (await request(`/api/runs/${id}`)).json());
    if (detail.status === status) return detail;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`run ${id} never reached ${status}`);
}

describe('runs SSE (AC14)', () => {
  it('streams output lines, then exit and the final status, then closes', async () => {
    const runner = new FakeCommandRunner({ lines: [{ line: 'installing', type: 'stdout' }, { line: 'warning', type: 'stderr' }], result: ok({ exitCode: 0 }) });
    const { request } = await createTestApp({ commandRunner: runner });
    const { run } = await startRun(request);

    const response = await request(`/api/runs/${String(run?.id)}/events`);

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(await readEvents(response)).toEqual([
      { data: { line: 'installing', type: 'stdout' }, event: 'stdout' },
      { data: { line: 'warning', type: 'stderr' }, event: 'stderr' },
      { data: { exitCode: 0, type: 'exit' }, event: 'exit' },
      { data: { status: 'succeeded', type: 'status' }, event: 'status' },
    ]);
  });

  it('keeps running after the client disconnects and records the outcome in history once', async () => {
    const runner = new FakeCommandRunner({ hold: true });
    const { historyLog, request } = await createTestApp({ commandRunner: runner });
    const { run } = await startRun(request);
    const id = String(run?.id);
    runner.streams[0]?.emit({ line: 'first', type: 'stdout' });
    const response = await request(`/api/runs/${id}/events`);
    const reader = response.body?.getReader();
    await reader?.read();

    await reader?.cancel();
    runner.streams[0]?.emit({ line: 'after disconnect', type: 'stdout' });
    runner.streams[0]?.finish(ok({ exitCode: 0 }));
    const detail = await waitForStatus(request, id, 'succeeded');

    expect(runner.streams[0]?.cancelled).toBe(false);
    expect(detail.output).toEqual(['first', 'after disconnect']);
    expect(await historyLog.list(TEST_RUN_SPEC.scope)).toMatchObject([{ exitCode: 0, kind: 'run', outputTail: 'first\nafter disconnect', summary: TEST_RUN_SPEC.summary }]);
  });

  it('replays every buffered event to a late subscriber', async () => {
    const runner = new FakeCommandRunner({ lines: [{ line: 'done', type: 'stdout' }], result: ok({ exitCode: 0 }) });
    const { request } = await createTestApp({ commandRunner: runner });
    const { run } = await startRun(request);
    await waitForStatus(request, String(run?.id), 'succeeded');

    const events = await readEvents(await request(`/api/runs/${String(run?.id)}/events`));

    expect(events.map((frame) => frame.event)).toEqual(['stdout', 'exit', 'status']);
  });

  it('answers 404 for an unknown run', async () => {
    const { request } = await createTestApp();

    const responses = await Promise.all([request('/api/runs/nope'), request('/api/runs/nope/events')]);

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(ProblemDetails.parse(await response.json()).type).toBe('run_not_found');
    }
  });
});

describe('failed runs (AC15)', () => {
  it('reports a nonzero exit as failed with its code and output, records it, and never retries', async () => {
    const runner = new FakeCommandRunner({ lines: [{ line: 'boom', type: 'stderr' }], result: ok({ exitCode: 2 }) });
    const { historyLog, request } = await createTestApp({ commandRunner: runner });
    const { run } = await startRun(request);

    const detail = await waitForStatus(request, String(run?.id), 'failed');

    expect(detail).toMatchObject({ exitCode: 2, output: ['boom'], status: 'failed' });
    expect(await historyLog.list(TEST_RUN_SPEC.scope)).toMatchObject([{ exitCode: 2, outputTail: 'boom' }]);
    expect(runner.commands).toHaveLength(1);
  });

  it('reports a spawn failure as failed', async () => {
    const runner = new FakeCommandRunner({ result: err({ exitCode: null, message: 'npx not found', type: 'not_found' }) });
    const { request } = await createTestApp({ commandRunner: runner });
    const { run } = await startRun(request);

    const detail = await waitForStatus(request, String(run?.id), 'failed');

    expect(detail.output).toEqual(['npx not found']);
  });
});

describe('RunSpec validation (AC26)', () => {
  it.each([
    ['an unknown cli', { ...TEST_RUN_SPEC, cli: 'sh' }],
    ['a non-string arg', { ...TEST_RUN_SPEC, args: ['install', 1] }],
  ])('rejects %s before anything runs', async (_label, spec) => {
    const runner = new FakeCommandRunner();
    const { request } = await createTestApp({ commandRunner: runner });

    const { response } = await startRun(request, spec);

    expect(response.status).toBe(422);
    expect(ProblemDetails.parse(await response.json()).type).toBe('invalid_run_spec');
    expect(runner.commands).toEqual([]);
  });

  it('exposes no generic endpoint that creates a run from a command', async () => {
    const { request } = await createTestApp();

    const response = await request('/api/runs', { body: JSON.stringify({ args: ['-c', 'id'], cli: 'bash' }), headers: { 'content-type': 'application/json' }, method: 'POST' });

    expect(response.status).toBe(404);
  });
});

describe('POST /api/runs/:id/cancel', () => {
  it('cancels a running run', async () => {
    const runner = new FakeCommandRunner({ hold: true });
    const { request } = await createTestApp({ commandRunner: runner });
    const { run } = await startRun(request);

    const response = await request(`/api/runs/${String(run?.id)}/cancel`, { method: 'POST' });
    const detail = await waitForStatus(request, String(run?.id), 'cancelled');

    expect(response.status).toBe(200);
    expect(runner.streams[0]?.cancelled).toBe(true);
    expect(detail.status).toBe('cancelled');
  });

  it('requires the token', async () => {
    const runner = new FakeCommandRunner({ hold: true });
    const { request } = await createTestApp({ commandRunner: runner });
    const { run } = await startRun(request);

    const response = await request(`/api/runs/${String(run?.id)}/cancel`, { headers: { authorization: '' }, method: 'POST' });

    expect(response.status).toBe(401);
    expect(runner.streams[0]?.cancelled).toBe(false);
  });

  it('answers 409 for a finished run', async () => {
    const { request } = await createTestApp({ commandRunner: new FakeCommandRunner() });
    const { run } = await startRun(request);
    await waitForStatus(request, String(run?.id), 'succeeded');

    const response = await request(`/api/runs/${String(run?.id)}/cancel`, { method: 'POST' });

    expect(response.status).toBe(409);
    expect(ProblemDetails.parse(await response.json()).type).toBe('run_not_running');
  });
});

describe('run log lines (code-review-5)', () => {
  it('logs run_started and one run_finished with the correlation id of the request that started it', async () => {
    const { logLines, request } = await createTestApp({ commandRunner: new FakeCommandRunner({ result: ok({ exitCode: 0 }) }) });
    const response = await request('/api/test-runs', { headers: { 'x-correlation-id': 'corr-run-1' }, method: 'POST' });
    const run = RunSummary.parse(await response.json());
    await waitForStatus(request, run.id, 'succeeded');

    const runLines = logLines.map((text) => JSON.parse(text) as Record<string, unknown>).filter((line) => String(line['message']).startsWith('run_'));
    expect(runLines).toMatchObject([
      { correlation_id: 'corr-run-1', message: 'run_started', run_id: run.id, service_name: 'agentic-server' },
      { correlation_id: 'corr-run-1', exit_code: 0, message: 'run_finished', run_id: run.id, status: 'succeeded' },
    ]);
  });
});

describe('replay cap (super-review-10)', () => {
  it('keeps every line of a long run in history and flags the run detail and replay as truncated', async () => {
    const lines = Array.from({ length: 10_001 }, (_, index) => ({ line: `line-${String(index)}`, type: 'stdout' as const }));
    const { request } = await createTestApp({ commandRunner: new FakeCommandRunner({ lines, result: ok({ exitCode: 0 }) }) });
    const { run } = await startRun(request);
    const id = String(run?.id);
    const detail = await waitForStatus(request, id, 'succeeded');

    const events = await readEvents(await request(`/api/runs/${id}/events`));
    const history = (await (await request('/api/history?scope=global')).json()) as { entries: { id: string }[] };
    const entry = (await (await request(`/api/history/${String(history.entries[0]?.id)}`)).json()) as { outputTail: string; truncated: boolean };

    expect(detail.truncated).toBe(true);
    expect(events[0]).toEqual({ data: { dropped: 1, type: 'dropped' }, event: 'dropped' });
    expect(entry.outputTail.split('\n')).toHaveLength(10_001);
    expect(entry.truncated).toBe(false);
  });
});
