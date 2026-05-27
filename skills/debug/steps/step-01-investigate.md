# Step 1: Investigate

## Intent

Gather evidence about the bug. Delegate codebase exploration to architect subagent(s) that trace the failure and produce `investigation-report.md`.

## Delegation

You **MUST** delegate this to 1 or multiple subagents. You **MUST NOT** investigate yourself.

Spawn subagent(s) per `agentic:skill:delegate-work`:

- **Persona**: `agentic:agent:architect`
- **Skills**: `technical_skills_prompt`
- **Agent Type**: general purpose
- **Model**: ask developer (question tool if available) whether to use `CODE_WRITING_MODEL` or `HIGH_THINKING_MODEL`
- **Input**: `{output_path}/bug-report.md`
- **Output**: `{output_path}/investigation-report.md` following the template in `references/investigation-report.md`

The architect must:

1. Read error messages and stack traces completely — never skip or summarize prematurely
2. Identify the failing component and exact failure point (file:line)
3. Trace data flow backward from failure to origin of bad state
4. Check recent changes (`git log`, `git diff`) for relevant modifications
5. Find working examples of similar code for comparison
6. Document all evidence — what was observed, not assumed

## Validate

After the subagent(s) complete, verify `investigation-report.md` exists and contains: error analysis, failure point, data flow trace, and evidence summary. If sections are missing, re-delegate with specific requests.

## Context Confirmation (Soft Gate)

Present a summary of the investigation findings to the developer. Ask: "Anything wrong or missing from this investigation?"

- If confirmed → proceed to step 2
- If corrections → pass feedback to architect for refinement, re-present when done

## Update State

```yaml
artifacts:
  investigation_report: "{output_path}/investigation-report.md"
```

## Next

Load `steps/step-02-regression-test.md`.
