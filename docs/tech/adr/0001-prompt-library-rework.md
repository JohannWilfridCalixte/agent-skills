# 0001 - Prompt library rework: composable, intent-level, per-step configurable

**Status:** Accepted
**Date:** 2026-10-26

## Context

The v1 library (personas, `agentic:*:*` names, step files, 3 global model constants, per-run YAML state) predates current models. It is verbose, hard to compose, not installable with `npx skills add` (names violate the Agent Skills spec), and cannot run each step on a different model/effort.

## Decision

### Principles

- **Intent-level prompts.** Every workflow `SKILL.md` captures intent in ~30–60 lines, no `steps/` folders. Inspiration: Matt Pocock's skills, aidd plugins. **Exception:** codestyle skills (`agentic-typescript-engineer`, `agentic-python-engineer`, `agentic-clean-architecture`, `agentic-code-testing`, `agentic-write-instrumented-code`) stay detailed — they are used by cheaper models.
- **No personas.** `agents/` is deleted.
- **Templates only for contract artifacts** (parsed by another step or by outside tooling): `spec.md`, `plan.md`, `events.jsonl` line, `state.json`, review finding. Everything else is free-form.
- **Clean break.** No backward compatibility, `agentic-cli` dropped.

### Naming & packaging

- Every skill is named `agentic-<name>` (`agentic-to-spec`, `agentic-grill`): spec-valid (`a-z0-9-`, matches the folder name), and the prefix is visible in every harness without relying on plugins. Colons stay forbidden by the Agent Skills spec.
- Primary install: plain skills, symlinked into `~/.agents/skills` (read by Cursor and Codex) and/or `~/.claude/skills` (Claude Code).
- Plugin manifests stay for Claude Code / Codex distribution: `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`, `.cursor-plugin/plugin.json`, root `plugin.json` (portable Agent Plugins schema, read by Codex). Claude Code then shows `/agentic:agentic-grill`; the doubled prefix is accepted.
- Also installable skill-by-skill with `npx skills add`.
- Workflow and phase ids in `events.jsonl` / `state.json` are the skill names without the prefix (`to-spec`).

### Skills

| Skill | Kind | Role |
|---|---|---|
| `agentic-use-workflow` | primitive | Config, step → `{model, effort}` resolution, delegation, work-item folder, workspace, `events.jsonl` + `state.json`, resume, escalation gate, communication mode |
| `agentic-use-knowledge` | primitive | Read (context) and write (promotion) `docs/`, incl. `docs/tech/principles.md` |
| `agentic-grill` | building block | Interview one question at a time with a recommended answer; `focus`: product, functional, tech, combined |
| `agentic-to-spec` | workflow 1 | capture → context → grill (product + functional) → gate → `spec.md` |
| `agentic-to-plan` | workflow 2 | context (tech, additive) → grill (tech) → gate → promote to `docs/` → `plan.md` |
| `agentic-to-tickets` | optional | One-way idempotent push of spec + plan tasks to any tracker |
| `agentic-implement` | workflow 3 | Asks the workspace if none, one subagent per task, tests-first, one commit per task, green gate between tasks |
| `agentic-review` | workflow 4 | 6 parallel lenses → fix loop. PR mode = comment instead of fix |
| `agentic-babysit-pr` | workflow 5 | Push, open PR, watch CI + comments, fix until merge-ready, keep watching until merged → `agentic-cleanup`. Never merges |
| `agentic-cleanup` | workflow 6 | After merge: remove worktree, delete branches, update default branch, archive the work item. `--all` sweeps |
| `agentic-ship-feature` | orchestrator | Chains 1→6, triage light/full + workspace, resumable by slug |
| codestyle skills | rulesets | Unchanged content, renamed |

Deleted: `agents/`, `use-agentic` (merged into `agentic-use-workflow`), `delegate-work` (merged), `technical-planning`, `implement` (rewritten), `debug` (bugs go through light mode), `pr-review` (→ `agentic-review` PR mode), `review-loop`, `review-code`, `review-tests`, `review-security` (→ `agentic-review` lenses).

### Execution model

- **Interactive steps** (capture, grill, gate, triage) run in the main session. Config for them is a *recommendation*: warn once if the session model differs.
- **Non-interactive steps** always run as subagents with `{model, effort}` resolved from config.
- **Writers:** the orchestrating session logs every workflow, step, subagent dispatch and result, gate and decision, and is the only writer of `state.json`. Writing subagents only append `progress` lines (one shell `>>` per line, never a rewrite) at each milestone, so the log shows what each subagent is doing while it runs. Milestones, not tool calls.
- Subagents receive **paths and skill names, never content**.

