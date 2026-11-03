import { z } from 'zod';

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
