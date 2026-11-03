import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { json, problemResponse, stubFetch } from '@/test/fetch-stub';
import { claudePluginInstalled, harnessesResponse } from '@/test/install-fixtures';
import { renderApp } from '@/test/render-app';

const statuses = (...entries: readonly object[]) => () => json({ statuses: entries });

const baseRoutes = {
  'GET /install/harnesses': harnessesResponse,
  'GET /projects': () => json({ projects: [{ createdAt: '2026-11-03T10:00:00.000Z', id: 'p1', path: '/work/app' }] }),
};

const statusCalls = (calls: readonly { readonly method: string; readonly url: string }[]) => calls.filter((call) => call.url.startsWith('/install/status'));

describe('install page: harnesses and status', () => {
  it('shows each harness as present or absent with the reason (AC10)', async () => {
    renderApp('/install#token=abc', stubFetch({ ...baseRoutes, 'GET /install/status': statuses() }).fetch);

    const harnesses = await screen.findByRole('list', { name: 'Harnesses' });
    expect(await within(harnesses).findByText('codex CLI not on PATH and no ~/.codex')).toBeInTheDocument();
    expect(within(harnesses).getByRole('listitem', { name: 'codex' })).toHaveTextContent('Absent');
    expect(within(harnesses).getByRole('listitem', { name: 'claude' })).toHaveTextContent('Present');
  });

  it('shows installed, not installed and unknown states with version and reason (AC10)', async () => {
    renderApp(
      '/install#token=abc',
      stubFetch({
        ...baseRoutes,
        'GET /install/status': statuses(
          claudePluginInstalled,
          { available: true, harness: 'codex', method: 'plugin', scope: 'global', state: 'not_installed' },
          { available: true, method: 'skills', reason: 'skills CLI output not understood', scope: 'global', state: 'unknown' },
        ),
      }).fetch,
    );

    const claude = await screen.findByRole('row', { name: /Claude plugin/u });
    expect(claude).toHaveTextContent('Installed');
    expect(claude).toHaveTextContent('0.4.0');
    expect(screen.getByRole('row', { name: /Codex plugin/u })).toHaveTextContent('Not installed');
    const skills = screen.getByRole('row', { name: /Skills CLI/u });
    expect(skills).toHaveTextContent('Unknown');
    expect(skills).toHaveTextContent('skills CLI output not understood');
  });

  it('shows "Update available" only when the tool reports it (AC12)', async () => {
    renderApp(
      '/install#token=abc',
      stubFetch({
        ...baseRoutes,
        'GET /install/status': statuses(
          { ...claudePluginInstalled, updateAvailable: true },
          { available: true, harness: 'codex', method: 'plugin', scope: 'global', state: 'installed', updateAvailable: false },
          { available: true, harness: 'cursor', method: 'clone', scope: 'global', state: 'installed' },
        ),
      }).fetch,
    );

    expect(await screen.findByRole('row', { name: /Claude plugin/u })).toHaveTextContent('Update available');
    expect(screen.getByRole('row', { name: /Codex plugin/u })).not.toHaveTextContent('Update available');
    expect(screen.getByRole('row', { name: /Cursor clone/u })).not.toHaveTextContent('Update available');
    expect(screen.getAllByText('Update available')).toHaveLength(1);
  });

  it('Refresh calls the status endpoint exactly once more (AC11)', async () => {
    const stub = stubFetch({ ...baseRoutes, 'GET /install/status': statuses(claudePluginInstalled) });
    renderApp('/install#token=abc', stub.fetch);
    await screen.findByRole('row', { name: /Claude plugin/u });
    expect(statusCalls(stub.calls)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));

    await vi.waitFor(() => {
      expect(statusCalls(stub.calls)).toHaveLength(2);
    });
  });

  it('never polls: no request after time passes or the window regains focus (AC11)', async () => {
    const stub = stubFetch({ ...baseRoutes, 'GET /install/status': statuses(claudePluginInstalled) });
    renderApp('/install#token=abc', stub.fetch);
    await screen.findByRole('row', { name: /Claude plugin/u });
    const requestsAfterLoad = stub.calls.length;

    vi.useFakeTimers();
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(60 * 1000);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(stub.calls).toHaveLength(requestsAfterLoad);
  });

  it('asks the status for the selected project scope', async () => {
    const stub = stubFetch({
      ...baseRoutes,
      'GET /install/status': statuses(claudePluginInstalled),
      'GET /install/status?scope=project&projectId=p1': statuses({ available: true, method: 'skills', scope: 'project', state: 'installed' }),
    });
    renderApp('/install#token=abc', stub.fetch);

    await screen.findByRole('option', { name: '/work/app' });
    fireEvent.change(screen.getByLabelText('Skills CLI scope'), { target: { value: 'p1' } });

    expect(await screen.findByRole('row', { name: /Skills CLI \(\/work\/app\)/u })).toHaveTextContent('Installed');
  });

  it('shows a status error with a next step', async () => {
    renderApp(
      '/install#token=abc',
      stubFetch({ ...baseRoutes, 'GET /install/status': () => problemResponse(500, 'internal', 'Internal error', 'status probe crashed') }).fetch,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('status probe crashed');
    expect(alert).toHaveTextContent('Check the `agentic serve` output');
  });

  it('shows an empty status state', async () => {
    renderApp('/install#token=abc', stubFetch({ ...baseRoutes, 'GET /install/status': statuses() }).fetch);

    expect(await screen.findByRole('heading', { name: 'No install methods reported' })).toBeInTheDocument();
  });
});
