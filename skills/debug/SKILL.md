---
name: agentic:workflow:debug
description: Use when debugging bug reports, CI failures, test failures, runtime errors, or flaky tests. Triggers - error logs, stack traces, failing tests, unexpected behavior, GitHub issue with bug label.
argument-hint: "[<error.log | #issue | URL | error description>]"
---

# Debug

Systematic debugging from bug report to verified fix. Evidence-based investigation, TDD-aligned regression test, hypothesis-driven fix loop.

## Dependencies

You **MUST** load these before proceeding:

- `/agentic:skill:use-agentic` — config + constants
- `/agentic:skill:use-workflow` — state tracking + step sequencing

## Input Handling

Parse the invocation argument:

- No args → **ERROR**: input required. Show usage: `/agentic:workflow:debug <error.log | #issue | URL | description>`
- File path → read the file (log, error output, bug report)
- `#123` or GitHub URL → fetch the issue (`gh issue view`)
- Inline text → use directly

Write raw input to `{output_path}/bug-report.md`.

## Workflow Init

Initialize via use-workflow (generates run ID, creates output dir, writes initial workflow-state.yaml), then load step 1.

## Steps

| Step | File | Intent |
|------|------|--------|
| 1 | `steps/step-01-investigate.md` | Gather evidence, trace failure, produce investigation-report.md |
| 2 | `steps/step-02-regression-test.md` | Write FAILING test that reproduces the bug |
| 3 | `steps/step-03-hypothesis-fix-loop.md` | Hypothesize root cause → fix → run test → loop until pass (max 3) |
| 4 | `steps/step-04-verify.md` | Run review-loop with review-code + review-tests |

## Key Rules

**CRITICAL**: You **MUST** ALWAYS respect the following rules during this workflow execution:

- **Evidence before hypothesis**: no guessing — investigate first, gather evidence, then hypothesize
- **One hypothesis at a time**: never bundle multiple fix attempts
- **Test before fix**: regression test MUST exist and FAIL before any fix attempt
- **Three strikes = escalate**: 3 failed hypothesis-fix iterations → escalate to human, likely architectural
- **Orchestrator only**: delegate all technical work via subagents, never investigate or fix yourself

## Red Flags — STOP

If you catch yourself thinking:

- "Quick fix for now" → return to evidence
- "Just try changing X" → form a proper hypothesis first
- "It's probably X" → where's the evidence?
- "One more fix attempt" (after 3) → escalate

## Artifacts

| Artifact | Description |
|----------|-------------|
| `bug-report.md` | Raw input preserved |
| `investigation-report.md` | Evidence from investigation (template in `references/investigation-report.md`) |
| `hypothesis-log.md` | Hypotheses tested with results |
| `fix-log.md` | Fix implementation details |

## Start

Load `steps/step-01-investigate.md`.
