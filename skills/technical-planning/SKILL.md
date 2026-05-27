---
name: agentic:workflow:technical-planning
description: Use when transforming specs, ideas, or issues into detailed technical plans. Triggers - need technical plan, want architecture decisions before coding, need to resolve all open questions before implementation.
argument-hint: "[<spec.md | #issue | URL | inline description>]"
---

# Technical Planning

Transform any input (spec, idea, issue, description) into a detailed technical plan by gathering codebase context, grilling the developer on every design decision, and producing an implementable plan.

## Dependencies

You **MUST** load these before proceeding:

- `/agentic:skill:use-agentic` — config + constants
- `/agentic:skill:use-workflow` — state tracking + step sequencing

## Input Handling

Parse the invocation argument:

- No args → ask what to plan
- File path → read the file
- `#123` or GitHub URL → fetch the issue (`gh issue view`)
- Inline text → use directly

Write raw input to `{output_path}/input.md`.

## Workflow Init

Initialize via use-workflow (generates run ID, creates output dir, writes initial workflow-state.yaml), then load step 1.

## Steps

| Step | File | Intent |
|------|------|--------|
| 1 | `steps/step-01-gather-context.md` | Architect explores codebase → technical-context.md |
| 2 | `steps/step-02-grill.md` | Grill developer on every design decision |
| 3 | `steps/step-03-generate-plan.md` | Generate implementable plan → technical-plan.md |
| 4 | `steps/step-04-handoff.md` | Summarize artifacts + suggest implement workflow |

## Key Rules

**CRITICAL**: You MUST ALWAYS respect the following rules during this workflow execution:

- **Always interactive**: developer answers every structural question. No auto mode.
- **Gate rule**: no plan generation while structural open questions remain
- **Subagent for exploration**: delegate codebase work to architect, never do it yourself

## Artifacts

| Artifact | Description |
|----------|-------------|
| `input.md` | Raw input spec |
| `technical-context.md` | Codebase analysis from Architect |
| `technical-decisions.md` | All developer decisions from grilling |
| `technical-plan.md` | Final implementable plan |

## Start

Load `steps/step-01-gather-context.md`.
