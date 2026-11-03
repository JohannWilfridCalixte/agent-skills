import type { CommandRunner, CommandStream, HistoryLog, RunNotFound, RunService } from '@agentic/domain-shared';

import { err, ok } from '@agentic/kernel-result';

import { parseRunSpec } from '../model/run-spec.js';
import { Run } from '../model/run.js';
import { sequenceStream } from '../model/sequence-stream.js';

export const DEFAULT_MAX_FINISHED_RUNS = 100;

export interface RunServiceDependencies {
  readonly history: HistoryLog;
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
    for await (const line of stream.lines) run.append(line);
    run.settle(await stream.result, now());
    try {
      await history.record({ exitCode: run.recordedExitCode, kind: 'run', output: run.output, scope: run.spec.scope, summary: run.spec.summary });
    } catch (error) {
      run.append({ line: `History not recorded: ${error instanceof Error ? error.message : String(error)}`, type: 'stderr' });
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
      const { args, cli, cwd, next = [] } = parsed.value;
      const run = new Run(newId(), parsed.value, now());
      const stream = sequenceStream(runner, [{ args, cli, ...(cwd === undefined ? {} : { cwd }) }, ...next]);
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
