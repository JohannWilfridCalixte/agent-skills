# Delegation

## Subagent prompt

Names and paths only. The subagent loads skills and reads files itself, so nested references keep working and the prompt stays small.

```
Step: {step key}
Work item: {work-item path}
Workspace: {workspace.path}     # run every code read, write, check and commit here
Load skills: {step skill}, {profile codestyle skills}
Read: {input paths}
Write: {output path}            # omit for read-only steps
Goal: {one or two sentences of intent}
Return: short summary + output path (read-only: cited findings).
Do not write events.jsonl or state.json.
```

Never paste skill content, file content or a persona.

## Harness mapping

Map the capability class to the closest model the harness offers. Set model and effort per spawn; a level the model doesn't support → nearest supported one. If the harness refuses or substitutes, run with what is available, warn once, log what actually ran.

### Cursor

- Spawn: Task tool. Read-only steps: `explore` type (or a custom subagent with `readonly: true`).
- Model: `model` param, a model id from the allowed list.
- Effort: bracket parameters on the model id, `claude-opus-5[effort=high]`. If the tool only accepts fixed slugs, pick the slug variant that encodes the effort (`…-high`).
- Fallbacks: team restrictions or plan limits can swap the model; the task card shows what ran.

### Claude Code

- Spawn: Agent tool. Read-only steps: `Explore` type.
- Model: per-invocation `model` param (`opus`, `sonnet`, `haiku` or a full model id).
- Effort: per-invocation `effort` param, `low | medium | high | xhigh | max` depending on the model. Older versions: only the `effort` frontmatter of a subagent definition.
- `CLAUDE_CODE_EFFORT_LEVEL` overrides everything: if set, log it as the effort used.

### Codex

- Spawn: ask explicitly for a subagent per step and name its model and reasoning effort in the spawn request.
- Model / effort: explicit spawn values → `[agents]` defaults (`default_subagent_model`, `default_subagent_reasoning_effort`) → parent's. Effort is `model_reasoning_effort`: `low | medium | high | xhigh | max | ultra` depending on the model.
- Custom agents in `.codex/agents/*.toml` that set `model` / `model_reasoning_effort` win over spawn values: if one matches the step, its settings are what ran.
- Read-only steps: say so in the spawn request, or use a custom agent with write tools disabled.

Native features change fast: prefer the harness's current docs over this file when they disagree.
