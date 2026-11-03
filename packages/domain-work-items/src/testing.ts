import type { ItemLocation, WorkItemSource } from './ports/work-item-source.js';

/** UTF-8 encode in pure ES (the build has no platform encoders); a lone surrogate becomes U+FFFD, like `TextEncoder`. */
function encodeUtf8(text: string) {
  const bytes: number[] = [];
  for (const character of text) {
    let codePoint = character.codePointAt(0) ?? 0;
    if (codePoint >= 0xd8_00 && codePoint <= 0xdf_ff) codePoint = 0xff_fd;
    if (codePoint < 0x80) bytes.push(codePoint);
    else if (codePoint < 0x8_00) bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    else if (codePoint < 0x1_00_00) bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    else bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
  }
  return Uint8Array.from(bytes);
}

const sequenceLength = (lead: number) => {
  if (lead < 0x80) return 1;
  if (lead >= 0xc2 && lead <= 0xdf) return 2;
  if (lead >= 0xe0 && lead <= 0xef) return 3;
  if (lead >= 0xf0 && lead <= 0xf4) return 4;
  return 0;
};

/** UTF-8 decode in pure ES; each invalid or cut sequence becomes one U+FFFD (enough for this fake's head/tail cuts). */
function decodeUtf8(bytes: Uint8Array) {
  let text = '';
  let index = 0;
  while (index < bytes.length) {
    const lead = bytes[index] ?? 0;
    const length = sequenceLength(lead);
    const continuation = bytes.subarray(index + 1, index + length);
    if (length === 0 || continuation.length < length - 1 || continuation.some((byte) => (byte & 0xc0) !== 0x80)) {
      text += '\uFFFD';
      index += 1;
      continue;
    }
    const initial = length === 1 ? lead : lead & (0xff >> (length + 1));
    text += String.fromCodePoint(continuation.reduce((codePoint, byte) => (codePoint << 6) | (byte & 0x3f), initial));
    index += length;
  }
  return text;
}

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
    return Promise.resolve({ text: decodeUtf8(bytes.subarray(0, maxBytes)), truncated: bytes.length > maxBytes });
  }

  readTail(item: ItemLocation, file: string, maxBytes: number) {
    const bytes = this.bytes(item, file);
    if (bytes === undefined) return Promise.resolve(undefined);
    return Promise.resolve({ text: decodeUtf8(bytes.subarray(Math.max(0, bytes.length - maxBytes))), truncated: bytes.length > maxBytes });
  }

  private bytes(item: ItemLocation, file: string) {
    const text = this.find(item)?.get(file);
    return text === undefined ? undefined : encodeUtf8(text);
  }

  private find({ archived, outputDir, slug }: ItemLocation) {
    return this.folders.get(folderKey(outputDir, archived))?.get(slug);
  }
}
