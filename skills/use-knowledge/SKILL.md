---
name: use-knowledge
description: Read and write the project's `docs/` knowledge base. Read mode gathers context from principles, ADRs, glossary and product docs before work starts. Write mode promotes decisions, domain terms, product knowledge or open debates into the right place. Use when gathering project context, after an escalation gate, or when a conversation surfaces knowledge the code can't show.
---

# Use Knowledge

`docs/` holds what can't be derived from code: decisions, standing rules, domain language, product intent, open debates.

## Structure

Every folder has a `README.md` index.

```
docs/
├── tech/
│   ├── principles.md          # standing rules, each linking its ADR
│   ├── adr/NNNN-slug.md
│   └── rfc/NNNN-slug.md
├── product/<topic>.md
├── ubiquitous-language/       # README.md is the glossary
│   └── <term>.md              # optional deep-dive
└── landing-zone/<topic>.md
```

## Read mode

Indexes first, details on demand:

1. `docs/tech/principles.md`
2. `docs/tech/adr/README.md`, then only the ADRs relevant to the task
3. `docs/ubiquitous-language/README.md`
4. `docs/product/README.md`, then relevant topics
5. `docs/tech/rfc/README.md` and `docs/landing-zone/README.md` for open debates touching the task

Return findings cited by path (`docs/tech/adr/0003-…md`). Flag contradictions between docs and code; don't fix them in read mode. Missing `docs/` → say so, carry on.

## Write mode

Classify:

- Firm decision → `tech/adr/` (`Accepted` if confirmed, `Proposed` if escalated)
- Rule every change must follow → line in `tech/principles.md`, linking the ADR that justifies it when one exists (an accepted ADR can also add one)
- Domain term → `ubiquitous-language/` glossary row; own file only when it needs a deep-dive
- Product feature or vision → `product/`
- Technical debate still open → `tech/rfc/`
- Unsure or spans topics → `landing-zone/`; capture imperfectly rather than lose it

Inside a workflow, write only what the escalation gate confirmed or escalated. Nothing unconfirmed lands in `docs/`.

Rules:

- `ls` the folder for the next ADR/RFC number; never guess.
- Update the section `README.md` on every add, rename or removal. An unindexed doc is lost.
- Superseding an ADR: mark the old one `Superseded by [NNNN]`, update `principles.md`.
- RFC decided → write the ADR, mark the RFC `Decided → ADR-NNNN`.
- Concise. Tables and short paragraphs over prose.

## Formats

### ADR — `docs/tech/adr/NNNN-slug.md`

```markdown
# NNNN - Title

**Status:** Proposed | Accepted | Deprecated | Superseded by [NNNN]
**Date:** YYYY-MM-DD

## Context

Why this decision is needed. What forces are at play.

## Decision

What we decided. Be specific.

## Rationale

Why this over alternatives. What tipped the scale.

## Alternatives Considered (optional)

Discarded options and why.

## Consequences

What follows, positive and negative.
```

### RFC — `docs/tech/rfc/NNNN-slug.md`

```markdown
# NNNN - Title

**Status:** Open | Decided → ADR-NNNN | Abandoned
**Date:** YYYY-MM-DD

## Problem

What we're trying to solve.

## Options

### Option A — Name
Pros / Cons

### Option B — Name
Pros / Cons

## Open Questions

- Unresolved points
```

### Principles — `docs/tech/principles.md`

```markdown
# Principles

- Rule in one sentence. ([ADR-NNNN](adr/NNNN-slug.md))
- Rule without a backing ADR.
```

### Others

- **Glossary** (`ubiquitous-language/README.md`): table `| Term | Definition |`, one sentence each, linking a deep-dive when one exists.
- **Term deep-dive** (`ubiquitous-language/<term>.md`): `# Term`, then `## Definition` (one sentence), `## Context` (why it matters, common confusions), `## Examples`.
- **Product**: free-form.
- **Landing zone**: free-form, with `**Status:**` and `**Potential destinations:**` lines.
- **Index** (every section `README.md`): table `| Entry | Description |`, one row per doc, linked, one-line summary.
