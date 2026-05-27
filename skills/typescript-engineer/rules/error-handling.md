---
title: Error Handling
impact: HIGH
tags: result, option, monad, error, throwing, domain-logic
---

## Error Handling

**Impact: HIGH**

Domain logic returns `Result<T, E>` or `Option<T>`. No throwing. Never annotate the return type — let TS infer it (see `typing.md`).

**Incorrect:**

```typescript
function calculate(input: Input) {
  if (!isValid(input)) throw new Error('Invalid');
  return compute(input);
}
```

**Correct:**

```typescript
function calculate(input: Input) {
  if (!isValid(input)) return Err({ code: 'INVALID_INPUT', message: '...' } as const);
  return Ok(compute(input));
}
```

Error types include `code` field for programmatic handling:

```typescript
interface CalcError {
  readonly code: 'INVALID_INPUT' | 'OVERFLOW';
  readonly message: string;
}
```

**Exception:** Catch external errors at infrastructure boundaries, wrap in Result.
