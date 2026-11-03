import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '@/lib/api-client';
import { ApiProvider } from '@/lib/api-context';
import { json, stubFetch } from '@/test/fetch-stub';
import { droppingSseResponse, runSummary, sseResponse } from '@/test/install-fixtures';

import { RunPanel } from './run-panel';

const readsOf = (stub: ReturnType<typeof stubFetch>) => stub.calls.filter((call) => call.url === '/runs/run-1').length;

function renderPanel(stub: ReturnType<typeof stubFetch>, onFinished = vi.fn()) {
  const api = createApiClient({ fetch: stub.fetch, getToken: () => 'abc' });
  const { unmount } = render(
    <ApiProvider api={api}>
      <RunPanel onFinished={onFinished} onRunAgain={vi.fn()} runId="run-1" title="Update" />
    </ApiProvider>,
  );
  return { onFinished, unmount };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('run panel: live stream drops and the run never finishes', () => {
  it('gives up after a bounded time, then reloads the run on request', async () => {
    const stub = stubFetch({
      'GET /runs/run-1': [
        ...Array.from({ length: 30 }, () => () => json({ ...runSummary('running'), output: ['line one'] })),
        () => json({ ...runSummary('succeeded', 0), output: ['line one', 'line two'] }),
      ],
      'GET /runs/run-1/events': () => droppingSseResponse([{ line: 'line one', type: 'stdout' }]),
    });
    const { onFinished } = renderPanel(stub);

    await screen.findByText(/connection interrupted, reconnecting/iu);
    for (let tick = 0; tick < 30; tick += 1) await vi.advanceTimersByTimeAsync(2000);

    expect(await screen.findByText(/lost contact with the run/iu)).toBeInTheDocument();
    expect(readsOf(stub)).toBe(30);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(readsOf(stub)).toBe(30);

    fireEvent.click(screen.getByRole('button', { name: 'Reload run' }));

    expect(await screen.findByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('Exit code 0')).toBeInTheDocument();
    expect(within(screen.getByRole('log', { name: 'Run output' })).getAllByRole('listitem').map((line) => line.textContent)).toEqual(['line one', 'line two']);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('stops reading the saved run once unmounted', async () => {
    const stub = stubFetch({
      'GET /runs/run-1': () => json({ ...runSummary('running'), output: [] }),
      'GET /runs/run-1/events': () => droppingSseResponse([]),
    });
    const { unmount } = renderPanel(stub);
    await screen.findByText(/connection interrupted, reconnecting/iu);
    await vi.advanceTimersByTimeAsync(0);
    const reads = readsOf(stub);

    unmount();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(readsOf(stub)).toBe(reads);
  });
});

describe('run panel: replay dropped earlier output (super-review-10)', () => {
  it('says earlier output was dropped when the replay starts with a dropped event', async () => {
    const stub = stubFetch({
      'GET /runs/run-1/events': () =>
        sseResponse([{ dropped: 12, type: 'dropped' }, { line: 'line 13', type: 'stdout' }, { exitCode: 0, type: 'exit' }, { status: 'succeeded', type: 'status' }]),
    });
    renderPanel(stub);

    expect(await screen.findByText(/earlier output was dropped/iu)).toBeInTheDocument();
    expect(within(screen.getByRole('log', { name: 'Run output' })).getAllByRole('listitem').map((line) => line.textContent)).toEqual(['line 13']);
  });

  it('says earlier output was dropped when the saved run is truncated', async () => {
    const stub = stubFetch({
      'GET /runs/run-1': () => json({ ...runSummary('succeeded', 0), output: ['tail'], truncated: true }),
      'GET /runs/run-1/events': () => droppingSseResponse([]),
    });
    renderPanel(stub);

    expect(await screen.findByText(/earlier output was dropped/iu)).toBeInTheDocument();
  });
});
