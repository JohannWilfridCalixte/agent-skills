---
title: Error Handling
impact: HIGH
tags: result, error, raising, domain-logic, exceptions
---

## Error Handling

**Impact: HIGH**

### Result pattern for domain logic

Domain logic returns `Result[T, E]`. No raising for expected failures.

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Ok[T]:
    value: T

@dataclass(frozen=True, slots=True)
class Err[E]:
    error: E

type Result[T, E] = Ok[T] | Err[E]

# ✅ Explicit error handling
def calculate(input: Input) -> Result[Output, CalcError]:
    if not is_valid(input):
        return Err(CalcError(code="INVALID_INPUT", message="..."))
    return Ok(compute(input))

# Pattern matching to consume
match calculate(data):
    case Ok(value):
        print(value)
    case Err(error):
        log.error(error.message)

# ❌ Raising for expected failures
def calculate(input: Input) -> int:
    if not is_valid(input):
        raise ValueError("Invalid")  # caller can forget to catch
    return compute(input)
```

Error types include `code` field for programmatic handling:

```python
@dataclass(frozen=True, slots=True)
class CalcError:
    code: Literal["INVALID_INPUT", "OVERFLOW"]
    message: str
```

**Exception:** Catch external/infrastructure errors at boundaries, wrap in Result.

### Exception rules (when not using Result)

- Never bare `except:` — always `except Exception` minimum
- Always specify exception type: `except ValueError as e:`
- Never silently swallow: log + re-raise or handle explicitly
- Custom exception hierarchies for domain errors

```python
# ✅ Specific, logged
try:
    result = parse(data)
except ValueError as e:
    logger.warning("parse failed", exc_info=e)
    raise

# ❌ Bare except, silently swallowed
try:
    result = parse(data)
except:
    pass
```
