import type { Project } from '../model/project.js';

/** Known projects. Refined in T4. */
export interface ProjectRegistry {
  add(path: string): Promise<Project>;
  list(): Promise<readonly Project[]>;
  /** Deletes the row only; returns false when the id is unknown. */
  remove(id: string): Promise<boolean>;
}
