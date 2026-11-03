import type { HistoryLog, ProjectRegistry } from '@agentic/domain-shared';
import type { Result } from '@agentic/kernel-result';

import type { ConfigFile, ConfigIssue } from '../model/config-file.js';
import type { DiffLine } from '../model/diff.js';
import type { ConfigProjectNotFound, ReadConfigError, SaveConfigError } from '../model/errors.js';
import type { ConfigScope } from '../model/scope.js';
import type { ConfigLocation, ConfigStore } from '../ports/config-store.js';
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
  readonly current: null | string;
  readonly location: ConfigLocation;
  readonly proposed: ReturnType<typeof delta>;
  readonly scope: string;
  readonly warnings: readonly ConfigIssue[];
}

export function createConfigService({ history, models, projects, store }: ConfigServiceDependencies) {
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
    const read = await store.read(location.value);
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

  /** Resolves the scope and reads the current text without parsing it, so a broken file can still be replaced. */
  const prepare = async (scopeText: string, edited: unknown): Promise<Result<Prepared, SaveConfigError>> => {
    const scope = parseScope(scopeText);
    if (!scope.ok) return scope;
    const location = await locate(scope.value);
    if (!location.ok) return location;
    const read = await store.read(location.value);
    const current = read.exists ? read.text : null;
    const proposed = delta(edited);
    const warnings = proposed.ok ? await modelWarnings(proposed.value.values, models) : [];
    return ok({ current, location: location.value, proposed, scope: formatScope(scope.value), warnings });
  };

  const preview = async (scopeText: string, edited: unknown): Promise<Result<ConfigPreview, SaveConfigError>> => {
    const prepared = await prepare(scopeText, edited);
    if (!prepared.ok) return prepared;
    const { current, proposed, scope, warnings } = prepared.value;
    if (!proposed.ok) return ok({ diff: [], issues: proposed.error, proposedText: null, scope, unknownKeys: [], warnings });
    const { text, unknownKeys } = proposed.value;
    return ok({ diff: lineDiff(current, text), issues: [], proposedText: text, scope, unknownKeys, warnings });
  };

  /**
   * Last write wins (D12): the content on disk is snapshotted into history first when it differs,
   * then the file is written, then the new content is recorded. A failed write records no new entry.
   */
  const save = async (scopeText: string, edited: unknown): Promise<Result<ConfigSaved, SaveConfigError>> => {
    const prepared = await prepare(scopeText, edited);
    if (!prepared.ok) return prepared;
    const { current, location, proposed, scope, warnings } = prepared.value;
    if (!proposed.ok) return err({ issues: proposed.error, scope, type: 'config_invalid' });
    const { text, unknownKeys } = proposed.value;
    const saved = { scope, text, unknownKeys, warnings };
    if (current === text) return ok({ ...saved, changed: false });

    if (current !== null) await history.record({ content: current, kind: 'config_write', scope, summary: 'Content on disk before save (overwritten)' });
    await store.write(location, text);
    await history.record({ content: text, kind: 'config_write', scope, summary: 'Saved from the config editor' });
    return ok({ ...saved, changed: true });
  };

  return { effective: effectiveView, preview, raw, save };
}
