# Step 2: Review Loop

## Intent

Run all review skills against the PR via `/agentic:workflow:review-loop` in a single pass (no fix cycle).

## Parameters

You **MUST** pass these to `/agentic:workflow:review-loop`:

- `max_iterations`: 1
- `review_skills`: [agentic:skill:review-code, agentic:skill:review-tests, agentic:skill:review-security]

## Context

Review-loop needs these inputs from `{output_path}/`:

- `pr-diff.patch`
- `pr-metadata.md`
- `technical-context.md`
- `verbosity` from workflow state

## Note

PR review = single pass. Findings are reported, not fixed. Review-loop handles all parallelism and aggregation internally.

## Update State

Review-loop updates `workflow-state.yaml` directly with its `review_loop` block (iteration, counts, verdict).

## Next

Load `steps/step-03-report.md`.
