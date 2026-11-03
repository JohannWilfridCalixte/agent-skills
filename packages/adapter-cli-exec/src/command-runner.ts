import type { Command, CommandOutcome, CommandRunner } from '@agentic/domain-shared';

import type { CliExec } from './types.js';

import { isCliName } from './types.js';

/**
 * `CommandRunner` port on top of `CliExec`. The port (refined in T10) has no error channel yet, so typed errors become a
 * nonzero outcome: the failing exit code (or -1) with stdout+stderr, or the error message.
 */
export function createCommandRunner(exec: CliExec): CommandRunner {
  return {
    async run(command: Command): Promise<CommandOutcome> {
      if (!isCliName(command.executable)) return { exitCode: -1, output: `"${command.executable}" is not an allowed CLI.` };
      const result = await exec.run({ args: command.args, cli: command.executable, ...(command.cwd === undefined ? {} : { cwd: command.cwd }) });
      if (result.ok) return { exitCode: result.value.exitCode, output: result.value.stdout + result.value.stderr };
      const { exitCode, message, stderrTail } = result.error;
      return { exitCode: exitCode ?? -1, output: stderrTail === '' ? message : `${stderrTail}\n${message}` };
    },
  };
}
