export type ConfigFileRead = { readonly exists: false } | { readonly exists: true; readonly text: string };

/**
 * Where a config file lives, resolved by the domain: never a client-supplied path (D31).
 * `global` → `<AGENTIC_HOME or ~/.agentic>/config.json`; `project` → `<known project path>/.agentic.json`.
 */
export type ConfigLocation = { readonly kind: 'global' } | { readonly kind: 'project'; readonly projectPath: string };

/** Raw config file access (D39); callers only ever hand over a `ConfigLocation`, never a path. */
export interface ConfigStore {
  /** A missing file is `{ exists: false }`; other I/O failures reject. */
  read(location: ConfigLocation): Promise<ConfigFileRead>;
  /**
   * Replaces the file atomically (temp file in the same directory, then rename), keeping its mode.
   * May create the global directory, never a project directory. Failures reject and leave the file as it was.
   */
  write(location: ConfigLocation, text: string): Promise<void>;
}
