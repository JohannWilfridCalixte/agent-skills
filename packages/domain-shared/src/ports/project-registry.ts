import type { Project } from '../model/project.js';

/** Read side of the known projects, for domains that resolve a project by id. Adding and removing belong to `domain-projects`. */
export interface ProjectRegistry {
  /** `undefined` when the id is unknown. */
  get(id: string): Promise<Project | undefined>;
  list(): Promise<readonly Project[]>;
}
