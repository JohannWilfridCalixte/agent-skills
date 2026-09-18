// Structural ports keep this example executable without an SDK dependency.
// A service adapter supplies an OpenTelemetry tracer and a JSON logger.
export interface ServiceMetadata {
  readonly service_name: string;
  readonly service_revision: string;
  readonly environment: string;
}
export interface RequestContext {
  readonly tenant_id: string;
  readonly company_id?: string;
  readonly correlation_id: string;
}
export interface PaymentInput {
  readonly order_id: string;
  readonly amount: number;
  readonly password?: string;
}
export interface LogRecord extends ServiceMetadata, RequestContext {
  readonly message: string;
  readonly order_id: string;
  readonly amount: number;
  readonly stack?: string;
}
export interface Logger {
  readonly info: (record: LogRecord) => void;
  readonly error: (record: LogRecord) => void;
}
export interface Span {
  readonly recordException: (exception: { readonly name: string; readonly message: string; readonly stack: string }) => void;
  readonly setStatus: (status: { readonly code: 2 }) => void;
  readonly end: () => void;
}
export interface Tracer {
  // Adapter invokes the callback exactly once and propagates its result/error.
  // SDK/exporter failures outside the callback must not prevent business work.
  readonly startActiveSpan: <T>(name: string, options: { readonly attributes: Readonly<Record<string, string | number>> }, callback: (span: Span) => Promise<T>) => Promise<T>;
}

function recordTelemetry(effect: () => void) {
  try {
    effect();
  } catch {
    // Example resilience policy: drop failed telemetry, preserve business outcome.
    // Exporter health monitoring owns these failures; do not log recursively.
  }
}

export function serviceMetadata(values: Readonly<Record<string, string | undefined>>) {
  const service_name = values.service_name;
  const service_revision = values.service_revision;
  const environment = values.environment;
  if (!service_name?.trim() || !service_revision?.trim() || !environment?.trim()) {
    throw new Error('Required service metadata is missing');
  }
  return { service_name, service_revision, environment } satisfies ServiceMetadata;
}

export function instrumentPayments(
  metadata: ServiceMetadata,
  logger: Logger,
  tracer: Tracer,
  pay: (input: PaymentInput, signal: AbortSignal) => Promise<'paid' | 'declined'>,
) {
  const service = serviceMetadata({ ...metadata });
  return async function process_payment(input: PaymentInput, context: RequestContext, signal: AbortSignal) {
    if (!context.tenant_id.trim() || !context.correlation_id.trim()) throw new Error('Required request context is missing');
    if (context.company_id !== undefined && context.company_id !== context.tenant_id) throw new Error('Company tenant context must agree');
    // Project only approved fields; never spread credentials or request payloads.
    const attributes = {
      ...service,
      tenant_id: context.tenant_id,
      ...(context.company_id === undefined ? {} : { company_id: context.company_id }),
      correlation_id: context.correlation_id,
      order_id: input.order_id,
      amount: input.amount,
    };
    return tracer.startActiveSpan('process_payment', { attributes }, async (span) => {
      try {
        signal.throwIfAborted();
        recordTelemetry(() => logger.info({ ...attributes, message: 'payment_started' }));
        const outcome = await pay(input, signal);
        recordTelemetry(() => logger.info({ ...attributes, message: outcome === 'paid' ? 'payment_succeeded' : 'payment_declined' }));
        return outcome;
      } catch (error: unknown) {
        if (signal.aborted) {
          recordTelemetry(() => logger.info({ ...attributes, message: 'payment_cancelled' }));
        } else {
          // Provider messages/stacks can contain secrets; this example redacts all.
          const failure = { name: 'PaymentFailure', message: 'payment_failed', stack: '[redacted]' };
          recordTelemetry(() => span.recordException(failure));
          recordTelemetry(() => span.setStatus({ code: 2 })); // OpenTelemetry ERROR
          recordTelemetry(() => logger.error({ ...attributes, message: failure.message, stack: failure.stack }));
        }
        throw error;
      } finally {
        recordTelemetry(() => span.end());
      }
    });
  };
}
