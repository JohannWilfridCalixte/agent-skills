import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { json, stubFetch } from '@/test/fetch-stub';
import { renderApp } from '@/test/render-app';

const effective = (overrides: Record<string, unknown> = {}) => ({
  config: {
    commitWork: { origin: 'default', value: true },
    knowledge: { root: { origin: 'default', value: 'docs/knowledge' } },
    limits: { 'review.iterations': { origin: 'global', value: 3 } },
    output: { origin: 'global', value: '.agentic' },
    profiles: { origin: 'default', value: [] },
    reviewers: { origin: 'default', value: ['agentic-review'] },
    selectedProfiles: { origin: 'default', value: [] },
    steps: { claude: { implement: { effort: { origin: 'default', value: 'medium' }, model: { origin: 'global', value: 'sonnet' } } }, codex: {}, cursor: {} },
    worktrees: { origin: 'default', value: '.agentic/worktrees' },
    ...overrides,
  },
  scope: 'global',
  unknownKeys: [],
});

const raw = (config: Record<string, unknown> = { output: '.agentic', review: { fix: true } }) => ({
  config,
  exists: true,
  scope: 'global',
  text: JSON.stringify(config),
  unknownKeys: ['review.fix'],
});

const preview = (overrides: Record<string, unknown> = {}) => ({
  diff: [
    { kind: 'removed', text: '  "output": ".agentic",' },
    { kind: 'added', text: '  "output": "out",' },
  ],
  issues: [],
  proposedText: '{}',
  scope: 'global',
  unknownKeys: ['review.fix'],
  warnings: [],
  ...overrides,
});

const HARNESS_COUNT = 3;

const models = (harness: string) => ({ available: true, harness, ids: ['sonnet', 'opus'] });

function configServer(routes: Parameters<typeof stubFetch>[0] = {}) {
  return stubFetch({
    'GET /config/global': () => json(raw()),
    'GET /config/global/effective': () => json(effective()),
    'GET /models?harness=claude': () => json(models('claude')),
    'GET /models?harness=codex': () => json(models('codex')),
    'GET /models?harness=cursor': () => json(models('cursor')),
    'GET /projects': () => json({ projects: [] }),
    ...routes,
  });
}

async function openEditTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('tab', { name: 'Edit' }));
  return screen.findByLabelText('Output folder');
}

describe('config page: effective view', () => {
  it('shows a loading state while the effective config is fetched', async () => {
    renderApp('/config#token=abc', configServer({ 'GET /config/global/effective': async () => new Promise<Response>(() => {}) }).fetch);

    expect(await screen.findByRole('status')).toHaveTextContent('Loading effective config');
  });

  it('shows an error with a next step when the effective config fails', async () => {
    renderApp('/config#token=abc', configServer({ 'GET /config/global/effective': () => new Response('boom', { status: 500 }) }).fetch);

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the `agentic serve` output');
  });

  it('shows every field with its value and origin, steps and limits per leaf', async () => {
    renderApp('/config#token=abc', configServer().fetch);

    const table = await screen.findByRole('table', { name: 'Effective config for Global' });
    const outputRow = within(table).getByRole('row', { name: /^output/u });
    expect(outputRow).toHaveTextContent('.agentic');
    expect(within(outputRow).getByLabelText('Origin: global')).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /limits\.review\.iterations/u })).toHaveTextContent('3');
    expect(within(within(table).getByRole('row', { name: /steps\.claude\.implement\.model/u })).getByLabelText('Origin: global')).toBeInTheDocument();
    expect(within(within(table).getByRole('row', { name: /steps\.claude\.implement\.effort/u })).getByLabelText('Origin: default')).toBeInTheDocument();
  });

  it('flags unknown keys as possibly stale', async () => {
    const response = { ...effective(), unknownKeys: [{ path: 'review.fix', scope: 'project' }] };
    renderApp('/config#token=abc', configServer({ 'GET /config/global/effective': () => json(response) }).fetch);

    const stale = await screen.findByRole('list', { name: 'Unknown keys' });
    expect(stale).toHaveTextContent('review.fix');
    expect(stale).toHaveTextContent('possibly stale');
  });

  it('switches to a known project scope', async () => {
    const user = userEvent.setup();
    const stub = configServer({
      'GET /config/project:p1': () => json({ ...raw({}), scope: 'project:p1' }),
      'GET /config/project:p1/effective': () => json({ ...effective({ output: { origin: 'project', value: 'proj-out' } }), scope: 'project:p1' }),
      'GET /projects': () => json({ projects: [{ createdAt: '2026-11-03T10:00:00.000Z', id: 'p1', path: '/work/app' }] }),
    });
    renderApp('/config#token=abc', stub.fetch);

    await screen.findByRole('option', { name: '/work/app' });
    await user.selectOptions(screen.getByLabelText('Scope'), 'project:p1');

    const table = await screen.findByRole('table', { name: 'Effective config for /work/app' });
    expect(within(within(table).getByRole('row', { name: /^output/u })).getByLabelText('Origin: project')).toBeInTheDocument();
  });
});

