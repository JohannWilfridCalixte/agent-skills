/** Receives one serialized JSON line (no trailing newline). */
export type LogSink = (line: string) => void;

export const stdoutSink: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};

export type LogFields = Readonly<Record<string, boolean | null | number | string | undefined>>;

/** Required on every line (agentic-write-instrumented-code), resolved once at startup. */
export interface ServiceFields {
  readonly environment: string;
  readonly service_name: string;
  readonly service_revision: string;
}

export const SERVICE_NAME = 'agentic-server';

export type Logger = ReturnType<typeof createLogger>;

const MAX_STACK_CHARS = 2000;
const MAX_STACK_FRAMES = 10;
const MAX_MESSAGE_CHARS = 500;
const SECRETS = [/(bearer\s+)\S+/giu, /((?:token|secret|password|api[-_]?key)\s*[=:]\s*)\S+/giu, /\b(?:gh[pousr]_\w{20,}|sk-[\w-]{20,})\b/gu];

/**
 * The one structured JSON logger (D33): `{ level, message, timestamp, service_name, service_revision, environment, ...fields }`,
 * snake_case fields. Callers pass only non-secret fields: never headers, tokens or env values.
 */
export function createLogger(sink: LogSink, service: ServiceFields) {
  const write = (level: 'error' | 'info' | 'warn', message: string, fields: LogFields) => {
    sink(JSON.stringify({ ...fields, ...service, level, message, timestamp: new Date().toISOString() }));
  };
  return {
    error: (message: string, fields: LogFields = {}) => {
      write('error', message, fields);
    },
    info: (message: string, fields: LogFields = {}) => {
      write('info', message, fields);
    },
    warn: (message: string, fields: LogFields = {}) => {
      write('warn', message, fields);
    },
  };
}

/** `error_name`, a redacted bounded `error_message` and a redacted bounded `stack` (JSON-escaped, so one line). */
export function errorFields(error: unknown) {
  if (!(error instanceof Error)) return { error_message: redactText(String(error)).slice(0, MAX_MESSAGE_CHARS), error_name: 'NonError' };
  const stack = (error.stack ?? '').split('\n').slice(0, MAX_STACK_FRAMES + 1).join('\n');
  return { error_message: redactText(error.message).slice(0, MAX_MESSAGE_CHARS), error_name: error.name, stack: redactText(stack).slice(0, MAX_STACK_CHARS) };
}

/** Replaces bearer tokens, `token=...`-style assignments and known key shapes. */
export function redactText(text: string) {
  return SECRETS.reduce((redacted, pattern) => redacted.replace(pattern, (match, prefix?: unknown) => (typeof prefix === 'string' ? `${prefix}[REDACTED]` : '[REDACTED]')), text);
}
