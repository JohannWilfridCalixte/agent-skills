import { describe, expect, it } from 'vitest';

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
  it('records the command and returns the scripted outcome', async () => {
    const runner = new FakeCommandRunner({ exitCode: 2, output: 'boom' });

    expect(await runner.run({ args: ['--version'], executable: 'claude' })).toEqual({ exitCode: 2, output: 'boom' });
    expect(runner.commands).toEqual([{ args: ['--version'], executable: 'claude' }]);
  });
});
