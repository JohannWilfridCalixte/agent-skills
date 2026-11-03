import type { CommandRunner, CommandStream, HistoryLog, RunNotFound, RunService } from '@agentic/domain-shared';

import { redactArgs } from '@agentic/domain-shared';
import { err, ok } from '@agentic/kernel-result';

import { parseRunSpec } from '../model/run-spec.js';
import { Run } from '../model/run.js';
import { sequenceStream } from '../model/sequence-stream.js';

export const DEFAULT_MAX_FINISHED_RUNS = 100;

/** Structured log port: `message` is a snake_case event name, fields are snake_case and never secret. */
export interface RunLogger {
  info(message: string, fields: Readonly<Record<string, null | number | string>>): void;
  warn(message: string, fields: Readonly<Record<string, null | number | string>>): void;
}

export interface RunServiceDependencies {
  readonly history: HistoryLog;
  readonly logger?: RunLogger;
  /** Finished runs kept for `get`/replay; the oldest finished is evicted beyond it. */
  readonly maxFinishedRuns?: number;
  /** Unique run id; injected so the domain stays free of platform APIs. */
  readonly newId: () => string;
  /** ISO-8601 timestamp. */
  readonly now?: () => string;
  readonly runner: CommandRunner;
}

/** In-memory runs (D27): never retried (AC15), recorded in history exactly once when they end. */
export function createRunService({
  history,
  logger,
  maxFinishedRuns = DEFAULT_MAX_FINISHED_RUNS,
  newId,
  now = () => new Date().toISOString(),
  runner,
}: RunServiceDependencies) {
  const runs = new Map<string, { readonly run: Run; readonly stream: CommandStream }>();
  const notFound = (id: string) => err({ id, type: 'run_not_found' } satisfies RunNotFound);

  const evictFinished = () => {
    const finished = [...runs.values()].filter(({ run }) => run.finished);
    for (const { run } of finished.slice(0, Math.max(0, finished.length - maxFinishedRuns))) runs.delete(run.id);
  };

  const drive = async (run: Run, stream: CommandStream) => {
    const ids = { correlation_id: run.spec.correlationId ?? run.id, run_id: run.id, scope: run.spec.scope };
    for await (const line of stream.lines) run.append(line);
    run.settle(await stream.result, now());
    const { exitCode = null, finishedAt = run.startedAt, startedAt, status } = run.summary();
    logger?.info('run_finished', { ...ids, duration_ms: Date.parse(finishedAt) - Date.parse(startedAt), exit_code: exitCode, status });
    try {
      await history.record({
        exitCode: run.recordedExitCode,
        kind: 'run',
        output: run.output,
        ...(run.outputTruncated ? { outputTruncated: true } : {}),
        scope: run.spec.scope,
        summary: run.spec.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger?.warn('run_failed_to_record', { ...ids, error_message: message });
      run.append({ line: `History not recorded: ${message}`, type: 'stderr' });
    }
    run.close();
    evictFinished();
  };

  return {
    cancel(id) {
      const entry = runs.get(id);
      if (entry === undefined) return notFound(id);
      const summary = entry.run.summary();
      if (summary.status !== 'running') return err({ id, status: summary.status, type: 'run_not_running' });
      entry.run.cancelRequested = true;
      entry.stream.cancel();
      return ok(summary);
    },
    get(id) {
      const entry = runs.get(id);
      return entry === undefined ? notFound(id) : ok(entry.run.view());
    },
    start(spec) {
      const parsed = parseRunSpec(spec);
      if (!parsed.ok) return parsed;
      const { args, cli, correlationId, cwd, next = [], timeoutMs } = parsed.value;
      const run = new Run(newId(), parsed.value, now());
      const correlation = correlationId === undefined ? {} : { correlationId };
      const first = { args, cli, ...correlation, ...(cwd === undefined ? {} : { cwd }), ...(timeoutMs === undefined ? {} : { timeoutMs }) };
      logger?.info('run_started', {
        args: JSON.stringify(redactArgs(args)),
        cli,
        correlation_id: correlationId ?? run.id,
        cwd: cwd === undefined ? null : (cwd.split('/').findLast((part) => part !== '') ?? '/'),
        run_id: run.id,
        scope: run.spec.scope,
      });
      const stream = sequenceStream(runner, [first, ...next.map((command) => ({ ...command, ...correlation }))]);
      runs.set(run.id, { run, stream });
      void drive(run, stream);
      return ok(run.summary());
    },
    subscribe(id) {
      const entry = runs.get(id);
      return entry === undefined ? notFound(id) : ok(entry.run.replay());
    },
  } satisfies RunService;
}
