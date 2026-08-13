# Step 2: Process Tickets

## Intent

Implement all tickets via a frontier loop: parallel lanes, per-ticket review, strictly serialized commits.

## Frontier Loop

```
frontier = uncommitted tickets whose blockers are ALL committed
WHILE uncommitted tickets remain:
  spawn one LANE per frontier ticket (parallel)
  each lane: implement → review → commit gate
  ticket committed → recompute frontier → spawn next lanes
```

## Lane: Implement

For each frontier ticket, spawn a subagent per `agentic:skill:delegate-work`:

- **Persona**: `agentic:agent:software-engineer`
- **Skills**: `technical_skills_prompt`
- **Agent Type**: general purpose
- **Model**: `CODE_WRITING_MODEL`
- **Input**: paths to the ticket file, `technical-plan.md`, `prd.md` (if present)
- **Output**: `{output_path}/implementation-log-{NN}.md` (template: `references/implementation-log.md`)
- **Instructions**: implement the ticket, write tests alongside, run **SCOPED** tests (the ticket's area) — NOT the full suite. **NEVER run git commands.**

Mark ticket `in_progress` in state and in the ticket file.

## Lane: Review

After lane implementation, invoke `/agentic:workflow:review-loop` for THAT ticket:

| Parameter | Value |
|-----------|-------|
| `max_iterations` | `2` |
| `review_skills` | `[agentic:skill:review-code, agentic:skill:review-tests, agentic:skill:review-security]` |
| `diff_scope` | the ticket's changes |
| `state_key` | `review_loop.tickets.{NN}` |

## Commit Gate

**Orchestrator only. Strictly serialized** — one commit at a time, even if lanes finish together.

1. Run the **FULL** test suite
2. **Green** →
   - One conventional commit for the ticket: type+scope from ticket; body = "Ticket NN — {Title}" + acceptance criteria met
   - Update ticket file `Status: committed`
   - Record sha in `workflow-state.yaml` tickets map
   - If workflow-state has `tickets_published` GH issue numbers → `gh issue close` this ticket's issue
3. **Red** → dispatch a fix round back to the lane's scope (same lane params), re-gate

## Autonomy

Fully autonomous. Pause ONLY on:

- review-loop `max_reached`
- full suite still red after a fix round
- acceptance criteria unsatisfiable / plan contradiction

## Out-of-Scope Discoveries

Append to `{output_path}/follow-ups.md` as proposed tickets. **NEVER** auto-implement.

## Update State

After each commit gate:

```yaml
tickets:
  "{NN}": { status: committed, sha: "{sha}" }
```

## Next

All tickets committed → load `steps/step-03-finalize.md`.
