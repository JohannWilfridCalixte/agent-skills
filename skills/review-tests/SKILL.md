---
name: agentic:skill:review-tests
description: Use when reviewing test quality, coverage adequacy, and testing anti-patterns. Does NOT review implementation code (review-code handles that).
---

# Review Tests

Review tests for quality, coverage, and anti-patterns.

## Scope

**Test code only.** Implementation review is handled by `agentic:skill:review-code`.

## What to Review

- **Coverage** — are all acceptance criteria / plan tasks tested?
- **Quality** — do tests verify behavior, not implementation?
- **Anti-patterns** — see checklist below
- **Isolation** — can tests run in any order, in parallel?
- **Naming** — do test names describe expected behavior?

## Skills

You **MUST** load `/agentic:skill:code-testing` skill before continuing.

## Anti-Pattern Checklist

| Anti-Pattern | What It Looks Like | Severity |
|---|---|---|
| The Liar | No meaningful assertions | Blocker |
| Shared State | Tests depend on execution order | Blocker |
| Brittle Test | Tests implementation details | Major |
| Over-Mocking | Mocking internal collaborators | Major |
| Flaky Test | Uses `sleep()` or arbitrary delays | Major |
| Test-to-Code Coupling | Breaks on valid refactors | Major |
| Giant Test | Tests multiple behaviors in one | Minor |
| Missing Edge Cases | Happy path only | Minor |

## Severity Guide

| Severity | Meaning | Blocks? |
|----------|---------|---------|
| **Blocker** | Test proves nothing or is fundamentally broken | Yes |
| **Major** | Coverage gap on critical path, fragile test strategy | Yes |
| **Minor** | Missing edge case on low-risk path, style issue | No |
| **Nit** | Naming, minor structure improvement | No |

## Output

Write to `{output_path}/review-tests-{iteration}.md`.

### Required Sections

1. **Summary** — severity counts + verdict
2. **Coverage Matrix** — plan tasks / acceptance criteria mapped to test locations (covered / weak / missing)
3. **Issues** — grouped by severity, each with:
   - Location (`file:line`)
   - Description + anti-pattern name if applicable
   - Suggested fix
4. **Verdict** — `PASS` | `CHANGES_REQUESTED`

## Inputs

Use when available:
- Technical plan — what should be tested
- Implementation log — what was built
- Test files — actual test code
- `technical_skills_prompt` — language/framework skills to load
