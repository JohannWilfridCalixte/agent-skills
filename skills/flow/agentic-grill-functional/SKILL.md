---
name: agentic-grill-functional
description: "Grill behaviours, flows, states, edge cases, errors, permissions and acceptance criteria. Use to pin down how a feature behaves."
argument-hint: "[slug | topic]"
---

Call the Skill tool with "agentic-grill-me", passing focus `functional` and this skill's argument (no Skill tool → open `../agentic-grill-me/SKILL.md` and follow it).

Functional focus: behaviours, flows, states, edge cases, errors, permissions, acceptance. Problem and scope belong to `agentic-grill-product`, design to `agentic-grill-tech`.

- Each behaviour lands as a Given / When / Then the user confirmed: these become the spec's acceptance criteria. Each never-cut item the feature touches gets its own.
- Changing existing behaviour → grill the delta from the current behaviour, including what it breaks: data destroyed or exposed, flows that stop working.
- Reuse existing flows and UX patterns: the house pattern beats a new one.
