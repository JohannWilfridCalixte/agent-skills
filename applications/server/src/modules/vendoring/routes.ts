import type { Context, Hono } from 'hono';

import type { VendoringPreviewResponse, VendoringResultsResponse, VendoringRunResponse, VendoringStatusResponse } from '@agentic/contract-http/vendoring';
import type { VendoringError, VendoringService, VendorRequest } from '@agentic/domain-vendoring';

import type { AppEnv } from '../../platform/app-env.js';

import { VendoringRequest, VendoringRunRequest } from '@agentic/contract-http/vendoring';
import { displayCommand } from '@agentic/domain-vendoring';

import { problem } from '../../platform/problem.js';
import { validate } from '../../platform/validation.js';

/** Mounted under `/api/vendoring`. Status and preview run nothing; only a confirmed `POST /runs` starts a run. */
export function registerVendoringRoutes(app: Hono<AppEnv>, service: VendoringService) {
  app.get('/:projectId/status', async (c) => {
    const status = await service.status(c.req.param('projectId'));
    if (!status.ok) return vendoringProblem(c, status.error);
    const body = status.value.available ? { available: true as const, skills: status.value.skills.map((skill) => ({ ...skill })) } : { available: false as const };
    return c.json(body satisfies VendoringStatusResponse);
  });

  app.post('/:projectId/preview', validate('json', VendoringRequest), async (c) => {
    const preview = await service.preview(c.req.param('projectId'), toRequest(c.req.valid('json')));
    if (!preview.ok) return vendoringProblem(c, preview.error);
    const command = preview.value;
    return c.json({ command: { args: [...command.args], cli: command.cli, cwd: command.cwd ?? '', display: displayCommand(command) } } satisfies VendoringPreviewResponse);
  });

  app.post('/:projectId/runs', validate('json', VendoringRunRequest), async (c) => {
    const started = await service.start(c.req.param('projectId'), toRequest(c.req.valid('json')), { correlationId: c.get('correlationId') });
    if (!started.ok) return vendoringProblem(c, started.error);
    return c.json({ ...started.value } satisfies VendoringRunResponse, 201);
  });

  app.get('/:projectId/runs/:runId/results', async (c) => {
    const found = await service.results(c.req.param('projectId'), c.req.param('runId'));
    if (!found.ok) return vendoringProblem(c, found.error);
    return c.json({ ...found.value, results: found.value.results.map((result) => ({ ...result })) } satisfies VendoringResultsResponse);
  });
}

function toRequest({ action, all, skills }: VendoringRequest): VendorRequest {
  return { action, ...(all === undefined ? {} : { all }), ...(skills === undefined ? {} : { skills }) };
}

function vendoringProblem(c: Context<AppEnv>, error: VendoringError) {
  switch (error.type) {
    case 'invalid_run':
      return problem(c, { detail: error.issues.join('; '), status: 422, title: 'Invalid run', type: 'invalid_run_spec' });
    case 'invalid_selection':
      return problem(c, { detail: error.reason, status: 422, title: 'Invalid skill selection', type: error.type });
    case 'malformed_vendor_file':
      return problem(c, { detail: `${error.file}: ${error.reason}`, status: 409, title: 'Vendor file is malformed', type: error.type });
    case 'no_vendor_file':
      return problem(c, { detail: `Project ${error.projectId} has no vendor.json`, status: 409, title: 'Project has no vendored skills', type: error.type });
    case 'run_not_found':
      return problem(c, { detail: `No run ${error.id}`, status: 404, title: 'Run not found', type: error.type });
    case 'unknown_project':
      return problem(c, { detail: `No known project ${error.projectId}`, status: 404, title: 'Project not found', type: 'project_not_found' });
    case 'unknown_skill':
      return problem(c, { detail: `Not in vendor.json: ${error.names.join(', ')}`, status: 422, title: 'Unknown vendored skill', type: error.type });
    default:
      return error satisfies never;
  }
}
