---
title: Use Cases
impact: HIGH
tags: application-layer, orchestration, command, use-case, idempotency, outbox
---

## Use Cases (Application Layer)

**Impact: HIGH**

Thin orchestration: resolve inputs through ports, invoke domain behavior, persist effects and translate/propagate failures. Business rules stay in the domain.

The complete [application example](../examples/application.ts) composes the [Order model](../examples/order.ts):

```typescript
async execute(command: PlaceOrderCommand, signal: AbortSignal) {
  signal.throwIfAborted();
  const customer = await this.customerRepo.findById(command.customerId, signal);
  if (!customer.ok) return customer;
  if (!customer.value) return Err({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' } as const);

  const order = Order.create(command.orderId, command.currency, command.items);
  if (!order.ok) return order;
  signal.throwIfAborted();
  return this.orderRepo.saveWithOutbox({
    order: order.value,
    event: { id: `order-placed:${order.value.id}`, orderId: order.value.id, customerId: customer.value.id },
    idempotencyKey: command.idempotencyKey,
  }, signal);
}
```

The method's repository and domain errors remain visible in its inferred Result union. `CUSTOMER_NOT_FOUND` differs from `STORE_UNAVAILABLE`; creation errors are not mislabeled as successful persistence. Cancellation propagates rather than becoming a retryable domain error.

### Effects, retries and concurrency

Define the transaction and delivery contract before claiming success. Saving an order and then directly sending a notification can partially succeed. In this example, `saveWithOutbox` must atomically persist the order, unique idempotency record and durable notification event. Same scoped key and payload return the original order; reusing the key for a different request returns `IDEMPOTENCY_CONFLICT`. The adapter compares the canonical business payload and scopes keys to the authorized actor/tenant. Do not trust a caller-supplied fingerprint.

A separate `DeliverOrderNotification` retries the event using its stable event ID. If sending succeeds but acknowledgement fails, delivery may repeat: the notification adapter/provider must deduplicate that ID, or the documented product contract must explicitly tolerate duplicates. This is not an exactly-once claim. The complete example defines both delivery and acknowledgement failure results.

Use transaction isolation, unique constraints or version checks to enforce concurrent invariants at the persistence boundary; an in-memory pre-check is insufficient. Bound retries to known transient failures and safe/idempotent operations. Preserve cancellation/timeout state, release resources, and treat an interrupted remote write as potentially committed until reconciled.

### Schema and API evolution

For an affected schema/contract, define the old/new reader/writer compatibility window. Prefer expand → backfill/migrate → switch readers/writers → contract after compatibility evidence. Keep migration state and rollback limits explicit; a destructive rollback cannot be assumed safe after new writes. Adapters own persistence migration details, while domain rules remain independent of database schema.
