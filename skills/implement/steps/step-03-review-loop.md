# Step 3: Review Loop

## Intent

Run the review-loop sub-workflow to validate implementation quality across code, tests, and security.

## Invocation

You **MUST** invoke `/agentic:workflow:review-loop` with these parameters:

| Parameter | Value |
|-----------|-------|
| `max_iterations` | `3` |
| `review_skills` | `[agentic:skill:review-code, agentic:skill:review-tests, agentic:skill:review-security]` |

The review loop handles: dispatching review subagents in parallel, aggregating findings, fixing blockers/majors, and re-reviewing. See `agentic:workflow:review-loop` for full behavior.

## Context to Pass

The review loop inherits from this workflow:

- `output_path` — for reading implementation artifacts
- `technical_skills_prompt` — for review subagents
- `workflow-state.yaml` — for state updates
- `{output_path}/input-plan.md` — the plan being implemented
- `{output_path}/implementation-log.md` — what was built

## After Review Loop

Read the review loop's final state:

- **PASS** → proceed to step 4
- **MAX_REACHED** → the review loop already asked the developer how to proceed. Follow their choice.

## Update State

```yaml
steps_completed:
  - step: 3
    name: review-loop
    completed_at: "{ISO}"
review_loop:
  status: "{pass | max_reached}"
  iterations: "{n}"
```

## Next

Load `steps/step-04-finalize.md`.
