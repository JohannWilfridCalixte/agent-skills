# Step 5: Handoff

## Intent

Summarize what was produced, optionally publish tickets to GitHub, and provide next steps for implementation.

## Artifacts Summary

List all produced artifacts with their **absolute paths**:

- `input.md` — original spec
- `technical-context.md` — codebase analysis
- `technical-decisions.md` — developer decisions
- `prd.md` — product requirements
- `technical-plan.md` — implementable plan
- `tickets/NN-slug.md` — one per ticket

## Optional: Publish Tickets to GitHub

Offer to publish tickets as GitHub issues. If accepted:

- `gh issue create` one issue per ticket, **in dependency order** — so blocked-by lines can reference real issue numbers of already-created issues
- Record issue numbers in `workflow-state.yaml`:

```yaml
tickets_published:
  - ticket: "01-slug"
    issue: 123
```

**Local ticket files remain source of truth.** Implement workflow will close issues on commit — no other sync.

## Next Steps

Tell the developer to run `/clear` or start a new chat, then invoke the implement workflow. Provide a **copy-pastable** command:

```
/agentic:workflow:implement {absolute path to run dir}
```

## Complete Workflow

Update workflow state: status → `completed`, set `completed_at`.
