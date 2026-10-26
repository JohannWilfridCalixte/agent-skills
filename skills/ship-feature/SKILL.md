---
name: ship-feature
description: Take a feature or bug from raw input to a merge-ready PR by chaining to-spec, to-plan, optional to-tickets, implement, review, and babysit-pr, with a light or full track. Interactive until the last gate, autonomous after. Resumable by slug. Use when the user wants a change shipped end to end.
argument-hint: "<text | file | ticket key | URL | slug> [--light | --full]"
---

# Ship Feature

Orchestrator. Chains the workflows by name and owns only triage, sequencing, and the hand-offs between them. `use-workflow` tracks phases, events, state, and escalations.

## Start or resume

- Argument is an existing slug → resume at the `phase` recorded in `state.json`.
- Open escalations → stop and say which decision blocks. Continue only if the user overrides (logged by `use-workflow`).
- Otherwise run the capture and context parts of `to-spec`.

## Triage

Propose light or full with a one-line why, then get the user's confirmation. `--light` / `--full` skip the question. Log the mode as a `decision` event and record it in state.

- **Light**: bug fix or small change, one area, no new data model, public contract, or security surface, behaviour already clear.
- **Full**: new user-facing behaviour, several areas, data or contract changes, fuzzy scope.

In the same exchange, ask whether to push tickets with `to-tickets`, and to which tracker.

## Full track

1. `to-spec`: grill product + functional, gate, `spec.md`, promote.
2. `to-plan`: grill tech, gate, promote, `plan.md`.
3. `to-tickets` if chosen.
4. `implement` → `review` → `babysit-pr`.

## Light track

1. `grill` with focus `combined`: blocking questions only, ~3 max.
2. Escalation gate (`use-workflow`) only if an irreversible decision came up.
3. `to-plan` in light mode: single `plan.md` with acceptance criteria. For a bug, `T1` is a failing regression test.
4. `to-tickets` if chosen.
5. `implement` → `review` → `babysit-pr`. Never skipped.

## Autonomy

Interactive until the last gate (the `to-plan` gate in full, the combined grill or its gate in light). After that, run to the end without asking. Interrupt only when:

- a limit from config is hit,
- a design-level PR comment needs a human,
- the tree is red and can't be fixed,
- a new escalation opens.

An escalation during a gate stops the chain with status `awaiting_decision`. Tell the user to re-run `ship-feature {slug}` once the decision is made.

## Finish

Report the PR link, ticket keys, artifacts, and anything deferred or escalated. Never merge.
