import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { json, stubFetch } from '@/test/fetch-stub';
import { renderApp } from '@/test/render-app';

const project = { createdAt: '2026-11-03T10:00:00.000Z', id: 'p-1', path: '/work/app' };

const scoped = { config: {}, exists: true, scope: 'project:p-1', text: '{}', unknownKeys: [] };

async function expectProjectView(calls: ReturnType<typeof server>['calls']) {
  await waitFor(() => {
    expect(window.location.pathname).toBe('/config');
  });
  await waitFor(() => {
    expect(screen.getByLabelText('Scope')).toHaveValue('project:p-1');
  });
  await waitFor(() => {
    expect(calls.filter((call) => call.url.startsWith('/config/project:p-1')).map((call) => call.authorization)).toContain('Bearer T');
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
  // The printed URL is the same for a newly registered folder and an already-known one: the id comes from the URL.
  it.each(['new registration', 'already-known folder'])('lands on the project view without any click (%s)', async () => {
    const { calls, fetch } = server();

    renderApp('/#token=T&project=p-1', fetch);

    await expectProjectView(calls);
    expect(sessionStorage.getItem('agentic.token')).toBe('T');
    expect(sessionStorage.getItem('agentic.startProject')).toBe('p-1');
    expect(window.location.href).not.toContain('token');
  });

  it('lands on the projects list when no start project was given', async () => {
    renderApp('/#token=T', server().fetch);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects');
    });
    expect(sessionStorage.getItem('agentic.token')).toBe('T');
  });

  it('keeps landing on the project view on reload when the fragment is gone but sessionStorage holds it', async () => {
    sessionStorage.setItem('agentic.token', 'T');
    sessionStorage.setItem('agentic.startProject', 'p-1');
    const { calls, fetch } = server();

    renderApp('/', fetch);

    await expectProjectView(calls);
  });

  it('captures a fragment on a deep link', async () => {
    renderApp('/config#token=T', server().fetch);

    await screen.findByLabelText('Scope');
    expect(sessionStorage.getItem('agentic.token')).toBe('T');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/config');
  });
});
