import type { ProjectRepository } from '@agentic/domain-projects';
import type { Project } from '@agentic/domain-shared';

import type { AppDatabase } from '../../../platform/db/db.js';
import type { ProjectsTable } from '../../../platform/db/schema.js';

const toProject = (row: ProjectsTable) => ({ createdAt: row.created_at, id: row.id, path: row.path }) satisfies Project;

/** `projects` table (D6); `delete` removes the registry row only. */
export function createProjectRepository(db: AppDatabase) {
  return {
    delete: async (id) => {
      const result = await db.deleteFrom('projects').where('id', '=', id).executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
    findById: async (id) => {
      const row = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst();
      return row === undefined ? undefined : toProject(row);
    },
    findByPath: async (path) => {
      const row = await db.selectFrom('projects').selectAll().where('path', '=', path).executeTakeFirst();
      return row === undefined ? undefined : toProject(row);
    },
    insert: async (project) => {
      await db.insertInto('projects').values({ created_at: project.createdAt, id: project.id, path: project.path }).execute();
    },
    list: async () => {
      const rows = await db.selectFrom('projects').selectAll().orderBy('path').execute();
      return rows.map(toProject);
    },
  } satisfies ProjectRepository;
}
