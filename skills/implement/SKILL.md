---
name: agentic:workflow:implement
description: Use when implementing or resuming an accepted technical plan with validated tickets and acceptance criteria.
argument-hint: "<path/to/accepted-spec-dir>"
---

# Implement from Technical Plan

Implement the accepted specification through native workers, independent reviews and serialized integration. Required skills: `use-agentic`, `use-workflow`, `delegate-work`, `review-loop`, `use-knowledge`.

**Hard gate:** the supplied directory must contain a valid sealed `plan.json`, `prd.md`, `technical-plan.md` and at least one ticket, with current structural/ticket approval evidence. Missing or invalid input → halt before code work and direct the developer to `technical-planning` or its explicit accepted-plan import path. This skill never invents a plan or treats arbitrary planning-mode prose as accepted input. PRD remains read-only product context during implementation.

| Phase | Instructions |
|---|---|
| 1 | [Validate, bind context and resume](steps/step-01-validate.md) |
| 2 | [Process ticket frontier](steps/step-02-process-tickets.md) |
| 3 | [Finalize and optionally publish PR](steps/step-03-finalize.md) |

The parent owns state and all Git mutations. Delegate code, tests and reviews through `delegate-work`, with selected profile skills, exact paths, immutable inputs and [engineering guidance](../delegate-work/references/engineering-contract.md). Workers may inspect Git read-only if granted; they never commit, stage, switch branches or publish.

Initialize the run once. Retain branch confirmation and optional PR choice, reusing prior explicit authorization. After branch confirmation, work autonomously within accepted scope until a specified gate needs input. Preserve per-ticket conventional commits by default; an explicit no-commit request sets `execution_context.commit_mode: none`, keeps work `integrated`, and forbids commits/push/PR publication until separately authorized. Never label uncommitted work committed.

Keep accepted specs durable, execution statuses canonical in run state, scoped worker tests and full-suite integration checks. Retrieve relevant knowledge at entry, propose significant updates while working, and reconcile docs at completion. Start phase 1.
