# Step 3: Finalize

## Intent

Push branch, open PR, run PR-level review loop, complete workflow.

## Ask Developer

Commits already exist on the branch. Only remaining question — **interactive**:

- **Open a PR?** Yes / No

No → complete workflow (branch keeps local commits).

## Push + PR

Orchestrator-only git:

1. Push the feature branch
2. `gh pr create` — title from topic; body = ticket list with commit SHAs + summary from `implementation-log-{NN}.md` files

## PR Review Loop

Invoke `/agentic:workflow:review-loop` over the **FULL PR diff**:

| Parameter | Value |
|-----------|-------|
| `max_iterations` | `2` |
| `review_skills` | `[agentic:skill:review-code, agentic:skill:review-tests, agentic:skill:review-security]` |
| `diff_scope` | full PR diff |
| `state_key` | `review_loop.pr` |

Fixes are committed + pushed as follow-up conventional commits (orchestrator commits).

## Complete Workflow

Update workflow state: status → `completed`, set `completed_at`. List artifacts with **absolute paths**: per-ticket implementation logs, `follow-ups.md`, PR URL.
