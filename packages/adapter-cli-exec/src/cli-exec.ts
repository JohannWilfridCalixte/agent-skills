import type { CliCommand, CliEvent, CliExec, CliExecError, CliExecErrorType, CliOutput, CliStream } from './types.js';

import { err, ok } from '@agentic/kernel-result';

import { sanitiseEnvironment } from './environment.js';
import { EventQueue, LineSplitter } from './lines.js';
import { redactArgs } from './redact.js';
import { DEFAULT_MAX_OUTPUT_BYTES, DEFAULT_TIMEOUT_MS, isCliName } from './types.js';

const STDERR_TAIL_CHARS = 4000;
const NOT_INSTALLED_EXIT_CODE = 127;

export interface CliExecLogger {
  info(message: string, fields: Readonly<Record<string, unknown>>): void;
}

export interface CliExecOptions {
  /** Environment the allowlist is picked from (default `process.env`). */
  readonly baseEnvironment?: Readonly<Record<string, string | undefined>>;
  readonly logger?: CliExecLogger;
}

const tail = (text: string, size: number) => (text.length > size ? text.slice(-size) : text);

export function createCliExec({ baseEnvironment = process.env, logger }: CliExecOptions = {}): CliExec {
  function stream(command: CliCommand): CliStream {
    const env = sanitiseEnvironment(baseEnvironment, command.env);
    const executable = validate(command, env['PATH']);
    if (typeof executable !== 'string') return failedStream(executable);

    const maxOutputBytes = command.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    logger?.info('cli.start', {
      args: redactArgs(command.args),
      cli: command.cli,
      correlationId: command.correlationId,
      cwd: command.cwd,
      envKeys: Object.keys(command.env ?? {}),
    });

    const startedAt = performance.now();
    const child = Bun.spawn([executable, ...command.args], {
      ...(command.cwd === undefined ? {} : { cwd: command.cwd }),
      detached: true,
      env,
      stderr: 'pipe',
      stdin: command.stdin === undefined ? 'ignore' : new TextEncoder().encode(command.stdin),
      stdout: 'pipe',
    });

    const events = new EventQueue<CliEvent>();
    const output = { stderr: '', stdout: '' };
    let bytes = 0;
    let stop: 'cancelled' | 'output_too_large' | 'timeout' | undefined;
    const terminate = (reason: NonNullable<typeof stop>) => {
      stop ??= reason;
      killTree(child.pid);
    };
    const timer = setTimeout(() => {
      terminate('timeout');
    }, command.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    async function pump(source: ReadableStream<Uint8Array>, type: 'stderr' | 'stdout') {
      const decoder = new TextDecoder();
      const splitter = new LineSplitter();
      for await (const chunk of source) {
        bytes += chunk.byteLength;
        const text = decoder.decode(chunk, { stream: true });
        output[type] += text;
        if (bytes > maxOutputBytes) {
          output[type] = tail(output[type], maxOutputBytes);
          terminate('output_too_large');
        }
        if (stop === undefined || stop === 'output_too_large') for (const line of splitter.push(text)) events.push({ line, type });
      }
      for (const line of splitter.push(decoder.decode())) events.push({ line, type });
      for (const line of splitter.flush()) events.push({ line, type });
    }

    const result = (async () => {
      await Promise.all([pump(child.stdout, 'stdout'), pump(child.stderr, 'stderr')]);
      const exitCode = await child.exited;
      clearTimeout(timer);
      killTree(child.pid);
      const durationMs = Math.round(performance.now() - startedAt);
      events.push({ durationMs, exitCode, type: 'exit' });
      events.close();
      logger?.info('cli.exit', { cli: command.cli, correlationId: command.correlationId, durationMs, exitCode, stop });

      const stderrTail = tail(output.stderr, STDERR_TAIL_CHARS);
      if (stop === 'timeout') return err(failure(command, 'timeout', `${command.cli} timed out after ${String(command.timeoutMs ?? DEFAULT_TIMEOUT_MS)} ms.`, { stderrTail }));
      if (stop === 'cancelled') return err(failure(command, 'cancelled', `${command.cli} was cancelled.`, { stderrTail }));
      if (stop === 'output_too_large') {
        return err(failure(command, 'output_too_large', `${command.cli} output exceeded ${String(maxOutputBytes)} bytes.`, { stderrTail, truncated: true }));
      }
      if (exitCode === NOT_INSTALLED_EXIT_CODE) {
        return err(failure(command, 'not_installed', `${command.cli} could not start a required program.`, { exitCode, hint: `Check the ${command.cli} installation.`, stderrTail }));
      }
      if (exitCode !== 0) return err(failure(command, 'failed', `${command.cli} exited with code ${String(exitCode)}.`, { exitCode, stderrTail }));
      return ok<CliOutput>({ durationMs, exitCode, stderr: output.stderr, stdout: output.stdout });
    })();

    return {
      cancel: () => {
        terminate('cancelled');
      },
      events,
      result,
    };
  }

  return {
    run: async (command) => {
      const handle = stream(command);
      // Drain events so the queue does not grow unbounded on buffered runs.
      for await (const _event of handle.events) {
        // discard
      }
      return handle.result;
    },
    stream,
  };
}

function failedStream(error: CliExecError): CliStream {
  const events = new EventQueue<CliEvent>();
  events.close();
  return { cancel: () => undefined, events, result: Promise.resolve(err(error)) };
}

function failure(command: CliCommand, type: CliExecErrorType, message: string, extra: Partial<CliExecError> = {}): CliExecError {
  return { cli: command.cli, exitCode: null, message, stderrTail: '', type, ...extra };
}

/** Signals the whole process group (the child leads its own group), so grandchildren die too. */
function killTree(pid: number) {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Group already gone.
  }
}

function validate(command: CliCommand, path: string | undefined) {
  if (!isCliName(command.cli)) return failure(command, 'not_found', `"${String(command.cli)}" is not an allowed CLI.`);
  if (command.args.some((arg) => arg.includes('\0'))) return failure(command, 'failed', 'Arguments must not contain NUL bytes.');
  const executable = Bun.which(command.cli, path === undefined ? {} : { PATH: path });
  if (executable === null) {
    return failure(command, 'not_found', `${command.cli} was not found on PATH.`, { hint: `Install ${command.cli} and make sure it is on PATH.` });
  }
  return executable;
}
