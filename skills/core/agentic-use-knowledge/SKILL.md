---
name: agentic-use-knowledge
description: The project's knowledge base (ADRs, principles, glossary, product, RFCs). Use to gather project context before work (read mode), or to record decisions, terms or debates the code can't show (write mode), also when a conversation that settled one ends.
---

# Use Knowledge

`{knowledge.root}` holds what can't be derived from code: decisions, standing rules, domain language, product intent, open debates. Resolve it per [config.md](../agentic-use-workflow/references/config.md); paths below are relative to it.

## Structure

Every folder has a `README.md` index. A repo-level layout doc (named by the project's instructions) overrides this section's indexes and filenames; keep the rest.

```
{knowledge.root}/
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

1. `tech/principles.md`
2. `tech/adr/README.md`, then only the ADRs relevant to the task
3. `ubiquitous-language/README.md`
4. `product/README.md`, then relevant topics
5. `tech/rfc/README.md` and `landing-zone/README.md` for open debates touching the task

Return findings cited by repo path (`{knowledge.root}/tech/adr/0003-…md`). Flag contradictions between docs and code; don't fix them in read mode. Missing `{knowledge.root}` → say so, carry on.

## Write mode

Classify:

- Decision with an answer → `tech/adr/`: `Accepted` if confirmed, `Proposed` if escalated (awaiting someone else's yes)
- Rule every change must follow → line in `tech/principles.md`, linking the ADR that justifies it when one exists (an accepted ADR can also add one)
- Domain term → `ubiquitous-language/` glossary row; own file only when it needs a deep-dive
- Product feature or vision → `product/`
- Technical debate with no chosen answer yet → `tech/rfc/`
- Unsure or spans topics → `landing-zone/`; capture imperfectly rather than lose it

Inside a workflow, write only confirmed content: decisions the escalation gate confirmed or escalated (or resolved at agentic-use-workflow references/state.md Resume step 0), and content of a `spec.md` or `plan.md` written after its escalation gate passed (it restates gated decisions and the user's answers).

Outside a workflow, at the end of a conversation that decided or learned something the code can't show: propose capturing it, one line per item (classification → target path). Write only what the user confirms.

Rules:

- Next ADR/RFC number = `ls` of the folder at the moment of writing, plus one. A number chosen earlier in the session is stale: other branches may have taken it.
- Update the section `README.md` on every add, rename or removal. An unindexed doc is lost.
- Changing an ADR (refinement, partial reversal, status) → edit it in place, add a `History` row. Never write a new ADR to override part of one.
- Decision fully retired → new ADR; old one `Superseded by [NNNN]` plus a `History` row.
- ADR rule changed or retired → update `principles.md`.
- RFC decided → write the ADR, mark the RFC `Decided → ADR-NNNN`.
- Concise. Tables and short paragraphs over prose.

## Formats

### ADR — `tech/adr/NNNN-slug.md`

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

## History

| Date | Change |
|---|---|
| YYYY-MM-DD | Created |
```

### RFC — `tech/rfc/NNNN-slug.md`

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

### Principles — `tech/principles.md`

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
