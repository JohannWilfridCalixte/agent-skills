// Compile and exercise the real architecture examples; no application dependencies.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const compiler = process.argv[2];
if (!compiler) throw new Error('Pass the path to an existing TypeScript tsc.js');
const temporary = mkdtempSync(join(tmpdir(), 'agentic-architecture-'));
try {
  const source = join(root, 'skills/clean-architecture/examples');
  const compile = spawnSync(process.execPath, [compiler, '--strict', '--target', 'ES2022', '--module', 'commonjs', '--outDir', temporary, ...['order.ts', 'application.ts', 'payment-adapter.ts'].map(name => join(source, name))], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stdout + compile.stderr);
  const require = createRequire(import.meta.url);
  const { Money, Order, Ok, Err } = require(join(temporary, 'order.js'));
  const { PlaceOrderUseCase, DeliverOrderNotification } = require(join(temporary, 'application.js'));
  const { PaymentAdapter, ProviderUnavailable } = require(join(temporary, 'payment-adapter.js'));
  const euro = Money.create(125, 'EUR').value;
  const dollar = Money.create(200, 'USD').value;
  for (const value of [-1, 0.5, Infinity, NaN]) assert.equal(Money.create(value, 'EUR').error.code, 'INVALID_AMOUNT');
  const empty = Order.create('empty', 'EUR', []).value;
  assert.equal(empty.calculateTotal().value.minorUnits, 0);
  assert.equal(Order.create('mixed', 'EUR', [euro, dollar]).error.code, 'CURRENCY_MISMATCH');
  assert.equal(Money.create(Number.MAX_SAFE_INTEGER, 'EUR').value.add(euro).error.code, 'INVALID_AMOUNT');
  const draft = Order.create('order-1', 'EUR', [euro]).value;
  assert.equal(draft.addItem(euro).value.calculateTotal().value.minorUnits, 250);
  assert.equal(draft.calculateTotal().value.minorUnits, 125);
  assert.equal(draft.confirm().addItem(euro).error.code, 'ORDER_NOT_DRAFT');

  const controller = new AbortController();
  const signal = controller.signal;
  let saves = 0;
  const orders = new Map();
  const events = new Map();
  // Fake verifies the use-case port contract; it does not prove DB atomicity.
  const repository = { async saveWithOutbox(request) {
    saves += 1;
    const fingerprint = JSON.stringify([request.order.id, request.event.customerId, request.order.currency, request.order.items.map(item => item.minorUnits)]);
    const previous = orders.get(request.idempotencyKey);
    if (previous) return previous.fingerprint === fingerprint ? Ok(previous.order) : Err({ code: 'IDEMPOTENCY_CONFLICT', message: 'conflict' });
    orders.set(request.idempotencyKey, { fingerprint, order: request.order });
    events.set(request.event.id, request.event);
    return Ok(request.order);
  } };
  const customers = { async findById(id) { return Ok({ id }); } };
  const useCase = new PlaceOrderUseCase(customers, repository);
  const command = { orderId: 'order-1', customerId: 'customer-1', currency: 'EUR', items: [euro], idempotencyKey: 'request-1' };
  assert.equal((await useCase.execute(command, signal)).ok, true);
  assert.equal((await useCase.execute(command, signal)).value.id, 'order-1');
  assert.equal(orders.size, 1);
  assert.equal(events.size, 1);
  assert.equal((await useCase.execute({ ...command, items: [euro, euro] }, signal)).error.code, 'IDEMPOTENCY_CONFLICT');
  const failedStore = new PlaceOrderUseCase(customers, { async saveWithOutbox() { return Err({ code: 'STORE_UNAVAILABLE', message: 'unavailable' }); } });
  assert.equal((await failedStore.execute(command, signal)).error.code, 'STORE_UNAVAILABLE');
  const missingCustomer = new PlaceOrderUseCase({ async findById() { return Ok(null); } }, repository);
  assert.equal((await missingCustomer.execute(command, signal)).error.code, 'CUSTOMER_NOT_FOUND');
  const beforeCancellation = saves;
  controller.abort();
  await assert.rejects(useCase.execute(command, signal));
  assert.equal(saves, beforeCancellation);

  const deliverySignal = new AbortController().signal;
  const delivered = new Set();
  let acknowledgements = 0;
  const notifications = { async orderPlaced(event) { delivered.add(event.id); return Ok(null); } };
  const outbox = { async markDelivered() { acknowledgements += 1; return acknowledgements === 1 ? Err({ code: 'STORE_UNAVAILABLE', message: 'unavailable' }) : Ok(null); } };
  const dispatcher = new DeliverOrderNotification(outbox, notifications);
  const event = events.values().next().value;
  assert.equal((await dispatcher.execute(event, deliverySignal)).error.code, 'STORE_UNAVAILABLE');
  assert.equal((await dispatcher.execute(event, deliverySignal)).ok, true);
  assert.equal(delivered.size, 1);
  const adapter = new PaymentAdapter({ async charge() { throw new ProviderUnavailable('password=secret'); } });
  const failure = await adapter.charge(euro, 'customer-1', 'request-1', deliverySignal);
  assert.equal(failure.error.code, 'PAYMENT_FAILED');
  assert.equal(JSON.stringify(failure).includes('secret'), false);
  const broken = new PaymentAdapter({ async charge() { throw new TypeError('bug'); } });
  await assert.rejects(broken.charge(euro, 'customer-1', 'request-1', deliverySignal), TypeError);
  console.log('PASS: strict TypeScript; money, order transitions, use-case errors/retries/cancellation, outbox retry, adapter error translation');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
