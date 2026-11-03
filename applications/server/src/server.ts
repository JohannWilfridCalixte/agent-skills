import type { AppEnv } from './platform/app-env.js';
import type { Logger } from './platform/log.js';
import type { ServerModule } from './platform/module.js';

import { Hono } from 'hono';

import { assertModules } from './module-registry.js';
import { correlationId } from './platform/correlation.js';
import { problem } from './platform/problem.js';
import { requestLog } from './platform/request-log.js';
import { bearerTokenOnWrites, hostAllowlist, originAllowlist } from './platform/security.js';

export interface AppDependencies {
  readonly logger: Logger;
  readonly modules: readonly ServerModule[];
  readonly port: number;
  /** Per-run write token (D28); never logged. */
  readonly token: string;
}

/** Middleware order: correlation id and log first, so rejected requests are logged and carry the id too. */
export function createApp({ logger, modules, port, token }: AppDependencies) {
  assertModules(modules);
  const app = new Hono<AppEnv>();

  app.use(correlationId(), requestLog(logger), hostAllowlist(port), originAllowlist(port), bearerTokenOnWrites(token));

  for (const module of modules) {
    const router = new Hono<AppEnv>();
    module.registerRoutes(router);
    app.route(`/api/${module.name}`, router);
  }

  app.notFound((c) => problem(c, { status: 404, title: 'Not found', type: 'not_found' }));
  app.onError((error, c) => {
    logger.error('http_unhandled_error', { correlation_id: c.get('correlationId'), error_name: error.name, url_path: c.req.path });
    return problem(c, { status: 500, title: 'Internal server error', type: 'internal_error' });
  });

  return app;
}
