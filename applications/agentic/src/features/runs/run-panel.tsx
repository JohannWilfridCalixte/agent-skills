import type { ApiClient } from '@/lib/api-client';
import type { RunStatus } from '@agentic/contract-http/runs';

import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { useApi } from '@/lib/api-context';
import { describeApiError } from '@/lib/api-error';
import { RunDetail, RunSummary } from '@agentic/contract-http/runs';
import { Badge, Button, Callout } from '@agentic/design-system';

interface RunView {
  readonly exitCode?: number;
  readonly lines: readonly string[];
  readonly notice?: string;
  readonly status: RunStatus;
}

const STATUS_BADGES = {
  cancelled: { label: 'Cancelled', variant: 'outline' },
  failed: { label: 'Failed', variant: 'danger' },
  running: { label: 'Running', variant: 'teal' },
  succeeded: { label: 'Succeeded', variant: 'success' },
} as const satisfies Record<RunStatus, { readonly label: string; readonly variant: string }>;

const INTERRUPTED = 'Live output was interrupted; showing the output saved on the server.';

interface RunPanelProps {
  readonly onFinished: () => void;
  readonly onRunAgain: () => void;
  readonly runId: string;
  readonly title: string;
}

export function RunPanel({ onFinished, onRunAgain, runId, title }: RunPanelProps) {
  const api = useApi();
  const [view, setView] = useState<RunView>({ lines: [], status: 'running' });
  const [cancelError, setCancelError] = useState<string>();
  const logRef = useRef<HTMLOListElement>(null);
  const notifyFinished = useEffectEvent(onFinished);

  useEffect(() => {
    const controller = new AbortController();
    void followRun(api, runId, controller.signal, setView);
    return () => {
      controller.abort();
    };
  }, [api, runId]);

  const finished = view.status !== 'running';
  useEffect(() => {
    if (finished) notifyFinished();
  }, [finished]);

  useEffect(() => {
    const log = logRef.current;
    if (log !== null) log.scrollTop = log.scrollHeight;
  }, [view.lines]);

  const badge = STATUS_BADGES[view.status];

  async function cancel() {
    const result = await api.post(`/runs/${encodeURIComponent(runId)}/cancel`, {}, RunSummary);
    if (result.ok) {
      setCancelError(undefined);
      return;
    }
    const failure = describeApiError(result.error);
    setCancelError(`${failure.message} ${failure.nextStep}`);
  }

  return (
    <section aria-labelledby="run-title" className="mt-8 flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold" id="run-title">
          {title}
        </h2>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {view.exitCode !== undefined && <span className="text-sm">{`Exit code ${String(view.exitCode)}`}</span>}
        {!finished && (
          <Button className="ml-auto" onClick={() => void cancel()} size="sm" variant="outline">
            Cancel run
          </Button>
        )}
      </div>
      {view.notice !== undefined && (
        <Callout title="Live output interrupted" tone="warning">
          {view.notice}
        </Callout>
      )}
      {cancelError !== undefined && (
        <Callout title="Could not cancel the run" tone="error">
          {cancelError}
        </Callout>
      )}
      <ol
        aria-label="Run output"
        aria-live="polite"
        className="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap"
        ref={logRef}
        role="log"
        // A scrollable region must be focusable so keyboard users can scroll it (axe scrollable-region-focusable).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        {view.lines.map((line, index) => (
          // Lines have no identity beyond their position in the append-only output.
          // eslint-disable-next-line react/no-array-index-key
          <li key={index}>{line}</li>
        ))}
      </ol>
      {view.status === 'failed' && (
        <Callout title="The run failed" tone="error">
          <p>It is not retried automatically. Read the output above, fix the cause, then run it again.</p>
          <Button className="mt-3" onClick={onRunAgain} size="sm" variant="outline">
            Run again
          </Button>
        </Callout>
      )}
    </section>
  );
}

/** Follows a run over SSE; when the stream drops, reads `GET /runs/:id` once instead and says so. */
async function followRun(api: ApiClient, runId: string, signal: AbortSignal, update: (change: (view: RunView) => RunView) => void) {
  let finished = false;
  for await (const event of api.subscribeToRun(runId, { signal })) {
    if (signal.aborted) return;
    if (!event.ok) break;
    const value = event.value;
    switch (value.type) {
      case 'exit': {
        update((view) => ({ ...view, exitCode: value.exitCode }));
        break;
      }
      case 'status': {
        finished = value.status !== 'running';
        update((view) => ({ ...view, status: value.status }));
        break;
      }
      case 'stderr':
      case 'stdout': {
        update((view) => ({ ...view, lines: [...view.lines, value.line] }));
        break;
      }
      default: {
        value satisfies never;
      }
    }
  }
  if (finished || signal.aborted) return;
  await readSavedRun(api, runId, signal, update);
}

async function readSavedRun(api: ApiClient, runId: string, signal: AbortSignal, update: (change: (view: RunView) => RunView) => void) {
  const detail = await api.get(`/runs/${encodeURIComponent(runId)}`, RunDetail, { signal });
  if (signal.aborted) return;
  if (!detail.ok) {
    const failure = describeApiError(detail.error);
    update((view) => ({ ...view, notice: `${INTERRUPTED} ${failure.message} ${failure.nextStep}` }));
    return;
  }
  const { exitCode, output, status } = detail.value;
  update((view) => ({ ...view, lines: output, notice: INTERRUPTED, status, ...(exitCode === undefined ? {} : { exitCode }) }));
}
