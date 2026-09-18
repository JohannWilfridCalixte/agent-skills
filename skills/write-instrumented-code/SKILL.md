---
name: agentic:skill:write-instrumented-code
description: Use when adding or reviewing service logging, tracing, or instrumentation.
---

# Observability

Instrument hot paths, critical logic and service boundaries with structured events and traces. OpenTelemetry is preferred. These are service telemetry rules; intentional CLI output is a separate product interface, not a substitute for service logging.

## Logs and traces

- Emit JSON records with a `message` event and service metadata. Put stack traces in the structured `stack` field; do not emit plain/multiline service logs or use `console.log` for them.
- Trace critical operations, propagate correlation IDs when available, and use the same attribute names in logs and spans.
- End spans on success, exception and cancellation using `finally` or the SDK's lifecycle-safe context manager. Record sanitized failures and the appropriate span status, then propagate or translate the original failure at its owning boundary.
- Preserve the application's event/level conventions. The example uses `info` for lifecycle/business outcomes and `error` for unexpected operation failure; an expected decline is not automatically an unexpected exception. This skill does not prescribe a universal level matrix or method-name field.

## Required fields (every emitted log/span)

| Field | Example |
|---|---|
| `service_name` | `"payment-service"` |
| `service_revision` | `"a1b2c3d"` or `"v1.2.3-a1b2c3d"` (git hash or image tag) |
| `environment` | `"production"` |

Validate required configuration at startup; `undefined`, empty environment values or a missing revision are not valid metadata. A logger binding or tracing resource may supply these fields if the exported telemetry actually includes them. Standard OpenTelemetry resource attributes can coexist with this project's schema; verify the export mapping rather than assuming differently named fields satisfy it.

## Tenant context and attribute names

| Field | When |
|---|---|
| `tenant_id` | Always in a multi-tenant context |
| `company_id` | When tenant = company, keep `tenant_id` too |

If tenant is a company, emit both fields with the same value. Use snake_case attribute names consistently: `tenant_id`, `order_id`, `user_id`, `transaction_id`, `correlation_id`. Operation/span names should identify the actual operation; preserve the project's naming convention.

Derive trusted tenant/actor context from the authorized request. Bind or copy context per invocation and propagate it across async work; never mutate a shared singleton's tenant fields. Release/reset scoped context during cleanup. Concurrent requests must not contaminate each other's records or traces.

## Sensitive data and failure ownership

Project an allowlist of useful diagnostic fields. Never log passwords, tokens, secret headers, complete credentials or unapproved PII in events, metadata, span attributes or exception payloads. Error messages/stacks and provider responses can contain secrets too; apply the same redaction policy before recording them. Redaction must cover nested/structured input, not only the message string.

Assign error logging to the handling boundary to avoid repeated reports at every rethrow. Cancellation is a control-flow outcome: clean up and propagate it without scheduling an unsafe retry. Failures after a remote write may require idempotency/reconciliation; telemetry must not claim a rollback or a successful effect it has not observed. Exporter/logger failures should follow the service's resilience policy without replacing the original business failure or skipping cleanup.

## Example

The complete [payment instrumentation](examples/payment.ts) uses structural ports for a JSON logger and OpenTelemetry-compatible active-span adapter. It validates service metadata, copies allowed request context, closes spans in `finally`, omits the input password, redacts exception details and rethrows the original error. Its explicit resilience policy isolates failed log/span writes so they cannot replace the payment outcome; exporter health monitoring owns those failures. The tracer adapter must invoke business work exactly once despite exporter trouble. The caller supplies trusted context and chooses the operation's level conventions.

```typescript
return tracer.startActiveSpan('process_payment', { attributes }, async (span) => {
  try {
    logger.info({ ...attributes, message: 'payment_started' });
    return await pay(input, signal);
  } catch (error: unknown) {
    // Record only a sanitized diagnostic, never the provider's raw error.
    span.recordException({ name: 'PaymentFailure', message: 'payment_failed', stack: '[redacted]' });
    span.setStatus({ code: 2 });
    throw error;
  } finally {
    span.end();
  }
});
```

This lifecycle excerpt assumes validated, nonthrowing telemetry bindings; the complete example shows their failure isolation and cancellation handling. Real SDK/exporter integration still needs a check of exported records, resource metadata and request context.

## Red flags and merge gate

**Block merge when the changed service telemetry contains plain/unstructured logs, missing required service/tenant metadata, leaked sensitive data, missing spans on critical paths, inconsistent attribute names, or spans/context that are not cleaned up on failure.** Fix the demonstrated violation; the absence of these defects is the instrumentation gate's passing condition. It does not establish that all other review/test gates passed.

Verify exception and cancellation cleanup, missing metadata, redaction (including error payloads), and overlapping tenant requests. A function-call log lacking an optional operation/method field is not itself a violation; useful operation context and any stricter project schema still apply.
