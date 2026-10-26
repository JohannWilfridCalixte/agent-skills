# Delegation

## Subagent prompt

Names and paths only. The subagent loads skills and reads files itself, so nested references keep working and the prompt stays small.

```
Step: {step key}
Work item: {work-item path}
Load skills: {step skill}, {profile codestyle skills}
Read: {input paths}
Write: {output path}            # omit for read-only steps
Goal: {one or two sentences of intent}
Return: short summary + output path (read-only: cited findings).
Do not write events.jsonl or state.json.
```

Never paste skill content, file content or a persona.

## Harness mapping

Map the capability class to the closest model the harness offers. If model or effort can't be set, run with what is available, warn once, log what actually ran.

| Harness | Subagent | Read-only type | Model | Effort |
|---|---|---|---|---|
| `cursor` | Task tool | `explore` | `model` param, from the allowed slug list | Only through slug variants that encode it, when offered |
| `claude` | Agent (Task) tool | `Explore` | `model` param (`opus`, `sonnet`, `haiku`) | No per-call control; omit |
| `codex` | Sub-agents, when enabled | read-only sandbox role | Role config `model` | Role config `model_reasoning_effort` |

Native features change fast: prefer the harness's current docs over this table when they disagree.
