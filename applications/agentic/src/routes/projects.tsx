import { createFileRoute } from '@tanstack/react-router';

import { useApi } from '@/lib/api-context';
import { useListQuery } from '@/lib/use-list-query';
import { ProjectList } from '@agentic/contract-http/projects';
import { ListState, PageHeader } from '@agentic/design-system';

function ProjectsPage() {
  const api = useApi();
  const { failure, query } = useListQuery(['projects'], async (signal) => api.get('/projects', ProjectList, { signal }));

  return (
    <>
      <PageHeader description="Folders whose `.agentic.json` you can edit." title="Projects" />
      {query.isPending && <ListState label="Loading projects" status="loading" />}
      {failure !== undefined && (
        <ListState message={failure.message} nextStep={failure.nextStep} onRetry={() => void query.refetch()} status="error" />
      )}
      {query.data?.projects.length === 0 && (
        <ListState description="Add a project folder to edit its config here." status="empty" title="No projects yet" />
      )}
      {query.data !== undefined && query.data.projects.length > 0 && (
        <ul className="flex flex-col gap-2">
          {query.data.projects.map((project) => (
            <li className="rounded-lg border bg-card px-4 py-3 font-mono text-sm" key={project.id}>
              {project.path}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export const Route = createFileRoute('/projects')({ component: ProjectsPage });
