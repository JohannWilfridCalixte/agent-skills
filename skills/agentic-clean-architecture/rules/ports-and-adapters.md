---
title: Ports and Adapters
impact: CRITICAL
tags: port, adapter, interface, infrastructure, dependency-inversion
---

## Ports and Adapters

**Impact: CRITICAL**

**Port** = interface defined by domain/application for what it needs
**Adapter** = infrastructure implementation of that interface

```typescript
// Port (in application layer) - defines WHAT we need
interface PaymentGateway {
  charge(amount: Money, customerId: string): Promise<Result<PaymentResult, PaymentError>>;
}

// Adapter (in infrastructure) - implements HOW, wraps external errors
class StripeAdapter implements PaymentGateway {
  constructor(private readonly stripe: Stripe) {}

  async charge(amount: Money, customerId: string): Promise<Result<PaymentResult, PaymentError>> {
    try {
      const charge = await this.stripe.charges.create({ ... });
      return Ok({ id: charge.id, status: 'completed' });
    } catch (error) {
      return Err({ code: 'PAYMENT_FAILED', message: error.message });
    }
  }
}
```

**Primary adapters** (drive the app): Controllers, CLI, Message handlers
**Secondary adapters** (driven by app): Repositories, External APIs, Email services
