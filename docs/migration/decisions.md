# Accepted changes and implementation decisions

Authorization: the user accepted all observations and recommendations, including “Next,” and requested implementation before their own review/testing and commit. Earlier instruction protects the complete TypeScript package. This file records choices among the alternatives in that accepted review; it does not fabricate a separate user decision for every implementation detail.

| Audit item | Applied decision | Owner / acceptance evidence |
|---|---|---|
| C1 — PR review mode | Explicit `report` and `repair`; reporting never starts remediation. | review-loop; report-only application scenario |
| C2 — major findings | Blockers and majors both mean changes requested; publication follows the same readiness. | review finding protocol and PR report |
| C3 — parallel integration | Independent worktrees when supported; otherwise freeze writers and use an owned snapshot. Serialize integration and exact staging. | implement; real two-worktree fixture |
| C4 — resume | Require repository/plan identity, reachable commit, and evidence of expected effects at the current candidate. | resume-check; reachable reverted commit fixture |
| C5 — debug verification | Two review passes at most, with one repair between; code/tests always, security selected by explicit risk conditions. | debug verification and repair protocol |
| C6 — state | Schema version 2; list-valued skills; explicit halted/terminal states; one writer, atomic save and optimistic version check. | validate-state/save-state tests |
| C7 — dependency names | Preserve qualified source names; fix three review-loop dependency mismatches and add aliases. | registry; validate-library |
| C8 — paths | Names and directories have distinct validators; nested dotted relative paths allowed, traversal and escaping symlinks rejected. | resolve-config fixtures |
| C9 — context/model routing | One resolver; selected profiles plus task-path detection and semantic skill applicability; explicit capability fallback. | use-agentic and resolver tests |
| C10 — conflicting personas | Remove identity/loading. Instructions outrank conventions; review severity follows evidenced impact and exploitability. | task/review contracts and application checks |
| C11–12 — living knowledge | Retrieve, classify, capture, reconcile; retain useful rationale, uncertainty and the existing category/index system. | knowledge lifecycle and index/link checks |
| C13 — durable intent | Accepted specs under configured `specFolder` (default `docs/specs`); run evidence remains transient. Issues close on verified merge by default, with release/manual policies available. | plan sealing/import, publication protocol |
| C14 — portability | Host capabilities and aliases explicit; full source rules loaded by path. No invented native agent/model controls. | host adapter; dispatch application checks |
| K1/K3/K4/K6 | Targeted retrieval, current-successor lookup, provenance/freshness, reconciliation and one numbered-record/index writer. | use-knowledge supporting contracts |
| K2/K5 | Durable manifest, stable acceptance IDs, mapped checks, explicit satisfied/unverified/changed/deferred view. | seal-plan, validate-plan, coverage |
| Next — change impact | Compute changed criteria/tickets and dependency descendants; preserve unaffected work with explicit rebinding. | impact tests; revision-aware gates |
| Next — telemetry | Append observed event records; deduplicate IDs; summarize measured values and unavailable data honestly. | telemetry fixtures and eval dataset |
| Later — ask-codebase | New read-only question workflow using code, knowledge and documented rationale. | ask-codebase application scenario |
| Later — external plan import | Convert structured source into draft durable artifacts; preserve plan/quiz gate rather than accepting arbitrary prose. | import-plan fixture |
| Engineering correctness | Correct verified Python, architecture and tracing examples; retain substantive technical policy and references. | engineering example fixtures |
| TypeScript | All eleven source files unchanged, including known optional correctness observations. | SHA-256 guard |

The new target configuration requests Astra for Codex reasoning/coding/review and Fable 5.1 for Claude, initially at high effort. Exploration inherits the host's default tier. Exact identifiers are configuration, not claims that this host executed both models. Unsupported selections fall back visibly; tuning requires the evaluation campaign. Fable's documented identifier and effort starting point are from [Anthropic's Fable 5.1 guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1).

No product-vision, frontend-development, or fully autonomous pipeline is added: the audit described these as separate future products, not prerequisites or recommended additions for this migration. Existing generation/branch/model questions remain where they resolve a real undecided choice; already recorded authorization is reused. The initial migration ran in explicit no-commit mode. On 18 September 2026 the owner authorized committing, pushing and opening a pull request.

## Persona clause destinations

| Removed source | Retained operative clauses | Destination |
|---|---|---|
| Architect | Wide-then-narrow exploration, existing patterns, complete relevant scope, downstream consequences, evidence, boundary/race/failure risks, no invented requirements, explicit unknowns. | delegate-work exploration contract; planning/debug/PR context outputs |
| Software engineer | Stated scope, simpler justified design, instructions before conventions, accepted architecture, behavior tests, root-cause fixes, dependency justification, visible uncertainty/regression risk. | delegate-work engineering contract; testing and operation skills |
| QA | Read all changed files, plan coverage, located/actionable evidence, proportional severity, conventions checked, uncertainty disclosed, no cosmetic blockers. | review-code/review-tests and findings contract |
| Security engineer | Entry points/trust boundaries, exploitability plus impact, sensitive-data context, concrete remediation, no speculative alarms, uncertainty visible. | review-security |

Seniority/identity prose and duplicate boot instructions have no separate runtime owner. Native worker separation, specialization and parallel execution are retained.
