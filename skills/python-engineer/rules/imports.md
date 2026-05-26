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
from returns.result import Result, Success, Failure

from myapp.core.config import settings
from myapp.models.user import User

if TYPE_CHECKING:
    from myapp.services.auth import AuthService
```

**`from __future__ import annotations`:** Makes all annotations strings (lazy evaluation). Enables forward references and breaks import cycles. **Caveat:** Don't use with Pydantic models that need runtime annotation access — Pydantic v2 handles this, but custom `get_type_hints()` calls will break.

**`TYPE_CHECKING` block:** Import types only needed for annotations here. Prevents circular imports — the import never runs at runtime.

### Auto-fix

`ruff check --fix --select I` or `ruff format`.
