import type { CommandError, CommandOutcome, RunEvent, RunSpec, RunStatus, RunSummary, RunView } from '@agentic/domain-shared';
import type { Result } from '@agentic/kernel-result';

/** Lines kept per run for replay and `get`; the history tail cap (256 KiB) is applied by `domain-history`. */
export const MAX_BUFFERED_LINES = 10_000;

/**
 * Output characters kept for history, independent of the replay buffer. At least as many as the history byte tail
 * (256 KiB, one byte per character at minimum), so the stored tail is complete unless this overflows.
 */
export const MAX_HISTORY_OUTPUT_CHARS = 256 * 1024;

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

  /** Output for history: its own bounded tail of lines, kept even after the replay buffer dropped them. */
  get output() {
    return this.historyLines.join('\n');
  }

  /** `true` when `output` lacks lines the run produced. */
  get outputTruncated() {
    return this.historyDropped;
  }

  get recordedExitCode() {
    return this.exitCode ?? NO_EXIT_CODE;
  }

  /** Events dropped from the head to respect `MAX_BUFFERED_LINES`; subscriber cursors are absolute. */
  private dropped = 0;
  private readonly events: RunEvent[] = [];
  private exitCode: number | undefined;
  private finishedAt: string | undefined;
  private historyChars = 0;
  private historyDropped = false;

  private readonly historyLines: string[] = [];

  private status: RunStatus = 'running';

  private readonly waiters = new Set<() => void>();

  constructor(id: string, spec: RunSpec, startedAt: string) {
    this.id = id;
    this.spec = spec;
    this.startedAt = startedAt;
  }

  append(line: Extract<RunEvent, { line: string }>) {
    this.keepForHistory(line.line);
    this.push(line);
    if (this.events.length > MAX_BUFFERED_LINES) {
      this.events.shift();
      this.dropped += 1;
    }
  }

  close() {
    this.push({ status: this.status, type: 'status' });
  }

  /** Yields a `dropped` event wherever lines were lost before this subscriber read them (at the start for a late one). */
  async* replay() {
    let cursor = 0;
    for (;;) {
      if (cursor < this.dropped) {
        yield { dropped: this.dropped - cursor, type: 'dropped' } satisfies RunEvent;
        cursor = this.dropped;
      }
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
      truncated: this.dropped > 0,
      ...(this.exitCode === undefined ? {} : { exitCode: this.exitCode }),
      ...(this.finishedAt === undefined ? {} : { finishedAt: this.finishedAt }),
    } satisfies RunSummary;
  }

  view() {
    return { ...this.summary(), output: this.lines() } satisfies RunView;
  }

  private keepForHistory(line: string) {
    this.historyLines.push(line);
    this.historyChars += line.length + 1;
    while (this.historyChars > MAX_HISTORY_OUTPUT_CHARS && this.historyLines.length > 1) {
      this.historyChars -= (this.historyLines.shift() ?? '').length + 1;
      this.historyDropped = true;
    }
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
