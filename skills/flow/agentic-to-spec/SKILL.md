---
name: agentic-to-spec
description: Spec a feature or a change into spec.md by gathering context and grilling product and functional decisions. Use when starting a feature, when a request is vague, or when changing existing behaviour.
argument-hint: "<text | file | ticket key | URL | slug>"
---

# To Spec

Turn a request into `spec.md`: what to build and for whom, never how.

Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it) unless already loaded.

**Change branch**: the request alters behaviour that exists today, rather than adding a capability. It reshapes steps 2 and 3 where marked, and the template ([references/spec.md](references/spec.md)).

## 1. Capture

- Slug argument → resume from `state.json`. Otherwise open a new work item.
- Text → verbatim. File → read it. Ticket key or URL → fetch it with the available tools (Jira, `gh`, Linear, web), comments and linked items included. Nothing → ask what to spec.
- Parent with children (sub-issues, a task list, local links such as agentic-security-audit's `issues/index.md`) → read every child too; each lands in `input.md` under the parent, with its ref.
- Write `input.md`: source reference + raw content, unedited.
- `state.json` `choices.branch` set (a playbook pinned it) → use it, skip classifying and logging. Otherwise classify new capability vs change branch; unclear → ask. Log it as a `choice` decision, key `branch`, value `new` or `change`.

Done when `input.md` holds the raw request and the branch is logged.

## 2. Context

Spawn `context.code`, `context.docs`, `context.runtime` in parallel per `agentic-use-workflow` Delegation, read-only, product focus:

- **context.code**: what exists in this area, user-facing surfaces, entry points. Change branch: the current behaviour exactly (rules, states, permissions, errors).
- **context.docs**: loads `agentic-use-knowledge` (read mode): product docs, glossary, related ADRs and RFCs.
- **context.runtime**: usage, errors, feature flags, analytics, through available tools only; none → skip.

Each cites its sources and lands as one section of `context.md`. Summarize in ≤5 lines and ask "anything wrong or missing?". Corrections → re-run only the affected subagent.

Done when every subagent that ran has a cited section and the user confirmed the summary.

## 3. Grill

Call the Skill tool with "agentic-grill-product", then call it again with "agentic-grill-functional". Change branch: run `agentic-grill-product` only when the problem or the users change.

Done when each grill that ran returned with an empty frontier.

## 4. Gate

Run the escalation gate (`agentic-use-workflow`) on the structural decisions. Revisit → back to the grill owning that decision's focus.

Done when every structural decision is confirmed or escalated.

## 5. Write `spec.md`

Read `../to-spec/SKILL.md` and follow it, with these overrides:

- **Source**: `input.md`, `context.md`, `decisions.md`. This skill's step 2 (Context) replaces its exploration; test seams belong to `agentic-grill-tech`.
- **Template**: its template with the delta in [references/spec.md](references/spec.md).
- **Destination**: provided: write `{work}/spec.md`, in place of the tracker and its triage label.
- Every structural decision reflected, none reinterpreted. Escalated and minor ones go under Open questions.

Log an `artifact` event, show a short summary, adjust on request. An adjustment that alters a decision goes back through the grill of its focus.

Done when every user story is covered by at least one acceptance criterion and every structural decision appears.

## 6. Promote

The gate promoted the decisions; now the spec's knowledge. Call the Skill tool with "agentic-use-knowledge" (write mode): the spec's product behaviour → `{knowledge.root}/product/`, terms the gate left out → glossary. Same workspace and commit rule as the gate's promotion (`agentic-use-workflow`).

Done when the spec's product behaviour and every new term are in `{knowledge.root}`, indexed and committed.

## Handoff

Report the `spec.md` path and any open escalation. Standalone → suggest `agentic-to-plan {slug}`. Under a playbook (`agentic-implement-feature`, `agentic-change-feature`) → return.
