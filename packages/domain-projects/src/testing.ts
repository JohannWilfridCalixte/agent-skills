import type { Project } from '@agentic/domain-shared';

import type { DirectoryProbe, PathKind } from './ports/directory-probe.js';
import type { ProjectRepository } from './ports/project-repository.js';

/** Answers from a fixed map; unlisted paths are `missing`. */
export class FakeDirectoryProbe implements DirectoryProbe {
  private readonly kinds: ReadonlyMap<string, PathKind>;

  constructor(kinds: Readonly<Record<string, PathKind>> = {}) {
    this.kinds = new Map(Object.entries(kinds));
  }

  kind(path: string) {
    return Promise.resolve(this.kinds.get(path) ?? 'missing');
  }
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly rows = new Map<string, Project>();

  delete(id: string) {
    return Promise.resolve(this.rows.delete(id));
  }

  findById(id: string) {
    return Promise.resolve(this.rows.get(id));
  }

  findByPath(path: string) {
    return Promise.resolve([...this.rows.values()].find((project) => project.path === path));
  }

  insert(project: Project) {
    this.rows.set(project.id, project);
    return Promise.resolve();
  }

  list() {
    return Promise.resolve([...this.rows.values()].sort((a, b) => a.path.localeCompare(b.path)));
  }
}
