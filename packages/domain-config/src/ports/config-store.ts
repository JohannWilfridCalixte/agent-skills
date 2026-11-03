export type ConfigFileRead = { readonly exists: false } | { readonly exists: true; readonly text: string };

/**
 * Where a config file lives, resolved by the domain: never a client-supplied path (D31).
 * `global` → `<AGENTIC_HOME or ~/.agentic>/config.json`; `project` → `<known project path>/.agentic.json`.
 */
export type ConfigLocation = { readonly kind: 'global' } | { readonly kind: 'project'; readonly projectPath: string };

/**
 * Raw config file access (D39). Read-only for now; T7 adds `write(location, text)` with atomic
 * temp-and-rename semantics and kept file mode, so callers only ever hand over a `ConfigLocation`.
 */
export interface ConfigStore {
  /** A missing file is `{ exists: false }`; other I/O failures reject. */
  read(location: ConfigLocation): Promise<ConfigFileRead>;
}
