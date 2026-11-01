---
name: agentic-implement-feature
description: Build a new feature, from request to merged PR; `light` for a small one.
disable-model-invocation: true
argument-hint: "[light] <text | file | ticket key | URL | slug>"
---

# Implement Feature

Playbook: up-front questions and mode, then the flow skills in order, then autonomy.

**Spec branch** (`choices.branch`), **workflow** and **resume command skill**: run by agentic-change-feature → `change`, `change-feature`, `agentic-change-feature`; otherwise `new`, `implement-feature`, `agentic-implement-feature`.

**Modes**: **full** (default) runs spec, plan and optional tickets, each with its own gates. **light** skips spec, grill and plan approval: agentic-to-plan checks the request is straightforward and asks its blocking questions in one exchange; those answers are the last gate.

## 1. Start

Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it), then run Start from its `references/playbook.md` with this run's workflow.

Log `choice` `branch` = this run's spec branch without asking: agentic-to-spec and agentic-to-plan read it instead of classifying. First argument `light` → mode is light, logged without asking. In one exchange, ask what is still unanswered:

- **mode**: light or full (default), only when `light` wasn't passed;
- **tickets**: break the plan into tickets with agentic-to-tickets, yes or no; full mode only;
- **workspace**: where to build, per agentic-use-workflow (worktree recommended, branch `feat/{slug}`).

Set the workspace up now, untracked-file question included. Done when `state.json` holds `choices.branch`, `choices.mode`, `choices.tickets` in full mode (each logged as a `choice` decision) and `workspace`; log step `start` `completed`.

## 2. Plan (interactive)

Full mode:

1. Call the Skill tool with "agentic-to-spec".
2. Call the Skill tool with "agentic-to-plan".
3. Tickets chosen → Call the Skill tool with "agentic-to-tickets".

Light mode:

1. Call the Skill tool with "agentic-to-plan" and take its light branch.
2. Returned not straightforward → log step `to-plan` `failed` with its reasons, tell the user why and offer switching to full, with the tickets question in the same exchange. Yes → log `choice` `mode` = `full` and `choice` `tickets` = the answer, then run full mode. No → stop with the resume command.
3. `plan.md` written → show a short summary: current behaviour (branch `change` only), approach, then one line per task.

Done when `plan.md` is approved (full) or written (light) and, if chosen, the ticket breakdown is approved and published. That was the last gate.

## 3. Build (autonomous)

Run the autonomous tail (agentic-use-workflow `references/playbook.md`); no merge-ready extras.
