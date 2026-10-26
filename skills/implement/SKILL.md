---
name: implement
description: Implement a plan task by task with one subagent per task, tests first, one commit per task, and a green gate between tasks. Use when a plan.md exists (from to-plan or light mode) and the code should be written, or to resume implementation of a work item.
argument-hint: "<work-item slug | path/to/plan.md> [--override-escalations]"
---

# Implement

Turn `plan.md` into committed, green code. You orchestrate; subagents write the code.

Load `use-workflow` first. It owns config, step resolution, delegation, the work-item folder, the event log, limits and communication mode.

## Start

- Slug → resume that work item. Path to a `plan.md` → new work item seeded with it. No plan → stop and point to `to-plan`.
- Open escalations → list them and stop unless the user overrides (logged by `use-workflow`).
- Read the tasks from `plan.md` (`T1..Tn`: goal, files, depends on, acceptance, ticket). Skip tasks already committed and logged. A task without acceptance criteria or files is a plan defect: ask, don't guess.
- Find the project's checks (build, lint, typecheck, tests) from scripts, Makefile, CI config, docs. Run them. Red → stop and report. Never start a task on a red tree.

## Tasks

Order by depends-on. Sequential by default; run tasks in parallel only when they are independent **and** their files are disjoint.

One subagent per task, step key `implement`. Give it paths, not content: `plan.md` and the task id, `spec.md` / `context.md` when present, and the skills to load: the profile codestyle skills and `code-testing`. Its brief:

- Tests first wherever behaviour is testable: failing test, see it fail, make it pass. Bug fix → the first test reproduces the bug.
- Stay within the task. Unplanned files or decisions go in the summary, not silently into the diff.
- Run the relevant checks, then make exactly one commit for the task, staging only its own files. Conventional message, ticket key when the task has one.
- Return a short summary: files, tests, decisions, commit sha.

## Green gate

After each task (or parallel batch), run the full project checks yourself.

- Green → log, next task.
- Red → hand the failure output back to the same subagent (resume it, or brief a fresh one with the task and the output). Fix from evidence, one hypothesis at a time, revert attempts that don't work. Fixes land in the task's commit or a follow-up commit referencing it.
- Still red after `limits.implement.retries` → stop and ask: suggested direction, skip the task, or abort.

## Log

Append to `implementation.md` per task: what changed, commit, tests, decisions outside the plan, open issues. Free-form.

## Done

All tasks committed, tree green. Summarize tasks, commits and deviations from the plan, then hand off to `review`.
