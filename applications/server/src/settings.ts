import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { z } from 'zod';

export interface Settings {
  /** sqlite file, or `:memory:` (D38). */
  readonly dbPath: string;
  /** Log `environment`: `AGENTIC_ENV`, else `NODE_ENV`, else `local`. */
  readonly environment: string;
  /** `~/.agentic`, or `AGENTIC_HOME`; holds `serve.json` and the default database. */
  readonly homeDir: string;
  readonly port: number;
  /** Log `service_revision`: `GIT_SHA`, else the server package version, else `unknown`. */
  readonly serviceRevision: string;
}

const Env = z.object({
  AGENTIC_DB_PATH: z.string().min(1).optional(),
  AGENTIC_ENV: z.string().min(1).optional(),
  AGENTIC_HOME: z.string().min(1).optional(),
  AGENTIC_PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  GIT_SHA: z.string().min(1).optional(),
  NODE_ENV: z.string().min(1).optional(),
});

export function loadSettings(env: Readonly<Record<string, string | undefined>>): Settings {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid settings: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
  }
  const homeDir = parsed.data.AGENTIC_HOME ?? join(homedir(), '.agentic');
  return {
    dbPath: parsed.data.AGENTIC_DB_PATH ?? join(homeDir, 'agentic.db'),
    environment: parsed.data.AGENTIC_ENV ?? parsed.data.NODE_ENV ?? 'local',
    homeDir,
    port: parsed.data.AGENTIC_PORT,
    serviceRevision: parsed.data.GIT_SHA ?? packageVersion(),
  };
}

/** The server package version (same relative path from `src/` and `dist/`), or `unknown`. */
function packageVersion() {
  try {
    const manifest: unknown = createRequire(import.meta.url)('../package.json');
    const version = typeof manifest === 'object' && manifest !== null && 'version' in manifest ? manifest.version : undefined;
    return typeof version === 'string' && version !== '' ? version : 'unknown';
  } catch {
    return 'unknown';
  }
}
