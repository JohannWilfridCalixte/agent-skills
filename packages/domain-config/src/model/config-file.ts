import type { Result } from '@agentic/kernel-result';

import type { Harness, Profile } from './defaults.js';

import { err, ok } from '@agentic/kernel-result';

import { CONFIG_FIELDS, HARNESSES } from './defaults.js';

/**
 * A parsed config file. `raw` is the file's object untouched (unknown keys included, never dropped);
 * `unknownKeys` flags them as dotted paths (`review.fix`, `knowledge.extra`, `steps.claude.grill.temperature`).
 */
export interface ConfigFile {
  readonly raw: Readonly<Record<string, unknown>>;
  readonly unknownKeys: readonly string[];
  readonly values: ConfigValues;
}

export interface ConfigIssue {
  readonly message: string;
  /** Dotted path of the field, e.g. `limits.review.iterations` or `steps.claude.implement.model`. */
  readonly path: string;
}

/** Known fields of one config file, each present only when the file sets it. */
export interface ConfigValues {
  readonly commitWork?: boolean;
  readonly knowledge?: { readonly root?: string };
  readonly limits?: Readonly<Record<string, number>>;
  readonly output?: string;
  readonly profiles?: readonly Profile[];
  readonly reviewers?: readonly string[];
  readonly selectedProfiles?: readonly string[];
  readonly steps?: Readonly<Partial<Record<Harness, Readonly<Record<string, StepEntry>>>>>;
  readonly worktrees?: string;
}

export interface StepEntry {
  readonly effort?: string;
  readonly harness?: Harness;
  readonly model?: string;
}

export const EMPTY_CONFIG_FILE: ConfigFile = { raw: {}, unknownKeys: [], values: {} };

const STEP_ENTRY_FIELDS = new Set(['effort', 'harness', 'model']);
const PROFILE_FIELDS = new Set(['detect', 'name', 'skills']);
const KNOWN_FIELDS = new Set<string>(CONFIG_FIELDS);

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isHarness = (value: unknown): value is Harness => HARNESSES.includes(value as Harness);

/** Collects issues and unknown keys while reading one file. */
class Reader {
  readonly issues: ConfigIssue[] = [];
  readonly unknownKeys: string[] = [];

  issue(path: string, message: string) {
    this.issues.push({ message, path });
  }

  knowledge(value: unknown) {
    if (!isObject(value)) {
      this.issue('knowledge', 'Expected an object');
      return undefined;
    }
    this.flagUnknown('knowledge', value, new Set(['root']));
    if (value['root'] === undefined) return {};
    const root = this.string('knowledge.root', value['root']);
    return root === undefined ? undefined : { root };
  }

