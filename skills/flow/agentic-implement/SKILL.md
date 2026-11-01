---
name: agentic-implement
description: Build a work item's tickets, plan tasks or review fix list into committed, green code, one commit per unit. Use when plan.md, tickets or a reviews/{n}-fix.md fix list are ready to build.
argument-hint: "<slug | path/to/plan.md | path/to/reviews/{n}-fix.md> [--override-escalations]"
---

# Implement

Turn units of work into committed, green code. You orchestrate; subagents write the code.

Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it) unless already loaded.

## 1. Start

- Open escalations → agentic-use-workflow references/state.md Resume step 0.
- No workspace → ask where to build and set it up per `agentic-use-workflow` Workspace. Everything below runs in `workspace.path`.
- Units `in_progress` in `state.json` `units` → recover each per [references/interrupted.md](references/interrupted.md) before the baseline.
- Uncommitted edits outside every interrupted unit's files → show them and ask. Never reset them.
- Find the project's checks (build, lint, typecheck, tests) from scripts, Makefile, CI config, docs, and run them. Red → stop and report.

Done when the workspace exists, no unit is `in_progress`, the tree holds no unexplained edits, and the baseline is green.

## 2. Units

First match wins:

- **Fix list**: a `reviews/{n}-fix.md` path from the caller → group its findings by disjoint files; one unit per group, id `fix-{n}.{k}`.
- **Tickets**: `state.json` `tickets` non-empty → one unit per ticket (`tickets/NN-slug.md` or tracker key).
- **Plan tasks**: `plan.md` `T1..Tn`.
- None → stop: the work item needs `agentic-to-plan` first.

Skip units `done` or `skipped` in `state.json` `units` and fix-list findings that carry a status. `failed` unit → a `unit.{task}` choice logged after its latest failure stands; else ask: retry or skip, logged as a `choice`, key `unit.{task}`, value `retry`, `skip` or the user's direction. A plan task or ticket missing acceptance criteria or files is a plan defect: ask. A fix-list unit's acceptance criteria are each finding's `rule` + `fix`, its files the findings' `location` paths.

Done when every pending unit is listed with its blocking edges (`Depends on`, ticket blockers).

## 3. Dispatch

Order by blocking edges. Sequential by default; parallel only when units are independent **and** their files are disjoint.

One subagent per unit, step key `implement`, agent label `impl-{unit}`, resolved model and effort. Its `started` line carries `data.files` = the unit's files. Brief per `agentic-use-workflow` delegation, every line filled (`Skills:` and `Progress:` copied verbatim, `run` and `harness` set), with, as paths:

- Workspace path, work-item path, the unit (task id in `plan.md`, ticket file or key, or fix-list path + finding ids), `spec.md` and `context.md` when present.
- Read `../implement/SKILL.md`, as an absolute path resolved from this skill's base directory, and follow it for this unit, skipping its code-review step: `agentic-review` covers it. The tracker is provided: the ticket file or key above. Pre-agreed seams = test seams in `plan.md` / `decisions.md`; the unit's acceptance criteria (step 2) are the behaviour to cover.
- Load skills: each profile skill and each of the unit's `Skills`.
- Stay inside the unit. Unplanned files or decisions go in the summary.
- Exactly one conventional commit for the unit, staging only its files, message citing the unit id, ticket key or finding ids.
- Fix-list unit: report each finding `fixed` or `disputed` with the reason.
- Return files, tests, commit sha, decisions, finding statuses.

## 4. Green gate

After each unit or parallel batch, run the full checks yourself.

- Green → log the gate, next unit.
- Red → failure output back to the same subagent (resume it, or brief a fresh one with the unit and the output). Its repair is a follow-up commit citing the unit.
- Still red after `limits.implement.retries` → log the subagent `failed`, then stop and ask: suggested direction, skip the unit, or abort. Log the answer as a `choice`, key `unit.{task}` (abort is never reused: resuming asks again).

Done when every unit is committed or `skipped` and the last gate is green.

## 5. Log

Per unit, append to `implementation.md`: what changed, commit, tests, decisions outside the plan, open issues.

Fix list: under each finding in `reviews/{n}-fix.md`, add its status line per the Fix list in agentic-review references/finding.md (`skipped` for a skipped unit).

## Done

Every unit committed or `skipped`, tree green, every fix-list finding carries a status. Return to the caller a summary: units, commits, deviations from the plan, disputed findings. Review is the caller's move; standalone → suggest `agentic-review`.
