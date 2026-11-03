import { describe, expect, it } from 'vitest';

import { createWorkItemsService, DOC_LIMIT_BYTES, EVENTS_LIMIT, EVENTS_LIMIT_BYTES, isValidSlug, parseDocName } from './index.js';
import { InMemoryWorkItemSource } from './testing.js';

const OUTPUT = '/repo/.agentic/work';

const state = (fields: Record<string, unknown>) => JSON.stringify({ phase: 'to-plan', status: 'in_progress', title: 'Item', updated: '2026-11-01T10:00:00Z', ...fields });
const event = (index: number) => JSON.stringify({ summary: `event ${String(index)}`, ts: '2026-11-01T10:00:00Z', type: 'progress' });

function setup(source = new InMemoryWorkItemSource()) {
  const service = createWorkItemsService({
    outputs: { outputDir: (projectId) => Promise.resolve(projectId === 'p1' ? OUTPUT : undefined) },
    source,
  });
  return { service, source };
}

describe('names (D31)', () => {
  it.each(['20261103-export', 'a', 'A1._-b'])('accepts slug %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(['', '..', '../x', 'a/b', String.raw`a\b`, '.hidden', '_archive', '-x', 'a..b'])('rejects slug %s', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });

  it.each([
    ['spec', 'spec.md'],
    ['decisions', 'decisions.md'],
    ['reviews/1-code-review.md', 'reviews/1-code-review.md'],
  ])('maps doc name %s to %s', (name, file) => {
    expect(parseDocName(name)).toEqual({ file, name });
  });

  it.each(['notes', 'spec.md', 'reviews/../spec.md', 'reviews/a/b.md', 'reviews/x.txt', 'reviews/..md', 'reviews/'])('rejects doc name %s', (name) => {
    expect(parseDocName(name)).toBeUndefined();
  });
});

describe('list (AC18, AC20)', () => {
  it('lists active and archived items with their status, newest first', async () => {
    const { service, source } = setup();
    source.add(OUTPUT, '20261101-old', { 'state.json': state({ title: 'Old', updated: '2026-11-01T00:00:00Z' }) });
    source.add(OUTPUT, '20261103-new', { 'state.json': state({ status: 'done', title: 'New', updated: '2026-11-03T00:00:00Z' }) });
    source.add(OUTPUT, '20261020-merged', { 'state.json': state({ status: 'completed', updated: '2026-11-02T00:00:00Z' }) }, { archived: true });

    const listed = await service.list('p1');

    expect(listed).toEqual({
      ok: true,
      value: [
        { archived: false, slug: '20261103-new', state: { phase: 'to-plan', readable: true, status: 'done', title: 'New', updated: '2026-11-03T00:00:00Z' } },
        { archived: true, slug: '20261020-merged', state: { phase: 'to-plan', readable: true, status: 'completed', title: 'Item', updated: '2026-11-02T00:00:00Z' } },
        { archived: false, slug: '20261101-old', state: { phase: 'to-plan', readable: true, status: 'in_progress', title: 'Old', updated: '2026-11-01T00:00:00Z' } },
      ],
    });
  });

  it('returns an empty list when the output folder is missing', async () => {
    const { service } = setup();

    expect(await service.list('p1')).toEqual({ ok: true, value: [] });
  });

  it('lists an item with malformed or missing state.json as unreadable, keeping the others', async () => {
    const { service, source } = setup();
    source.add(OUTPUT, '20261103-good', { 'state.json': state({ updated: '2026-11-03T00:00:00Z' }) });
    source.add(OUTPUT, '20261102-broken', { 'state.json': '{"status": "in_pro' });
    source.add(OUTPUT, '20261101-empty', { 'spec.md': '# Spec' });
    source.add(OUTPUT, '20261031-array', { 'state.json': '[]' });

    const listed = await service.list('p1');

    expect(listed.ok && listed.value.map(({ slug, state: itemState }) => [slug, itemState.readable ? 'ok' : itemState.reason])).toEqual([
      ['20261103-good', 'ok'],
      ['20261102-broken', 'invalid_json'],
      ['20261101-empty', 'missing_state'],
      ['20261031-array', 'not_an_object'],
    ]);
  });

  it('reads non-string state fields as null', async () => {
    const { service, source } = setup();
    source.add(OUTPUT, '20261103-x', { 'state.json': JSON.stringify({ status: 3 }) });

    const listed = await service.list('p1');

    expect(listed.ok && listed.value[0]?.state).toEqual({ phase: null, readable: true, status: null, title: null, updated: null });
  });

  it('skips folders whose names are not valid slugs', async () => {
    const { service, source } = setup();
    source.add(OUTPUT, '.git', { 'state.json': state({}) });
    source.add(OUTPUT, '20261103-x', { 'state.json': state({}) });

    const listed = await service.list('p1');

    expect(listed.ok && listed.value.map((item) => item.slug)).toEqual(['20261103-x']);
  });

  it('fails for an unknown project', async () => {
    const { service } = setup();

    expect(await service.list('nope')).toEqual({ error: { projectId: 'nope', type: 'project_not_found' }, ok: false });
  });
});

describe('detail (AC19)', () => {
  it('returns state, events timeline and the docs present', async () => {
    const { service, source } = setup();
    source.add(OUTPUT, '20261103-x', {
      'events.jsonl': `${event(1)}\nnot json\n\n${event(2)}\n"a string"\n`,
      'reviews/1-code-review.md': '# Review',
      'spec.md': '# Spec',
      'state.json': state({}),
      'unrelated.txt': 'x',
    });

    const detail = await service.detail('p1', '20261103-x');

    expect(detail.ok && detail.value).toEqual({
      archived: false,
      docs: ['reviews/1-code-review.md', 'spec'],
      slug: '20261103-x',
      state: { phase: 'to-plan', readable: true, status: 'in_progress', title: 'Item', updated: '2026-11-01T10:00:00Z' },
      timeline: { events: [JSON.parse(event(1)), JSON.parse(event(2))], malformed: 2, truncated: false },
    });
  });

  it('finds an archived item', async () => {
    const { service, source } = setup();
    source.add(OUTPUT, '20261001-x', { 'state.json': state({}) }, { archived: true });

    const detail = await service.detail('p1', '20261001-x');

    expect(detail.ok && detail.value).toMatchObject({ archived: true, docs: [], timeline: { events: [], malformed: 0, truncated: false } });
  });

  it(`keeps the latest ${String(EVENTS_LIMIT)} events and flags truncation`, async () => {
    const { service, source } = setup();
    const lines = Array.from({ length: EVENTS_LIMIT + 5 }, (_, index) => event(index));
    source.add(OUTPUT, '20261103-x', { 'events.jsonl': lines.join('\n') });

    const detail = await service.detail('p1', '20261103-x');

    const timeline = detail.ok ? detail.value.timeline : undefined;
    expect(timeline?.truncated).toBe(true);
    expect(timeline?.events).toHaveLength(EVENTS_LIMIT);
    expect(timeline?.events[0]).toEqual(JSON.parse(event(5)));
  });

  it('reads at most 5 MB from the end and drops the cut first line without counting it malformed', async () => {
    const { service, source } = setup();
    const big = JSON.stringify({ padding: 'x'.repeat(EVENTS_LIMIT_BYTES), type: 'note' });
    source.add(OUTPUT, '20261103-x', { 'events.jsonl': `${big}\n${event(1)}\n` });

    const detail = await service.detail('p1', '20261103-x');

    expect(detail.ok && detail.value.timeline).toEqual({ events: [JSON.parse(event(1))], malformed: 0, truncated: true });
  });

  it('reports an unreadable state in the detail', async () => {
    const { service, source } = setup();
    source.add(OUTPUT, '20261103-x', { 'state.json': '{' });

    const detail = await service.detail('p1', '20261103-x');

    expect(detail.ok && detail.value.state).toEqual({ readable: false, reason: 'invalid_json' });
  });

  it.each([
    ['../escape', 'invalid_slug'],
    ['20261103-missing', 'work_item_not_found'],
  ])('fails for slug %s with %s', async (slug, type) => {
    const { service } = setup();

    const detail = await service.detail('p1', slug);

    expect(!detail.ok && detail.error.type).toBe(type);
  });
});

describe('doc (AC19)', () => {
  it('returns a doc whole when under the cap', async () => {
    const { service, source } = setup();
    source.add(OUTPUT, '20261103-x', { 'plan.md': '# Plan' });

    expect(await service.doc('p1', '20261103-x', 'plan')).toEqual({ ok: true, value: { name: 'plan', text: '# Plan', truncated: false } });
  });

  it('caps a doc at 1 MB', async () => {
    const { service, source } = setup();
    source.add(OUTPUT, '20261103-x', { 'spec.md': 'a'.repeat(DOC_LIMIT_BYTES + 1) });

    const doc = await service.doc('p1', '20261103-x', 'spec');

    expect(doc.ok && doc.value.truncated).toBe(true);
    expect(doc.ok && doc.value.text.length).toBe(DOC_LIMIT_BYTES);
  });

  it('reads a review file', async () => {
    const { service, source } = setup();
    source.add(OUTPUT, '20261103-x', { 'reviews/2-fix.md': 'fix' });

    const doc = await service.doc('p1', '20261103-x', 'reviews/2-fix.md');

    expect(doc.ok && doc.value.text).toBe('fix');
  });

  it.each([
    ['20261103-x', '../state.json', 'invalid_doc_name'],
    ['..', 'spec', 'invalid_slug'],
    ['20261103-x', 'pr', 'doc_not_found'],
    ['20261103-gone', 'spec', 'work_item_not_found'],
    ['20261103-x', 'reviews/2-fix.md', 'doc_not_found'],
  ])('fails for %s / %s with %s', async (slug, name, type) => {
    const { service, source } = setup();
    source.add(OUTPUT, '20261103-x', { 'spec.md': '# Spec' });

    const doc = await service.doc('p1', slug, name);

    expect(!doc.ok && doc.error.type).toBe(type);
  });
});
