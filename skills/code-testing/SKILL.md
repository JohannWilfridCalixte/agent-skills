---
name: agentic:skill:code-testing
description: Use when writing tests, reviewing test quality, debugging flaky tests, or deciding what/how to test.
---

# Code Testing

**Core philosophy:** Test behavior, not implementation. Good tests survive refactoring, serve as documentation, and catch real bugs without false alarms.

> "Write tests. Not too many. Mostly integration." — Guillermo Rauch

## When to Use

- Writing new tests for features/bugfixes
- Reviewing test quality or coverage
- Debugging flaky/intermittent tests
- Deciding test strategy (unit vs integration vs E2E)
- Choosing what to mock

## FIRST Principles

| Principle | Meaning |
|-----------|---------|
| **Fast** | Keep feedback fast for the layer; milliseconds for small units, realistic budgets for integration/E2E. |
| **Isolated** | Pass alone, in sequence, or parallel. |
| **Repeatable** | Same inputs = same results. No env/time deps. |
| **Self-validating** | Auto pass/fail. No human inspection. |
| **Timely** | Written close to (or before) code. |

## Test Structure: AAA

```typescript
test('calculates order total with tax', () => {
  // Arrange
  const order = new Order();
  order.addItem({ price: 100 });

  // Act
  const total = order.calculateTotal({ taxRate: 0.1 });

  // Assert
  expect(total).toBe(110);
});
```

One behavior per test. Default to one Arrange → Act → Assert sequence. A state-transition or protocol requirement can need several actions and assertions in one scenario; keep them focused on that single behavior.

## What Makes Tests Good vs Bad

**Good tests are:**
- **Behavioral** — sensitive to what code does
- **Structure-insensitive** — unaffected by internal refactoring

**Bad tests:**
- Test implementation details (internal state, private methods)
- Create false negatives (break on valid refactors)
- Create false positives (pass while real bugs exist)

```typescript
// BAD: tests implementation
expect(wrapper.state('openIndex')).toBe(1);

// GOOD: tests behavior
await userEvent.click(screen.getByText('Section 2'));
expect(screen.getByText('Section 2 content')).toBeVisible();
```

## Testing Pyramid vs Trophy

### Traditional Pyramid (Google/Fowler)

```
      /\        E2E (5%)
     /  \
    /----\      Integration (15%)
   /------\
  /--------\    Unit (80%)
```

**Favor when:** Algorithmic code, stable interfaces, libraries, constrained resources.

### Testing Trophy (Kent C. Dodds)

```
        E2E (critical paths)
       /    \
      /------\     Integration (largest)
     /--------\
    /----------\   Unit (smaller)
   /______________\ Static (TS, ESLint)
```

**Favor when:** Apps with complex integrations, UI components, modern frontend.

**Core insight:** Integration tests offer best confidence-to-cost ratio for most apps.

The diagrams and ratios are strategy heuristics, not quotas. Choose the test boundary from the behavior and failure risk: pure domain algorithms favor units; wiring and adapter contracts need integrations. Do not manufacture integrations to meet a percentage.

## What to Test at Each Layer

| Layer | Test | Examples |
|-------|------|----------|
| **Unit** | Pure functions, algorithms, utils | `formatCurrency(1234.5) → '$1,234.50'` |
| **Integration** | Components together, API endpoints, DB ops | Cart calculates totals correctly |
| **E2E** | Critical user journeys only | Signup → purchase → confirmation |
| **Contract** | API compatibility between services | Consumer expectations match provider |

## Test Doubles

| Double | Purpose | Verification |
|--------|---------|--------------|
| **Dummy** | Fill params, never used | None |
| **Fake** | Working shortcut (in-memory DB) | State |
| **Stub** | Canned responses | State |
| **Spy** | Record calls + stub | State or Behavior |
| **Mock** | Verify specific calls made | Behavior |

**Key distinction:** Stubs supply answers; mocks verify interactions. Assert observable results or a required boundary interaction, not merely the canned answer a double was configured to return.

### Mocking Rules

