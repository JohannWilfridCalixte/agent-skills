---
name: agentic-debug
description: Fix a bug end to end (diagnose the root cause, regression test first, implement, review, babysit PR, cleanup).
disable-model-invocation: true
argument-hint: "<bug report | file | ticket key | URL | slug>"
---

# Debug

Playbook. Diagnose first, then fix through the regular flow with a failing regression test as the first task.

## 1. Start

Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it), then run Start from its `references/playbook.md`, workflow `debug`.

No workspace yet → ask where to build, per agentic-use-workflow (worktree recommended, branch `fix/{slug}`), and set the workspace up now, untracked-file question included. Done when `workspace` is in `state.json`; log step `start` `completed`.

## 2. Diagnose (interactive)

Call the Skill tool with "diagnosing-bugs", working in `workspace.path`. Run Phases 1–4. From Phase 5 (Fix + regression test) apply only the correct-seam judgement; from Phase 6 (Cleanup) only removing the `[DEBUG-…]` instrumentation (grep the prefix). The regression test and the fix run through the plan below.

Loop scripts, harnesses, fixtures and captured artifacts go in `{work}/debug/`. A loop file that must sit in the tree (a test) → copy it to `{work}/debug/`, then remove it from `workspace.path`: T1 rebuilds it.

Write `diagnosis.md` in the work item: symptom, the red loop (command, with its `{work}/debug/` paths), minimal repro, root cause with `file:line` evidence, hypotheses ruled out, the seam for the regression test (or the finding that no correct seam exists). Done when the user confirms the root cause, `git status --porcelain` in `workspace.path` lists no file the diagnosis added or changed, and `diagnosis.md` is logged as an `artifact` event.

## 3. Plan

No correct seam in `diagnosis.md` → judge it again on the current code first (a resume may follow a deepening). Still none → ask: test at the closest seam with the gap noted in `plan.md`, or stop with the resume command and deepen the module first (codebase-design). Log the answer as `choice` `seam.{run}`. Closest → write that seam and its gap into `diagnosis.md`.

Call the Skill tool with "agentic-to-plan" and take its light branch, bug rules, passing the gap when there is one. Done when `plan.md` is approved. That was the last gate.

## 4. Fix (autonomous)

Run the autonomous tail (agentic-use-workflow `references/playbook.md`); merge-ready extras: the root cause from `diagnosis.md`.
