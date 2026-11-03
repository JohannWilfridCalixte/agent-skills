import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { json, problemResponse, stubFetch } from '@/test/fetch-stub';
import { renderApp } from '@/test/render-app';

const project = (id: string, path: string) => ({ createdAt: '2026-11-03T10:00:00.000Z', id, path });

describe('projects page', () => {
  it('shows a loading state while the list is fetched', async () => {
    renderApp('/projects#token=abc', async () => new Promise<Response>(() => {}));

    expect(await screen.findByRole('status')).toHaveTextContent('Loading projects');
  });

  it('shows an empty state with a next step', async () => {
    renderApp('/projects#token=abc', stubFetch({ 'GET /projects': () => json({ projects: [] }) }).fetch);

    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeInTheDocument();
  });

  it('shows an error with a next step and retries', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn<() => Promise<Response>>().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(json({ projects: [] }));
    renderApp('/projects#token=abc', fetch);

    expect(await screen.findByRole('alert')).toHaveTextContent('Start it with `agentic serve`');

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeInTheDocument();
  });

  it('adds a project with the bearer token and lists it', async () => {
    const user = userEvent.setup();
    const stub = stubFetch({
      'GET /projects': [() => json({ projects: [] }), () => json({ projects: [project('p1', '/work/app')] })],
      'POST /projects': () => json(project('p1', '/work/app'), 201),
    });
    renderApp('/projects#token=abc', stub.fetch);

    await user.type(await screen.findByLabelText('Project folder'), '/work/app');
    await user.click(screen.getByRole('button', { name: 'Add project' }));

    expect(await screen.findByText('/work/app')).toBeInTheDocument();
    expect(stub.calls.find((call) => call.method === 'POST')).toMatchObject({ authorization: 'Bearer abc', body: { path: '/work/app' } });
  });

  it.each([
    [422, 'path_not_absolute', 'Path not absolute', 'The project path must be absolute.'],
    [422, 'path_not_found', 'Path not found', 'The project path does not exist.'],
    [422, 'path_not_directory', 'Path not a directory', 'The project path is not a directory.'],
    [409, 'project_already_known', 'Project already known', 'Already registered as p1.'],
  ])('shows the %s %s problem next to the path field', async (status, type, title, detail) => {
    const user = userEvent.setup();
    const stub = stubFetch({ 'GET /projects': () => json({ projects: [] }), 'POST /projects': () => problemResponse(status, type, title, detail) });
    renderApp('/projects#token=abc', stub.fetch);

    const input = await screen.findByLabelText('Project folder');
    await user.type(input, 'some/path');
    await user.click(screen.getByRole('button', { name: 'Add project' }));

    expect(await screen.findByText(detail)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
