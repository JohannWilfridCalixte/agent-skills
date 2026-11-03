import type { ConfigIssue } from './config-file.js';

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

export interface InvalidScope {
  readonly scope: string;
  readonly type: 'invalid_scope';
}

export type ReadConfigError = ConfigProjectNotFound | ConfigUnreadable | InvalidScope;
