---
name: agentic-ship-feature
description: Take a feature or bug from raw input to a merged PR by chaining agentic-to-spec, agentic-to-plan, optional agentic-to-tickets, agentic-implement, agentic-review, agentic-babysit-pr and agentic-cleanup, with a light or full track, in a worktree by default. Interactive until the last gate, autonomous after. Never merges. Resumable by slug. Use when the user wants a change shipped end to end.
argument-hint: "<text | file | ticket key | URL | slug> [--light | --full]"
---

# Ship Feature

Orchestrator. Chains the workflows by name and owns only triage, sequencing, and the hand-offs between them. `agentic-use-workflow` tracks phases, events, state, escalations and the workspace.

## Start or resume

- Argument is an existing slug → resume at the `phase` recorded in `state.json`.
- Open escalations → stop and say which decision blocks. Continue only if the user overrides (logged by `agentic-use-workflow`).
- Otherwise run the capture and context parts of `agentic-to-spec`.

## Triage

Propose light or full with a one-line why, then get the user's confirmation. `--light` / `--full` skip the question. Log the mode as a `decision` event and record it in state.

- **Light**: bug fix or small change, one area, no new data model, public contract, or security surface, behaviour already clear.
- **Full**: new user-facing behaviour, several areas, data or contract changes, fuzzy scope.

In the same exchange, ask:

- whether to push tickets with `agentic-to-tickets`, and to which tracker;
- where to build the code: **worktree** (default, recommended), **current branch**, or **another branch** (existing or new).

Set the workspace up right away (`agentic-use-workflow` Workspace), including the question about copying untracked local files: nothing may need asking once the chain runs autonomously.

## Full track

1. `agentic-to-spec`: grill product + functional, gate, `spec.md`, promote.
2. `agentic-to-plan`: grill tech, gate, promote, `plan.md`.
3. `agentic-to-tickets` if chosen.
4. `agentic-implement` → `agentic-review` → `agentic-babysit-pr`.

## Light track

1. `agentic-grill` with focus `combined`: blocking questions only, ~3 max.
2. Escalation gate (`agentic-use-workflow`) only if an irreversible decision came up.
3. `agentic-to-plan` in light mode: single `plan.md` with acceptance criteria. For a bug, `T1` is a failing regression test.
4. `agentic-to-tickets` if chosen.
5. `agentic-implement` → `agentic-review` → `agentic-babysit-pr`. Never skipped.

## Autonomy

Interactive until the last gate (the `agentic-to-plan` gate in full, the combined grill or its gate in light). After that, run to the end without asking. Interrupt only when:

- a limit from config is hit,
- a design-level PR comment needs a human,
- the tree is red and can't be fixed,
- a new escalation opens,
- the PR is closed without merge, or cleanup finds unmerged, uncommitted or unpushed work.

An escalation during a gate stops the chain with status `awaiting_decision`. Tell the user to re-run `agentic-ship-feature {slug}` once the decision is made.

## Finish

At merge-ready, report the PR link, ticket keys, artifacts, and anything deferred or escalated. Never merge.

`agentic-babysit-pr` keeps watching until the PR is merged or closed. Then log `ship-feature` completed and run `agentic-cleanup {slug}`: it archives the folder, so nothing is logged after it.
