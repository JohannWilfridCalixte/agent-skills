import type { Command, CommandOutcome } from './model/command.js';
import type { HistoryEntry, HistoryScope, NewHistoryEntry } from './model/history.js';
import type { Project } from './model/project.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { HistoryLog } from './ports/history-log.js';
import type { ProjectRegistry } from './ports/project-registry.js';

const FIXED_NOW = '2026-01-01T00:00:00.000Z';

/** Records every command and answers with the scripted outcome (default: exit 0, no output). */
export class FakeCommandRunner implements CommandRunner {
  readonly commands: Command[] = [];
  private readonly outcome: CommandOutcome;

  constructor(outcome: CommandOutcome = { exitCode: 0, output: '' }) {
    this.outcome = outcome;
  }

  run(command: Command) {
    this.commands.push(command);
    return Promise.resolve(this.outcome);
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
