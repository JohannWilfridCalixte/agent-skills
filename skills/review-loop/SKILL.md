---
name: agentic:workflow:review-loop
description: Use when code needs multi-angle review with iterative fix cycles. Called by implement, debug, and pr-review workflows. Not invoked directly by users.
---

# Review Loop

Sub-workflow. Runs review skills in parallel, fixes issues, re-reviews until clean or max iterations reached.

## Dependencies

Inherits from calling workflow: `output_path`, `technical_skills_prompt`, `workflow-state.yaml`.

If `output_path`, `technical_skills_prompt` and `workflow-state.yaml` not found, you **MUST** load these before proceeding:
- `/agentic:skill:use-agentic` — config + constants
- `/agentic:skill:use-workflow` — state tracking + step sequencing

## Parameters

The calling workflow **MUST** provide:

| Parameter | Type | Example |
|-----------|------|---------|
| `max_iterations` | int | `3` |
| `review_skills` | list | `[agentic:skill:review-code, agentic:skill:review-tests, agentic:skill:review-security]` |

Optional (defaults preserve single-invocation behavior):

| Parameter | Default | Example |
|-----------|---------|---------|
| `diff_scope` | full working diff | file list, commit range (`abc..def`), full branch diff |
| `state_key` | `review_loop` | `review_loop.tickets.03`, `review_loop.pr` |

- `diff_scope` — what reviewers see. Pass to every review subagent.
- `state_key` — nesting in `workflow-state.yaml`. Lets one parent run invoke this loop N times (e.g., per ticket + per PR); each invocation owns its own iteration counter and rounds under its key.

## Output Naming

Reviewers write `review-{skill}[-{scope}]-{iteration}.md`. `{scope}` derives from `state_key` so concurrent invocations never collide:

| `state_key` | `{scope}` | Example |
|---|---|---|
| `review_loop` (default) | none | `review-code-1.md` |
| `review_loop.tickets.03` | `t03` | `review-code-t03-1.md` |
| `review_loop.pr` | `pr` | `review-code-pr-1.md` |

Rule: scope = sub-path after `review_loop.`, collection segments abbreviated to first letter (`tickets.03` → `t03`). Pass the resolved filename to each review subagent (overrides the review skill's default).

## Persona Mapping

| Review Skill | Persona |
|---|---|
| `agentic:skill:review-code` | `agentic:agent:qa` |
| `agentic:skill:review-tests` | `agentic:agent:qa` |
| `agentic:skill:review-security` | `agentic:agent:security-engineer` |

## Loop

### 1. Dispatch Reviews (Parallel)

For each skill in `review_skills`, spawn a subagent **in parallel** per `agentic:skill:delegate-work`:

- **Persona**: per mapping above
- **Skill**: the review skill to apply (e.g., `agentic:skill:review-code`)
- **Skills**: `technical_skills_prompt`
- **Agent Type**: general purpose
- **Model**: `QA_MODEL`
- **Output**: filename per Output Naming above
- **Input**: available inputs (plan, implementation log, diff per `diff_scope`)

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

For each independent group, spawn a subagent **in parallel** per `agentic:skill:delegate-work`:

- **Persona**: `agentic:agent:software-engineer`
- **Skills**: `technical_skills_prompt`
- **Agent Type**: general purpose
- **Model**: `CODE_WRITING_MODEL`
- **Input**: issues to fix (location, description, suggested fix)
- **Instructions**: fix issues, run tests to verify no regressions

After all fix subagents complete, increment iteration → return to step 1.

## State

Update parent `workflow-state.yaml` after each iteration, nested under `state_key` (e.g., `review_loop.tickets.03` → `review_loop: tickets: "03": {...}`):

```yaml
# state_key: review_loop (default)
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
