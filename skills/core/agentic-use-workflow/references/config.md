# Config

## Lookup and merge

1. `.agentic.json` at project root
2. `~/.agentic/config.json`

Project wins (`agentic.ts step` applies this merge). `steps` merges per harness and step key, `limits` per key; any other top-level key present in the project file (`reviewers` included) replaces the user value. A key absent from both files → its default below, so a file holds only what differs from the defaults.

## Example

```json
{
  "output": ".agentic/work",
  "commitWork": false,
  "worktrees": "../{repo}-worktrees",
  "knowledge": { "root": "docs" },
  "profiles": [
    { "name": "backend", "detect": ["src/domain"], "skills": ["agentic-clean-architecture"] }
  ],
  "selectedProfiles": ["typescript", "backend"],
  "reviewers": ["code-review", "claude-security-review", "agentic-review-secrets"],
  "steps": {
    "cursor": {
      "grill": { "model": "claude-opus-5-5", "effort": "high" },
      "implement": { "model": "composer-2.5" },
      "review": { "model": "composer-2.5" },
      "review.claude-security-review": { "model": "claude-opus-5-5", "effort": "high" }
    },
    "claude": { "implement": { "model": "sonnet", "effort": "medium" } },
    "codex": { "implement": { "model": "gpt-6.1-sol", "effort": "medium" } }
  },
  "limits": { "review.iterations": 3, "babysit.rounds": 5, "implement.retries": 2 }
}
```

## Fields

| Field | Type | Default | Meaning |
|---|---|---|---|
| `output` | string | `.agentic/work` | Root of work-item folders, relative to project root |
| `commitWork` | boolean | `false` | `false` → `output` is gitignored |
| `worktrees` | string | `../{repo}-worktrees` | Root of worktree workspaces, relative to the main checkout. `{repo}` = its folder name |
| `knowledge.root` | string | `docs` | Knowledge base folder (agentic-use-knowledge), relative to the repo root |
| `profiles` | `{name, detect?, skills}[]` | built-ins below | Added to the built-ins; same `name` overrides one. `detect`: files/globs at project root. `skills`: codestyle skill names |
| `selectedProfiles` | string[] | `[]` | Profile names in use. Empty → every profile whose `detect` matches |
| `reviewers` | string[] | see below | Fallback only, used when `.agentic/review-gates.json` is absent (`review eligible` decides otherwise). Skill names; one subagent per entry, step key `review.<name>` |
| `steps` | `{harness: {stepKey: {model?, effort?}}}` | `{}` | Harness keys: `cursor`, `claude`, `codex` |
| `limits` | `{limitKey: number}` | see below | Flat dotted keys |

`{field}` in any skill = that field's resolved value; a dot names a nested key (`{knowledge.root}` → `knowledge.root`). `{knowledge.root}` resolves in the checkout being read or written (`workspace.path` once recorded).

Every skill name (`profiles[].skills`, `reviewers`, a unit's `Skills`) may be any skill the harness can load (agentic, vendored, or installed separately); it is reached per the Skills section of `agentic-use-workflow`.

`effort`: `low | medium | high`, or any harness-native level (`xhigh`, `max`, `ultra`), passed as-is. `model` is a harness model id, passed as-is. How each harness applies them: [delegation.md](delegation.md).

### Built-in profiles

| Name | `detect` | `skills` |
|---|---|---|
| `typescript` | `tsconfig.json` | `agentic-typescript-engineer`, `agentic-code-testing` |
| `python` | `pyproject.toml`, `setup.py`, `requirements.txt` | `agentic-python-engineer`, `agentic-code-testing` |

A config profile named like a built-in replaces its `skills` whole: list `agentic-code-testing` there to keep it.

`agentic-clean-architecture` and `agentic-write-instrumented-code` aren't stack-wide: `agentic-to-plan` assigns them per task (`Skills` in `plan.md`). Put them in a profile only to force them on every unit.

### Default reviewers (fallback)

`["code-review", "ub-mode", "claude-security-review", "super-review", "agentic-review-secrets", "agentic-review-access-control"]`

Shipped but opt-in: `pr-security-review` (overlaps `claude-security-review`). Add it to `reviewers` to run it.

## Built-in step defaults

Capability classes, not model ids: `frontier` (strongest reasoning model), `code` (strong, balanced coding model), `fast` (cheapest). `agentic.ts step <key>` resolves them (Claude: `opus` / `sonnet` / `haiku`) and prints model + effort in the brief and event. No orchestrator key: the session model is the owner's setting.

| Step key | Where | Default |
|---|---|---|
| `grill` | main session | frontier / high |
| `implement` | subagent, one per unit (fix lists included) | code / medium |
| `tickets` | subagent | code / medium |
| `explore`, `context.*` | subagent, read-only | code / medium |
| `review` | parent of `review.<reviewer>`; `ub-mode` and doc-style reviewers (example reviewers, replace with your project's: `api-contract`, `seeds-devx`, `migrations-data`, `i18n`, `design-system`) inherit it | code / medium |
| `review.code-review`, `review.super-review`, `review.claude-security-review`, `review.pr-security-review`, `review.agentic-review-secrets`, `review.agentic-review-access-control` | subagent | frontier / high |
| `review.review-access-tenant-isolation` (example reviewer, replace with your project's) | subagent | frontier / high |
| `audit` | every agent `security-audit` launches under `agentic-security-audit` | frontier / high |

Projects override the example reviewers' rows via `.agentic/review-gates.json` or `.agentic.json` `steps`.

1M context is an orchestrator session setting, owner-controlled, enabled when available in the harness. Sub-agents cannot get it through `Agent` (no 1M model id): the helper rejects a 1M step model.

### Routing keys

Used for work outside the steps above. Defaults are model ids per harness, on purpose: these exist to pin cheap models.

| Key | Used for | `cursor` | `claude` | `codex` | Effort |
|---|---|---|---|---|---|
| `chore` | Simple tasks (agentic-use-workflow Cheap routing) | `gpt-5.6-luna` | `haiku` | `gpt-6-luna` | low |
| `explore` | Read-only exploration, `context.*` included | `grok-4.7-medium` | `sonnet` | `gpt-6.1-sol` | medium |

## Resolution

For each of `model` and `effort` separately, first hit wins:

1. `steps.{harness}.{key}`
2. `steps.{harness}.{parent}` — key up to the first `.` (`review` for `review.ub-mode`); `context.*` → `explore`
3. Built-in default above: the key's row, else its parent's (`review.ub-mode` → `review`; `context.*` → `explore`)
4. Harness default

Example (cursor, config above): `review.code-review` → model `composer-2.5` (from `review`), effort `medium` (built-in `review`). `review.claude-security-review` → model `claude-opus-5-5`, effort `high` (both explicit). `implement` → model `composer-2.5`, effort `medium` (built-in).

## Limits

`limits.<key>` in any skill = key `<key>` of `limits` (`limits.review.iterations` → `"review.iterations"`).

| Key | Default | Hit → |
|---|---|---|
| `review.iterations` | 3 | Stop the fix loop, ask the user |
| `babysit.rounds` | 5 | Fix rounds on the PR. Stop fixing, ask the user (watching itself isn't capped) |
| `implement.retries` | 2 | Stop the unit, ask the user |
