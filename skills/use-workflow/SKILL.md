---
name: use-workflow
description: Shared runtime for the agentic workflows (to-spec, to-plan, to-tickets, implement, review, babysit-pr, ship-feature). Use when running any of them, or when a step needs config, per-step model/effort, subagent delegation, work-item state, resume by slug, or the escalation gate.
---

# Use Workflow

Runtime every workflow loads first. Owns config, delegation, work-item state, the escalation gate and the communication mode. Contracts read by other steps or outside tooling live in `references/`; follow them exactly.

## Config

Load `.agentic.json` (project root) then `~/.agentic/config.json`; project wins, `steps` and `limits` merged per key. Nothing found → built-in defaults, say so once. Schema, defaults, limits: [references/config.md](references/config.md).

Harness key is `cursor`, `claude` or `codex`, from your own runtime. Unsure → ask.

Profiles: use `selectedProfiles`. Empty → propose the profiles whose `detect` files exist, confirm. Their `skills` are the codestyle skills for every step that writes or judges code.

## Step → model and effort

Every step has a key (`grill`, `implement`, `review.security`, …). Resolve `model` and `effort` each on its own: `steps.{harness}.{key}` → `steps.{harness}.{parent}` → built-in default → harness default. Built-in defaults are capability classes (`frontier`, `code`, `fast`); map each to the closest model the harness offers.

- Interactive steps (capture, grill, gate, triage) stay in the main session. Resolved value is a recommendation: warn once if the session runs something else, then go on.
- Non-interactive steps always run as subagents with the resolved `{model, effort}`.

## Delegation

One subagent per step key; parallel when independent (no shared writes, no ordering). Use the harness's native subagent, model and effort controls: [references/delegation.md](references/delegation.md).

Pass paths and skill names, never content: work-item path, inputs, output path, step skill, profile codestyle skills when code is written or judged. `context.*` steps use read-only subagents.

Subagents never touch `events.jsonl` or `state.json`. Writing subagents return a short summary + output path. Read-only subagents return cited findings; you write them to the target file (e.g. the matching `context.md` section).

## Work item

`{output}/{YYYYMMDD}-{slug}/`, layout in [references/state.md](references/state.md).

- No slug → new work item: short kebab slug from the request, create the folder, write the raw request to `input.md`.
- Slug given → folder named `{slug}` or ending in `-{slug}`; resume from `state.json`. Several matches → ask.
- Keep `{output}` in `.gitignore` unless `commitWork: true`.

## Events and state

The orchestrating session is the only writer. For every step start/end, decision, artifact, gate, escalation: append one line to `events.jsonl`, then rewrite `state.json` from the log. `state.json` never holds what the log lacks; on disagreement the log wins, rebuild. New 4-hex `run` id per workflow invocation. Log the model and effort actually used.

Step fails → `failed` event, tell the user, never silently continue.

## Escalation gate

Runs at the end of every grill. From `decisions.md`, list `structural` decisions with why each is flagged: reversibility cost, blast radius (data, public contract, security, cost), rejected alternatives. None → log the gate as passed, move on. Per decision the user picks:

- **confirm** → ADR `Accepted` via `use-knowledge`.
- **escalate** → ADR `Proposed` or RFC via `use-knowledge`, optionally shared through available tools (chat, tracker). Escalation `open`, status `awaiting_decision`.
- **revisit** → back to grill on that decision.

Promote to `docs/` via `use-knowledge` right after the gate; nothing unconfirmed lands there before. A workflow starting on a work item with open escalations refuses unless the user overrides; log the override. When an escalation is settled later, update the ADR/RFC via `use-knowledge` and log it `resolved`.

## Communication mode

While a workflow runs, talk compressed: drop articles, filler, hedging. Fragments OK ("3 files changed. Tests green."). Technical terms, paths, APIs, type names exact.

Normal prose for security warnings, irreversible actions, and anything the user could misread. Code, docs, commits, PR text: always normal prose.
