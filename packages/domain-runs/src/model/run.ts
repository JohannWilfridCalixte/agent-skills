import type { CommandError, CommandOutcome, RunEvent, RunSpec, RunStatus, RunSummary, RunView } from '@agentic/domain-shared';
import type { Result } from '@agentic/kernel-result';

/** Lines kept per run for replay and `get`; the history tail cap (256 KiB) is applied by `domain-history`. */
export const MAX_BUFFERED_LINES = 10_000;

/** Exit code recorded in history when the process never exited (spawn failure, timeout, cancel). */
export const NO_EXIT_CODE = -1;

/**
 * One in-memory run: buffers its events (bounded) for replay and wakes live subscribers. Status moves
 * `running` → `succeeded | failed | cancelled` exactly once.
 */
export class Run {
  cancelRequested = false;
  readonly id: string;
  readonly spec: RunSpec;
  readonly startedAt: string;
  get finished() {
    return this.status !== 'running';
  }

  /** Full output for history, from the lines still buffered. */
  get output() {
    return this.lines().join('\n');
  }

  get recordedExitCode() {
    return this.exitCode ?? NO_EXIT_CODE;
  }

  /** Events dropped from the head to respect `MAX_BUFFERED_LINES`; subscriber cursors are absolute. */
  private dropped = 0;
  private readonly events: RunEvent[] = [];
  private exitCode: number | undefined;

  private finishedAt: string | undefined;

  private status: RunStatus = 'running';

  private readonly waiters = new Set<() => void>();

  constructor(id: string, spec: RunSpec, startedAt: string) {
    this.id = id;
    this.spec = spec;
    this.startedAt = startedAt;
  }

  append(line: Extract<RunEvent, { line: string }>) {
    this.push(line);
    if (this.events.length > MAX_BUFFERED_LINES) {
      this.events.shift();
      this.dropped += 1;
    }
  }

  close() {
    this.push({ status: this.status, type: 'status' });
  }

  async* replay() {
    let cursor = this.dropped;
    for (;;) {
      cursor = Math.max(cursor, this.dropped);
      const event = this.events[cursor - this.dropped];
      if (event !== undefined) {
        cursor += 1;
        yield event;
        if (event.type === 'status') return;
        continue;
      }
      await new Promise<void>((resolve) => {
        this.waiters.add(resolve);
      });
    }
  }

  /** Decides the final status from the runner result; the `status` event is pushed by `close`. */
  settle(result: Result<CommandOutcome, CommandError>, finishedAt: string) {
    this.finishedAt = finishedAt;
    if (result.ok) {
      this.exitCode = result.value.exitCode;
      this.push({ exitCode: result.value.exitCode, type: 'exit' });
      this.status = result.value.exitCode === 0 ? 'succeeded' : 'failed';
      return;
    }
    const { exitCode, message, type } = result.error;
    this.append({ line: message, type: 'stderr' });
    if (exitCode !== null) {
      this.exitCode = exitCode;
      this.push({ exitCode, type: 'exit' });
    }
    this.status = type === 'cancelled' || this.cancelRequested ? 'cancelled' : 'failed';
  }

  summary() {
    return {
      id: this.id,
      startedAt: this.startedAt,
      status: this.status,
      ...(this.exitCode === undefined ? {} : { exitCode: this.exitCode }),
      ...(this.finishedAt === undefined ? {} : { finishedAt: this.finishedAt }),
    } satisfies RunSummary;
  }

  view() {
    return { ...this.summary(), output: this.lines() } satisfies RunView;
  }

  private lines() {
    return this.events.flatMap((event) => (event.type === 'stdout' || event.type === 'stderr' ? [event.line] : []));
  }

  private push(event: RunEvent) {
    this.events.push(event);
    const waiters = [...this.waiters];
    this.waiters.clear();
    for (const wake of waiters) wake();
  }
}
