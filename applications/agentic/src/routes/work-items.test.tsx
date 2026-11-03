import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { json, stubFetch } from '@/test/fetch-stub';
import { renderApp } from '@/test/render-app';

const projects = () => json({ projects: [{ createdAt: '2026-11-01T00:00:00.000Z', id: 'p1', path: '/work/app' }] });

const readable = (slug: string, archived: boolean, title: string) => ({
  archived,
  slug,
  state: { phase: 'implement', readable: true, status: 'in_progress', title, updated: '2026-11-02T09:00:00Z' },
});

const items = () =>
  json({
    items: [readable('20261102-login', false, 'Login page'), { archived: false, slug: '20261101-broken', state: { readable: false, reason: 'invalid_json' } }, readable('20261001-old', true, 'Old work')],
  });

const detail = () =>
  json({
    ...readable('20261102-login', false, 'Login page'),
    docs: ['spec', 'reviews/1-x.md'],
    timeline: {
      events: [{ step: 'implement', summary: 'T1 done', ts: '2026-11-02T08:00:00Z', type: 'progress' }],
      malformed: 2,
      truncated: true,
    },
  });

const routes = {
  'GET /projects': projects,
  'GET /projects/p1/work-items': items,
  'GET /projects/p1/work-items/20261102-login': detail,
};

const press = (element: HTMLElement) => {
  fireEvent.click(element);
};

describe('work items list (AC18, AC20)', () => {
  it('lists active and archived items and renders an unreadable item without breaking the list', async () => {
    renderApp('/work-items', stubFetch(routes).fetch);

    const active = await screen.findByRole('table', { name: 'Active work items' });
    expect(within(active).getByRole('link', { name: 'Login page' })).toBeInTheDocument();
    expect(active).toHaveTextContent('in_progress');
    expect(active).toHaveTextContent('implement');
    expect(within(active).getByText('Unreadable: invalid_json')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Archived work items' })).getByRole('link', { name: 'Old work' })).toBeInTheDocument();
  });

  it('shows an empty state when the project has no work items', async () => {
    renderApp('/work-items', stubFetch({ ...routes, 'GET /projects/p1/work-items': () => json({ items: [] }) }).fetch);

    expect(await screen.findByText('No work items')).toBeInTheDocument();
  });

  it('asks to add a project when none is known', async () => {
    renderApp('/work-items', stubFetch({ 'GET /projects': () => json({ projects: [] }) }).fetch);

    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });
});

describe('work item detail (AC19)', () => {
  it('shows state, timeline rows and truncation and malformed notices', async () => {
    renderApp('/work-items/p1/20261102-login', stubFetch(routes).fetch);

    const timeline = await screen.findByRole('table', { name: 'Timeline' });
    const row = within(timeline).getAllByRole('row')[1];
    expect(row).toHaveTextContent('progress');
    expect(row).toHaveTextContent('implement');
    expect(row).toHaveTextContent('T1 done');
    expect(screen.getByText(/timeline truncated/iu)).toBeInTheDocument();
    expect(screen.getByText(/2 malformed lines skipped/u)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
  });

  it('opens a review doc with its slash encoded and issues only reads', async () => {
    const stub = stubFetch({
      ...routes,
      'GET /projects/p1/work-items/20261102-login/docs/reviews%2F1-x.md': () => json({ name: 'reviews/1-x.md', text: '# Review\n\nAll **good**.', truncated: true }),
    });
    renderApp('/work-items/p1/20261102-login', stub.fetch);

    press(await screen.findByRole('button', { name: 'reviews/1-x.md' }));

    const doc = await screen.findByRole('article', { name: 'reviews/1-x.md' });
    expect(within(doc).getByRole('heading', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByText(/document truncated/iu)).toBeInTheDocument();
    expect(stub.calls.every((call) => call.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /resume|clean ?up|delete|archive/iu })).not.toBeInTheDocument();
  });
});
