---
name: agentic-grill-tech
description: "Grill architecture, contracts, data and migrations, failure modes, security, observability and test seams. Use to settle design decisions before coding."
argument-hint: "[slug | topic]"
---

Builds on `grilling`, `ponytail` (ultra) and the `agentic-use-knowledge` read pass; `grilling` and the read pass are loaded by `agentic-grill-me`.

Call the Skill tool with "ponytail" at level `ultra` (no Skill tool → read `../ponytail/SKILL.md` and follow it at ultra). Then call the Skill tool with "agentic-grill-me", passing focus `tech` and this skill's argument (no Skill tool → open `../agentic-grill-me/SKILL.md` and follow it).

Tech focus: architecture, contracts, data and migration, failure modes, security, observability, test seams. Problem and behaviours belong to `agentic-grill-product` and `agentic-grill-functional`.

- **Test seams**: prefer existing seams, at the highest point possible; propose a new one only where none fits. Fewest seams wins, ideally one. Confirm them with the user.

## Ponytail in the grill

Ponytail's ladder and never-cut list = `agentic-grill-me`'s Recommend lean (its rung ladder and Never cut line): apply that block. On top:

- **Scope**: ponytail's "before you write" list (callers, tests, fixtures, config, exports, what users lose) is part of the coverage: each item a fact, looked up.
- **Precedence**: `{knowledge.root}/tech/principles.md` and accepted ADRs count as settled and outrank ponytail.
- **Skipped / risk lines**: once, in the handoff summary, not every round.

## Handoff

After `agentic-grill-me` returns, ponytail mode ends: its rules don't apply to the gate, `agentic-to-plan`, `agentic-implement` or review.
