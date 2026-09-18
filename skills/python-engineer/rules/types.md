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
| Statically described dict-shaped data | `TypedDict` (not runtime validation of untrusted JSON) |
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

Default dataclasses to `frozen=True, slots=True` and Pydantic models to `strict=True, frozen=True, extra="forbid"`. If the accepted domain/compatibility contract needs mutation, coercion, or forward-compatible extra fields, make that exception explicit and test it. Frozen records do not recursively freeze mutable fields.

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
from decimal import Decimal

# ✅ Accepts lists and tuples; empty input still returns Decimal
def total(prices: Sequence[Decimal]) -> Decimal:
    return sum(prices, start=Decimal(0))
```

Use `Iterable[Decimal]` instead when the function should also accept a generator; `Sequence` itself does not accept generators.

```python
# ❌ Needlessly rejects tuples and returns int for empty input
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
from collections.abc import Sequence
from typing_extensions import TypeIs  # use typing.TypeIs on 3.13+

def is_str_sequence(values: Sequence[object]) -> TypeIs[Sequence[str]]:
    return all(isinstance(value, str) for value in values)

def first_upper(items: Sequence[object]) -> str | None:
    if is_str_sequence(items) and items:
        return items[0].upper()
    return None
```

Prefer `TypeIs` when the narrowed type is compatible with the input type; it can narrow both branches. `list[str]` is not a subtype of invariant `list[object]`, so that TypeIs signature is invalid. Use read-only covariant inputs as above; if a mutable-list API truly requires incompatible narrowing, `TypeGuard` is the appropriate tool. Validate predicates themselves and avoid mutation across the narrowing boundary. An all-elements check does not establish non-emptiness.

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

# ❌ Duplicate models for the same boundary contract
@dataclass
class User:
    id: str
    name: str

class UserSchema(BaseModel):  # duplication
    id: str
    name: str
```

Separate boundary schemas and pure domain records are appropriate when they represent different layers/contracts. Convert explicitly at the adapter boundary; do not introduce Pydantic into the domain merely to avoid deliberate layer separation.

### No @overload

`@overload` signatures can lie — implementation doesn't have to match. Use union returns instead.

```python
# ❌ Overloads can be false
@overload
def fetch(url: str, fmt: Literal["json"]) -> dict: ...
@overload
def fetch(url: str, fmt: Literal["text"]) -> str: ...

# ✅ Union return — truth visible
def fetch(url: str, fmt: Literal["json", "text"]) -> dict[str, object] | str: ...
```

**Exception:** `@overload` acceptable in typed stubs for untyped third-party code.

### Return types

**Annotate public return types. Follow the chosen strict checker for private/internal signatures: mypy strict requires their return annotations too.** Local variable inference remains preferred; do not hide checker failures with suppressions.

Unlike TypeScript (where inference is stronger), Python's type checkers benefit from explicit return annotations on public APIs.

```python
# ✅ Public function — annotate return
def calculate_total(items: list[Item]) -> Decimal: ...

# ✅ Private helper — compatible with mypy strict
def _sum_prices(prices: Sequence[Decimal]) -> Decimal:
    return sum(prices, start=Decimal(0))

# ✅ Complex return — annotation clarifies
def fetch_user(user_id: str) -> User | None: ...
```
