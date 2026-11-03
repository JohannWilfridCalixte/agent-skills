import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

import { checkWorkspaceManifests } from './check-workspace-manifests.ts';

const fixture = (name: string) => join(import.meta.dirname, '__fixtures__', 'manifests', name);

describe('checkWorkspaceManifests', () => {
  it('accepts workspaces that follow the role table', () => {
    expect(checkWorkspaceManifests(fixture('ok'))).toEqual([]);
  });

  it('rejects a dependency against the role direction and a non-workspace internal version', () => {
    expect(checkWorkspaceManifests(fixture('bad-dependency'))).toEqual([
      'packages/design-system: dependencies "@agentic/kernel-result" must use the workspace: protocol.',
      'packages/design-system: dependencies "@agentic/kernel-result" breaks the design-system dependency direction (allowed: none).',
      'packages/domain-shared: dependencies "@agentic/domain-tasks" breaks the domain dependency direction (allowed: kernel-, domain-shared).',
    ]);
  });

  it('rejects a name that differs from the directory and a directory without a role prefix', () => {
    expect(checkWorkspaceManifests(fixture('bad-name'))).toEqual([
      'packages/kernel-result: package name must be "@agentic/kernel-result".',
      'packages/misc: directory must start with a role prefix (adapter, contract, design-system, domain, kernel, tooling).',
    ]);
  });
});
