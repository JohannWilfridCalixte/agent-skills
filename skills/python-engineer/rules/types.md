---
title: Types
impact: CRITICAL
tags: dataclass, pydantic, typeddict, namedtuple, generics, protocol, typeis, schemas, return-types, overloads
---

## Types

**Impact: CRITICAL**

### dataclass vs Pydantic vs TypedDict vs NamedTuple

| Use Case | Tool |
|----------|------|
| Internal domain objects | `@dataclass(frozen=True, slots=True)` |
| External/untrusted data (APIs, config) | `pydantic.BaseModel` |
| Dict-shaped data (JSON payloads) | `TypedDict` |
| Lightweight immutable records | `NamedTuple` |

```python
# ✅ Internal domain object
@dataclass(frozen=True, slots=True)
class User:
    id: str
    name: str
    role: UserRole

# ✅ API boundary validation
class UserCreate(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True, extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: str
    role: Literal["admin", "user", "viewer"]

# ✅ JSON shape
class ApiResponse(TypedDict):
    status: str
    data: dict[str, object]
```

### Immutability by default

All dataclasses: `frozen=True, slots=True`. All Pydantic models: `frozen=True`.

### Generic syntax (3.12+)

```python
# ✅ New syntax — no TypeVar boilerplate
class Stack[T]:
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

def first[T](items: list[T]) -> T:
    return items[0]

# ✅ Bounded generics
from collections.abc import Hashable
def dedupe[T: Hashable](items: list[T]) -> list[T]: ...

# ✅ Type aliases
type JSON = dict[str, "JSON"] | list["JSON"] | str | int | float | bool | None
type Handler[**P] = Callable[P, Awaitable[None]]

# ❌ Old style
T = TypeVar("T")
class Stack(Generic[T]): ...
```

### Parameters: accept broad, return narrow

Accept `Sequence`, `Mapping`, `Iterable` in parameters (covariant, flexible). Return concrete types.

```python
from collections.abc import Sequence

# ✅ Accepts any sequence (list, tuple, etc.)
def total(prices: Sequence[Decimal]) -> Decimal:
    return sum(prices)

# ❌ Rejects tuples, generators, etc.
def total(prices: list[Decimal]) -> Decimal:
    return sum(prices)
```

### No Any, no cast, no bare type: ignore

| Forbidden | Use Instead |
|-----------|-------------|
| `Any` | `object` + narrowing, or specific type |
| `cast()` | Type guard or `TypeIs` |
| `# type: ignore` | `# type: ignore[specific-code]` + comment why |
| `dict` (bare) | `dict[str, int]` |
| `list` (bare) | `list[str]` |
| `tuple` (bare) | `tuple[str, ...]` or `tuple[str, int]` |

```python
# ❌ Any hides bugs
def process(data: Any) -> Any: ...

# ✅ object forces narrowing
def process(data: object) -> str:
    if isinstance(data, str):
        return data.upper()
    raise TypeError(f"expected str, got {type(data).__name__}")
```

### Protocol over ABC

Prefer structural subtyping. No inheritance needed.

```python
from typing import Protocol

# ✅ Structural — any class with .close() works
class Closeable(Protocol):
    def close(self) -> None: ...

def cleanup(resource: Closeable) -> None:
    resource.close()

# ❌ Forces inheritance
from abc import ABC, abstractmethod
class Closeable(ABC):
    @abstractmethod
    def close(self) -> None: ...
```

Use ABC only when you need shared implementation (mixin methods).

### TypeIs for narrowing (3.13+ / typing_extensions)

```python
from typing_extensions import TypeIs  # typing.TypeIs on 3.13+

def is_str_list(val: list[object]) -> TypeIs[list[str]]:
    return all(isinstance(x, str) for x in val)

def process(items: list[object]) -> None:
    if is_str_list(items):
        # items is list[str] — both branches narrowed
        print(items[0].upper())
```

Prefer `TypeIs` over `TypeGuard` — it narrows both branches.

### Pydantic schemas

Schema = type. Infer types from models, not the other way around.

```python
# ✅ Schema IS the type — like Zod
class User(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True, extra="forbid")
    id: str
    name: str

# Use directly — no separate interface
def get_user() -> User: ...

# ✅ Discriminated unions
class Cat(BaseModel):
    pet_type: Literal["cat"]
    meow_volume: int

class Dog(BaseModel):
    pet_type: Literal["dog"]
    bark_volume: int

class Owner(BaseModel):
    pet: Annotated[Cat | Dog, Field(discriminator="pet_type")]

# ❌ Separate dataclass + schema
@dataclass
class User:
    id: str
    name: str

class UserSchema(BaseModel):  # duplication
    id: str
    name: str
```

### No @overload

`@overload` signatures can lie — implementation doesn't have to match. Use union returns instead.

```python
# ❌ Overloads can be false
@overload
def fetch(url: str, fmt: Literal["json"]) -> dict: ...
@overload
def fetch(url: str, fmt: Literal["text"]) -> str: ...

# ✅ Union return — truth visible
def fetch(url: str, fmt: Literal["json", "text"]) -> dict | str: ...
```

**Exception:** `@overload` acceptable in typed stubs for untyped third-party code.

### Return types

**Annotate return types on public functions. Let inference handle private/internal.**

Unlike TypeScript (where inference is stronger), Python's type checkers benefit from explicit return annotations on public APIs.

```python
# ✅ Public function — annotate return
def calculate_total(items: list[Item]) -> Decimal: ...

# ✅ Private helper — skip return annotation, infer it
def _sum_prices(prices: Sequence[Decimal]):
    return sum(prices)

# ✅ Complex return — annotation clarifies
def fetch_user(user_id: str) -> User | None: ...
```
