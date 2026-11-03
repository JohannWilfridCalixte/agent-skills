import { z } from 'zod';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const ProblemIssue = z.object({
  message: z.string(),
  path: z.string(),
});

export type ProblemIssue = z.infer<typeof ProblemIssue>;

/** RFC 9457 problem details. Unknown extension members pass through. */
export const ProblemDetails = z.looseObject({
  correlationId: z.string().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  /** Present on request validation failures. */
  issues: z.array(ProblemIssue).optional(),
  status: z.int().min(400).max(599),
  title: z.string().min(1),
  /** Stable snake_case identifier, e.g. `host_not_allowed`. */
  type: z.string().min(1),
});

export type ProblemDetails = z.infer<typeof ProblemDetails>;
