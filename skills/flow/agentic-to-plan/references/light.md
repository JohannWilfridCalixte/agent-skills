# Plan checklist and light branch

## Checklist (every plan)

Every task in `plan.md` has:

- **Goal**: observable outcome.
- **Files**: paths it writes.
- **Depends on**: task ids or none.
- **Skills**: extras beyond the profile, or `—`.
- **Acceptance**: criteria citing AC ids.

**Slice test**: a task is a vertical slice: its tests stand alone and its files stay inside one slice (one skill folder, one domain, one app). A task spanning slices names the cross-slice contract it implements, else split it. Split also when a task mixes concerns; never split just to shrink it.

**Ownership**: tasks whose Files overlap, or where one reads what another writes, are sequential (`Depends on`). Tasks with disjoint Files and no dependency run in parallel, one worktree each. Each file has one owning task.

## Light branch

Plans straight from `input.md`: no spec, no tech grill, no escalation gate. Steps 1 and 2 of the skill run as written (plus the Change addition below); this file replaces steps 3–5. Pick the rules:

- **Bug**: `diagnosis.md` exists.
- **Feature**: no `diagnosis.md`.
- **Change**: `state.json` `choices.branch` is `change`. Feature rules, plus Change on top.

Every branch writes `plan.md` per step 5, with the acceptance criteria in the plan itself (tasks cite those IDs), from `input.md`, `context.md`, `decisions.md` and `diagnosis.md` when present. Each branch below lists its exceptions.

## Bug

Decisions were made in `diagnosis.md`: no check, no questions.

- `T1` is a failing regression test at the seam named in `diagnosis.md`, citing its root cause: it goes red on this bug.
- Approval round as in step 5 (breakdown first).

Done when the user approved `plan.md` and `T1` names the seam and the root cause.

## Feature

1. **Check**: list the blocking questions, those whose answer changes the plan. Straightforward = 5 or fewer blocking questions, no ADR-worthy decision, no data migration, no public contract change, no new domain term, 5 tasks or fewer (estimated here, re-checked on `plan.md`). Not straightforward → return to the caller with the failed criteria, no plan. Done when every criterion is judged against `input.md`, `context.md` and `decisions.md`.
2. **Ask**: every blocking question not yet answered in `decisions.md`, in one exchange (AskUserQuestion when available), each with a recommendation. Append each answer to `decisions.md` as `focus: tech`, tagged by the decisions contract (`agentic-use-workflow` references/state.md), and log it. An answer tagged `structural` or breaking a criterion → not straightforward, return with that reason. Done when every blocking question has a `D#` entry.
3. **Write** `plan.md`:
   - Tasks: the thinnest vertical-slice split that stays at 5 tasks or fewer.
   - No approval round: the answers were the last gate.
   - More than 5 tasks anyway → not straightforward, return with the count, no `artifact` event.

Done when `plan.md` holds 5 tasks or fewer, every AC is cited by a task, and the `artifact` event is logged.

## Change

Feature rules on the delta, current to target behaviour:

- Step 2: `context.code` also captures the current behaviour exactly (rules, states, permissions, errors).
- Check and Ask judge the delta. Current behaviour not pinned by `context.md` → not straightforward.
- Acceptance criteria open with the current behaviour in a few cited lines; each changed criterion ends with `(was: {old outcome})`.
- Kept behaviour no test covers → `T1` pins it with a passing test.
