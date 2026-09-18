# 0001 — Skills and explicit workflow contracts

**Status:** Accepted
**Date:** 2026-09-12
**Authority:** The repository owner accepted the architecture review and requested: “Apply everything, even what you flagged as ‘Next’.” The instruction to preserve TypeScript remains in force. The initial uncommitted handoff was followed by explicit authorization to commit, push and open a pull request on 18 September 2026.
**Sources:** [Accepted change map](../../migration/decisions.md), [runtime state contract](../../../skills/use-workflow/references/state-contract.md), [durable plan contract](../../../skills/use-workflow/references/plan-contract.md)
**Source revision:** Original library `a15b9b6b0e5e024588669d0cd8ba27944ad989c7`; the migration is recorded in the subsequent implementation commit.
**Last verified:** 2026-09-12 through local contract and example checks; cross-model workflow performance remains unverified.

## Context

The library's value is its spec-driven process and living documentation. Separate persona loading and repeated configuration/state/review instructions introduced competing contracts without adding distinct mechanisms. Faster models do not make the chosen engineering rules, decision gates or verification obligations obsolete.

## Decision

Package prompts as skills. Preserve native independent workers, phased workflows, engineering references, explicit decisions and existing approval gates. Absorb useful persona heuristics into task and review contracts. Keep the complete TypeScript package byte-for-byte.

Give configuration, workflow state, task dispatch, review execution and knowledge one owner each. Validate deterministic contracts with small local helpers. Keep accepted specifications and approval receipts in versioned documentation; keep run logs separate. Bind tests, reviews, approvals and resumptions to specific intent/code revisions. Use one writer for shared state and knowledge indexes, with isolated ticket work and serialized integration.

## Rationale and alternatives

A giant combined skill would make discovery and selective loading worse. Moving unchanged personas into a roles reference would retain the extra lookup and competing policies. Deleting gates based only on newer model capabilities would change the product rather than simplify its structure.

The selected approach keeps the original mechanisms while making their interfaces explicit. It adds requirement coverage, change-impact and observed telemetry so future prompt changes can be evaluated rather than justified by word count.

## Consequences

There are now eighteen packages, including read-only `ask-codebase`; no first-party persona resource remains. Qualified legacy names remain, with an external alias registry for host compatibility. The external installer and host model controls require their own compatibility verification.

JSON-syntax YAML state and sealed plan manifests introduce explicit migration boundaries for older runs. Validation can establish structure and content identity; it cannot establish genuine user approval, semantic correctness, production database atomicity, or equivalent model performance. Those require the relevant evidence and tests.
