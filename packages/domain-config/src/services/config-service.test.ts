import { describe, expect, it } from 'vitest';

import { InMemoryHistoryLog, InMemoryProjectRegistry } from '@agentic/domain-shared/testing';

import { InMemoryConfigStore } from '../testing.js';
import { createConfigService } from './config-service.js';

const PROJECT_PATH = '/work/app';

function setup() {
  const store = new InMemoryConfigStore();
  const service = createConfigService({ history: new InMemoryHistoryLog(), projects: new InMemoryProjectRegistry([PROJECT_PATH]), store });
  return { service, store };
}

describe('config service', () => {
  it('treats missing files as empty config', async () => {
    const { service } = setup();

    const raw = await service.raw('project:project-1');
    const view = await service.effective('project:project-1');

    expect(raw).toMatchObject({ ok: true, value: { exists: false, scope: 'project:project-1', text: null } });
    expect(view.ok && view.value.output).toEqual({ origin: 'default', value: '.agentic/work' });
  });

  it('reads the global file under the known project path file', async () => {
    const { service, store } = setup();
    store.set({ kind: 'global' }, '{"output":"g","commitWork":true}').set({ kind: 'project', projectPath: PROJECT_PATH }, '{"output":"p"}');

    const view = await service.effective('project:project-1');
    const globalView = await service.effective('global');

    expect(view.ok && [view.value.output, view.value.commitWork]).toEqual([
      { origin: 'project', value: 'p' },
      { origin: 'global', value: true },
    ]);
    expect(globalView.ok && globalView.value.output).toEqual({ origin: 'global', value: 'g' });
  });

  it('returns typed errors for unreadable files, unknown projects and bad scopes', async () => {
    const { service, store } = setup();
    store.set({ kind: 'global' }, '{nope').set({ kind: 'project', projectPath: PROJECT_PATH }, '{"limits":{"a":-1}}');

    expect(await service.raw('global')).toMatchObject({ error: { reason: 'invalid_json', scope: 'global', type: 'config_unreadable' }, ok: false });
    expect(await service.effective('project:project-1')).toMatchObject({
      error: { issues: [{ path: 'limits.a' }], reason: 'invalid_schema', scope: 'project:project-1', type: 'config_unreadable' },
      ok: false,
    });
    expect(await service.raw('project:missing')).toMatchObject({ error: { type: 'project_not_found' }, ok: false });
    expect(await service.raw('elsewhere')).toMatchObject({ error: { type: 'invalid_scope' }, ok: false });
  });
});
