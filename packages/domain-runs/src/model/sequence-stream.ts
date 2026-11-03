import type { Command, CommandError, CommandLine, CommandOutcome, CommandRunner, CommandStream } from '@agentic/domain-shared';
import type { Result } from '@agentic/kernel-result';

import { redactArgs } from '@agentic/domain-shared';
import { err } from '@agentic/kernel-result';

export function failedStream(message: string): CommandStream {
  async function* lines(): AsyncGenerator<CommandLine> {
    // no output
  }
  return { cancel: () => undefined, lines: lines(), result: Promise.resolve(err({ exitCode: null, message, type: 'unexpected' } satisfies CommandError)) };
}

/** A runner that throws (a bug, or an adapter that leaked a spawn exception) becomes a closed, failed stream. */
export function safeStream(runner: CommandRunner, command: Command): CommandStream {
  try {
    return runner.stream(command);
  } catch (error) {
    return failedStream(redactArgs((error instanceof Error ? error.message : String(error)).split(' ')).join(' '));
  }
}

/**
 * Plays `commands` one after another as a single stream: lines in order, the next command only after the
 * previous exited 0; the result is the first failure or nonzero exit, else the last outcome. Cancel stops the
 * current command and starts no further one.
 */
export function sequenceStream(runner: CommandRunner, commands: readonly Command[]) {
  const [first, ...rest] = commands;
  if (first === undefined) throw new Error('sequenceStream: no command');
  if (rest.length === 0) return safeStream(runner, first);

  let current = safeStream(runner, first);
  let cancelled = false;
  let resolveResult: (result: Result<CommandOutcome, CommandError>) => void = () => undefined;
  const result = new Promise<Result<CommandOutcome, CommandError>>((resolve) => {
    resolveResult = resolve;
  });

  async function* lines(): AsyncGenerator<CommandLine> {
    for (let index = 0; ; index += 1) {
      yield* current.lines;
      const outcome = await current.result;
      const following = rest[index];
      if (!outcome.ok || outcome.value.exitCode !== 0 || following === undefined || cancelled) {
        resolveResult(outcome);
        return;
      }
      current = safeStream(runner, following);
    }
  }

  return {
    cancel: () => {
      cancelled = true;
      current.cancel();
    },
    lines: lines(),
    result,
  } satisfies CommandStream;
}
