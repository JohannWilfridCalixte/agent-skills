# Step 1: Validate

## Intent

Validate the planning run dir, resolve technical skills, build the ticket dependency graph, create the feature branch.

## Validation

Read the run dir from the invocation argument. Verify:

1. `technical-plan.md` exists
2. `tickets/` contains ≥1 ticket with: `# NN — {Title}`, **What to build**, **Blocked by**, **Status**, `## Acceptance criteria`
3. `prd.md` — optional, read-only context

Anything missing → **HALT** with the Hard Gate message from SKILL.md. Redirect to `/agentic:workflow:technical-planning`.

## Import Published Tickets

Read the planning run dir's `workflow-state.yaml`. If `tickets_published:` exists (GH issue numbers per ticket), copy it into this run's `workflow-state.yaml` — the step 2 commit gate uses it to `gh issue close`.

## Skill Resolution

This step is **CRITICAL**: you **MUST** go out of your way to resolve the profiles and associated skills to load based on the tickets and their context.

Resolve `technical_skills_prompt` from agentic config profiles. These skills will be passed to all subagents.

## Dependency Graph

Build the graph from each ticket's **Blocked by** field:

- One node per ticket; edge blocker → blocked
- `None` → ticket can start immediately
- Cycle detected → **HALT**, report the cycle to the developer

## Feature Branch

Orchestrator-only git:

1. Suggest a conventional branch name from the topic, e.g. `feat/{slug}`
2. Confirm once with the developer
3. Already on a non-main branch → offer to reuse it instead

## Update State

Init `tickets:` map mirroring each ticket file's **Status**:

```yaml
status: in_progress
current_step: 1
branch: "{branch-name}"
tickets:
  "{NN}": { status: ready }
```

## Resume

Re-run on the same run dir → tickets with `Status: committed` are skipped. Init state from ticket file Status values, not from scratch.

## Next

Load `steps/step-02-process-tickets.md`.
