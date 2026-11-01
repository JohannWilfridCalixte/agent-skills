---
name: agentic-grill-me
description: "Relentless interview on an agentic work item, every answer logged to decisions.md. Use to grill one focus (product, functional, tech), or all three when no focus is given."
argument-hint: "[product | functional | tech] [slug | topic]"
---

# Agentic Grill Me

Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it) unless already loaded.

**Focus**: from the caller (its focus rules apply on top) or the first argument.

- Called by `agentic-grill-{focus}` → grill that focus (steps 1–2).
- Focus argument, no `agentic-grill-{focus}` caller → Call the Skill tool with "agentic-grill-{focus}", passing the rest of the arguments: it calls back with its rules. Once it returns → Handoff, user-invoked bullet only.
- No focus → step 1's work item first, then Call the Skill tool with "agentic-grill-product", "agentic-grill-functional", then "agentic-grill-tech", one at a time, each passed the work item's slug. Once tech returns → Handoff, user-invoked bullet only.

## 1. Context

- Work item from the caller or the slug argument. None → open one (`agentic-use-workflow` Work item), topic from the argument or the conversation.
- Call the Skill tool with "agentic-use-knowledge" (read mode), then read the work item's `context.md`, `decisions.md`, and `spec.md` when present.

Done when you know which questions of the focus the docs, `context.md` and earlier decisions already settle: those are facts, stated with their source, never re-asked.

## 2. Grill and log

Call the Skill tool with "grilling" (no Skill tool → open `../grilling/SKILL.md`) and follow it on the focus only, with these rules:

- Deferral ("whatever", "you decide") → restate the options and trade-offs once before accepting it.
- An answer that breaks an earlier decision reopens it.
- Speak the project's ubiquitous language; a new or conflicting term is a question.
- `{knowledge.root}` stays untouched: promotion follows the gate.

### Recommend lean

Every focus. Recommended answer = the first rung of this ladder that fully works, smallest first: is it needed at all → already in this codebase → standard library or platform feature → an installed dependency → the minimum new work. Name the rungs you skipped in one line.

- Lean on the solution, never on coverage: every affected flow, caller and user is covered: a fact is looked up (subagent), a decision is asked.
- Options of equal size → the one correct on edge cases.
- Never cut, on the frontier every round: validation at trust boundaries, error handling that prevents data loss, security, accessibility, anything the user asked for.
- A known limit, or scope pushed to later → its own decision: the limit, and when to revisit.
- Each recommendation waits for the user's yes.

Log every answer as it comes: append it to `decisions.md` and log its `decision` event with its focus, per the decisions.md contract in `agentic-use-workflow` `references/state.md`.

Done when the frontier is empty for the focus and every answer is a `D` entry with its `decision` event.

## Handoff

Close with one summary: what was left out or unchecked, and the risks the user carries. Then:

- Under a flow skill or playbook → return; it runs the gate.
- A grill is the skill the user invoked → once its last focus returns, that grill offers the escalation gate (`agentic-use-workflow` `references/escalation.md`).
