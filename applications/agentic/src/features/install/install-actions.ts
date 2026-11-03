import type { ApiError } from '@/lib/api-error';
import type { InstallAction, InstallRequest, InstallStatusEntry } from '@agentic/contract-http/install';

import { describeApiError } from '@/lib/api-error';

export interface PlannedAction {
  readonly label: string;
  readonly request: InstallRequest;
  /** The button text; `label` names the action and its target for assistive tech. */
  readonly short: string;
}

/** What the skills CLI rows target: the user's global install, or one known project. */
export type SkillsScope = { readonly kind: 'global' } | { readonly kind: 'project'; readonly path: string; readonly projectId: string };

const ACTION_LABELS = { 'install': 'Install', 'marketplace-add': 'Add marketplace', 'update': 'Update' } as const satisfies Record<InstallAction, string>;

export function actionsFor(entry: InstallStatusEntry, scope: SkillsScope) {
  const target = methodLabel(entry, scope);
  return catalogueActions(entry).map((action) => ({ label: `${ACTION_LABELS[action]} ${target}`, request: requestFor(entry, action, scope), short: ACTION_LABELS[action] }) satisfies PlannedAction);
}

/** The API error plus an install-specific next step (409 unavailable, 422 refused, 404 unknown project). */
export function describeInstallError(error: ApiError) {
  const described = describeApiError(error);
  if (error.type !== 'problem') return described;
  switch (error.status) {
    case 404:
      return { ...described, nextStep: 'The project is no longer known: pick another scope, then retry.' };
    case 409:
      return { ...described, nextStep: 'Install the harness CLI, then refresh the status.' };
    case 422:
      return { ...described, nextStep: 'This action is not offered for this method; pick another one.' };
    default:
      return described;
  }
}

export function methodLabel(entry: InstallStatusEntry, scope: SkillsScope) {
  switch (entry.method) {
    case 'clone':
      return `${harnessName(entry)} clone`;
    case 'plugin':
      return `${harnessName(entry)} plugin`;
    case 'skills':
      return entry.scope === 'project' && scope.kind === 'project' ? `Skills CLI (${scope.path})` : 'Skills CLI (global)';
    default:
      return entry.method satisfies never;
  }
}

/** The actions the closed catalogue (D34) offers per method; the server still decides. */
function catalogueActions(entry: InstallStatusEntry) {
  switch (entry.method) {
    case 'clone':
      return ['install', 'update'] as const;
    case 'plugin':
      return ['marketplace-add', 'install', 'update'] as const;
    case 'skills':
      return ['install', 'update'] as const;
    default:
      return entry.method satisfies never;
  }
}

function harnessName(entry: InstallStatusEntry) {
  const harness = entry.harness ?? 'unknown';
  return `${harness.charAt(0).toUpperCase()}${harness.slice(1)}`;
}

function requestFor(entry: InstallStatusEntry, action: InstallAction, scope: SkillsScope) {
  if (entry.method !== 'skills') return { action, method: entry.method, scope: 'global', ...(entry.harness === undefined ? {} : { harness: entry.harness }) } satisfies InstallRequest;
  if (entry.scope === 'project' && scope.kind === 'project') return { action, method: 'skills', projectId: scope.projectId, scope: 'project' } satisfies InstallRequest;
  return { action, method: 'skills', scope: 'global' } satisfies InstallRequest;
}
