import type { ConfigIssue, ConfigValues } from '../model/config-file.js';
import type { Harness } from '../model/defaults.js';
import type { ModelCatalog } from '../ports/model-catalog.js';

/**
 * Unknown model ids, checked against the catalog of the harness that runs the step (its `harness`
 * leaf, else the harness it is listed under). An unavailable catalog, or none at all, warns nothing.
 */
export async function modelWarnings(values: ConfigValues, catalog: ModelCatalog | undefined): Promise<readonly ConfigIssue[]> {
  if (catalog === undefined) return [];
  const lists = new Map<Harness, Awaited<ReturnType<ModelCatalog['models']>>>();
  const listOf = async (harness: Harness) => {
    const cached = lists.get(harness);
    if (cached !== undefined) return cached;
    const list = await catalog.models(harness);
    lists.set(harness, list);
    return list;
  };

  const warnings: ConfigIssue[] = [];
  for (const [listed, entries] of Object.entries(values.steps ?? {}) as [Harness, Readonly<Record<string, { harness?: Harness; model?: string }>>][]) {
    for (const [key, entry] of Object.entries(entries)) {
      if (entry.model === undefined) continue;
      const runner = entry.harness ?? listed;
      const list = await listOf(runner);
      if (list.available && !list.ids.includes(entry.model)) {
        warnings.push({ message: `Unknown ${runner} model "${entry.model}"; it will be used as typed`, path: `steps.${listed}.${key}.model` });
      }
    }
  }
  return warnings;
}
