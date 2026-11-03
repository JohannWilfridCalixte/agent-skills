import { describe, expect, it } from 'vitest';

import { ProblemDetails } from './index.js';

describe('ProblemDetails', () => {
  it('accepts a problem with validation issues and extension members', () => {
    const problem = {
      correlationId: '6f1c',
      issues: [{ message: 'Required', path: 'path' }],
      retryAfterSeconds: 30,
      status: 422,
      title: 'Invalid request',
      type: 'validation_failed',
    };

    expect(ProblemDetails.parse(problem)).toEqual(problem);
  });

  it('rejects a success status', () => {
    expect(ProblemDetails.safeParse({ status: 200, title: 'OK', type: 'about:blank' }).success).toBe(false);
  });

  it('rejects a problem without a type', () => {
    expect(ProblemDetails.safeParse({ status: 404, title: 'Not found' }).success).toBe(false);
  });
});
