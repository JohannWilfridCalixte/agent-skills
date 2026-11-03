import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { ProblemDetails, ProblemIssue } from '@agentic/contract-http/problem';

import type { AppEnv } from './app-env.js';

import { PROBLEM_CONTENT_TYPE } from '@agentic/contract-http/problem';

export interface ProblemInput {
  readonly detail?: string;
  readonly issues?: readonly ProblemIssue[];
  readonly status: ContentfulStatusCode;
  readonly title: string;
  /** Stable snake_case identifier: `host_not_allowed`. */
  readonly type: string;
}

/** RFC 9457 response carrying the request correlation id. */
export function problem(c: Context<AppEnv>, input: ProblemInput) {
  const body = {
    correlationId: c.get('correlationId'),
    status: input.status,
    title: input.title,
    type: input.type,
    ...(input.detail === undefined ? {} : { detail: input.detail }),
    ...(input.issues === undefined ? {} : { issues: [...input.issues] }),
  } satisfies ProblemDetails;

  return c.json(body, input.status, { 'Content-Type': PROBLEM_CONTENT_TYPE });
}
