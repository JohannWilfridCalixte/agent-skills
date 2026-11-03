import type { ApiClient } from '@/lib/api-client';
import type { InstallStatusEntry } from '@agentic/contract-http/install';

import type { PlannedAction, SkillsScope } from './install-actions';

import { useId, useState } from 'react';

import { ConfirmRunDialog } from '@/features/runs/confirm-run-dialog';
import { RunPanel } from '@/features/runs/run-panel';
import { useApi } from '@/lib/api-context';
import { useListQuery } from '@/lib/use-list-query';
import { HarnessesResponse, InstallPreviewResponse, InstallRunResponse, InstallStatusResponse } from '@agentic/contract-http/install';
import { ProjectList } from '@agentic/contract-http/projects';
import { Badge, Button, ListState, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@agentic/design-system';

import { actionsFor, describeInstallError, methodLabel } from './install-actions';

/** Status is computed on request only: load once, refresh on demand, never poll (AC11). */
const NO_POLLING = { refetchInterval: false, refetchOnReconnect: false, refetchOnWindowFocus: false, staleTime: Number.POSITIVE_INFINITY } as const;

const STATE_BADGES = {
  installed: { label: 'Installed', variant: 'success' },
  not_installed: { label: 'Not installed', variant: 'outline' },
  unknown: { label: 'Unknown', variant: 'warning' },
} as const satisfies Record<InstallStatusEntry['state'], { readonly label: string; readonly variant: string }>;

interface ActiveRun {
  readonly planned: PlannedAction;
  readonly runId: string;
}

interface StatusTableProps {
  readonly onAction: (planned: PlannedAction) => void;
  readonly scope: SkillsScope;
  readonly status: ReturnType<typeof useInstallStatus>;
}

export function InstallPage() {
  const api = useApi();
  const [scope, setScope] = useState<SkillsScope>({ kind: 'global' });
  const [planned, setPlanned] = useState<PlannedAction>();
  const [run, setRun] = useState<ActiveRun>();
  const status = useInstallStatus(scope);

  return (
    <>
      <PageHeader description="Install and update agentic for each harness. Nothing runs before you confirm the exact commands." title="Install" />
      <HarnessSection />
      <section aria-labelledby="install-status-title" className="mt-8 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <h2 className="text-lg font-semibold" id="install-status-title">
            Install status
          </h2>
          <ScopeSelect onChange={setScope} scope={scope} />
          <Button className="ml-auto" disabled={status.query.isFetching} onClick={() => void status.query.refetch()} size="sm" variant="outline">
            Refresh status
          </Button>
        </div>
        <StatusTable onAction={setPlanned} scope={scope} status={status} />
      </section>
      <ConfirmRunDialog
        onClose={() => {
          setPlanned(undefined);
        }}
        onStarted={(runId) => {
          if (planned !== undefined) setRun({ planned, runId });
          setPlanned(undefined);
        }}
        plan={planned === undefined ? undefined : installPlan(api, planned)}
      />
      {run !== undefined && (
        <RunPanel
          key={run.runId}
          onFinished={() => void status.query.refetch()}
          onRunAgain={() => {
            setPlanned(run.planned);
          }}
          runId={run.runId}
          title={run.planned.label}
        />
      )}
    </>
  );
}

function HarnessSection() {
  const api = useApi();
  const { failure, query } = useListQuery(['install-harnesses'], async (signal) => api.get('/install/harnesses', HarnessesResponse, { signal }), NO_POLLING);

  return (
    <section aria-labelledby="harnesses-title" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold" id="harnesses-title">
        Harnesses
      </h2>
      {query.isPending && <ListState label="Detecting harnesses" status="loading" />}
      {failure !== undefined && <ListState message={failure.message} nextStep={failure.nextStep} onRetry={() => void query.refetch()} status="error" />}
      {query.data?.harnesses.length === 0 && <ListState description="Install Cursor, Claude Code or Codex, then reload this page." status="empty" title="No harnesses reported" />}
      {query.data !== undefined && query.data.harnesses.length > 0 && (
        <ul aria-label="Harnesses" className="grid gap-2 sm:grid-cols-3">
          {query.data.harnesses.map((harness) => (
            <li aria-label={harness.harness} className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3" key={harness.harness}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{harness.harness}</span>
                <Badge variant={harness.present ? 'success' : 'outline'}>{harness.present ? 'Present' : 'Absent'}</Badge>
              </div>
              <span className="text-sm text-muted-foreground">{harness.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function installPlan(api: ApiClient, planned: PlannedAction) {
  return {
    describeError: describeInstallError,
    label: planned.label,
    preview: async (signal: AbortSignal) => {
      const preview = await api.post('/install/preview', planned.request, InstallPreviewResponse, { signal });
      return preview.ok ? { ...preview, value: preview.value.commands } : preview;
    },
    previewKey: ['install', planned.request],
    start: async () => api.post('/install/runs', { ...planned.request, confirm: true }, InstallRunResponse),
  };
}

function ScopeSelect({ onChange, scope }: { readonly onChange: (scope: SkillsScope) => void; readonly scope: SkillsScope }) {
  const api = useApi();
  const selectId = useId();
  const { query } = useListQuery(['projects'], async (signal) => api.get('/projects', ProjectList, { signal }));
  const projects = query.data?.projects ?? [];

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={selectId}>
        Skills CLI scope
      </label>
      <select
        className="h-9 rounded-md border bg-background px-3 text-sm"
        id={selectId}
        onChange={(event) => {
          const project = projects.find((candidate) => candidate.id === event.target.value);
          onChange(project === undefined ? { kind: 'global' } : { kind: 'project', path: project.path, projectId: project.id });
        }}
        value={scope.kind === 'project' ? scope.projectId : 'global'}
      >
        <option value="global">Global</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.path}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusTable({ onAction, scope, status: { failure, query } }: StatusTableProps) {
  if (query.isPending) return <ListState label="Checking install status" status="loading" />;
  if (failure !== undefined) return <ListState message={failure.message} nextStep={failure.nextStep} onRetry={() => void query.refetch()} status="error" />;
  if (query.data === undefined || query.data.statuses.length === 0) {
    return <ListState description="Use Refresh status after installing a harness CLI." status="empty" title="No install methods reported" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Method</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {query.data.statuses.map((entry) => {
          const label = methodLabel(entry, scope);
          const badge = STATE_BADGES[entry.state];
          return (
            <TableRow aria-label={label} key={`${entry.method}-${entry.harness ?? ''}-${entry.scope ?? ''}`}>
              <TableCell className="font-medium">{label}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {entry.updateAvailable === true && <Badge variant="warning">Update available</Badge>}
                </div>
                {entry.reason !== undefined && <p className="mt-1 text-xs text-muted-foreground">{entry.reason}</p>}
              </TableCell>
              <TableCell className="font-mono text-sm">{entry.version ?? '—'}</TableCell>
              <TableCell>
                {entry.available
                  ? (
                      <div className="flex flex-wrap gap-2">
                        {actionsFor(entry, scope).map((action) => (
                          <Button
                            aria-label={action.label}
                            key={action.label}
                            onClick={() => {
                              onAction(action);
                            }}
                            size="sm"
                            variant="outline"
                          >
                            {action.short}
                          </Button>
                        ))}
                      </div>
                    )
                  : (
                      <span className="text-sm text-muted-foreground">Not offered on this machine</span>
                    )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function useInstallStatus(scope: SkillsScope) {
  const api = useApi();
  const search = scope.kind === 'project' ? `?scope=project&projectId=${encodeURIComponent(scope.projectId)}` : '';
  return useListQuery(['install-status', search], async (signal) => api.get(`/install/status${search}`, InstallStatusResponse, { signal }), NO_POLLING);
}
