---
title: Patterns
impact: MEDIUM
tags: strategy, pattern, discriminator, anti-patterns, mutable-defaults, isinstance
---

## Patterns

**Impact: MEDIUM**

### Strategy pattern

Default signal: the same discriminator is matched in 3+ locations with 5+ lines per branch. Extract a strategy when independent behavior/reuse warrants it; the counts are a heuristic, not a quota.

```python
from typing import Protocol

class PricingStrategy(Protocol):
    def calculate(self, item: Item) -> Decimal: ...

@dataclass(frozen=True, slots=True)
class ProductPricing:
    def calculate(self, item: Item) -> Decimal:
        return item.unit_price * item.quantity

@dataclass(frozen=True, slots=True)
class ServicePricing:
    def calculate(self, item: Item) -> Decimal:
        return item.hourly_rate * item.hours

def get_strategy(item_type: ItemType) -> PricingStrategy:
    match item_type:
        case ItemType.PRODUCT:
            return ProductPricing()
        case ItemType.SERVICE:
            return ServicePricing()
        case _ as unreachable:
            assert_never(unreachable)
```

### Common anti-patterns

```python
# ❌ Mutable default argument
def add_item(item: str, items: list[str] = []) -> list[str]: ...

# ✅ None sentinel
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items

# ❌ isinstance chain (use match)
if isinstance(shape, Circle):
    ...
elif isinstance(shape, Square):
    ...

# ✅ Structural pattern matching
match shape:
    case Circle(radius=r):
        area = math.pi * r ** 2
    case Square(side=s):
        area = s ** 2

# ❌ Unnecessary formatting boilerplate for ordinary constructed strings
msg = "Hello %s" % name
msg = "Hello {}".format(name)

# ✅ f-string
msg = f"Hello {name}"

# ❌ Checking emptiness with len()
if len(items) > 0: ...

# ✅ Truthiness
if items: ...
```

Use the logging/translation API's intended deferred formatting when needed; the f-string preference is not a reason to eagerly format expensive or sensitive values. For a match over a closed union, follow `match-exhaustiveness.md`; for an intentionally partial match, give remaining inputs their defined behavior.