  limits(value: unknown) {
    if (!isObject(value)) {
      this.issue('limits', 'Expected an object of flat dotted keys to numbers');
      return undefined;
    }
    const limits: Record<string, number> = {};
    for (const [key, limit] of Object.entries(value)) {
      if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 0) {
        this.issue(`limits.${key}`, 'Expected a non-negative number');
        continue;
      }
      limits[key] = limit;
    }
    return limits;
  }

  profiles(value: unknown) {
    if (!Array.isArray(value)) {
      this.issue('profiles', 'Expected an array of {name, detect?, skills}');
      return undefined;
    }
    const profiles: Profile[] = [];
    for (const [index, item] of value.entries()) {
      const path = `profiles.${String(index)}`;
      if (!isObject(item)) {
        this.issue(path, 'Expected an object {name, detect?, skills}');
        continue;
      }
      this.flagUnknown(path, item, PROFILE_FIELDS);
      const name = this.string(`${path}.name`, item['name']);
      const skills = this.strings(`${path}.skills`, item['skills']);
      const detect = item['detect'] === undefined ? undefined : this.strings(`${path}.detect`, item['detect']);
      if (name === undefined || skills === undefined) continue;
      profiles.push(detect === undefined ? { name, skills } : { detect, name, skills });
    }
    return profiles;
  }

  steps(value: unknown) {
    if (!isObject(value)) {
      this.issue('steps', 'Expected an object keyed by harness (cursor, claude, codex)');
      return undefined;
    }
    const steps: Partial<Record<Harness, Record<string, StepEntry>>> = {};
    for (const [harness, entries] of Object.entries(value)) {
      if (!isHarness(harness)) {
        this.issue(`steps.${harness}`, `Unknown harness; expected one of ${HARNESSES.join(', ')}`);
        continue;
      }
      if (!isObject(entries)) {
        this.issue(`steps.${harness}`, 'Expected an object keyed by step key');
        continue;
      }
      steps[harness] = this.stepEntries(harness, entries);
    }
    return steps;
  }

  string(path: string, value: unknown) {
    if (typeof value === 'string') return value;
    this.issue(path, 'Expected a string');
    return undefined;
  }

  strings(path: string, value: unknown) {
    if (isStringArray(value)) return value;
    this.issue(path, 'Expected an array of strings');
    return undefined;
  }

  private flagUnknown(path: string, value: Json, known: ReadonlySet<string>) {
    for (const key of Object.keys(value)) if (!known.has(key)) this.unknownKeys.push(`${path}.${key}`);
  }

  private stepEntries(harness: Harness, entries: Json) {
    const result: Record<string, StepEntry> = {};
    for (const [key, entry] of Object.entries(entries)) {
      const path = `steps.${harness}.${key}`;
      if (!isObject(entry)) {
        this.issue(path, 'Expected an object {harness?, model?, effort?}');
        continue;
      }
      this.flagUnknown(path, entry, STEP_ENTRY_FIELDS);
      const parsed: { effort?: string; harness?: Harness; model?: string } = {};
      if (entry['harness'] !== undefined) {
        if (isHarness(entry['harness'])) parsed.harness = entry['harness'];
        else this.issue(`${path}.harness`, `Expected one of ${HARNESSES.join(', ')}`);
      }
      const model = entry['model'] === undefined ? undefined : this.string(`${path}.model`, entry['model']);
      const effort = entry['effort'] === undefined ? undefined : this.string(`${path}.effort`, entry['effort']);
      if (model !== undefined) parsed.model = model;
      if (effort !== undefined) parsed.effort = effort;
      result[key] = parsed;
    }
    return result;
  }
}

/** Validates a parsed JSON value against the config file schema. Unknown keys are kept in `raw` and flagged, never an error. */
export function parseConfigFile(raw: unknown): Result<ConfigFile, readonly ConfigIssue[]> {
  if (!isObject(raw)) return err([{ message: 'Expected a JSON object', path: '' }]);
  const reader = new Reader();
  const values: { -readonly [K in keyof ConfigValues]: ConfigValues[K] } = {};

  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case 'commitWork': {
        if (typeof value === 'boolean') values.commitWork = value;
        else reader.issue(key, 'Expected a boolean');
        break;
      }
      case 'knowledge': {
        const knowledge = reader.knowledge(value);
        if (knowledge !== undefined) values.knowledge = knowledge;
        break;
      }
      case 'limits': {
        const limits = reader.limits(value);
        if (limits !== undefined) values.limits = limits;
        break;
      }
      case 'output':
      case 'worktrees': {
        const text = reader.string(key, value);
        if (text !== undefined) values[key] = text;
        break;
      }
      case 'profiles': {
        const profiles = reader.profiles(value);
        if (profiles !== undefined) values.profiles = profiles;
        break;
      }
      case 'reviewers':
      case 'selectedProfiles': {
        const list = reader.strings(key, value);
        if (list !== undefined) values[key] = list;
        break;
      }
      case 'steps': {
        const steps = reader.steps(value);
        if (steps !== undefined) values.steps = steps;
        break;
      }
      default: {
        if (!KNOWN_FIELDS.has(key)) reader.unknownKeys.push(key);
      }
    }
  }

  if (reader.issues.length > 0) return err(reader.issues);
  return ok({ raw, unknownKeys: reader.unknownKeys, values });
}
