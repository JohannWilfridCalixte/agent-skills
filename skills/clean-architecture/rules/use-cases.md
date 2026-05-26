---
title: Use Cases
impact: HIGH
tags: application-layer, orchestration, command, use-case
---

## Use Cases (Application Layer)

**Impact: HIGH**

Thin orchestration - no business logic here:

```typescript
interface PlaceOrderError {
  readonly code: 'CUSTOMER_NOT_FOUND' | 'ORDER_CREATION_FAILED';
  readonly message: string;
}

class PlaceOrderUseCase {
  constructor(
    private readonly customerRepo: CustomerRepository,
    private readonly orderRepo: OrderRepository,
    private readonly notifications: NotificationPort
  ) {}

  async execute(cmd: PlaceOrderCommand): Promise<Result<Order, PlaceOrderError>> {
    const customer = await this.customerRepo.findById(cmd.customerId);
    if (!customer) {
      return Err({ code: 'CUSTOMER_NOT_FOUND', message: `Customer ${cmd.customerId} not found` });
    }

    const orderResult = Order.create(customer, cmd.items);
    if (!orderResult.ok) {
      return Err({ code: 'ORDER_CREATION_FAILED', message: orderResult.error.message });
    }

    await this.orderRepo.save(orderResult.value);
    await this.notifications.orderPlaced(orderResult.value);

    return Ok(orderResult.value);
  }
}
```
