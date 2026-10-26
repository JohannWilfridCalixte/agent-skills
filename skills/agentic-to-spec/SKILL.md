---
name: agentic-to-spec
description: Turn a raw idea, ticket, or document into a validated product spec (spec.md) by gathering context and grilling product and functional decisions. Use when starting a feature, when a request is vague, or before agentic-to-plan.
argument-hint: "<text | file | ticket key | URL | slug>"
---

# To Spec

Workflow 1. Turn raw input into `spec.md`: what to build and for whom, never how.

`agentic-use-workflow` runs throughout: work-item folder, events and state, delegation, escalation gate, communication mode.

## 1. Capture

- Argument is an existing slug → resume from `state.json` (`agentic-use-workflow`). Otherwise open a new work item.
- Text → verbatim. File → read it. Ticket key or URL → fetch it with whatever the harness offers (Jira MCP/CLI, `gh`, Linear, web fetch), including comments and linked items. Nothing → ask what to spec.
- Write `input.md`: source reference + raw content, unedited.

## 2. Context

Spawn `context.code`, `context.docs`, `context.runtime` in parallel (`agentic-use-workflow` delegation), read-only, product focus:

- **code**: what exists today in this area, user-facing surfaces, entry points.
- **docs**: `docs/product/`, ubiquitous language, related ADRs and RFCs (`agentic-use-knowledge`).
- **runtime**: usage, errors, feature flags, analytics, only through available tools. Otherwise skip.

Each cites its sources and lands as one section of `context.md`. Summarize in ≤5 lines and ask "anything wrong or missing?". Corrections → re-run only the affected subagent.

## 3. Grill

Run `agentic-grill` with focus `product`, then `functional`.

## 4. Gate

Run the escalation gate (`agentic-use-workflow`) on the structural decisions. Revisit → back to `agentic-grill`.

## 5. Write `spec.md`

Fill [references/spec.md](references/spec.md). Every structural decision is reflected, none reinterpreted. Acceptance criteria are observable and testable, with stable IDs (`agentic-to-plan`, `agentic-review`, `agentic-to-tickets` cite them). Escalated decisions go under open questions. Implementation detail stays out: it belongs to `agentic-to-plan`.

Log an `artifact` event, show a short summary, adjust on request. A change that alters a decision goes back through `agentic-grill`.

## 6. Promote

Via `agentic-use-knowledge`: confirmed product behaviour → `docs/product/`, new or clarified terms → ubiquitous language. Nothing unconfirmed.

## Handoff

Report the `spec.md` path and any open escalation. Standalone → suggest `agentic-to-plan {slug}`. Under `agentic-ship-feature` → return.
