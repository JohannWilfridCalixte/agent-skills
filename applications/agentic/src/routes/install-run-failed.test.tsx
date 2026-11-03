import type { RecordedCall } from '@/test/fetch-stub';

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

describe('install page: failed run (AC15)', () => {
  it('shows exit code and output, says it is not retried, and posts a single run', async () => {
    const stub = stubFetch({
      ...routes,
      'GET /runs/run-1/events': () =>
        sseResponse([
          { line: 'error: plugin not found', type: 'stderr' },
          { exitCode: 2, type: 'exit' },
          { status: 'failed', type: 'status' },
        ]),
      'POST /install/runs': () => json(runSummary('running'), 201),
    });
    renderApp('/install#token=abc', stub.fetch);

    const dialog = await openUpdateDialog();
    await within(dialog).findAllByRole('code');
    press(within(dialog).getByRole('button', { name: 'Run on this machine' }));

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Exit code 2')).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'Run output' })).toHaveTextContent('error: plugin not found');
    expect(screen.getByText(/not retried automatically/u)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run again' })).toBeInTheDocument();
    expect(posts(stub.calls, '/install/runs')).toHaveLength(1);
  });
});
