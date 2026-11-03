import type { DirectoryProbe } from '@agentic/domain-projects';

import { stat } from 'node:fs/promises';

/** Real filesystem probe: follows symlinks, never writes. */
export const fsDirectoryProbe = {
  kind: async (path) => {
    try {
      const stats = await stat(path);
      return stats.isDirectory() ? 'directory' : 'other';
    } catch {
      return 'missing';
    }
  },
} satisfies DirectoryProbe;
