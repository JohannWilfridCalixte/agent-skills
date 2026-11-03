import type { Command } from '@agentic/domain-shared';

import type { Harness } from './harness.js';

import { err, ok } from '@agentic/kernel-result';

export const INSTALL_METHODS = ['plugin', 'clone', 'skills'] as const;
export type InstallMethod = (typeof INSTALL_METHODS)[number];

export const INSTALL_ACTIONS = ['marketplace-add', 'install', 'update'] as const;
export type InstallAction = (typeof INSTALL_ACTIONS)[number];

export const INSTALL_SCOPES = ['global', 'project'] as const;
export type InstallScope = (typeof INSTALL_SCOPES)[number];

/** Where the agentic plugin and skills come from (D34, ADR 0013). */
export const AGENTIC_SOURCE = 'JohannWilfridCalixte/agent-skills';
export const AGENTIC_REPOSITORY_URL = `https://github.com/${AGENTIC_SOURCE}`;
export const AGENTIC_PLUGIN = 'agentic@agentic';
export const AGENTIC_MARKETPLACE = 'agentic';
/** The Cursor local plugin clone, relative to the user's home. */
export const CURSOR_CLONE_FOLDER = '.cursor/plugins/local/agentic';

/** Server-known locations: the user's home, and the selected known project's folder for project scope. */
export interface CatalogueContext {
  readonly projectPath?: string;
  readonly userHome: string;
}

export interface CatalogueRejection {
  readonly reason: string;
  readonly type: 'unsupported';
}

/** A validated request: enums only, never a command string, path or free text (AC26). */
export interface CatalogueRequest {
  readonly action: InstallAction;
  /** Required for `plugin` and `clone`; the skills CLI is harness-agnostic. */
  readonly harness?: Harness;
  readonly method: InstallMethod;
  readonly scope: InstallScope;
}

export const cursorCloneDirectory = (userHome: string) => `${userHome.replace(/\/+$/, '')}/${CURSOR_CLONE_FOLDER}`;

const unsupported = (reason: string) => err({ reason, type: 'unsupported' } satisfies CatalogueRejection);
/** Install and update runs (plugin installs, git clone, `npx skills add` on a cold cache) can take minutes. */
export const INSTALL_RUN_TIMEOUT_MS = 10 * 60 * 1000;
const commands = (...list: readonly Command[]) => ok(list.map((command): Command => ({ ...command, timeoutMs: INSTALL_RUN_TIMEOUT_MS })));

/** The closed catalogue (D34): the ordered commands for one action, or why the combination is not offered. */
export function catalogueCommands(request: CatalogueRequest, context: CatalogueContext) {
  const { action, harness, method, scope } = request;
  if (method !== 'skills' && scope === 'project') return unsupported(`${method} installs are global only`);
  switch (method) {
    case 'clone':
      return harness === 'cursor' ? cursorClone(action, context.userHome) : unsupported(`clone is offered for cursor only`);
    case 'plugin':
      if (harness === 'claude') return claudePlugin(action);
      if (harness === 'codex') return codexPlugin(action);
      return unsupported('plugin is offered for claude and codex only');
    case 'skills':
      return skillsCli(action, scope, context.projectPath);
    default:
      return method satisfies never;
  }
}

function claudePlugin(action: InstallAction) {
  switch (action) {
    case 'install':
      return commands({ args: ['plugin', 'install', AGENTIC_PLUGIN], cli: 'claude' });
    case 'marketplace-add':
      return commands({ args: ['plugin', 'marketplace', 'add', AGENTIC_SOURCE], cli: 'claude' });
    case 'update':
      return commands({ args: ['plugin', 'marketplace', 'update', AGENTIC_MARKETPLACE], cli: 'claude' }, { args: ['plugin', 'update', AGENTIC_PLUGIN], cli: 'claude' });
    default:
      return action satisfies never;
  }
}

function codexPlugin(action: InstallAction) {
  switch (action) {
    case 'install':
      return commands({ args: ['plugin', 'add', AGENTIC_PLUGIN], cli: 'codex' });
    case 'marketplace-add':
      return commands({ args: ['plugin', 'marketplace', 'add', AGENTIC_SOURCE], cli: 'codex' });
    case 'update':
      return commands({ args: ['plugin', 'marketplace', 'upgrade'], cli: 'codex' });
    default:
      return action satisfies never;
  }
}

function cursorClone(action: InstallAction, userHome: string) {
  const directory = cursorCloneDirectory(userHome);
  switch (action) {
    case 'install':
      return commands({ args: ['clone', AGENTIC_REPOSITORY_URL, directory], cli: 'git' });
    case 'marketplace-add':
      return unsupported('cursor clone has no marketplace');
    case 'update':
      return commands({ args: ['-C', directory, 'pull'], cli: 'git' });
    default:
      return action satisfies never;
  }
}

function skillsCli(action: InstallAction, scope: InstallScope, projectPath: string | undefined) {
  if (scope === 'project' && projectPath === undefined) return unsupported('project scope needs a known project');
  const where = scope === 'project' && projectPath !== undefined ? { cwd: projectPath } : {};
  switch (action) {
    case 'install':
      return commands({ args: ['skills', 'add', AGENTIC_SOURCE, ...(scope === 'global' ? ['-g'] : []), '-y'], cli: 'npx', ...where });
    case 'marketplace-add':
      return unsupported('the skills CLI has no marketplace');
    case 'update':
      return commands({ args: ['skills', 'update', scope === 'global' ? '-g' : '-p'], cli: 'npx', ...where });
    default:
      return action satisfies never;
  }
}

const SAFE_ARG = /^[\w@%+=:,./-]+$/;

/** The exact command text shown in previews; args with other characters are single-quoted. */
export function displayCommand({ args, cli }: Command) {
  return [cli, ...args.map((arg) => (SAFE_ARG.test(arg) ? arg : `'${arg.replaceAll("'", String.raw`'\''`)}'`))].join(' ');
}
