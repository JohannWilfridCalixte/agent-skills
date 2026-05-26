---
title: Core Principles
impact: CRITICAL
tags: typesafety, inference, narrow-types, fundamentals
---

## Core Principles

**Impact: CRITICAL**

Three foundational principles that guide all TypeScript decisions.

### 1. Maximal end-to-end type safety

No `any`, no `as` cast. Not exhaustive but the baseline.

### 2. Types as narrow as possible

```typescript
type RGB = `#${string}` | [number, number, number];
type PrimaryColor = 'red' | 'green' | 'blue';

interface Options {
  readonly colors: Record<PrimaryColor, RGB>;
  readonly level: 1 | 2 | 3;
  readonly type: 'foo' | 'bar';
  readonly comment?: string;
}

// Correct: narrow type
const options = { color: { red: '#F00', green: '#0F0', blue: [0, 0, 255] }, type: 'foo', level: 2 } satisfies Options;

// Works because TypeScript understands it's a string; not overwritten by the const version
console.log(options.color.red.toLowerCase());

// Incorrect: no precision, TS only knows Options shape
const a: Options = { type: 'foo', level: 2 };
```

### 3. Maximum inference from TypeScript

```typescript
// Correct: TS can infer
const a = 2;

// Incorrect: useless annotation
const a: number = 2;
```
