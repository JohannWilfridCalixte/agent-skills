import { AGENTIC_PLUGIN, AGENTIC_SOURCE } from './catalogue.js';

/** What a tool's own list/status output says about agentic; `unknown` carries why (D18, R4). */
export type ParsedStatus =
  | { readonly reason: string; readonly state: 'unknown' }
  | { readonly state: 'installed'; readonly updateAvailable?: boolean; readonly version?: string }
  | { readonly state: 'not_installed' };

const ANSI = /\u001B\[[0-9;]*m/g;
const COLUMN_GAP = /\s{2,}/;
const GIT_COMMIT = /^[0-9a-f]{4,40}$/;

const unknown = (reason: string) => ({ reason, state: 'unknown' }) as const satisfies ParsedStatus;
const NOT_INSTALLED = { state: 'not_installed' } as const satisfies ParsedStatus;

/** `claude plugin list --json`: a list of `{id, version, ...}`; `updateAvailable` only when the entry reports a boolean. */
export function parseClaudePluginList(stdout: string) {
  const document = parseJson(stdout);
  if (!Array.isArray(document)) return unknown('claude plugin list --json did not print a JSON list');
  const entry: unknown = document.find((item: unknown) => isRecord(item) && item['id'] === AGENTIC_PLUGIN);
  if (!isRecord(entry)) return NOT_INSTALLED;
  const version = entry['version'];
  const updateAvailable = entry['updateAvailable'];
  return {
    state: 'installed',
    ...(typeof updateAvailable === 'boolean' ? { updateAvailable } : {}),
    ...(typeof version === 'string' && version !== '' ? { version } : {}),
  } satisfies ParsedStatus;
}

/** `codex plugin list`: per-marketplace tables of `PLUGIN  STATUS  VERSION  SOURCE` columns. */
export function parseCodexPluginList(stdout: string) {
  const lines = stdout.replace(ANSI, '').split('\n');
  if (!lines.some((line) => line.trimStart().startsWith('PLUGIN') && line.includes('STATUS'))) return unknown('codex plugin list printed no plugin table');
  const row = lines.find((line) => line.trimStart().startsWith(`${AGENTIC_PLUGIN} `));
  if (row === undefined) return NOT_INSTALLED;
  const [, status = '', version] = row.trim().split(COLUMN_GAP);
  if (status.startsWith('not installed')) return NOT_INSTALLED;
  if (!status.startsWith('installed')) return unknown(`codex plugin list status "${status}" not recognised`);
  const columns = row.trim().split(COLUMN_GAP).length;
  return { state: 'installed', ...(columns >= 4 && version !== undefined ? { version } : {}) } satisfies ParsedStatus;
}

/** `git rev-parse --short HEAD` in the Cursor clone: installed at that commit. */
export function parseGitHead(stdout: string) {
  const commit = stdout.trim();
  return GIT_COMMIT.test(commit) ? ({ state: 'installed', version: commit } satisfies ParsedStatus) : unknown('git rev-parse printed no commit');
}

/** `npx skills list --json`: installed when any listed skill comes from the agent-skills source. */
export function parseSkillsList(stdout: string) {
  const document = parseJson(stdout);
  if (!Array.isArray(document)) return unknown('skills list --json did not print a JSON list');
  const found = document.some((item: unknown) => isRecord(item) && typeof item['source'] === 'string' && item['source'].toLowerCase() === AGENTIC_SOURCE.toLowerCase());
  return found ? ({ state: 'installed' } satisfies ParsedStatus) : NOT_INSTALLED;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null;
