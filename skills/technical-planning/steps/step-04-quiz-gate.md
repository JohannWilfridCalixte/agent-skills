# Step 4: Quiz Gate

## Intent

Interactive review of the ticket breakdown before handoff. The developer approves granularity and blocking edges — plan + PRD reviewed in the same pass.

## Present

List every ticket, one line each:

```
NN {title} (blocked by: {X, Y | none}) — delivers {what the ticket delivers}
```

Follow with a short summary of `prd.md` and `technical-plan.md` (scope, design highlights, verification approach).

## Quiz

Explicitly ask the developer:

1. **Granularity right?** — any ticket too big for one subagent context, or trivially small?
2. **Blocking edges correct?** — missing dependencies, false dependencies?
3. **Merge/split any?**
4. Anything wrong in plan or PRD?

## Iterate

On any change request: regenerate the affected tickets (renumber if dependency order changes) and/or amend plan/PRD, re-present, quiz again. Repeat until approved.

You **MUST NOT** proceed until the developer approves the breakdown.

## Update State

```yaml
decisions:
  - step: quiz-gate
    decision: "Ticket breakdown approved ({N} tickets)"
    reason: "Developer confirmed granularity + blocking edges"
```

## Next

Load `steps/step-05-handoff.md`.