describe('config page: edit, review and save', () => {
  it('previews the edited object, unknown keys kept, and shows the diff', async () => {
    const user = userEvent.setup();
    const stub = configServer({ 'POST /config/global/preview': () => json(preview()) });
    renderApp('/config#token=abc', stub.fetch);

    const output = await openEditTab(user);
    await user.clear(output);
    await user.type(output, 'out');
    await user.click(screen.getByRole('button', { name: 'Review changes' }));

    expect(await screen.findByRole('list', { name: 'Proposed changes' })).toHaveTextContent('"output": "out"');
    expect(stub.calls.find((call) => call.method === 'POST')?.body).toEqual({ output: 'out', review: { fix: true } });
    expect(screen.getByRole('list', { name: 'Unknown keys in this file' })).toHaveTextContent('review.fix');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('shows validation issues next to their field and blocks the save', async () => {
    const user = userEvent.setup();
    const issues = [{ message: 'Expected a non-empty string', path: 'worktrees' }];
    renderApp('/config#token=abc', configServer({ 'POST /config/global/preview': () => json(preview({ diff: [], issues })) }).fetch);

    await openEditTab(user);
    await user.type(screen.getByLabelText('Worktrees folder'), ' ');
    await user.click(screen.getByRole('button', { name: 'Review changes' }));

    const worktrees = screen.getByLabelText('Worktrees folder');
    await waitFor(() => expect(worktrees).toHaveAccessibleDescription('Expected a non-empty string'));
    expect(worktrees).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('falls back to free text with the reason when the model listing is unavailable', async () => {
    const user = userEvent.setup();
    const unavailable = { available: false, harness: 'claude', reason: 'claude CLI not found on PATH' };
    renderApp('/config#token=abc', configServer({ 'GET /models?harness=claude': () => json(unavailable) }).fetch);

    await openEditTab(user);

    const model = await screen.findByRole('textbox', { name: 'Model for claude implement' });
    expect(model).not.toHaveAttribute('list');
    expect(await screen.findByText(/claude CLI not found on PATH/u)).toBeInTheDocument();
  });

  it('offers the listed model ids as suggestions', async () => {
    const user = userEvent.setup();
    renderApp('/config#token=abc', configServer().fetch);

    await openEditTab(user);

    expect(await screen.findByRole('combobox', { name: 'Model for claude implement' })).toHaveAttribute('list');
    expect(screen.getAllByRole('option', { hidden: true, name: 'opus' })).toHaveLength(HARNESS_COUNT);
  });

  it('accepts an unlisted model id, shows the warning and still saves, then refreshes the effective view', async () => {
    const user = userEvent.setup();
    const warnings = [{ message: 'Unknown model id "my-model" for claude', path: 'steps.claude.implement.model' }];
    const stub = configServer({
      'GET /config/global/effective': [() => json(effective()), () => json(effective({ output: { origin: 'global', value: 'refreshed' } }))],
      'POST /config/global/preview': () => json(preview({ warnings })),
      'PUT /config/global': () => json({ changed: true, scope: 'global', text: '{}', unknownKeys: [], warnings }),
    });
    renderApp('/config#token=abc', stub.fetch);

    await openEditTab(user);
    await user.type(await screen.findByRole('combobox', { name: 'Model for claude implement' }), 'my-model');
    await user.click(screen.getByRole('button', { name: 'Review changes' }));

    expect(await screen.findByText('Unknown model id "my-model" for claude')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Config saved.')).toBeInTheDocument();
    const put = stub.calls.find((call) => call.method === 'PUT');
    expect(put).toMatchObject({ authorization: 'Bearer abc', body: { steps: { claude: { implement: { model: 'my-model' } } } } });
    await user.click(screen.getByRole('tab', { name: 'Effective' }));
    expect(await screen.findByText('refreshed')).toBeInTheDocument();
  });

  it('says nothing changed when the save wrote nothing', async () => {
    const user = userEvent.setup();
    const stub = configServer({
      'POST /config/global/preview': () => json(preview({ diff: [] })),
      'PUT /config/global': () => json({ changed: false, scope: 'global', text: '{}', unknownKeys: [], warnings: [] }),
    });
    renderApp('/config#token=abc', stub.fetch);

    await openEditTab(user);
    await user.click(screen.getByRole('button', { name: 'Review changes' }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Nothing changed: the file already holds this config.')).toBeInTheDocument();
  });
});

describe('config page: startup project (AC1)', () => {
  it('opens on the project serve started in', async () => {
    const project = { createdAt: '2026-11-03T10:00:00.000Z', id: 'p-1', path: '/work/app' };
    const server = configServer({
      'GET /config/project:p-1': () => json({ ...raw(), scope: 'project:p-1' }),
      'GET /config/project:p-1/effective': () => json({ ...effective(), scope: 'project:p-1' }),
      'GET /projects': () => json({ projects: [project] }),
    });

    renderApp('/config#token=abc&project=p-1', server.fetch);

    await waitFor(() => {
      expect(screen.getByLabelText('Scope')).toHaveValue('project:p-1');
    });
  });
});
