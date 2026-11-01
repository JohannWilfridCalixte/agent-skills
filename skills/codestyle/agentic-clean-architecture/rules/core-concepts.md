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
     ↓              ↓
Infrastructure ────┘
```

**Outer layers know inner. Inner layers know nothing about outer.**

When execution flows outward (domain needs DB), use **Dependency Inversion**: domain defines interface (Port), infrastructure implements it (Adapter).
