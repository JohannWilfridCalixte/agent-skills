---
title: Ports and Adapters
impact: CRITICAL
tags: port, adapter, interface, infrastructure, dependency-inversion
---

## Ports and Adapters

**Impact: CRITICAL**

**Port** = interface in the inward layer that consumes a capability (usually application; domain for a domain abstraction). **Adapter** = infrastructure implementation. Define what the application needs, not a copy of a vendor SDK.

The complete [payment adapter](../examples/payment-adapter.ts) uses a provider client behind an application-owned interface:

```typescript
interface PaymentGateway {
  readonly charge: (amount: Money, customerId: string, idempotencyKey: string, signal: AbortSignal) => Promise<Result<PaymentResult, PaymentError>>;
}
```

Contract types describe the interface; implementations retain inferred returns under the selected TypeScript policy. The adapter converts Money to provider input, forwards idempotency and cancellation, narrows caught `unknown`, and translates the provider's recognized unavailable error to a stable `PAYMENT_FAILED` Result. It does not expose the provider's message. Unexpected programming failures and cancellation propagate after cleanup. In a real adapter, use the SDK's documented operational error types; do not catch every exception as a declined payment.

**Primary adapters** drive the app: controllers, CLI handlers, message handlers. **Secondary adapters** are driven by it: repositories, external APIs, email services. Validate untrusted input at the entry boundary, enforce authorization against the resource contract, and map persistence/transport schemas to domain inputs. Runtime source dependencies still point inward even when calls execute outward.
