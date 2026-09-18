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
from typing import Literal, assert_never

@dataclass(frozen=True, slots=True)
class CalcError:
    code: Literal["INVALID_INPUT", "OVERFLOW"]
    message: str

@dataclass(frozen=True, slots=True)
class Ok[T]:
    value: T

@dataclass(frozen=True, slots=True)
class Err[E]:
    error: E

type Result[T, E] = Ok[T] | Err[E]

# ✅ Explicit error handling
def calculate(value: int) -> Result[int, CalcError]:
    if value < 0:
        return Err(CalcError(code="INVALID_INPUT", message="Value must be nonnegative"))
    return Ok(value * 2)

# Pattern matching to consume
def describe_result(result: Result[int, CalcError]) -> str:
    match result:
        case Ok(value):
            return str(value)
        case Err(error):
            return error.message
        case _ as unreachable:
            assert_never(unreachable)
```

```python
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

**Exception:** Catch specific external/infrastructure errors at boundaries and wrap expected operational failures in Result with stable codes. Preserve diagnostic causes internally without exposing provider secrets or unstable provider messages in domain errors. Let cancellation and unexpected programming failures propagate after cleanup; do not turn cancellation into a retryable success/failure value.

### Exception rules (when not using Result)

- Never bare `except:` — always `except Exception` minimum
- Always specify exception type: `except ValueError as e:`
- Never silently swallow: handle explicitly or re-raise; the designated handling boundary owns logging so propagation does not duplicate reports.
- Custom exception hierarchies are for unexpected/infrastructure failures or an explicitly selected exception-based contract; expected domain failures still use Result.
- Import exception classes at runtime for `except`, not only under TYPE_CHECKING. Use `finally`/context managers for resource cleanup on failure and cancellation.

```python
# ✅ Specific, re-raised; logger is configured for structured JSON output
try:
    result = parse(data)
except ValueError as e:
    logger.warning("parse_failed", exc_info=e)
    raise

# ❌ Bare except, silently swallowed
try:
    result = parse(data)
except:
    pass
```
