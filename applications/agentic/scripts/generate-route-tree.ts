/**
 * Generates `src/routeTree.gen.ts` without starting a server: the TanStack router plugin writes the tree when
 * Vite resolves its config. `typecheck` and `lint` need it before `tsc`/ESLint see the typed routes.
 */
import { join } from 'node:path';

import { resolveConfig } from 'vite';

await resolveConfig({ configFile: join(import.meta.dirname, '..', 'vite.config.ts'), logLevel: 'warn' }, 'build');
