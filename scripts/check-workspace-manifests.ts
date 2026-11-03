/**
 * Manifest-level half of the dependency rules (the import-level half is ESLint):
 * 1. `packages/<dir>` and `applications/<dir>` are published as `@agentic/<dir>`; packages carry a role prefix.
 * 2. Internal dependencies use the `workspace:` protocol.
 * 3. Runtime dependencies follow the role table below; `domain-<a>` never depends on `domain-<b>` (except shared).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Manifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly name?: string;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

interface Workspace {
  readonly directory: string;
  readonly manifest: Manifest;
  readonly slug: string;
}

const SCOPE = '@agentic/';
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

const ALLOWED_RUNTIME_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  adapter: ['kernel-', 'domain-shared', 'adapter-'],
  contract: ['contract-', 'kernel-'],
  'design-system': [],
  domain: ['kernel-', 'domain-shared'],
  kernel: [],
  tooling: [],
};

const readManifest = (root: string, directory: string): Manifest =>
  JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8')) as Manifest;

function listWorkspaces(root: string, group: string): Workspace[] {
  if (!existsSync(join(root, group))) return [];
  return readdirSync(join(root, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, group, entry.name, 'package.json')))
    .map((entry) => ({ directory: `${group}/${entry.name}`, manifest: readManifest(root, `${group}/${entry.name}`), slug: entry.name }))
    .sort((a, b) => a.directory.localeCompare(b.directory));
}

function checkWorkspaceProtocol({ directory, manifest }: Workspace) {
  const problems: string[] = [];
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, version] of Object.entries(manifest[field] ?? {})) {
      if (name.startsWith(SCOPE) && !version.startsWith('workspace:')) {
        problems.push(`${directory}: ${field} "${name}" must use the workspace: protocol.`);
      }
    }
  }
  return problems;
}

function checkName({ directory, manifest, slug }: Workspace) {
  return manifest.name === `${SCOPE}${slug}` ? [] : [`${directory}: package name must be "${SCOPE}${slug}".`];
}

function checkDependencyDirection({ directory, manifest, slug }: Workspace) {
  const roles = Object.keys(ALLOWED_RUNTIME_DEPENDENCIES);
  const role = roles.find((candidate) => slug === candidate || slug.startsWith(`${candidate}-`));
  if (role === undefined) return [`${directory}: directory must start with a role prefix (${roles.join(', ')}).`];

  const allowed = ALLOWED_RUNTIME_DEPENDENCIES[role] ?? [];
  const problems: string[] = [];
  for (const field of ['dependencies', 'peerDependencies'] as const) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      const dependency = name.slice(SCOPE.length);
      if (name.startsWith(SCOPE) && !allowed.some((prefix) => dependency.startsWith(prefix))) {
        problems.push(`${directory}: ${field} "${name}" breaks the ${role} dependency direction (allowed: ${allowed.join(', ') || 'none'}).`);
      }
    }
  }
  return problems;
}

/** Returns every rule violation under `root`; an empty list means the manifests are valid. */
export function checkWorkspaceManifests(root: string): string[] {
  const packages = listWorkspaces(root, 'packages');
  const applications = listWorkspaces(root, 'applications');
  return [
    ...packages.flatMap((workspace) => [...checkName(workspace), ...checkWorkspaceProtocol(workspace), ...checkDependencyDirection(workspace)]),
    ...applications.flatMap((workspace) => [...checkName(workspace), ...checkWorkspaceProtocol(workspace)]),
    ...checkWorkspaceProtocol({ directory: '.', manifest: readManifest(root, '.'), slug: '' }),
  ];
}

if (import.meta.main) {
  const problems = checkWorkspaceManifests(join(import.meta.dirname, '..'));
  if (problems.length > 0) {
    process.stderr.write(`Workspace manifest check failed:\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('Workspace manifests OK.\n');
}
