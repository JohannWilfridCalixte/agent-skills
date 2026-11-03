import type { ConfigLocation, ConfigStore } from '@agentic/domain-config';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const GLOBAL_FILE = 'config.json';
const PROJECT_FILE = '.agentic.json';

/** The only two file paths config may touch (D31): `<homeDir>/config.json` and `<project>/.agentic.json`. */
export const configPath = (homeDir: string, location: ConfigLocation) =>
  location.kind === 'global' ? join(homeDir, GLOBAL_FILE) : join(location.projectPath, PROJECT_FILE);

const isMissing = (cause: unknown) => cause instanceof Error && 'code' in cause && (cause.code === 'ENOENT' || cause.code === 'ENOTDIR');

/** Filesystem `ConfigStore`; `homeDir` is `AGENTIC_HOME` or `~/.agentic`. */
export function createFsConfigStore(homeDir: string): ConfigStore {
  return {
    read: async (location) => {
      try {
        return { exists: true, text: await readFile(configPath(homeDir, location), 'utf8') };
      } catch (cause) {
        if (isMissing(cause)) return { exists: false };
        throw cause;
      }
    },
  };
}
