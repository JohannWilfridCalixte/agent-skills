import type { ConfigFile, ConfigValues, StepEntry } from './config-file.js';
import type { Harness, Profile, RoutingKey } from './defaults.js';

import { BUILT_IN_PROFILES, DEFAULT_LIMITS, FIELD_DEFAULTS, ROUTING_DEFAULTS, STEP_DEFAULTS } from './defaults.js';

/** Every field with its value and origin; `steps` and `limits` carry an origin per leaf. */
export interface EffectiveConfig {
  readonly commitWork: Sourced<boolean>;
  readonly knowledge: { readonly root: Sourced<string> };
  readonly limits: Readonly<Record<string, Sourced<number>>>;
  readonly output: Sourced<string>;
  /** Built-ins with the winning file's profiles added; a same-name profile replaces a built-in. */
  readonly profiles: Sourced<readonly Profile[]>;
  readonly reviewers: Sourced<readonly string[]>;
  readonly selectedProfiles: Sourced<readonly string[]>;
  /** Every harness, with built-in step and routing keys plus any key a file sets. */
  readonly steps: Readonly<Record<Harness, Readonly<Record<string, EffectiveStep>>>>;
  /** Keys the app does not know, kept in the files and flagged as possibly stale. */
  readonly unknownKeys: readonly UnknownKey[];
  readonly worktrees: Sourced<string>;
}

export interface EffectiveStep {
  readonly effort?: Sourced<string>;
  readonly harness?: Sourced<Harness>;
  readonly model?: Sourced<string>;
}

export type Origin = 'default' | 'global' | 'project';

export interface Sourced<T> {
  readonly origin: Origin;
  readonly value: T;
}

export interface UnknownKey {
  readonly path: string;
  readonly scope: 'global' | 'project';
}

interface Layer {
  readonly origin: 'global' | 'project';
  readonly values: ConfigValues;
}

/** The built-in leaves of one step key on one harness (capability class or routing model). */
export function defaultStep(harness: Harness, key: string): EffectiveStep {
  const step = STEP_DEFAULTS[key] ?? (key in ROUTING_DEFAULTS ? { as: key as RoutingKey, kind: 'routing' as const } : undefined);
  if (step === undefined) return {};
  if (step.kind === 'class') return { effort: { origin: 'default', value: step.effort }, model: { origin: 'default', value: step.model } };
  const routing = ROUTING_DEFAULTS[step.as];
  return { effort: { origin: 'default', value: routing.effort }, model: { origin: 'default', value: routing.models[harness] } };
}

/**
 * Merges the global and project files (D3, AC3): project wins; `steps` merge per harness and step key,
 * `limits` per key; any other top-level key present in the project file replaces the global value whole;
 * absent from both → default. Without a project file (global scope) pass only `global`.
 */
export function effective(global: ConfigFile, project?: ConfigFile): EffectiveConfig {
  const layers: Layer[] = [
    ...(project === undefined ? [] : [{ origin: 'project' as const, values: project.values }]),
    { origin: 'global', values: global.values },
  ];
  const profiles = pick(layers, 'profiles');

  return {
    commitWork: whole(layers, 'commitWork', FIELD_DEFAULTS.commitWork),
    knowledge: { root: knowledgeRoot(layers) },
    limits: mergeLimits(layers),
    output: whole(layers, 'output', FIELD_DEFAULTS.output),
    profiles: profiles === undefined ? { origin: 'default', value: BUILT_IN_PROFILES } : { origin: profiles.origin, value: mergeProfiles(profiles.value) },
    reviewers: whole(layers, 'reviewers', FIELD_DEFAULTS.reviewers),
    selectedProfiles: whole(layers, 'selectedProfiles', FIELD_DEFAULTS.selectedProfiles),
    steps: mergeSteps(layers),
    unknownKeys: [
      ...global.unknownKeys.map((path) => ({ path, scope: 'global' as const })),
      ...(project?.unknownKeys ?? []).map((path) => ({ path, scope: 'project' as const })),
    ],
    worktrees: whole(layers, 'worktrees', FIELD_DEFAULTS.worktrees),
  };
}

function knowledgeRoot(layers: readonly Layer[]): Sourced<string> {
  const found = pick(layers, 'knowledge');
  if (found?.value.root === undefined) return { origin: 'default', value: FIELD_DEFAULTS['knowledge.root'] };
  return { origin: found.origin, value: found.value.root };
}

function mergeLimits(layers: readonly Layer[]) {
  const keys = new Set([...Object.keys(DEFAULT_LIMITS), ...layers.flatMap((layer) => Object.keys(layer.values.limits ?? {}))]);
  const limits: Record<string, Sourced<number>> = {};
  for (const key of [...keys].toSorted()) {
    const layer = layers.find((candidate) => candidate.values.limits?.[key] !== undefined);
    const value = layer?.values.limits?.[key];
    if (layer !== undefined && value !== undefined) limits[key] = { origin: layer.origin, value };
    else if (DEFAULT_LIMITS[key] !== undefined) limits[key] = { origin: 'default', value: DEFAULT_LIMITS[key] };
  }
  return limits;
}

function mergeProfiles(configured: readonly Profile[]) {
  const byName = new Map(BUILT_IN_PROFILES.map((profile) => [profile.name, profile]));
  for (const profile of configured) byName.set(profile.name, profile);
  return [...byName.values()];
}

function mergeStep(harness: Harness, key: string, layers: readonly Layer[]): EffectiveStep {
  const base = defaultStep(harness, key);
  const leaf = <F extends keyof StepEntry>(field: F) => {
    for (const layer of layers) {
      const value = layer.values.steps?.[harness]?.[key]?.[field];
      if (value !== undefined) {
        const sourced: Sourced<NonNullable<StepEntry[F]>> = { origin: layer.origin, value };
        return sourced;
      }
    }
    return base[field];
  };
  const harnessLeaf = leaf('harness');
  const model = leaf('model');
  const effort = leaf('effort');
  return {
    ...(effort === undefined ? {} : { effort }),
    ...(harnessLeaf === undefined ? {} : { harness: harnessLeaf }),
    ...(model === undefined ? {} : { model }),
  };
}

function mergeSteps(layers: readonly Layer[]) {
  const builtInKeys = [...Object.keys(STEP_DEFAULTS), ...Object.keys(ROUTING_DEFAULTS)];
  const forHarness = (harness: Harness) => {
    const keys = new Set([...builtInKeys, ...layers.flatMap((layer) => Object.keys(layer.values.steps?.[harness] ?? {}))]);
    return Object.fromEntries([...keys].toSorted().map((key) => [key, mergeStep(harness, key, layers)]));
  };
  const steps: Record<Harness, Record<string, EffectiveStep>> = { claude: forHarness('claude'), codex: forHarness('codex'), cursor: forHarness('cursor') };
  return steps;
}

/** Project first: the first layer that sets a value wins. */
function pick<K extends keyof ConfigValues>(layers: readonly Layer[], key: K) {
  for (const layer of layers) {
    const value = layer.values[key];
    if (value !== undefined) return { origin: layer.origin, value: value as NonNullable<ConfigValues[K]> };
  }
  return undefined;
}

function whole<T>(layers: readonly Layer[], key: keyof ConfigValues, fallback: T): Sourced<T> {
  const found = pick(layers, key);
  return found === undefined ? { origin: 'default', value: fallback } : { origin: found.origin, value: found.value as T };
}
