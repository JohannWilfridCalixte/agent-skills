import { describe, expect, it } from 'vitest';

import { ok } from '@agentic/kernel-result';

import { FakeCommandRunner, InMemoryHistoryLog, InMemoryProjectRegistry } from './testing.js';

describe('InMemoryProjectRegistry', () => {
  it('lists the seeded projects and finds one by id', async () => {
    const registry = new InMemoryProjectRegistry(['/work/app']);
    const [project] = await registry.list();

    expect(project?.path).toBe('/work/app');
    expect(await registry.get('project-1')).toEqual(project);
    expect(await registry.get('project-9')).toBeUndefined();
  });
});

describe('InMemoryHistoryLog', () => {
  it('lists entries of the requested scope only, newest first', async () => {
    const log = new InMemoryHistoryLog();
    const first = await log.record({ content: '{}', kind: 'config_write', scope: 'global', summary: 'saved' });
    await log.record({ content: '{}', kind: 'config_write', scope: 'project:1', summary: 'saved' });
    const run = await log.record({ exitCode: 1, kind: 'run', output: 'boom', scope: 'global', summary: 'install' });

    expect(await log.list('global')).toEqual([run, first]);
    expect(await log.list('global', { limit: 1 })).toEqual([run]);
    expect(run).toMatchObject({ content: null, exitCode: 1, outputTail: 'boom', truncated: false });
  });
});

describe('FakeCommandRunner', () => {
  it('records the command and plays the scripted lines and result', async () => {
    const runner = new FakeCommandRunner({ lines: [{ line: 'boom', type: 'stderr' }], result: ok({ exitCode: 2 }) });

    const stream = runner.stream({ args: ['--version'], cli: 'claude' });
    const lines = [];
    for await (const line of stream.lines) lines.push(line);

    expect(lines).toEqual([{ line: 'boom', type: 'stderr' }]);
    expect(await stream.result).toEqual(ok({ exitCode: 2 }));
    expect(runner.commands).toEqual([{ args: ['--version'], cli: 'claude' }]);
  });

  it('keeps a held stream running until finished', async () => {
    const runner = new FakeCommandRunner({ hold: true });
    const stream = runner.stream({ args: [], cli: 'git' });

    runner.streams[0]?.emit({ line: 'late', type: 'stdout' });
    runner.streams[0]?.finish(ok({ exitCode: 0 }));
    const lines = [];
    for await (const line of stream.lines) lines.push(line.line);

    expect(lines).toEqual(['late']);
  });
});
