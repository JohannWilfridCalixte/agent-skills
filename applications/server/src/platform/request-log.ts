import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from './app-env.js';
import type { Logger } from './log.js';

/** One `http_request` line per request (D33): method, path, status, duration, correlation id. No headers, no query. */
export function requestLog(logger: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const started = performance.now();
    await next();
    logger.info('http_request', {
      correlation_id: c.get('correlationId'),
      duration_ms: Math.round(performance.now() - started),
      http_method: c.req.method,
      http_status: c.res.status,
      url_path: c.req.path,
    });
  };
}
