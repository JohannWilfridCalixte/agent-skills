/** The three harnesses the app knows; mirrors `HARNESSES` of domain-config so its `ModelCatalog` is satisfied structurally. */
export type HarnessName = 'claude' | 'codex' | 'cursor';

/** Model ids of one harness, or why they are unavailable (missing or failing CLI): pickers then fall back to free text (D14). */
export type ModelListing = { readonly available: false; readonly reason: string } | { readonly available: true; readonly ids: readonly string[] };

/** Shared so config (warnings) can use the install slice's CLI-backed lists without importing it (D23). */
export interface ModelSource {
  models(harness: HarnessName): Promise<ModelListing>;
}
