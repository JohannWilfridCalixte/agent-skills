import type { WorkItemState, WorkItemSummary } from '@agentic/contract-http/work-items';

import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { ProjectSelect } from '@/features/projects/project-select';
import { useApi } from '@/lib/api-context';
import { useListQuery } from '@/lib/use-list-query';
import { ProjectList } from '@agentic/contract-http/projects';
import { WorkItemList } from '@agentic/contract-http/work-items';
import { ListState, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@agentic/design-system';

export function itemTitle(item: WorkItemSummary) {
  return item.state.readable && item.state.title !== null ? item.state.title : item.slug;
}

/** Read-only browse of a project's work items (AC18, AC20): no action is ever offered here. */
export function WorkItemsPage() {
  const api = useApi();
  const [chosenId, setChosenId] = useState<string>();
  const projects = useListQuery(['projects'], async (signal) => api.get('/projects', ProjectList, { signal }));
  const projectList = projects.query.data?.projects ?? [];
  const projectId = chosenId ?? projectList[0]?.id;

  return (
    <>
      <PageHeader description="Work items of a known project, read-only: state, timeline and docs." title="Work items" />
      {projects.query.isPending && <ListState label="Loading projects" status="loading" />}
      {projects.failure !== undefined && (
        <ListState message={projects.failure.message} nextStep={projects.failure.nextStep} onRetry={() => void projects.query.refetch()} status="error" />
      )}
      {projectList.length === 0 && projects.query.data !== undefined && (
        <ListState description="Add a project on the Projects page to browse its work items." status="empty" title="No projects yet" />
      )}
      {projectId !== undefined && (
        <>
          <ProjectSelect label="Project" onChange={setChosenId} projects={projectList} value={projectId} />
          <ProjectWorkItems key={projectId} projectId={projectId} />
        </>
      )}
    </>
  );
}

function ProjectWorkItems({ projectId }: { readonly projectId: string }) {
  const api = useApi();
  const { failure, query } = useListQuery(['work-items', projectId], async (signal) =>
    api.get(`/projects/${encodeURIComponent(projectId)}/work-items`, WorkItemList, { signal }),
  );

  if (query.isPending) return <ListState label="Loading work items" status="loading" />;
  if (failure !== undefined) return <ListState message={failure.message} nextStep={failure.nextStep} onRetry={() => void query.refetch()} status="error" />;
  if (query.data === undefined || query.data.items.length === 0) {
    return <ListState description="Work items appear here once an agentic workflow runs in this project." status="empty" title="No work items" />;
  }

  const active = query.data.items.filter((item) => !item.archived);
  const archived = query.data.items.filter((item) => item.archived);
  return (
    <>
      <WorkItemTable items={active} projectId={projectId} title="Active work items" />
      {archived.length > 0 && <WorkItemTable items={archived} projectId={projectId} title="Archived work items" />}
    </>
  );
}

function StateCells({ state }: { readonly state: WorkItemState }) {
  if (!state.readable) {
    return (
      <TableCell className="text-sm text-muted-foreground" colSpan={3}>
        {`Unreadable: ${state.reason}`}
      </TableCell>
    );
  }
  return (
    <>
      <TableCell>{state.status ?? '—'}</TableCell>
      <TableCell>{state.phase ?? '—'}</TableCell>
      <TableCell>{state.updated ?? '—'}</TableCell>
    </>
  );
}

function WorkItemTable({ items, projectId, title }: { readonly items: readonly WorkItemSummary[]; readonly projectId: string; readonly title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0
        ? (
            <p className="text-sm text-muted-foreground">None.</p>
          )
        : (
            <Table aria-label={title}>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.slug}>
                    <TableCell>
                      <Link className="font-medium text-primary underline" params={{ projectId, slug: item.slug }} to="/work-items/$projectId/$slug">
                        {itemTitle(item)}
                      </Link>
                    </TableCell>
                    <StateCells state={item.state} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
    </section>
  );
}
