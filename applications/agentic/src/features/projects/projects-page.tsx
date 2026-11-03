import type { Project } from '@agentic/contract-http/projects';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { emptyResponse } from '@/lib/api-client';
import { useApi } from '@/lib/api-context';
import { describeApiError } from '@/lib/api-error';
import { useListQuery } from '@/lib/use-list-query';
import { ProjectList, Project as ProjectSchema } from '@agentic/contract-http/projects';
import {
  Button,
  Callout,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  ListState,
  PageHeader,
} from '@agentic/design-system';

const PROJECTS_KEY = ['projects'] as const;

export function ProjectsPage() {
  const api = useApi();
  const { failure, query } = useListQuery(PROJECTS_KEY, async (signal) => api.get('/projects', ProjectList, { signal }));

  return (
    <>
      <PageHeader description="Folders whose `.agentic.json` you can edit." title="Projects" />
      <AddProjectForm />
      {query.isPending && <ListState label="Loading projects" status="loading" />}
      {failure !== undefined && (
        <ListState message={failure.message} nextStep={failure.nextStep} onRetry={() => void query.refetch()} status="error" />
      )}
      {query.data?.projects.length === 0 && (
        <ListState description="Add a project folder above to edit its config here." status="empty" title="No projects yet" />
      )}
      {query.data !== undefined && query.data.projects.length > 0 && (
        <ul aria-label="Projects" className="flex flex-col gap-2">
          {query.data.projects.map((project) => (
            <li className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3" key={project.id}>
              <span className="font-mono text-sm break-all">{project.path}</span>
              <RemoveProjectButton project={project} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AddProjectForm() {
  const api = useApi();
  const queryClient = useQueryClient();
  const inputId = useId();
  const errorId = useId();
  const [path, setPath] = useState('');
  const add = useMutation({
    mutationFn: async (folder: string) => api.post('/projects', { path: folder }, ProjectSchema),
    onSuccess: async (result) => {
      if (!result.ok) return;
      setPath('');
      await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
  const failure = add.data !== undefined && !add.data.ok ? describeApiError(add.data.error) : undefined;

  return (
    <form
      className="mb-6 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (path.trim() !== '') add.mutate(path.trim());
      }}
    >
      <Label htmlFor={inputId}>Project folder</Label>
      <div className="flex gap-2">
        <Input
          aria-describedby={failure === undefined ? undefined : errorId}
          aria-invalid={failure !== undefined}
          className="font-mono"
          id={inputId}
          onChange={(event) => {
            setPath(event.target.value);
          }}
          placeholder="/absolute/path/to/project"
          value={path}
        />
        <Button disabled={add.isPending || path.trim() === ''} type="submit">
          Add project
        </Button>
      </div>
      {failure !== undefined && (
        <p className="text-sm text-danger" id={errorId} role="alert">
          {failure.message}
        </p>
      )}
    </form>
  );
}

function RemoveProjectButton({ project }: { readonly project: Project }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useMutation({
    mutationFn: async () => api.delete(`/projects/${encodeURIComponent(project.id)}`, emptyResponse),
    onSuccess: async (result) => {
      if (!result.ok) return;
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
  const failure = remove.data !== undefined && !remove.data.ok ? describeApiError(remove.data.error) : undefined;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button aria-label={`Remove ${project.path}`} size="sm" variant="outline">
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove project?</DialogTitle>
          <DialogDescription>
            <span className="font-mono break-all">{project.path}</span>
            {' '}
            leaves the project list. Project files are not touched: its
            `.agentic.json` and work items stay on disk.
          </DialogDescription>
        </DialogHeader>
        {failure !== undefined && (
          <Callout title="Could not remove the project" tone="error">
            {failure.message} {failure.nextStep}
          </Callout>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate();
            }}
            variant="destructive"
          >
            Remove project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
