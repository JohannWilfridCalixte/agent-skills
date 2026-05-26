---
title: Patterns
impact: MEDIUM
tags: strategy, pattern, discriminator, anti-patterns, mutable-defaults, isinstance
---

## Patterns

**Impact: MEDIUM**

### Strategy pattern

Use when same discriminator matched in 3+ locations with 5+ lines per branch.

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

# ❌ String formatting
msg = "Hello %s" % name
msg = "Hello {}".format(name)

# ✅ f-string
msg = f"Hello {name}"

# ❌ Checking emptiness with len()
if len(items) > 0: ...

# ✅ Truthiness
if items: ...
```
