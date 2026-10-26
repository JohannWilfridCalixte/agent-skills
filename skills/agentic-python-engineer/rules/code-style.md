---
title: Code Style
impact: HIGH
tags: naming, spacing, nesting, guard-clauses, readability
---

## Code Style

**Impact: HIGH**

### Naming

PEP 8 conventions. No abbreviations except: `id`, `url`, `api`, `db`, `err` (catch), `req`/`res` (HTTP handlers).

| Entity | Convention | Example |
|--------|-----------|---------|
| Variables, functions | `snake_case` | `user_count`, `get_user()` |
| Classes | `PascalCase` | `UserService` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| Type aliases | `PascalCase` | `type UserMap = dict[str, User]` |
| Private | Leading `_` | `_internal_cache` |

| ❌ | ✅ |
|---|---|
| `qty` | `quantity` |
| `idx` | `index` |
| `val` | `value` |
| `cfg` | `config` |

### Guard clauses

Early returns to avoid nesting:

```python
def process(user: User | None) -> Result[Output, AppError]:
    if user is None:
        return Err(AppError(code="NOT_FOUND", message="no user"))
    if not user.is_active:
        return Err(AppError(code="INACTIVE", message="user inactive"))

    return Ok(compute(user))
```

### Nesting

Max depth = 3. Extract functions for deeper logic.

### Spacing

Blank lines between logical blocks:
- Between declarations and control flow
- Between validation and business logic
- Two blank lines before top-level definitions (PEP 8)
