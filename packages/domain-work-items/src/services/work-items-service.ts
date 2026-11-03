import type { ProjectOutputResolver } from '@agentic/domain-shared';

import type { WorkItemsProjectNotFound } from '../model/errors.js';
import type { WorkItemState } from '../model/state.js';
import type { ItemLocation, WorkItemSource } from '../ports/work-item-source.js';

import { err, ok } from '@agentic/kernel-result';

import { docNameOfFile, isValidSlug, parseDocName } from '../model/names.js';
import { parseState, recencyKey } from '../model/state.js';
import { DOC_LIMIT_BYTES, EMPTY_TIMELINE, EVENTS_LIMIT_BYTES, parseTimeline } from '../model/timeline.js';

export type WorkItemsService = ReturnType<typeof createWorkItemsService>;

export interface WorkItemsServiceDependencies {
  readonly outputs: ProjectOutputResolver;
  readonly source: WorkItemSource;
}

export interface WorkItemSummary {
  readonly archived: boolean;
  readonly slug: string;
  readonly state: WorkItemState;
}

/** Read-only browse (D16): nothing here writes, resumes or cleans up. */
export function createWorkItemsService({ outputs, source }: WorkItemsServiceDependencies) {
  const outputDirOf = async (projectId: string) => {
    const outputDir = await outputs.outputDir(projectId);
    if (outputDir === undefined) return err({ projectId, type: 'project_not_found' } satisfies WorkItemsProjectNotFound);
    return ok(outputDir);
  };

  const readState = async (item: ItemLocation) => parseState((await source.readHead(item, 'state.json', DOC_LIMIT_BYTES))?.text);

  /** Active wins over archived when both hold the same slug. */
  const locate = async (projectId: string, slug: string) => {
    if (!isValidSlug(slug)) return err({ slug, type: 'invalid_slug' } as const);
    const outputDir = await outputDirOf(projectId);
    if (!outputDir.ok) return outputDir;
    const folders = await source.listFolders(outputDir.value);
    if (folders.active.includes(slug)) return ok({ archived: false, outputDir: outputDir.value, slug } satisfies ItemLocation);
    if (folders.archived.includes(slug)) return ok({ archived: true, outputDir: outputDir.value, slug } satisfies ItemLocation);
    return err({ slug, type: 'work_item_not_found' } as const);
  };

  const list = async (projectId: string) => {
    const outputDir = await outputDirOf(projectId);
    if (!outputDir.ok) return outputDir;
    const folders = await source.listFolders(outputDir.value);
    const locations = [
      ...folders.active.map((slug) => ({ archived: false, outputDir: outputDir.value, slug })),
      ...folders.archived.map((slug) => ({ archived: true, outputDir: outputDir.value, slug })),
    ].filter((item) => isValidSlug(item.slug));
    const items = await Promise.all(
      locations.map(async (item) => ({ archived: item.archived, slug: item.slug, state: await readState(item) }) satisfies WorkItemSummary),
    );
    return ok(items.sort((a, b) => recencyKey(b.slug, b.state).localeCompare(recencyKey(a.slug, a.state)) || b.slug.localeCompare(a.slug)));
  };

  const detail = async (projectId: string, slug: string) => {
    const item = await locate(projectId, slug);
    if (!item.ok) return item;
    const [state, events, files] = await Promise.all([
      readState(item.value),
      source.readTail(item.value, 'events.jsonl', EVENTS_LIMIT_BYTES),
      source.listFiles(item.value),
    ]);
    const docs = files.flatMap((file) => docNameOfFile(file) ?? []).sort();
    const timeline = events === undefined ? EMPTY_TIMELINE : parseTimeline(events.text, events.truncated);
    return ok({ archived: item.value.archived, docs, slug, state, timeline });
  };

  const doc = async (projectId: string, slug: string, name: string) => {
    const ref = parseDocName(name);
    const item = await locate(projectId, slug);
    if (!item.ok) return item;
    if (ref === undefined) return err({ name, type: 'invalid_doc_name' } as const);
    const read = await source.readHead(item.value, ref.file, DOC_LIMIT_BYTES);
    if (read === undefined) return err({ name, type: 'doc_not_found' } as const);
    return ok({ name, text: read.text, truncated: read.truncated });
  };

  return { detail, doc, list };
}
