---
title: Code Style
impact: HIGH
tags: naming, spacing, nesting, guard-clauses, readability
---

## Code Style

**Impact: HIGH**

### Spacing

Blank lines between logical blocks:
- Between declarations and control flow
- Between validation and business logic
- Before complex multi-line statements

**Exception:** log + return = single block.

### Naming

No abbreviations except: `id`, `url`, `api`, `db`, `err` (catch), `req`/`res` (HTTP handlers).

| Incorrect | Correct |
|-----------|---------|
| `qty` | `quantity` |
| `idx` | `index` |
| `val` | `value` |
| `cfg` | `config` |

### Guard clauses

Single-line for simple guards:

```typescript
if (!user) return null;                           // simple
if (!user || !user.isActive) { return null; }    // complex condition
```

### Nesting

Max depth = 3. Extract functions for deeper logic.

**Incorrect:**

```typescript
switch (data.type) {
  case 'x':
    switch (data.mode) {
      case 'y':
        if (condition) {
          // Level 4 - too deep!
        }
    }
}
```

**Correct:**

```typescript
function handleX(data: X): Result { /* ... */ }
```
