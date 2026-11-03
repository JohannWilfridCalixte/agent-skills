import { z } from 'zod';

export const RunStatus = z.enum(['running', 'succeeded', 'failed', 'cancelled']);

export type RunStatus = z.infer<typeof RunStatus>;

export const RunSummary = z.object({
  exitCode: z.int().optional(),
  finishedAt: z.iso.datetime().optional(),
  id: z.string().min(1),
  startedAt: z.iso.datetime(),
  status: RunStatus,
  /** `true` once earlier output lines were dropped from the replay buffer (older servers omit it). */
  truncated: z.boolean().optional(),
});

export type RunSummary = z.infer<typeof RunSummary>;

/** `GET /api/runs/:id`: summary plus the buffered output lines. */
export const RunDetail = RunSummary.extend({
  output: z.array(z.string()),
});

export type RunDetail = z.infer<typeof RunDetail>;

/**
 * One SSE `data` payload of `GET /api/runs/:id/events`, the SSE `event` name being `type`. Lines arrive as
 * stdout/stderr, then `exit` (when the process exited), then a final `status`, after which the stream closes.
 * `dropped` precedes the lines that follow a gap: that many earlier lines are no longer buffered.
 */
export const RunEvent = z.discriminatedUnion('type', [
  z.object({ dropped: z.int().positive(), type: z.literal('dropped') }),
  z.object({ line: z.string(), type: z.enum(['stdout', 'stderr']) }),
  z.object({ exitCode: z.int(), type: z.literal('exit') }),
  z.object({ status: RunStatus, type: z.literal('status') }),
]);

export type RunEvent = z.infer<typeof RunEvent>;
