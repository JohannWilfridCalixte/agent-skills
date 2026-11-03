import type { CliEvent } from './types.js';

import { describe, expect, it } from 'vitest';

import { err, ok } from '@agentic/kernel-result';

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
  const runner = createCommandRunner(
    createFakeCliExec([
      { args: ['ok'], cli: 'git', result: fakeOutput('done\n') },
      { args: ['bad'], cli: 'git', lines: [{ line: 'nope', type: 'stderr' }], result: fakeCliError('git', 'failed', { exitCode: 2, stderrTail: 'nope' }) },
      { args: ['slow'], cli: 'git', result: fakeCliError('git', 'timeout') },
    ]),
  );

  const drain = async (args: readonly string[]) => {
    const stream = runner.stream({ args, cli: 'git' });
    const lines = [];
    for await (const line of stream.lines) lines.push(line);
    return { lines, result: await stream.result };
  };

  it('streams lines without the exit event and maps exit 0 to an outcome', async () => {
    expect(await drain(['ok'])).toEqual({ lines: [{ line: 'done', type: 'stdout' }], result: ok({ exitCode: 0 }) });
  });

  it('maps a nonzero exit to an outcome carrying the code, not an error', async () => {
    expect((await drain(['bad'])).result).toEqual(ok({ exitCode: 2 }));
  });

  it('maps other typed errors onto CommandError', async () => {
    expect((await drain(['slow'])).result).toEqual(err({ exitCode: null, message: 'git timeout', type: 'timeout' }));
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
