import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { json, problemResponse, stubFetch } from '@/test/fetch-stub';
import { claudePluginInstalled, harnessesResponse } from '@/test/install-fixtures';
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

describe('install page: preview refused', () => {
  it('shows a 409 method unavailable with a next step and no confirm', async () => {
    const stub = stubFetch({
      ...routes,
      'POST /install/preview': () => problemResponse(409, 'method_unavailable', 'Install method not available on this machine', 'claude CLI not found'),
    });
    renderApp('/install#token=abc', stub.fetch);

    const dialog = await openUpdateDialog();

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('claude CLI not found');
    expect(alert).toHaveTextContent('Install the harness CLI, then refresh the status.');
    expect(within(dialog).getByRole('button', { name: 'Run on this machine' })).toBeDisabled();
  });
});