### Step keys and built-in defaults

Defaults are capability classes, not model slugs: `frontier` (strongest reasoning model available), `code` (strong, balanced coding model), `fast` (cheapest fast model).

| Step key | Where | Default |
|---|---|---|
| `triage` | main session | frontier / medium |
| `grill` | main session | frontier / high |
| `context.code` | subagent, read-only | as `explore` |
| `context.docs` | subagent, read-only | as `explore` |
| `context.runtime` | subagent, read-only | as `explore` |
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

**Cheap routing.** The session model never does easy work. Two routing keys pin cheap models by id (an exception to capability classes, on purpose):

| Key | Used for | `cursor` | `claude` | `codex` |
|---|---|---|---|---|
| `chore` | grep, read a file / diff / PR / log, rename, one-line edit, run a command and summarize. Stops if > 2 files or a decision is needed | `gpt-5.6-luna` | `haiku` | `gpt-6-luna` |
| `explore` | every read-only exploration subagent, `context.*` included. Bypasses the harness's built-in Explore agent when it doesn't run the configured model | `grok-4.7-medium` | `sonnet` | `gpt-6.1-sol` |

Resolution: `steps.{harness}.{key}` → `steps.{harness}.{parent}` (e.g. `review` for `review.security`, `explore` for `context.*`) → built-in default → harness default.

### Config

Lookup: `.agentic.json` at project root, then `~/.agentic/config.json` (project wins; `steps` merged per harness and step key, `limits` per key, other top-level keys replaced).

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

### Work item

The unit of state is the work item (feature), not the run.

```
{output}/{YYYYMMDD}-{slug}/
├── events.jsonl      # append-only audit log (source of truth)
├── state.json        # snapshot, rewritten after every event, never holds info absent from the log
├── input.md
├── context.md        # cited, one section per context subagent
├── decisions.md      # grill Q/A, tagged structural | minor
├── spec.md           # full mode only
├── plan.md           # tasks consumed by agentic-implement and agentic-to-tickets
├── implementation.md
├── reviews/{iteration}-{lens}.md
└── pr.md

{output}/_archive/{YYYYMMDD}-{slug}/   # after agentic-cleanup, never deleted
```

- `{output}` defaults to `.agentic/work`, gitignored unless `commitWork: true`. Always in the main checkout, never in a worktree.
- Standalone workflow without a slug → new work item. With a slug → resume from `state.json`.

`events.jsonl` line:

```json
{"ts":"2026-10-26T13:40:00Z","work":"20261026-tenant-export","run":"a3f9","workflow":"to-spec","step":"context.code","type":"completed","model":"composer-2.5","effort":"medium","summary":"Mapped export module and tenant guard","ref":"context.md#code"}
```

`type` ∈ `started | completed | failed | decision | escalation | artifact | gate | note`. Optional `data` object (e.g. decision: `{question, answer, tag}`).

`state.json`:

```json
{
  "work": "20261026-tenant-export",
  "title": "Tenant data export",
  "mode": "full",
  "status": "in_progress",
  "phase": "to-plan",
  "phases": { "to-spec": "done", "to-plan": "in_progress" },
  "workspace": { "kind": "worktree", "branch": "feat/tenant-export", "base": "main", "path": "/home/me/dev/shop-worktrees/tenant-export" },
  "artifacts": { "spec": "spec.md", "plan": null },
  "escalations": [{ "id": "D4", "summary": "Exports stored 30 days", "status": "open", "ref": "docs/tech/adr/0007-export-retention.md" }],
  "tickets": { "parent": null, "tasks": {} },
  "pr": { "url": null, "round": 0 },
  "updated": "2026-10-26T13:52:00Z"
}
```

`status` ∈ `in_progress | awaiting_decision | blocked | done | failed | archived`.

### Workspace

Where the code is built, asked once per work item by the first workflow that writes to the repo: `agentic-ship-feature` at triage (everything after the last gate is autonomous), the promotion after a gate, or `agentic-implement`.

- **worktree** (default, recommended): branch `feat/{slug}` or `fix/{slug}` from the up-to-date default branch, at `{worktrees}/{slug}` (default `../{repo}-worktrees`). Dependencies installed so checks run; untracked local files (`.env`) copied only on consent.
- **current**: the checked-out branch. On the default branch → warn, recommend worktree or new branch.
- **branch**: an existing branch or a new one.

Logged as a `decision` event, recorded as `state.workspace` (absolute path). The work-item folder stays in the main checkout; every later repo write (code, `docs/` promotion, committed as `docs: …`) and code operation, subagents included, runs in `workspace.path`, passed by delegation.

