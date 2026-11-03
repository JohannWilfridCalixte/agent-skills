import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from './app-env.js';

import { randomUUID } from 'node:crypto';

export const CORRELATION_HEADER = 'x-correlation-id';
const VALID_ID = /^[\w-]{1,128}$/;

/** Reuses a well-formed incoming id, otherwise generates one; echoes it on the response. */
export function correlationId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const incoming = c.req.header(CORRELATION_HEADER);
    const id = incoming !== undefined && VALID_ID.test(incoming) ? incoming : randomUUID();
    c.set('correlationId', id);
    c.header(CORRELATION_HEADER, id);
    await next();
  };
}
