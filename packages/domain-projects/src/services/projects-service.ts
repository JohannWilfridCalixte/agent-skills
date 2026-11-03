import type { ProjectRegistry } from '@agentic/domain-shared';

import type { DirectoryProbe } from '../ports/directory-probe.js';
import type { ProjectRepository } from '../ports/project-repository.js';

import { err, ok } from '@agentic/kernel-result';

import { normalizeProjectPath } from '../model/project-path.js';

export type ProjectsService = ReturnType<typeof createProjectsService>;

export interface ProjectsServiceDependencies {
  readonly directoryProbe: DirectoryProbe;
  readonly newId: () => string;
  readonly now: () => Date;
  readonly repository: ProjectRepository;
}

/** Known projects. Implements the shared `ProjectRegistry` read port; never touches project files. */
export function createProjectsService({ directoryProbe, newId, now, repository }: ProjectsServiceDependencies) {
  const add = async (rawPath: string) => {
    const path = normalizeProjectPath(rawPath);
    if (path === undefined) return err({ path: rawPath, type: 'path_not_absolute' });

    const kind = await directoryProbe.kind(path);
    switch (kind) {
      case 'directory': {
        break;
      }
      case 'missing': {
        return err({ path, type: 'path_not_found' });
      }
      case 'other': {
        return err({ path, type: 'path_not_directory' });
      }
      default: {
        return kind satisfies never;
      }
    }

    const existing = await repository.findByPath(path);
    if (existing !== undefined) return err({ path, projectId: existing.id, type: 'project_already_known' });

    const project = { createdAt: now().toISOString(), id: newId(), path };
    await repository.insert(project);
    return ok(project);
  };

  const remove = async (id: string) => {
    const deleted = await repository.delete(id);
    return deleted ? ok(id) : err({ id, type: 'project_not_found' });
  };

  const registry = {
    get: (id: string) => repository.findById(id),
    list: () => repository.list(),
  } satisfies ProjectRegistry;

  return { ...registry, add, remove };
}
