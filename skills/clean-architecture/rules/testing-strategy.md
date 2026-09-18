---
title: Testing Strategy
impact: MEDIUM
tags: testing, unit, integration, e2e, mocking
---

## Testing Strategy

**Impact: MEDIUM**

| Layer | Test Type | Speed | What to Mock |
|-------|-----------|-------|--------------|
| Domain | Unit | Typically <1ms | Nothing (pure) |
| Application | Unit + integration for wiring | Typically <10ms for units | Ports (repos, external) in isolated use-case tests |
| Adapters | Integration | 100ms+ | External services (WireMock) |
| E2E | Full stack | 1s+ | Nothing |

Domain tests give fast, stable evidence for business rules. Timings are illustrative, not gates or quotas. Application/adapter integrations verify real wiring and persistence contracts; use `agentic:skill:code-testing` for behavior, doubles and isolation guidance.

For effects, test concurrent conflicts, duplicate/replayed requests, cancellation cleanup, persistence failure and retries after partial success. An outbox claim needs adapter integration evidence that order/event/key commit atomically; a unit fake alone cannot prove transaction isolation. For migrations, exercise supported old/new schema readers and the expand→migrate→contract sequence, including rollback limitations.
