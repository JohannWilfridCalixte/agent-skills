import type { Hono } from 'hono';

import type { HarnessesResponse, ModelsResponse } from '@agentic/contract-http/install';
import type { InstallService } from '@agentic/domain-install';

import type { AppEnv } from '../../platform/app-env.js';

import { ModelsQuery } from '@agentic/contract-http/install';

import { validate } from '../../platform/validation.js';

/** Mounted under `/api/install`. */
export function registerInstallRoutes(app: Hono<AppEnv>, service: InstallService) {
  app.get('/harnesses', async (c) => {
    const harnesses = await service.harnesses();
    return c.json({ harnesses: harnesses.map((presence) => ({ ...presence, cli: { ...presence.cli } })) } satisfies HarnessesResponse);
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
