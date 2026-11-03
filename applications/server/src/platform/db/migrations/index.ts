import type { Migration } from 'kysely';

import * as initial from './0001-initial.js';
import * as historyKinds from './0002-history-kinds.js';

/** Static list, in order: no filesystem scan, so it works the same from source or a bundle. */
export const MIGRATIONS: Readonly<Record<string, Migration>> = {
  '0001-initial': initial,
  '0002-history-kinds': historyKinds,
};
