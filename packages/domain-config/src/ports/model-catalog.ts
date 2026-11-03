import type { Harness } from '../model/defaults.js';

/** Model ids per harness, used only to warn on unknown ids, never to block a save. T9 supplies the CLI-backed one. */
export interface ModelCatalog {
  models(harness: Harness): Promise<ModelList>;
}

/** Known model ids of one harness, or `unavailable` when its CLI is missing or failing (D14). */
export type ModelList = { readonly available: false } | { readonly available: true; readonly ids: readonly string[] };
