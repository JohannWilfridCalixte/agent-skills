import { homedir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

import { loadSettings } from './settings.js';

describe('loadSettings', () => {
  it('defaults to port 8787 and ~/.agentic/agentic.db', () => {
    expect(loadSettings({})).toMatchObject({ dbPath: join(homedir(), '.agentic', 'agentic.db'), homeDir: join(homedir(), '.agentic'), port: 8787 });
  });

  it('resolves the log service fields once: environment local and the package version by default (ub-mode-3)', () => {
    expect(loadSettings({})).toMatchObject({ environment: 'local', serviceRevision: expect.stringMatching(/^\d+\.\d+\.\d+/) as unknown });
  });

  it('takes the environment from AGENTIC_ENV, then NODE_ENV, and the revision from GIT_SHA', () => {
    expect(loadSettings({ AGENTIC_ENV: 'staging', GIT_SHA: 'a1b2c3d', NODE_ENV: 'production' })).toMatchObject({ environment: 'staging', serviceRevision: 'a1b2c3d' });
    expect(loadSettings({ NODE_ENV: 'production' })).toMatchObject({ environment: 'production' });
  });

  it('reads AGENTIC_PORT and AGENTIC_DB_PATH', () => {
    expect(loadSettings({ AGENTIC_DB_PATH: ':memory:', AGENTIC_PORT: '9000' })).toMatchObject({ dbPath: ':memory:', port: 9000 });
  });

  it('puts the database under AGENTIC_HOME', () => {
    expect(loadSettings({ AGENTIC_HOME: '/tmp/agentic-home' })).toMatchObject({ dbPath: '/tmp/agentic-home/agentic.db', homeDir: '/tmp/agentic-home' });
  });

  it('rejects an invalid port', () => {
    expect(() => loadSettings({ AGENTIC_PORT: 'eighty' })).toThrow(/AGENTIC_PORT/);
  });
});
