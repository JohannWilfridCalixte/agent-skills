---
name: agentic:skill:write-instrumented-code
description: Use when writing code in order to add logging, tracing, or instrumentation to any service
---

# Observability

## The Rules

**Logs:**
- JSON only: `{message, service_name, service_revision, environment}`
- Stack traces in `stack` field
- No multiline/plain text

**Tracing:**
- Instrument: hot paths, critical logic, service boundaries
- OpenTelemetry preferred
- Tag spans: `service_name`, `service_revision`, `environment`
- Same attribute names in logs AND spans
- forward correlation id whenever possible

## Required Fields (Every Log/Span)

| Field | Example |
|-------|---------|
| `service_name` | `"payment-service"` |
| `service_revision` | `"a1b2c3d"` or `"v1.2.3-a1b2c3d"` (git hash or docker tag) |
| `environment` | `"production"` |

## Multi-Tenant Apps

| Field | When |
|-------|------|
| `tenant_id` | Always in multi-tenant context |
| `company_id` | When tenant = company (keep `tenant_id` too) |

If tenant is a company: log BOTH `tenant_id` and `company_id` (same value, but `tenant_id` for consistency across services).

## Attribute Naming

Use snake_case everywhere. Same names in logs and spans:
- `tenant_id` not `tenantId`
- `order_id` not `orderId`
- `user_id` not `userId`
- `transaction_id` not `transactionId`

## Quick Example

```typescript
// Logger setup (inject service metadata once)
const logger = createLogger({
  service_name: 'payment-service',
  service_revision: process.env.GIT_SHA || process.env.IMAGE_TAG,
  environment: process.env.NODE_ENV,
  tenant_id: ctx.tenantId,        // multi-tenant
  company_id: ctx.tenantId        // if tenant = company
});

// Tracing with OpenTelemetry
const tracer = trace.getTracer('payment-service');

async function processPayment(order_id: string, amount: number) {
  return tracer.startActiveSpan('process_payment', {
    attributes: { order_id, amount }
  }, async (span) => {
    logger.info({ message: 'payment_started', order_id, amount });
    // ... logic
    span.end();
  });
}
```

## Red Flags - STOP and Fix

- `console.log` anywhere
- Plain text log messages
- Missing `service_name`, `service_revision`, or `environment`
- Multi-tenant app without `tenant_id`
- Logs without corresponding spans on critical paths
- camelCase attributes (use snake_case)
- Multiline stack traces (wrap in `stack` field)

## Merge Blocker

**No plain logs or untagged spans = no merge.**
