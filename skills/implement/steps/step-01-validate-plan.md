# Step 1: Validate Plan

## Intent

Confirm the technical plan is complete and actionable before implementation begins. Resolve technical skills.

## Validation

Read `{output_path}/input-plan.md`. Verify it contains:

1. **Task breakdown** — discrete implementation tasks
2. **File touchpoints** — which files/modules are affected
3. **Implementation guidance** — enough detail for a software engineer to act

If any are missing → **HALT**. Tell the developer what's missing and redirect to `/agentic:workflow:technical-planning`.

## Skill Resolution

This step is **CRITICAL**: you **MUST** go out of your way to resolve the profiles and associated skills to load based on the task and its context.

Resolve `technical_skills_prompt` from agentic config profiles. These skills will be passed to all subagents.

## Task Analysis

Analyze the plan's task breakdown:

- Identify task dependencies (which tasks block others)
- Group independent tasks that can run in parallel
- Flag any ambiguous tasks — log as decisions with best-guess resolution

## Update State

```yaml
status: in_progress
current_step: 1
decisions:
  - step: validate-plan
    decision: "{any ambiguity resolutions}"
    reason: "{context}"
```

## Next

Load `steps/step-02-implement.md`.
