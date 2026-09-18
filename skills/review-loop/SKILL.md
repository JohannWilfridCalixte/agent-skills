---
name: agentic:workflow:review-loop
description: Use when an implementation, debug fix, or pull request needs independent review perspectives or bounded repair rounds.
---

# Review Loop

Run independent review lenses against one immutable target. The caller owns state and delivery; workers return reports. Required skills: `use-agentic`, `use-workflow`, `delegate-work`. Inherit an initialized parent run and resolved execution context; without them return `blocked` with missing inputs.

Read [findings and results](references/findings.md) before dispatch. Required call fields:

| Field | Contract |
|---|---|
| `mode` | `report` or `repair`; an iteration budget is not mutation permission |
| `max_rounds` | Positive integer counting review passes, starting at 1 |
| `review_skills` | Required independent lenses, resolved through the skill catalog |
| `scope_id` | Unique literal key under parent `review_loops`; never abbreviate it |
| `target` | Repository, base/head SHA, immutable snapshot path/digest, diff path, exact files |
| `write_scope` | Exact owned repair paths; empty in report mode |
| `inputs`, `output_path` | Plan/evidence paths and unique scope output directory |

1. Dispatch each lens concurrently through `delegate-work`, with QA model role, source-read-only/report-write capabilities, selected profile skills, target, and the findings contract path. Each writes `round-{N}/{lens}.md` and `.json` under this scope. Reviewers are independent of implementers and each other.
2. Validate returned target identity, coverage and findings; deduplicate equivalent root causes, preserve evidence and adjudicate contradictory suggestions. Parent records results, counts and telemetry.
3. `report`: return `reported` after one pass, with readiness and findings; never dispatch fixes or ask about repair choices.
4. `repair`: complete coverage and no blockers/majors → `passed`; incomplete evidence/capability or invalid target → `blocked`; unresolved blockers/majors at `max_rounds` → `max_reached`.
5. Otherwise group findings into independent, non-overlapping repair sets within `write_scope`. Dispatch code-writing workers using the [engineering contract](../delegate-work/references/engineering-contract.md); preserve ownership, run scoped checks, freeze a new snapshot, increment round and re-review. Scope expansion returns `blocked` for caller resolution.

`max_rounds: 2` permits two review passes and at most one repair round. Workers never mutate Git, publish, or write shared state. Only `passed` satisfies a repair gate. Exhaustion is an explicit return, not completion or an automatic budget extension; the caller retains its developer escalation choices.
