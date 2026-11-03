import type { Context, Hono } from 'hono';

import type { ConfigPreviewResponse, ConfigSaveResponse, EffectiveConfigResponse, RawConfigResponse } from '@agentic/contract-http/config';
import type { ConfigService, ReadConfigError, SaveConfigError } from '@agentic/domain-config';

import type { AppEnv } from '../../platform/app-env.js';

import { EditedConfig } from '@agentic/contract-http/config';

import { problem } from '../../platform/problem.js';
import { validate } from '../../platform/validation.js';

/** Mounted under `/api/config`; `:scope` is `global` or `project:<id>`, never a path (D31). Saves go through preview (diff) then PUT. */
export function registerConfigRoutes(app: Hono<AppEnv>, service: ConfigService) {
  app.get('/:scope/effective', async (c) => {
    const scope = c.req.param('scope');
    const view = await service.effective(scope);
    if (!view.ok) return configProblem(c, view.error);
    const { profiles, reviewers, selectedProfiles, unknownKeys, ...rest } = view.value;
    const config = {
      ...rest,
      profiles: { origin: profiles.origin, value: profiles.value.map(({ detect, name, skills }) => ({ name, skills: [...skills], ...(detect === undefined ? {} : { detect: [...detect] }) })) },
      reviewers: { origin: reviewers.origin, value: [...reviewers.value] },
      selectedProfiles: { origin: selectedProfiles.origin, value: [...selectedProfiles.value] },
    };
    return c.json({ config, scope, unknownKeys: [...unknownKeys] } satisfies EffectiveConfigResponse);
  });

  app.post('/:scope/preview', validate('json', EditedConfig), async (c) => {
    const preview = await service.preview(c.req.param('scope'), c.req.valid('json'));
    if (!preview.ok) return configProblem(c, preview.error);
    const { diff, issues, proposedText, scope, unknownKeys, warnings } = preview.value;
    return c.json({ diff: [...diff], issues: [...issues], proposedText, scope, unknownKeys: [...unknownKeys], warnings: [...warnings] } satisfies ConfigPreviewResponse);
  });

  app.put('/:scope', validate('json', EditedConfig), async (c) => {
    const saved = await service.save(c.req.param('scope'), c.req.valid('json'));
    if (!saved.ok) return configProblem(c, saved.error);
    const { changed, scope, text, unknownKeys, warnings } = saved.value;
    return c.json({ changed, scope, text, unknownKeys: [...unknownKeys], warnings: [...warnings] } satisfies ConfigSaveResponse);
  });

  app.get('/:scope', async (c) => {
    const read = await service.raw(c.req.param('scope'));
    if (!read.ok) return configProblem(c, read.error);
    const { exists, file, scope, text } = read.value;
    return c.json({ config: { ...file.raw }, exists, scope, text, unknownKeys: [...file.unknownKeys] } satisfies RawConfigResponse);
  });
}

function configProblem(c: Context<AppEnv>, error: ReadConfigError | SaveConfigError) {
  switch (error.type) {
    case 'config_invalid': {
      return problem(c, { detail: `The edited ${error.scope} config is invalid; nothing was written.`, issues: error.issues, status: 422, title: 'Invalid config', type: error.type });
    }
    case 'config_unreadable': {
      return problem(c, {
        detail: `${error.scope} config is unreadable (${error.reason}): ${error.detail}`,
        issues: error.issues,
        status: 422,
        title: 'Config file unreadable',
        type: error.type,
      });
    }
    case 'invalid_scope': {
      return problem(c, { detail: 'Scope must be "global" or "project:<id>".', status: 422, title: 'Invalid config scope', type: error.type });
    }
    case 'project_not_found': {
      return problem(c, { detail: `No known project ${error.projectId}.`, status: 404, title: 'Project not found', type: error.type });
    }
    default: {
      return error satisfies never;
    }
  }
}
