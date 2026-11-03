import type { CliCommand, CliExec } from './types.js';

import { describe, expect, it } from 'vitest';

import { createCliExec } from './cli-exec.js';
import { createCommandRunner } from './command-runner.js';

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('createCommandRunner (ub-mode-1, code-review-5)', () => {
  it('forwards the command timeout and correlation id to the exec', () => {
    const seen: CliCommand[] = [];
    const recording: CliExec = {
      run: () => Promise.reject(new Error('unused')),
      stream: (command) => {
        seen.push(command);
        return createCliExec().stream({ args: ['-e', '1'], cli: 'bun' });
      },
    };

    createCommandRunner(recording).stream({ args: ['skills', 'add'], cli: 'npx', correlationId: 'corr-1', cwd: '/p', timeoutMs: 600_000 });

    expect(seen).toEqual([{ args: ['skills', 'add'], cli: 'npx', correlationId: 'corr-1', cwd: '/p', timeoutMs: 600_000 }]);
  });

  it('reports a command that outlives its timeout as a timeout error and kills its process tree', async () => {
    const stream = createCommandRunner(createCliExec()).stream({
      args: ['-e', 'const c = Bun.spawn(["sleep", "30"]); console.log(c.pid); await c.exited'],
      cli: 'bun',
      timeoutMs: 300,
    });
    const lines: string[] = [];
    for await (const line of stream.lines) lines.push(line.line);

    expect(await stream.result).toMatchObject({ error: { message: 'bun timed out after 300 ms.', type: 'timeout' }, ok: false });
    const childPid = Number(lines[0]);
    for (let attempt = 0; attempt < 50 && isAlive(childPid); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
    expect(isAlive(childPid)).toBe(false);
  });
});
