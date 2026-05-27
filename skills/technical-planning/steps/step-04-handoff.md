# Step 4: Handoff

## Intent

Summarize what was produced and provide next steps for implementation.

## Artifacts Summary

List all produced artifacts with their **absolute paths**:

- `input.md` — original spec
- `technical-context.md` — codebase analysis
- `technical-decisions.md` — developer decisions
- `technical-plan.md` — implementable plan

## Next Steps

Tell the developer to run `/clear` or start a new chat, then invoke the implement workflow. Provide a **copy-pastable** command:

```
/agentic:workflow:implement {absolute path to technical-plan.md}
```

## Complete Workflow

Update workflow state: status → `completed`, set `completed_at`.
