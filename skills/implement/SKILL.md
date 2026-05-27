---
name: agentic:workflow:implement
description: Use when implementing from a technical plan (from agentic:workflow:technical-planning or planning mode). Triggers - "implement this plan", "implement technical plan", technical plan file provided.
argument-hint: "<path/to/technical-plan.md | technical plan in context>"
---

# Implement from Technical Plan

Takes a **technical plan** and implements it: code, tests, review, optional PR. The plan must already exist — this workflow does NOT create plans.

## Dependencies

You **MUST** load these before proceeding:

- `/agentic:skill:use-agentic` — config + constants
- `/agentic:skill:use-workflow` — state tracking + step sequencing

## Input Handling

Parse the invocation argument:

- File path → read the file
- Technical plan in conversation context → use directly
- No args or non-plan input → **HALT** (see Hard Gate below)

Write raw input to `{output_path}/input-plan.md`.

## Hard Gate: Technical Plan Required

**This workflow MUST NOT start without a valid technical plan.**

A valid plan has: task breakdown, file change areas, and implementation steps. If the input lacks these:

> **STOP.** This workflow requires a technical plan.
>
> Create one first: `/agentic:workflow:technical-planning`
>
> Then re-invoke `/agentic:workflow:implement` with the resulting plan.

**Do NOT proceed. Do NOT offer to create the plan yourself. Halt.**

## Orchestrator Role

You are the **orchestrator**. You coordinate subagents and manage workflow state.

**You MUST delegate all code work.** You never write code, tests, or reviews yourself. If you catch yourself doing agent work, STOP and delegate.

## Workflow Init

Initialize via use-workflow (generates run ID, creates output dir, writes initial workflow-state.yaml), then load step 1.

## Steps

| Step | File | Intent |
|------|------|--------|
| 1 | `steps/step-01-validate-plan.md` | Validate plan completeness, resolve skills |
| 2 | `steps/step-02-implement.md` | Software engineer implements code + tests |
| 3 | `steps/step-03-review-loop.md` | Review loop: code + tests + security |
| 4 | `steps/step-04-finalize.md` | Optional PR creation or handoff |

## Key Rules

**CRITICAL**: You MUST ALWAYS respect the following rules during this workflow execution:

- **Delegate everything**: all code, test, and review work goes to subagents
- **Autonomous for steps 1-3**: log decisions, don't ask the developer
- **Interactive for step 4**: ask the developer about PR/branch creation
- **One step at a time**: complete current step before loading next

## Artifacts

| Artifact | Description |
|----------|-------------|
| `input-plan.md` | Input technical plan (copied) |
| `implementation-log.md` | What was implemented + decisions |

## Start

Load `steps/step-01-validate-plan.md`.
