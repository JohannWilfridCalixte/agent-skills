import { describe, expect, it, vi } from 'vitest';

import { ProjectList } from '@agentic/contract-http/projects';

import { createApiClient } from './api-client';

const TOKEN = 'test-token';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status: 200, ...init });

function stubFetch(response: () => Promise<Response> | Response) {
  return vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () => response());
}

const headersOf = (fetch: ReturnType<typeof stubFetch>) => new Headers(fetch.mock.calls[0]?.[1].headers);

describe('createApiClient', () => {
  it('returns the parsed body on success', async () => {
    const fetch = stubFetch(() => json({ projects: [] }));
    const api = createApiClient({ fetch, getToken: () => TOKEN });

    const result = await api.get('/projects', ProjectList);

    expect(result).toEqual({ ok: true, value: { projects: [] } });
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/projects');
  });

  it('parses an RFC 9457 problem into a typed error', async () => {
    const problem = { detail: 'Folder does not exist.', status: 422, title: 'Invalid project', type: 'project_not_found' };
    const api = createApiClient({
      fetch: stubFetch(() => json(problem, { headers: { 'content-type': 'application/problem+json' }, status: 422 })),
      getToken: () => TOKEN,
    });

    const result = await api.post('/projects', { path: '/nope' }, ProjectList);

    expect(result).toMatchObject({ error: { problem, status: 422, type: 'problem' }, ok: false });
  });

  it('turns a rejected fetch into a network error instead of rejecting', async () => {
    const api = createApiClient({ fetch: stubFetch(() => Promise.reject(new TypeError('Failed to fetch'))), getToken: () => TOKEN });

    const result = await api.get('/projects', ProjectList);

    expect(result).toMatchObject({ error: { message: 'Failed to fetch', type: 'network' }, ok: false });
  });

  it('reports an error status without a problem body as unexpected_status', async () => {
    const api = createApiClient({ fetch: stubFetch(() => new Response('oops', { status: 502 })), getToken: () => TOKEN });

    const result = await api.get('/projects', ProjectList);

    expect(result).toMatchObject({ error: { status: 502, type: 'unexpected_status' }, ok: false });
  });

  it('reports a body that does not match the contract as invalid_body', async () => {
    const api = createApiClient({ fetch: stubFetch(() => json({ projects: 'nope' })), getToken: () => TOKEN });

    const result = await api.get('/projects', ProjectList);

    expect(result).toMatchObject({ error: { status: 200, type: 'invalid_body' }, ok: false });
  });

  it('sends the bearer token on writes', async () => {
    const fetch = stubFetch(() => json({ projects: [] }));
    const api = createApiClient({ fetch, getToken: () => TOKEN });

    await api.post('/projects', { path: '/work' }, ProjectList);

    expect(headersOf(fetch).get('authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('sends the bearer token on reads, which process-spawning GETs require (ADR 0009)', async () => {
    const fetch = stubFetch(() => json({ projects: [] }));
    const api = createApiClient({ fetch, getToken: () => TOKEN });

    await api.get('/install/status?scope=global', ProjectList);

    expect(headersOf(fetch).get('authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('sends a correlation id on every request', async () => {
    const fetch = stubFetch(() => json({ projects: [] }));
    const api = createApiClient({ fetch, getToken: () => TOKEN });

    await api.get('/projects', ProjectList);

    expect(headersOf(fetch).get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('subscribeToRun', () => {
  const sse = (text: string) =>
    new Response(new Blob([text]).stream(), { headers: { 'content-type': 'text/event-stream' }, status: 200 });

  it('yields typed run events from the stream, with the bearer token', async () => {
    const fetch = stubFetch(() =>
      sse('event: stdout\ndata: {"type":"stdout","line":"hello"}\n\nevent: exit\ndata: {"type":"exit","exitCode":0}\n\nevent: status\ndata: {"type":"status","status":"succeeded"}\n\n'),
    );
    const api = createApiClient({ fetch, getToken: () => TOKEN });

    const events = await Array.fromAsync(api.subscribeToRun('run-1'));

    expect(events).toEqual([
      { ok: true, value: { line: 'hello', type: 'stdout' } },
      { ok: true, value: { exitCode: 0, type: 'exit' } },
      { ok: true, value: { status: 'succeeded', type: 'status' } },
    ]);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/runs/run-1/events');
    expect(headersOf(fetch).get('authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('yields one error and stops when the stream cannot be opened', async () => {
    const api = createApiClient({ fetch: stubFetch(() => Promise.reject(new TypeError('Failed to fetch'))), getToken: () => TOKEN });

    const events = await Array.fromAsync(api.subscribeToRun('run-1'));

    expect(events).toMatchObject([{ error: { type: 'network' }, ok: false }]);
  });

  it('yields an invalid_body error for a malformed event', async () => {
    const api = createApiClient({ fetch: stubFetch(() => sse('data: {"type":"nope"}\n\n')), getToken: () => TOKEN });

    const events = await Array.fromAsync(api.subscribeToRun('run-1'));

    expect(events).toMatchObject([{ error: { type: 'invalid_body' }, ok: false }]);
  });
});
