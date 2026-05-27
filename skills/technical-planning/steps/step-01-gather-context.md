# Step 1: Gather Codebase Context

## Intent

Delegate codebase exploration to architect subagent(s). It reads the input, explores the codebase systematically, and produces `technical-context.md`.

## Delegation

You **MUST** delegate this to 1 or multiple subagents. You **MUST NOT** explore the codebase yourself.

Spawn 1 or multiple subagents with:

- **Persona**: `agentic:agent:architect` — the subagent **MUST** read this file first
- **Skills**: pass `technical_skills_prompt` from workflow state (resolved language/framework skills)
- **Agent Type**: explorer / explore
- **Model**: automatic, defined by agent type otherwise default to fast model type haiku, composer or thinking intensity medium
- **Input**: `{output_path}/input.md`
- **Output**: `{output_path}/technical-context.md` following the template in `references/technical-context.md`

The architect(s) must explore the codebase and produce a thorough technical context grounded in evidence (specific files, patterns, dependencies).

## Validate

After the subagent(s) completes, verify `technical-context.md` exists and is non-empty.

## Context Confirmation (Soft Gate)

Present a summary of the technical context to the developer. Ask: "Anything wrong or missing?"

- If the developer confirms → proceed to step 2
- If the developer has corrections → note them, ask for specific pointers (files, modules, areas to focus on), then pass feedback to the architect subagent for refinement. Re-present when done.

## Update State

```yaml
artifacts:
  technical_context: "{output_path}/technical-context.md"
```

## Next

Load `steps/step-02-grill.md`.
