---
name: agentic-to-plan
description: Plan a spec or request into plan.md, ordered vertical-slice tasks, after grilling tech decisions. Use after a spec, or before coding a change that needs design decisions.
argument-hint: "<slug | spec.md path | text | file | ticket>"
---

# To Plan

Turn `spec.md` into `plan.md`: how to build it, as units `agentic-implement` and `agentic-to-tickets` consume.

Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it) unless already loaded.

**Log**: first action `bun {agentic-use-workflow}/scripts/agentic.ts event --workflow to-plan --type started --summary "to-plan started"`; last action the same with `--type completed` (`--type failed` and the reason on failure). Handoff included.

**Light branch**: only when the caller asks for it (`agentic-debug`, or `agentic-implement-feature` / `agentic-change-feature` in light mode). Read [references/light.md](references/light.md) first, before step 1: its checklist applies to every plan, light or not; steps 1 and 2 run with its additions, then it replaces steps 3–5.

## 1. Input

- Slug or `spec.md` path → resume that work item. Open escalations → agentic-use-workflow references/state.md Resume step 0.
- No spec (text, file, ticket) → open a work item (`agentic-use-workflow` Work item) and plan from `input.md`.

Done when the sources are known: `spec.md` or `input.md`, plus `context.md`, `decisions.md`, and `diagnosis.md` when present.

## 2. Context (additive)

Read `context.md` and `decisions.md` first. For what is missing only, spawn in parallel per `agentic-use-workflow` Delegation, read-only, tech focus:

- **context.code**: modules touched, patterns to follow, contracts, tests, prior art, existing test seams.
- **context.docs**: loads `agentic-use-knowledge` (read mode): principles, relevant ADRs, open RFCs.
- **context.runtime**: performance, error rates, infra limits, when relevant and available.

Append cited sections to `context.md`.

Done when every module the work touches has cited context.

## 3. Grill

Call the Skill tool with "agentic-grill-tech".

Done when it returned with an empty frontier.

## 4. Gate and promote

Run the escalation gate (`agentic-use-workflow`) on the new structural decisions, promotion included (ADRs, principles, terms). Revisit → back to `agentic-grill-tech`.

List the decision ids first: `grep -o '^## D[0-9]*' {work}/decisions.md`. Every id is confirmed, escalated or minor-and-recorded; none is skipped because it looks settled.

Done when every id from that list is accounted for and the promotion is committed.

## 5. Write `plan.md`

Fill [references/plan.md](references/plan.md) in two passes.

**Breakdown**: tasks only: title, goal, files, depends-on, skills per [references/light.md](references/light.md) Checklist. Present the list and ask once: granularity right? dependencies right? anything to split or merge? Iterate until approved. No acceptance criteria before approval.

**Acceptance**: then write each task's acceptance, citing spec AC IDs, tests first.

- Every structural decision reflected, none reinterpreted. Cite `D#` and ADRs.
- Skills: the profile ones (`agentic-use-workflow` Config) arrive with every unit; list only extras beyond them: `agentic-clean-architecture` for business logic (domain, use cases, validation, state transitions), `agentic-write-instrumented-code` for logging or tracing, any other installed codestyle skill the task calls for. Never name a stack skill the profile already supplies; a repo codestyle skill, when the project has one, wins over any name here.

Log an `artifact` event.

Done when the user approved the breakdown, every spec AC is cited by at least one task, and the light.md checklist holds for every task.

## Handoff

Report the `plan.md` path and task count. Standalone → suggest `agentic-to-tickets {slug}` (optional), then `agentic-implement {slug}`. Under a playbook (`agentic-implement-feature`, `agentic-change-feature`, light included, `agentic-debug`) → return; a failed light check returns its failed criteria instead.
