// Example policy: nonnegative safe-integer minor units in EUR or USD.
export type Currency = 'EUR' | 'USD';
export interface Success<T> { readonly ok: true; readonly value: T; }
export interface Failure<E> { readonly ok: false; readonly error: E; }
export type Result<T, E> = Success<T> | Failure<E>;
export const Ok = <T>(value: T) => ({ ok: true as const, value });
export const Err = <E>(error: E) => ({ ok: false as const, error });

export interface MoneyError {
  readonly code: 'INVALID_AMOUNT' | 'CURRENCY_MISMATCH';
  readonly message: string;
}

export class Money {
  private constructor(readonly minorUnits: number, readonly currency: Currency) {}

  static create(minorUnits: number, currency: Currency) {
    if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
      return Err({ code: 'INVALID_AMOUNT', message: 'Amount must be nonnegative safe-integer minor units' } as const);
    }
    return Ok(new Money(minorUnits, currency));
  }

  static zero(currency: Currency) {
    return new Money(0, currency);
  }

  add(other: Money) {
    if (this.currency !== other.currency) {
      return Err({ code: 'CURRENCY_MISMATCH', message: 'Currencies must match' } as const);
    }
    return Money.create(this.minorUnits + other.minorUnits, this.currency);
  }
}

export interface OrderError {
  readonly code: 'ORDER_NOT_DRAFT';
  readonly message: string;
}

export class Order {
  private constructor(
    readonly id: string,
    readonly currency: Currency,
    readonly items: readonly Money[],
    readonly status: 'draft' | 'confirmed',
  ) {}

  static create(id: string, currency: Currency, items: readonly Money[]) {
    const order = new Order(id, currency, [...items], 'draft');
    const total = order.calculateTotal();
    if (!total.ok) return total;
    return Ok(order);
  }

  addItem(item: Money) {
    if (this.status !== 'draft') {
      return Err({ code: 'ORDER_NOT_DRAFT', message: 'Cannot modify a confirmed order' } as const);
    }
    return Order.create(this.id, this.currency, [...this.items, item]);
  }

  confirm() {
    return new Order(this.id, this.currency, this.items, 'confirmed');
  }

  calculateTotal() {
    let total = Money.zero(this.currency);
    for (const item of this.items) {
      const result = total.add(item);
      if (!result.ok) return result;
      total = result.value;
    }
    return Ok(total);
  }
}
