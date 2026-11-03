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
  it('lists entries of the requested scope only', async () => {
    const log = new InMemoryHistoryLog();
    const base = { content: '{}', exitCode: null, kind: 'config', outputTail: null, summary: 'saved', truncated: false } as const;
    const global = await log.record({ ...base, scope: 'global' });
    await log.record({ ...base, scope: 'project:1' });

    expect(await log.list('global')).toEqual([global]);
  });
});

describe('FakeCommandRunner', () => {
  it('records the command and returns the scripted outcome', async () => {
    const runner = new FakeCommandRunner({ exitCode: 2, output: 'boom' });

    expect(await runner.run({ args: ['--version'], executable: 'claude' })).toEqual({ exitCode: 2, output: 'boom' });
    expect(runner.commands).toEqual([{ args: ['--version'], executable: 'claude' }]);
  });
});
