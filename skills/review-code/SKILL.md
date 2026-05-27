---
name: agentic:skill:review-code
description: Use when reviewing implementation code for correctness, quality, and maintainability. Does NOT review tests (review-tests handles that).
---

# Review Code

Review implementation code (not tests) for correctness, quality, and maintainability.

## Scope

**Implementation code only.** Test review is handled by `agentic:skill:review-tests`.

## What to Review

- **Correctness** — does the code do what the plan/spec says?
- **Edge cases** — boundary conditions, null/empty inputs, error paths
- **Patterns** — consistency with existing codebase conventions
- **Maintainability** — readability, complexity, coupling
- **Error handling** — proper propagation, no swallowed errors
- **Observability / Instrumentation** — proper structured logging, monitoring, tracing, instrumentation

## Severity Guide

| Severity | Meaning | Blocks? |
|----------|---------|---------|
| **Blocker** | Incorrect behavior, data loss risk, crash | Yes |
| **Major** | Missing edge case, poor error handling, consequential pattern violation | Yes |
| **Minor** | Style inconsistency, suboptimal approach, readability issue | No |
| **Nit** | Cosmetic, naming preference, trivial improvement | No |

## Output

Write to `{output_path}/review-code-{iteration}.md`.

### Required Sections

1. **Summary** — severity counts + verdict
2. **Issues** — grouped by severity (blocker → nit), each with:
   - Location (`file:line`)
   - Description
   - Suggested fix
3. **Verdict** — `PASS` (no blockers/majors) | `CHANGES_REQUESTED`

## Inputs

Use when available:
- Technical plan — expected behavior
- Implementation log — what was done and why
- Code diff — actual changes
- `technical_skills_prompt` — language/framework skills to load
