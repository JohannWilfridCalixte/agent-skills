import type { RunPlan } from '@/features/runs/confirm-run-dialog';
import type { ApiClient } from '@/lib/api-client';
import type { ApiError } from '@/lib/api-error';
import type { VendoredSkill, VendoringRequest } from '@agentic/contract-http/vendoring';

import { useState } from 'react';

import { ProjectSelect } from '@/features/projects/project-select';
import { ConfirmRunDialog } from '@/features/runs/confirm-run-dialog';
import { RunPanel } from '@/features/runs/run-panel';
import { useApi } from '@/lib/api-context';
import { describeApiError } from '@/lib/api-error';
import { useListQuery } from '@/lib/use-list-query';
import { ProjectList } from '@agentic/contract-http/projects';
import { VendoringPreviewResponse, VendoringResultsResponse, VendoringRunResponse, VendoringStatusResponse } from '@agentic/contract-http/vendoring';
import { Badge, Button, ListState, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@agentic/design-system';

const NO_POLLING = { refetchInterval: false, refetchOnReconnect: false, refetchOnWindowFocus: false, staleTime: Number.POSITIVE_INFINITY } as const;

const RESULT_BADGES = { drift: 'warning', error: 'danger', ok: 'success' } as const;

interface ActiveRun extends PlannedVendoring {
  readonly runId: string;
}

interface PlannedVendoring {
  readonly label: string;
  readonly request: VendoringRequest;
}

/**
 * Vendored skills of agentic source checkouts (AC21, AC22). The nav item always shows; a project without
 * `vendor.json` gets an explanatory empty state rather than an error.
 */
export function VendoringPage() {
  const api = useApi();
  const [chosenId, setChosenId] = useState<string>();
  const projects = useListQuery(['projects'], async (signal) => api.get('/projects', ProjectList, { signal }));
  const projectList = projects.query.data?.projects ?? [];
  const projectId = chosenId ?? projectList[0]?.id;

  return (
    <>
      <PageHeader
        description="Check, verify and update vendored skills. Only agentic source checkouts carry a vendor.json; nothing runs before you confirm the exact command."
        title="Vendoring"
      />
      {projects.query.isPending && <ListState label="Loading projects" status="loading" />}
      {projects.failure !== undefined && (
        <ListState message={projects.failure.message} nextStep={projects.failure.nextStep} onRetry={() => void projects.query.refetch()} status="error" />
      )}
      {projectList.length === 0 && projects.query.data !== undefined && (
        <ListState description="Add your agentic source checkout on the Projects page." status="empty" title="No projects yet" />
      )}
      {projectId !== undefined && (
        <>
          <ProjectSelect label="Project" onChange={setChosenId} projects={projectList} value={projectId} />
          <ProjectVendoring key={projectId} projectId={projectId} />
        </>
      )}
    </>
  );
}

function describeVendoringError(error: ApiError) {
  const described = describeApiError(error);
  if (error.type !== 'problem') return described;
  if (error.status === 409) return { ...described, nextStep: 'Fix vendor.json and vendor.lock.json in this project, then reload.' };
  if (error.status === 422) return { ...described, nextStep: 'Pick skills listed in vendor.json, then retry.' };
  return described;
}

function ProjectVendoring({ projectId }: { readonly projectId: string }) {
  const api = useApi();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [planned, setPlanned] = useState<PlannedVendoring>();
  const [run, setRun] = useState<ActiveRun>();
  const [finishedRunId, setFinishedRunId] = useState<string>();
  const statusPath = `/vendoring/${encodeURIComponent(projectId)}`;
  const { failure, query } = useListQuery(['vendoring-status', projectId], async (signal) => api.get(`${statusPath}/status`, VendoringStatusResponse, { signal }), NO_POLLING);

  if (query.isPending) return <ListState label="Reading vendor.json" status="loading" />;
  if (failure !== undefined) return <ListState message={failure.message} nextStep={failure.nextStep} onRetry={() => void query.refetch()} status="error" />;
  if (!query.data?.available) {
    return (
      <ListState description="Vendoring is only for agentic source checkouts, which keep a vendor.json at their root. Pick another project." status="empty" title="This project has no vendor.json" />
    );
  }

  const toggle = (name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const selectedNames = query.data.skills.map((skill) => skill.name).filter((name) => selected.has(name));

  return (
    <>
      <SkillsTable onToggle={toggle} selected={selected} skills={query.data.skills} />
      <div aria-label="Vendoring actions" className="flex flex-wrap items-center gap-2" role="group">
        <Button
          onClick={() => {
            setPlanned({ label: 'Check vendored skills', request: { action: 'check' } });
          }}
          variant="outline"
        >
          Check
        </Button>
        <Button
          onClick={() => {
            setPlanned({ label: 'Verify vendored skills', request: { action: 'verify' } });
          }}
          variant="outline"
        >
          Verify
        </Button>
        <Button
          disabled={selectedNames.length === 0}
          onClick={() => {
            setPlanned({ label: `Update ${selectedNames.join(', ')}`, request: { action: 'update', skills: selectedNames } });
          }}
          variant="outline"
        >
          Update selected
        </Button>
        <Button
          onClick={() => {
            setPlanned({ label: 'Update all vendored skills', request: { action: 'update', all: true } });
          }}
          variant="outline"
        >
          Update all
        </Button>
        {selectedNames.length === 0 && <span className="text-sm text-muted-foreground">Select skills to update them one by one.</span>}
      </div>
      <ConfirmRunDialog
        onClose={() => {
          setPlanned(undefined);
        }}
        onStarted={(runId) => {
          if (planned !== undefined) setRun({ ...planned, runId });
          setFinishedRunId(undefined);
          setPlanned(undefined);
        }}
        plan={planned === undefined ? undefined : vendoringPlan(api, statusPath, planned)}
      />
      {run !== undefined && (
        <RunPanel
          key={run.runId}
          onFinished={() => {
            setFinishedRunId(run.runId);
            void query.refetch();
          }}
          onRunAgain={() => {
            setPlanned(run);
          }}
          runId={run.runId}
          title={run.label}
        />
      )}
      {run !== undefined && run.request.action !== 'update' && finishedRunId === run.runId && <SkillResults path={`${statusPath}/runs/${encodeURIComponent(run.runId)}/results`} />}
    </>
  );
}

function SkillResults({ path }: { readonly path: string }) {
  const api = useApi();
  const { failure, query } = useListQuery(['vendoring-results', path], async (signal) => api.get(path, VendoringResultsResponse, { signal }), NO_POLLING);

  if (query.isPending) return <ListState label="Reading per-skill results" status="loading" />;
  if (failure !== undefined) return <ListState message={failure.message} nextStep={failure.nextStep} onRetry={() => void query.refetch()} status="error" />;
  if (query.data === undefined || query.data.results.length === 0) {
    return <ListState description="The run reported no per-skill result; read its output above." status="empty" title="No skill results" />;
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Results</h2>
      <Table aria-label="Skill results">
        <TableHeader>
          <TableRow>
            <TableHead>Skill</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data.results.map((result) => (
            <TableRow aria-label={result.name} key={result.name}>
              <TableCell className="font-medium">{result.name}</TableCell>
              <TableCell>
                <Badge variant={RESULT_BADGES[result.status]}>{result.status}</Badge>
              </TableCell>
              <TableCell className="text-sm">{result.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function SkillsTable({ onToggle, selected, skills }: { readonly onToggle: (name: string) => void; readonly selected: ReadonlySet<string>; readonly skills: readonly VendoredSkill[] }) {
  if (skills.length === 0) return <ListState description="Add a skill to vendor.json, then reload this page." status="empty" title="No vendored skills" />;
  return (
    <Table aria-label="Vendored skills">
      <TableHeader>
        <TableRow>
          <TableHead>Select</TableHead>
          <TableHead>Skill</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Pinned ref</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {skills.map((skill) => (
          <TableRow aria-label={skill.name} key={skill.name}>
            <TableCell>
              <input
                aria-label={`Select ${skill.name}`}
                checked={selected.has(skill.name)}
                className="size-4"
                onChange={() => {
                  onToggle(skill.name);
                }}
                type="checkbox"
              />
            </TableCell>
            <TableCell className="font-medium">{skill.name}</TableCell>
            <TableCell className="font-mono text-sm">{skill.source}</TableCell>
            <TableCell className="font-mono text-sm">{skill.ref ?? 'Not pinned'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function vendoringPlan(api: ApiClient, basePath: string, planned: PlannedVendoring) {
  return {
    describeError: describeVendoringError,
    label: planned.label,
    preview: async (signal: AbortSignal) => {
      const preview = await api.post(`${basePath}/preview`, planned.request, VendoringPreviewResponse, { signal });
      return preview.ok ? { ...preview, value: [preview.value.command] } : preview;
    },
    previewKey: ['vendoring', basePath, planned.request],
    start: async () => api.post(`${basePath}/runs`, { ...planned.request, confirm: true }, VendoringRunResponse),
  } satisfies RunPlan;
}
