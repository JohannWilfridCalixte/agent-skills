import type { ApiError } from './api-error';

import { PROBLEM_CONTENT_TYPE, ProblemDetails } from '@agentic/contract-http/problem';
import { RunEvent } from '@agentic/contract-http/runs';
import { err, fromPromise, ok } from '@agentic/kernel-result';

import { createSseParser } from './sse';

/** Structural view of a zod schema, so contract-http schemas can be passed as-is. */
export interface ResponseSchema<T> {
  readonly safeParse: (input: unknown) => ParseFailure | ParseSuccess<T>;
}

interface ParseFailure {
  readonly error: { readonly message: string };
  readonly success: false;
}

interface ParseSuccess<T> {
  readonly data: T;
  readonly success: true;
}

/** For endpoints answering `204 No Content` (or a body the caller ignores). */
export const emptyResponse = {
  safeParse: () => ({ data: undefined, success: true }) as const,
} satisfies ResponseSchema<undefined>;

export type Fetch = (input: string, init: RequestInit) => Promise<Response>;

interface ApiClientConfig {
  readonly baseUrl?: string;
  readonly fetch?: Fetch;
  /** Read on every request, so a token captured after the client was built is still used. */
  readonly getToken: () => string | undefined;
}

type CallOptions = Pick<RequestOptions<unknown>, 'signal'>;

type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

interface RequestOptions<T> {
  readonly body?: unknown;
  readonly method?: HttpMethod;
  readonly schema: ResponseSchema<T>;
  readonly signal?: AbortSignal;
}

const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const networkError = (correlationId: string) => (cause: unknown) =>
  ({ correlationId, message: errorMessage(cause), type: 'network' }) as const satisfies ApiError;

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Every call resolves to a `Result`; it never rejects. The bearer token goes on every request: writes and the GETs that
 * launch a subprocess require it (D28, ADR 0009), pure reads ignore it. Every request carries an `x-correlation-id`.
 */
export function createApiClient({ baseUrl = '/api', fetch = async (input, init) => globalThis.fetch(input, init), getToken }: ApiClientConfig) {
  function headersFor(accept: string) {
    const correlationId = crypto.randomUUID();
    const headers = new Headers({ accept, 'x-correlation-id': correlationId });
    const token = getToken();
    if (token !== undefined && token !== '') headers.set('authorization', `Bearer ${token}`);
    return { correlationId, headers };
  }

  async function request<T>(path: string, { body, method = 'GET', schema, signal }: RequestOptions<T>) {
    const { correlationId, headers } = headersFor('application/json');
    if (body !== undefined) headers.set('content-type', 'application/json');
    const toNetworkError = networkError(correlationId);

    const response = await fromPromise(
      fetch(`${baseUrl}${path}`, { body: body === undefined ? null : JSON.stringify(body), headers, method, signal: signal ?? null }),
      toNetworkError,
    );
    if (!response.ok) return response;

    const text = await fromPromise(response.value.text(), toNetworkError);
    if (!text.ok) return text;

    if (!response.value.ok) return err(toErrorStatus(response.value, text.value, correlationId));

    return toValue(text.value, schema, response.value.status, correlationId);
  }

  /**
   * Streams `GET /runs/:id/events` over fetch (EventSource cannot send the bearer header). Yields one `Result` per
   * event; an error is yielded once and ends the stream.
   */
  async function* subscribeToRun(runId: string, { signal }: CallOptions = {}) {
    const { correlationId, headers } = headersFor('text/event-stream');
    const toNetworkError = networkError(correlationId);

    const response = await fromPromise(
      fetch(`${baseUrl}/runs/${encodeURIComponent(runId)}/events`, { headers, method: 'GET', signal: signal ?? null }),
      toNetworkError,
    );
    if (!response.ok) {
      yield response;
      return;
    }
    if (!response.value.ok || response.value.body === null) {
      const text = await fromPromise(response.value.text(), toNetworkError);
      yield text.ok ? err(toErrorStatus(response.value, text.value, correlationId)) : text;
      return;
    }

    const parser = createSseParser();
    const decoder = new TextDecoder();
    const reader = response.value.body.getReader();
    for (;;) {
      const chunk = await fromPromise(reader.read(), toNetworkError);
      if (!chunk.ok) {
        yield chunk;
        return;
      }
      const text = chunk.value.done ? decoder.decode() : decoder.decode(chunk.value.value, { stream: true });
      for (const frame of parser.push(text)) {
        const event = toValue(frame.data, RunEvent, response.value.status, correlationId);
        yield event;
        if (!event.ok) {
          await reader.cancel();
          return;
        }
      }
      if (chunk.value.done) return;
    }
  }

  return {
    delete: async <T>(path: string, schema: ResponseSchema<T>, options: CallOptions = {}) => request(path, { ...options, method: 'DELETE', schema }),
    get: async <T>(path: string, schema: ResponseSchema<T>, options: CallOptions = {}) => request(path, { ...options, schema }),
    patch: async <T>(path: string, body: unknown, schema: ResponseSchema<T>, options: CallOptions = {}) =>
      request(path, { ...options, body, method: 'PATCH', schema }),
    post: async <T>(path: string, body: unknown, schema: ResponseSchema<T>, options: CallOptions = {}) =>
      request(path, { ...options, body, method: 'POST', schema }),
    put: async <T>(path: string, body: unknown, schema: ResponseSchema<T>, options: CallOptions = {}) =>
      request(path, { ...options, body, method: 'PUT', schema }),
    subscribeToRun,
  };
}

function parseJson(text: string) {
  if (text === '') return ok<unknown>(undefined);
  try {
    return ok<unknown>(JSON.parse(text));
  } catch (cause) {
    return err(errorMessage(cause));
  }
}

function toErrorStatus(response: Response, text: string, correlationId: string) {
  const contentType = response.headers.get('content-type') ?? '';
  const json = contentType.includes(PROBLEM_CONTENT_TYPE) || contentType.includes('json') ? parseJson(text) : undefined;
  const problem = json?.ok === true ? ProblemDetails.safeParse(json.value) : undefined;

  if (problem?.success === true) {
    return { correlationId, problem: problem.data, status: response.status, type: 'problem' } as const satisfies ApiError;
  }
  return { correlationId, status: response.status, type: 'unexpected_status' } as const satisfies ApiError;
}

function toValue<T>(text: string, schema: ResponseSchema<T>, status: number, correlationId: string) {
  const json = parseJson(text);
  if (!json.ok) return err({ correlationId, message: json.error, status, type: 'invalid_body' } as const satisfies ApiError);

  const parsed = schema.safeParse(json.value);
  if (!parsed.success) {
    return err({ correlationId, message: parsed.error.message, status, type: 'invalid_body' } as const satisfies ApiError);
  }
  return ok(parsed.data);
}
