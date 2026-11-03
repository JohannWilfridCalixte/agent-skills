import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { createFakeCliExec, fakeCliError, fakeOutput } from '@agentic/adapter-cli-exec/testing';
import { ConfigPreviewResponse, ConfigSaveResponse } from '@agentic/contract-http/config';

import { createTestApp } from '../../platform/testing/test-app.js';

let userHome = '';

beforeEach(() => {
  userHome = mkdtempSync(join(tmpdir(), 'agentic-model-warnings-'));
});

afterEach(() => {
  rmSync(userHome, { force: true, recursive: true });
});

describe('model warnings on config save (AC8)', () => {
  const homeDirOf = () => join(userHome, '.agentic');
  const codexListing = () => createFakeCliExec([{ args: ['debug', 'models'], cli: 'codex', result: fakeOutput('{"models":[{"slug":"gpt-6-sol"}]}') }]);
  const send = async (cliExec: ReturnType<typeof createFakeCliExec>, method: 'POST' | 'PUT', path: string, model: string) => {
    const { request } = await createTestApp({ cliExec, homeDir: homeDirOf(), userHome });
    return request(path, { body: JSON.stringify({ steps: { codex: { implement: { model } } } }), headers: { 'content-type': 'application/json' }, method });
  };

  it('warns in the preview for an unlisted model id', async () => {
    const response = await send(codexListing(), 'POST', '/api/config/global/preview', 'gpt-9');

    expect(ConfigPreviewResponse.parse(await response.json()).warnings.map((warning) => warning.path)).toEqual(['steps.codex.implement.model']);
  });

  it('saves an unlisted model id with a warning', async () => {
    const response = await send(codexListing(), 'PUT', '/api/config/global', 'gpt-9');

    expect(response.status).toBe(200);
    expect(ConfigSaveResponse.parse(await response.json()).warnings.map((warning) => warning.path)).toEqual(['steps.codex.implement.model']);
  });

  it('does not warn for a listed model id', async () => {
    const response = await send(codexListing(), 'PUT', '/api/config/global', 'gpt-6-sol');

    expect(ConfigSaveResponse.parse(await response.json()).warnings).toEqual([]);
  });

  it('does not warn when the catalog is unavailable', async () => {
    const cliExec = createFakeCliExec([{ args: ['debug', 'models'], cli: 'codex', result: fakeCliError('codex', 'not_found') }]);

    const response = await send(cliExec, 'POST', '/api/config/global/preview', 'gpt-9');

    expect(ConfigPreviewResponse.parse(await response.json()).warnings).toEqual([]);
  });
});
