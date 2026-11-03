export type UnreadableReason = 'invalid_json' | 'missing_state' | 'not_an_object';

/** Summary of `state.json`, or why it could not be read (the item still lists, AC20). */
export type WorkItemState =
  | {
    readonly phase: null | string;
    readonly readable: true;
    readonly status: null | string;
    readonly title: null | string;
    readonly updated: null | string;
  }
  | { readonly readable: false; readonly reason: UnreadableReason };

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (record: Readonly<Record<string, unknown>>, key: string) => {
  const value = record[key];
  return typeof value === 'string' ? value : null;
};

/** Never throws: a half-written file reads as unreadable. */
export function parseState(raw: string | undefined): WorkItemState {
  if (raw === undefined) return { readable: false, reason: 'missing_state' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { readable: false, reason: 'invalid_json' };
  }
  if (!isRecord(json)) return { readable: false, reason: 'not_an_object' };
  return { phase: text(json, 'phase'), readable: true, status: text(json, 'status'), title: text(json, 'title'), updated: text(json, 'updated') };
}

/** `updated`, else the `YYYYMMDD` date prefix of the slug as `YYYY-MM-DD`, else empty: comparable ISO-like keys. */
export function recencyKey(slug: string, state: WorkItemState) {
  if (state.readable && state.updated !== null) return state.updated;
  const date = /^(\d{4})(\d{2})(\d{2})/.exec(slug);
  return date === null ? '' : `${date[1] ?? ''}-${date[2] ?? ''}-${date[3] ?? ''}`;
}
