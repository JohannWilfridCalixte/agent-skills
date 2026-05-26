---
title: Switch Exhaustiveness
impact: CRITICAL
tags: switch, satisfies-never, union, exhaustive-check
---

## Switch Exhaustiveness

**Impact: CRITICAL**

All switches on unions use `satisfies never` in default. Compile-time + runtime safety.

**Incorrect:**

```typescript
function getPrice(item: CartItem): number {
  switch (item.type) {
    case 'product': return item.unitPrice * item.quantity;
    case 'service': return item.hourlyRate * item.hours;
    // No default - silent bug if new type added
  }
}
```

**Correct:**

```typescript
function getPrice(item: CartItem): number {
  switch (item.type) {
    case 'product': return item.unitPrice * item.quantity;
    case 'service': return item.hourlyRate * item.hours;
    default: throw new Error(`unexpected type ${item.type satisfies never}`);
  }
}
```
