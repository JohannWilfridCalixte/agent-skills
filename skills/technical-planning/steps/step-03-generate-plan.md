# Step 3: Generate Technical Plan

## Pre-condition

All structural open questions resolved (gate rule from step 2).

## Generation Strategy

You **MUST** ask the developer how to generate the plan. Two options:

1. **Orchestrator generates** (recommended for speed) — you already have full context from the conversation
2. **Delegate to architect subagent** (recommended if conversation is long or cluttered) — fresh context window, pass all artifacts

## Inputs (whichever strategy)

- `{output_path}/input.md` — original spec
- `{output_path}/technical-context.md` — codebase analysis
- `{output_path}/technical-decisions.md` — all developer decisions
- `technical_skills_prompt` from workflow state

## Output

Produce `{output_path}/technical-plan.md` following the template in `references/technical-plan.md`.

Every decision from `technical-decisions.md` **MUST** be reflected in the plan. Do not override or reinterpret any developer decision.

## If Delegating to Subagent

Spawn per `agentic:skill:delegate-work`:

- **Persona**: `agentic:agent:architect`
- **Skills**: `technical_skills_prompt`
- **Agent Type**: general purpose
- **Model**: `HIGH_THINKING_MODEL`
- **Input**: all artifact paths listed above + template `references/technical-plan.md`
- **Output**: `{output_path}/technical-plan.md`

Validate output exists and contains task breakdown + verification approach.

## After Generation

Present plan summary to the developer: scope, task breakdown, verification approach. Ask to review. Adjust if needed.

## Update State

```yaml
artifacts:
  technical_plan: "{output_path}/technical-plan.md"
```

## Next

Load `steps/step-04-handoff.md`.
