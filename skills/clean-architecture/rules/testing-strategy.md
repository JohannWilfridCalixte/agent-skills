---
title: Testing Strategy
impact: MEDIUM
tags: testing, unit, integration, e2e, mocking
---

## Testing Strategy

**Impact: MEDIUM**

| Layer | Test Type | Speed | What to Mock |
|-------|-----------|-------|--------------|
| Domain | Unit | <1ms | Nothing (pure) |
| Application | Unit | <10ms | Ports (repos, external) |
| Adapters | Integration | 100ms+ | External services (WireMock) |
| E2E | Full stack | 1s+ | Nothing |

**Domain tests are the most valuable** - fast, stable, test actual business rules.
