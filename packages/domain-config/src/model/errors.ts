import type { ConfigIssue } from './config-file.js';

/** The edited config breaks the schema; save is blocked (D14). */
export interface ConfigInvalid {
  readonly issues: readonly ConfigIssue[];
  readonly scope: string;
  readonly type: 'config_invalid';
}

/** Reading or writing the file failed for a reason other than a missing folder (permissions, disk). */
export interface ConfigIoFailed {
  readonly detail: string;
  readonly operation: 'read' | 'write';
  readonly scope: string;
  readonly type: 'config_io_failed';
}

/** The project folder no longer exists; a project file is never created with its folder. */
export interface ConfigLocationMissing {
  readonly scope: string;
  readonly type: 'config_location_missing';
}

export interface ConfigProjectNotFound {
  readonly projectId: string;
  readonly type: 'project_not_found';
}

/** The file exists but is not valid JSON, or does not match the config schema. Never a crash. */
export interface ConfigUnreadable {
  readonly detail: string;
  /** Field-level issues when `reason` is `invalid_schema`. */
  readonly issues: readonly ConfigIssue[];
  readonly reason: 'invalid_json' | 'invalid_schema';
  /** `global` or `project:<id>` of the unreadable file. */
  readonly scope: string;
  readonly type: 'config_unreadable';
}

/** The entry holds no config content (a run), so there is nothing to restore. */
export interface EntryNotRestorable {
  readonly id: string;
  readonly kind: string;
  readonly type: 'entry_not_restorable';
}

/** No history entry has this id. */
export interface HistoryEntryNotFound {
  readonly id: string;
  readonly type: 'history_entry_not_found';
}

export interface InvalidScope {
  readonly scope: string;
  readonly type: 'invalid_scope';
}

export type ReadConfigError = ConfigIoFailed | ConfigProjectNotFound | ConfigUnreadable | InvalidScope;

/** Errors of restore preview and restore; `config_invalid` when the stored content no longer parses as a config file. */
export type RestoreConfigError = ConfigInvalid | ConfigIoFailed | ConfigLocationMissing | ConfigProjectNotFound | EntryNotRestorable | HistoryEntryNotFound | InvalidScope;

/** Errors of preview and save: the scope must resolve; save also needs a valid config. */
export type SaveConfigError = ConfigInvalid | ConfigIoFailed | ConfigLocationMissing | ConfigProjectNotFound | InvalidScope;
