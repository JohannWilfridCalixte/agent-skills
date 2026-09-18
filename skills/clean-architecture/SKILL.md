---
name: agentic:skill:clean-architecture
description: Use when writing or modifying backend code that has business logic — services, domain models, use cases, APIs with validation/calculations/state transitions. Default for any non-trivial backend work.
---

# Clean Architecture

## Overview

**Business logic stays pure, infrastructure stays outside.**

These rules own dependency boundaries and domain behavior. Selected language policies own their representation and syntax: retain domain invariants using that language's approved records/classes, immutability and error handling. Examples do not override a selected language skill. Preserve accepted architecture; surface consequential changes through the owning task's decision process rather than broad unsolicited refactoring.

All three patterns (Clean, Hexagonal, Onion) share one rule: **dependencies point inward**. Domain knows nothing about HTTP, databases, or frameworks.

## When to Use

**Default: ON for any backend code with business logic.**

```dot
digraph when_to_use {
  "Backend code?" [shape=diamond];
  "Skip" [shape=box];
  "Has business logic?" [shape=diamond];
  "Use clean architecture" [shape=box];
  "Keep it simple" [shape=box];

  "Backend code?" -> "Skip" [label="no (scripts, frontend-only)"];
  "Backend code?" -> "Has business logic?" [label="yes"];
  "Has business logic?" -> "Use clean architecture" [label="yes (default)"];
  "Has business logic?" -> "Keep it simple" [label="no, pure CRUD"];
}
```

**Use when (any of these):**
- Writing or modifying backend services, APIs, or domain models
- Business rules exist (validation, calculations, state transitions)
- Rules need testing without infrastructure
- Multiple entry points (API, CLI, queue, events)
- External systems may change (payment providers, DBs)

**Skip when:**
- Pure CRUD with no business logic
- Simple scripts or utilities
- Prototypes / throwaway code
- Frontend-only code

## Rule Categories

| Priority | Category | Rules |
|----------|----------|-------|
| CRITICAL | Core Concepts | `core-concepts.md` |
| CRITICAL | Ports and Adapters | `ports-and-adapters.md` |
| CRITICAL | Domain Model | `domain-model.md` |
| HIGH | Use Cases | `use-cases.md` |
| HIGH | Dependency Injection | `dependency-injection.md` |
| MEDIUM | Testing Strategy | `testing-strategy.md` |
| MEDIUM | Common Mistakes | `common-mistakes.md` |

## Quick Reference (Red Flags)

| Smell | Problem | Fix |
|-------|---------|-----|
| `import { Repository } from 'typeorm'` in domain | ORM in domain | Define own interface |
| Business rule in controller | Logic in wrong layer | Move to domain entity/service |
| `if (dto.type === 'X')` in use case | Business logic leaked | Move to domain |
| Entity is just data + getters | Business rules may be displaced | Put rules in domain behavior; use the selected language's model style |
| 10 interfaces for CRUD endpoint | Over-engineering | Simplify, add abstraction when needed |
| Can't test rule without DB | Coupled domain | Extract pure function/method |

## Quick Checklist

Before committing code with business logic:

- [ ] Domain entities have behavior, not just data
- [ ] Business rules testable without DB/HTTP
- [ ] No framework imports in domain layer
- [ ] Use case orchestrates, doesn't contain business logic
- [ ] Ports defined by what domain needs, not what infrastructure provides
- [ ] Domain concepts (Money, Email, OrderId) retain validation/equality semantics in the selected model style
- [ ] Effectful use cases define failure, concurrency, retry/idempotency and cancellation behavior
- [ ] Schema/API changes preserve the agreed compatibility window and migration order

## How to Use

Rules are in the `rules/` folder. Each follows `rules/_template.md` format.

When designing or refactoring services, check rules by priority (CRITICAL first). Apply all applicable rules.

The complete TypeScript examples in `examples/` illustrate one explicit money policy and a transactional outbox contract. Their domain and adapter behavior are exercised by `tests/engineering-examples` in this repository. Use the existing project money/transaction contracts when applying these patterns.
