---
title: Dependency Injection
impact: HIGH
tags: di, composition-root, constructor-injection, interfaces
---

## Dependency Injection

**Impact: HIGH**

Composition root wiring for the constructors in [application.ts](../examples/application.ts), with concrete project adapters supplied at startup:

```typescript
const placeOrder = new PlaceOrderUseCase(customerRepo, orderRepo);
const deliverNotification = new DeliverOrderNotification(outboxRepo, notifications);
const paymentGateway = new PaymentAdapter(providerClient);
```

- Inject effectful infrastructure; do not instantiate SDK clients, database pools or transport adapters inside business code. Constructing a validated entity/value object is normal domain behavior.
- Constructor injection is the default; use the project's composition mechanism.
- Depend on owned port interfaces at architectural boundaries, not concrete provider types.
- Compose at application startup, including validated configuration and resource lifecycle ownership.
- Keep request/tenant state scoped per invocation; do not mutate shared singleton context.

The examples deliberately distinguish order persistence from payment and notification adapters. Do not pass a payment gateway into an order-repository constructor slot simply because the parameter counts match.
