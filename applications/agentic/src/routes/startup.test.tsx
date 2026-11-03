import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { json, stubFetch } from '@/test/fetch-stub';
import { renderApp } from '@/test/render-app';

const project = { createdAt: '2026-11-03T10:00:00.000Z', id: 'p-1', path: '/work/app' };

const scoped = { config: {}, exists: true, scope: 'project:p-1', text: '{}', unknownKeys: [] };

async function openConfig() {
  const user = userEvent.setup();
  await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Config' }));
  await waitFor(() => {
    expect(screen.getByLabelText('Scope')).toHaveValue('project:p-1');
  });
}

function server() {
  return stubFetch({
    'GET /config/project:p-1': () => json(scoped),
    'GET /config/project:p-1/effective': () => json({ config: {}, scope: 'project:p-1', unknownKeys: [] }),
    'GET /projects': () => json({ projects: [project] }),
  });
}

describe('startup from the URL printed by agentic serve (AC1, D28)', () => {
  it('captures token and project before the start redirect, strips the fragment and authenticates', async () => {
    const { calls, fetch } = server();

    renderApp('/#token=T&project=p-1', fetch);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects');
    });
    expect(sessionStorage.getItem('agentic.token')).toBe('T');
    expect(sessionStorage.getItem('agentic.startProject')).toBe('p-1');
    expect(window.location.href).not.toContain('token');
    await openConfig();
    expect(calls.filter((call) => call.url.startsWith('/config/project:p-1')).map((call) => call.authorization)).toContain('Bearer T');
  });

  it('keeps working on reload when the fragment is gone but sessionStorage holds the token', async () => {
    sessionStorage.setItem('agentic.token', 'T');
    sessionStorage.setItem('agentic.startProject', 'p-1');
    const { calls, fetch } = server();

    renderApp('/', fetch);

    await openConfig();
    expect(calls.at(-1)?.authorization).toBe('Bearer T');
  });

  it('captures a fragment on a deep link', async () => {
    renderApp('/config#token=T', server().fetch);

    await screen.findByLabelText('Scope');
    expect(sessionStorage.getItem('agentic.token')).toBe('T');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/config');
  });
});
