import { z } from 'zod';

import { RunSummary } from '../runs/index.js';

export const VendorAction = z.enum(['check', 'verify', 'update']);
export type VendorAction = z.infer<typeof VendorAction>;

/** A name as listed in `vendor.json`; the server also checks it is one of them. */
export const VendoredSkillName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const VendoredSkill = z.object({
  name: z.string(),
  /** Pinned commit in `vendor.lock.json`; `null` when not pinned yet. */
  ref: z.string().nullable(),
  source: z.string(),
});
export type VendoredSkill = z.infer<typeof VendoredSkill>;

/** `GET /api/vendoring/:projectId/status`: `available: false` (no `vendor.json`) hides the section; not an error. */
export const VendoringStatusResponse = z.discriminatedUnion('available', [
  z.object({ available: z.literal(false) }),
  z.object({ available: z.literal(true), skills: z.array(VendoredSkill) }),
]);
export type VendoringStatusResponse = z.infer<typeof VendoringStatusResponse>;

/**
 * `POST /api/vendoring/:projectId/preview` body. Strict: a command, path or any other field is rejected (AC26).
 * `update` needs `skills` (names from `vendor.json`) or `all: true`; check and verify take neither.
 */
export const VendoringRequest = z.strictObject({
  action: VendorAction,
  all: z.literal(true).optional(),
  skills: z.array(VendoredSkillName).optional(),
});
export type VendoringRequest = z.infer<typeof VendoringRequest>;

/** `POST /api/vendoring/:projectId/runs` body: the same request, explicitly confirmed. */
export const VendoringRunRequest = VendoringRequest.extend({ confirm: z.literal(true) });
export type VendoringRunRequest = z.infer<typeof VendoringRunRequest>;

/** `POST /api/vendoring/:projectId/preview`: the exact command a run would execute; nothing runs. */
export const VendoringPreviewResponse = z.object({
  command: z.object({ args: z.array(z.string()), cli: z.string(), cwd: z.string(), display: z.string() }),
});
export type VendoringPreviewResponse = z.infer<typeof VendoringPreviewResponse>;

/** `POST /api/vendoring/:projectId/runs` 201: follow it at `/api/runs/:id` and `/api/runs/:id/events`. */
export const VendoringRunResponse = RunSummary;
export type VendoringRunResponse = z.infer<typeof VendoringRunResponse>;

export const SkillResult = z.object({ detail: z.string(), name: z.string(), status: z.enum(['ok', 'drift', 'error']) });
export type SkillResult = z.infer<typeof SkillResult>;

/** `GET /api/vendoring/:projectId/runs/:runId/results`: per-skill results parsed from a check or verify run's output. */
export const VendoringResultsResponse = z.object({
  results: z.array(SkillResult),
  runId: z.string(),
  status: z.enum(['cancelled', 'failed', 'running', 'succeeded']),
});
export type VendoringResultsResponse = z.infer<typeof VendoringResultsResponse>;
