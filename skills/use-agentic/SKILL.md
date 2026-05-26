---
name: agentic:skill:use-agentic
description: Use when invoking any agentic skill, agent, or workflow - gateway to the agentic framework
---

# Use Agentic

Gateway skill to the agentic framework. **MUST** be invoked before any other `agentic:*` resource.

Agentic = AI-assisted dev toolset. Skills, agents, and workflows compose into development pipelines.

## Naming Conventions

| Prefix | Purpose | Example |
|--------|---------|---------|
| `agentic:skill:X` | Reusable technique or ruleset | `agentic:skill:typescript-engineer` |
| `agentic:agent:X` | Persona with role + constraints | `agentic:agent:software-engineer` |
| `agentic:workflow:X` | Multi-step orchestrated process | `agentic:workflow:implement` |

## Framework Parts

| Part | What It Is |
|------|------------|
| Skills | Reusable techniques and rulesets any agent can apply |
| Agents | Persona files defining role, constraints, and behavior |
| Workflows | Multi-step orchestrated processes coordinating agents and skills |

## Config

**MUST** load config before proceeding with any agentic operation.

### Lookup Order

1. `.agentic.json` or `.agentic.config.json` or `.agentic/config.json` at project root
2. `~/.agentic/config.json` fallback
3. If neither found: warn user, continue with defaults

### IDE Detection

| IDE | Key |
|-----|-----|
| Claude Code | `claude` |
| Cursor | `cursor` |
| Codex | `codex` |

Detect current IDE from environment. Use detected key to resolve IDE-specific settings from `ides.{key}`.

### Cached Constants

Read once from config, reuse everywhere.

| Constant | Source | Default |
|----------|--------|---------|
| NAMESPACE | `namespace` | `agentic` |
| OUTPUT_FOLDER | `ides.{ide}.outputFolder` | `_agentic_output` |
| HIGH_THINKING_MODEL | `ides.{ide}.highThinkingModelName` | Opus 4.6 high thinking or GPT 5.5 xhigh or available equivalent high effort thinking frontier model or harness default |
| CODE_WRITING_MODEL | `ides.{ide}.codeWritingModelName` | Sonnet 4.6 medium thinking or Composer 2.5 thinking or GPT 5.3 codex or harness default |
| QA_MODEL | `ides.{ide}.qaModelName` | same default as HIGH_THINKING_MODEL |
| SELECTED_PROFILES | `selectedProfiles` | `[]` |
| PROFILES | `profiles` | `[]` |

### Profile Resolution

1. Match `selectedProfiles` entries against `profiles[].name`
2. Collect all `skills` arrays from matched profiles
3. Deduplicate skill list preserving order
4. Return as `technical_skills_prompt` for downstream consumption

Full schema reference: `references/config-schema.md`

## Confirm Gate

After config loads, confirm:

> Config loaded: namespace={NAMESPACE}, outputFolder={OUTPUT_FOLDER}, ide={ide}
