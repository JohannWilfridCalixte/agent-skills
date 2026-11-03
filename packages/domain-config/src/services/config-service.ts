import type { HistoryLog, HistoryReader, ProjectRegistry } from '@agentic/domain-shared';
import type { Result } from '@agentic/kernel-result';

import type { ConfigFile, ConfigIssue } from '../model/config-file.js';
import type { DiffLine } from '../model/diff.js';
import type { ConfigIoFailed, ConfigLocationMissing, ConfigProjectNotFound, ReadConfigError, RestoreConfigError, SaveConfigError } from '../model/errors.js';
import type { ConfigScope } from '../model/scope.js';
import type { ConfigFileRead, ConfigLocation, ConfigStore, ConfigStoreError } from '../ports/config-store.js';
import type { ModelCatalog } from '../ports/model-catalog.js';

import { err, ok } from '@agentic/kernel-result';

import { EMPTY_CONFIG_FILE, parseConfigFile } from '../model/config-file.js';
import { delta } from '../model/delta.js';
import { lineDiff } from '../model/diff.js';
import { effective } from '../model/effective.js';
import { formatScope, parseScope } from '../model/scope.js';
import { modelWarnings } from './model-warnings.js';

/** What a save would do. `issues` non-empty means save is blocked; then `proposedText` is `null` and `diff` empty. */
export interface ConfigPreview {
  readonly diff: readonly DiffLine[];
  readonly issues: readonly ConfigIssue[];
  readonly proposedText: null | string;
  readonly scope: string;
  readonly unknownKeys: readonly string[];
  /** Unknown model ids: shown, never blocking (D14). */
  readonly warnings: readonly ConfigIssue[];
}

export interface ConfigRestored {
  /** `false` when the file already held exactly this text: nothing written or recorded. */
  readonly changed: boolean;
  readonly restoredFrom: string;
  readonly scope: string;
  readonly text: string;
}

/** What restoring history entry `entryId` would write; nothing is written. */
export interface ConfigRestorePreview {
  readonly diff: readonly DiffLine[];
  readonly entryId: string;
  readonly proposedText: string;
  readonly scope: string;
}

export interface ConfigSaved {
  /** `false` when the file already held exactly this text: nothing written or recorded. */
  readonly changed: boolean;
  readonly scope: string;
  readonly text: string;
  readonly unknownKeys: readonly string[];
  readonly warnings: readonly ConfigIssue[];
}

export type ConfigService = ReturnType<typeof createConfigService>;

export interface ConfigServiceDependencies {
  readonly history: HistoryLog;
  /** Reads the entries restore brings back. */
  readonly historyReader: HistoryReader;
  /** Absent until a CLI-backed catalog exists (T9): then no model warnings. */
  readonly models?: ModelCatalog;
  readonly projects: ProjectRegistry;
  readonly store: ConfigStore;
}

/** One config file as read: its text (`null` when missing) and the parsed file (empty when missing). */
export interface RawConfig {
  readonly exists: boolean;
  readonly file: ConfigFile;
  readonly scope: string;
  readonly text: null | string;
}

interface Prepared {
  readonly location: ConfigLocation;
  readonly proposed: ReturnType<typeof delta>;
  readonly scope: string;
  readonly warnings: readonly ConfigIssue[];
}

interface PreparedRestore {
  readonly content: string;
  readonly entryId: string;
  readonly location: ConfigLocation;
  readonly scope: string;
}

