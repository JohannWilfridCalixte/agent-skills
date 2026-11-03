export interface SseFrame {
  readonly data: string;
  readonly event: string;
  readonly id?: string;
}

const DEFAULT_EVENT = 'message';

/**
 * Incremental `text/event-stream` parser (WHATWG HTML §9.2): feed decoded chunks, get complete frames.
 * Lines end with LF or CRLF; `retry:` and comments are ignored.
 */
export function createSseParser() {
  let buffer = '';
  let dataLines: string[] = [];
  let event = '';
  let lastEventId: string | undefined;

  function dispatch() {
    const frame =
      lastEventId === undefined
        ? { data: dataLines.join('\n'), event: event || DEFAULT_EVENT }
        : { data: dataLines.join('\n'), event: event || DEFAULT_EVENT, id: lastEventId };
    dataLines = [];
    event = '';

    return frame satisfies SseFrame;
  }

  function processField(field: string, value: string) {
    switch (field) {
      case 'data': {
        dataLines.push(value);
        break;
      }
      case 'event': {
        event = value;
        break;
      }
      case 'id': {
        if (!value.includes('\0')) lastEventId = value;
        break;
      }
      default: {
        break;
      }
    }
  }

  function processLine(line: string, frames: SseFrame[]) {
    if (line === '') {
      if (dataLines.length > 0) frames.push(dispatch());
      else event = '';
      return;
    }
    if (line.startsWith(':')) return;

    const colon = line.indexOf(':');
    if (colon === -1) {
      processField(line, '');
      return;
    }

    const value = line.slice(colon + 1);
    processField(line.slice(0, colon), value.startsWith(' ') ? value.slice(1) : value);
  }

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      const frames: SseFrame[] = [];
      for (const line of lines) processLine(line.endsWith('\r') ? line.slice(0, -1) : line, frames);

      return frames;
    },
  };
}
