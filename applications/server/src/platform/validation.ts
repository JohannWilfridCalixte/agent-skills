import type { Hook } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';

import type { AppEnv } from './app-env.js';

import { zValidator } from '@hono/zod-validator';

import { problem } from './problem.js';

/** `zValidator` answering a 422 `validation_failed` problem with one issue per failing field. */
export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(target: Target, schema: Schema) {
  const hook: Hook<z.infer<Schema>, AppEnv, string, Target, object, Schema> = (result, c) => {
    if (result.success) return undefined;
    return problem(c, {
      issues: result.error.issues.map((issue) => ({ message: issue.message, path: issue.path.map(String).join('.') })),
      status: 422,
      title: 'Invalid request',
      type: 'validation_failed',
    });
  };
  return zValidator<Schema, Target, AppEnv, string, typeof hook>(target, schema, hook);
}
