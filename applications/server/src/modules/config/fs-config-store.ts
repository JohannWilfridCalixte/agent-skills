import type { ConfigLocation, ConfigStore, ConfigStoreError } from '@agentic/domain-config';

import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { err, ok } from '@agentic/kernel-result';

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
        return ok({ exists: true, text: await readFile(configPath(homeDir, location), 'utf8') } as const);
      } catch (cause) {
        if (isMissing(cause)) return ok({ exists: false } as const);
        return err(ioFailed(cause));
      }
    },

    /** Temp file in the same directory, then rename: readers never see a half-written file (D31). */
    write: async (location, text) => {
      const path = configPath(homeDir, location);
      const temporary = join(dirname(path), `.${randomUUID()}.agentic-tmp`);
      try {
        if (location.kind === 'global') await mkdir(dirname(path), { recursive: true });
        const mode = await currentMode(path);
        await writeFile(temporary, text, { flag: 'wx', mode });
        await chmod(temporary, mode);
        await rename(temporary, path);
        return ok(undefined);
      } catch (cause) {
        await rm(temporary, { force: true });
        return err(isMissing(cause) ? ({ type: 'location_missing' } as const) : ioFailed(cause));
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

function ioFailed(cause: unknown): ConfigStoreError {
  return { detail: cause instanceof Error ? cause.message : String(cause), type: 'io_failed' };
}
