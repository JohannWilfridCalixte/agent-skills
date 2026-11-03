import type { CliEvent } from './types.js';

import { describe, expect, it } from 'vitest';

import { createCommandRunner } from './command-runner.js';
import { redactArgs } from './redact.js';
import { createFakeCliExec, fakeCliError, fakeOutput } from './testing.js';

describe('createFakeCliExec', () => {
  it('answers scripted commands, records calls and streams scripted lines', async () => {
    const fake = createFakeCliExec([{ args: ['--version'], cli: 'codex', result: fakeOutput('codex 1.0\n') }]);
    const handle = fake.stream({ args: ['--version'], cli: 'codex' });
    const events: CliEvent[] = [];
    for await (const event of handle.events) events.push(event);

    expect(events).toEqual([{ line: 'codex 1.0', type: 'stdout' }, { durationMs: 1, exitCode: 0, type: 'exit' }]);
    expect(await fake.run({ args: ['--version'], cli: 'codex' })).toEqual(fakeOutput('codex 1.0\n'));
    expect(fake.calls).toHaveLength(2);
  });

  it('fails loudly on an unscripted command', () => {
    expect(() => createFakeCliExec().run({ args: ['status'], cli: 'git' })).toThrow('Unscripted CLI command: git status');
  });
});

describe('createCommandRunner', () => {
  it('maps outcomes and typed errors onto the CommandRunner port', async () => {
    const runner = createCommandRunner(
      createFakeCliExec([
        { args: ['ok'], cli: 'git', result: fakeOutput('done') },
        { args: ['bad'], cli: 'git', result: fakeCliError('git', 'failed', { exitCode: 2, stderrTail: 'nope' }) },
      ]),
    );

    expect(await runner.run({ args: ['ok'], executable: 'git' })).toEqual({ exitCode: 0, output: 'done' });
    expect(await runner.run({ args: ['bad'], executable: 'git' })).toEqual({ exitCode: 2, output: 'nope\ngit failed' });
    expect(await runner.run({ args: [], executable: 'rm' })).toMatchObject({ exitCode: -1 });
  });
});

describe('redactArgs', () => {
  it('hides secret flag values, secret-looking tokens and URL credentials', () => {
    expect(redactArgs(['--api-key', 'abc', '--token=xyz', `ghp_${'a'.repeat(30)}`, 'https://user:pw@host/repo', 'status'])).toEqual([
      '--api-key',
      '[REDACTED]',
      '--token=[REDACTED]',
      '[REDACTED]',
      'https://[REDACTED]@host/repo',
      'status',
    ]);
  });
});
