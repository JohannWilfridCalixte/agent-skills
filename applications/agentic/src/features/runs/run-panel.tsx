import type { ApiClient } from '@/lib/api-client';
import type { RunStatus } from '@agentic/contract-http/runs';

import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { useApi } from '@/lib/api-context';
import { describeApiError } from '@/lib/api-error';
import { RunDetail, RunSummary } from '@agentic/contract-http/runs';
import { Badge, Button, Callout } from '@agentic/design-system';

interface RunView {
  /** Set when the server no longer holds the earliest output lines (replay cap). */
  readonly dropped?: boolean;
  readonly exitCode?: number;
  readonly lines: readonly string[];
  /** Set when the bounded re-reads gave up while the run still looked active. */
  readonly lostContact?: boolean;
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
const RECONNECTING = 'Connection interrupted, reconnecting. Following the output saved on the server.';
const LOST_CONTACT = 'Lost contact with the run; it may still be running on the server. Reload the run to check again.';

/** After the stream drops, the saved run is re-read every 2 s, at most 30 times (one minute), until it finishes. */
const READ_INTERVAL_MS = 2000;
const MAX_READS = 30;

interface RunPanelProps {
  readonly onFinished: () => void;
  readonly onRunAgain: () => void;
  readonly runId: string;
  readonly title: string;
}

type Update = (change: (view: RunView) => RunView) => void;

export function RunPanel({ onFinished, onRunAgain, runId, title }: RunPanelProps) {
  const api = useApi();
  const [view, setView] = useState<RunView>({ lines: [], status: 'running' });
  const [cancelError, setCancelError] = useState<string>();
  const logRef = useRef<HTMLOListElement>(null);
  const notifyFinished = useEffectEvent(onFinished);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void followRun(api, runId, controller.signal, setView);
    return () => {
      controller.abort();
    };
  }, [api, runId]);

  useEffect(() => {
    if (reloads === 0) return;
    const controller = new AbortController();
    void followSavedRun(api, runId, controller.signal, setView);
    return () => {
      controller.abort();
    };
  }, [api, reloads, runId]);

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
          <p>{view.notice}</p>
          {view.lostContact === true && (
            <Button
              className="mt-3"
              onClick={() => {
                setReloads((count) => count + 1);
              }}
              size="sm"
              variant="outline"
            >
              Reload run
            </Button>
          )}
        </Callout>
      )}
      {view.dropped === true && (
        <Callout title="Earlier output was dropped" tone="warning">
          <p>Only the most recent output lines are kept while a run is shown. The run history keeps the output tail.</p>
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

/** Follows a run over SSE; when the stream drops, follows `GET /runs/:id` instead and says so. */
async function followRun(api: ApiClient, runId: string, signal: AbortSignal, update: Update) {
  let finished = false;
  for await (const event of api.subscribeToRun(runId, { signal })) {
    if (signal.aborted) return;
    if (!event.ok) break;
    const value = event.value;
    switch (value.type) {
      case 'dropped': {
        update((view) => ({ ...view, dropped: true }));
        break;
      }
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
  await followSavedRun(api, runId, signal, update);
}

/**
 * Re-reads the saved run until it finishes, bounded by MAX_READS; the saved output replaces the shown lines, so
 * nothing is duplicated. The command is never resubmitted.
 */
async function followSavedRun(api: ApiClient, runId: string, signal: AbortSignal, update: Update) {
  update((view) => ({ ...view, lostContact: false, notice: RECONNECTING }));
  for (let read = 0; read < MAX_READS; read += 1) {
    if (read > 0 && !(await sleep(READ_INTERVAL_MS, signal))) return;
    if (await readSavedRun(api, runId, signal, update)) return;
    if (signal.aborted) return;
  }
  update((view) => ({ ...view, lostContact: true, notice: LOST_CONTACT }));
}

/** Reads the saved run once; true when it has finished. */
async function readSavedRun(api: ApiClient, runId: string, signal: AbortSignal, update: Update) {
  const detail = await api.get(`/runs/${encodeURIComponent(runId)}`, RunDetail, { signal });
  if (signal.aborted || !detail.ok) return false;
  const { exitCode, output, status, truncated } = detail.value;
  const finished = status !== 'running';
  update((view) => ({ ...view, ...(truncated === true ? { dropped: true } : {}), lines: output, notice: finished ? INTERRUPTED : RECONNECTING, status, ...(exitCode === undefined ? {} : { exitCode }) }));
  return finished;
}

/** Resolves false when aborted first. */
function sleep(ms: number, signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve(true);
    }, ms);
    function stop() {
      clearTimeout(timer);
      resolve(false);
    }
    signal.addEventListener('abort', stop, { once: true });
  });
}
