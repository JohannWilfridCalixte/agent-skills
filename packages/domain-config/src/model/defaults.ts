/**
 * Built-in defaults of the config contract (`skills/core/agentic-use-workflow/references/config.md`).
 * A docs sync test fails when these diverge from that file's tables (D29).
 */

export const HARNESSES = ['cursor', 'claude', 'codex'] as const;

/** Capability classes used by built-in step defaults, not model ids. */
export type CapabilityClass = 'code' | 'fast' | 'frontier';

export type Harness = (typeof HARNESSES)[number];

export interface Profile {
  readonly detect?: readonly string[];
  readonly name: string;
  readonly skills: readonly string[];
}

export const BUILT_IN_PROFILES: readonly Profile[] = [
  { detect: ['tsconfig.json'], name: 'typescript', skills: ['agentic-typescript-engineer', 'agentic-code-testing'] },
  { detect: ['pyproject.toml', 'setup.py', 'requirements.txt'], name: 'python', skills: ['agentic-python-engineer', 'agentic-code-testing'] },
];

export const DEFAULT_REVIEWERS: readonly string[] = [
  'code-review',
  'ub-mode',
  'claude-security-review',
  'super-review',
  'agentic-review-secrets',
  'agentic-review-access-control',
];

/** A built-in step default: a capability class and effort, or "as" a routing key. */
export type StepDefault =
  | { readonly as: RoutingKey; readonly kind: 'routing' }
  | { readonly effort: string; readonly kind: 'class'; readonly model: CapabilityClass };

export const STEP_DEFAULTS: Readonly<Record<string, StepDefault>> = {
  'audit': { effort: 'high', kind: 'class', model: 'frontier' },
  'context.code': { as: 'explore', kind: 'routing' },
  'context.docs': { as: 'explore', kind: 'routing' },
  'context.runtime': { as: 'explore', kind: 'routing' },
  'grill': { effort: 'high', kind: 'class', model: 'frontier' },
  'implement': { effort: 'medium', kind: 'class', model: 'code' },
  'review': { effort: 'medium', kind: 'class', model: 'code' },
  'review.agentic-review-access-control': { effort: 'high', kind: 'class', model: 'frontier' },
  'review.agentic-review-secrets': { effort: 'medium', kind: 'class', model: 'frontier' },
  'review.claude-security-review': { effort: 'high', kind: 'class', model: 'frontier' },
  'review.super-review': { effort: 'high', kind: 'class', model: 'frontier' },
  'tickets': { effort: 'low', kind: 'class', model: 'fast' },
};

export interface RoutingDefault {
  readonly effort: string;
  readonly models: Readonly<Record<Harness, string>>;
}

export type RoutingKey = 'chore' | 'explore';

/** Model ids per harness, on purpose: routing keys pin cheap models. */
export const ROUTING_DEFAULTS: Readonly<Record<RoutingKey, RoutingDefault>> = {
  chore: { effort: 'low', models: { claude: 'haiku', codex: 'gpt-6-luna', cursor: 'gpt-5.6-luna' } },
  explore: { effort: 'medium', models: { claude: 'sonnet', codex: 'gpt-6.1-sol', cursor: 'grok-4.7-medium' } },
};

export const DEFAULT_LIMITS: Readonly<Record<string, number>> = {
  'babysit.rounds': 5,
  'crossHarness.timeout': 600,
  'implement.retries': 2,
  'review.iterations': 3,
};

/** Defaults of the scalar and list fields; `profiles` defaults to the built-ins, `steps` to `{}`. */
export const FIELD_DEFAULTS = {
  'commitWork': false,
  'knowledge.root': 'docs',
  'output': '.agentic/work',
  'reviewers': DEFAULT_REVIEWERS,
  'selectedProfiles': [] as readonly string[],
  'worktrees': '../{repo}-worktrees',
} as const;

/** Top-level fields of the config file, in documented order. */
export const CONFIG_FIELDS = [
  'output',
  'commitWork',
  'worktrees',
  'knowledge',
  'profiles',
  'selectedProfiles',
  'reviewers',
  'steps',
  'limits',
] as const;

export type ConfigField = (typeof CONFIG_FIELDS)[number];
