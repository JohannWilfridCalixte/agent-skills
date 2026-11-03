#!/usr/bin/env node
// Plugin integrity (AC29): the skills distribution is untouched by the webapp work.
// 1. Protected plugin paths are unchanged versus the merge-base with the base branch (default `main`, or argv[2]).
// 2. Every skill path listed in each plugin.json exists on disk and holds a SKILL.md.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROTECTED_PATHS = [
  '.claude-plugin/',
  '.codex-plugin/',
  '.cursor-plugin/',
  '.agents/plugins/',
  'skills/',
  'docs/index.html',
  'docs/configuration.md',
  'scripts/vendor-skills.mjs',
  'vendor.json',
  'vendor.lock.json',
];
const PLUGIN_MANIFESTS = ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json'];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
const baseBranch = process.argv[2] ?? 'main';
const failures = [];

const baseRef = [baseBranch, `origin/${baseBranch}`].find((ref) => {
  try {
    git('rev-parse', '--verify', '--quiet', ref);
    return true;
  } catch {
    return false;
  }
});
if (baseRef === undefined) {
  failures.push(`base branch "${baseBranch}" not found; cannot compare protected paths`);
} else {
  const mergeBase = git('merge-base', 'HEAD', baseRef);
  const changed = git('diff', '--name-only', mergeBase, '--', ...PROTECTED_PATHS.map((path) => join(root, path)));
  for (const file of changed.split('\n').filter(Boolean)) failures.push(`protected plugin file changed since ${baseRef}: ${file}`);
}

for (const manifest of PLUGIN_MANIFESTS) {
  const skills = JSON.parse(readFileSync(join(root, manifest), 'utf8')).skills ?? [];
  if (skills.length === 0) failures.push(`${manifest} lists no skills`);
  for (const skill of skills) {
    if (!existsSync(join(root, skill, 'SKILL.md'))) failures.push(`${manifest}: ${skill}/SKILL.md not found`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`plugin integrity: ${failure}\n`);
  process.exit(1);
}
process.stdout.write(`plugin integrity: OK (${String(PROTECTED_PATHS.length)} protected paths unchanged, ${String(PLUGIN_MANIFESTS.length)} manifests checked)\n`);
