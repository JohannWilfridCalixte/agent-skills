import type { HarnessName } from '@agentic/domain-shared';

export const HARNESSES = ['cursor', 'claude', 'codex'] as const satisfies readonly HarnessName[];
export type Harness = (typeof HARNESSES)[number];

export const isHarness = (value: string): value is Harness => (HARNESSES as readonly string[]).includes(value);

/** Executable each harness ships (Cursor's CLI is `agent`). */
export const HARNESS_CLI = { claude: 'claude', codex: 'codex', cursor: 'agent' } as const satisfies Record<Harness, string>;

/** Config folder under the user's home that marks an installed harness. */
export const HARNESS_FOLDER = { claude: '.claude', codex: '.codex', cursor: '.cursor' } as const satisfies Record<Harness, string>;

export interface HarnessPresence {
  readonly cli: { readonly found: false } | { readonly found: true; readonly version: string };
  readonly configFolder: boolean;
  readonly harness: Harness;
  readonly present: boolean;
  readonly reason: string;
}

/** Present when the CLI answers or the config folder exists; the reason says which. */
export function presence(harness: Harness, version: string | undefined, configFolder: boolean) {
  const cliName = HARNESS_CLI[harness];
  const folder = `~/${HARNESS_FOLDER[harness]}`;
  const cli = version === undefined ? ({ found: false } as const) : ({ found: true, version } as const);
  const reason =
    version !== undefined ? `${cliName} CLI found (${version})` : configFolder ? `${folder} exists; ${cliName} CLI not found` : `${cliName} CLI not found and ${folder} missing`;
  return { cli, configFolder, harness, present: version !== undefined || configFolder, reason } satisfies HarnessPresence;
}
