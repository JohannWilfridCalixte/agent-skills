---
name: agentic-to-tickets
description: Ticket a work item's spec and plan into tracer-bullet tickets with blocking edges, as local files or in a tracker (GitHub, Jira, Linear). Use after a plan when the work should be split into tickets or tracked.
argument-hint: "<slug> [tracker]"
---

# To Tickets

Optional. Slice `spec.md` + `plan.md` into tickets; tickets then replace plan tasks as the implementation units. The vendored `to-tickets` skill does the slicing; this skill supplies its setup and records the result.

Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it) unless already loaded.

## 1. Load

Resume the work item by slug. No `plan.md` → stop, suggest `agentic-to-plan {slug}`. Open escalations → agentic-use-workflow references/state.md Resume step 0.

Done when the `plan.md` path, and the `spec.md` path when present, are known.

## 2. Pick the tracker

Unless the caller already decided or `state.json` `choices.tracker` holds it, ask: local or a real tracker. `input.md` is a parent item with children (sub-issues, a task list, local child files such as agentic-security-audit's `issues/`) → recommend the children's own: local files → `local`, tracker items → that tracker.

- **local** → one file per ticket at `{work}/tickets/NN-slug.md`.
- **real tracker** → infer it from the input source (a Jira key in `input.md` → Jira) and the available tools (`gh`, Jira or Linear MCP / CLI); confirm project or repo and labels.
- **Disclosure**: `input.md` is an agentic-security-audit parent (its `Source:` line) and the tracker, however picked, isn't local → agentic-use-workflow Disclosure guard on the destination; not cleared → local or stop.

Log the choice as a `choice` decision, key `tracker`, value `local` or the tracker and destination (e.g. `jira:SHOP`).

Done when tracker and destination are logged.

## 3. Slice

Read `../to-tickets/SKILL.md` and follow it, with this brief in place of its own setup:

- **Tracker**: the one picked in step 2, provided. Local → write `{work}/tickets/NN-slug.md` with its local template, in place of its `.scratch/…` path.
- **Source**: `spec.md` + `plan.md`. Seed one slice per plan task, keep the AC IDs, merge or split by its slicing rules.
- **Re-run**: tickets already referenced in `plan.md` are updated, never duplicated.
- **Existing children**: `input.md` is a parent with children (step 2) → map slices onto them; only a slice no child covers gets a new ticket. A child no slice covers → ask. Per covered child:
  - in the picked tracker → it is that slice's ticket, updated in place;
  - local file → never write into another work item: copy it to `{work}/tickets/NN-slug.md` with a `Source: <child path>` line, then update the copy;
  - in another tracker than the picked one → new ticket with a `Source: <child ref>` line.

Publishing to a real tracker runs as a `tickets` subagent (`agentic-use-workflow` Delegation), given the approved breakdown and the tracker choice.

Done when the user approved the breakdown and every ticket is published.

## 4. Write back

Write each ticket ref (tracker key or `tickets/NN-slug.md`) into the `Ticket:` slot of the plan tasks it covers, and the parent into the `plan.md` header. Log an `artifact` event with `tickets: {parent, tasks}`; `state.json` `tickets` derives from it.

Done when every plan task's `Ticket:` slot holds a ref and the `artifact` event is logged.

## Handoff

Report the tracker, parent and task → ticket table. Standalone → suggest `agentic-implement {slug}`. Under a playbook → return.
