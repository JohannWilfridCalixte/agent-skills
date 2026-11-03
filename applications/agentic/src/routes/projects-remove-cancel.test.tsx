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
  it('keeps the project when the removal is cancelled', async () => {
    const stub = stubFetch({ 'GET /projects': () => json({ projects: [project('p1', '/work/app')] }) });
    renderApp('/projects#token=abc', stub.fetch);

    press(await screen.findByRole('button', { name: 'Remove /work/app' }));
    press(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stub.calls.some((call) => call.method === 'DELETE')).toBe(false);
  });
});
