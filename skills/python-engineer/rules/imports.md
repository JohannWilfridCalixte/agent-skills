---
title: Imports
impact: MEDIUM
tags: imports, ordering, grouping, type-checking, absolute-imports, organization
---

## Imports

**Impact: MEDIUM**

### Rules

1. `from __future__ import annotations` first (if needed)
2. Standard library
3. Third-party
4. Local/project
5. Blank lines between groups
6. Alphabetical within groups
7. `TYPE_CHECKING` block for type-only imports (breaks circular deps)
8. Absolute imports only — no relative imports

### Example

```python
from __future__ import annotations

import enum
from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, ConfigDict, Field
from returns.result import Failure, Result, Success

from myapp.core.config import settings
from myapp.models.user import User

if TYPE_CHECKING:
    from myapp.services.auth import AuthService
```

**`from __future__ import annotations`:** On the supported 3.12/3.13 baseline, stores annotations as strings and enables forward references. `get_type_hints()` can resolve them when referenced names are available; postponement alone does not break it. Names imported only under TYPE_CHECKING are absent at runtime. Pydantic and other runtime annotation consumers may need resolvable names, explicit namespaces or model rebuilds; check the selected runtime/library behavior instead of assuming postponed annotations solve every cycle.

**`TYPE_CHECKING` block:** Import types needed only by static checking here; these imports never run at runtime. Exception classes used in `except`, classes used in `match`/`isinstance`, decorators, Result constructors, runtime aliases and names needed by annotation consumers belong in runtime imports.

### Auto-fix

Run `ruff check --select I --fix`, then `ruff format` for formatting. The formatter does not sort imports. Use the repository's configured import groups and Ruff version.
