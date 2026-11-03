import type { ApiError } from '@/lib/api-error';
import type { HistoryEntry, HistoryKind } from '@agentic/contract-http/history';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ProjectSelect } from '@/features/projects/project-select';
import { useApi } from '@/lib/api-context';
import { ApiRequestError, describeApiError, unwrap } from '@/lib/api-error';
import { useListQuery } from '@/lib/use-list-query';
import { ConfigRestorePreviewResponse, ConfigRestoreResponse } from '@agentic/contract-http/config';
import { HistoryList } from '@agentic/contract-http/history';
import { ProjectList } from '@agentic/contract-http/projects';
import { Badge, Button, Callout, DiffViewer, ListState, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@agentic/design-system';

const KIND_BADGES = {
  config_restore: 'teal',
  config_write: 'outline',
  run: 'warning',
} as const satisfies Record<HistoryKind, string>;

const formatTime = (iso: string) => new Date(iso).toLocaleString();

export function HistoryPage() {
  const api = useApi();
  const [scope, setScope] = useState('global');
  const [selectedId, setSelectedId] = useState<string>();
  const projects = useListQuery(['projects'], async (signal) => api.get('/projects', ProjectList, { signal }));
  const history = useListQuery(['history', scope], async (signal) => api.get(`/history?scope=${encodeURIComponent(scope)}`, HistoryList, { signal }));
  const selected = history.query.data?.entries.find((entry) => entry.id === selectedId);

  return (
    <>
      <PageHeader description="Config changes and runs, newest first. A config entry can be restored after reviewing the diff." title="History" />
      <ProjectSelect
        includeGlobal
        label="Scope"
        onChange={(value) => {
          setScope(value);
          setSelectedId(undefined);
        }}
        projects={projects.query.data?.projects ?? []}
        value={scope}
      />
      {history.query.isPending && <ListState label="Loading history" status="loading" />}
      {history.failure !== undefined && (
        <ListState message={history.failure.message} nextStep={history.failure.nextStep} onRetry={() => void history.query.refetch()} status="error" />
      )}
      {history.query.data?.entries.length === 0 && <ListState description="Config saves, restores and runs in this scope appear here." status="empty" title="No history yet" />}
      {history.query.data !== undefined && history.query.data.entries.length > 0 && <HistoryTable entries={history.query.data.entries} onView={setSelectedId} />}
      {selected !== undefined && <EntryDetail entry={selected} key={selected.id} />}
    </>
  );
}

function describeRestoreError(error: ApiError) {
  const described = describeApiError(error);
  if (error.type !== 'problem') return described;
  if (error.status === 404) return { ...described, nextStep: 'This entry no longer exists: refresh the history and pick another one.' };
  if (error.status === 422) return { ...described, nextStep: 'This entry cannot be restored: pick another config entry.' };
  return described;
}

function EntryDetail({ entry }: { readonly entry: HistoryEntry }) {
  const isRun = entry.kind === 'run';
  return (
    <section aria-labelledby="entry-details-title" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold" id="entry-details-title">
        Entry details
      </h2>
      <p className="text-sm text-muted-foreground">{`${entry.summary} · ${formatTime(entry.createdAt)}`}</p>
      {isRun && entry.truncated && (
        <Callout title="Output truncated" tone="warning">
          Only the end of the output was kept.
        </Callout>
      )}
      <pre
        aria-label={isRun ? 'Run output' : 'Config content'}
        className="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap"
        // A scrollable region must be focusable so keyboard users can scroll it.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        {(isRun ? entry.outputTail : entry.content) ?? ''}
      </pre>
      {!isRun && <RestoreSection entryId={entry.id} />}
    </section>
  );
}

function HistoryTable({ entries, onView }: { readonly entries: readonly HistoryEntry[]; readonly onView: (id: string) => void }) {
  return (
    <Table aria-label="History entries">
      <TableHeader>
        <TableRow>
          <TableHead>Kind</TableHead>
          <TableHead>Summary</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow aria-label={entry.summary} key={entry.id}>
            <TableCell>
              <Badge variant={KIND_BADGES[entry.kind]}>{entry.kind}</Badge>
            </TableCell>
            <TableCell className="font-medium">{entry.summary}</TableCell>
            <TableCell>
              <time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2 text-sm">
                {entry.exitCode !== null && <span>{`Exit code ${String(entry.exitCode)}`}</span>}
                {entry.kind === 'run' && entry.truncated && <Badge variant="outline">Output truncated</Badge>}
              </div>
            </TableCell>
            <TableCell>
              <Button
                aria-label={`View ${entry.summary}`}
                onClick={() => {
                  onView(entry.id);
                }}
                size="sm"
                variant="outline"
              >
                View
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Restore is a config write: preview the diff first (nothing written), then confirm (AC17). */
function RestoreSection({ entryId }: { readonly entryId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const path = `/config/restore/${encodeURIComponent(entryId)}`;
  const preview = useMutation({ mutationFn: async () => unwrap(await api.post(`${path}/preview`, {}, ConfigRestorePreviewResponse)) });
  const restore = useMutation({
    mutationFn: async () => unwrap(await api.post(path, {}, ConfigRestoreResponse)),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['history'] }),
  });
  const failure = toFailure(preview.error) ?? toFailure(restore.error);

  if (restore.data !== undefined) {
    return (
      <Callout title="Restored" tone="info">
        {restore.data.changed
          ? 'The file now holds this version. The content it replaced was saved as a new history entry, so this restore can itself be undone from History.'
          : 'The file already held this version: nothing was written.'}
      </Callout>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {failure !== undefined && (
        <Callout title="Cannot restore this entry" tone="error">
          <p>{failure.message}</p>
          <p className="mt-1">{failure.nextStep}</p>
        </Callout>
      )}
      {preview.data === undefined
        ? (
            <Button
              className="self-start"
              disabled={preview.isPending}
              onClick={() => {
                preview.mutate();
              }}
              variant="outline"
            >
              Restore this version
            </Button>
          )
        : (
            <>
              <p className="text-sm">Restoring writes this version over the current file:</p>
              <DiffViewer label="Restore changes" lines={preview.data.diff.map((line) => ({ text: line.text, type: line.kind }))} />
              <div className="flex gap-2">
                <Button
                  disabled={restore.isPending}
                  onClick={() => {
                    restore.mutate();
                  }}
                >
                  Confirm restore
                </Button>
                <Button
                  onClick={() => {
                    preview.reset();
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
    </div>
  );
}

function toFailure(error: Error | null) {
  if (error === null) return undefined;
  if (error instanceof ApiRequestError) return describeRestoreError(error.apiError);
  return { message: error.message, nextStep: 'Reload the page, then retry.' };
}
