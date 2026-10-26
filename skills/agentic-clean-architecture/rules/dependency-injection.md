---
title: Dependency Injection
impact: HIGH
tags: di, composition-root, constructor-injection, interfaces
---

## Dependency Injection

**Impact: HIGH**

```typescript
// Composition root (main.ts or DI container)
const stripe = new Stripe(config.stripeKey);
const pool = new Pool(config.dbUrl);

const paymentGateway = new StripeAdapter(stripe);
const orderRepo = new PostgresOrderRepository(pool);
const notifications = new EmailNotificationAdapter(sendgrid);

const placeOrder = new PlaceOrderUseCase(orderRepo, paymentGateway, notifications);
```

**Rules:**
- Inject dependencies, never instantiate in business code
- Constructor injection preferred
- Interfaces over concrete types
- Compose at application startup
