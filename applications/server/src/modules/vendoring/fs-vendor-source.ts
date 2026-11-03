import type { VendorSource } from '@agentic/domain-vendoring';

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** vendor files are small JSON; anything larger is treated as malformed by the parser rather than read whole. */
const MAX_BYTES = 1024 * 1024;

/** Reads `vendor.json` / `vendor.lock.json` at a known project root; missing, unreadable or oversized is `undefined`. */
export const fsVendorSource = {
  read: async (projectPath, file) => {
    const path = join(projectPath, file);
    try {
      const info = await stat(path);
      if (!info.isFile() || info.size > MAX_BYTES) return undefined;
      return await readFile(path, 'utf8');
    } catch {
      return undefined;
    }
  },
} satisfies VendorSource;
