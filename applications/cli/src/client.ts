import type { z } from 'zod';

import { join } from 'node:path';

import { z as zod } from 'zod';

import { ProblemDetails } from '@agentic/contract-http/problem';
import { RunEvent } from '@agentic/contract-http/runs';

export const EXIT_FAILURE = 1;
export const EXIT_NOT_RUNNING = 3;
export const NOT_RUNNING_MESSAGE = 'Server not running. Run `agentic serve` first.';

export interface ClientIo {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fetch: (input: string, init?: RequestInit) => Promise<Response>;
  readonly readFile: (path: string) => Promise<string>;
}

/** Ends the command with `code`, printing `message` on stderr. Thrown only inside the CLI and caught by `runCli`. */
export class CliFailure extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

const notRunning = () => new CliFailure(EXIT_NOT_RUNNING, NOT_RUNNING_MESSAGE);

const ServeFile = zod.object({ port: zod.int().min(1).max(65_535), token: zod.string().min(1) });
const Port = zod.coerce.number().int().min(1).max(65_535);

export type Client = ReturnType<typeof createClient>;

/** Port: `--port`, then AGENTIC_PORT, then serve.json; token: AGENTIC_TOKEN, then serve.json. Either missing → not running. */
export async function connect(io: ClientIo, portFlag: string | undefined) {
  const file = await readServeFile(io);
  const port = Port.safeParse(portFlag ?? io.env['AGENTIC_PORT'] ?? file?.port);
  const token = io.env['AGENTIC_TOKEN'] ?? file?.token;
  if (!port.success || token === undefined) throw notRunning();
  return createClient(io, `http://127.0.0.1:${String(port.data)}`, token);
}

function createClient(io: ClientIo, origin: string, token: string) {
  const send = async (method: string, path: string, body?: unknown) => {
    const headers = new Headers({ accept: 'application/json', authorization: `Bearer ${token}` });
    if (body !== undefined) headers.set('content-type', 'application/json');
    try {
      return await io.fetch(`${origin}${path}`, { headers, method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch {
      throw notRunning();
    }
  };

  const request = async <Schema extends z.ZodType>(method: string, path: string, schema: Schema, body?: unknown) => {
    const response = await send(method, path, body);
    const json: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw new CliFailure(EXIT_FAILURE, describeProblem(response.status, json));
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new CliFailure(EXIT_FAILURE, `Unexpected response from ${method} ${path}; is the server the same version as the CLI?`);
    return parsed.data;
  };

  /** Yields the validated events of `GET /api/runs/:id/events` until the server closes the stream. */
  async function* events(runId: string) {
    const response = await send('GET', `/api/runs/${encodeURIComponent(runId)}/events`);
    if (!response.ok || response.body === null) throw new CliFailure(EXIT_FAILURE, describeProblem(response.status, await response.json().catch(() => undefined)));
    let buffer = '';
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      buffer += read.value.replaceAll('\r\n', '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const event = parseSseBlock(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (event !== undefined) yield event;
        boundary = buffer.indexOf('\n\n');
      }
    }
  }

  return {
    delete: async <Schema extends z.ZodType>(path: string, schema: Schema) => request('DELETE', path, schema),
    events,
    get: async <Schema extends z.ZodType>(path: string, schema: Schema) => request('GET', path, schema),
    post: async <Schema extends z.ZodType>(path: string, schema: Schema, body?: unknown) => request('POST', path, schema, body),
    put: async <Schema extends z.ZodType>(path: string, schema: Schema, body: unknown) => request('PUT', path, schema, body),
  };
}

function describeProblem(status: number, body: unknown) {
  const problem = ProblemDetails.safeParse(body);
  if (!problem.success) return `Request failed with HTTP ${String(status)}.`;
  const lines = [problem.data.title];
  if (problem.data.detail !== undefined) lines.push(problem.data.detail);
  for (const issue of problem.data.issues ?? []) lines.push(`  ${issue.path === '' ? '(root)' : issue.path}: ${issue.message}`);
  return lines.join('\n');
}

function parseSseBlock(block: string) {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');
  if (data === '') return undefined;
  try {
    const parsed = RunEvent.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function readServeFile(io: ClientIo) {
  const home = io.env['AGENTIC_HOME'] ?? join(io.env['HOME'] ?? '', '.agentic');
  try {
    const parsed = ServeFile.safeParse(JSON.parse(await io.readFile(join(home, 'serve.json'))));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
