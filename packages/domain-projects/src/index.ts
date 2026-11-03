export type { AddProjectError, PathNotAbsolute, PathNotDirectory, PathNotFound, ProjectAlreadyKnown, ProjectNotFound, RemoveProjectError } from './model/errors.js';
export { normalizeProjectPath } from './model/project-path.js';
export type { DirectoryProbe, PathKind } from './ports/directory-probe.js';
export type { ProjectRepository } from './ports/project-repository.js';
export type { ProjectsService, ProjectsServiceDependencies } from './services/projects-service.js';
export { createProjectsService } from './services/projects-service.js';
