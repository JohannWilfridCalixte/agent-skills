---
name: agentic-grill
description: Interview the user one question at a time, each with a recommended answer, until every structural product, functional, or technical decision is made. Use to stress-test an idea, spec, or design, when the user says "grill me", or as the interview step of agentic-to-spec, agentic-to-plan, and agentic-ship-feature.
argument-hint: "<product | functional | tech | combined> [slug | topic]"
---

# Grill

Interview the user relentlessly until no structural decision is left open for the focus. Walk the decision tree branch by branch, resolving the decisions others depend on first. Skip what is clearly irrelevant.

| Focus | Resolve |
|---|---|
| `product` | Problem, target users, value, scope and out of scope, success signal |
| `functional` | Behaviours and flows, edge cases, errors, permissions, acceptance criteria, domain terms |
| `tech` | Boundaries, data model and migrations, contracts, dependencies, data flow, failure modes, security, testing strategy, performance, rollout |
| `combined` | Blocking questions only, across all three. ~3 max |

## Rules

- **One question at a time**, always with your recommended answer and a one-line why. Name the alternatives when there are some.
- Use the harness's multiple-choice tool when available, recommended option first. Free text stays possible.
- **Look before asking.** If the code, `context.md`, `decisions.md`, or `docs/` (ADRs, `docs/tech/principles.md`, ubiquitous language, read via `agentic-use-knowledge`) already answer it, state the finding instead of asking. For larger lookups, spawn `context.code` / `context.docs` / `context.runtime` (`agentic-use-workflow` delegation).
- Ground questions in what exists: cite files and docs.
- **Push back** on "whatever", "you decide", "doesn't matter": restate the concrete options and their trade-offs once. If the user still defers, take your recommendation, get a yes, and log it as deferred.
- An answer that invalidates an earlier decision reopens it. Log the new one as superseding the old.
- Speak the project's ubiquitous language. A new or conflicting term is a question.
- **No `docs/` edits during the grill.** Promotion happens after the gate.

## Log every answer live

Right after each answer, append it to `decisions.md` in the work item and log a `decision` event via `agentic-use-workflow` (`data`: `id`, `question`, `answer`, `tag`). IDs (`D1`, `D2`...) continue across all grills of the work item.

```markdown
## D3 · structural · tech
**Q:** Where are export files stored?
**A:** Object storage, 30-day expiry (recommended | alternative | deferred)
**Why:** Reuses the attachments bucket; DB rows would bloat backups.
**Supersedes:** D1 (optional)
```

- **structural**: changes the shape of the product or the implementation (scope, user-visible behaviour, data model, public contract, boundaries, dependencies, security, cost). Costly to reverse.
- **minor**: cheap to change later (naming, copy, log levels, defaults). Pick a default and move on.

## Stop

Stop when no structural question is open for the focus. List the remaining minor questions with the defaults you chose, get a confirmation, then hand back. The caller runs the escalation gate (`agentic-use-workflow`).

## Standalone

No work item yet → open one via `agentic-use-workflow` (a slug resumes an existing one). Take the topic from the argument or the conversation. At the end, offer to run the escalation gate so confirmed decisions get promoted.
