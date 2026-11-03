import { describe, expect, it } from 'vitest';

import { createHistoryService, OUTPUT_TAIL_LIMIT_BYTES, outputTail } from './index.js';
import { InMemoryHistoryRepository } from './testing.js';

const byteLength = (text: string) => new TextEncoder().encode(text).length;

function setup() {
  let sequence = 0;
  let minute = 0;
  const service = createHistoryService({
    newId: () => `id-${String(++sequence)}`,
    now: () => new Date(Date.UTC(2026, 10, 3, 10, minute++)),
    repository: new InMemoryHistoryRepository(),
  });
  return { service };
}

describe('output tail (D33)', () => {
  it('is 256 KiB', () => {
    expect(OUTPUT_TAIL_LIMIT_BYTES).toBe(262_144);
  });

  it('keeps output of exactly the limit whole', () => {
    const output = 'a'.repeat(OUTPUT_TAIL_LIMIT_BYTES);

    expect(outputTail(output)).toEqual({ tail: output, truncated: false });
  });

  it('keeps the last 256 KiB when one byte over', () => {
    const output = `X${'a'.repeat(OUTPUT_TAIL_LIMIT_BYTES)}`;

    const { tail, truncated } = outputTail(output);

    expect(truncated).toBe(true);
    expect(tail).toBe('a'.repeat(OUTPUT_TAIL_LIMIT_BYTES));
  });

  it('never splits a multi-byte character at the cut', () => {
    const output = `start${'é'.repeat(10)}end`;

    const { tail, truncated } = outputTail(output, 8);

    expect(truncated).toBe(true);
    expect(tail).toBe('ééend');
    expect(byteLength(tail)).toBeLessThanOrEqual(8);
  });

  it('keeps a four-byte character whole when it fits exactly', () => {
    expect(outputTail('ab😀', 4)).toEqual({ tail: '😀', truncated: true });
    expect(outputTail('ab😀', 3)).toEqual({ tail: '', truncated: true });
  });
});

describe('record', () => {
  it('records a config write with its content snapshot', async () => {
    const { service } = setup();

    const entry = await service.record({ content: '{"a":1}', kind: 'config_write', scope: 'global', summary: 'Saved settings' });

    expect(entry).toEqual({
      content: '{"a":1}',
      createdAt: '2026-11-03T10:00:00.000Z',
      exitCode: null,
      id: 'id-1',
      kind: 'config_write',
      outputTail: null,
      scope: 'global',
      summary: 'Saved settings',
      truncated: false,
    });
  });

  it('records a run with exit code and the tail of a long output (AC14)', async () => {
    const { service } = setup();

    const entry = await service.record({
      exitCode: 2,
      kind: 'run',
      output: `head${'z'.repeat(OUTPUT_TAIL_LIMIT_BYTES)}`,
      scope: 'project:p1',
      summary: 'install',
    });

    expect(entry).toMatchObject({ content: null, exitCode: 2, kind: 'run', truncated: true });
    expect(entry.outputTail).toBe('z'.repeat(OUTPUT_TAIL_LIMIT_BYTES));
  });

  it('flags a short run output as truncated when the run already dropped its head (super-review-10)', async () => {
    const { service } = setup();

    const entry = await service.record({ exitCode: 0, kind: 'run', output: 'last lines', outputTruncated: true, scope: 'global', summary: 'vendor update' });

    expect(entry).toMatchObject({ outputTail: 'last lines', truncated: true });
  });
});

describe('list and get', () => {
  it('lists a scope newest first, honouring the limit', async () => {
    const { service } = setup();
    const first = await service.record({ content: 'a', kind: 'config_write', scope: 'global', summary: 'one' });
    await service.record({ content: 'b', kind: 'config_write', scope: 'project:p1', summary: 'other scope' });
    const restore = await service.record({ content: 'a', kind: 'config_restore', scope: 'global', summary: 'two' });

    expect(await service.list('global')).toEqual([restore, first]);
    expect(await service.list('global', { limit: 1 })).toEqual([restore]);
  });

  it('gets an entry by id, or reports it unknown', async () => {
    const { service } = setup();
    const entry = await service.record({ exitCode: 0, kind: 'run', output: 'ok', scope: 'global', summary: 'update' });

    expect(await service.get(entry.id)).toEqual({ ok: true, value: entry });
    expect(await service.get('nope')).toEqual({ error: { id: 'nope', type: 'history_entry_not_found' }, ok: false });
  });
});
