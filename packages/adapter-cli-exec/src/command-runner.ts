import type { CommandError, CommandLine, CommandRunner } from '@agentic/domain-shared';
import type { Result } from '@agentic/kernel-result';

import type { CliEvent, CliExec, CliExecError, CliOutput } from './types.js';

import { err, ok } from '@agentic/kernel-result';

/** CliExec errors other than a nonzero exit, as the port's error types. */
const ERROR_TYPES = {
  cancelled: 'cancelled',
  invalid_output: 'unexpected',
  not_found: 'not_found',
  not_installed: 'not_installed',
  output_too_large: 'output_too_large',
  timeout: 'timeout',
} as const satisfies Record<Exclude<CliExecError['type'], 'failed'>, CommandError['type']>;

/**
 * `CommandRunner` port on top of `CliExec.stream`. CliExec reports a nonzero exit as a `failed` error; the port treats
 * any exit as an outcome (the run decides failed vs succeeded) and keeps errors for "no exit": spawn, timeout, cancel.
 */
export function createCommandRunner(exec: CliExec) {
  return {
    stream(command) {
      const { args, cli, correlationId, cwd, timeoutMs } = command;
      const stream = exec.stream({
        args,
        cli,
        ...(correlationId === undefined ? {} : { correlationId }),
        ...(cwd === undefined ? {} : { cwd }),
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      });
      return { cancel: () => {
        stream.cancel();
      }, lines: onlyLines(stream.events), result: stream.result.then(toOutcome) };
    },
  } satisfies CommandRunner;
}

async function* onlyLines(events: AsyncIterable<CliEvent>) {
  for await (const event of events) {
    if (event.type !== 'exit') yield { line: event.line, type: event.type } satisfies CommandLine;
  }
}

function toOutcome(result: Result<CliOutput, CliExecError>) {
  if (result.ok) return ok({ exitCode: result.value.exitCode });
  const { exitCode, message, type } = result.error;
  if (type === 'failed' && exitCode !== null) return ok({ exitCode });
  return err({ exitCode, message, type: type === 'failed' ? 'unexpected' : ERROR_TYPES[type] } satisfies CommandError);
}
