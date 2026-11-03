import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from './app-env.js';

import { createHash, timingSafeEqual } from 'node:crypto';

import { problem } from './problem.js';

const WRITE_METHODS: ReadonlySet<string> = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);

const localHosts = (port: number) => [`127.0.0.1:${String(port)}`, `localhost:${String(port)}`];

/** DNS-rebinding protection (D19): only 127.0.0.1 or localhost with the server port. */
export function hostAllowlist(port: number): MiddlewareHandler<AppEnv> {
  const allowed = new Set(localHosts(port));
  return async (c, next) => {
    if (!allowed.has(c.req.header('host') ?? '')) {
      return problem(c, { status: 403, title: 'Host not allowed', type: 'host_not_allowed' });
    }
    return next();
  };
}

/** CSRF protection (D19): same-origin only. A missing Origin is a non-browser client, which still needs the token to write. */
export function originAllowlist(port: number): MiddlewareHandler<AppEnv> {
  const allowed = new Set(localHosts(port).map((host) => `http://${host}`));
  return async (c, next) => {
    const origin = c.req.header('origin');
    if (origin !== undefined && !allowed.has(origin)) {
      return problem(c, { status: 403, title: 'Origin not allowed', type: 'origin_not_allowed' });
    }
    return next();
  };
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Write methods need `Authorization: Bearer <token>` (D28); digests make the compare constant-time whatever the length. */
export function bearerTokenOnWrites(token: string): MiddlewareHandler<AppEnv> {
  const expected = digest(token);
  return async (c, next) => {
    if (!WRITE_METHODS.has(c.req.method)) return next();
    const presented = /^Bearer (\S+)$/.exec(c.req.header('authorization') ?? '')?.[1];
    if (presented !== undefined && timingSafeEqual(digest(presented), expected)) return next();
    c.header('WWW-Authenticate', 'Bearer');
    return problem(c, { status: 401, title: 'Missing or invalid API token', type: 'unauthorized' });
  };
}
