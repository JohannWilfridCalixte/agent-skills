import { restrictedImportPaths as w5sRestrictedImportPaths } from '@w5s/eslint-config';

const BUN_TEST = {
  message: 'Packages test on Vitest: import helpers from "vitest", not "bun:test" (only applications/server runs on bun test).',
  name: 'bun:test',
};

const BUN = {
  message: 'Kernel, domain and contract packages are runtime-agnostic: Bun APIs belong in applications/server and adapter-* packages.',
  name: 'bun',
};

/**
 * Default paths for runtime-agnostic packages (kernel, domain, contract, web).
 * Flat config replaces (not merges) rule options, so every `no-restricted-imports` block re-declares these paths.
 */
export const restrictedImportPaths = [...w5sRestrictedImportPaths, BUN_TEST, BUN];

/** `adapter-*`: Bun runtime APIs allowed, tests still on Vitest. */
export const adapterRestrictedImportPaths = [...w5sRestrictedImportPaths, BUN_TEST];

/** `applications/server`: Bun runtime (`bun`, `bun:sqlite`) and `bun:test`, since bun:sqlite only loads under Bun. */
export const serverRestrictedImportPaths = [...w5sRestrictedImportPaths];
