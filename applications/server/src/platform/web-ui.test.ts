import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { createTestApp } from './testing/test-app.js';
import { WEB_UI_SHELL } from './web-ui.js';

let root = '';
let webRoot = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentic-web-'));
  webRoot = join(root, 'client');
  mkdirSync(join(webRoot, 'assets'), { recursive: true });
  writeFileSync(join(webRoot, WEB_UI_SHELL), '<!doctype html><title>agentic</title>');
  writeFileSync(join(webRoot, 'assets', 'app.js'), 'console.log("app");');
  writeFileSync(join(root, 'secret.txt'), 'outside the web root');
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe('web UI static serving (AC1)', () => {
  it('serves the SPA shell at /', async () => {
    const { request } = await createTestApp({ webRoot });

    const response = await request('/');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('<title>agentic</title>');
  });

  it('serves a built asset with its content type', async () => {
    const { request } = await createTestApp({ webRoot });

    const response = await request('/assets/app.js');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('javascript');
    expect(await response.text()).toBe('console.log("app");');
  });

  it('falls back to the shell for an unknown client route', async () => {
    const { request } = await createTestApp({ webRoot });

    const response = await request('/projects/abc/config');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>agentic</title>');
  });

  it('answers an unknown /api path with a 404 problem, not the shell', async () => {
    const { request } = await createTestApp({ webRoot });

    const response = await request('/api/nope');

    expect(response.status).toBe(404);
    expect(((await response.json()) as { type: string }).type).toBe('not_found');
  });

  it.each(['/..%2fsecret.txt', '/..%2f..%2fetc%2fpasswd', '/assets/..%2f..%2fsecret.txt', '/%2e%2e/secret.txt'])('never serves a file outside the web root for %s', async (path) => {
    const { request } = await createTestApp({ webRoot });

    const body = await (await request(path)).text();

    expect(body).not.toContain('outside the web root');
    expect(body).not.toContain('root:');
  });

  it('still rejects a foreign Host', async () => {
    const { request } = await createTestApp({ webRoot });

    expect((await request('/', { headers: { host: 'evil.example:8787' } })).status).toBe(403);
  });

  it('still rejects a foreign Origin', async () => {
    const { request } = await createTestApp({ webRoot });

    expect((await request('/', { headers: { origin: 'http://evil.example' } })).status).toBe(403);
  });

  it('answers / with a 404 problem when no build output is configured', async () => {
    const { request } = await createTestApp();

    expect((await request('/')).status).toBe(404);
  });
});
