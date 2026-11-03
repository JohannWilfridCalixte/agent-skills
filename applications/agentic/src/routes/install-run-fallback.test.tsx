import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

describe('install page: live stream drops', () => {
  it('falls back to the run detail and says so', async () => {
    const stub = stubFetch({
      ...routes,
      'GET /runs/run-1': () => json({ ...runSummary('succeeded', 0), output: ['line one', 'line two'] }),
      'GET /runs/run-1/events': () => droppingSseResponse([{ line: 'line one', type: 'stdout' }]),
      'POST /install/runs': () => json(runSummary('running'), 201),
    });
    renderApp('/install#token=abc', stub.fetch);

    const dialog = await openUpdateDialog();
    await within(dialog).findAllByRole('code');
    press(within(dialog).getByRole('button', { name: 'Run on this machine' }));

    expect(await screen.findByText(/live output was interrupted/iu)).toBeInTheDocument();
    expect(await screen.findByText('Succeeded')).toBeInTheDocument();
    expect(within(screen.getByRole('log', { name: 'Run output' })).getAllByRole('listitem').map((line) => line.textContent)).toEqual(['line one', 'line two']);
  });
});
