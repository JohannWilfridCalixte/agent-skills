# Reconcile intent, implementation, and knowledge

Use during a run when a consequential mismatch appears and before finalization. Retrieve the relevant current records and their provenance first. Reconciliation preserves historical decisions while making live summaries accurate.

## Compare claims

1. Identify the accepted intent: user instruction, sealed spec/acceptance criteria, current Accepted ADR, and product definition.
2. Identify observed behavior at the delivered code revision through code, checks, review, and deployment/merge evidence as applicable. A local commit is not automatically shipped or released.
3. Compare the claims per affected requirement. Keep source links, status, and revisions attached. Do not replace architecture merely because newer code disagrees, or declare implementation wrong merely because stale prose differs.
4. Choose the evidence-supported action below; unresolved policy goes back to the owning workflow's decision gate with a concrete recommendation.

| Evidence condition | Action |
|---|---|
| Behavior matches accepted change but live product/architecture summary is stale | Update summary, last-verified evidence, and indexes within authorized scope. |
| ADR0010 was explicitly superseded by Accepted ADR0011 | Preserve 0010's history/status and successor link, retrieve 0011, add/repair reciprocal links and relevant live summaries. |
| Code differs from current accepted decision and no approved change is found | Record both claims and the mismatch; do not silently bless the deviation. Return the structural choice to the orchestrator. |
| New fact is verified but its implication is unresolved | Capture the fact with provenance and open an RFC/landing-zone proposal for the question. |
| Only an assumption or uncertain external claim exists | Mark unverified/proposed; identify missing evidence. |
| No durable difference remains | Record unchanged with reason in the existing run; no new empty document. |
| User requested read-only/no docs | Return mismatches and known unknowns in the answer; perform no documentation writes. |

## Requirement evidence linkage

Use stable acceptance IDs from the accepted plan. Record the chain: requirement → ticket/acceptance criterion → actual check/assertion → exact code and plan revision → commit/PR/delivery evidence → affected live document/ADR. Store runtime check details once in workflow state and link from docs; do not copy every command log into product prose.

The requirement states are `satisfied`, `unverified`, `changed`, and `deferred`. “Suite passed” is insufficient without evidence that a named criterion was assessed. A check against an old revision stays historical unless its relevance has been verified and explicitly carried forward. Unverified edge cases remain visible even when the main path passes. Run `coverage` for the mechanical view, then inspect the assertions and remaining gaps.

## Write and verify

Canonical changes use the single writer and allocation rules in [capture.md](capture.md). Keep superseded context/rationale, repair successor/backlinks and root/section indexes, and record authority for new Accepted decisions. Existing explicit acceptance satisfies the same decision; don't ask again merely to document it. New unresolved consequential choices use the workflow's existing gate. Documentation work does not authorize posting to external users/services.

Run `validate-knowledge docs` to check available links and numbering. Inspect semantic consistency and source freshness separately; the helper cannot determine architectural truth. Return changed document paths, linked requirements/decisions, unresolved discrepancies, and reconciliation outcome. A final summary must distinguish implemented, merged, and released behavior where those states matter.
