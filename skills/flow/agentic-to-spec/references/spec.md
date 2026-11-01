# spec.md: delta over `to-spec`'s template

Start from the `<spec-template>` in `../../to-spec/SKILL.md`, then apply every change below.

## Header

First lines of the file:

```markdown
# Spec — {title}

> Work item: `{work}` · Decisions: [decisions.md](decisions.md)
```

## Add

- **Current behaviour**, after Solution, change branch only: how it works today, cited from `context.md`, and what this spec changes.
- **Acceptance criteria**, after User Stories: observable, testable, independent of implementation. IDs are stable: plan tasks, tickets and reviews cite them. Each cites the user stories it covers as `US{n}` (story number).

  ```markdown
  - [ ] **AC1** — Given {context}, when {action}, then {outcome}. (US1)
  ```

- **Open questions**, last: escalated decisions (link the ADR/RFC) and minor ones with the chosen default. "None" if empty.

  ```markdown
  - **D{n}** (escalated) — {summary} → [ADR/RFC]({path})
  - **D{n}** (minor) — {question} → default: {choice}
  ```

## Drop

Implementation Decisions and Testing Decisions: `agentic-to-plan` writes them into `plan.md`.
