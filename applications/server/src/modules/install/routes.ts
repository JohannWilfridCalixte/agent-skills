import type { Context, Hono } from 'hono';

import type { HarnessesResponse, InstallPreviewResponse, InstallRunResponse, InstallStatusResponse, ModelsResponse } from '@agentic/contract-http/install';
import type { CatalogueService, InstallError, InstallService } from '@agentic/domain-install';

import type { AppEnv } from '../../platform/app-env.js';

import { InstallRequest, InstallRunRequest, InstallStatusQuery, ModelsQuery } from '@agentic/contract-http/install';
import { displayCommand } from '@agentic/domain-install';

import { problem } from '../../platform/problem.js';
import { validate } from '../../platform/validation.js';

/** Mounted under `/api/install`. Preview runs nothing; only a confirmed `POST /runs` starts a run (AC13). */
export function registerInstallRoutes(app: Hono<AppEnv>, service: InstallService, catalogue: CatalogueService) {
  app.get('/harnesses', async (c) => {
    const harnesses = await service.harnesses();
    return c.json({ harnesses: harnesses.map((presence) => ({ ...presence, cli: { ...presence.cli } })) } satisfies HarnessesResponse);
  });

  app.get('/status', validate('query', InstallStatusQuery), async (c) => {
    const { projectId, scope } = c.req.valid('query');
    const status = await catalogue.status({ scope, ...(projectId === undefined ? {} : { projectId }) });
    if (!status.ok) return installProblem(c, status.error);
    return c.json({ statuses: status.value.map((entry) => ({ ...entry })) } satisfies InstallStatusResponse);
  });

  app.post('/preview', validate('json', InstallRequest), async (c) => {
    const preview = await catalogue.preview(withoutUndefined(c.req.valid('json')));
    if (!preview.ok) return installProblem(c, preview.error);
    const commands = preview.value.map((command) => ({ args: [...command.args], cli: command.cli, display: displayCommand(command), ...(command.cwd === undefined ? {} : { cwd: command.cwd }) }));
    return c.json({ commands, steps: commands.length } satisfies InstallPreviewResponse);
  });

  app.post('/runs', validate('json', InstallRunRequest), async (c) => {
    const { confirm: _confirm, ...request } = c.req.valid('json');
    const started = await catalogue.start(withoutUndefined(request));
    if (!started.ok) return installProblem(c, started.error);
    return c.json({ ...started.value } satisfies InstallRunResponse, 201);
  });
}

/** Mounted under `/api/models`; a missing or failing CLI is a 200 with `available: false` (D14). */
export function registerModelsRoutes(app: Hono<AppEnv>, service: InstallService) {
  app.get('/', validate('query', ModelsQuery), async (c) => {
    const { harness } = c.req.valid('query');
    const listing = await service.models(harness);
    return c.json((listing.available ? { available: true, harness, ids: [...listing.ids] } : { available: false, harness, reason: listing.reason }) satisfies ModelsResponse);
  });
}

function installProblem(c: Context<AppEnv>, error: InstallError) {
  switch (error.type) {
    case 'invalid_run':
      return problem(c, { detail: error.issues.join('; '), status: 422, title: 'Invalid run', type: 'invalid_run_spec' });
    case 'method_unavailable':
      return problem(c, { detail: error.reason, status: 409, title: 'Install method not available on this machine', type: 'method_unavailable' });
    case 'unknown_project':
      return problem(c, { detail: `No known project ${error.projectId}`, status: 404, title: 'Project not found', type: 'project_not_found' });
    case 'unsupported':
      return problem(c, { detail: error.reason, status: 422, title: 'Not in the install catalogue', type: 'unsupported_install' });
    default:
      return error satisfies never;
  }
}

function withoutUndefined({ action, harness, method, projectId, scope }: InstallRequest) {
  return { action, method, scope, ...(harness === undefined ? {} : { harness }), ...(projectId === undefined ? {} : { projectId }) };
}
