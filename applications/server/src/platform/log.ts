/** Receives one serialized JSON line (no trailing newline). */
export type LogSink = (line: string) => void;

export const stdoutSink: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};

export type LogFields = Readonly<Record<string, boolean | null | number | string>>;

export type Logger = ReturnType<typeof createLogger>;

/** Structured JSON logger (D33). Callers pass only non-secret fields: never headers or tokens. */
export function createLogger(sink: LogSink) {
  const write = (level: 'error' | 'info' | 'warn', msg: string, fields: LogFields) => {
    sink(JSON.stringify({ level, msg, ts: new Date().toISOString(), ...fields }));
  };
  return {
    error: (msg: string, fields: LogFields = {}) => {
      write('error', msg, fields);
    },
    info: (msg: string, fields: LogFields = {}) => {
      write('info', msg, fields);
    },
    warn: (msg: string, fields: LogFields = {}) => {
      write('warn', msg, fields);
    },
  };
}
