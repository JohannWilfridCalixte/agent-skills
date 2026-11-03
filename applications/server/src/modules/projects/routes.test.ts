import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { ProblemDetails } from '@agentic/contract-http/problem';
import { Project, ProjectList } from '@agentic/contract-http/projects';

import { createTestApp } from '../../platform/testing/test-app.js';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentic-projects-'));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const addRequest = (path: string) => ({
  body: JSON.stringify({ path }),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
});

async function expectProblem(response: Response, status: number, type: string) {
  expect(response.status).toBe(status);
  expect(ProblemDetails.parse(await response.json()).type).toBe(type);
}

describe('/api/projects (AC2)', () => {
  it('adds a folder and lists it', async () => {
    const { request } = await createTestApp();
    const folder = join(root, 'app');
    mkdirSync(folder);

    const added = await request('/api/projects', addRequest(folder));
    expect(added.status).toBe(201);
    const project = Project.parse(await added.json());
    expect(project.path).toBe(folder);

    const listed = ProjectList.parse(await (await request('/api/projects')).json());
    expect(listed.projects).toEqual([project]);
  });

  it('rejects a relative path', async () => {
    const { request } = await createTestApp();

    await expectProblem(await request('/api/projects', addRequest('relative/app')), 422, 'path_not_absolute');
  });

  it('rejects a missing path', async () => {
    const { request } = await createTestApp();

    await expectProblem(await request('/api/projects', addRequest(join(root, 'missing'))), 422, 'path_not_found');
  });

  it('rejects a file', async () => {
    const { request } = await createTestApp();
    const file = join(root, 'file.txt');
    writeFileSync(file, 'x');

    await expectProblem(await request('/api/projects', addRequest(file)), 422, 'path_not_directory');
  });

  it('rejects a duplicate', async () => {
    const { request } = await createTestApp();
    await request('/api/projects', addRequest(root));

    await expectProblem(await request('/api/projects', addRequest(`${root}/`)), 409, 'project_already_known');
  });

  it('rejects a body without a path', async () => {
    const { request } = await createTestApp();

    const response = await request('/api/projects', { body: '{}', headers: { 'content-type': 'application/json' }, method: 'POST' });

    await expectProblem(response, 422, 'validation_failed');
  });

  it('requires the token to add', async () => {
    const { request } = await createTestApp();

    const response = await request('/api/projects', { ...addRequest(root), headers: { 'authorization': '', 'content-type': 'application/json' } });

    expect(response.status).toBe(401);
    expect(ProjectList.parse(await (await request('/api/projects')).json()).projects).toEqual([]);
  });

  it('removes the registry row and leaves the project files untouched', async () => {
    const { request } = await createTestApp();
    const marker = join(root, 'keep.txt');
    writeFileSync(marker, 'keep');
    const project = Project.parse(await (await request('/api/projects', addRequest(root))).json());

    const removed = await request(`/api/projects/${project.id}`, { method: 'DELETE' });

    expect(removed.status).toBe(204);
    expect(ProjectList.parse(await (await request('/api/projects')).json()).projects).toEqual([]);
    expect(existsSync(marker)).toBe(true);
  });

  it('answers 404 when removing an unknown project', async () => {
    const { request } = await createTestApp();

    await expectProblem(await request('/api/projects/nope', { method: 'DELETE' }), 404, 'project_not_found');
  });
});
