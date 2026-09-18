---
title: Domain Model
impact: CRITICAL
tags: entity, value-object, domain-service, identity, immutability, behavior
---

## Domain Model Patterns

**Impact: CRITICAL**

### Entities (Identity + Behavior)

Entities own identity and domain behavior; the selected language may express that behavior with methods or pure operations over immutable records. Keep rules in the domain, not controllers or persistence adapters.

The complete [Order and Money example](../examples/order.ts) returns Results for expected failures. `Order.create` validates the aggregate; `addItem` prevents changes after confirmation. Totaling explicitly composes failures:

```typescript
calculateTotal() {
  let total = Money.zero(this.currency);
  for (const item of this.items) {
    const result = total.add(item);
    if (!result.ok) return result;
    total = result.value;
  }
  return Ok(total);
}
```

This is a method excerpt from the linked class. Empty orders total to zero in their declared currency; mixed currencies and overflow return errors. Returning `Money` while `add` returns a Result would hide the error contract.

### Value Objects (Immutable, no identity)

Value objects preserve validation and equality semantics. Follow the chosen language's representation rather than imposing a wrapper/class solely for architecture vocabulary. The linked example uses a class with a private constructor, `Money.create`, `Money.zero(currency)` and `Money.add`.

Its explicit example policy is nonnegative safe-integer minor units in EUR/USD. Creation rejects negative, fractional, nonfinite and unsafe amounts; addition rejects currency mismatch and overflow. This is not a universal money policy: establish the application's currencies, scale, rounding, negative-value and serialization requirements. Use decimal or another representation when those requirements demand it; do not silently replace an existing money model.

Expected errors have stable codes (`INVALID_AMOUNT`, `CURRENCY_MISMATCH`); callers propagate or handle them. A value object's immutable fields must not expose mutable nested state that bypasses its invariants.

### Domain Services (Cross-entity logic)

A pricing or eligibility rule spanning multiple entities belongs in a pure domain service/operation. Give it domain inputs and return a value or Result; keep customer lookup, transactions, network calls and logging orchestration outside. Prefer a method when the behavior belongs to one entity; do not create a service interface per class without an architectural boundary.
