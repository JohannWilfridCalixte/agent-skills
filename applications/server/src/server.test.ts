import type { ServerModule } from './platform/module.js';

import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { PROBLEM_CONTENT_TYPE, ProblemDetails } from '@agentic/contract-http/problem';

import { createTestApp, TEST_HOST } from './platform/testing/test-app.js';
import { validate } from './platform/validation.js';

async function expectProblem(response: Response, status: number, type: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain(PROBLEM_CONTENT_TYPE);
  const body = ProblemDetails.parse(await response.json());
  expect(body.type).toBe(type);
  expect(body.correlationId).toBe(response.headers.get('x-correlation-id') ?? '');
}

/** A write route that records each execution, so tests can assert a rejected request ran nothing. */
function probeModule() {
  const executed: string[] = [];
  const module: ServerModule = {
    name: 'probe',
    registerRoutes(app) {
      app.post('/', validate('json', z.object({ name: z.string() })), (c) => {
        executed.push(c.req.valid('json').name);
        return c.json({ ok: true }, 201);
      });
    },
  };
  return { executed, module };
}

const post = (body: unknown, headers: Record<string, string> = {}) => ({
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...headers },
  method: 'POST',
});

describe('health', () => {
  it('answers GET /api/health without a token', async () => {
    const { request } = await createTestApp();

    const response = await request('/api/health', { headers: { authorization: '' } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('host allowlist (AC25)', () => {
  it.each(['evil.example:8787', '127.0.0.1', 'localhost:9999', '127.0.0.1.evil.example:8787'])('rejects Host %s', async (host) => {
    const { request } = await createTestApp();

    await expectProblem(await request('/api/health', { headers: { host } }), 403, 'host_not_allowed');
  });

  it('accepts localhost with the server port', async () => {
    const { request } = await createTestApp();

    expect((await request('/api/health', { headers: { host: 'localhost:8787' } })).status).toBe(200);
  });
});

describe('origin allowlist (AC25)', () => {
  it('rejects a foreign Origin and runs nothing', async () => {
    const probe = probeModule();
    const { request } = await createTestApp({ modules: [probe.module] });

    await expectProblem(await request('/api/probe', post({ name: 'x' }, { origin: 'http://evil.example' })), 403, 'origin_not_allowed');
    expect(probe.executed).toEqual([]);
  });

  it('accepts the same origin', async () => {
    const probe = probeModule();
    const { request } = await createTestApp({ modules: [probe.module] });

    expect((await request('/api/probe', post({ name: 'x' }, { origin: `http://${TEST_HOST}` }))).status).toBe(201);
  });
});

describe('bearer token on writes (AC25)', () => {
  it.each([
    ['missing', ''],
    ['wrong', 'Bearer not-the-token'],
    ['malformed', 'Basic abc'],
  ])('rejects a write with a %s token and runs nothing', async (_label, authorization) => {
    const probe = probeModule();
    const { request } = await createTestApp({ modules: [probe.module] });

    const response = await request('/api/probe', post({ name: 'x' }, { authorization }));

    await expectProblem(response, 401, 'unauthorized');
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
    expect(probe.executed).toEqual([]);
  });

  it('accepts a write with the token', async () => {
    const probe = probeModule();
    const { request } = await createTestApp({ modules: [probe.module] });

    const response = await request('/api/probe', post({ name: 'x' }));

    expect(response.status).toBe(201);
    expect(probe.executed).toEqual(['x']);
  });

  it('returns a validation problem for an invalid body', async () => {
    const probe = probeModule();
    const { request } = await createTestApp({ modules: [probe.module] });

    const response = await request('/api/probe', post({ name: 1 }));

    await expectProblem(response, 422, 'validation_failed');
    expect(probe.executed).toEqual([]);
  });
});

describe('errors', () => {
  it('returns a 404 problem for an unknown route', async () => {
    const { request } = await createTestApp();

    await expectProblem(await request('/api/nope'), 404, 'not_found');
  });

  it('returns a 500 problem without the error message when a handler throws', async () => {
    const boom: ServerModule = {
      name: 'boom',
      registerRoutes(app) {
        app.get('/', () => {
          throw new Error('secret internals');
        });
      },
    };
    const { request } = await createTestApp({ modules: [boom] });

    const response = await request('/api/boom');

    expect(await response.clone().text()).not.toContain('secret internals');
    await expectProblem(response, 500, 'internal_error');
  });
});

describe('request log (D33)', () => {
  it('writes one JSON line per request with the correlation id and never the token', async () => {
    const { logLines, request, token } = await createTestApp();

    const response = await request('/api/health', { headers: { 'x-correlation-id': 'corr-123' } });

    expect(response.headers.get('x-correlation-id')).toBe('corr-123');
    expect(logLines).toHaveLength(1);
    expect(JSON.parse(logLines[0] ?? '')).toMatchObject({
      correlation_id: 'corr-123',
      http_method: 'GET',
      http_status: 200,
      msg: 'http_request',
      url_path: '/api/health',
    });
    expect(logLines.join('')).not.toContain(token);
  });

  it('generates a correlation id when the incoming one is absent or invalid', async () => {
    const { request } = await createTestApp();

    const response = await request('/api/health', { headers: { 'x-correlation-id': 'bad id\n' } });

    expect(response.headers.get('x-correlation-id')).toMatch(/^[\w-]{8,}$/);
  });
});
