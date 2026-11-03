import { describe, expect, it } from 'vitest';

import { vendorCommand } from './commands.js';

const KNOWN = [
  { name: 'grilling', ref: null, source: 'a/b' },
  { name: 'tdd', ref: null, source: 'a/b' },
];

describe('vendorCommand', () => {
  it('builds check and verify in the project folder', () => {
    expect(vendorCommand({ action: 'check' }, KNOWN, '/p')).toEqual({ ok: true, value: { args: ['scripts/vendor-skills.mjs', 'check'], cli: 'node', cwd: '/p' } });
    expect(vendorCommand({ action: 'verify' }, KNOWN, '/p')).toEqual({ ok: true, value: { args: ['scripts/vendor-skills.mjs', 'verify'], cli: 'node', cwd: '/p' } });
  });

  it('builds update for selected skills, or all of them', () => {
    expect(vendorCommand({ action: 'update', skills: ['tdd'] }, KNOWN, '/p')).toMatchObject({ value: { args: ['scripts/vendor-skills.mjs', 'update', 'tdd'] } });
    expect(vendorCommand({ action: 'update', all: true }, KNOWN, '/p')).toMatchObject({ value: { args: ['scripts/vendor-skills.mjs', 'update'] } });
  });

  it('needs a selection for update', () => {
    expect(vendorCommand({ action: 'update' }, KNOWN, '/p')).toMatchObject({ error: { type: 'invalid_selection' } });
    expect(vendorCommand({ action: 'update', skills: [] }, KNOWN, '/p')).toMatchObject({ error: { type: 'invalid_selection' } });
    expect(vendorCommand({ action: 'update', all: true, skills: ['tdd'] }, KNOWN, '/p')).toMatchObject({ error: { type: 'invalid_selection' } });
  });

  it('refuses a selection for check and verify', () => {
    expect(vendorCommand({ action: 'check', skills: ['tdd'] }, KNOWN, '/p')).toMatchObject({ error: { type: 'invalid_selection' } });
  });

  it('refuses names outside vendor.json or the safe pattern', () => {
    expect(vendorCommand({ action: 'update', skills: ['nope'] }, KNOWN, '/p')).toEqual({ error: { names: ['nope'], type: 'unknown_skill' }, ok: false });
    expect(vendorCommand({ action: 'update', skills: ['--all'] }, KNOWN, '/p')).toMatchObject({ error: { type: 'unknown_skill' } });
  });
});
