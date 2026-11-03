import { describe, expect, it } from 'bun:test';

import { HistoryEntry, HistoryList } from '@agentic/contract-http/history';
import { ProblemDetails } from '@agentic/contract-http/problem';

import { createTestApp } from '../../platform/testing/test-app.js';

const TAIL_LIMIT = 256 * 1024;

describe('/api/history', () => {
  it('records a run with its exit code and output tail (AC14)', async () => {
    const { historyLog, request } = await createTestApp();
    const output = `dropped-head\n${'x'.repeat(TAIL_LIMIT)}`;
    const recorded = await historyLog.record({ exitCode: 1, kind: 'run', output, scope: 'project:p1', summary: 'agentic install' });

    const response = await request(`/api/history/${recorded.id}`);

    expect(response.status).toBe(200);
    const entry = HistoryEntry.parse(await response.json());
    expect(entry).toMatchObject({ content: null, exitCode: 1, kind: 'run', scope: 'project:p1', summary: 'agentic install', truncated: true });
    expect(entry.outputTail).toBe('x'.repeat(TAIL_LIMIT));
  });

  it('records a config write with the written content and lists the scope newest first (AC16)', async () => {
    const { historyLog, request } = await createTestApp();
    const first = await historyLog.record({ content: '{"a":1}', kind: 'config_write', scope: 'global', summary: 'Saved' });
    await historyLog.record({ content: 'x', kind: 'config_write', scope: 'project:p1', summary: 'Other scope' });
    const second = await historyLog.record({ content: '{"a":2}', kind: 'config_write', scope: 'global', summary: 'Saved again' });

    const all = HistoryList.parse(await (await request('/api/history?scope=global')).json());
    const latest = HistoryList.parse(await (await request('/api/history?scope=global&limit=1')).json());

    expect(all.entries.map((entry) => entry.id)).toEqual([second.id, first.id]);
    expect(all.entries[1]).toMatchObject({ content: '{"a":1}', exitCode: null, kind: 'config_write', outputTail: null, truncated: false });
    expect(latest.entries.map((entry) => entry.id)).toEqual([second.id]);
  });

  it('answers 404 for an unknown entry', async () => {
    const { request } = await createTestApp();

    const response = await request('/api/history/unknown');

    expect(response.status).toBe(404);
    expect(ProblemDetails.parse(await response.json()).type).toBe('history_entry_not_found');
  });

  it.each(['/api/history', '/api/history?scope=global&limit=0', '/api/history?scope=global&limit=abc'])('rejects %s as invalid', async (path) => {
    const { request } = await createTestApp();

    const response = await request(path);

    expect(response.status).toBe(422);
    expect(ProblemDetails.parse(await response.json()).type).toBe('validation_failed');
  });
});
