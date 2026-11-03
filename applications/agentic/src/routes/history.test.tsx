import type { RecordedCall } from '@/test/fetch-stub';

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { json, problemResponse, stubFetch } from '@/test/fetch-stub';
import { renderApp } from '@/test/render-app';

const entry = (overrides: Record<string, unknown>) => ({
  content: null,
  createdAt: '2026-11-03T10:00:00.000Z',
  exitCode: null,
  id: 'h1',
  kind: 'config_write',
  outputTail: null,
  scope: 'global',
  summary: 'Saved global config',
  truncated: false,
  ...overrides,
});

const runEntry = entry({ createdAt: '2026-11-03T12:00:00.000Z', exitCode: 1, id: 'h3', kind: 'run', outputTail: 'line one\nline two', summary: 'install update claude plugin', truncated: true });
const restoreEntry = entry({ content: '{"output":".agentic"}', createdAt: '2026-11-03T11:00:00.000Z', id: 'h2', kind: 'config_restore', summary: 'Restored global config' });
const writeEntry = entry({ content: '{"output":"old"}', id: 'h1', summary: 'Saved global config' });

const routes = {
  'GET /history?scope=global': () => json({ entries: [runEntry, restoreEntry, writeEntry] }),
  'GET /projects': () => json({ projects: [{ createdAt: '2026-11-01T00:00:00.000Z', id: 'p1', path: '/work/app' }] }),
};

const press = (element: HTMLElement) => {
  fireEvent.click(element);
};

const posts = (calls: readonly RecordedCall[]) => calls.filter((call) => call.method !== 'GET');

describe('history page (AC16)', () => {
  it('lists entries newest first with kind, summary, exit code and truncation', async () => {
    renderApp('/history', stubFetch(routes).fetch);

    const rows = await screen.findAllByRole('row', { name: /config|install/u });

    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual(['install update claude plugin', 'Restored global config', 'Saved global config']);
    expect(within(rows[0] ?? document.body).getByText('run')).toBeInTheDocument();
    expect(within(rows[0] ?? document.body).getByText('Exit code 1')).toBeInTheDocument();
    expect(within(rows[0] ?? document.body).getByText('Output truncated')).toBeInTheDocument();
    expect(within(rows[1] ?? document.body).getByText('config_restore')).toBeInTheDocument();
    expect(within(rows[2] ?? document.body).getByText('config_write')).toBeInTheDocument();
  });

  it('loads the chosen project scope', async () => {
    const stub = stubFetch({ ...routes, 'GET /history?scope=project%3Ap1': () => json({ entries: [] }) });
    renderApp('/history', stub.fetch);
    await screen.findAllByRole('row', { name: /config/u });

    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'project:p1' } });

    expect(await screen.findByText('No history yet')).toBeInTheDocument();
  });

  it('shows a run entry output tail with a truncation notice and no restore', async () => {
    renderApp('/history', stubFetch(routes).fetch);

    press(await screen.findByRole('button', { name: 'View install update claude plugin' }));

    const detail = await screen.findByRole('region', { name: 'Entry details' });
    expect(within(detail).getByText(/line one/u)).toBeInTheDocument();
    expect(detail).toHaveTextContent('Only the end of the output was kept');
    expect(within(detail).queryByRole('button', { name: /restore/iu })).not.toBeInTheDocument();
  });

  it('previews a restore as a diff and writes nothing before confirm (AC17)', async () => {
    const stub = stubFetch({
      ...routes,
      'POST /config/restore/h1/preview': () => json({ diff: [{ kind: 'removed', text: '"output": ".agentic"' }, { kind: 'added', text: '"output": "old"' }], entryId: 'h1', proposedText: '{"output":"old"}', scope: 'global' }),
    });
    renderApp('/history#token=abc', stub.fetch);

    press(await screen.findByRole('button', { name: 'View Saved global config' }));
    press(await screen.findByRole('button', { name: 'Restore this version' }));

    const diff = await screen.findByRole('list', { name: 'Restore changes' });
    expect(diff).toHaveTextContent('Removed: - "output": ".agentic"');
    expect(diff).toHaveTextContent('Added: + "output": "old"');
    expect(posts(stub.calls).map((call) => call.url)).toEqual(['/config/restore/h1/preview']);
  });

  it('confirms a restore, says it is undoable and refreshes the history', async () => {
    const stub = stubFetch({
      ...routes,
      'POST /config/restore/h1': () => json({ changed: true, restoredFrom: 'h1', scope: 'global', text: '{"output":"old"}' }),
      'POST /config/restore/h1/preview': () => json({ diff: [{ kind: 'added', text: 'x' }], entryId: 'h1', proposedText: 'x', scope: 'global' }),
    });
    renderApp('/history#token=abc', stub.fetch);

    press(await screen.findByRole('button', { name: 'View Saved global config' }));
    press(await screen.findByRole('button', { name: 'Restore this version' }));
    press(await screen.findByRole('button', { name: 'Confirm restore' }));

    expect(await screen.findByText(/new history entry/u)).toHaveTextContent('can itself be undone');
    expect(posts(stub.calls).at(-1)).toMatchObject({ authorization: 'Bearer abc', url: '/config/restore/h1' });
    await vi.waitFor(() => {
      expect(stub.calls.filter((call) => call.url === '/history?scope=global').length).toBeGreaterThan(1);
    });
  });

  it.each([
    [422, 'The stored content is not a valid config.', 'cannot be restored'],
    [404, 'History entry not found.', 'no longer exists'],
  ])('explains a %i restore failure with a next step', async (status, detail, nextStep) => {
    const stub = stubFetch({ ...routes, 'POST /config/restore/h1/preview': () => problemResponse(status, 'restore', 'Restore failed', detail) });
    renderApp('/history#token=abc', stub.fetch);

    press(await screen.findByRole('button', { name: 'View Saved global config' }));
    press(await screen.findByRole('button', { name: 'Restore this version' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(detail);
    expect(alert).toHaveTextContent(new RegExp(nextStep, 'u'));
  });
});
