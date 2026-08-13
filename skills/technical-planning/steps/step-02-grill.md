# Step 2: Grill Requirements

## Intent

Question the developer on every decision needed for an unambiguous plan. Model decisions as a **design tree**, ask in **frontier rounds** until the frontier is empty.

Load `/agentic:skill:use-knowledge` before starting — decisions are classified into docs as they resolve.

## Frontier Rounds

- Build a design tree from input + technical-context: nodes = decisions, edges = prerequisites between decisions.
- **Frontier** = all open questions whose prerequisites are settled.
- Each round: ask **ALL** frontier questions — each with a recommended answer. Present via the harness's structured multi-choice mechanism when available, else a numbered list. Max 4 questions per round (overflow → next round).
- Answers reshape the tree (prune branches, spawn new decisions) → recompute frontier → next round.
- Done when the frontier is empty.

## Facts vs Decisions

- **Facts are your job**: if a question can be answered from the codebase, delegate the lookup to a subagent (per `agentic:skill:delegate-work`) — never ask the developer.
- **Decisions are the developer's**: never resolve one silently.

## Question Categories

Work through relevant categories. Skip what's clearly irrelevant. Adapt based on what emerges.

0. **Product framing** — problem, users, out-of-scope. Ask **only** when input lacks it (feeds `prd.md`)
1. **Architecture & component boundaries** — where does this live, new vs extend existing, integration points
2. **Data model & storage** — new entities, relationships, migrations, caching, validation
3. **API contracts & interfaces** — endpoints, request/response shapes, error semantics, versioning
4. **Dependencies & libraries** — new packages, version constraints, why this over alternatives
5. **State management & data flow** — how data moves through the system, side effects
6. **Error handling & edge cases** — failure modes, recovery, retry logic, graceful degradation
7. **Security & auth** — authentication, authorization, input validation, sensitive data
8. **Testing strategy** — test types, mocking approach, critical paths needing coverage
9. **Performance & scaling** — SLAs, expected load, optimization approach

## Challenge Rule

If the developer says "whatever works", "you decide", or "doesn't matter": push back once with specific options and concrete trade-offs. If they insist, make your best recommendation, get confirmation, log as DEVELOPER_DEFERRED.

## Decision Logging

Initialize `{output_path}/technical-decisions.md` at the start of this step.

Log every decision as you go:

- **Question asked** → **answer given** → **decision derived** → **impact on plan**
- For DEVELOPER_DEFERRED: your recommendation + rationale + developer confirmation

## Knowledge Capture

As each decision/term resolves, classify **inline** (not batched at end) per `agentic:skill:use-knowledge`:

| Resolved item | Destination |
|---|---|
| Domain term defined/clarified | ubiquitous-language entry |
| Firm decision meeting **ALL** of: hard to reverse, surprising without context, result of real trade-off | ADR (sparingly) |
| In-progress technical reflection | RFC |
| Everything else | `technical-decisions.md` only |

When a decision becomes an ADR, note its number next to the decision in `technical-decisions.md` — the plan cites ADR numbers where relevant.

## Gate Rule

You **MUST NOT** proceed to step 3 while structural open questions remain.

**Structural** = anything that changes the shape of implementation: architecture, data model, APIs, component boundaries, library choices.

**Minor** = cosmetic or easily changed later: naming, log levels, comment wording. These can remain — note defaults in the plan.

When the frontier is empty, perform the gate check. If structural questions remain, list them and keep grilling. If only minor questions remain, state them, confirm with the developer, and proceed.

## Update State

```yaml
artifacts:
  technical_decisions: "{output_path}/technical-decisions.md"
```

## Next

Load `steps/step-03-generate.md`.
