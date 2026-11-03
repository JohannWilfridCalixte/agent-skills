import type { Context, Hono } from 'hono';

import type { RunDetail, RunEvent, RunSummary } from '@agentic/contract-http/runs';
import type { CancelRunError, RunService } from '@agentic/domain-shared';

import type { AppEnv } from '../../platform/app-env.js';

import { streamSSE } from 'hono/streaming';

import { problem } from '../../platform/problem.js';

/**
 * Mounted under `/api/runs`. There is deliberately no `POST /` taking a command (D34): runs are started only by
 * install and vendoring through `RunService`.
 */
/** Comment frames keep a quiet stream alive through proxies and clients; SSE parsers ignore them. */
export const DEFAULT_SSE_HEARTBEAT_MS = 5000;

export function registerRunsRoutes(app: Hono<AppEnv>, service: RunService, { heartbeatMs = DEFAULT_SSE_HEARTBEAT_MS }: { readonly heartbeatMs?: number } = {}) {
  app.get('/:id', (c) => {
    const found = service.get(c.req.param('id'));
    if (!found.ok) return runProblem(c, found.error);
    return c.json({ ...found.value, output: [...found.value.output] } satisfies RunDetail);
  });

  app.get('/:id/events', (c) => {
    const subscription = service.subscribe(c.req.param('id'));
    if (!subscription.ok) return runProblem(c, subscription.error);
    // A client disconnect only ends this loop; the run is owned by the service and keeps going (D27).
    return streamSSE(c, async (stream) => {
      const heartbeat = setInterval(() => {
        if (!stream.aborted) void stream.write(': keepalive\n\n');
      }, heartbeatMs);
      try {
        for await (const event of subscription.value) {
          if (stream.aborted) return;
          await stream.writeSSE({ data: JSON.stringify(event satisfies RunEvent), event: event.type });
        }
      } finally {
        clearInterval(heartbeat);
      }
    });
  });

  app.post('/:id/cancel', (c) => {
    const cancelled = service.cancel(c.req.param('id'));
    if (!cancelled.ok) return runProblem(c, cancelled.error);
    return c.json(cancelled.value satisfies RunSummary);
  });
}

function runProblem(c: Context<AppEnv>, error: CancelRunError) {
  switch (error.type) {
    case 'run_not_found': {
      return problem(c, { status: 404, title: 'Run not found', type: error.type });
    }
    case 'run_not_running': {
      return problem(c, { detail: `Run is ${error.status}.`, status: 409, title: 'Run is not running', type: error.type });
    }
    default: {
      return error satisfies never;
    }
  }
}
