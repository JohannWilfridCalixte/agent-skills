import type { Context, Hono } from 'hono';

import type { ProjectList } from '@agentic/contract-http/projects';
import type { AddProjectError, ProjectsService, RemoveProjectError } from '@agentic/domain-projects';

import type { AppEnv } from '../../platform/app-env.js';

import { AddProjectRequest } from '@agentic/contract-http/projects';

import { problem } from '../../platform/problem.js';
import { validate } from '../../platform/validation.js';

/** Mounted under `/api/projects`. */
export function registerProjectsRoutes(app: Hono<AppEnv>, service: ProjectsService) {
  app.get('/', async (c) => c.json({ projects: [...(await service.list())] } satisfies ProjectList));

  app.post('/', validate('json', AddProjectRequest), async (c) => {
    const added = await service.add(c.req.valid('json').path);
    if (!added.ok) return projectsProblem(c, added.error);
    return c.json(added.value, 201);
  });

  app.delete('/:id', async (c) => {
    const removed = await service.remove(c.req.param('id'));
    if (!removed.ok) return projectsProblem(c, removed.error);
    return c.body(null, 204);
  });
}

function projectsProblem(c: Context<AppEnv>, error: AddProjectError | RemoveProjectError) {
  switch (error.type) {
    case 'path_not_absolute': {
      return problem(c, { detail: 'The project path must be absolute.', status: 422, title: 'Path not absolute', type: error.type });
    }
    case 'path_not_directory': {
      return problem(c, { detail: 'The project path is not a directory.', status: 422, title: 'Path not a directory', type: error.type });
    }
    case 'path_not_found': {
      return problem(c, { detail: 'The project path does not exist.', status: 422, title: 'Path not found', type: error.type });
    }
    case 'project_already_known': {
      return problem(c, { detail: `Already registered as ${error.projectId}.`, status: 409, title: 'Project already known', type: error.type });
    }
    case 'project_not_found': {
      return problem(c, { status: 404, title: 'Project not found', type: error.type });
    }
    default: {
      return error satisfies never;
    }
  }
}
