---
name: agentic-code-testing
description: Testing rules (layers, test doubles, flakiness, naming, coverage). Use when writing or reviewing tests, or fixing a flaky one.
---

# Code Testing

Writing tests → also Call the Skill tool with "tdd" and follow it: the red → green loop, seams, good vs bad tests, mocking at system boundaries and the anti-patterns live there. This skill adds only what tdd doesn't say: layer choice, doubles, flakiness, setup, naming, coverage, and the review checklist.

Examples pair TypeScript (Jest, Testing Library) and Python (pytest); write the same shape in the project's language and framework.

Tests are **FIRST**: Fast, Isolated, Repeatable (time, randomness and environment pinned), Self-validating, Timely.

## Shape: Arrange, Act, Assert

One behaviour per test: arrange, act once, assert. A second act gets its own test.

```typescript
test('calculates order total with tax', () => {
  const order = new Order();
  order.addItem({ price: 100 });

  const total = order.calculateTotal({ taxRate: 0.1 });

  expect(total).toBe(110);
});
```

```python
def test_calculates_order_total_with_tax():
    order = Order()
    order.add_item(price=100)

    total = order.calculate_total(tax_rate=0.1)

    assert total == 110
```

## Layers

Default for apps (integrations, UI, services): the **testing trophy**, most tests at integration, fewer units, E2E on critical paths, static checks (types, lint) at the base. Libraries, algorithms and stable interfaces: the **pyramid**, mostly units.

| Situation | Layer |
|-----------|-------|
| Pure function, algorithm, edge cases (`format_currency(1234.5) → '$1,234.50'`) | Unit |
| Components together, API endpoint, DB operations (cart computes totals) | Integration |
| Critical user journey (signup → purchase → confirmation) | E2E |
| API compatibility between services | Contract |

## Test doubles

| Double | Purpose | Verifies |
|--------|---------|----------|
| **Dummy** | Fills a parameter, never used | Nothing |
| **Fake** | Working shortcut (in-memory DB) | State |
| **Stub** | Canned responses | State |
| **Spy** | Records calls, plus stub | State or calls |
| **Mock** | Expects specific calls | Calls |

Deltas on tdd's mocking rules:

- Your database runs real: a test database or an in-memory fake, never a mock.
- Double a third-party client at your own wrapper interface, not the vendor SDK.
- Setup longer than the test → it tests the doubles; run more of the real code.

```typescript
const service = new OrderService(createTestDatabase(), stubPayments({ charge: 'ok' }));
```

```python
service = OrderService(create_test_database(), stub_payments(charge="ok"))
```

## Setup

Each test builds the values it asserts on, in its own body (factory call with overrides). Per-test setup (`beforeEach`, a function-scoped pytest fixture) holds mechanics only: fresh database, reset clock, cleared mocks. Anything shared across tests (`beforeAll`, module-level objects, session-scoped fixtures) is read-only.

**DAMP over DRY**: tests have no tests, so each must be obviously correct on reading. DRY the mechanics (factories, setup); keep the values that matter written in the test.

```typescript
const createTestUser = (overrides = {}) => ({ id: 1, name: 'Test User', ...overrides });

test('loyal customers receive 20% discount', () => {
  const customer = createTestUser({ loyaltyYears: 5 });
  expect(calculateDiscount(customer)).toBe(0.2);
});
```

```python
def make_user(**overrides):
    return {"id": 1, "name": "Test User", **overrides}

def test_loyal_customers_receive_20_percent_discount():
    customer = make_user(loyalty_years=5)
    assert calculate_discount(customer) == 0.2
```

## Flaky tests

Causes, most common first: async handled with fixed delays, race conditions, state shared between tests.

- Wait for the condition, not a duration: `await screen.findByText('Loaded')`, `await waitFor(() => expect(result).toBe(expected))`; in Python, poll the condition with a timeout (`wait_until(lambda: job.done, timeout=2)`).
- Reset shared state in per-test setup (above), so a failed test can't leak into the next.
- Pin time and randomness through doubles.
- Run tests in random order (`jest --randomize`, `pytest-randomly`) to expose hidden dependencies.

## Naming

Names read like specifications of behaviour: `'calculates total price including tax'`, `test_prevents_adding_out_of_stock_items_to_cart`, `'returns empty array when input is null'`. Not `'test1'` or `testCalculateTotal_ReturnsCorrectValue`.

## Coverage

A gap finder, not a target: 70–85% as a sanity check, never a strict gate. High coverage with bugs slipping through → check the assertions, try mutation testing.

## Review checklist

Reviewing tests: check every item, cite each hit.

- Asserts internal state or private methods, or breaks on a refactor that keeps behaviour.
- Assertion that can't fail (`expect(wrapper).toBeTruthy()`, `assert result`): break the code; the test must go red.
- Fragile selectors (XPath, CSS classes) or over-specified assertions.
- Doubles of code the project owns; setup longer than the test.
- Meaningful values hidden in shared setup; mutable state shared across tests.
- Fixed delays (`sleep`), order dependence.
- Layer mismatch per the table above (E2E for an edge case, unit for a journey).
- Coverage used as a gate.
