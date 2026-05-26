---
name: agentic:skill:use-workflow
description: Use when executing any agentic workflow. Owns state tracking, step sequencing, decision logging, artifact storage, and communication mode. Implicitly required by all agentic:workflow:* skills.
---

# Use Workflow

The workflow engine. Every `/agentic:workflow:*` call **MUST** load this skill first.

## Dependencies

You **MUST** load `/agentic:skill:use-agentic` before this skill. Config provides OUTPUT_FOLDER and NAMESPACE.

## Initialization

When workflow starts, you **MUST**:

1. Generate run ID: `{YYYYMMDD}-{HHMMSS}-{random4hex}`
2. Create output dir: `{OUTPUT_FOLDER}/{workflow-name}/{run-id}/`
3. Write initial `workflow-state.yaml` (schema in `references/workflow-state.yaml`)
4. Resolve profile skills via use-agentic → `technical_skills_prompt`
5. Confirm gate: "Workflow initialized: {workflow-name}, run={run-id}"

## Step Sequencing

Each workflow defines `steps/step-N-name.md`. You **MUST**:

- Load steps one at a time, sequentially (lost-in-middle mitigation)
- Complete current step before loading next
- Update `workflow-state.yaml` after each step
- **Never** load all steps at once or skip ahead

## Decision Logging

Every autonomous decision **MUST** be logged in `workflow-state.yaml`:

```yaml
decisions:
  - step: gather-context
    decision: Focused on auth module
    reason: User spec mentions login flow
```

No decision without a reason. No reason without context from the step.

## Artifacts

Output files go in `{OUTPUT_FOLDER}/{workflow-name}/{run-id}/`. Each workflow defines prescribed artifacts. Track all paths in `workflow-state.yaml`.

## Communication Mode

During workflow execution, switch to ultra-compressed output:

| Rule | Example |
|---|---|
| Drop articles, filler, hedging | "Analyzing auth module" not "I'll now analyze the auth module" |
| Abbreviate common terms | DB, auth, config, impl, deps, req, fn |
| Use arrows for flow | input → validate → transform → store |
| Sentence fragments OK | "3 files modified. Tests green." |
| Technical terms exact | Never abbreviate type names, APIs, paths |

Revert to normal for: security warnings, irreversible actions, ambiguous multi-step sequences. Code, documentation, commits, PRs always standard English.

## State Updates

Update `workflow-state.yaml` at these checkpoints:

- **Workflow start** — status: `in_progress`
- **Each step completion** — append `steps_completed`, advance `current_step`
- **Each decision** — append to `decisions`
- **Each artifact produced** — update `artifacts`
- **Workflow end** — status: `completed` or `failed`, set `completed_at`

## Error Recovery

If a step fails → log error in state, set status `failed`, present error to user. **Never** silently continue past a failed step.
