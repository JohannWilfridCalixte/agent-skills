import type { ItemLocation, WorkItemSource } from './ports/work-item-source.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const folderKey = (outputDir: string, archived: boolean) => `${outputDir}${archived ? '/_archive' : ''}`;

/** Work items held in memory: `outputDir -> { active|archived -> slug -> file -> text }`. */
export class InMemoryWorkItemSource implements WorkItemSource {
  private readonly folders = new Map<string, Map<string, Map<string, string>>>();

  /** Adds (or replaces files of) one item; returns `this` for chaining. */
  add(outputDir: string, slug: string, files: Readonly<Record<string, string>>, { archived = false } = {}) {
    const key = folderKey(outputDir, archived);
    const items = this.folders.get(key) ?? new Map<string, Map<string, string>>();
    const item = items.get(slug) ?? new Map<string, string>();
    for (const [name, text] of Object.entries(files)) item.set(name, text);
    items.set(slug, item);
    this.folders.set(key, items);
    return this;
  }

  listFiles(item: ItemLocation) {
    return Promise.resolve([...(this.find(item)?.keys() ?? [])]);
  }

  listFolders(outputDir: string) {
    const names = (archived: boolean) => [...(this.folders.get(folderKey(outputDir, archived))?.keys() ?? [])];
    return Promise.resolve({ active: names(false), archived: names(true) });
  }

  readHead(item: ItemLocation, file: string, maxBytes: number) {
    const bytes = this.bytes(item, file);
    if (bytes === undefined) return Promise.resolve(undefined);
    return Promise.resolve({ text: decoder.decode(bytes.subarray(0, maxBytes)), truncated: bytes.length > maxBytes });
  }

  readTail(item: ItemLocation, file: string, maxBytes: number) {
    const bytes = this.bytes(item, file);
    if (bytes === undefined) return Promise.resolve(undefined);
    return Promise.resolve({ text: decoder.decode(bytes.subarray(Math.max(0, bytes.length - maxBytes))), truncated: bytes.length > maxBytes });
  }

  private bytes(item: ItemLocation, file: string) {
    const text = this.find(item)?.get(file);
    return text === undefined ? undefined : encoder.encode(text);
  }

  private find({ archived, outputDir, slug }: ItemLocation) {
    return this.folders.get(folderKey(outputDir, archived))?.get(slug);
  }
}
