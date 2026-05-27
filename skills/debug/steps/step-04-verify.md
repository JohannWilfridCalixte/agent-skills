# Step 4: Verify

## Intent

Run review-loop sub-workflow to verify fix quality and test quality.

## Parameters

You **MUST** pass these to `/agentic:workflow:review-loop`:

- `max_iterations`: 2
- `review_skills`: [agentic:skill:review-code, agentic:skill:review-tests, agentic:skill:review-security]

## Context

Review-loop needs these inputs from `{output_path}/`:

- `bug-report.md`
- `investigation-report.md`
- `hypothesis-log.md`
- `fix-log.md`
- Regression test file path from state

## Note

Debug verification = single pass. Review-loop handles parallelism and aggregation internally. Security review is omitted unless the bug is security-related (orchestrator judgment — log decision if included/excluded).

## Update State

Review-loop updates `workflow-state.yaml` directly with its `review_loop` block (iteration, counts, verdict).

On completion:
```yaml
status: "completed"
completed_at: "{ISO}"
```

## Workflow Complete

Present summary to developer:

- Root cause (from hypothesis-log)
- Fix applied (from fix-log)
- Files changed
- Test status
- Review verdict
- Session path for full artifacts
