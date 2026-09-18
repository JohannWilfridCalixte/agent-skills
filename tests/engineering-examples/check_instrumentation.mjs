// Exercise compiled instrumentation under failure and concurrent tenant requests.
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
const temporary = mkdtempSync(join(tmpdir(), 'agentic-instrumentation-'));
try {
  const compile = spawnSync(process.execPath, [compiler, '--strict', '--target', 'ES2022', '--module', 'commonjs', '--outDir', temporary, join(root, 'skills/write-instrumented-code/examples/payment.ts')], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stdout + compile.stderr);
  const require = createRequire(import.meta.url);
  const { serviceMetadata, instrumentPayments } = require(join(temporary, 'payment.js'));
  const metadata = { service_name: 'payments', service_revision: 'abc123', environment: 'test' };
  assert.throws(() => serviceMetadata({ ...metadata, service_revision: undefined }), /metadata/);
  const logs = [];
  const spans = [];
  const logger = { info(record) { logs.push(record); }, error(record) { logs.push(record); } };
  const tracer = { startActiveSpan(name, options, callback) {
    const record = { name, attributes: options.attributes, ended: 0, errors: [], statuses: [] };
    spans.push(record);
    return callback({ end() { record.ended += 1; }, recordException(error) { record.errors.push(error); }, setStatus(status) { record.statuses.push(status); } });
  } };
  const signal = new AbortController().signal;
  const releases = new Map();
  const pay = input => new Promise((resolvePayment, rejectPayment) => releases.set(input.order_id, () => input.order_id === 'a' ? rejectPayment(new Error('password=SECRET')) : resolvePayment('paid')));
  const processPayment = instrumentPayments(metadata, logger, tracer, pay);
  const contextA = { tenant_id: 'tenant-a', company_id: 'tenant-a', correlation_id: 'trace-a' };
  const contextB = { tenant_id: 'tenant-b', correlation_id: 'trace-b' };
  const first = processPayment({ order_id: 'a', amount: 125, password: 'SECRET' }, contextA, signal);
  const firstRejected = assert.rejects(first, /SECRET/); // Original business failure is preserved.
  const second = processPayment({ order_id: 'b', amount: 250, password: 'SECRET' }, contextB, signal);
  releases.get('b')();
  assert.equal(await second, 'paid');
  releases.get('a')();
  await firstRejected;
  assert.equal(JSON.stringify({ logs, spans }).includes('SECRET'), false);
  assert.equal(spans.every(span => span.ended === 1), true);
  assert.equal(spans[0].errors.length, 1);
  assert.deepEqual(spans[0].statuses, [{ code: 2 }]);
  for (const record of [...logs, ...spans.map(span => span.attributes)]) {
    assert.equal(record.tenant_id, record.order_id === 'a' ? 'tenant-a' : 'tenant-b');
    assert.equal(record.correlation_id, record.order_id === 'a' ? 'trace-a' : 'trace-b');
    for (const key of Object.keys(metadata)) assert.equal(record[key], metadata[key]);
  }
  assert.equal(logs.some(record => record.message === 'payment_failed' && record.stack === '[redacted]'), true);
  const declined = instrumentPayments(metadata, logger, tracer, async () => 'declined');
  assert.equal(await declined({ order_id: 'decline', amount: 125 }, contextA, signal), 'declined');
  assert.equal(logs.at(-1).message, 'payment_declined');
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(declined({ order_id: 'cancel', amount: 125 }, contextA, cancelled.signal));
  assert.equal(spans.at(-1).ended, 1);
  assert.equal(logs.at(-1).message, 'payment_cancelled');
  const during = new AbortController();
  const waits = instrumentPayments(metadata, logger, tracer, (_input, pendingSignal) => new Promise((_resolve, reject) => pendingSignal.addEventListener('abort', () => reject(pendingSignal.reason), { once: true })));
  const running = waits({ order_id: 'during', amount: 125 }, contextA, during.signal);
  const cancellation = assert.rejects(running);
  during.abort();
  await cancellation;
  assert.equal(spans.at(-1).ended, 1);
  assert.equal(logs.at(-1).message, 'payment_cancelled');
  const original = new Error('original');
  const failingLogger = { info() { throw new Error('logger'); }, error() { throw new Error('logger'); } };
  const fails = instrumentPayments(metadata, failingLogger, tracer, async () => { throw original; });
  await assert.rejects(fails({ order_id: 'failure', amount: 125 }, contextA, signal), error => error === original);
  assert.equal(spans.at(-1).ended, 1);
  await assert.rejects(declined({ order_id: 'invalid', amount: 125 }, { ...contextA, tenant_id: '' }, signal), /context/);
  console.log('PASS: strict TypeScript; metadata, secret redaction, exception/cancellation cleanup, concurrent tenant isolation, telemetry failure isolation');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
