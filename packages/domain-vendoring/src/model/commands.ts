import type { Command } from '@agentic/domain-shared';

import type { VendoredSkill } from './manifest.js';

import { err, ok } from '@agentic/kernel-result';

import { SKILL_NAME } from './manifest.js';

export const VENDOR_ACTIONS = ['check', 'verify', 'update'] as const;
export type VendorAction = (typeof VENDOR_ACTIONS)[number];

export const VENDOR_SCRIPT = 'scripts/vendor-skills.mjs';

export type VendorCommandError =
  | { readonly names: readonly string[]; readonly type: 'unknown_skill' }
  | { readonly reason: string; readonly type: 'invalid_selection' };

/** What the client may ask for: an action from the closed list and, for update, known skill names or `all`. */
export interface VendorRequest {
  readonly action: VendorAction;
  readonly all?: boolean;
  readonly skills?: readonly string[];
}

const invalid = (reason: string) => err({ reason, type: 'invalid_selection' } satisfies VendorCommandError);

/** The one command for a request (D34): fixed script, closed action, names only from `vendor.json`. */
export function vendorCommand({ action, all = false, skills = [] }: VendorRequest, known: readonly VendoredSkill[], projectPath: string) {
  const command = (args: readonly string[]): Command => ({ args: [VENDOR_SCRIPT, action, ...args], cli: 'node', cwd: projectPath });
  if (action !== 'update') return skills.length > 0 || all ? invalid(`${action} takes no skill selection`) : ok(command([]));
  if (all === (skills.length > 0)) return invalid('update needs either a non-empty skills list or all: true');
  const unknown = skills.filter((name) => !SKILL_NAME.test(name) || !known.some((skill) => skill.name === name));
  if (unknown.length > 0) return err({ names: unknown, type: 'unknown_skill' } satisfies VendorCommandError);
  return ok(command(skills));
}

export const displayCommand = ({ args, cli }: Command) => [cli, ...args].join(' ');

export function runSummary({ action, all = false, skills = [] }: VendorRequest) {
  if (action !== 'update') return `Vendor ${action}`;
  return all ? 'Vendor update all' : `Vendor update ${skills.join(', ')}`;
}
