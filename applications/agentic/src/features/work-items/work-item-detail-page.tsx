import type { WorkItemDetail, WorkItemTimeline } from '@agentic/contract-http/work-items';

import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { useApi } from '@/lib/api-context';
import { useListQuery } from '@/lib/use-list-query';
import { WorkItemDetail as WorkItemDetailSchema, WorkItemDoc } from '@agentic/contract-http/work-items';
import { Button, Callout, ListState, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@agentic/design-system';

import { MarkdownDoc } from './markdown-doc';
import { itemTitle } from './work-items-page';

interface DetailProps {
  readonly projectId: string;
  readonly slug: string;
}

/** Read-only detail (AC19): state, timeline and docs; no resume, cleanup or any write. */
export function WorkItemDetailPage({ projectId, slug }: DetailProps) {
  const api = useApi();
  const [docName, setDocName] = useState<string>();
  const basePath = `/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(slug)}`;
  const { failure, query } = useListQuery(['work-item', projectId, slug], async (signal) => api.get(basePath, WorkItemDetailSchema, { signal }));

  return (
    <>
      <Link className="text-sm text-primary underline" to="/work-items">
        Back to work items
      </Link>
      {query.isPending && <ListState label="Loading the work item" status="loading" />}
      {failure !== undefined && <ListState message={failure.message} nextStep={failure.nextStep} onRetry={() => void query.refetch()} status="error" />}
      {query.data !== undefined && (
        <>
          <PageHeader description={slug} title={itemTitle(query.data)} />
          <StateSummary item={query.data} />
          <Timeline timeline={query.data.timeline} />
          <section aria-labelledby="docs-title" className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold" id="docs-title">
              Docs
            </h2>
            {query.data.docs.length === 0
              ? (
                  <p className="text-sm text-muted-foreground">No docs yet.</p>
                )
              : (
                  <ul aria-label="Docs" className="flex flex-wrap gap-2">
                    {query.data.docs.map((name) => (
                      <li key={name}>
                        <Button
                          aria-pressed={docName === name}
                          onClick={() => {
                            setDocName(name);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          {name}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
          </section>
          {docName !== undefined && <DocView basePath={basePath} key={docName} name={docName} />}
        </>
      )}
    </>
  );
}

function StateSummary({ item }: { readonly item: WorkItemDetail }) {
  if (!item.state.readable) {
    return (
      <Callout title="State unreadable" tone="warning">
        {`Unreadable: ${item.state.reason}`}
      </Callout>
    );
  }
  const fields = [
    ['Status', item.state.status],
    ['Phase', item.state.phase],
    ['Updated', item.state.updated],
    ['Archived', item.archived ? 'yes' : 'no'],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

const field = (event: Readonly<Record<string, unknown>>, key: string) => {
  const value = event[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '—';
};

/** `reviews/<file>` names keep their slash encoded (`reviews%2F1-x.md`): one path segment. */
function DocView({ basePath, name }: { readonly basePath: string; readonly name: string }) {
  const api = useApi();
  const { failure, query } = useListQuery(['work-item-doc', basePath, name], async (signal) => api.get(`${basePath}/docs/${encodeURIComponent(name)}`, WorkItemDoc, { signal }));

  if (query.isPending) return <ListState label={`Loading ${name}`} status="loading" />;
  if (failure !== undefined) return <ListState message={failure.message} nextStep={failure.nextStep} onRetry={() => void query.refetch()} status="error" />;
  if (query.data === undefined) return null;
  return (
    <article aria-label={name} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      {query.data.truncated && <Callout tone="warning">Document truncated: only the first 1 MB is shown.</Callout>}
      <MarkdownDoc text={query.data.text} />
    </article>
  );
}

function Timeline({ timeline }: { readonly timeline: WorkItemTimeline }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Timeline</h2>
      {timeline.truncated && (
        <Callout tone="warning">Timeline truncated: only the latest events are shown.</Callout>
      )}
      {timeline.malformed > 0 && <Callout tone="warning">{`${String(timeline.malformed)} malformed lines skipped.`}</Callout>}
      {timeline.events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
      {timeline.events.length > 0 && (
        <Table aria-label="Timeline">
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeline.events.map((event, index) => (
              // Events have no id; their position in the log is their identity.
              // eslint-disable-next-line react/no-array-index-key
              <TableRow key={index}>
                <TableCell>{field(event, 'type')}</TableCell>
                <TableCell>{field(event, 'step')}</TableCell>
                <TableCell>{field(event, 'summary')}</TableCell>
                <TableCell>{field(event, 'ts')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
