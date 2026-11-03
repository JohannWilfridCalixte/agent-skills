import type { Harness } from '@agentic/contract-http/config';

/**
 * The edit form's state, all strings so inputs stay controlled. `toEditedConfig` folds it back over the raw file
 * object, so keys the form does not know (possibly stale ones included) are sent back untouched.
 */
export interface ConfigForm {
  readonly commitWork: 'false' | 'inherit' | 'true';
  readonly knowledgeRoot: string;
  /** Flat dotted limit key to the number as typed. */
  readonly limits: Readonly<Record<string, string>>;
  readonly output: string;
  readonly profiles: readonly ProfileForm[];
  readonly reviewers: readonly string[];
  readonly selectedProfiles: readonly string[];
  readonly steps: Readonly<Partial<Record<Harness, Readonly<Record<string, StepForm>>>>>;
  readonly worktrees: string;
}

export interface ProfileForm {
  /** Comma-separated globs. */
  readonly detect: string;
  readonly name: string;
  /** Comma-separated skill names. */
  readonly skills: string;
}

export interface StepForm {
  readonly effort: string;
  readonly model: string;
}

type RawConfig = Readonly<Record<string, unknown>>;

export const HARNESSES = ['cursor', 'claude', 'codex'] as const satisfies readonly Harness[];

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

const asStrings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const splitList = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

export function formFromRaw(raw: RawConfig) {
  const knowledge = isRecord(raw['knowledge']) ? raw['knowledge'] : {};
  const limits = isRecord(raw['limits']) ? raw['limits'] : {};
  const commitWork = typeof raw['commitWork'] === 'boolean' ? (raw['commitWork'] ? 'true' : 'false') : 'inherit';

  return {
    commitWork,
    knowledgeRoot: asString(knowledge['root']),
    limits: Object.fromEntries(Object.entries(limits).map(([key, value]) => [key, typeof value === 'number' ? String(value) : ''])),
    output: asString(raw['output']),
    profiles: (Array.isArray(raw['profiles']) ? raw['profiles'] : []).filter(isRecord).map((profile) => ({
      detect: asStrings(profile['detect']).join(', '),
      name: asString(profile['name']),
      skills: asStrings(profile['skills']).join(', '),
    })),
    reviewers: asStrings(raw['reviewers']),
    selectedProfiles: asStrings(raw['selectedProfiles']),
    steps: stepsFromRaw(raw['steps']),
    worktrees: asString(raw['worktrees']),
  } satisfies ConfigForm;
}

/** The object sent to preview and save: the raw file with the form's fields applied. */
export function toEditedConfig(raw: RawConfig, form: ConfigForm) {
  const edited: Record<string, unknown> = { ...raw };

  setOrDelete(edited, 'output', form.output, form.output === '');
  setOrDelete(edited, 'worktrees', form.worktrees, form.worktrees === '');
  setOrDelete(edited, 'commitWork', form.commitWork === 'true', form.commitWork === 'inherit');

  const knowledge: Record<string, unknown> = isRecord(raw['knowledge']) ? { ...raw['knowledge'] } : {};
  setOrDelete(knowledge, 'root', form.knowledgeRoot, form.knowledgeRoot === '');
  setOrDelete(edited, 'knowledge', knowledge, Object.keys(knowledge).length === 0);

  setList(edited, raw, 'reviewers', form.reviewers.filter((item) => item !== ''));
  setList(edited, raw, 'selectedProfiles', form.selectedProfiles.filter((item) => item !== ''));
  setList(edited, raw, 'profiles', form.profiles.map(toProfile));

  const limits: Record<string, unknown> = isRecord(raw['limits']) ? { ...raw['limits'] } : {};
  for (const [key, text] of Object.entries(form.limits)) {
    const value = Number(text);
    // A non-numeric entry is sent as typed so the server reports it as a field issue.
    setOrDelete(limits, key, Number.isFinite(value) ? value : text, text.trim() === '');
  }
  setOrDelete(edited, 'limits', limits, Object.keys(limits).length === 0);

  const steps = applySteps(raw['steps'], form.steps);
  setOrDelete(edited, 'steps', steps, Object.keys(steps).length === 0);

  return edited;
}

function applySteps(rawSteps: unknown, formSteps: ConfigForm['steps']) {
  const steps: Record<string, unknown> = isRecord(rawSteps) ? { ...rawSteps } : {};
  for (const harness of HARNESSES) {
    const entries = formSteps[harness];
    if (entries === undefined) continue;
    const rawEntries = steps[harness];
    const harnessSteps: Record<string, unknown> = isRecord(rawEntries) ? { ...rawEntries } : {};
    for (const [key, step] of Object.entries(entries)) {
      const rawEntry = harnessSteps[key];
      const entry: Record<string, unknown> = isRecord(rawEntry) ? { ...rawEntry } : {};
      setOrDelete(entry, 'model', step.model, step.model === '');
      setOrDelete(entry, 'effort', step.effort, step.effort === '');
      setOrDelete(harnessSteps, key, entry, Object.keys(entry).length === 0);
    }
    setOrDelete(steps, harness, harnessSteps, Object.keys(harnessSteps).length === 0);
  }
  return steps;
}

function setList(edited: Record<string, unknown>, raw: RawConfig, key: string, value: readonly unknown[]) {
  setOrDelete(edited, key, value, value.length === 0 && !(key in raw));
}

function setOrDelete(target: Record<string, unknown>, key: string, value: unknown, remove: boolean) {
  if (remove) {
    Reflect.deleteProperty(target, key);
    return;
  }
  target[key] = value;
}

function stepsFromRaw(rawSteps: unknown) {
  const steps: Partial<Record<Harness, Record<string, StepForm>>> = {};
  if (!isRecord(rawSteps)) return steps;
  for (const harness of HARNESSES) {
    const entries = rawSteps[harness];
    if (!isRecord(entries)) continue;
    steps[harness] = Object.fromEntries(
      Object.entries(entries)
        .filter((entry): entry is [string, Readonly<Record<string, unknown>>] => isRecord(entry[1]))
        .map(([key, entry]) => [key, { effort: asString(entry['effort']), model: asString(entry['model']) }]),
    );
  }
  return steps;
}

function toProfile(profile: ProfileForm) {
  const detect = splitList(profile.detect);
  const skills = splitList(profile.skills);
  return detect.length === 0 ? { name: profile.name, skills } : { detect, name: profile.name, skills };
}

/** API path of a scope (`global` or `project:<id>`); the colon stays readable, the id is encoded. */
export const configPath = (scope: string) => `/config/${scope.split(':').map(encodeURIComponent).join(':')}`;
