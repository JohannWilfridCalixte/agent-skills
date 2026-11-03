import type { Fetch } from '@/lib/api-client';

export interface RecordedCall {
  readonly authorization: null | string;
  readonly body: unknown;
  readonly method: string;
  readonly url: string;
}

type Handler = (call: RecordedCall) => Promise<Response> | Response;

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status });

export const problemResponse = (status: number, type: string, title: string, detail?: string) =>
  new Response(JSON.stringify({ detail, status, title, type }), { headers: { 'content-type': 'application/problem+json' }, status });

/**
 * A fake server keyed by `"METHOD /path?query"` (path without the `/api` base). A handler may be a list, served in
 * order with the last one repeating. Unrouted requests answer 404 so a missing stub fails loudly.
 */
export function stubFetch(routes: Readonly<Record<string, Handler | readonly Handler[]>>) {
  const calls: RecordedCall[] = [];
  const served = new Map<string, number>();

  const fetch: Fetch = async (input, init) => {
    const headers = new Headers(init.headers);
    const method = init.method ?? 'GET';
    const url = input.replace(/^\/api/u, '');
    const call = {
      authorization: headers.get('authorization'),
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      method,
      url,
    };
    calls.push(call);
    const key = `${method} ${url}`;
    const route = routes[key];
    if (route === undefined) return problemResponse(404, 'not_stubbed', `No stub for ${key}`);
    const handlers = Array.isArray(route) ? (route as readonly Handler[]) : [route as Handler];
    const index = served.get(key) ?? 0;
    served.set(key, index + 1);
    const handler = handlers[Math.min(index, handlers.length - 1)];
    return handler === undefined ? problemResponse(404, 'not_stubbed', key) : handler(call);
  };

  return { calls, fetch };
}
