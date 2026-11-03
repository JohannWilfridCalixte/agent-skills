import type { ItemLocation, WorkItemSource } from '@agentic/domain-work-items';

import { Buffer } from 'node:buffer';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';

const ARCHIVE = '_archive';
const REVIEWS = 'reviews';

const isInside = (root: string, path: string) => path === root || path.startsWith(`${root}${sep}`);

/** Real path of `path` when it exists and resolves inside `root` (so a symlink cannot escape), else `undefined`. */
async function confined(root: string, path: string) {
  try {
    const real = await realpath(path);
    return isInside(root, real) ? real : undefined;
  } catch {
    return undefined;
  }
}

/** Names of the entries of `directory` that resolve inside `root` to the wanted kind. */
async function entries(root: string, directory: string, kind: 'directory' | 'file') {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return [];
  }
  const kept = await Promise.all(
    names.map(async (name) => {
      const real = await confined(root, join(directory, name));
      return real !== undefined && (await kindOf(real)) === kind ? name : undefined;
    }),
  );
  return kept.filter((name) => name !== undefined).sort();
}

async function kindOf(path: string) {
  try {
    const stats = await stat(path);
    if (stats.isDirectory()) return 'directory';
    return stats.isFile() ? 'file' : 'other';
  } catch {
    return 'missing';
  }
}

async function readRange(path: string, maxBytes: number, from: 'end' | 'start') {
  try {
    const handle = await open(path, 'r');
    try {
      const { size } = await handle.stat();
      const length = Math.min(size, maxBytes);
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, from === 'end' ? size - length : 0);
      return { text: buffer.subarray(0, bytesRead).toString('utf8'), truncated: size > maxBytes };
    } finally {
      await handle.close();
    }
  } catch {
    return undefined;
  }
}

/**
 * Reads work items on disk, only under the real `outputDir` (D31): every folder and file is resolved with
 * `realpath` and dropped when it lands outside. Missing or unreadable paths read as absent, never as errors.
 */
export const fsWorkItemSource: WorkItemSource = {
  listFiles: async (item) => {
    const located = await locate(item);
    if (located === undefined) return [];
    const [top, reviews] = await Promise.all([
      entries(located.root, located.directory, 'file'),
      entries(located.root, join(located.directory, REVIEWS), 'file'),
    ]);
    return [...top, ...reviews.map((name) => `${REVIEWS}/${name}`)];
  },

  listFolders: async (outputDir) => {
    const root = await rootOf(outputDir);
    if (root === undefined) return { active: [], archived: [] };
    const [active, archived] = await Promise.all([entries(root, root, 'directory'), entries(root, join(root, ARCHIVE), 'directory')]);
    return { active: active.filter((name) => name !== ARCHIVE), archived };
  },

  readHead: async (item, file, maxBytes) => readFile(item, file, maxBytes, 'start'),

  readTail: async (item, file, maxBytes) => readFile(item, file, maxBytes, 'end'),
};

async function locate({ archived, outputDir, slug }: ItemLocation) {
  const root = await rootOf(outputDir);
  if (root === undefined) return undefined;
  const directory = await confined(root, archived ? join(root, ARCHIVE, slug) : join(root, slug));
  return directory === undefined ? undefined : { directory, root };
}

async function readFile(item: ItemLocation, file: string, maxBytes: number, from: 'end' | 'start') {
  const located = await locate(item);
  if (located === undefined) return undefined;
  const real = await confined(located.root, join(located.directory, file));
  if (real === undefined || (await kindOf(real)) !== 'file') return undefined;
  return readRange(real, maxBytes, from);
}

async function rootOf(outputDir: string) {
  try {
    return await realpath(outputDir);
  } catch {
    return undefined;
  }
}
