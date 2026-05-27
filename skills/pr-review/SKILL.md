---
name: agentic:workflow:pr-review
description: Use when reviewing pull requests for quality and security. Triggers - review PR, code review, PR number or URL provided, batch review multiple PRs.
argument-hint: "<PR ref> [<PR ref> ...]"
---

# PR Review

Reviews pull requests using parallel QA and security review agents.

## Dependencies

You **MUST** load these before proceeding:

- `/agentic:skill:use-agentic` — config + constants
- `/agentic:skill:use-workflow` — state tracking + step sequencing

## Input Handling

Parse invocation arguments:

- No args → **ERROR**: PR reference required. Show usage: `/agentic:workflow:pr-review <PR ref> [<PR ref> ...]`
- `123` or `#123` → PR number (current repo)
- `https://github.com/owner/repo/pull/123` → full PR URL
- `owner/repo#123` → cross-repo PR reference
- Multiple args → batch mode (parallel reviews)

## Route

**Single PR**: steps 1→2→3 sequentially.

**Batch**: step 1 classifies all PRs + asks preferences once, then dispatches one subagent per PR running steps 1.5 (preferences already resolved)→2→3 in parallel. Collect all results at end.

## Steps

| Step | File | Intent |
|------|------|--------|
| 1 | `steps/step-01-gather-context.md` | Verify PR exists, extract diff/metadata, ask output mode + verbosity, delegate context gathering to architect |
| 2 | `steps/step-02-review-loop.md` | Run `/agentic:workflow:review-loop` (max 1 iteration) |
| 3 | `steps/step-03-report.md` | Aggregate findings, deliver in chosen output mode |

## Key Rules

**CRITICAL**: You **MUST** ALWAYS respect the following rules during this workflow execution:

- **Orchestrator only**: delegate all reviews, never review code yourself
- **Subagent delegation**: all technical work via subagents (`agentic:agent:architect` for context, `/agentic:workflow:review-loop` for reviews)
- **One step at a time**: complete each step before loading next
- **Track state**: update workflow-state.yaml after each step

## Artifacts

| Artifact | Description |
|----------|-------------|
| `pr-metadata.md` | PR title, description, author, files changed |
| `pr-diff.patch` | Full PR diff |
| `technical-context.md` | Codebase context from architect |
| `review-report.md` | Aggregated review (template in `references/review-report.md`) |

## Start

Load `steps/step-01-gather-context.md`.
