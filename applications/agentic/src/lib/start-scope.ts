import { readStartProject } from './token';

/** The scope a page opens on: the project `agentic serve` started in (AC1), else global. */
export function startScope() {
  const projectId = readStartProject(globalThis.window);
  return projectId === undefined ? 'global' : `project:${projectId}`;
}
