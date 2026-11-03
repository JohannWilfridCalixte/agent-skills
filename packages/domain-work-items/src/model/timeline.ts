/** Latest events kept from `events.jsonl` (D32). */
export const EVENTS_LIMIT = 1000;
/** Bytes read from the end of `events.jsonl` (D32). */
export const EVENTS_LIMIT_BYTES = 5 * 1024 * 1024;
/** Bytes read from the start of a doc (D32). */
export const DOC_LIMIT_BYTES = 1024 * 1024;

export interface Timeline {
  readonly events: readonly WorkItemEvent[];
  /** Non-empty lines that are not a JSON object. */
  readonly malformed: number;
  /** Older events were left out (byte or count cap). */
  readonly truncated: boolean;
}

export type WorkItemEvent = Readonly<Record<string, unknown>>;

const isEvent = (value: unknown): value is WorkItemEvent => typeof value === 'object' && value !== null && !Array.isArray(value);

const parseLine = (line: string) => {
  try {
    const value: unknown = JSON.parse(line);
    return isEvent(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Parses the tail of `events.jsonl` line by line. When the read was cut (`cut`), the first line is partial
 * and dropped uncounted; a trailing line still being written simply counts as malformed.
 */
export function parseTimeline(text: string, cut: boolean): Timeline {
  const lines = text.split('\n');
  if (cut) lines.shift();
  const events: WorkItemEvent[] = [];
  let malformed = 0;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (parsed === undefined) malformed++;
    else events.push(parsed);
  }
  const overCount = events.length > EVENTS_LIMIT;
  return { events: overCount ? events.slice(-EVENTS_LIMIT) : events, malformed, truncated: cut || overCount };
}

export const EMPTY_TIMELINE: Timeline = { events: [], malformed: 0, truncated: false };
