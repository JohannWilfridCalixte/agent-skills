import type { RecordedCall } from '@/test/fetch-stub';

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { json, stubFetch } from '@/test/fetch-stub';
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

const posts = (calls: readonly RecordedCall[], url: string) => calls.filter((call) => call.method === 'POST' && call.url === url);

async function openUpdateDialog() {
  press(await screen.findByRole('button', { name: 'Update Claude plugin' }));
  return screen.findByRole('dialog');
}

describe('install page: cancel the confirmation (AC13)', () => {
  it('runs nothing when the dialog is cancelled', async () => {
    const stub = stubFetch(routes);
    renderApp('/install#token=abc', stub.fetch);

    const dialog = await openUpdateDialog();
    await within(dialog).findAllByRole('code');
    press(within(dialog).getByRole('button', { name: 'Cancel' }));

    await vi.waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(posts(stub.calls, '/install/runs')).toHaveLength(0);
  });
});
