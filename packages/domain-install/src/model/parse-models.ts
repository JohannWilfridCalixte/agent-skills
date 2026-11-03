/** Claude Code accepts these aliases; it has no command listing models. */
export const CLAUDE_MODEL_ALIASES = ['opus', 'sonnet', 'haiku'] as const;

const ANSI = /\u001B\[[0-9;]*m/g;
const AGENT_MODEL_LINE = /^(\S+) - \S/;

/** `agent models` prints `<id> - <label>` lines between a header and a tip. */
export function parseAgentModels(stdout: string) {
  return stdout
    .replace(ANSI, '')
    .split('\n')
    .map((line) => AGENT_MODEL_LINE.exec(line.trim())?.[1])
    .filter((id) => id !== undefined);
}

/** `codex debug models` prints `{"models":[{"slug":...}]}`; anything else yields no ids. */
export function parseCodexModels(stdout: string) {
  const document = parseJson(stdout);
  if (!isRecord(document) || !Array.isArray(document['models'])) return [];
  return document['models'].flatMap((model: unknown) => (isRecord(model) && typeof model['slug'] === 'string' ? [model['slug']] : []));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null;
