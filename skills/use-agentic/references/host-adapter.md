# Host capability and model boundary

Use the host's documented native tools. This reference defines semantic requirements, not new native tool parameters. Record what the host actually exposes before dispatch.

## Roles

| Role | Purpose | Legacy config alias |
|---|---|---|
| `high_thinking` | Planning and complex investigation | `highThinkingModelName` / `HIGH_THINKING_MODEL` |
| `code_writing` | Implementation, fixes, test writing | `codeWritingModelName` / `CODE_WRITING_MODEL` |
| `qa` | Independent code, test, security review | `qaModelName` / `QA_MODEL` |
| `exploration` | Bounded context gathering | Native exploration tier or inherited/default model |

Use task/user-authorized overrides first, configured `ides.<host>.models.<role>` settings second, legacy aliases third, then inherited host settings/default. A missing QA configuration inherits the high-thinking role before host default. Exploration preserves the host's efficient native exploration tier if available; it does not silently upgrade to the most expensive model. Workflows that already received an explicit user's role choice preserve it. Asking again is appropriate only for a materially changed unresolved choice, not to reconfirm a saved choice.

For each role record requested model/effort and effective model/effort, plus the reason and capability fallback. `null` means the host chooses or does not expose the value, not zero effort. Model identifiers and effort labels are opaque host-supported strings; verify them from available tool metadata/configuration. Do not maintain a stale model catalog in workflow prompts.

If a requested model or effort is unavailable, use inherited/default settings and log the exact fallback when the user did not make that setting mandatory. If the user explicitly requires that exact setting, stop the affected dispatch and report the unavailable capability. If the native spawn API lacks a model/effort control, omit the unsupported argument and record inheritance. Instructions in a worker prompt cannot change a model.

## Capability decisions

| Observed host capability | Dispatch behavior |
|---|---|
| Native subagents with shared filesystem | Pass skill/input paths; use fresh contexts for independent reviews. |
| Full-capability native worker only | Express source/artifact write scope in its task contract; no invented explorer type. |
| Truly read-only worker | Return the complete artifact body; orchestrator saves it and records provenance. |
| No shared filesystem | Transfer complete required files and their linked reference closure using a supported artifact transport; verify receipt. |
| No artifact transport | Stop that remote dispatch with the unresolved paths. A pasted abridgment of rules is not a substitute. |
| No subagents | Report the missing capability. Continue independent preparation; a workflow requiring independent workers cannot claim its gate passed through self-review. |
| Native question tool | Use it for unresolved decisions under host policy. |
| No native question tool | Ask one concise plain-text question when the decision is required. |
| No `gh` or authentication | Preserve local artifacts; report which requested remote operation is unavailable. |
| No conversation-reset control | Provide the artifact handoff for a fresh context; do not issue fictitious `/clear` commands. |

Read/resolve skills through the host loader when present; otherwise read the installed `SKILL.md` and its required relative references using filesystem tools. Installation metadata describes package closure; reading entry metadata alone does not load a skill. Preserve full TypeScript rule retrieval, language/testing/architecture policy, scoped worker checks, and full workflow gates on every host.

Record fallback and resolution events in the run's execution context and telemetry. Capabilities describe technical availability; permission comes from the user and host policy and is not inferred from a boolean.
