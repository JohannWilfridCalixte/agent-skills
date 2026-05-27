# Step 2: Grill Requirements

## Intent

Question the developer on every technical decision needed for an unambiguous plan. One question at a time. Relentlessly. Until reaching shared understanding on all structural decisions.

## How to Question

- **One question at a time** — never batch multiple questions
- **Prefer multiple choice** when options are enumerable (from codebase patterns or known approaches)
- **Use codebase context** from `technical-context.md` to ground questions in what exists
- **Challenge vague answers**: if the developer says "whatever works", "you decide", or "doesn't matter", push back with specific options and their concrete trade-offs. If they insist after one challenge, make your best recommendation, get confirmation, and log as DEVELOPER_DEFERRED.

## Question Categories

Work through relevant categories. Skip what's clearly irrelevant. Adapt based on what emerges.

1. **Architecture & component boundaries** — where does this live, new vs extend existing, integration points
2. **Data model & storage** — new entities, relationships, migrations, caching, validation
3. **API contracts & interfaces** — endpoints, request/response shapes, error semantics, versioning
4. **Dependencies & libraries** — new packages, version constraints, why this over alternatives
5. **State management & data flow** — how data moves through the system, side effects
6. **Error handling & edge cases** — failure modes, recovery, retry logic, graceful degradation
7. **Security & auth** — authentication, authorization, input validation, sensitive data
8. **Testing strategy** — test types, mocking approach, critical paths needing coverage
9. **Performance & scaling** — SLAs, expected load, optimization approach

## Decision Logging

Initialize `{output_path}/technical-decisions.md` at the start of this step.

Log every decision as you go:

- **Question asked** → **answer given** → **decision derived** → **impact on plan**
- For DEVELOPER_DEFERRED: your recommendation + rationale + developer confirmation

## Gate Rule

You **MUST NOT** proceed to step 3 while structural open questions remain.

**Structural** = anything that changes the shape of implementation: architecture, data model, APIs, component boundaries, library choices.

**Minor** = cosmetic or easily changed later: naming, log levels, comment wording. These can remain — note defaults in the plan.

When all relevant categories are covered, perform the gate check. If structural questions remain, list them and keep asking. If only minor questions remain, state them, confirm with the developer, and proceed.

## Update State

```yaml
artifacts:
  technical_decisions: "{output_path}/technical-decisions.md"
```

## Next

Load `steps/step-03-generate-plan.md`.
