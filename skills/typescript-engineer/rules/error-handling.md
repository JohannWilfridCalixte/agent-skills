---
title: Error Handling
impact: HIGH
tags: result, option, monad, error, throwing, domain-logic
---

## Error Handling

**Impact: HIGH**

Domain logic returns `Result<T, E>` or `Option<T>`. No throwing.

**Incorrect:**

```typescript
function calculate(input: Input): number {
  if (!isValid(input)) throw new Error('Invalid');
  return compute(input);
}
```

**Correct:**

```typescript
function calculate(input: Input): Result<Output, CalcError> {
  if (!isValid(input)) return Err({ code: 'INVALID_INPUT', message: '...' });
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
