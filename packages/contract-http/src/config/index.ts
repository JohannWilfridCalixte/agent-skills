import { z } from 'zod';

export const ConfigOrigin = z.enum(['default', 'global', 'project']);

export type ConfigOrigin = z.infer<typeof ConfigOrigin>;

export const Harness = z.enum(['cursor', 'claude', 'codex']);

export type Harness = z.infer<typeof Harness>;

const SourcedString = z.object({ origin: ConfigOrigin, value: z.string() });
const SourcedStrings = z.object({ origin: ConfigOrigin, value: z.array(z.string()) });

export const ConfigProfile = z.object({
  detect: z.array(z.string()).optional(),
  name: z.string(),
  skills: z.array(z.string()),
});

export type ConfigProfile = z.infer<typeof ConfigProfile>;

export const EffectiveStep = z.object({
  effort: SourcedString.optional(),
  harness: z.object({ origin: ConfigOrigin, value: Harness }).optional(),
  model: SourcedString.optional(),
});

export type EffectiveStep = z.infer<typeof EffectiveStep>;

export const UnknownConfigKey = z.object({
  /** Dotted path, e.g. `review.fix`. */
  path: z.string(),
  scope: z.enum(['global', 'project']),
});

export type UnknownConfigKey = z.infer<typeof UnknownConfigKey>;

/** `GET /api/config/:scope/effective`: every field with its origin; `steps` and `limits` per leaf. */
export const EffectiveConfigResponse = z.object({
  config: z.object({
    commitWork: z.object({ origin: ConfigOrigin, value: z.boolean() }),
    knowledge: z.object({ root: SourcedString }),
    limits: z.record(z.string(), z.object({ origin: ConfigOrigin, value: z.number() })),
    output: SourcedString,
    profiles: z.object({ origin: ConfigOrigin, value: z.array(ConfigProfile) }),
    reviewers: SourcedStrings,
    selectedProfiles: SourcedStrings,
    steps: z.record(Harness, z.record(z.string(), EffectiveStep)),
    worktrees: SourcedString,
  }),
  /** `global` or `project:<id>`. */
  scope: z.string(),
  unknownKeys: z.array(UnknownConfigKey),
});

export type EffectiveConfigResponse = z.infer<typeof EffectiveConfigResponse>;

/** `GET /api/config/:scope`: the file as on disk; a missing file is `exists: false` with empty content. */
export const RawConfigResponse = z.object({
  /** Parsed file object, unknown keys kept; `{}` when the file is missing. */
  config: z.record(z.string(), z.unknown()),
  exists: z.boolean(),
  scope: z.string(),
  /** File text as on disk; `null` when missing. */
  text: z.string().nullable(),
  /** Unknown keys of this file as dotted paths, flagged as possibly stale. */
  unknownKeys: z.array(z.string()),
});

export type RawConfigResponse = z.infer<typeof RawConfigResponse>;

/** Body of `POST /api/config/:scope/preview` and `PUT /api/config/:scope`: the edited file object (full or partial); the server validates it. */
export const EditedConfig = z.record(z.string(), z.unknown());

export type EditedConfig = z.infer<typeof EditedConfig>;

export const ConfigDiffLine = z.object({ kind: z.enum(['added', 'context', 'removed']), text: z.string() });

export type ConfigDiffLine = z.infer<typeof ConfigDiffLine>;

const ConfigIssue = z.object({ message: z.string(), path: z.string() });

/** `POST /api/config/:scope/preview`: what a save would write; nothing is written. Non-empty `issues` blocks the save. */
export const ConfigPreviewResponse = z.object({
  /** Line diff of the file on disk against `proposedText`; empty when `issues` is non-empty. */
  diff: z.array(ConfigDiffLine),
  issues: z.array(ConfigIssue),
  proposedText: z.string().nullable(),
  scope: z.string(),
  unknownKeys: z.array(z.string()),
  /** Unknown model ids: shown, never blocking. */
  warnings: z.array(ConfigIssue),
});

export type ConfigPreviewResponse = z.infer<typeof ConfigPreviewResponse>;

/** `PUT /api/config/:scope`: the file was written (last write wins; the overwritten content is in history). */
export const ConfigSaveResponse = z.object({
  /** `false` when the file already held this text: nothing written or recorded. */
  changed: z.boolean(),
  scope: z.string(),
  text: z.string(),
  unknownKeys: z.array(z.string()),
  warnings: z.array(ConfigIssue),
});

export type ConfigSaveResponse = z.infer<typeof ConfigSaveResponse>;
