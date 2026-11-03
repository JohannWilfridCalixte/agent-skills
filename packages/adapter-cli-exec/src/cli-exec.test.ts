import type { CliCommand, CliEvent } from './types.js';

import { describe, expect, it } from 'vitest';

import { createCliExec } from './cli-exec.js';

const exec = createCliExec();
const bun = (script: string, extra: Partial<CliCommand> = {}): CliCommand => ({ args: ['-e', script], cli: 'bun', ...extra });

async function collect(events: AsyncIterable<CliEvent>) {
  const all: CliEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitUntilDead = async (pid: number) => {
  for (let attempt = 0; attempt < 50 && isAlive(pid); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
  return !isAlive(pid);
};

describe('createCliExec', () => {
  it('streams stdout and stderr lines in order, then the exit event', async () => {
    const handle = exec.stream(bun('console.log("one"); console.log("two"); console.error("warn")'));
    const events = await collect(handle.events);

    expect(events.filter((event) => event.type === 'stdout')).toEqual([
      { line: 'one', type: 'stdout' },
      { line: 'two', type: 'stdout' },
    ]);
    expect(events).toContainEqual({ line: 'warn', type: 'stderr' });
    expect(events.at(-1)).toMatchObject({ exitCode: 0, type: 'exit' });
    expect(await handle.result).toMatchObject({ ok: true, value: { exitCode: 0, stderr: 'warn\n', stdout: 'one\ntwo\n' } });
  });

  it('returns failed with the exit code and stderr tail on nonzero exit', async () => {
    const result = await exec.run(bun('console.error("boom"); process.exit(3)'));

    expect(result).toMatchObject({ error: { cli: 'bun', exitCode: 3, stderrTail: 'boom\n', type: 'failed' }, ok: false });
  });

  it('passes stdin to the process', async () => {
    const result = await exec.run(bun('process.stdout.write(await Bun.stdin.text())', { stdin: 'hello' }));

    expect(result).toMatchObject({ ok: true, value: { stdout: 'hello' } });
  });

  it('kills the whole process tree on timeout', async () => {
    const handle = exec.stream(bun('const c = Bun.spawn(["sleep", "30"]); console.log(c.pid); await c.exited', { timeoutMs: 500 }));
    const events = await collect(handle.events);
    const childPid = Number(events.find((event): event is Extract<CliEvent, { line: string }> => event.type === 'stdout')?.line ?? '');

    expect(await handle.result).toMatchObject({ error: { type: 'timeout' }, ok: false });
    expect(childPid).toBeGreaterThan(0);
    expect(await waitUntilDead(childPid)).toBe(true);
  });

  it('cancels a running process', async () => {
    const handle = exec.stream(bun('console.log("ready"); await Bun.sleep(30000)'));
    for await (const event of handle.events) if (event.type === 'stdout') handle.cancel();

    expect(await handle.result).toMatchObject({ error: { type: 'cancelled' }, ok: false });
  });

  it('stops the process when output exceeds the cap and flags truncation', async () => {
    const result = await exec.run(bun('for (;;) { console.log("x".repeat(1000)); await Bun.sleep(1) }', { maxOutputBytes: 10_000 }));

    expect(result).toMatchObject({ error: { truncated: true, type: 'output_too_large' }, ok: false });
  });

  it('returns not_found with a hint when the binary is not on PATH', async () => {
    const result = await exec.run({ args: ['--version'], cli: 'git', env: { PATH: '/nonexistent' } });

    expect(result).toMatchObject({ error: { cli: 'git', type: 'not_found' }, ok: false });
    expect(result.ok ? undefined : result.error.hint).toContain('PATH');
  });

  it('rejects an argument containing a NUL byte', async () => {
    const result = await exec.run(bun('1', { args: ['-e', 'a\0b'] }));

    expect(result).toMatchObject({ error: { message: expect.stringContaining('NUL') as unknown, type: 'failed' }, ok: false });
  });

  it('does not inherit environment beyond the allowlist, but passes caller keys', async () => {
    const isolated = createCliExec({ baseEnvironment: { ...process.env, LOCAL_API_TOKEN: 'secret' } });
    const result = await isolated.run(bun('console.log(JSON.stringify([process.env.LOCAL_API_TOKEN ?? null, process.env.EXTRA]))', { env: { EXTRA: 'yes' } }));

    expect(result).toMatchObject({ ok: true, value: { stdout: '[null,"yes"]\n' } });
  });

  it('passes shell metacharacters literally', async () => {
    const literal = '$(echo hi); `id` | && > /dev/null *';
    const result = await exec.run({ args: ['-e', 'console.log(process.argv.at(-1))', literal], cli: 'bun' });

    expect(result).toMatchObject({ ok: true, value: { stdout: `${literal}\n` } });
  });

  it('logs redacted args and env keys only', async () => {
    const logged: unknown[] = [];
    const logging = createCliExec({ logger: { info: (_message, fields) => logged.push(fields) } });
    await logging.run(bun('1', { args: ['-e', '1', '--token', 'abc123'], env: { API_KEY: 'hidden-value' } }));

    expect(JSON.stringify(logged)).not.toContain('abc123');
    expect(JSON.stringify(logged)).not.toContain('hidden-value');
    expect(logged[0]).toMatchObject({ env_keys: ['API_KEY'] });
  });

  it('logs snake_case fields and event names (code-review-6)', async () => {
    const logged: { fields: Readonly<Record<string, unknown>>; message: string }[] = [];
    const logging = createCliExec({ logger: { info: (message, fields) => logged.push({ fields, message }) } });
    await logging.run(bun('1', { correlationId: 'corr-1' }));

    expect(logged.map((line) => line.message)).toEqual(['cli_start', 'cli_exit']);
    expect(logged[1]?.fields).toMatchObject({ correlation_id: 'corr-1', duration_ms: expect.any(Number) as unknown, exit_code: 0 });
    expect(JSON.stringify(logged)).not.toMatch(/"[a-z]+[A-Z]\w*":/);
  });
});
