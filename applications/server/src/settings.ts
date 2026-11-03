import { homedir } from 'node:os';
import { join } from 'node:path';

import { z } from 'zod';

export interface Settings {
  /** sqlite file, or `:memory:` (D38). */
  readonly dbPath: string;
  readonly port: number;
}

const Env = z.object({
  AGENTIC_DB_PATH: z.string().min(1).optional(),
  AGENTIC_PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
});

export function loadSettings(env: Readonly<Record<string, string | undefined>>): Settings {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid settings: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
  }
  return {
    dbPath: parsed.data.AGENTIC_DB_PATH ?? join(homedir(), '.agentic', 'agentic.db'),
    port: parsed.data.AGENTIC_PORT,
  };
}