export function createConfigService({ history, historyReader, models, projects, store }: ConfigServiceDependencies) {
  const locks = new KeyedLock();
  const locate = async (scope: ConfigScope): Promise<Result<ConfigLocation, ConfigProjectNotFound>> => {
    if (scope.kind === 'global') return ok({ kind: 'global' });
    const project = await projects.get(scope.projectId);
    if (project === undefined) return err({ projectId: scope.projectId, type: 'project_not_found' });
    return ok({ kind: 'project', projectPath: project.path });
  };

  const readScope = async (scope: ConfigScope): Promise<Result<RawConfig, ReadConfigError>> => {
    const location = await locate(scope);
    if (!location.ok) return location;
    const scopeText = formatScope(scope);
    const stored = await store.read(location.value);
    if (!stored.ok) return err(ioFailed(stored.error, scopeText, 'read'));
    const read = stored.value;
    if (!read.exists) return ok({ exists: false, file: EMPTY_CONFIG_FILE, scope: scopeText, text: null });

    let json: unknown;
    try {
      json = JSON.parse(read.text);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Invalid JSON';
      return err({ detail, issues: [], reason: 'invalid_json', scope: scopeText, type: 'config_unreadable' });
    }
    const parsed = parseConfigFile(json);
    if (!parsed.ok) {
      const detail = 'The file does not match the config schema.';
      return err({ detail, issues: parsed.error, reason: 'invalid_schema', scope: scopeText, type: 'config_unreadable' });
    }
    return ok({ exists: true, file: parsed.value, scope: scopeText, text: read.text });
  };

  /** `global` or `project:<id>`. */
  const raw = async (scopeText: string) => {
    const scope = parseScope(scopeText);
    return scope.ok ? readScope(scope.value) : scope;
  };

  /** The global file alone for `global`; global under the project file for `project:<id>`. */
  const effectiveView = async (scopeText: string) => {
    const scope = parseScope(scopeText);
    if (!scope.ok) return scope;
    const project = scope.value.kind === 'project' ? await readScope(scope.value) : undefined;
    if (project?.ok === false) return project;
    const global = await readScope({ kind: 'global' });
    if (!global.ok) return global;
    return ok(effective(global.value.file, project?.value.file));
  };

  /** No baseline file for the global scope (built-in defaults); the global file for a project (an unreadable global file counts as empty). */
  const baselineFor = async (scope: ConfigScope) => {
    if (scope.kind === 'global') return undefined;
    const global = await readScope({ kind: 'global' });
    return global.ok ? global.value.file : EMPTY_CONFIG_FILE;
  };

  /** Resolves the scope, reduces the edit and looks models up: everything slow, before any read of the destination. */
  const prepare = async (scopeText: string, edited: unknown): Promise<Result<Prepared, SaveConfigError>> => {
    const scope = parseScope(scopeText);
    if (!scope.ok) return scope;
    const location = await locate(scope.value);
    if (!location.ok) return location;
    const proposed = delta(edited, await baselineFor(scope.value));
    const warnings = proposed.ok ? await modelWarnings(proposed.value.values, models) : [];
    return ok({ location: location.value, proposed, scope: formatScope(scope.value), warnings });
  };

  /** The current text without parsing it, so a broken file can still be replaced. */
  const currentText = async (location: ConfigLocation, scope: string): Promise<Result<null | string, ConfigIoFailed>> => {
    const read = await store.read(location);
    if (!read.ok) return err(ioFailed(read.error, scope, 'read'));
    return ok(textOf(read.value));
  };

  /**
   * Last write wins (D12), one writer per file: under the destination's lock, re-read the file, snapshot it into
   * history when it differs, write, record the new content. Nothing slow runs between the read and the write.
   */
  const replace = (location: ConfigLocation, scope: string, text: string, summaries: { readonly after: string; readonly before: string; readonly kind: 'config_restore' | 'config_write' }) =>
    locks.run(lockKey(location), async (): Promise<Result<boolean, ConfigIoFailed | ConfigLocationMissing>> => {
      const current = await currentText(location, scope);
      if (!current.ok) return current;
      if (current.value === text) return ok(false);
      if (current.value !== null) await history.record({ content: current.value, kind: 'config_write', scope, summary: summaries.before });
      const written = await store.write(location, text);
      if (!written.ok) return err(storeProblem(written.error, scope, 'write'));
      await history.record({ content: text, kind: summaries.kind, scope, summary: summaries.after });
      return ok(true);
    });

  const preview = async (scopeText: string, edited: unknown): Promise<Result<ConfigPreview, SaveConfigError>> => {
    const prepared = await prepare(scopeText, edited);
    if (!prepared.ok) return prepared;
    const { location, proposed, scope, warnings } = prepared.value;
    if (!proposed.ok) return ok({ diff: [], issues: proposed.error, proposedText: null, scope, unknownKeys: [], warnings });
    const current = await currentText(location, scope);
    if (!current.ok) return current;
    const { text, unknownKeys } = proposed.value;
    return ok({ diff: lineDiff(current.value, text), issues: [], proposedText: text, scope, unknownKeys, warnings });
  };

  /** Validates and looks models up first, then replaces the file (see `replace`). A failed write records no new entry. */
  const save = async (scopeText: string, edited: unknown): Promise<Result<ConfigSaved, SaveConfigError>> => {
    const prepared = await prepare(scopeText, edited);
    if (!prepared.ok) return prepared;
    const { location, proposed, scope, warnings } = prepared.value;
    if (!proposed.ok) return err({ issues: proposed.error, scope, type: 'config_invalid' });
    const { text, unknownKeys } = proposed.value;
    const changed = await replace(location, scope, text, { after: 'Saved from the config editor', before: 'Content on disk before save (overwritten)', kind: 'config_write' });
    if (!changed.ok) return changed;
    return ok({ changed: changed.value, scope, text, unknownKeys, warnings });
  };

  /** The entry must hold config content that still parses as a config file; its own scope is the file restored. */
  const prepareRestore = async (entryId: string): Promise<Result<PreparedRestore, RestoreConfigError>> => {
    const entry = await historyReader.get(entryId);
    if (entry === undefined) return err({ id: entryId, type: 'history_entry_not_found' });
    if (entry.kind === 'run' || entry.content === null) return err({ id: entryId, kind: entry.kind, type: 'entry_not_restorable' });
    const scope = parseScope(entry.scope);
    if (!scope.ok) return scope;
    const issues = contentIssues(entry.content);
    if (issues.length > 0) return err({ issues, scope: entry.scope, type: 'config_invalid' });
    const location = await locate(scope.value);
    if (!location.ok) return location;
    return ok({ content: entry.content, entryId, location: location.value, scope: formatScope(scope.value) });
  };

  const restorePreview = async (entryId: string): Promise<Result<ConfigRestorePreview, RestoreConfigError>> => {
    const prepared = await prepareRestore(entryId);
    if (!prepared.ok) return prepared;
    const { content, location, scope } = prepared.value;
    const current = await currentText(location, scope);
    if (!current.ok) return current;
    return ok({ diff: lineDiff(current.value, content), entryId, proposedText: content, scope });
  };

  /** Same flow as save: snapshot what is on disk, write the entry's content, record it as a new `config_restore` entry (history stays append-only, so a restore is undoable). */
  const restore = async (entryId: string): Promise<Result<ConfigRestored, RestoreConfigError>> => {
    const prepared = await prepareRestore(entryId);
    if (!prepared.ok) return prepared;
    const { content, location, scope } = prepared.value;
    const summaries = { after: `Restored from history entry ${entryId}`, before: `Content on disk before restore of ${entryId}`, kind: 'config_restore' } as const;
    const changed = await replace(location, scope, content, summaries);
    if (!changed.ok) return changed;
    return ok({ changed: changed.value, restoredFrom: entryId, scope, text: content });
  };

  return { effective: effectiveView, preview, raw, restore, restorePreview, save };
}

/** One file per key: the global file, or a project file by its project path. */
const lockKey = (location: ConfigLocation) => (location.kind === 'global' ? 'global' : `project:${location.projectPath}`);

const textOf = (read: ConfigFileRead) => (read.exists ? read.text : null);

/** In-process mutex per key: tasks on one key run one after another, in call order. */
class KeyedLock {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>) {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    const tail = result.catch(() => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return result;
  }
}

function contentIssues(text: string): readonly ConfigIssue[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    return [{ message: cause instanceof Error ? cause.message : 'Invalid JSON', path: '' }];
  }
  const parsed = parseConfigFile(json);
  return parsed.ok ? [] : parsed.error;
}

function ioFailed(error: ConfigStoreError, scope: string, operation: 'read' | 'write'): ConfigIoFailed {
  return { detail: error.type === 'io_failed' ? error.detail : 'The folder no longer exists.', operation, scope, type: 'config_io_failed' };
}

function storeProblem(error: ConfigStoreError, scope: string, operation: 'read' | 'write'): ConfigIoFailed | ConfigLocationMissing {
  return error.type === 'location_missing' ? { scope, type: 'config_location_missing' } : ioFailed(error, scope, operation);
}
