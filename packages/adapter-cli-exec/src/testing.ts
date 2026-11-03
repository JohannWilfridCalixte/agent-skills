import type { Result } from '@agentic/kernel-result';

import type { CliCommand, CliEvent, CliExec, CliExecError, CliExecErrorType, CliName, CliOutput, CliStream } from './types.js';

import { err, ok } from '@agentic/kernel-result';

import { EventQueue } from './lines.js';

export interface FakeCliExec extends CliExec {
  readonly calls: CliCommand[];
}

export interface FakeCliResponse {
  readonly args: readonly string[];
  readonly cli: CliName;
  /** Lines streamed before the result; defaults to the stdout/stderr of an ok result split by line. */
  readonly lines?: readonly Extract<CliEvent, { line: string }>[];
  readonly result: Result<CliOutput, CliExecError>;
}

export const fakeOutput = (stdout = '', overrides: Partial<CliOutput> = {}): Result<CliOutput, CliExecError> =>
  ok({ durationMs: 1, exitCode: 0, stderr: '', stdout, ...overrides });

export const fakeCliError = (cli: CliName, type: CliExecErrorType = 'failed', overrides: Partial<CliExecError> = {}): Result<CliOutput, CliExecError> =>
  err({ cli, exitCode: type === 'failed' ? 1 : null, message: `${cli} ${type}`, stderrTail: '', type, ...overrides });

/** A scripted streaming handle: emits `lines`, then the exit event (for ok results), then resolves `result`. */
export function fakeStream(result: Result<CliOutput, CliExecError>, lines?: FakeCliResponse['lines']): CliStream {
  const events = new EventQueue<CliEvent>();
  const scripted = lines ?? (result.ok ? splitOutput(result.value) : []);
  for (const event of scripted) events.push(event);
  const exitCode = result.ok ? result.value.exitCode : result.error.exitCode;
  if (exitCode !== null) events.push({ durationMs: result.ok ? result.value.durationMs : 0, exitCode, type: 'exit' });
  events.close();
  return { cancel: () => undefined, events, result: Promise.resolve(result) };
}

function splitOutput({ stderr, stdout }: CliOutput) {
  const toLines = (text: string, type: 'stderr' | 'stdout') =>
    text === '' ? [] : text.replace(/\n$/, '').split('\n').map((line) => ({ line, type }));
  return [...toLines(stdout, 'stdout'), ...toLines(stderr, 'stderr')];
}

const key = (cli: string, args: readonly string[]) => JSON.stringify([cli, ...args]);

/** Scripted by exact cli+args; records every call; an unscripted command throws. */
export function createFakeCliExec(responses: readonly FakeCliResponse[] = []): FakeCliExec {
  const calls: CliCommand[] = [];
  const lookup = (command: CliCommand) => {
    calls.push(command);
    const response = responses.find((candidate) => key(candidate.cli, candidate.args) === key(command.cli, command.args));
    if (response === undefined) throw new Error(`Unscripted CLI command: ${command.cli} ${command.args.join(' ')}`);
    return response;
  };
  return {
    calls,
    run: (command) => Promise.resolve(lookup(command).result),
    stream: (command) => {
      const response = lookup(command);
      return fakeStream(response.result, response.lines);
    },
  };
}
