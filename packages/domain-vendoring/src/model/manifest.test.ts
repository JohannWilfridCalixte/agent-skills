import { describe, expect, it } from 'vitest';

import { parseManifest } from './manifest.js';

const MANIFEST = JSON.stringify({
  skills: [
    { into: 'skills/flow', skill: 'grilling', source: 'mattpocock/skills' },
    { file: '.claude/commands/security-review.md', into: 'skills/review/x/upstream', name: 'claude-security-review', source: 'anthropics/claude-code-security-review' },
  ],
});
const LOCK = JSON.stringify({ skills: { grilling: { ref: 'abc123' } }, version: 1 });

describe('parseManifest', () => {
  it('lists skills and file entries with their pinned ref', () => {
    expect(parseManifest(MANIFEST, LOCK)).toEqual({
      ok: true,
      value: [
        { name: 'grilling', ref: 'abc123', source: 'mattpocock/skills' },
        { name: 'claude-security-review', ref: null, source: 'anthropics/claude-code-security-review' },
      ],
    });
  });

  it('has no refs without a lock file', () => {
    const parsed = parseManifest(MANIFEST, undefined);

    expect(parsed.ok && parsed.value.map((skill) => skill.ref)).toEqual([null, null]);
  });

  it.each([
    ['not json', '{'],
    ['no skills array', '{"skills":3}'],
    ['entry without a name', '{"skills":[{"source":"a/b"}]}'],
    ['unsafe name', '{"skills":[{"skill":"../x","source":"a/b"}]}'],
  ])('rejects a malformed vendor.json: %s', (_label, text) => {
    expect(parseManifest(text, undefined)).toMatchObject({ error: { file: 'vendor.json', type: 'malformed_vendor_file' }, ok: false });
  });

  it('rejects a malformed vendor.lock.json', () => {
    expect(parseManifest(MANIFEST, '[')).toMatchObject({ error: { file: 'vendor.lock.json', type: 'malformed_vendor_file' }, ok: false });
  });
});
