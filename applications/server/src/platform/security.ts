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

/** Fetch Metadata values a browser sends for the app's own page (`same-origin`) or a typed URL (`none`). */
const ALLOWED_FETCH_SITES: ReadonlySet<string> = new Set(['none', 'same-origin']);

/**
 * CSRF protection (D19): same-origin only. Browsers omit Origin on cross-site no-cors GETs (`<img src>`) but always
 * send `Sec-Fetch-Site`, so a present one must say same-origin or none. Neither header: a non-browser client (CLI, curl).
 */
export function originAllowlist(port: number): MiddlewareHandler<AppEnv> {
  const allowed = new Set(localHosts(port).map((host) => `http://${host}`));
  return async (c, next) => {
    const origin = c.req.header('origin');
    const site = c.req.header('sec-fetch-site');
    if ((origin !== undefined && !allowed.has(origin)) || (site !== undefined && !ALLOWED_FETCH_SITES.has(site))) {
      return problem(c, { status: 403, title: 'Origin not allowed', type: 'origin_not_allowed' });
    }
    return next();
  };
}

const digest = (value: string) => createHash('sha256').update(value).digest();

const withoutTrailingSlash = (path: string) => (path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path);

/**
 * Writes, and GETs that launch a subprocess (`processGets`, full paths), need `Authorization: Bearer <token>` (D28,
 * ADR 0009); pure reads stay tokenless. Digests make the compare constant-time whatever the length.
 */
export function bearerToken(token: string, processGets: readonly string[]): MiddlewareHandler<AppEnv> {
  const expected = digest(token);
  const guardedGets = new Set(processGets.map(withoutTrailingSlash));
  return async (c, next) => {
    const needsToken = WRITE_METHODS.has(c.req.method) || guardedGets.has(withoutTrailingSlash(c.req.path));
    if (!needsToken) return next();
    const presented = /^Bearer (\S+)$/.exec(c.req.header('authorization') ?? '')?.[1];
    if (presented !== undefined && timingSafeEqual(digest(presented), expected)) return next();
    c.header('WWW-Authenticate', 'Bearer');
    return problem(c, { status: 401, title: 'Missing or invalid API token', type: 'unauthorized' });
  };
}
