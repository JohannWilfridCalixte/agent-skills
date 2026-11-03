import type { ConfigLocation, ConfigStore } from '@agentic/domain-config';

import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const GLOBAL_FILE = 'config.json';
const PROJECT_FILE = '.agentic.json';

/** The only two file paths config may touch (D31): `<homeDir>/config.json` and `<project>/.agentic.json`. */
export const configPath = (homeDir: string, location: ConfigLocation) =>
  location.kind === 'global' ? join(homeDir, GLOBAL_FILE) : join(location.projectPath, PROJECT_FILE);

const NEW_FILE_MODE = 0o644;

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

    /** Temp file in the same directory, then rename: readers never see a half-written file (D31). */
    write: async (location, text) => {
      const path = configPath(homeDir, location);
      if (location.kind === 'global') await mkdir(dirname(path), { recursive: true });
      const mode = await currentMode(path);
      const temporary = join(dirname(path), `.${randomUUID()}.agentic-tmp`);
      try {
        await writeFile(temporary, text, { flag: 'wx', mode });
        await chmod(temporary, mode);
        await rename(temporary, path);
      } catch (cause) {
        await rm(temporary, { force: true });
        throw cause;
      }
    },
  };
}

async function currentMode(path: string) {
  try {
    return (await stat(path)).mode & 0o7777;
  } catch (cause) {
    if (isMissing(cause)) return NEW_FILE_MODE;
    throw cause;
  }
}
