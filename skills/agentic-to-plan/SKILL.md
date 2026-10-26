---
name: agentic-to-plan
description: Turn a spec into an implementable technical plan (plan.md) of ordered vertical-slice tasks by gathering technical context and grilling design decisions. Use after agentic-to-spec, when you need architecture decisions before coding, or to plan a small change directly.
argument-hint: "<slug | spec.md path | text | file | ticket>"
---

# To Plan

Workflow 2. Turn `spec.md` into `plan.md`: how to build it, as tasks `agentic-implement` and `agentic-to-tickets` can consume.

`agentic-use-workflow` runs throughout: work-item folder, events and state, delegation, escalation gate, communication mode.

## 1. Input

- Slug or `spec.md` path → resume that work item. Open escalations → stop unless the user overrides (logged by `agentic-use-workflow`).
- No spec (text, file, ticket) → capture it like `agentic-to-spec` does into `input.md` and plan from it.

## 2. Context (additive)

Read the existing `context.md` and `decisions.md` first. Spawn in parallel, read-only, only for what is missing (`agentic-use-workflow` delegation):

- **context.code**: modules touched, patterns to follow, contracts, tests and prior art.
- **context.docs**: `docs/tech/principles.md`, ADR index and relevant ADRs, open RFCs (`agentic-use-knowledge`).
- **context.runtime**: performance, error rates, infra limits, when relevant and available.

Append cited sections to `context.md`; never redo what's there.

## 3. Grill

Run `agentic-grill` with focus `tech`. Decisions already in `decisions.md`, principles, and accepted ADRs are not re-asked.

## 4. Gate and promote

Run the escalation gate (`agentic-use-workflow`) on the new structural decisions. Revisit → back to `agentic-grill`. Then promote what was confirmed via `agentic-use-knowledge` (new principles, terms).

## 5. Write `plan.md`

Fill [references/plan.md](references/plan.md).

- Every structural decision is reflected, none reinterpreted. Cite `D#` and ADRs.
- Tasks are thin vertical slices: each cuts through every layer it needs, is verifiable alone, and fits one commit. Prefer many thin tasks over few thick ones.
- Every task has acceptance criteria tied to spec IDs. Tests come first.
- Present the task list and ask: granularity right? dependencies right? anything to split or merge? Iterate until approved.

Log an `artifact` event.

## Light mode

Called by `agentic-ship-feature` in light mode: skip context, grill, and gate (already done). Write `plan.md` straight from `input.md`, `context.md`, `decisions.md`, with the feature's acceptance criteria in the plan itself. For a bug, `T1` is a failing regression test.

## Handoff

Report the `plan.md` path and task count. Standalone → suggest `agentic-to-tickets {slug}` (optional) then `agentic-implement {slug}`. Under `agentic-ship-feature` → return.
