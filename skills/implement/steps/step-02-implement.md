# Step 2: Implement

## Intent

Delegate code + test implementation to software engineer subagent(s). Parallelize independent tasks.

## Execution Strategy

Use the task analysis from step 1 to dispatch work:

- **Independent tasks** → spawn parallel subagents, one per task or task group
- **Dependent tasks** → sequential dispatch, respecting dependency order
- **Single task** → one subagent

## Delegation

For each task or task group, spawn a subagent with:

- **Persona**: `agentic:agent:software-engineer` — subagent **MUST** read this file first
- **Skills**: pass `technical_skills_prompt` — subagent **MUST** load all skills first
- **Agent Type**: general purpose or default
- **Model**: CODE_WRITING_MODEL from agentic config
- **Input**: relevant task(s) from the plan, plus `{output_path}/input-plan.md` for full context
- **Instructions**: implement the assigned task(s), write tests alongside, run tests to verify

Each subagent **MUST** append to `{output_path}/implementation-log.md` following the template in `references/implementation-log.md`.

## After Completion

When all subagents finish:

1. Read all implementation logs — verify each task was addressed
2. Run the full test suite to confirm nothing is broken
3. Log any cross-task issues as decisions

If a subagent fails or produces incomplete work → retry once with clarified instructions, then log failure and continue.

## Update State

```yaml
steps_completed:
  - step: 2
    name: implement
    completed_at: "{ISO}"
    output: "{output_path}/implementation-log.md"
```

## Next

Load `steps/step-03-review-loop.md`.
