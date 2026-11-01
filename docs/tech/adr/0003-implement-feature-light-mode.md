# 0003 - Feature light mode (implement and change): opt-in, checked

**Status:** Accepted
**Date:** 2026-11-01
**Supersedes (partially):** [0002](0002-skill-composition.md): light mode rejection, light branch reserved to `agentic-debug`

## Context

0002 dropped light mode: a global triage picked light or full for every request, and debug and change became explicit playbooks. Small features left: a one-endpoint addition still runs spec, product and functional grills, tech grill, gate and plan approval. Most of those questions have obvious answers; the few that change the plan get lost among them. Small changes to existing behaviour (a new filter value, a changed default) pay the same.

## Decision

### Opt-in

Light mode lives inside `agentic-implement-feature` and `agentic-change-feature` only, never a triage. The user opts in: `light` as the first argument, or mode light|full in the Start exchange (asked only when `light` wasn't passed; default full). Logged as `choice` `mode`, undotted, reused on resume. Light mode skips the tickets question.

### Check

`agentic-to-plan`'s light branch serves `agentic-debug` (unchanged, plan approval included) and both feature playbooks in light mode. For a feature: no spec, plan from `input.md`, context step still runs, then list the blocking questions (answers that change the plan).

Straightforward = 5 or fewer blocking questions, no ADR-worthy decision, no data migration, no public contract change, no new domain term, 5 tasks or fewer (estimated, then re-checked on the written `plan.md`).

- Straightforward → all blocking questions in one exchange, each answer in `decisions.md` (`focus: tech`); an answer tagged `structural` fails the check; `plan.md` carries its own ACs. Those answers are the last gate: no spec, no grill, no plan approval. Summary, resume command, autonomous.
- Not straightforward → to-plan returns the failed criteria; the playbook says why and offers switching to full (`choice` `mode` = `full`, plus the `tickets` answer asked with it), continuing from `agentic-to-spec`. Never silent.

Feature T1 is not a regression test; that stays bug-only.

### Change

`agentic-implement-feature` logs `choice` `branch` at start, both modes: `change` under its `agentic-change-feature` alias, `new` otherwise; to-spec reuses it. to-plan keys its change rules on it, caller-agnostic, on top of the feature rules:

- `context.code` pins the current behaviour exactly; not pinned → fails the check.
- Check and questions judge the delta, current to target. Altering a public contract already fails.
- `plan.md` ACs open with the current behaviour in a few cited lines; changed ACs end with `(was: …)`. Kept behaviour no test covers → T1 pins it with a passing test.

### Tail and resume

Tail unchanged: implement → review (fix loop) → babysit-pr → cleanup. Light steps: `start`, `to-plan`, `implement`, `review`, `babysit-pr`, `cleanup`; the existing resume contract applies (`mode` rules out `to-spec`, `to-tickets`). Interrupted mid-questions → only unanswered ones are asked again, from `decisions.md`.

`agentic-review` briefs `code-review` with `plan.md` as the spec when there is no `spec.md`.

## Rationale

- The user knows when a feature is small; the check catches when they're wrong, before any code.
- The criteria name what full mode's gates exist for (structural decisions, migrations, contracts, domain language); a feature with none of them gains nothing from those gates.
- One exchange of blocking questions keeps the user's judgement where it changes the plan, and nowhere else.
- Reusing to-plan's light branch keeps one planning path for every caller.
- A change's current-vs-target record shrinks to cited ACs in `plan.md`; the spec's full Current behaviour section earns its cost only when the delta needs grilling.

## Alternatives Considered

- **Global triage (v2 light mode)**: rejected again; the user picks the mode per request, and 0002's explicit playbooks stay the entry points.
- **Change-feature light as a separate to-plan branch**: rejected; it differs from feature rules by three lines.
- **Change T1 always a characterization test of the old behaviour**: rejected; the task that changes it rewrites that test at once. Only kept, uncovered behaviour gets pinned.
- **Silent fallback to full**: rejected; the user opted in, so leaving light is their call.
- **Plan approval in light mode**: rejected; a straightforward plan follows from the answers, and the review loop still runs.

## Consequences

- Light features and changes have no `spec.md`; reviewers judge against `plan.md`'s ACs.
- Thresholds (5 questions, 5 tasks) are judgement calls; tune them in to-plan's light branch.
- A failed check costs a context pass before full mode; the context is kept (`context.md` is additive).
- A light run has no escalation gate: any answer tagged `structural` sends the feature to full mode, where the gate runs.

## History

| Date | Change |
|---|---|
| 2026-11-01 | Created |
