import { z } from 'zod';

import { RunSummary } from '../runs/index.js';

export const InstallHarness = z.enum(['cursor', 'claude', 'codex']);
export type InstallHarness = z.infer<typeof InstallHarness>;

export const HarnessPresence = z.object({
  cli: z.discriminatedUnion('found', [z.object({ found: z.literal(false) }), z.object({ found: z.literal(true), version: z.string() })]),
  /** `~/.cursor`, `~/.claude` or `~/.codex` exists. */
  configFolder: z.boolean(),
  harness: InstallHarness,
  present: z.boolean(),
  reason: z.string(),
});
export type HarnessPresence = z.infer<typeof HarnessPresence>;

/** `GET /api/install/harnesses`. */
export const HarnessesResponse = z.object({ harnesses: z.array(HarnessPresence) });
export type HarnessesResponse = z.infer<typeof HarnessesResponse>;

/** `GET /api/models?harness=` query. */
export const ModelsQuery = z.object({ harness: InstallHarness });
export type ModelsQuery = z.infer<typeof ModelsQuery>;

/** `GET /api/models?harness=`: the CLI's ids, or `available: false` with why, so the picker falls back to free text (D14). */
export const ModelsResponse = z.discriminatedUnion('available', [
  z.object({ available: z.literal(true), harness: InstallHarness, ids: z.array(z.string()) }),
  z.object({ available: z.literal(false), harness: InstallHarness, reason: z.string() }),
]);
export type ModelsResponse = z.infer<typeof ModelsResponse>;

export const InstallMethod = z.enum(['plugin', 'clone', 'skills']);
export type InstallMethod = z.infer<typeof InstallMethod>;

export const InstallAction = z.enum(['marketplace-add', 'install', 'update']);
export type InstallAction = z.infer<typeof InstallAction>;

export const InstallScope = z.enum(['global', 'project']);
export type InstallScope = z.infer<typeof InstallScope>;

/**
 * `POST /api/install/preview` body: enums and a known project id only. Strict, so a command string, path or any
 * other field is rejected (AC26). `harness` is required for `plugin` (claude, codex) and `clone` (cursor).
 */
export const InstallRequest = z.strictObject({
  action: InstallAction,
  harness: InstallHarness.optional(),
  method: InstallMethod,
  projectId: z.string().min(1).optional(),
  scope: InstallScope.default('global'),
});
export type InstallRequest = z.infer<typeof InstallRequest>;

/** `POST /api/install/runs` body: the same request, explicitly confirmed (AC13). */
export const InstallRunRequest = InstallRequest.extend({ confirm: z.literal(true) });
export type InstallRunRequest = z.infer<typeof InstallRunRequest>;

export const InstallCommand = z.object({
  args: z.array(z.string()),
  cli: z.string(),
  cwd: z.string().optional(),
  /** Exact command text, as the user would type it. */
  display: z.string(),
});
export type InstallCommand = z.infer<typeof InstallCommand>;

/** `POST /api/install/preview`: the ordered commands a run would execute; nothing runs. */
export const InstallPreviewResponse = z.object({ commands: z.array(InstallCommand), steps: z.int().positive() });
export type InstallPreviewResponse = z.infer<typeof InstallPreviewResponse>;

/** `GET /api/install/status` query; every request computes status anew (no cache, no polling: AC11). */
export const InstallStatusQuery = z.object({
  projectId: z.string().min(1).optional(),
  /** Accepted for the Refresh button; status is always computed for the request. */
  refresh: z.enum(['0', '1', 'false', 'true']).optional(),
  scope: InstallScope.default('global'),
});
export type InstallStatusQuery = z.infer<typeof InstallStatusQuery>;

export const InstallStatusEntry = z.object({
  /** False when the method is not offered on this machine (cursor clone without `~/.cursor`). */
  available: z.boolean(),
  harness: InstallHarness.optional(),
  method: InstallMethod,
  reason: z.string().optional(),
  scope: InstallScope.optional(),
  state: z.enum(['installed', 'not_installed', 'unknown']),
  /** Present only when the tool itself reports it (AC12). */
  updateAvailable: z.boolean().optional(),
  version: z.string().optional(),
});
export type InstallStatusEntry = z.infer<typeof InstallStatusEntry>;

export const InstallStatusResponse = z.object({ statuses: z.array(InstallStatusEntry) });
export type InstallStatusResponse = z.infer<typeof InstallStatusResponse>;

/** `POST /api/install/runs` 201: the started run; follow it at `/api/runs/:id` and `/api/runs/:id/events`. */
export const InstallRunResponse = RunSummary;
export type InstallRunResponse = z.infer<typeof InstallRunResponse>;
