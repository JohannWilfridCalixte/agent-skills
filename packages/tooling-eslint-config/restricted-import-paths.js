import { restrictedImportPaths as w5sRestrictedImportPaths } from '@w5s/eslint-config';

/**
 * bun is the package manager and script runner only; the runtime is Node and tests run on Vitest.
 * Flat config replaces (not merges) rule options, so every `no-restricted-imports` block re-declares these paths.
 */
export const restrictedImportPaths = [
  ...w5sRestrictedImportPaths,
  {
    message: 'Tests run on Vitest: import helpers from "vitest", not "bun:test".',
    name: 'bun:test',
  },
  {
    message: 'bun is the package manager only; use Node.js APIs at runtime.',
    name: 'bun',
  },
];
