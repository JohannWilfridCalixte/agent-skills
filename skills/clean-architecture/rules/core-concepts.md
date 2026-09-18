---
title: Core Concepts
impact: CRITICAL
tags: layers, dependency-rule, clean, hexagonal, onion
---

## Core Concepts

**Impact: CRITICAL**

### Layers

| Layer | Contains | Depends On | Never Contains |
|-------|----------|------------|----------------|
| **Domain** | Entities, Value Objects, Domain Services | Nothing | Framework code, annotations, I/O |
| **Application** | Use Cases, DTOs, Port interfaces | Domain | Direct infrastructure calls |
| **Infrastructure** | Adapters, ORM, HTTP clients | Application, Domain | Business rules |
| **Presentation** | Controllers, CLI handlers | Application | Business logic |

### The Dependency Rule

```
Presentation → Application → Domain
Infrastructure → Application / Domain
```

**Outer layers know inner. Inner layers know nothing about outer.**

These arrows show source dependencies, not runtime calls. When execution needs I/O, use **Dependency Inversion**: define the port in the inward layer that consumes the capability (usually application; domain only when a domain abstraction requires it), and implement it in infrastructure. The domain performs no I/O; application orchestration invokes injected ports.
