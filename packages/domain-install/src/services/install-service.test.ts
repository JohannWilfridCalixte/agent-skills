import { describe, expect, it } from 'vitest';

import { CLAUDE_MODEL_ALIASES } from '../model/parse-models.js';
import { FakeHarnessEnvironment } from '../testing.js';
import { createInstallService } from './install-service.js';

describe('harnesses', () => {
  it('is present when the CLI answers --version', async () => {
    const environment = new FakeHarnessEnvironment().cli('claude', ['--version'], '2.1.0 (Claude Code)\n');
    const service = createInstallService(environment);

    const harnesses = await service.harnesses();

    expect(harnesses.find((entry) => entry.harness === 'claude')).toEqual({
      cli: { found: true, version: '2.1.0 (Claude Code)' },
      configFolder: false,
      harness: 'claude',
      present: true,
      reason: 'claude CLI found (2.1.0 (Claude Code))',
    });
  });

  it('is present when only the config folder exists', async () => {
    const environment = new FakeHarnessEnvironment().folder('.cursor');
    const service = createInstallService(environment);

    const harnesses = await service.harnesses();

    expect(harnesses.find((entry) => entry.harness === 'cursor')).toMatchObject({ cli: { found: false }, configFolder: true, present: true, reason: '~/.cursor exists; agent CLI not found' });
  });

  it('is absent with a reason when neither CLI nor folder is there', async () => {
    const service = createInstallService(new FakeHarnessEnvironment());

    const harnesses = await service.harnesses();

    expect(harnesses.map((entry) => [entry.harness, entry.present, entry.reason])).toEqual([
      ['cursor', false, 'agent CLI not found and ~/.cursor missing'],
      ['claude', false, 'claude CLI not found and ~/.claude missing'],
      ['codex', false, 'codex CLI not found and ~/.codex missing'],
    ]);
  });
});

describe('models', () => {
  it('lists cursor models from `agent models`', async () => {
    const service = createInstallService(new FakeHarnessEnvironment().cli('cursor', ['models'], 'auto - Auto (default)\ngpt-5.2 - GPT-5.2\n'));

    expect(await service.models('cursor')).toEqual({ available: true, ids: ['auto', 'gpt-5.2'] });
  });

  it('lists codex models from `codex debug models`', async () => {
    const service = createInstallService(new FakeHarnessEnvironment().cli('codex', ['debug', 'models'], '{"models":[{"slug":"gpt-6-sol"}]}'));

    expect(await service.models('codex')).toEqual({ available: true, ids: ['gpt-6-sol'] });
  });

  it('lists the static claude aliases without running anything', async () => {
    const environment = new FakeHarnessEnvironment();

    expect(await createInstallService(environment).models('claude')).toEqual({ available: true, ids: CLAUDE_MODEL_ALIASES });
    expect(environment.calls).toEqual([]);
  });

  it('is unavailable with the CLI failure as reason', async () => {
    const service = createInstallService(new FakeHarnessEnvironment());

    expect(await service.models('codex')).toEqual({ available: false, reason: 'codex models unavailable: codex CLI not found' });
  });

  it('is unavailable when the output lists no model', async () => {
    const service = createInstallService(new FakeHarnessEnvironment().cli('cursor', ['models'], 'Error: not logged in\n'));

    expect(await service.models('cursor')).toEqual({ available: false, reason: 'agent models listed no model ids' });
  });
});
