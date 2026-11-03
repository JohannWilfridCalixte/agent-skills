export interface Database {
  history: HistoryTable;
  projects: ProjectsTable;
}

export interface HistoryTable {
  content: null | string;
  created_at: string;
  exit_code: null | number;
  id: string;
  kind: 'config_restore' | 'config_write' | 'run';
  output_tail: null | string;
  scope: string;
  summary: string;
  /** sqlite boolean: 0 or 1. */
  truncated: number;
}

/** Hand-written table types (D22, no codegen); keep in sync with `migrations/`. */
export interface ProjectsTable {
  created_at: string;
  id: string;
  path: string;
}