### Cleanup

`agentic-cleanup` runs once merged: worktree removed and pruned, local branch deleted, remote branch deleted if still there, main checkout back on an up-to-date default branch if it was on the feature branch, folder archived to `{output}/_archive/`. Merged = PR state merged (authoritative, handles squash merges), else branch merged into the default branch. Unmerged branch, uncommitted or unpushed work, PR closed without merge → ask. Events are logged before the move; final status `archived`. `--all` sweeps every non-archived merged work item and reports cleaned vs skipped with reasons.

### Escalation gate

Runs at the end of every grill (`agentic-to-spec`, `agentic-to-plan`, light mode). Lists structural / non-reversible decisions with *why flagged* (reversibility cost, blast radius: data, public contract, security, cost; rejected alternatives). Per decision:

- **confirm** → ADR `Accepted` via `agentic-use-knowledge`
- **escalate** → ADR `Proposed` or RFC, optionally shared through available tools; status `awaiting_decision`; downstream workflows refuse to start unless overridden (override is logged)
- **revisit** → back to grill

Promotion to `docs/` happens right after each gate. Nothing unconfirmed lands in `docs/` before.

### Light mode

`agentic-ship-feature` triages after capture + context, proposes light or full, user confirms (`--light` / `--full` override). Light = one combined grill (blocking questions only, ~3 max) → single `plan.md` with acceptance criteria → gate only if an irreversible decision is detected → implement. Bugs: first task is a failing regression test. Review and babysit are never skipped.

### Review lenses

| Lens | Checks against |
|---|---|
| `spec` | `spec.md` / `plan.md` acceptance criteria |
| `codestyle` | `docs/tech/principles.md`, ADR index, profile codestyle skills |
| `tests` | `agentic-code-testing` |
| `security` | OWASP Top 10 |
| `access-control` | authz on every entry point, IDOR, tenant isolation |
| `secrets` | credential leaks in code, config, logs, fixtures, git history (+ `gitleaks` / `trufflehog` when available) |

Severity: blocker, major (both block) / minor, nit. Fix loop until no blocker/major or `limits.review.iterations` reached → ask.

### Babysit authority

Bot comments: fix if valid, else reply with reason; resolve. Human comments: clear requests → fix, reply with commit link, resolve. Debatable / design-level → escalate to user. Never merges. Moves tickets to *In Review* when PR opens. After merge-ready, keeps watching (growing backoff, same rules) until the PR is merged or closed, then hands off to `agentic-cleanup`. `limits.babysit.rounds` caps fix rounds, not watching. Defers to a native harness loop (e.g. Cursor `autopilot` / `loop`) when available. A session ending before merge resumes with `agentic-babysit-pr {slug}` or `agentic-cleanup`.

### Ship-feature orchestration

Interactive until the last gate, autonomous after. Triage also asks tickets and workspace, and sets the workspace up. Interrupts only for: limits hit, design-level PR comments, unfixable red tree, PR closed without merge, cleanup blocked by unmerged or unpushed work. The chain ends after merge with `agentic-cleanup`.

## Rationale

- Per-step `{model, effort}` is only achievable through subagents; interactive steps must stay in the main session.
- One work-item folder + append-only log makes runs auditable from outside the session (`tail -f`, dashboards) and lets the 5 workflows compose across sessions and models.
- `agentic-` prefixed spec-valid names group the skills visibly in every harness (`/agentic-to-spec`), installed as plain skills or as a plugin, without breaking `npx skills add`.
- Intent-level prompts age better; detailed rules are kept where weaker models execute them.

## Alternatives Considered

- **Tiers** (named presets mapped to steps): rejected for flat per-step config.
- **Everything as subagents** (grill relayed through main session): clunky, loses conversational grounding.
- **YAML-only state / per-run folders**: no cross-run view of a feature.
- **Plain names + plugin namespacing** (`to-spec`, exposed as `/agentic:to-spec`): rejected. Cursor doesn't namespace plugin skills (`/grill` would sit next to Matt Pocock's `/grill-me`), and team admins may block plugin installs, leaving plain skills with no prefix at all.
- **Keep `debug`**: light mode with a regression-test-first task covers it.
- **Work-item folder inside the worktree**: rejected. Splits the audit trail across checkouts and disappears with the worktree.
- **Delete the work item on cleanup**: rejected for archiving; the log is the audit trail.

## Consequences

- Existing `.agentic.json` files and `agentic-cli` stop working.
- Interactive steps' model depends on how the user launched the session.
- No formal verification yet; validated in real use, eval harness later.
