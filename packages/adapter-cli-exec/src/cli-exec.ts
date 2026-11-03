import type { CliCommand, CliEvent, CliExec, CliExecError, CliExecErrorType, CliOutput, CliStream } from './types.js';

import { statSync } from 'node:fs';

import { redactArgs } from '@agentic/domain-shared';
import { err, ok } from '@agentic/kernel-result';

import { sanitiseEnvironment } from './environment.js';
import { EventQueue, LineSplitter } from './lines.js';
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
    logger?.info('cli_start', {
      args: redactArgs(command.args),
      cli: command.cli,
      correlation_id: command.correlationId,
      cwd: command.cwd,
      env_keys: Object.keys(command.env ?? {}),
    });

    const startedAt = performance.now();
    const spawned = spawn(command, executable, env);
    if (!spawned.ok) {
      logger?.info('cli_spawn_failed', { cli: command.cli, correlation_id: command.correlationId, error_type: spawned.error.type });
      return failedStream(spawned.error);
    }
    const child = spawned.value;

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
      logger?.info('cli_exit', { cli: command.cli, correlation_id: command.correlationId, duration_ms: durationMs, exit_code: exitCode, stop });

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

function isDirectory(path: string) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Signals the whole process group (the child leads its own group), so grandchildren die too. */
function killTree(pid: number) {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Group already gone.
  }
}

/** `Bun.spawn` throws synchronously (ENOENT cwd, ENOEXEC, EACCES, E2BIG); every throw becomes a typed error. */
function spawn(command: CliCommand, executable: string, env: Record<string, string>) {
  if (command.cwd !== undefined && !isDirectory(command.cwd)) {
    return err(failure(command, 'cwd_missing', `Cannot run ${command.cli} in ${command.cwd}.`, { hint: 'The working folder no longer exists; restore it or remove the project.' }));
  }
  try {
    return ok(
      Bun.spawn([executable, ...command.args], {
        ...(command.cwd === undefined ? {} : { cwd: command.cwd }),
        detached: true,
        env,
        stderr: 'pipe',
        stdin: command.stdin === undefined ? 'ignore' : new TextEncoder().encode(command.stdin),
        stdout: 'pipe',
      }),
    );
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    const detail = error instanceof Error ? error.message : String(error);
    return err(failure(command, 'spawn_failed', `${command.cli} could not be started${typeof code === 'string' ? ` (${code})` : ''}: ${detail}`, { hint: `Check the ${command.cli} installation.` }));
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
