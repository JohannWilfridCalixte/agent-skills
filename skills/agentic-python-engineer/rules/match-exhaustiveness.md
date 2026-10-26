---
title: Match Exhaustiveness
impact: CRITICAL
tags: match, assert-never, union, enum, exhaustive-check
---

## Match Exhaustiveness

**Impact: CRITICAL**

All match statements on unions/enums use `assert_never` in wildcard case.

```python
from typing import assert_never

class Status(enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

def describe(status: Status) -> str:
    match status:
        case Status.ACTIVE:
            return "User is active"
        case Status.INACTIVE:
            return "User is inactive"
        case Status.SUSPENDED:
            return "User is suspended"
        case _ as unreachable:
            assert_never(unreachable)  # ✅ compile-time + runtime
```
