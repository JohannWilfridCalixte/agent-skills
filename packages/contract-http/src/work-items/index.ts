import { z } from 'zod';

/** `state.json` summary, or why it could not be read (the item is still listed). */
export const WorkItemState = z.discriminatedUnion('readable', [
  z.object({
    phase: z.string().nullable(),
    readable: z.literal(true),
    status: z.string().nullable(),
    title: z.string().nullable(),
    updated: z.string().nullable(),
  }),
  z.object({
    readable: z.literal(false),
    reason: z.enum(['invalid_json', 'missing_state', 'not_an_object']),
  }),
]);

export type WorkItemState = z.infer<typeof WorkItemState>;

export const WorkItemSummary = z.object({
  /** Under `{output}/_archive`. */
  archived: z.boolean(),
  slug: z.string().min(1),
  state: WorkItemState,
});

export type WorkItemSummary = z.infer<typeof WorkItemSummary>;

/** `GET /api/projects/:projectId/work-items`: active and archived, newest first; empty when `{output}` is missing. */
export const WorkItemList = z.object({
  items: z.array(WorkItemSummary),
});

export type WorkItemList = z.infer<typeof WorkItemList>;

/** Latest 1000 events from at most the last 5 MB of `events.jsonl`; `malformed` counts skipped lines. */
export const WorkItemTimeline = z.object({
  events: z.array(z.record(z.string(), z.unknown())),
  malformed: z.int().min(0),
  truncated: z.boolean(),
});

export type WorkItemTimeline = z.infer<typeof WorkItemTimeline>;

/** `GET /api/projects/:projectId/work-items/:slug`. `docs` are names for the docs route (`spec`, `reviews/1-x.md`). */
export const WorkItemDetail = WorkItemSummary.extend({
  docs: z.array(z.string()),
  timeline: WorkItemTimeline,
});

export type WorkItemDetail = z.infer<typeof WorkItemDetail>;

/** `GET /api/projects/:projectId/work-items/:slug/docs/:name`: markdown, first 1 MB. */
export const WorkItemDoc = z.object({
  name: z.string(),
  text: z.string(),
  truncated: z.boolean(),
});

export type WorkItemDoc = z.infer<typeof WorkItemDoc>;
