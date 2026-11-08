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
  "knowledge": { "root": "docs" },
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
    "claude": {
      "implement": { "model": "sonnet", "effort": "medium" }
    },
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
| `knowledge.root` | `docs` | Knowledge base folder (ADRs, principles, glossary, product, RFCs), relative to the repo root. Read and written by `agentic-use-knowledge` |
| `reviewers` | see [Reviewers](#reviewers) | Fallback only, used when `.agentic/review-gates.json` is absent (see [Review gates](#review-gates)). Skill names; one review subagent runs per entry, step key `review.<name>` |
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

Fallback, used only when `.agentic/review-gates.json` is absent (all entries then count as `alwaysOn`). Default:

```json
["code-review", "ub-mode", "claude-security-review", "super-review", "agentic-review-secrets", "agentic-review-access-control"]
```

`pr-security-review` ships with the plugin but is opt-in, because it overlaps `claude-security-review`. Add it to `reviewers` to run it. `/agentic-configure` can also install a third-party reviewer with `npx skills@latest add <source> --skill <name> -a <agent> -y`.

## Steps

Each entry is `"<step key>": { "model": "<harness model id>", "effort": "<level>" }`. Every field is optional; `model` and `effort` are passed as-is.

- **Model**: a Cursor id from `agent models` (e.g. `claude-opus-5-5`), a Codex slug from `codex debug models` (e.g. `gpt-6.1-sol`), or a Claude Code alias (`opus`, `sonnet`, `haiku`) or full id. 1M-context variants (ids containing `[1m]` or `-1m`) are rejected: 1M context is an orchestrator session setting, not a step model.
- **Effort**: `low | medium | high`, or a harness-native level (`xhigh`, `max`, `ultra`).

Built-in defaults are capability classes, not model ids: `frontier` (the strongest reasoning model available), `code` (a strong, balanced coding model) and `fast` (the cheapest fast model). The helper resolves them (Claude Code: `opus` / `sonnet` / `haiku`).

| Step key | Runs | Built-in default |
|---|---|---|
| `grill` | your session | frontier / high |
| `context.code`, `context.docs`, `context.runtime` | read-only subagent (parent `explore`) | as `explore` |
| `tickets` | subagent | code / medium |
| `implement` | one subagent per unit, including every review and babysit fix | code / medium |
| `review` | parent of `review.<reviewer>`, one subagent per reviewer. `ub-mode` and doc-style reviewers (example reviewers, replace with your project's: `api-contract`, `seeds-devx`, `migrations-data`, `i18n`, `design-system`) inherit it | code / medium |
| `review.code-review`, `review.super-review`, `review.claude-security-review`, `review.pr-security-review`, `review.agentic-review-secrets`, `review.agentic-review-access-control` | subagent | frontier / high |
| `review.review-access-tenant-isolation` (example reviewer, replace with your project's) | subagent | frontier / high |
| `audit` | every agent that `security-audit` launches under `agentic-security-audit` (reconnaissance, hunters, critics, verifiers) | frontier / high |

`grill` runs in your own session, so its value is only a recommendation. You get a warning if your session runs a different model. Projects override the example reviewers' rows through `steps` or `.agentic/review-gates.json`.

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

- `review.ub-mode`: model `composer-2.5` (from `review`), effort `medium` (built-in `review`).
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

## Review gates

`.agentic/review-gates.json` decides which reviewers run, computed by `review eligible`. Reviewers come from three arrays, each entry `{ "skill": "<name>", "triggers": { "changed": [globs], "added": [globs] } }`. `triggers` only matter in `conditional`.

```json
{
  "alwaysOn": [
    { "skill": "code-review" },
    { "skill": "agentic-review-secrets" },
    { "skill": "agentic-review-access-control" }
  ],
  "conditional": [
    { "skill": "migrations-data", "triggers": { "changed": ["**/migrations/**"], "added": ["**/migrations/*.sql"] } }
  ],
  "onDemand": [{ "skill": "super-review" }],
  "security": { "reviewers": ["agentic-review-secrets", "agentic-review-access-control"], "paths": ["**/auth/**", "**/payments/**"] }
}
```

| Array | Picked when |
|---|---|
| `alwaysOn` | First iteration: always |
| `conditional` | First iteration: a file in the diff against `--base` matches `triggers.changed`, or an added file matches `triggers.added` |
| `onDemand` | Only when named in `--only` |

Later iterations (`--iteration` above 1) pick, instead:

- Every reviewer whose previous report (`reviews/<n-1>-<name>.md`) starts with `verdict: changes-requested`.
- The security reviewers, when the diff touches a security path.

`--all --reason <text>` widens to every reviewer and logs a `note` event. `--only a,b` adds the named reviewers; an unknown name fails.

`security` is optional:

| Key | Default |
|---|---|
| `paths` | `**/auth/**`, `**/tenant/**`, `**/tenants/**`, `**/rls/**`, `**/policies/**` |
| `reviewers` | The `alwaysOn` entries whose name contains `security`, `access` or `tenant` |

Fallback: with no `review-gates.json`, `.agentic.json` `reviewers` is used and every entry counts as `alwaysOn`. With neither, `review eligible` exits 1.

## Helper CLI

`agentic.ts` does the workflow bookkeeping: events, state, step and model resolution, review eligibility, cleanup checks, spawn gating. It needs [bun](https://bun.sh).

```bash
bun <agentic-use-workflow dir>/scripts/agentic.ts <command>
```

| Command | Purpose |
|---|---|
| `start <workflow> --harness h` | Create the work item if new, log workflow `started` |
| `event --type t --summary s` | Validated append to `events.jsonl` |
| `state` | Re-derive `state.json` from the log |
| `resume` | Short summary to continue a run |
| `decide --tag --focus --q --a --why` | Append a decision to `decisions.md` and log it |
| `step <key>` | Resolve model and effort, print the filled brief, log `started` |
| `review eligible --base <ref>` | Reviewers to run, from [Review gates](#review-gates) |
| `hub sync` | Mirror the work item to its hub issue (GitHub, via `gh`) |
| `cleanup check` | Check the work item is ready to archive |
| `hook spawn` / `hook compact` | Hook entry points, see [Hooks](#hooks) |

`--work <slug>` selects the work item on any command. `gh` is optional: `hub sync` and the PR check of `cleanup check` skip with a message when it is absent, and `hub sync` also when no hub is set. GitHub only.

| Env var | Effect |
|---|---|
| `AGENTIC_OUTPUT` | Overrides the work item root (default: `output` from `.agentic.json` in the main checkout), resolved from the current directory |
| `AGENTIC_GH` | `gh` binary to use, default `gh` |
| `AGENTIC_RETRY_MS` | Base delay of `gh` retries on network errors, default 1000 |

Exit codes: `0` ok. `1` failed check or runtime failure (validation error, missing precondition, `gh` failure, `cleanup check` gaps). `2` usage error (unknown command, bad or missing flag), and a denied spawn from `hook spawn` on Claude Code and Codex.

## Hooks

Two hooks run through `scripts/hook.sh`, which calls `agentic.ts hook`:

- `hook spawn`: before a subagent spawn, while a work item has an open run for the current directory, checks that the brief carries `Step:`, `Work item:` (an existing, non-archived path), `Skills:`, `Progress:` (or the word `read-only`), `Agent:`, and that a `started` event exists for that agent. A brief that skips `agentic.ts step` fails this. The spawn is denied with the fix command and the expected model and effort. A brief with `Work item: none`, or no open run, passes.
- `hook compact`: after context compaction, re-injects the resume summary of the open work item.

The Claude Code, Codex and Cursor plugins ship them (`hooks/<harness>.json`). Codex asks you to review and trust plugin hooks through `/hooks`. Cursor has no post-compaction event, so `hook compact` runs at every session start. Without bun, `hook.sh` prints one line to stderr and exits 0: hooks never block.

Skills-CLI installs get no hooks: wire them by hand, see [README: Hooks](../README.md#hooks).
