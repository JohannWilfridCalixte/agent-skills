import type { RunEvent, RunService, RunSpec } from '@agentic/domain-shared';

import { describe, expect, it } from 'vitest';

import { FakeCommandRunner, InMemoryHistoryLog } from '@agentic/domain-shared/testing';
import { err, ok } from '@agentic/kernel-result';

import { createRunService, parseRunSpec } from './index.js';

const SPEC: RunSpec = { args: ['plugin', 'install', 'agentic'], cli: 'claude', scope: 'global', summary: 'Install claude plugin' };

async function collect(service: RunService, id: string) {
  const subscription = service.subscribe(id);
  if (!subscription.ok) throw new Error(subscription.error.type);
  const events: RunEvent[] = [];
  for await (const event of subscription.value) events.push(event);
  return events;
}

function setup(runner = new FakeCommandRunner(), { maxFinishedRuns = 100 } = {}) {
  let sequence = 0;
  const history = new InMemoryHistoryLog();
  const service = createRunService({
    history,
    maxFinishedRuns,
    newId: () => `run-${String(++sequence)}`,
    now: () => '2026-11-03T10:00:00.000Z',
    runner,
  });
  return { history, runner, service };
}

const started = (service: RunService, spec: RunSpec = SPEC) => {
  const result = service.start(spec);
  if (!result.ok) throw new Error(result.error.issues.join(', '));
  return result.value;
};

describe('RunSpec validation (AC26)', () => {
  it('accepts a closed spec', () => {
    expect(parseRunSpec(SPEC)).toEqual(ok(SPEC));
  });

  it('rejects an unknown cli', () => {
    const result = parseRunSpec({ ...SPEC, cli: 'rm' });

    expect(result.ok).toBe(false);
  });

  it('rejects a non-string arg', () => {
    const result = parseRunSpec({ ...SPEC, args: ['install', 42] });

    expect(result.ok).toBe(false);
  });

  it('starts nothing for an invalid spec', () => {
    const { runner, service } = setup();

    const result = service.start({ ...SPEC, cli: 'sh' } as unknown as RunSpec);

    expect(result).toMatchObject(err({ type: 'invalid_run_spec' }));
    expect(runner.commands).toEqual([]);
  });
});

describe('run lifecycle (AC14)', () => {
  it('streams lines, then exit and final status, and records history once', async () => {
    const { history, service } = setup(new FakeCommandRunner({ lines: [{ line: 'installing', type: 'stdout' }, { line: 'warn', type: 'stderr' }], result: ok({ exitCode: 0 }) }));

    const run = started(service);
    const events = await collect(service, run.id);

    expect(events).toEqual([
      { line: 'installing', type: 'stdout' },
      { line: 'warn', type: 'stderr' },
      { exitCode: 0, type: 'exit' },
      { status: 'succeeded', type: 'status' },
    ]);
    expect(history.entries).toMatchObject([{ exitCode: 0, kind: 'run', outputTail: 'installing\nwarn', scope: 'global', summary: 'Install claude plugin' }]);
  });

  it('passes the spec to the runner as a typed command', () => {
    const { runner, service } = setup();

    started(service, { ...SPEC, cwd: '/work/app' });

    expect(runner.commands).toEqual([{ args: ['plugin', 'install', 'agentic'], cli: 'claude', cwd: '/work/app' }]);
  });

  it('keeps running with no subscriber and replays everything to a late one', async () => {
    const { history, runner, service } = setup(new FakeCommandRunner({ hold: true }));
    const run = started(service);

    runner.streams[0]?.emit({ line: 'one', type: 'stdout' });
    runner.streams[0]?.finish(ok({ exitCode: 0 }));
    const events = await collect(service, run.id);

    expect(events.map((event) => event.type)).toEqual(['stdout', 'exit', 'status']);
    expect(history.entries).toHaveLength(1);
  });

  it('reports status and buffered output through get', async () => {
    const { service } = setup(new FakeCommandRunner({ lines: [{ line: 'done', type: 'stdout' }] }));
    const run = started(service);
    await collect(service, run.id);

    expect(service.get(run.id)).toEqual(ok({ exitCode: 0, finishedAt: '2026-11-03T10:00:00.000Z', id: run.id, output: ['done'], startedAt: '2026-11-03T10:00:00.000Z', status: 'succeeded' }));
  });

  it('answers run_not_found for an unknown id', () => {
    const { service } = setup();

    expect(service.get('nope')).toEqual(err({ id: 'nope', type: 'run_not_found' }));
    expect(service.subscribe('nope')).toEqual(err({ id: 'nope', type: 'run_not_found' }));
  });
});

describe('failed runs (AC15)', () => {
  it('marks a nonzero exit failed with its code and output, without retrying', async () => {
    const { history, runner, service } = setup(new FakeCommandRunner({ lines: [{ line: 'boom', type: 'stderr' }], result: ok({ exitCode: 3 }) }));

    const run = started(service);
    const events = await collect(service, run.id);

    expect(events.at(-1)).toEqual({ status: 'failed', type: 'status' });
    expect(service.get(run.id)).toMatchObject(ok({ exitCode: 3, output: ['boom'], status: 'failed' }));
    expect(history.entries).toMatchObject([{ exitCode: 3, outputTail: 'boom' }]);
    expect(runner.commands).toHaveLength(1);
  });

  it('records a spawn failure as failed with exit code -1 and the message', async () => {
    const { history, service } = setup(new FakeCommandRunner({ result: err({ exitCode: null, message: 'claude not found', type: 'not_found' }) }));

    const run = started(service);
    const events = await collect(service, run.id);

    expect(events).toEqual([{ line: 'claude not found', type: 'stderr' }, { status: 'failed', type: 'status' }]);
    expect(history.entries).toMatchObject([{ exitCode: -1, outputTail: 'claude not found' }]);
  });
});

describe('cancel', () => {
  it('cancels a running run and records it once', async () => {
    const { history, runner, service } = setup(new FakeCommandRunner({ hold: true }));
    const run = started(service);

    const cancelled = service.cancel(run.id);
    const events = await collect(service, run.id);

    expect(cancelled.ok).toBe(true);
    expect(runner.streams[0]?.cancelled).toBe(true);
    expect(events.at(-1)).toEqual({ status: 'cancelled', type: 'status' });
    expect(history.entries).toHaveLength(1);
  });

  it('refuses to cancel a finished run', async () => {
    const { service } = setup();
    const run = started(service);
    await collect(service, run.id);

    expect(service.cancel(run.id)).toEqual(err({ id: run.id, status: 'succeeded', type: 'run_not_running' }));
  });
});

describe('retention', () => {
  it('evicts the oldest finished run beyond the limit', async () => {
    const { service } = setup(new FakeCommandRunner(), { maxFinishedRuns: 2 });
    const first = started(service);
    await collect(service, first.id);
    const second = started(service);
    await collect(service, second.id);
    const third = started(service);
    await collect(service, third.id);

    expect(service.get(first.id).ok).toBe(false);
    expect(service.get(second.id).ok).toBe(true);
    expect(service.get(third.id).ok).toBe(true);
  });
});
