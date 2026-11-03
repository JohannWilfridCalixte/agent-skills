import type { RunService, RunSpec } from '@agentic/domain-shared';

import { describe, expect, it } from 'vitest';

import { InMemoryProjectRegistry } from '@agentic/domain-shared/testing';
import { err, ok } from '@agentic/kernel-result';

import { InMemoryVendorSource } from '../testing.js';
import { createVendoringService } from './vendoring-service.js';

const MANIFEST = '{"skills":[{"source":"a/b","skill":"grilling","into":"skills/flow"},{"source":"a/b","skill":"tdd","into":"skills/flow"}]}';

/** Records started specs; `output` is what `get` reports for any run. */
function recordingRuns(output: readonly string[] = []) {
  const started: RunSpec[] = [];
  const runs: RunService = {
    cancel: (id) => err({ id, type: 'run_not_found' }),
    get: (id) => (id === 'run-1' ? ok({ id, output, startedAt: 'now', status: 'failed' }) : err({ id, type: 'run_not_found' })),
    start: (spec) => {
      started.push(spec);
      return ok({ id: 'run-1', startedAt: 'now', status: 'running' });
    },
    subscribe: (id) => err({ id, type: 'run_not_found' }),
  };
  return { runs, started };
}

function setup({ manifest = MANIFEST as null | string, output = [] as readonly string[] } = {}) {
  const source = new InMemoryVendorSource();
  if (manifest !== null) source.set('/p', 'vendor.json', manifest);
  const { runs, started } = recordingRuns(output);
  const service = createVendoringService({ projects: new InMemoryProjectRegistry(['/p']), runs, source });
  return { service, started };
}

describe('vendoring service', () => {
  it('is unavailable without vendor.json and starts nothing', async () => {
    const { service, started } = setup({ manifest: null });

    expect(await service.status('project-1')).toEqual(ok({ available: false }));
    expect(await service.start('project-1', { action: 'check' })).toMatchObject({ error: { type: 'no_vendor_file' } });
    expect(started).toEqual([]);
  });

  it('answers unknown_project for an unknown id', async () => {
    const { service } = setup();

    expect(await service.status('nope')).toEqual(err({ projectId: 'nope', type: 'unknown_project' }));
  });

  it('reports a malformed vendor.json as an error', async () => {
    const { service } = setup({ manifest: '{' });

    expect(await service.status('project-1')).toMatchObject({ error: { file: 'vendor.json', type: 'malformed_vendor_file' } });
  });

  it('starts a run in the project, scoped to it, naming the action', async () => {
    const { service, started } = setup();

    await service.start('project-1', { action: 'update', skills: ['tdd'] });

    expect(started).toEqual([{ args: ['scripts/vendor-skills.mjs', 'update', 'tdd'], cli: 'node', cwd: '/p', scope: 'project:project-1', summary: 'Vendor update tdd' }]);
  });

  it('derives per-skill results from the run output', async () => {
    const { service } = setup({ output: ['ok grilling', 'FAIL tdd: hash mismatch'] });

    const results = await service.results('project-1', 'run-1');

    expect(results).toEqual(ok({ results: [{ detail: '', name: 'grilling', status: 'ok' }, { detail: 'hash mismatch', name: 'tdd', status: 'drift' }], runId: 'run-1', status: 'failed' }));
  });
});
