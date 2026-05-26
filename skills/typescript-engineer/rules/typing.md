---
title: Typing
impact: CRITICAL
tags: interface, type, readonly, any, as, zod, inference, return-types, satisfies, as-const, overloads
---

## Typing

**Impact: CRITICAL**

### interface vs type

| Use Case | Keyword |
|----------|---------|
| Object shapes | `interface` |
| Unions, aliases, functions | `type` |

```typescript
// Correct
interface User {
  readonly id: string;
  readonly name: string;
}
type UserRole = 'admin' | 'member' | 'guest';
type UserId = string;

// Incorrect: type for object shape
type User = { id: string; name: string };
```

### readonly everywhere

All interface/type properties `readonly`. All arrays `readonly T[]`.

**Note:** `readonly` is TypeScript type syntax. Do NOT put it in runtime code like `z.object({ readonly x: ... })` - that's invalid JS.

### No any, no as

| Forbidden | Use Instead |
|-----------|-------------|
| `any` | Specific type or `unknown` + narrowing |
| `as` casts | Type guards |
| `object` | Specific interface |

```typescript
// Incorrect: item as Product
// Correct: if (item.type === 'product') { /* item is Product */ }
```

### Zod schemas

Schema name = type name. Infer types from schemas.

```typescript
// Correct
const User = z.object({ id: z.string(), name: z.string() });
type User = z.infer<typeof User>;

// Incorrect: separate interface + schema
interface User { id: string; name: string; }
const UserSchema = z.object({ id: z.string(), name: z.string() });
```

### Type inference

Let TS infer when obvious. Annotate empty arrays.

```typescript
const users = getUsers();            // inferred
const count = 0;                     // inferred
const errors = [] satisfies Error[]; // empty array needs type
```

### Return types

**Primary rule: avoid explicit return types.** Return types can lie. Inference cannot.

| Approach | Risk |
|----------|------|
| Explicit return type | Can be wider, narrower, or false |
| Inferred | Always matches actual value |
| `as const` + inferred | Narrow AND truthful |

**Problem: discriminated unions lose precision.**

```typescript
// Incorrect: inferred without as const = too wide
function getResult() {
  return Math.random() > 0.5
    ? { status: 'ok', value: 'foo' }
    : { status: 'error', error: new Error('bar') }
}
// result.value is string | undefined even after narrowing

// Incorrect: explicit return type = right shape but still wide
function getResult(): Result<string> { ... }
// result.value is string (not 'foo')

// Correct: as const = narrow AND truthful
function getResult() {
  return Math.random() > 0.5
    ? { status: 'ok', value: 'foo' } as const
    : { status: 'error', error: new Error('bar') } as const
}
// result.value is 'foo' after narrowing
```

**Problem: return types can hide leaked data.**

```typescript
type User = { username: string; email: string }

// Incorrect: return type hides password leak
const getUser = (): User => {
  return { username: 'user', email: 'a@b.com', password: 'SECRET' };
}

// Correct: inferred exposes the truth
const getUser = () => {
  return { username: 'user', email: 'a@b.com', password: 'SECRET' };
}
// Type shows password - bug is visible
```

**Problem: function overloads can lie.**

```typescript
// Incorrect: overloads lie about runtime behavior
function getUser(role: 'user'): { role: 'user' };
function getUser(role: 'admin'): { role: 'admin' };
function getUser(role: 'user' | 'admin') {
  if (role === 'user') return { role: 'admin' };  // BUG: swapped!
  return { role: 'user' };
}
// getUser('user') typed as { role: 'user' } but returns { role: 'admin' }

// Correct: as const reveals actual values
function getUser(role: 'user' | 'admin') {
  if (role === 'user') return { role: 'admin' as const };
  return { role: 'user' as const };
}
// Type: { role: 'admin' } | { role: 'user' } - truth visible
```

**Use `satisfies` for API boundary validation:**

```typescript
// Incorrect: explicit return type can lie, widens inference
async function collectOptions(): Promise<InteractiveResult> {
  return { name, template };
}

// Correct: satisfies validates shape, inference stays truthful
async function collectOptions() {
  return { name, template } satisfies InteractiveResult;
}
// Callers see the narrow inferred type
// Compile error if shape doesn't match InteractiveResult
```

**When explicit return types ARE required (not just preferred):**
- Recursive functions (TS compiler requires it)
- Assertion functions (`asserts value is T`)
- Generic functions where inference genuinely fails (not "might be unclear")

| Excuse | Reality |
|--------|---------|
| "Public API needs explicit types" | Use `satisfies` - validates without lying |
| "Consumers need to know the return type" | Hover inference + exported type via `satisfies` |
| "It documents the function contract" | Documents what you HOPE it returns, not what it DOES |
| "It's clearer with the return type" | Clarity that can lie is worse than inference that can't |
| "`: never \| undefined` documents control flow" | TS infers this already - the annotation adds nothing |

Default: let TypeScript infer. Use `as const` to narrow. Use `satisfies` to validate.
