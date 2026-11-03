import type { RunService, RunSpec } from '@agentic/domain-shared';

import { describe, expect, it } from 'vitest';

import { InMemoryProjectRegistry } from '@agentic/domain-shared/testing';
import { err, ok } from '@agentic/kernel-result';

import { FakeHarnessEnvironment } from '../testing.js';
import { createCatalogueService } from './catalogue-service.js';

const HOME = '/Users/me';
const CLONE = '/Users/me/.cursor/plugins/local/agentic';

/** Records started specs; the real sequencing and history live in `domain-runs` and the route tests. */
class RecordingRunService implements RunService {
  readonly specs: RunSpec[] = [];
  cancel(id: string) {
    return err({ id, type: 'run_not_found' } as const);
  }

  get(id: string) {
    return err({ id, type: 'run_not_found' } as const);
  }

  start(spec: RunSpec) {
    this.specs.push(spec);
    return ok({ id: `run-${String(this.specs.length)}`, startedAt: '2026-11-03T10:00:00.000Z', status: 'running' } as const);
  }

  subscribe(id: string) {
    return err({ id, type: 'run_not_found' } as const);
  }
}

function setup(environment = new FakeHarnessEnvironment()) {
  const runs = new RecordingRunService();
  const service = createCatalogueService({ environment, projects: new InMemoryProjectRegistry(['/work/app']), runs, userHome: HOME });
  return { environment, runs, service };
}

describe('preview (AC13)', () => {
  it('returns the commands and runs nothing', async () => {
    const { environment, runs, service } = setup();

    const preview = await service.preview({ action: 'update', harness: 'claude', method: 'plugin', scope: 'global' });

    expect(preview).toEqual({ ok: true, value: [{ args: ['plugin', 'marketplace', 'update', 'agentic'], cli: 'claude' }, { args: ['plugin', 'update', 'agentic@agentic'], cli: 'claude' }] });
    expect(runs.specs).toEqual([]);
    expect(environment.executed).toEqual([]);
  });

  it('runs project-scoped skills in the known project folder', async () => {
    const { service } = setup();

    const preview = await service.preview({ action: 'install', method: 'skills', projectId: 'project-1', scope: 'project' });

    expect(preview).toMatchObject({ ok: true, value: [{ cwd: '/work/app' }] });
  });

  it('rejects an unknown project', async () => {
    const { service } = setup();

    expect(await service.preview({ action: 'install', method: 'skills', projectId: 'nope', scope: 'project' })).toEqual({ error: { projectId: 'nope', type: 'unknown_project' }, ok: false });
  });

  it('refuses the cursor clone when ~/.cursor is missing', async () => {
    const { service } = setup();

    expect(await service.preview({ action: 'install', harness: 'cursor', method: 'clone', scope: 'global' })).toMatchObject({ error: { type: 'method_unavailable' }, ok: false });
  });
});

describe('start', () => {
  it('starts one run for the whole ordered sequence under the global scope', async () => {
    const { runs, service } = setup();

    const started = await service.start({ action: 'update', harness: 'claude', method: 'plugin', scope: 'global' });

    expect(started).toMatchObject({ ok: true, value: { id: 'run-1' } });
    expect(runs.specs).toEqual([
      { args: ['plugin', 'marketplace', 'update', 'agentic'], cli: 'claude', next: [{ args: ['plugin', 'update', 'agentic@agentic'], cli: 'claude' }], scope: 'global', summary: 'Update claude plugin' },
    ]);
  });

  it('records project-scoped runs under the project', async () => {
    const { runs, service } = setup();

    await service.start({ action: 'install', method: 'skills', projectId: 'project-1', scope: 'project' });

    expect(runs.specs).toMatchObject([{ cwd: '/work/app', scope: 'project:project-1', summary: 'Install skills CLI (project /work/app)' }]);
  });

  it('starts nothing for a combination outside the catalogue', async () => {
    const { runs, service } = setup();

    expect(await service.start({ action: 'marketplace-add', method: 'skills', scope: 'global' })).toMatchObject({ error: { type: 'unsupported' }, ok: false });
    expect(runs.specs).toEqual([]);
  });
});

describe('status (AC10, AC12)', () => {
  it('reads each tool and the cursor clone', async () => {
    const environment = new FakeHarnessEnvironment()
      .folder('.cursor')
      .folder('.cursor/plugins/local/agentic')
      .command({ args: ['plugin', 'list', '--json'], cli: 'claude' }, '[{"id":"agentic@agentic","version":"0.9.0"}]')
      .command({ args: ['-C', CLONE, 'rev-parse', '--short', 'HEAD'], cli: 'git' }, 'abc1234\n')
      .command({ args: ['skills', 'list', '-g', '--json'], cli: 'npx' }, '[]');
    const { service } = setup(environment);

    const status = await service.status({ scope: 'global' });

    expect(status).toEqual({
      ok: true,
      value: [
        { available: true, harness: 'claude', method: 'plugin', state: 'installed', version: '0.9.0' },
        { available: true, harness: 'codex', method: 'plugin', reason: 'codex plugin list failed: codex CLI not found', state: 'unknown' },
        { available: true, harness: 'cursor', method: 'clone', state: 'installed', version: 'abc1234' },
        { available: true, method: 'skills', scope: 'global', state: 'not_installed' },
      ],
    });
  });

  it('is not installed without running git when the clone is missing, and unavailable without ~/.cursor', async () => {
    const { environment, service } = setup();

    const status = await service.status({ scope: 'global' });

    expect(status.ok && status.value.find((entry) => entry.method === 'clone')).toEqual({ available: false, harness: 'cursor', method: 'clone', reason: '~/.cursor missing', state: 'not_installed' });
    expect(environment.executed.some((command) => command.cli === 'git')).toBe(false);
  });

  it('lists project skills in the project folder', async () => {
    const { environment, service } = setup();

    await service.status({ projectId: 'project-1', scope: 'project' });

    expect(environment.executed).toContainEqual({ args: ['skills', 'list', '--json'], cli: 'npx', cwd: '/work/app' });
  });
});
