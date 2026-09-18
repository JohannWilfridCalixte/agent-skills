---
name: agentic:skill:python-engineer
description: Use when writing Python code - covers typing, error handling, style, imports, and patterns
---

# Python Engineer

Rules for writing production-grade Python. Default target: Python 3.12+, with the repository's selected strict pyright or mypy configuration. Inspect its supported runtime/checker first; do not silently upgrade Python to use newer syntax. TypeIs needs Python 3.13 or typing_extensions. Under mypy strict, annotate private as well as public function signatures.

## When to Apply

- Writing new Python code
- Reviewing or refactoring Python code
- Any file ending in `.py`

## Rule Categories

| Priority | Category | Rules |
|----------|----------|-------|
| CRITICAL | Core Principles | `core-principles.md` |
| CRITICAL | Types | `types.md` |
| CRITICAL | Match Exhaustiveness | `match-exhaustiveness.md` |
| HIGH | Error Handling | `error-handling.md` |
| HIGH | Code Style | `code-style.md` |
| MEDIUM | Imports | `imports.md` |
| MEDIUM | Patterns | `patterns.md` |

## Quick Reference (Red Flags)

| Red Flag | Fix |
|----------|-----|
| `Any` anywhere | Use `object` + narrowing or specific type |
| `cast()` outside third-party wrappers | Type guard or `TypeIs` |
| `# type: ignore` without error code | Add `# type: ignore[specific-code]` + comment why |
| Bare generic: `dict`, `list`, `tuple` without parameters | `dict[str, int]`, `list[str]`, `tuple[str, ...]` |
| Mutable default arguments | `None` sentinel + create inside function |
| `@dataclass` without `frozen=True, slots=True` | Apply the immutable-record default unless the domain explicitly needs mutation |
| Pydantic model without `strict=True, frozen=True, extra="forbid"` | Apply the boundary-model default; preserve explicit compatibility/coercion contracts |
| Bare `except:` or `except Exception: pass` | Specific exception type, log + re-raise |
| Raising exceptions for expected domain failures | Use Result pattern |
| Exhaustive closed-union/enum match without `assert_never` | Add `case _ as unreachable: assert_never(unreachable)`; explicitly handle valid remainder in partial matches |
| `isinstance` chains instead of pattern matching | Use `match` statement |
| Old-style `TypeVar("T")` instead of 3.12+ `[T]` syntax | Use new `[T]` syntax |
| Old-style `Union[X, Y]` / `Optional[X]` | Use `X \| Y` / `X \| None` |
| `from typing import List, Dict, Tuple` | Use builtins: `list`, `dict`, `tuple` |
| Nesting > 3 levels | Extract functions |
| Abbreviated variable names | Full names |
| Missing `TYPE_CHECKING` block for type-only imports | Add `if TYPE_CHECKING:` block |
| `@overload` | Union returns instead (overloads can lie) |
| `global` keyword usage | Avoid |
| Star imports (`from module import *`) | Explicit imports |
| `eval()` / `exec()` | Avoid |
| Mutable class variables (`class Foo: items = []`) | Avoid |
| Relative imports (`from .module import x`) | Absolute imports only |

## How to Use

Rules are in the `rules/` folder. Each follows `rules/_template.md` format.

When writing Python, check rules by priority (CRITICAL first). Apply all applicable rules.
