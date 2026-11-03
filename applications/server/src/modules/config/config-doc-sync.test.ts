/**
 * Docs sync (D29): `domain-config` duplicates the contract in `config.md`; this fails when they diverge.
 * The doc is only read, never written.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

import {
  BUILT_IN_PROFILES,
  CONFIG_FIELDS,
  DEFAULT_LIMITS,
  DEFAULT_REVIEWERS,
  FIELD_DEFAULTS,
  ROUTING_DEFAULTS,
  STEP_DEFAULTS,
} from '@agentic/domain-config';

const REPO_ROOT = join(import.meta.dir, '../../../../..');
const CONFIG_DOC = 'skills/core/agentic-use-workflow/references/config.md';

/** The parts of the contract both sides state, in one comparable shape. */
interface Contract {
  readonly fieldDefaults: Readonly<Record<string, string>>;
  readonly limits: Readonly<Record<string, number>>;
  readonly profiles: Readonly<Record<string, { readonly detect: readonly string[]; readonly skills: readonly string[] }>>;
  readonly reviewers: readonly string[];
  readonly routing: Readonly<Record<string, { readonly claude: string; readonly codex: string; readonly cursor: string; readonly effort: string }>>;
  readonly steps: Readonly<Record<string, string>>;
}

const unquote = (cell: string) => cell.replaceAll('`', '').trim();
const list = (cell: string) => cell.split(',').map(unquote).filter((item) => item.length > 0);

function contractFromDoc(markdown: string): Contract {
  const fieldDefaults = Object.fromEntries(tableRows(section(markdown, '## Fields')).map(([field = '', , fallback = '']) => [unquote(field), unquote(fallback)]));
  const profiles = Object.fromEntries(
    tableRows(section(markdown, '### Built-in profiles')).map(([name = '', detect = '', skills = '']) => [unquote(name), { detect: list(detect), skills: list(skills) }]),
  );
  const reviewerLine = section(markdown, '### Default reviewers').find((line) => line.startsWith('`['));
  if (reviewerLine === undefined) throw new Error('config.md: default reviewers list not found');
  const reviewers: unknown = JSON.parse(unquote(reviewerLine));
  if (!Array.isArray(reviewers)) throw new Error('config.md: default reviewers is not a list');
  const steps = Object.fromEntries(tableRows(section(markdown, '## Built-in step defaults')).map(([key = '', , fallback = '']) => [unquote(key), unquote(fallback)]));
  const routing = Object.fromEntries(
    tableRows(section(markdown, '### Routing keys')).map(([key = '', , cursor = '', claude = '', codex = '', effort = '']) => [
      unquote(key),
      { claude: unquote(claude), codex: unquote(codex), cursor: unquote(cursor), effort: unquote(effort) },
    ]),
  );
  const limits = Object.fromEntries(tableRows(section(markdown, '## Limits')).map(([key = '', fallback = '']) => [unquote(key), Number(unquote(fallback))]));
  return { fieldDefaults, limits, profiles, reviewers: reviewers.map(String), routing, steps };
}

/** Lines under a heading, up to the next heading of the same or a higher level. */
function section(markdown: string, heading: string) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) throw new Error(`config.md: heading "${heading}" not found`);
  const level = heading.indexOf(' ');
  const end = lines.findIndex((line, index) => index > start && /^#+ /.test(line) && line.indexOf(' ') <= level);
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

/** Body rows of the first table in a section, as trimmed cells. */
function tableRows(lines: readonly string[]) {
  const isRow = (line: string) => line.trim().startsWith('|');
  const start = lines.findIndex(isRow);
  if (start === -1) throw new Error('config.md: table not found');
  const end = lines.findIndex((line, index) => index > start && !isRow(line));
  const table = lines.slice(start, end === -1 ? undefined : end);
  return table.slice(2).map((line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim()));
}

const stringify = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));

/** What `domain-config` encodes, written the way `config.md` writes it. */
function contractFromCode(): Contract {
  const below: Readonly<Record<string, string>> = { limits: 'see below', profiles: 'built-ins below', reviewers: 'see below', steps: '{}' };
  const fieldDefaults = Object.fromEntries(
    CONFIG_FIELDS.map((field) => (field === 'knowledge' ? 'knowledge.root' : field)).map((field) => [
      field,
      below[field] ?? stringify(FIELD_DEFAULTS[field as keyof typeof FIELD_DEFAULTS]),
    ]),
  );
  return {
    fieldDefaults,
    limits: DEFAULT_LIMITS,
    profiles: Object.fromEntries(BUILT_IN_PROFILES.map(({ detect = [], name, skills }) => [name, { detect, skills }])),
    reviewers: DEFAULT_REVIEWERS,
    routing: Object.fromEntries(Object.entries(ROUTING_DEFAULTS).map(([key, { effort, models }]) => [key, { ...models, effort }])),
    steps: Object.fromEntries(
      Object.entries(STEP_DEFAULTS).map(([key, step]) => [key, step.kind === 'routing' ? `as ${step.as}` : `${step.model} / ${step.effort}`]),
    ),
  };
}

/** One message per diverging section; empty when doc and code agree. */
function divergences(doc: Contract, code: Contract) {
  return (Object.keys(code) as (keyof Contract)[])
    .filter((key) => JSON.stringify(sortKeys(doc[key])) !== JSON.stringify(sortKeys(code[key])))
    .map((key) => `${key}: config.md ${JSON.stringify(sortKeys(doc[key]))} != domain-config ${JSON.stringify(sortKeys(code[key]))}`);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value) || typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]));
}

const readDoc = () => readFileSync(join(REPO_ROOT, CONFIG_DOC), 'utf8');

describe('config.md sync (D29, AC3)', () => {
  it('domain-config defaults, fields, step keys, routing keys and limits match config.md', () => {
    expect(divergences(contractFromDoc(readDoc()), contractFromCode())).toEqual([]);
  });

  it('fails on a deliberate mismatch in the doc', () => {
    const fixture = readDoc().replace('| `review.iterations` | 3 |', '| `review.iterations` | 4 |').replace('| `tickets` | subagent | fast / low |', '| `tickets` | subagent | code / low |');

    expect(divergences(contractFromDoc(fixture), contractFromCode()).map((message) => message.split(':')[0])).toEqual(['limits', 'steps']);
  });

  it('fails on a deliberate mismatch in the code', () => {
    const code = contractFromCode();
    const drifted = { ...code, fieldDefaults: { ...code.fieldDefaults, output: '.agentic/items' }, reviewers: code.reviewers.slice(1) };

    expect(divergences(contractFromDoc(readDoc()), drifted).map((message) => message.split(':')[0])).toEqual(['fieldDefaults', 'reviewers']);
  });
});
