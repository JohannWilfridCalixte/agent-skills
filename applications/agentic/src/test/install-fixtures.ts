import type { RunEvent } from '@agentic/contract-http/runs';

import { json } from './fetch-stub';

const encoder = new TextEncoder();

const frame = (event: RunEvent) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

/** A complete `text/event-stream` response carrying `events` in order. */
export const sseResponse = (events: readonly RunEvent[]) => new Response(events.map(frame).join(''), { headers: { 'content-type': 'text/event-stream' } });

/** An event stream that delivers `events`, then drops (the connection errors). */
export function droppingSseResponse(events: readonly RunEvent[]) {
  let sent = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) {
        controller.error(new TypeError('network connection lost'));
        return;
      }
      sent = true;
      controller.enqueue(encoder.encode(events.map(frame).join('')));
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

export const harnessesResponse = () =>
  json({
    harnesses: [
      { cli: { found: true, version: '1.2.0' }, configFolder: true, harness: 'claude', present: true, reason: 'claude CLI 1.2.0 found' },
      { cli: { found: false }, configFolder: false, harness: 'codex', present: false, reason: 'codex CLI not on PATH and no ~/.codex' },
      { cli: { found: false }, configFolder: true, harness: 'cursor', present: true, reason: '~/.cursor exists' },
    ],
  });

export const runSummary = (status: 'cancelled' | 'failed' | 'running' | 'succeeded', exitCode?: number) => ({
  id: 'run-1',
  startedAt: '2026-11-03T10:00:00.000Z',
  status,
  ...(exitCode === undefined ? {} : { exitCode, finishedAt: '2026-11-03T10:00:05.000Z' }),
});

export const claudePluginInstalled = { available: true, harness: 'claude', method: 'plugin', scope: 'global', state: 'installed', version: '0.4.0' };
