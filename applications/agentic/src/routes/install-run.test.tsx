import type { RecordedCall } from '@/test/fetch-stub';

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { json, stubFetch } from '@/test/fetch-stub';
import { claudePluginInstalled, harnessesResponse, runSummary, sseResponse } from '@/test/install-fixtures';
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

const posts = (calls: readonly RecordedCall[], url: string) => calls.filter((call) => call.method === 'POST' && call.url === url);

async function openUpdateDialog() {
  press(await screen.findByRole('button', { name: 'Update Claude plugin' }));
  return screen.findByRole('dialog');
}

describe('install page: confirmed run (AC13, AC14)', () => {
  it('posts confirm:true, streams lines in order, shows success and refreshes status once', async () => {
    const stub = stubFetch({
      ...routes,
      'GET /runs/run-1/events': () =>
        sseResponse([
          { line: 'Updating marketplace', type: 'stdout' },
          { line: 'warning: slow network', type: 'stderr' },
          { line: 'Updated agentic@agentic', type: 'stdout' },
          { exitCode: 0, type: 'exit' },
          { status: 'succeeded', type: 'status' },
        ]),
      'POST /install/runs': () => json(runSummary('running'), 201),
    });
    renderApp('/install#token=abc', stub.fetch);

    const dialog = await openUpdateDialog();
    await within(dialog).findAllByRole('code');
    press(within(dialog).getByRole('button', { name: 'Run on this machine' }));

    const log = await screen.findByRole('log', { name: 'Run output' });
    await vi.waitFor(() => {
      expect(log).toHaveTextContent('Updated agentic@agentic');
    });
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(within(log).getAllByRole('listitem').map((line) => line.textContent)).toEqual(['Updating marketplace', 'warning: slow network', 'Updated agentic@agentic']);
    expect(await screen.findByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('Exit code 0')).toBeInTheDocument();
    expect(posts(stub.calls, '/install/runs')[0]).toMatchObject({
      authorization: 'Bearer abc',
      body: { action: 'update', confirm: true, harness: 'claude', method: 'plugin', scope: 'global' },
    });
    await vi.waitFor(() => {
      expect(stub.calls.filter((call) => call.url === '/install/status')).toHaveLength(2);
    });
  });
});
