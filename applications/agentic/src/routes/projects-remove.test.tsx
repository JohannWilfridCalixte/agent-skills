import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { json, stubFetch } from '@/test/fetch-stub';
import { renderApp } from '@/test/render-app';

/*
 * Under happy-dom, a second Radix modal dialog opened in the same test file hangs (module-level focus-trap state), and
 * user-event clicks loop inside an open dialog. Each removal case therefore lives in its own file and presses the
 * dialog buttons with `fireEvent` (the real click handlers still run).
 */
const press = (element: HTMLElement) => {
  fireEvent.click(element);
};

const project = (id: string, path: string) => ({ createdAt: '2026-11-03T10:00:00.000Z', id, path });

describe('projects page: remove', () => {
  it('removes a project after a confirmation that says project files are not touched', async () => {
    const stub = stubFetch({
      'DELETE /projects/p1': () => new Response(null, { status: 204 }),
      'GET /projects': [() => json({ projects: [project('p1', '/work/app')] }), () => json({ projects: [] })],
    });
    renderApp('/projects#token=abc', stub.fetch);

    press(await screen.findByRole('button', { name: 'Remove /work/app' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Project files are not touched');
    press(within(dialog).getByRole('button', { name: 'Remove project' }));

    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeInTheDocument();
    expect(stub.calls.find((call) => call.method === 'DELETE')).toMatchObject({ authorization: 'Bearer abc' });
  });
});
