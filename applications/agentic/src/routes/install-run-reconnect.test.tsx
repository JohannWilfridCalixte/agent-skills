import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { json, stubFetch } from '@/test/fetch-stub';
import { claudePluginInstalled, droppingSseResponse, harnessesResponse, runSummary } from '@/test/install-fixtures';
import { renderApp } from '@/test/render-app';

/* One Radix dialog scenario per file and fireEvent inside it: happy-dom limits (see projects-remove.test.tsx). */
const press = (element: HTMLElement) => {
  fireEvent.click(element);
};

const preview = () =>
  json({
    commands: [
      { args: ['plugin', 'marketplace', 'update', 'agentic'], cli: 'claude', display: 'claude plugin marketplace update agentic' },
      { args: ['plugin', 'update', 'agentic@agentic'], cli: 'claude', display: 'claude plugin update agentic@agentic' },
    ],
    steps: 2,
  });

const routes = {
  'GET /install/harnesses': harnessesResponse,
  'GET /install/status': () => json({ statuses: [claudePluginInstalled] }),
  'GET /projects': () => json({ projects: [] }),
  'POST /install/preview': preview,
};

async function openUpdateDialog() {
  press(await screen.findByRole('button', { name: 'Update Claude plugin' }));
  return screen.findByRole('dialog');
}

const outputLines = () => within(screen.getByRole('log', { name: 'Run output' })).getAllByRole('listitem').map((line) => line.textContent);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('install page: live stream drops while the run is still active', () => {
  it('keeps following the run until it finishes, without duplicating lines', async () => {
    const stub = stubFetch({
      ...routes,
      'GET /runs/run-1': [
        () => json({ ...runSummary('running'), output: ['line one'] }),
        () => json({ ...runSummary('running'), output: ['line one', 'line two'] }),
        () => json({ ...runSummary('failed', 3), output: ['line one', 'line two', 'line three'] }),
      ],
      'GET /runs/run-1/events': () => droppingSseResponse([{ line: 'line one', type: 'stdout' }]),
      'POST /install/runs': () => json(runSummary('running'), 201),
    });
    renderApp('/install#token=abc', stub.fetch);

    const dialog = await openUpdateDialog();
    await within(dialog).findAllByRole('code');
    press(within(dialog).getByRole('button', { name: 'Run on this machine' }));

    expect(await screen.findByText(/connection interrupted, reconnecting/iu)).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Exit code 3')).toBeInTheDocument();
    expect(outputLines()).toEqual(['line one', 'line two', 'line three']);
    expect(stub.calls.filter((call) => call.url === '/install/runs')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(stub.calls.filter((call) => call.url === '/runs/run-1')).toHaveLength(3);
  });
});
