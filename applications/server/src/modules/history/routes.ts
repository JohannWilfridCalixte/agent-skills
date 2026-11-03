import type { Context, Hono } from 'hono';

import type { HistoryEntry, HistoryList } from '@agentic/contract-http/history';
import type { GetHistoryEntryError, HistoryService } from '@agentic/domain-history';

import type { AppEnv } from '../../platform/app-env.js';

import { HistoryListQuery } from '@agentic/contract-http/history';

import { problem } from '../../platform/problem.js';
import { validate } from '../../platform/validation.js';

/** Mounted under `/api/history`; read-only until restore (T12). */
export function registerHistoryRoutes(app: Hono<AppEnv>, service: HistoryService) {
  app.get('/', validate('query', HistoryListQuery), async (c) => {
    const { limit, scope } = c.req.valid('query');
    const entries = await service.list(scope, limit === undefined ? {} : { limit });
    return c.json({ entries: [...entries] } satisfies HistoryList);
  });

  app.get('/:id', async (c) => {
    const found = await service.get(c.req.param('id'));
    if (!found.ok) return historyProblem(c, found.error);
    return c.json(found.value satisfies HistoryEntry);
  });
}

/** Exhaustive by type (a one-case switch trips no-unnecessary-condition); becomes a switch when T12 adds restore errors. */
const HISTORY_PROBLEMS = {
  history_entry_not_found: { status: 404, title: 'History entry not found' },
} as const satisfies Record<GetHistoryEntryError['type'], { readonly status: 404; readonly title: string }>;

function historyProblem(c: Context<AppEnv>, error: GetHistoryEntryError) {
  return problem(c, { ...HISTORY_PROBLEMS[error.type], type: error.type });
}
