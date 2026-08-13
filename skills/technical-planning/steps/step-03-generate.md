# Step 3: Generate PRD, Plan, Tickets

## Pre-condition

All structural open questions resolved (gate rule from step 2).

## Generation Strategy

You **MUST** ask the developer how to generate. Two options:

1. **Orchestrator generates** (recommended for speed) — you already have full context from the conversation
2. **Delegate to architect subagent** (recommended if conversation is long or cluttered) — fresh context window, pass all artifacts

## Inputs (whichever strategy)

- `{output_path}/input.md` — original spec
- `{output_path}/technical-context.md` — codebase analysis
- `{output_path}/technical-decisions.md` — all developer decisions (+ ADR numbers)
- `technical_skills_prompt` from workflow state

## Outputs

Three artifacts:

| Artifact | Template | Content |
|---|---|---|
| `{output_path}/prd.md` | `references/prd.md` | Product-only, synthesized from input.md + grill answers — no separate interview. **No** implementation/testing decisions (those live in the plan) |
| `{output_path}/technical-plan.md` | `references/technical-plan.md` | Design, contracts, verification. Decisions backed by ADRs cite ADR-NNNN |
| `{output_path}/tickets/NN-slug.md` | `references/ticket.md` | One file per ticket, numbered from 01 in dependency order |

Every decision from `technical-decisions.md` **MUST** be reflected. Do not override or reinterpret any developer decision.

## Ticket Slicing Rules

- **Vertical slice**: each ticket cuts a COMPLETE path through every layer (schema → API → UI → tests), demoable/verifiable alone. Never layer-by-layer.
- **Sized to one fresh subagent context window**
- **Prefactoring tickets first**: "make the change easy, then make the easy change"
- **Wide mechanical refactors** → expand–contract chain: expand ticket → migrate batches each blocked by expand → contract blocked by all batches
- **File-disjoint lanes**: add a blocked-by edge whenever two tickets touch the same files, so concurrent implement lanes never collide
- **1 ticket is a valid breakdown** for small inputs

## If Delegating to Subagent

Spawn per `agentic:skill:delegate-work`:

- **Persona**: `agentic:agent:architect`
- **Skills**: `technical_skills_prompt`
- **Agent Type**: general purpose
- **Model**: `HIGH_THINKING_MODEL`
- **Input**: all artifact paths listed above + templates `references/prd.md`, `references/technical-plan.md`, `references/ticket.md` + ticket slicing rules above
- **Output**: the three artifacts

Validate all three outputs exist and are non-empty.

## Update State

```yaml
artifacts:
  prd: "{output_path}/prd.md"
  technical_plan: "{output_path}/technical-plan.md"
  tickets: "{output_path}/tickets/"
```

## Next

Load `steps/step-04-quiz-gate.md`.
