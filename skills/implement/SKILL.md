---
name: agentic:workflow:implement
description: Use when implementing from a technical plan (from agentic:workflow:technical-planning or planning mode). Triggers - "implement this plan", "implement technical plan", planning run dir provided.
argument-hint: "<path/to/planning-run-dir>"
---

# Implement from Technical Plan

Takes a **planning run dir** (technical-plan.md + tickets/) and implements it ticket by ticket: code, tests, review, commit, PR. Plan and tickets must already exist — this workflow does NOT create them.

## Dependencies

You **MUST** load these before proceeding:

- `/agentic:skill:use-agentic` — config + constants
- `/agentic:skill:use-workflow` — state tracking + step sequencing

## Input Handling

Argument = planning run dir produced by `/agentic:workflow:technical-planning`, containing:

- `technical-plan.md` — required
- `tickets/*.md` — required, ≥1 ticket
- `prd.md` — optional, read-only context

Ticket file format:

```
# NN — {Title}
**What to build:** ...
**Blocked by:** {NN, NN | None — can start immediately}
**Status:** ready | in_progress | committed
## Acceptance criteria
- [ ] ...
## Tech notes
...
```

No arg or invalid dir → **HALT** (see Hard Gate below).

## Hard Gate: Planning Run Dir Required

**This workflow MUST NOT start without a valid planning run dir.**

Valid input = dir with `technical-plan.md` AND `tickets/` containing ≥1 ticket with the fields above. If not:

> **STOP.** This workflow requires a planning run dir (technical-plan.md + tickets/).
>
> Create one first: `/agentic:workflow:technical-planning`
>
> Then re-invoke `/agentic:workflow:implement` with the resulting run dir.

**Do NOT proceed. Do NOT offer to create the plan or tickets yourself. Halt.**

## Orchestrator Role

You are the **orchestrator**. You coordinate subagents and manage workflow state.

**You MUST delegate all code work.** You never write code, tests, or reviews yourself. If you catch yourself doing agent work, STOP and delegate.

**Git is orchestrator-only.** Subagents MUST NEVER run git commands. You pass names and paths, never content.

## Workflow Init

Initialize via use-workflow (generates run ID, creates output dir, writes initial workflow-state.yaml), then load step 1.

## Steps

| Step | File | Intent |
|------|------|--------|
| 1 | `steps/step-01-validate.md` | Validate run dir, resolve skills, dependency graph, feature branch |
| 2 | `steps/step-02-process-tickets.md` | Frontier loop: implement → review → commit per ticket |
| 3 | `steps/step-03-finalize.md` | Push, PR, PR-level review loop |

## Key Rules

**CRITICAL**: You MUST ALWAYS respect the following rules during this workflow execution:

- **Delegate everything**: all code, test, and review work goes to subagents
- **Autonomous for steps 1-2 after branch confirm**: log decisions, don't ask the developer
- **Interactive for the PR question** in step 3
- **One step at a time**: complete current step before loading next
- **Commits strictly serialized**: one commit gate at a time, orchestrator only

## Artifacts

| Artifact | Description |
|----------|-------------|
| `implementation-log-{NN}.md` | Per-ticket log: changes, tests, decisions, issues |
| `follow-ups.md` | Out-of-scope discoveries as proposed tickets |

## Start

Load `steps/step-01-validate.md`.
