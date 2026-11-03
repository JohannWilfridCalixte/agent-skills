import type { Result } from '@agentic/kernel-result';

import type { ConfigFile, ConfigIssue, ConfigValues } from './config-file.js';
import type { EffectiveConfig } from './effective.js';

import { ok } from '@agentic/kernel-result';

import { EMPTY_CONFIG_FILE, parseConfigFile } from './config-file.js';
import { CONFIG_FIELDS, HARNESSES } from './defaults.js';
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

type Path = readonly (number | string)[];

/**
 * Validates an edited (full or partial) config and reduces it to what the file must hold (D11).
 * A known value is dropped only when removing it leaves the effective config unchanged: against the
 * built-in defaults for the global file (`global` absent), against `global` merged over the defaults for a
 * project file, with the whole-replacement rules of `effective` applied. Unknown keys, top-level or nested in
 * known objects, are copied untouched and flagged.
 */
export function delta(edited: unknown, global?: ConfigFile): Result<ConfigDelta, readonly ConfigIssue[]> {
  const parsed = parseConfigFile(edited);
  if (!parsed.ok) return parsed;
  const { raw, unknownKeys, values } = parsed.value;

  const viewOf = (content: Json) => {
    const file = parseConfigFile(content);
    const layer = file.ok ? file.value : EMPTY_CONFIG_FILE;
    return global === undefined ? effective(layer) : effective(global, layer);
  };
  const target = meaning(viewOf(raw));
  let content: Json = raw;
  for (const path of removablePaths(raw)) {
    const candidate = without(content, path, unknownKeys);
    if (candidate !== undefined && jsonEqual(meaning(viewOf(candidate)), target)) content = candidate;
  }

  const ordered: Record<string, unknown> = {};
  for (const field of CONFIG_FIELDS) if (field in content) ordered[field] = content[field];
  for (const [key, value] of Object.entries(content)) if (!KNOWN.has(key)) ordered[key] = value;
  return ok({ content: ordered, text: serialiseConfig(ordered), unknownKeys, values });
}

/** What agents would use: values without origins; a step without a harness runs on its own harness. */
function meaning(view: EffectiveConfig) {
  const { steps, unknownKeys: _unknownKeys, ...fields } = view;
  const stepValues = HARNESSES.map((harness) =>
    Object.entries(steps[harness])
      .filter(([, step]) => step.effort !== undefined || step.model !== undefined || step.harness !== undefined)
      .map(([key, step]) => [key, step.effort?.value, step.harness?.value ?? harness, step.model?.value]),
  );
  return { fields: stripOrigins(fields), stepValues };
}

function stripOrigins(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripOrigins);
  if (!isObject(value)) return value;
  if ('origin' in value && 'value' in value) return stripOrigins(value['value']);
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, stripOrigins(inner)]));
}

const STEP_LEAVES = ['harness', 'model', 'effort'] as const;

/**
 * Known values to try removing, innermost first, then their container; unknown keys never appear.
 * Whole-replacement fields (`profiles`, scalars, lists) are tried whole; `profiles` also per entry, last first.
 */
function removablePaths(raw: Json): readonly Path[] {
  const paths: Path[] = [];
  for (const field of CONFIG_FIELDS) {
    const value = raw[field];
    if (value === undefined) continue;
    if (field === 'steps' && isObject(value)) {
      for (const harness of HARNESSES) {
        const entries = value[harness];
        if (!isObject(entries)) continue;
        for (const [key, entry] of Object.entries(entries)) {
          if (isObject(entry)) for (const leaf of STEP_LEAVES) if (leaf in entry) paths.push([field, harness, key, leaf]);
          paths.push([field, harness, key]);
        }
        paths.push([field, harness]);
      }
    } else if (field === 'limits' && isObject(value)) {
      for (const key of Object.keys(value)) paths.push([field, key]);
    } else if (field === 'knowledge' && isObject(value)) {
      if ('root' in value) paths.push([field, 'root']);
    } else if (field === 'profiles' && Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) paths.push([field, index]);
    }
    paths.push([field]);
  }
  return paths;
}

/** A copy without the value at `path`; never removes an unknown key, so an object holding one stays. `undefined`: nothing to remove. */
function without(content: Json, path: Path, unknownKeys: readonly string[]): Record<string, unknown> | undefined {
  const parsed: unknown = JSON.parse(JSON.stringify(content));
  if (!isObject(parsed)) return undefined;
  const copy: Record<string, unknown> = { ...parsed };
  let parent: unknown = copy;
  for (const segment of path.slice(0, -1)) parent = isObject(parent) || Array.isArray(parent) ? (parent as Record<number | string, unknown>)[segment] : undefined;
  const last = path.at(-1);
  if (Array.isArray(parent) && typeof last === 'number') {
    parent.splice(last, 1);
    return copy;
  }
  if (!isObject(parent) || typeof last !== 'string' || !(last in parent)) return undefined;
  const target = parent[last];
  const dotted = path.join('.');
  if (isObject(target) && unknownKeys.some((key) => key === dotted || key.startsWith(`${dotted}.`))) return undefined;
  Reflect.deleteProperty(parent, last);
  return copy;
}
