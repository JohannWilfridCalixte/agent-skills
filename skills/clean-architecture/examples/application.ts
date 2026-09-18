import type { Currency, Money, MoneyError, OrderError, Result } from './order';
import { Err, Order } from './order';

export interface StoreError {
  readonly code: 'STORE_UNAVAILABLE' | 'IDEMPOTENCY_CONFLICT';
  readonly message: string;
}
export interface Customer { readonly id: string; }
export interface CustomerRepository {
  readonly findById: (id: string, signal: AbortSignal) => Promise<Result<Customer | null, StoreError>>;
}
export interface OrderPlaced {
  readonly id: string;
  readonly orderId: string;
  readonly customerId: string;
}
export interface PersistOrder {
  readonly order: Order;
  readonly event: OrderPlaced;
  readonly idempotencyKey: string;
}
export interface OrderRepository {
  // One transaction: unique scoped key + request comparison + order + outbox event.
  // Same key/payload returns the original order; different payload returns conflict.
  readonly saveWithOutbox: (request: PersistOrder, signal: AbortSignal) => Promise<Result<Order, StoreError>>;
}
export interface PlaceOrderCommand {
  readonly orderId: string;
  readonly customerId: string;
  readonly currency: Currency;
  readonly items: readonly Money[];
  readonly idempotencyKey: string;
}
export interface CustomerNotFound {
  readonly code: 'CUSTOMER_NOT_FOUND';
  readonly message: string;
}
export type PlaceOrderError = CustomerNotFound | MoneyError | OrderError | StoreError;

export class PlaceOrderUseCase {
  constructor(
    private readonly customerRepo: CustomerRepository,
    private readonly orderRepo: OrderRepository,
  ) {}

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
}

export interface DeliveryError {
  readonly code: 'DELIVERY_FAILED';
  readonly message: string;
}
export interface NotificationPort {
  // The provider/adapter deduplicates retries by event.id.
  readonly orderPlaced: (event: OrderPlaced, signal: AbortSignal) => Promise<Result<null, DeliveryError>>;
}
export interface OutboxRepository {
  readonly markDelivered: (eventId: string, signal: AbortSignal) => Promise<Result<null, StoreError>>;
}
export class DeliverOrderNotification {
  constructor(private readonly outbox: OutboxRepository, private readonly notifications: NotificationPort) {}

  async execute(event: OrderPlaced, signal: AbortSignal) {
    signal.throwIfAborted();
    const delivery = await this.notifications.orderPlaced(event, signal);
    if (!delivery.ok) return delivery;
    return this.outbox.markDelivered(event.id, signal);
  }
}
