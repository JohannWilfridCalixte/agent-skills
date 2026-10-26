# Config

## Lookup and merge

1. `.agentic.json` at project root
2. `~/.agentic/config.json`

Project wins. `steps` merges per harness and step key, `limits` per key; any other top-level key present in the project file replaces the user value. Missing everywhere → defaults below.

## Example

```json
{
  "output": ".agentic/work",
  "commitWork": false,
  "worktrees": "../{repo}-worktrees",
  "profiles": [
    { "name": "typescript", "detect": ["tsconfig.json"], "skills": ["agentic-typescript-engineer", "agentic-clean-architecture"] }
  ],
  "selectedProfiles": ["typescript"],
  "steps": {
    "cursor": {
      "grill": { "model": "claude-opus-5-5", "effort": "high" },
      "implement": { "model": "composer-2.5" },
      "review": { "model": "composer-2.5" },
      "review.security": { "model": "claude-opus-5-5", "effort": "high" }
    },
    "claude": { "implement": { "model": "sonnet", "effort": "medium" } },
    "codex": { "implement": { "model": "gpt-5.6", "effort": "medium" } }
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
| `profiles` | `{name, detect?, skills}[]` | `[]` | `detect`: files/globs at project root. `skills`: skill names |
| `selectedProfiles` | string[] | `[]` | Profile names in use. Empty → propose detected ones |
| `steps` | `{harness: {stepKey: {model?, effort?}}}` | `{}` | Harness keys: `cursor`, `claude`, `codex` |
| `limits` | `{limitKey: number}` | see below | Flat dotted keys |

`effort`: `low | medium | high`, or any harness-native level (`xhigh`, `max`, `ultra`), passed as-is. `model` is a harness model id, passed as-is. How each harness applies them: [delegation.md](delegation.md).

## Built-in step defaults

Capability classes, not model ids: `frontier` (strongest reasoning model available), `code` (strong, balanced coding model), `fast` (cheapest fast model).

| Step key | Where | Default |
|---|---|---|
| `triage` | main session | frontier / medium |
| `grill` | main session | frontier / high |
| `context.code` | subagent, read-only | fast / medium |
| `context.docs` | subagent, read-only | fast / low |
| `context.runtime` | subagent, read-only | fast / medium |
| `tickets` | subagent | fast / low |
| `implement` | subagent | code / medium |
| `review.spec` | subagent | code / medium |
| `review.codestyle` | subagent | code / medium |
| `review.tests` | subagent | code / medium |
| `review.security` | subagent | frontier / high |
| `review.access-control` | subagent | frontier / high |
| `review.secrets` | subagent | frontier / medium |
| `review.fix` | subagent | code / medium |
| `babysit.fix` | subagent | code / medium |

## Resolution

For each of `model` and `effort` separately, first hit wins:

1. `steps.{harness}.{key}`
2. `steps.{harness}.{parent}` — key up to the first `.` (`review` for `review.security`)
3. Built-in default above
4. Harness default

Example (cursor, config above): `review.tests` → model `composer-2.5` (from `review`), effort `medium` (built-in). `implement` → model `composer-2.5`, effort `medium` (built-in).

## Limits

| Key | Default | Hit → |
|---|---|---|
| `review.iterations` | 3 | Stop the fix loop, ask the user |
| `babysit.rounds` | 5 | Fix rounds on the PR. Stop fixing, ask the user (watching itself isn't capped) |
| `implement.retries` | 2 | Stop the task, ask the user |
