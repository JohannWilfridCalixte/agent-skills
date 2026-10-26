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
| `agentic-use-workflow` | primitive | Config, step → `{model, effort}` resolution, delegation, work-item folder, `events.jsonl` + `state.json`, resume, escalation gate, communication mode |
| `agentic-use-knowledge` | primitive | Read (context) and write (promotion) `docs/`, incl. `docs/tech/principles.md` |
| `agentic-grill` | building block | Interview one question at a time with a recommended answer; `focus`: product, functional, tech, combined |
| `agentic-to-spec` | workflow 1 | capture → context → grill (product + functional) → gate → `spec.md` |
| `agentic-to-plan` | workflow 2 | context (tech, additive) → grill (tech) → gate → promote to `docs/` → `plan.md` |
| `agentic-to-tickets` | optional | One-way idempotent push of spec + plan tasks to any tracker |
| `agentic-implement` | workflow 3 | One subagent per task, tests-first, one commit per task, green gate between tasks |
| `agentic-review` | workflow 4 | 6 parallel lenses → fix loop. PR mode = comment instead of fix |
| `agentic-babysit-pr` | workflow 5 | Push, open PR, watch CI + comments, fix, loop until merge-ready. Never merges |
| `agentic-ship-feature` | orchestrator | Chains 1→5, triage light/full, resumable by slug |
| codestyle skills | rulesets | Unchanged content, renamed |

Deleted: `agents/`, `use-agentic` (merged into `agentic-use-workflow`), `delegate-work` (merged), `technical-planning`, `implement` (rewritten), `debug` (bugs go through light mode), `pr-review` (→ `agentic-review` PR mode), `review-loop`, `review-code`, `review-tests`, `review-security` (→ `agentic-review` lenses).

### Execution model

- **Interactive steps** (capture, grill, gate, triage) run in the main session. Config for them is a *recommendation*: warn once if the session model differs.
- **Non-interactive steps** always run as subagents with `{model, effort}` resolved from config.
- **Single writer:** only the orchestrating session writes `events.jsonl` / `state.json`. Subagents return a short summary + output path.
- Subagents receive **paths and skill names, never content**.

### Step keys and built-in defaults

Defaults are capability classes, not model slugs: `frontier` (strongest reasoning model available), `code` (strong, balanced coding model), `fast` (cheapest fast model).

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

Resolution: `steps.{harness}.{key}` → `steps.{harness}.{parent}` (e.g. `review` for `review.security`) → built-in default → harness default.

### Config

Lookup: `.agentic.json` at project root, then `~/.agentic/config.json` (project wins; `steps` merged per harness and step key, `limits` per key, other top-level keys replaced).

```json
{
  "output": ".agentic/work",
  "commitWork": false,
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
```

- `{output}` defaults to `.agentic/work`, gitignored unless `commitWork: true`.
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
  "artifacts": { "spec": "spec.md", "plan": null },
  "escalations": [{ "id": "D4", "summary": "Exports stored 30 days", "status": "open", "ref": "docs/tech/adr/0007-export-retention.md" }],
  "tickets": { "parent": null, "tasks": {} },
  "pr": { "url": null, "round": 0 },
  "updated": "2026-10-26T13:52:00Z"
}
```

`status` ∈ `in_progress | awaiting_decision | blocked | done | failed`.

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

Bot comments: fix if valid, else reply with reason; resolve. Human comments: clear requests → fix, reply with commit link, resolve. Debatable / design-level → escalate to user. Never merges. Moves tickets to *In Review* when PR opens. Defers to a native harness loop (e.g. Cursor `autopilot`) when available.

### Ship-feature orchestration

Interactive until the last gate, autonomous after. Interrupts only for: limits hit, design-level PR comments, unfixable red tree.

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

## Consequences

- Existing `.agentic.json` files and `agentic-cli` stop working.
- Interactive steps' model depends on how the user launched the session.
- No formal verification yet; validated in real use, eval harness later.
