---
name: to-tickets
description: Push a work item's spec and plan tasks to any issue tracker (Jira, GitHub, Linear...) as one parent ticket plus one ticket per task, with dependencies as links. One-way and idempotent: re-running updates existing tickets. Use after to-plan when the team tracks work in a tracker.
argument-hint: "<slug> [tracker] [project | repo]"
---

# To Tickets

Optional. Mirror `plan.md` into a tracker. The plan stays the source of truth: tickets are never read back except for their keys.

## 1. Load

Resume the work item by slug (`use-workflow`). Needs `plan.md`. Open escalations → stop unless the user overrides (logged by `use-workflow`).

## 2. Pick the tracker

Infer it from the input source (a Jira key in `input.md` → Jira) and from available tools: Jira MCP or CLI, `gh` for GitHub, Linear MCP. Confirm tracker, project or repo, issue types, and labels once with the user, unless already decided (e.g. by `ship-feature`). Log the choice as a `note` event via `use-workflow`.

## 3. Preview

List what will be created or updated: parent, then each task with its dependencies. Existing keys from `plan.md` / `state.json` mean update, not create. Get a yes (skipped when `ship-feature` runs autonomously).

## 4. Push

Delegate to a `tickets` subagent (`use-workflow` delegation) with the paths to `spec.md`, `plan.md`, and the tracker choice. It returns the key mapping.

- **Parent**: if the input was already a ticket, that ticket is the parent: link to it, never rewrite or close it. Otherwise create one from the spec's problem and acceptance criteria (the plan's in light mode).
- **One ticket per task**: title, goal, acceptance criteria, link to the parent. No file paths, they go stale.
- **Dependencies** become tracker links ("is blocked by"). Without native links, write "Blocked by {key}" in the body. Create in dependency order so the keys exist.
- **Re-run**: update title, body, and links of existing keys. Never touch status, assignee, or comments. A task removed from the plan is reported, not deleted.

## 5. Write back

Write each key into the task's **Ticket** slot and the parent into the header of `plan.md`. Record them in `state.json` `tickets` and log an `artifact` event via `use-workflow`.

## Handoff

Report the parent link and the task → key table. Standalone → suggest `implement {slug}`. Under `ship-feature` → return.
