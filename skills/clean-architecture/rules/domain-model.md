---
title: Domain Model
impact: CRITICAL
tags: entity, value-object, domain-service, identity, immutability, behavior
---

## Domain Model Patterns

**Impact: CRITICAL**

### Entities (Identity + Behavior)
```typescript
interface OrderError {
  readonly code: 'ORDER_NOT_DRAFT' | 'INVALID_ITEM';
  readonly message: string;
}

class Order {
  private constructor(
    readonly id: OrderId,
    private items: readonly OrderItem[],
    private status: OrderStatus
  ) {}

  // Business logic returns Result, no throwing
  addItem(item: OrderItem): Result<Order, OrderError> {
    if (this.status !== 'draft') {
      return Err({ code: 'ORDER_NOT_DRAFT', message: 'Cannot modify non-draft order' });
    }
    return Ok(new Order(this.id, [...this.items, item], this.status));
  }

  calculateTotal(): Money {
    return this.items.reduce((sum, i) => sum.add(i.total()), Money.zero());
  }
}
```

### Value Objects (Immutable, no identity)
```typescript
interface MoneyError {
  readonly code: 'NEGATIVE_AMOUNT' | 'CURRENCY_MISMATCH';
  readonly message: string;
}

class Money {
  private constructor(readonly amount: number, readonly currency: string) {}

  static create(amount: number, currency: string): Result<Money, MoneyError> {
    if (amount < 0) {
      return Err({ code: 'NEGATIVE_AMOUNT', message: 'Money cannot be negative' });
    }
    return Ok(new Money(amount, currency));
  }

  add(other: Money): Result<Money, MoneyError> {
    if (this.currency !== other.currency) {
      return Err({ code: 'CURRENCY_MISMATCH', message: `Cannot add ${this.currency} to ${other.currency}` });
    }
    return Ok(new Money(this.amount + other.amount, this.currency));
  }
}
```

### Domain Services (Cross-entity logic)
```typescript
class PricingService {
  calculateDiscount(customer: Customer, order: Order): Result<Money, PricingError> {
    // Logic spanning multiple entities
  }
}
```
