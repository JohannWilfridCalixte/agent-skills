---
name: agentic:skill:delegate-work
description: Use when a workflow step needs to spawn subagents for implementation, exploration, review, or fixing — ensures correct persona loading, skill loading, agent type, and model selection across harnesses
---

# Delegate Work

Canonical pattern for dispatching subagents. Every workflow step that spawns subagents **MUST** follow this.

## Subagent Boot Sequence

The subagent prompt **MUST** instruct this exact order — BEFORE any task work:

1. **Load persona** — read the agent definition file (e.g., `agentic:agent:software-engineer`)
2. **Load skills** — invoke each skill name from `technical_skills_prompt` using the skill loading mechanism
3. **Read inputs** — read input files from provided paths
4. **Begin task**

Orchestrator passes **names and paths**, never content. Subagent loads everything itself.

## Dispatch Parameters

Every subagent spawn **MUST** specify all of these:

| Parameter | What to Pass |
|-----------|-------------|
| **Persona** | Fully qualified name: `agentic:agent:{role}` |
| **Skills** | `technical_skills_prompt` — skill name list, **NOT** skill content |
| **Agent Type** | `explorer` or `general purpose` (see below) |
| **Model** | Config constant (see below) |
| **Input** | File **paths** to read |
| **Output** | Expected output file path |

## Agent Types

Models: map these to your harness's native subagent types (read-only search agents, full-capability agents, etc.).

| Type | When | Capability |
|------|------|-----------|
| `explorer` / `explore` | Codebase analysis, investigation, context gathering | Read-only, fast, cheap |
| `general purpose` / `worker` / `default` | Implementation, fixing, review, anything that writes | Full read + write |

## Model Constants

Resolved from agentic config per IDE. Use constant names, never hardcoded model identifiers.

| Constant | Use For |
|----------|---------|
| `HIGH_THINKING_MODEL` | Planning, investigation, complex reasoning |
| `CODE_WRITING_MODEL` | Implementation, fixing, test writing |
| `QA_MODEL` | Code review, test review, security review |

## Parallelization

Spawn subagents concurrently when tasks are independent (no shared file writes, no dependency):

- Multiple review skills → parallel
- Independent implementation tasks → parallel
- Investigation then implementation → **sequential**

## Anti-Patterns

### Inlining content into subagent prompts

```
# ❌ WRONG — pastes skill/persona content
"Follow these TypeScript rules: [500 lines]..."
"You are a pragmatic engineer who..."

# ✅ RIGHT — passes names for subagent to load
"Load persona agentic:agent:software-engineer first."
"Load skills: /typescript-engineer, /clean-architecture"
"Read the plan at {output_path}/technical-plan.md"
```

**Why wrong**: wastes context window, breaks nested references (`rules/*.md`), uses stale content, subagent can't follow internal links.

### Other anti-patterns

| Anti-Pattern | Why Wrong | Correct |
|---|---|---|
| Passing file **contents** instead of paths | Bloats prompt, may truncate task | Pass paths, subagent reads itself |
| Skipping agent type | Explorer can't write; general purpose wastes resources on read-only tasks | Always specify type |
| Hardcoding model names (`claude-opus-4-6`) | Breaks cross-harness; ignores user config | Use `CODE_WRITING_MODEL` etc. |
| Skipping persona | Subagent lacks role constraints and decision heuristics | Always specify persona |
| Skipping skill loading | Subagent doesn't know project conventions | Always pass `technical_skills_prompt` |

## Red Flags — STOP and Fix Your Prompt

- You're copy-pasting skill file content into the subagent prompt
- You're writing a persona description instead of referencing the persona file
- You're embedding file contents instead of passing paths
- You're using a literal model name instead of a config constant
- Your prompt doesn't mention loading persona or skills as first steps

**All of these mean: rewrite the subagent prompt following the boot sequence above.**
