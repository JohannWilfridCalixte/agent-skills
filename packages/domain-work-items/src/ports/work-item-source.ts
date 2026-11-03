export interface ItemFolders {
  readonly active: readonly string[];
  readonly archived: readonly string[];
}

/** One work-item folder: `{outputDir}/{slug}` or `{outputDir}/_archive/{slug}`. `slug` is already validated. */
export interface ItemLocation {
  readonly archived: boolean;
  readonly outputDir: string;
  readonly slug: string;
}

/** Part of a text file: the first or last `maxBytes`, `truncated` when the file was longer. */
export interface TextRead {
  readonly text: string;
  readonly truncated: boolean;
}

/**
 * Read-only access to work-item folders (D39). Files are named by the domain from a closed set
 * (`state.json`, `events.jsonl`, `<doc>.md`, `reviews/<file>.md`), never by a client path (D31).
 * Implementations stay inside `outputDir` (symlinks included) and never throw on missing or partial files.
 */
export interface WorkItemSource {
  /** Relative paths of the files present in the item, reviews as `reviews/<file>`. */
  listFiles(item: ItemLocation): Promise<readonly string[]>;
  /** Folder names directly under `outputDir` and under `outputDir/_archive`; empty when the folder is missing. */
  listFolders(outputDir: string): Promise<ItemFolders>;
  /** First `maxBytes`; `undefined` when missing or outside the output folder. */
  readHead(item: ItemLocation, file: string, maxBytes: number): Promise<TextRead | undefined>;
  /** Last `maxBytes`; `undefined` when missing or outside the output folder. */
  readTail(item: ItemLocation, file: string, maxBytes: number): Promise<TextRead | undefined>;
}
