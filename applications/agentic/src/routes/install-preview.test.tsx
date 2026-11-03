import type { RecordedCall } from '@/test/fetch-stub';

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

describe('install page: preview (AC13)', () => {
  it('shows the exact commands in order with a warning and posts no run before confirm', async () => {
    const stub = stubFetch(routes);
    renderApp('/install#token=abc', stub.fetch);

    const dialog = await openUpdateDialog();

    const commands = await within(dialog).findAllByRole('code');
    expect(commands.map((command) => command.textContent)).toEqual(['claude plugin marketplace update agentic', 'claude plugin update agentic@agentic']);
    expect(dialog).toHaveTextContent('will run on this machine');
    expect(posts(stub.calls, '/install/preview')[0]?.body).toEqual({ action: 'update', harness: 'claude', method: 'plugin', scope: 'global' });
    expect(posts(stub.calls, '/install/runs')).toHaveLength(0);
  });
});
