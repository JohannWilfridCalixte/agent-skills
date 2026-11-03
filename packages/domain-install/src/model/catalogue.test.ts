import { describe, expect, it } from 'vitest';

import { catalogueCommands, displayCommand, INSTALL_RUN_TIMEOUT_MS } from './catalogue.js';

const HOME = '/Users/me';
const global = { userHome: HOME };

describe('catalogueCommands (D34, AC26)', () => {
  it.each([
    ['claude', 'marketplace-add', [{ args: ['plugin', 'marketplace', 'add', 'JohannWilfridCalixte/agent-skills'], cli: 'claude', timeoutMs: 600_000 }]],
    ['claude', 'install', [{ args: ['plugin', 'install', 'agentic@agentic'], cli: 'claude', timeoutMs: 600_000 }]],
    ['claude', 'update', [{ args: ['plugin', 'marketplace', 'update', 'agentic'], cli: 'claude', timeoutMs: 600_000 }, { args: ['plugin', 'update', 'agentic@agentic'], cli: 'claude', timeoutMs: 600_000 }]],
    ['codex', 'marketplace-add', [{ args: ['plugin', 'marketplace', 'add', 'JohannWilfridCalixte/agent-skills'], cli: 'codex', timeoutMs: 600_000 }]],
    ['codex', 'install', [{ args: ['plugin', 'add', 'agentic@agentic'], cli: 'codex', timeoutMs: 600_000 }]],
    ['codex', 'update', [{ args: ['plugin', 'marketplace', 'upgrade'], cli: 'codex', timeoutMs: 600_000 }]],
  ] as const)('builds the %s plugin %s commands', (harness, action, expected) => {
    expect(catalogueCommands({ action, harness, method: 'plugin', scope: 'global' }, global)).toEqual({ ok: true, value: expected });
  });

  it('clones cursor into the server-known home', () => {
    expect(catalogueCommands({ action: 'install', harness: 'cursor', method: 'clone', scope: 'global' }, global)).toEqual({
      ok: true,
      value: [{ args: ['clone', 'https://github.com/JohannWilfridCalixte/agent-skills', '/Users/me/.cursor/plugins/local/agentic'], cli: 'git', timeoutMs: 600_000 }],
    });
  });

  it('pulls the cursor clone to update', () => {
    expect(catalogueCommands({ action: 'update', harness: 'cursor', method: 'clone', scope: 'global' }, global)).toEqual({
      ok: true,
      value: [{ args: ['-C', '/Users/me/.cursor/plugins/local/agentic', 'pull'], cli: 'git', timeoutMs: 600_000 }],
    });
  });

  it('adds skills globally with -g', () => {
    expect(catalogueCommands({ action: 'install', method: 'skills', scope: 'global' }, global)).toEqual({
      ok: true,
      value: [{ args: ['skills', 'add', 'JohannWilfridCalixte/agent-skills', '-g', '-y'], cli: 'npx', timeoutMs: 600_000 }],
    });
  });

  it('adds skills to a project without -g, in the project folder', () => {
    expect(catalogueCommands({ action: 'install', method: 'skills', scope: 'project' }, { projectPath: '/work/app', userHome: HOME })).toEqual({
      ok: true,
      value: [{ args: ['skills', 'add', 'JohannWilfridCalixte/agent-skills', '-y'], cli: 'npx', cwd: '/work/app', timeoutMs: 600_000 }],
    });
  });

  it('updates skills with the scope flag', () => {
    expect(catalogueCommands({ action: 'update', method: 'skills', scope: 'global' }, global)).toEqual({ ok: true, value: [{ args: ['skills', 'update', '-g'], cli: 'npx', timeoutMs: 600_000 }] });
    expect(catalogueCommands({ action: 'update', method: 'skills', scope: 'project' }, { projectPath: '/work/app', userHome: HOME })).toEqual({
      ok: true,
      value: [{ args: ['skills', 'update', '-p'], cli: 'npx', cwd: '/work/app', timeoutMs: 600_000 }],
    });
  });

  it.each([
    [{ action: 'install', harness: 'cursor', method: 'plugin', scope: 'global' }],
    [{ action: 'install', harness: 'claude', method: 'clone', scope: 'global' }],
    [{ action: 'marketplace-add', harness: 'cursor', method: 'clone', scope: 'global' }],
    [{ action: 'marketplace-add', method: 'skills', scope: 'global' }],
    [{ action: 'install', harness: 'claude', method: 'plugin', scope: 'project' }],
    [{ action: 'install', method: 'plugin', scope: 'global' }],
  ] as const)('rejects a combination outside the catalogue: %o', (request) => {
    expect(catalogueCommands(request, { projectPath: '/work/app', userHome: HOME })).toMatchObject({ error: { type: 'unsupported' }, ok: false });
  });

  it('rejects project scope without a project folder', () => {
    expect(catalogueCommands({ action: 'install', method: 'skills', scope: 'project' }, global)).toMatchObject({ ok: false });
  });
});

describe('catalogue run timeouts (ub-mode-1)', () => {
  it.each([
    [{ action: 'update', harness: 'claude', method: 'plugin', scope: 'global' }],
    [{ action: 'install', harness: 'codex', method: 'plugin', scope: 'global' }],
    [{ action: 'install', harness: 'cursor', method: 'clone', scope: 'global' }],
    [{ action: 'install', method: 'skills', scope: 'global' }],
  ] as const)('gives every command of %o the 10 minute install timeout', (request) => {
    const result = catalogueCommands(request, global);

    expect(INSTALL_RUN_TIMEOUT_MS).toBe(10 * 60 * 1000);
    expect(result.ok && result.value.every((command) => command.timeoutMs === INSTALL_RUN_TIMEOUT_MS)).toBe(true);
  });
});

describe('displayCommand', () => {
  it('shows the cli and args, quoting args with spaces', () => {
    expect(displayCommand({ args: ['-C', '/Users/my home/x', 'pull'], cli: 'git' })).toBe("git -C '/Users/my home/x' pull");
  });
});
