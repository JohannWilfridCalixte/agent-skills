---
title: Core Principles
impact: CRITICAL
tags: typesafety, inference, narrow-types, fundamentals
---

## Core Principles

**Impact: CRITICAL**

Three foundational principles that guide all Python decisions.

### Maximal end-to-end type safety

No `Any`. No `# type: ignore` without error code. No `cast()` unless wrapping untyped third-party code.

### Types as narrow as possible

```python
from typing import Literal

type Color = Literal["red", "green", "blue"]
type Level = Literal[1, 2, 3]

@dataclass(frozen=True, slots=True)
class Options:
    color: Color
    level: Level
    comment: str = ""

# ✅ Narrow — type checker knows exact values
options = Options(color="red", level=2)

# ❌ Stringly-typed
def set_color(color: str) -> None: ...
```

### Let the type checker infer

```python
# ✅ Inferred
users = get_users()
count = 0

# ❌ Redundant annotation
users: list[User] = get_users()
count: int = 0

# ✅ Annotate when inference fails
items: list[Item] = []
```
