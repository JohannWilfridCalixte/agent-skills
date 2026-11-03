import type { Hono } from 'hono';

import type { AppEnv } from './app-env.js';

import { existsSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

/** The SPA entry TanStack Start writes in SPA mode (prerendered shell). */
export const WEB_UI_SHELL = '_shell.html';

/** `applications/agentic` client build output, next to this server in the monorepo. */
export const DEFAULT_WEB_ROOT = resolve(import.meta.dir, '../../../agentic/dist/client');

/** True when `webRoot` holds a built shell. */
export function hasWebUi(webRoot: string) {
  return existsSync(join(webRoot, WEB_UI_SHELL));
}

/**
 * Serves the built SPA on GET/HEAD for every non-`/api` path: a file under the root, else the shell (client routing).
 * Registered after the security middleware, so Host and Origin checks apply to it too.
 */
export function registerWebUi(app: Hono<AppEnv>, webRoot: string) {
  const root = resolve(webRoot);
  app.on(['GET', 'HEAD'], '*', (c, next) => {
    const path = c.req.path;
    if (path === '/api' || path.startsWith('/api/')) return next();
    const file = resolveAsset(root, new URL(c.req.url).pathname) ?? join(root, WEB_UI_SHELL);
    return new Response(Bun.file(file));
  });
}

/** Absolute file under `webRoot` for a request path, or undefined when it escapes the root or is not a file. */
function resolveAsset(webRoot: string, requestPath: string) {
  let decoded = '';
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return undefined;
  }
  if (decoded.includes('\0')) return undefined;
  const candidate = resolve(webRoot, `.${decoded}`);
  const fromRoot = relative(webRoot, candidate);
  if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) return undefined;
  return existsSync(candidate) && statSync(candidate).isFile() ? candidate : undefined;
}
