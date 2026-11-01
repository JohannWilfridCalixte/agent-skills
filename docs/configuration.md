# Configuration reference

Optional: with no file, built-in defaults apply. `/agentic-configure` (`$agentic-configure` in Codex) detects your harnesses and their models, proposes a config, then writes and validates it.

Agent-facing contract: [`config.md`](../skills/core/agentic-use-workflow/references/config.md). How each harness applies model and effort: [`delegation.md`](../skills/core/agentic-use-workflow/references/delegation.md).

## Files and merge

| File | Scope |
|---|---|
| `.agentic.json` at the project root | This project |
| `~/.agentic/config.json` | All your projects |

The project file wins. `steps` merges per harness and step key, and `limits` merges per key. Any other top-level key in the project file replaces the global one, `reviewers` included. A key absent from both files takes its default, so a file only needs to hold what differs. `agentic-configure` recommends putting models in the global file and everything else in the project file.

## Example

```json
{
  "output": ".agentic/work",
  "commitWork": false,
  "worktrees": "../{repo}-worktrees",
  "reviewers": ["code-review", "ub-mode", "claude-security-review", "super-review", "agentic-review-secrets", "agentic-review-access-control"],
  "profiles": [
    { "name": "backend", "detect": ["src/domain"], "skills": ["agentic-clean-architecture"] }
  ],
  "selectedProfiles": ["typescript", "backend"],
  "steps": {
    "cursor": {
      "grill": { "model": "claude-opus-5-5", "effort": "high" },
      "implement": { "model": "composer-2.5" },
      "review": { "model": "composer-2.5" },
      "review.super-review": { "model": "claude-opus-5-5", "effort": "high" }
    },
    "claude": { "implement": { "model": "sonnet", "effort": "medium" } },
    "codex": { "implement": { "model": "gpt-6.1-sol", "effort": "medium" } }
  },
  "limits": { "review.iterations": 3, "babysit.rounds": 5, "implement.retries": 2 }
}
```

## Fields

| Field | Default | Meaning |
|---|---|---|
| `output` | `.agentic/work` | Work item folders, relative to the project root |
| `commitWork` | `false` | `false` keeps `output` out of git (gitignore it) |
| `worktrees` | `../{repo}-worktrees` | Root for worktrees, relative to the main checkout. `{repo}` is that checkout's folder name |
| `reviewers` | see [Reviewers](#reviewers) | Skill names. One review subagent runs per entry, with step key `review.<name>` |
| `profiles` | built-ins | `{name, detect?, skills}[]`, added to the built-ins. Stack → codestyle skills. `detect` is a list of files or globs at the project root |
| `selectedProfiles` | `[]` | Profiles in use. When empty, every profile whose `detect` matches is used |
| `steps` | `{}` | Model and effort per step, per harness (`cursor`, `claude`, `codex`) |
| `limits` | see [Limits](#limits) | Loop caps, as flat dotted keys |

Any skill name (in `profiles[].skills`, `reviewers`, or a task's `Skills` in `plan.md`) can be any skill the harness can load: agentic, vendored, or installed separately.

## Profiles

| Name | `detect` | `skills` |
|---|---|---|
| `typescript` | `tsconfig.json` | `agentic-typescript-engineer`, `agentic-code-testing` |
| `python` | `pyproject.toml`, `setup.py`, `requirements.txt` | `agentic-python-engineer`, `agentic-code-testing` |

A config profile with the same name as a built-in replaces its `skills` entirely. To keep `agentic-code-testing`, list it again.

`agentic-clean-architecture` and `agentic-write-instrumented-code` are not stack-wide: `agentic-to-plan` assigns them per task (`Skills` in `plan.md`). Put them in a profile only if you want them forced on every unit.

## Reviewers

Default:

```json
["code-review", "ub-mode", "claude-security-review", "super-review", "agentic-review-secrets", "agentic-review-access-control"]
```

`pr-security-review` ships with the plugin but is opt-in, because it overlaps `claude-security-review`. Add it to `reviewers` to run it. `/agentic-configure` can also install a third-party reviewer with `npx skills@latest add <source> --skill <name> -a <agent> -y`.

## Steps

Each entry is `"<step key>": { "model": "<harness model id>", "effort": "<level>" }`. Both fields are optional and passed as-is.

- **Model**: a Cursor id from `agent models` (e.g. `claude-opus-5-5`), a Codex slug from `codex debug models` (e.g. `gpt-6.1-sol`), or a Claude Code alias (`opus`, `sonnet`, `haiku`) or full id.
- **Effort**: `low | medium | high`, or a harness-native level (`xhigh`, `max`, `ultra`).

Built-in defaults are capability classes, not model ids: `frontier` (the strongest reasoning model available), `code` (a strong, balanced coding model) and `fast` (the cheapest fast model).

| Step key | Runs | Built-in default |
|---|---|---|
| `grill` | your session | frontier / high |
| `context.code`, `context.docs`, `context.runtime` | read-only subagent (parent `explore`) | as `explore` |
| `tickets` | subagent | fast / low |
| `implement` | one subagent per unit, including every review and babysit fix | code / medium |
| `review` | parent of `review.<reviewer>`, one subagent per reviewer | code / medium |
| `review.claude-security-review`, `review.super-review`, `review.agentic-review-access-control` | subagent | frontier / high |
| `review.agentic-review-secrets` | subagent | frontier / medium |
| `audit` | every agent that `security-audit` launches under `agentic-security-audit` (reconnaissance, hunters, critics, verifiers) | frontier / high |

`grill` runs in your own session, so its value is only a recommendation. You get a warning if your session runs a different model.

### Routing keys

These cover work outside the steps above. Their defaults are deliberately model ids per harness, so cheap models are pinned.

| Key | Used for | `cursor` | `claude` | `codex` | Effort |
|---|---|---|---|---|---|
| `chore` | Simple tasks: grep, read a diff, rename, one-line edit | `gpt-5.6-luna` | `haiku` | `gpt-6-luna` | low |
| `explore` | Every read-only exploration, `context.*` included | `grok-4.7-medium` | `sonnet` | `gpt-6.1-sol` | medium |

### Resolution

`model` and `effort` each resolve separately. The first hit wins:

1. `steps.{harness}.{key}`
2. `steps.{harness}.{parent}`: the key up to its first `.` (`review` for `review.ub-mode`). `context.*` maps to `explore`
3. The built-in default: the key's own row, otherwise its parent's
4. The harness default

Worked examples, for cursor with the config above:

- `review.code-review`: model `composer-2.5` (from `review`), effort `medium` (built-in `review`).
- `review.super-review`: model `claude-opus-5-5`, effort `high` (both set explicitly).
- `implement`: model `composer-2.5`, effort `medium` (built-in).

### Harness notes

- **Claude Code**: if `CLAUDE_CODE_EFFORT_LEVEL` is set, it overrides every effort setting and is logged as the effort used.
- **Codex**: worktrees sit outside the repo, so the sandbox may block writes to them. Restart Codex with `--add-dir <path>`, or add the path to `sandbox_workspace_write.writable_roots` in `~/.codex/config.toml`.

## Limits

| Key | Default | When reached |
|---|---|---|
| `review.iterations` | 3 | The review fix loop stops and asks you |
| `babysit.rounds` | 5 | PR fix rounds stop and ask you. Watching the PR itself is not capped |
| `implement.retries` | 2 | A red unit stops and asks you |
