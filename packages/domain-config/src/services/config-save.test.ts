import { describe, expect, it } from 'vitest';

import { InMemoryHistoryLog, InMemoryProjectRegistry } from '@agentic/domain-shared/testing';

import { InMemoryConfigStore, InMemoryModelCatalog } from '../testing.js';
import { createConfigService } from './config-service.js';

const PROJECT_PATH = '/work/app';
const PROJECT = { kind: 'project', projectPath: PROJECT_PATH } as const;

function setup(models?: InMemoryModelCatalog) {
  const store = new InMemoryConfigStore();
  const history = new InMemoryHistoryLog();
  const service = createConfigService({ history, projects: new InMemoryProjectRegistry([PROJECT_PATH]), store, ...(models === undefined ? {} : { models }) });
  return { history, service, store };
}

describe('config preview (AC4)', () => {
  it('diffs the file on disk against the proposed text and writes nothing', async () => {
    const { history, service, store } = setup();
    store.set(PROJECT, '{"output":"old"}');

    const preview = await service.preview('project:project-1', { output: 'new' });

    expect(preview).toMatchObject({ ok: true, value: { issues: [], proposedText: '{\n  "output": "new"\n}\n', scope: 'project:project-1' } });
    expect(preview.ok && preview.value.diff).toEqual([
      { kind: 'removed', text: '{"output":"old"}' },
      { kind: 'added', text: '{' },
      { kind: 'added', text: '  "output": "new"' },
      { kind: 'added', text: '}' },
    ]);
    expect(store.writes).toEqual([]);
    expect(history.entries).toEqual([]);
  });

  it('returns issues instead of a diff for an invalid config', async () => {
    const { service } = setup();

    const preview = await service.preview('global', { commitWork: 'yes' });

    expect(preview).toMatchObject({ ok: true, value: { diff: [], issues: [{ path: 'commitWork' }], proposedText: null } });
  });

  it('rejects an unknown project', async () => {
    const { service } = setup();

    expect(await service.preview('project:nope', {})).toEqual({ error: { projectId: 'nope', type: 'project_not_found' }, ok: false });
  });
});

describe('model warnings (D14)', () => {
  const edited = { steps: { claude: { grill: { model: 'opus' }, implement: { harness: 'codex', model: 'gpt-x' } } } };

  it('warns on an id unknown to the harness that runs the step, without blocking', async () => {
    const { service, store } = setup(new InMemoryModelCatalog({ claude: ['opus'], codex: ['gpt-6.1-sol'] }));

    const saved = await service.save('global', edited);

    expect(saved.ok && saved.value.warnings).toEqual([{ message: 'Unknown codex model "gpt-x"; it will be used as typed', path: 'steps.claude.implement.model' }]);
    expect(store.writes).toHaveLength(1);
  });

  it('warns nothing when the catalog is unavailable or absent', async () => {
    const unavailable = await setup(new InMemoryModelCatalog()).service.preview('global', edited);
    const absent = await setup().service.preview('global', edited);

    expect([unavailable.ok && unavailable.value.warnings, absent.ok && absent.value.warnings]).toEqual([[], []]);
  });
});

describe('config save', () => {
  it('blocks an invalid config and leaves the file untouched (AC7)', async () => {
    const { history, service, store } = setup();
    store.set(PROJECT, '{}');

    const saved = await service.save('project:project-1', { limits: { 'review.iterations': -1 } });

    expect(saved).toEqual({
      error: { issues: [{ message: 'Expected a non-negative number', path: 'limits.review.iterations' }], scope: 'project:project-1', type: 'config_invalid' },
      ok: false,
    });
    expect([store.get(PROJECT), history.entries]).toEqual(['{}', []]);
  });

  it('snapshots the content on disk first, then writes, then records the new content (AC16)', async () => {
    const { history, service, store } = setup();
    store.set(PROJECT, '{"output":"changed elsewhere"}');

    const saved = await service.save('project:project-1', { output: 'mine' });

    expect(saved).toMatchObject({ ok: true, value: { changed: true, text: '{\n  "output": "mine"\n}\n' } });
    expect(store.get(PROJECT)).toBe('{\n  "output": "mine"\n}\n');
    expect(history.entries.map(({ content, kind, scope }) => ({ content, kind, scope }))).toEqual([
      { content: '{"output":"changed elsewhere"}', kind: 'config_write', scope: 'project:project-1' },
      { content: '{\n  "output": "mine"\n}\n', kind: 'config_write', scope: 'project:project-1' },
    ]);
  });

  it('records only the new content when the file did not exist', async () => {
    const { history, service } = setup();

    await service.save('global', { commitWork: true });

    expect(history.entries.map((entry) => entry.content)).toEqual(['{\n  "commitWork": true\n}\n']);
  });

  it('writes and records nothing when the file already holds the proposed text', async () => {
    const { history, service, store } = setup();
    store.set(PROJECT, '{\n  "output": "o"\n}\n');

    const saved = await service.save('project:project-1', { output: 'o' });

    expect([saved.ok && saved.value.changed, store.writes, history.entries]).toEqual([false, [], []]);
  });

  it('records no new entry when the write fails', async () => {
    const { history, service, store } = setup();
    store.set(PROJECT, '{"output":"before"}');
    store.failWrites = true;

    await expect(service.save('project:project-1', { output: 'after' })).rejects.toThrow('write failed');
    expect(history.entries.map((entry) => entry.content)).toEqual(['{"output":"before"}']);
  });

  it('replaces a file that is not valid JSON', async () => {
    const { service, store } = setup();
    store.set(PROJECT, '{oops');

    await service.save('project:project-1', { output: 'fixed' });

    expect(store.get(PROJECT)).toBe('{\n  "output": "fixed"\n}\n');
  });
});
