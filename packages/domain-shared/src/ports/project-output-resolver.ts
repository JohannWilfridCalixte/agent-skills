/**
 * Where a project's work items live: the absolute `{output}` folder from its effective config, resolved against
 * the project path (default `.agentic/work`). Shared so work-items reads it without importing domain-config (D23).
 */
export interface ProjectOutputResolver {
  /** `undefined` when the project id is unknown. */
  outputDir(projectId: string): Promise<string | undefined>;
}
