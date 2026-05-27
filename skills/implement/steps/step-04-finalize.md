# Step 4: Finalize

## Intent

Summarize what was built and let the developer decide on PR creation.

## Artifacts Summary

List all produced artifacts with **absolute paths**:

- `input-plan.md` — original technical plan
- `implementation-log.md` — what was implemented + decisions

## Ask Developer

Present the implementation summary, then ask:

1. **Create branch + commit + PR?** → ask for branch name, generate conventional commit message, create PR with summary from implementation log
2. **Commit only?** → commit with conventional message on current branch
3. **Nothing** → leave changes uncommitted

This step is **interactive** — wait for the developer's choice.

## Complete Workflow

Update workflow state: status → `completed`, set `completed_at`.
