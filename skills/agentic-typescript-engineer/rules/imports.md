---
title: Imports
impact: MEDIUM
tags: imports, ordering, grouping, type-imports, organization
---

## Imports

**Impact: MEDIUM**

### Rules

1. **Type imports first**: `import type` before value imports
2. **Separate type imports**: Never mix types and values in one import
3. **Group ordering**: builtin > external > internal > relative
4. **Blank lines between groups**
5. **Alphabetical within groups**

### Example

```typescript
// 1. Type imports (by group)
import type { TestContext } from 'bun:test';

import type { InferSelectModel } from 'drizzle-orm';

import type { Result } from '@company/monads';

import type { User } from '../types';

// 2. Value imports (by group)
import { describe, expect, it } from 'bun:test';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { Ok, Err } from '@company/monads';
import { logger } from '@company/logger';

import { calculateCost } from '../calculation';
import { validateInput } from './validator';
```

### Group Order

| Priority | Group | Examples |
|----------|-------|----------|
| 1 | Builtin | `bun:test`, `node:fs` |
| 2 | External | `zod`, `drizzle-orm` |
| 3 | Internal | `@company/*` |
| 4 | Relative | `../`, `./` |

### Auto-fix

Most violations auto-fix with `bun run lint --fix` or `eslint --fix`.

Manual fixes needed for:
- Circular dependencies
- Choosing named vs default imports
