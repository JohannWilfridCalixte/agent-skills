---
name: agentic:skill:typescript-engineer
description: Use when writing TypeScript code - covers types, error handling, style, and patterns
---

# TypeScript Engineer

Rules for writing production-grade TypeScript. Covers type safety, error handling, code style, and patterns.

## When to Apply

- Writing new TypeScript code
- Reviewing or refactoring TypeScript code
- Any file ending in `.ts` or `.tsx`

## Rule Categories

| Priority | Category | Rules |
|----------|----------|-------|
| CRITICAL | Core Principles | `core-principles.md` |
| CRITICAL | Typing | `typing.md` |
| CRITICAL | Switch Exhaustiveness | `switch-exhaustiveness.md` |
| HIGH | Error Handling | `error-handling.md` |
| HIGH | Code Style | `code-style.md` |
| MEDIUM | Imports | `imports.md` |
| MEDIUM | Strategy Pattern | `strategy-pattern.md` |

## Quick Reference (Red Flags)

| Red Flag | Fix |
|----------|-----|
| `type` for object shapes | Use `interface` |
| Missing `readonly` on properties | Add `readonly` everywhere |
| `readonly` inside `z.object({})` | Remove - runtime JS, not type syntax |
| `any` or `as` casts | `unknown` + narrowing or type guards |
| Explicit return types (including `: Result<T,E>`, `: Promise<T>`) | NEVER. Inference + `as const` / `satisfies` |
| Function overloads | Union returns instead |
| Throwing in domain logic | `Result<T, E>` |
| Switch without `satisfies never` | Add default with `satisfies never` |
| Nesting > 3 levels | Extract functions |
| Abbreviated variable names | Full names |
| Mixed type/value imports | Separate `import type` from values |

## How to Use

Rules are in the `rules/` folder. Each follows `rules/_template.md` format.

When writing TypeScript, check rules by priority (CRITICAL first). Apply all applicable rules.
