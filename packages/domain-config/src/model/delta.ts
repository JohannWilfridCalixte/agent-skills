import type { Result } from '@agentic/kernel-result';

import type { ConfigIssue, ConfigValues } from './config-file.js';
import type { Harness } from './defaults.js';
import type { EffectiveConfig } from './effective.js';

import { ok } from '@agentic/kernel-result';

import { EMPTY_CONFIG_FILE, parseConfigFile } from './config-file.js';
import { BUILT_IN_PROFILES, CONFIG_FIELDS, HARNESSES } from './defaults.js';
import { effective } from './effective.js';

/** The file content to write for an edited config: only non-default values, unknown keys untouched. */
export interface ConfigDelta {
  /** The object serialised into `text`. */
  readonly content: Readonly<Record<string, unknown>>;
  /** 2-space JSON with a trailing newline. */
  readonly text: string;
  readonly unknownKeys: readonly string[];
  /** Known values as edited, defaults included (for model warnings). */
  readonly values: ConfigValues;
}

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

const KNOWN = new Set<string>(CONFIG_FIELDS);

/** Structural equality of JSON values; object key order does not matter. */
export function jsonEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => jsonEqual(item, right[index]));
  if (isObject(left) && isObject(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => key in right && jsonEqual(left[key], right[key]));
  }
  return left === right;
}

export const serialiseConfig = (content: Json) => `${JSON.stringify(content, null, 2)}\n`;

/**
 * Validates an edited (full or partial) config and reduces it to what the file must hold.
 * A value equal to what `baseline` already gives is dropped even when the file already had it: the file
 * stays minimal (D11). `baseline` is the built-in defaults for the global file, and defaults merged with
 * the global file for a project file, so a project value overriding a global one is kept. Unknown keys, top-level or nested in known objects, are copied untouched and flagged.
 */
export function delta(edited: unknown, baseline: EffectiveConfig = effective(EMPTY_CONFIG_FILE)): Result<ConfigDelta, readonly ConfigIssue[]> {
  const parsed = parseConfigFile(edited);
  if (!parsed.ok) return parsed;
  const { raw, unknownKeys, values } = parsed.value;

  const content: Record<string, unknown> = {};
  for (const field of CONFIG_FIELDS) {
    if (!(field in raw)) continue;
    const reduced = reduceField(field, raw[field], baseline);
    if (reduced !== undefined) content[field] = reduced;
  }
  for (const [key, value] of Object.entries(raw)) if (!KNOWN.has(key)) content[key] = value;

  return ok({ content, text: serialiseConfig(content), unknownKeys, values });
}

const nonEmpty = (value: Json) => (Object.keys(value).length > 0 ? value : undefined);

function reduceField(field: (typeof CONFIG_FIELDS)[number], value: unknown, baseline: EffectiveConfig): unknown {
  switch (field) {
    case 'commitWork':
    case 'output':
    case 'reviewers':
    case 'selectedProfiles':
    case 'worktrees': {
      return jsonEqual(value, baseline[field].value) ? undefined : value;
    }
    case 'knowledge': {
      const { root, ...rest } = value as Json;
      return nonEmpty(root === undefined || root === baseline.knowledge.root.value ? rest : { ...rest, root });
    }
    case 'limits': {
      const entries = Object.entries(value as Json).filter(([key, limit]) => baseline.limits[key]?.value !== limit);
      return nonEmpty(Object.fromEntries(entries));
    }
    case 'profiles': {
      const kept = (value as readonly unknown[]).filter((profile) => !BUILT_IN_PROFILES.some((builtIn) => jsonEqual(builtIn, profile)));
      return kept.length > 0 ? kept : undefined;
    }
    case 'steps': {
      return reduceSteps(value as Json, baseline);
    }
    default: {
      return field satisfies never;
    }
  }
}

function reduceStepEntry(harness: Harness, key: string, entry: Json, baseline: EffectiveConfig) {
  const base = baseline.steps[harness][key] ?? {};
  const kept: Record<string, unknown> = {};
  for (const [field, leaf] of Object.entries(entry)) {
    const inherited = field === 'effort' || field === 'model' || field === 'harness' ? base[field]?.value : undefined;
    const isDefault = field === 'harness' ? leaf === (base.harness?.value ?? harness) : leaf === inherited;
    if (!isDefault) kept[field] = leaf;
  }
  return nonEmpty(kept);
}

function reduceSteps(steps: Json, baseline: EffectiveConfig) {
  const result: Record<string, unknown> = {};
  for (const harness of HARNESSES) {
    const entries = steps[harness];
    if (!isObject(entries)) continue;
    const kept: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(entries)) {
      const reduced = reduceStepEntry(harness, key, entry as Json, baseline);
      if (reduced !== undefined) kept[key] = reduced;
    }
    const harnessSteps = nonEmpty(kept);
    if (harnessSteps !== undefined) result[harness] = harnessSteps;
  }
  return nonEmpty(result);
}
