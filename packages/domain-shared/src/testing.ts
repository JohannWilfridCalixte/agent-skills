import type { Result } from '@agentic/kernel-result';

import type { Command, CommandError, CommandLine, CommandOutcome, CommandStream } from './model/command.js';
import type { HistoryEntry, HistoryScope, NewHistoryEntry } from './model/history.js';
import type { Project } from './model/project.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { HistoryLog } from './ports/history-log.js';
import type { ProjectRegistry } from './ports/project-registry.js';

import { err, ok } from '@agentic/kernel-result';

const FIXED_NOW = '2026-01-01T00:00:00.000Z';

/** Lines then a result; a command scripted with `hold: true` stays running until the test calls `finish`. */
export interface FakeCommandScript {
  readonly hold?: boolean;
  readonly lines?: readonly CommandLine[];
  readonly result?: Result<CommandOutcome, CommandError>;
}

/** Records every command; each stream plays `script` (default: exit 0, no output). */
export class FakeCommandRunner implements CommandRunner {
  readonly commands: Command[] = [];
  readonly streams: ManualCommandStream[] = [];
  private readonly script: FakeCommandScript;

  constructor(script: FakeCommandScript = {}) {
    this.script = script;
  }

  stream(command: Command) {
    this.commands.push(command);
    const stream = new ManualCommandStream();
    this.streams.push(stream);
    for (const line of this.script.lines ?? []) stream.emit(line);
    if (this.script.hold !== true) stream.finish(this.script.result);
    return stream;
  }
}

/** Keeps run output whole (no tail cap: that rule lives in `domain-history`); lists newest first. */
export class InMemoryHistoryLog implements HistoryLog {
  readonly entries: HistoryEntry[] = [];

  list(scope: HistoryScope, { limit }: { readonly limit?: number } = {}) {
    const matching = this.entries.filter((entry) => entry.scope === scope).toReversed();
    return Promise.resolve(limit === undefined ? matching : matching.slice(0, limit));
  }

  record(entry: NewHistoryEntry) {
    const base = { createdAt: FIXED_NOW, id: `history-${String(this.entries.length + 1)}`, kind: entry.kind, scope: entry.scope, summary: entry.summary };
    const recorded: HistoryEntry =
      entry.kind === 'run'
        ? { ...base, content: null, exitCode: entry.exitCode, outputTail: entry.output, truncated: false }
        : { ...base, content: entry.content, exitCode: null, outputTail: null, truncated: false };
    this.entries.push(recorded);
    return Promise.resolve(recorded);
  }
}

/** Seeded with fixed projects; ids `project-1`, `project-2`, ... in path order given. */
export class InMemoryProjectRegistry implements ProjectRegistry {
  private readonly projects: readonly Project[];

  constructor(paths: readonly string[] = []) {
    this.projects = paths.map((path, index) => ({ createdAt: FIXED_NOW, id: `project-${String(index + 1)}`, path }));
  }

  get(id: string) {
    return Promise.resolve(this.projects.find((project) => project.id === id));
  }

  list() {
    return Promise.resolve(this.projects);
  }
}

/** A command stream the test drives: `emit` lines, then `finish`; `cancel` finishes it as cancelled. */
export class ManualCommandStream implements CommandStream {
  cancelled = false;
  readonly result: Promise<Result<CommandOutcome, CommandError>>;
  get lines() {
    return { [Symbol.asyncIterator]: () => this.iterate() };
  }

  private closed = false;
  private readonly pending: CommandLine[] = [];
  private waiter: (() => void) | undefined;

  constructor() {
    this.result = new Promise((resolve) => {
      this.resolveResult = resolve;
    });
  }

  cancel() {
    this.cancelled = true;
    this.finish(err({ exitCode: null, message: 'cancelled', type: 'cancelled' }));
  }

  emit(line: CommandLine) {
    this.pending.push(line);
    this.wake();
  }

  finish(result: Result<CommandOutcome, CommandError> = ok({ exitCode: 0 })) {
    if (this.closed) return;
    this.closed = true;
    this.wake();
    this.resolveResult(result);
  }

  private async* iterate() {
    for (;;) {
      const line = this.pending.shift();
      if (line !== undefined) {
        yield line;
        continue;
      }
      if (this.closed) return;
      await new Promise<void>((resolve) => {
        this.waiter = resolve;
      });
    }
  }

  private resolveResult: (result: Result<CommandOutcome, CommandError>) => void = () => undefined;

  private wake() {
    const waiter = this.waiter;
    this.waiter = undefined;
    waiter?.();
  }
}
