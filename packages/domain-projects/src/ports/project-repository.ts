import type { Project } from '@agentic/domain-shared';

/** Storage of the registry rows. `delete` removes the row only. */
export interface ProjectRepository {
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<Project | undefined>;
  findByPath(path: string): Promise<Project | undefined>;
  insert(project: Project): Promise<void>;
  list(): Promise<readonly Project[]>;
}