- **Mock at system boundaries** — external APIs, databases
- **Don't mock what you don't own** — prefer owned boundary interfaces; use the provider's supported test interface when appropriate. Add a wrapper when it represents a useful boundary, not solely to satisfy a rule.
- **Keep internal collaborators real** where practical. A repository/payment port is a legitimate isolated use-case boundary; replacing internal algorithms just to reproduce their expected answer is not.
- **Over-mocking = testing mocks** — setup larger than the test is a signal to inspect the boundary and assertions, not proof the test is wrong.

```typescript
// BAD: mock everything
jest.mock('./userService');
jest.mock('./emailService');
jest.mock('./logger');
// Now testing that mocks return what you told them to

// GOOD: real implementations where practical
const db = createTestDatabase();
const service = new UserService(db); // real service, test DB
```

## Anti-Patterns

### The Liar (validates nothing)

```typescript
// Always passes, tests nothing
test('renders component', () => {
  const wrapper = render(<MyComponent />);
  expect(wrapper).toBeTruthy(); // Always true!
});
```

**Fix:** Watch test fail first. If you can't break it, it's worthless.

### Brittle Tests (break on refactor)

- Testing internal state/private methods
- Over-specifying assertions
- Fragile selectors (XPath, CSS classes)
- Order-dependent tests

**Fix:** Test through public interfaces only.

### Flaky Tests (intermittent failures)

**Root causes:**
- Improper async handling (`sleep()` vs explicit waits)
- Race conditions
- Shared state between tests

**Fixes:**
```typescript
// BAD
await sleep(3000);

// GOOD
await screen.findByText('Loaded');
await waitFor(() => expect(result).toBe(expected));
```

- Establish isolated state in `beforeEach`; release resources in teardown/finally even after failures. Use per-test data/namespaces for parallel tests.
- Mock time-dependent operations
- Run tests in random order to expose hidden deps

### Ice Cream Cone (inverted pyramid)

Heavy manual testing → slow E2E → minimal unit tests.

**Result:** Late feedback, high cost, poor edge case coverage.

## Test Naming

Names should read like specifications:

```typescript
// GOOD
'calculates total price including tax'
'prevents adding out-of-stock items to cart'
'returns empty array when input is null'

// BAD
'test1'
'testCalculateTotal_ReturnsCorrectValue'
```

## DAMP over DRY

Tests don't have tests — they must be obviously correct on inspection.

- **DRY for mechanics** — test factories, common setup
- **DAMP for meaning** — explicit values that matter

```typescript
// DRY helper for mechanics
const createTestUser = (overrides = {}) => ({
  id: 1, name: 'Test User', ...overrides
});

// DAMP test with meaningful values
test('loyal customers receive 20% discount', () => {
  const customer = createTestUser({ loyaltyYears: 5 }); // loyalty matters!
  expect(calculateDiscount(customer)).toBe(0.20);
});
```

## Coverage: Useful Metric, Terrible Target

Coverage reveals untested code — useful for finding gaps.

**Don't chase 100%:** Produces trivial tests, tests without assertions, wasted time.

**Target 70-85%** as sanity check, not strict gate.

Map acceptance criteria and changed behavior to meaningful checks, including required error paths. Green commands and high coverage do not establish that the requested behavior is tested. Prioritize critical gaps (for example authorization failures) over incidental log formatting.

For a behavioral change, add or update its corresponding test and run the checks required by the owning workflow. For a regression test, observe failure for the intended product defect before the fix; a syntax/setup error is not regression evidence. Record the command, revision, result, and unavailable checks truthfully. Do not skip required tests to save time.

For concurrent/effectful behavior, cover the relevant contract: competing updates, duplicate delivery/idempotency, cancellation cleanup, and retry after partial success. Use controlled synchronization instead of delays. For schema or API migrations, test supported old/new readers or clients through the compatibility window.

## Quick Reference

| Situation | Approach |
|-----------|----------|
| Pure function with edge cases | Unit test |
| Component interactions | Integration test |
| Critical user journey | E2E test |
| External API | Mock at boundary |
| Internal collaborator | Real implementation |
| Flaky timing | Explicit waits, not sleep |
| Test breaks on refactor | Test behavior, not implementation |
| High coverage, bugs slip through | Check assertions, try mutation testing |

## Red Flags

- Tests that break on every refactor
- Setup code larger than test code
- `sleep()` / arbitrary delays
- Testing internal state
- Mocking everything
- Tests without meaningful assertions
- Order-dependent tests
- Coverage as strict gate
