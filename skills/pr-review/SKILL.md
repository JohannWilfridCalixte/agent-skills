---
name: agentic:workflow:pr-review
description: Use when reviewing one or more pull requests, PR numbers, GitHub URLs, or cross-repository PR references.
argument-hint: "<PR ref> [<PR ref> ...]"
---

# PR Review

Report independent code, test and security findings against immutable PR revisions. Source code is read-only; this skill never repairs a PR. Required skills: `use-agentic`, `use-workflow`, `delegate-work`, `review-loop`, `use-knowledge`.

Accept numeric/# references in the identified current repository, full PR URLs, `owner/repo#number`, or multiple references. Missing/ambiguous identity requires clarification. Initialize one parent run before writing artifacts. Resolve profile/model context once, preserving repository-specific skill selection for each target.

| Phase | Instructions |
|---|---|
| 1 | [Gather target/context/preferences](steps/step-01-gather-context.md) |
| 2 | [Report-only review](steps/step-02-review-loop.md) |
| 3 | [Report and authorized delivery](steps/step-03-report.md) |

Single and batch use the same per-PR three-phase contract. Parent resolves preferences once, then delegates bounded independent PR scopes up to available capacity. Each child receives exact target identity, pre-resolved preferences, selected skills, unique output path and source-read-only/report-write capability; it returns results. Parent alone updates shared state and performs external publication. Children never initialize competing parent states or write to another PR's paths.

Preserve local/PR-comments and verbosity choices, reusing existing explicit authorization. Local-only means no external posting. Retrieve relevant knowledge for each repository without treating another repository's guidance as authoritative; reconcile material knowledge proposals at completion. Keep complete/incomplete review outcomes distinct from pass/fail readiness. Start phase 1.
