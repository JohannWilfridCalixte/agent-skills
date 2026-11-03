import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderApp } from '@/test/render-app';

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

describe('projects placeholder', () => {
  it('shows a loading state while the list is fetched', async () => {
    renderApp('/projects#token=abc', () => new Promise<Response>(() => {}));

    expect(await screen.findByRole('status')).toHaveTextContent('Loading projects');
  });

  it('shows an empty state with a next step', async () => {
    renderApp('/projects#token=abc', async () => json({ projects: [] }));

    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeInTheDocument();
  });

  it('shows an error with a next step and retries', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn<() => Promise<Response>>().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(json({ projects: [] }));
    renderApp('/projects#token=abc', fetch);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Start it with `agentic serve`');

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeInTheDocument();
  });
});
