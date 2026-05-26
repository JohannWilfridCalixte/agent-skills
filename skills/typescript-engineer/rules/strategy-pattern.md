---
title: Strategy Pattern
impact: MEDIUM
tags: strategy, pattern, discriminator, polymorphism
---

## Strategy Pattern

**Impact: MEDIUM**

Use when same discriminator switched in 3+ locations with 5+ lines per branch.

```typescript
// Define interface
interface ItemStrategy<T> {
  readonly type: ItemType;
  readonly validate: (data: unknown) => Result<T, Error>;
  readonly calculate: (data: T) => number;
}

// Implement as plain objects (not classes)
const ProductStrategy: ItemStrategy<Product> = {
  type: 'product',
  validate: (data) => validateProduct(data),
  calculate: (data) => data.unitPrice * data.quantity,
};

// Factory with satisfies never
function getStrategy(type: ItemType): ItemStrategy<ItemData> {
  switch (type) {
    case 'product': return ProductStrategy;
    case 'service': return ServiceStrategy;
    default: throw new Error(`unexpected type: ${type satisfies never}`);
  }
}
```
