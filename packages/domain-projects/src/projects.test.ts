import { describe, expect, it } from 'vitest';

import { createProjectsService } from './index.js';
import { FakeDirectoryProbe, InMemoryProjectRepository } from './testing.js';

function setup() {
  const repository = new InMemoryProjectRepository();
  let sequence = 0;
  const service = createProjectsService({
    directoryProbe: new FakeDirectoryProbe({ '/work/app': 'directory', '/work/file.txt': 'other', '/work/lib': 'directory' }),
    newId: () => `id-${String(++sequence)}`,
    now: () => new Date('2026-11-03T10:00:00.000Z'),
    repository,
  });
  return { repository, service };
}

describe('add project', () => {
  it('registers an absolute existing directory', async () => {
    const { service } = setup();

    const added = await service.add('/work/app/');

    expect(added).toEqual({ ok: true, value: { createdAt: '2026-11-03T10:00:00.000Z', id: 'id-1', path: '/work/app' } });
    expect(await service.list()).toEqual([{ createdAt: '2026-11-03T10:00:00.000Z', id: 'id-1', path: '/work/app' }]);
  });

  it.each([
    ['work/app', 'path_not_absolute'],
    ['', 'path_not_absolute'],
    ['/work/missing', 'path_not_found'],
    ['/work/file.txt', 'path_not_directory'],
  ])('rejects %j with %s and stores nothing', async (path, type) => {
    const { service } = setup();

    const added = await service.add(path);

    expect(added.ok ? undefined : added.error.type).toBe(type);
    expect(await service.list()).toEqual([]);
  });

  it('rejects a path already known, also with a trailing slash', async () => {
    const { service } = setup();
    await service.add('/work/app');

    const again = await service.add('/work/app/');

    expect(again).toEqual({ error: { path: '/work/app', projectId: 'id-1', type: 'project_already_known' }, ok: false });
  });
});

describe('remove project', () => {
  it('deletes the row only', async () => {
    const { service } = setup();
    await service.add('/work/app');
    await service.add('/work/lib');

    expect(await service.remove('id-1')).toEqual({ ok: true, value: 'id-1' });
    expect((await service.list()).map((project) => project.path)).toEqual(['/work/lib']);
  });

  it('reports an unknown id', async () => {
    const { service } = setup();

    expect(await service.remove('nope')).toEqual({ error: { id: 'nope', type: 'project_not_found' }, ok: false });
  });
});

describe('registry read port', () => {
  it('gets a project by id', async () => {
    const { service } = setup();
    await service.add('/work/app');

    expect((await service.get('id-1'))?.path).toBe('/work/app');
    expect(await service.get('id-2')).toBeUndefined();
  });
});
