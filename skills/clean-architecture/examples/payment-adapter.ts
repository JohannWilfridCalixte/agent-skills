import type { Money, Result } from './order';
import { Err, Ok } from './order';

export interface PaymentResult { readonly id: string; readonly status: 'completed'; }
export interface PaymentError { readonly code: 'PAYMENT_FAILED'; readonly message: string; }
export interface PaymentGateway {
  readonly charge: (amount: Money, customerId: string, idempotencyKey: string, signal: AbortSignal) => Promise<Result<PaymentResult, PaymentError>>;
}
export interface ProviderClient {
  readonly charge: (input: { readonly amount: number; readonly currency: string; readonly customerId: string; readonly idempotencyKey: string; readonly signal: AbortSignal }) => Promise<{ readonly id: string }>;
}
export class ProviderUnavailable extends Error {}

export class PaymentAdapter implements PaymentGateway {
  constructor(private readonly provider: ProviderClient) {}

  async charge(amount: Money, customerId: string, idempotencyKey: string, signal: AbortSignal) {
    signal.throwIfAborted();
    try {
      const payment = await this.provider.charge({ amount: amount.minorUnits, currency: amount.currency, customerId, idempotencyKey, signal });
      return Ok({ id: payment.id, status: 'completed' } as const);
    } catch (error: unknown) {
      if (signal.aborted) throw error;
      if (!(error instanceof ProviderUnavailable)) throw error;
      return Err({ code: 'PAYMENT_FAILED', message: 'Payment provider unavailable' } as const);
    }
  }
}
