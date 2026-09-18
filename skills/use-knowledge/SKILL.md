---
name: agentic:skill:use-knowledge
description: Use when planning or investigating needs existing project knowledge, when durable decisions or terms surface, or when documentation is stale, created, or reorganized
---

# Use Knowledge

Keep project knowledge discoverable and distinguish accepted intent from observed behavior. Use `docs/` for durable knowledge; execution details belong in run artifacts. Assess capture as knowledge surfaces and before closing work. A conversation with no new durable knowledge needs no invented document. Respect explicit read-only or no-documentation instructions.

## Choose the operation

| Need | Action and required reference |
|---|---|
| Existing rationale, constraints, or terms | Retrieve a focused evidence packet using [retrieval.md](references/retrieval.md). |
| New durable knowledge | Classify below; use [capture.md](references/capture.md) and the needed [template](references/templates.md). |
| Delivered behavior or intent changed | Reconcile source evidence, accepted decisions, and live docs using [reconciliation.md](references/reconciliation.md). |

Retrieve before planning or investigation decisions: read the root/section indexes, relevant accepted records, their successors, and scoped code/spec evidence. Load only relevant records. Superseded history can explain an old decision; it is not current policy.

## Classification

| Knowledge | Destination |
|---|---|
| Consequential firm decision with real trade-offs: hard to reverse, surprising, or constraining future work | `docs/tech/adr/NNNN-slug.md` |
| Unresolved technical debate with alternatives | `docs/tech/rfc/NNNN-slug.md` |
| Domain term/concept | `docs/ubiquitous-language/README.md`, optional term detail |
| Product behavior, feature, or vision | `docs/product/<topic>.md` |
| Reusable but uncertain/mixed knowledge | `docs/landing-zone/<topic>.md` |
| Routine local execution choice | Existing run decision log, with reason; promote only if durable value emerges |

Capture the rationale future readers cannot derive from code. Use short paragraphs/tables. ADRs retain context, decision, rationale, alternatives when relevant, consequences, status, and date. RFCs become linked ADRs once decided. Landing-zone records carry status and potential destinations and are reviewed for promotion.

Workers produce unique **Proposed** captures, not numbered documents. One orchestrator allocates numbers and updates canonical docs, indexes, and backlinks. Every section has a README index; `docs/README.md` links active sections. Update indexes on additions, modifications, renames, removal, or promotion.

Existing user acceptance can establish authority; new content is not Accepted merely because an agent wrote it. Resolve consequential unresolved choices through the owning workflow's gate. Recording observed facts or an already-accepted decision needs no repeated approval. Read-only questions return source-backed answers and known unknowns without mutating documentation.
