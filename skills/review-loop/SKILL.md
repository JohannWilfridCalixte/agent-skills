---
name: agentic:workflow:review-loop
description: Use when code needs multi-angle review with iterative fix cycles. Called by implement, debug, and pr-review workflows. Not invoked directly by users.
---

# Review Loop

Sub-workflow. Runs review skills in parallel, fixes issues, re-reviews until clean or max iterations reached.

## Dependencies

Inherits from calling workflow: `output_path`, `technical_skills_prompt`, `workflow-state.yaml`.

## Parameters

The calling workflow **MUST** provide:

| Parameter | Type | Example |
|-----------|------|---------|
| `max_iterations` | int | `3` |
| `review_skills` | list | `[review-code, review-tests, review-security]` |

## Persona Mapping

| Review Skill | Persona |
|---|---|
| `agentic:skill:review-code` | `agentic:agent:qa` |
| `agentic:skill:review-tests` | `agentic:agent:qa` |
| `agentic:skill:review-security` | `agentic:agent:security-engineer` |

## Loop

### 1. Dispatch Reviews (Parallel)

For each skill in `review_skills`, spawn a subagent **in parallel**:

- **Persona**: per mapping above — subagent **MUST** read persona file first
- **Skill**: the review skill to apply (e.g., `agentic:skill:review-code`)
- **Skills**: pass `technical_skills_prompt`
- **Agent Type**: general purpose or default
- **Model**: QA_MODEL from agentic config
- **Output**: as defined by each review skill
- **Context**: pass available inputs (plan, implementation log, code diff)

### 2. Aggregate

Read all review outputs. Collect total blocker/major/minor/nit counts across all reviews.

### 3. Exit Check

```
IF zero blockers AND zero majors → exit PASS
IF iteration >= max_iterations → ask developer: keep fixing, create draft PR, or stop
ELSE → proceed to fix phase
```

### 4. Fix Phase (Parallel)

Collect all blocker + major issues from all reviews. Group into independent fix sets (non-overlapping files).

For each independent group, spawn a subagent **in parallel**:

- **Persona**: `agentic:agent:software-engineer`
- **Skills**: pass `technical_skills_prompt`
- **Agent Type**: general purpose or default
- **Model**: CODE_WRITING_MODEL from agentic config
- **Input**: issues to fix (location, description, suggested fix)
- **Instructions**: fix issues, run tests to verify no regressions

After all fix subagents complete, increment iteration → return to step 1.

## State

Update parent `workflow-state.yaml` after each iteration:

```yaml
review_loop:
  iteration: {n}
  status: "in_progress" | "passed" | "max_reached"
  rounds:
    - iteration: 1
      blockers: {n}
      majors: {n}
      minors: {n}
      nits: {n}
      verdict: "PASS" | "CHANGES_REQUESTED"
```
