import type { Result } from '@agentic/kernel-result';

import type { InvalidScope } from './errors.js';

import { err, ok } from '@agentic/kernel-result';

/** Which config file: the user's global file or a known project's file. */
export type ConfigScope = { readonly kind: 'global' } | { readonly kind: 'project'; readonly projectId: string };

const PROJECT_PREFIX = 'project:';

/** Parses `global` or `project:<id>` (the history scope format). */
export function parseScope(text: string): Result<ConfigScope, InvalidScope> {
  if (text === 'global') return ok({ kind: 'global' });
  const projectId = text.startsWith(PROJECT_PREFIX) ? text.slice(PROJECT_PREFIX.length) : '';
  if (projectId.length > 0) return ok({ kind: 'project', projectId });
  return err({ scope: text, type: 'invalid_scope' });
}

export const formatScope = (scope: ConfigScope) => (scope.kind === 'global' ? 'global' : `${PROJECT_PREFIX}${scope.projectId}`);
