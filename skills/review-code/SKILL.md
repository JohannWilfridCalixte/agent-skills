---
name: agentic:skill:review-code
description: Use when reviewing implementation code for correctness, quality, and maintainability.
---

# Review Code

Review implementation against accepted requirements and project engineering rules. Read tests and surrounding code when needed to understand behavior; test-quality findings belong to `agentic:skill:review-tests`.

## Inputs and scope

Use the accepted spec/plan and requirement IDs, changed files/diff, target revision, implementation log, and resolved applicable engineering skills. Load relevant language/framework rules directly, including their supporting files; an empty profile list does not make changed-language rules irrelevant. Reuse already loaded resources.

Inspect every changed implementation file in the assigned scope and trace relevant callers/dependencies. Record inspected files, files not inspected, unavailable checks, and uncertainty. Never approve unread scope. Review a fixed revision; if the target changes, identify the affected findings/checks as stale.

## Review lenses

1. **Requirement compliance:** map the requested behavior, exclusions, and acceptance criteria to implementation evidence. Distinguish satisfied, violated, and unverified criteria. Green tests alone do not prove compliance.
2. **Implementation quality:** check correctness, boundary/null/empty/error cases, propagation, maintainability, complexity, coupling, and consistency with applicable patterns.
3. **Effects and evolution:** where changed behavior warrants it, inspect concurrent updates, idempotency, cancellation/cleanup, retries after partial success, schema migrations and backward compatibility.
4. **Observability:** when service logging/tracing changes or a critical path needs instrumentation, apply `agentic:skill:write-instrumented-code`; inspect structured context and failure handling.

Follow explicit user instructions over existing conventions. Inspect actual repository patterns before flagging a mismatch. Clarify only a consequential unresolved ambiguity; an already authorized instruction/convention difference is not a new approval gate.

## Severity and evidence

| Severity | Meaning | Blocks readiness? |
|---|---|---|
| Blocker | Demonstrated incorrect required behavior, crash, or data-loss risk | Yes |
| Major | Consequential missing edge case, broken error handling, or pattern violation with concrete impact | Yes |
| Minor | Working code with style inconsistency, limited maintainability cost, or suboptimal approach | No |
| Nit | Cosmetic or naming preference | No |

Rate the actual consequence, not the strongest hypothetical. When borderline, prefer the lower severity and state uncertainty. A working pattern difference is Minor unless a consequential impact is evidenced; style preferences never block. Separate hypotheses from established findings, and describe the check that would resolve uncertainty. Every actionable finding needs a location, evidence, impact, and a concrete fix; avoid speculative requirements.

## Output

Write the caller's filename, otherwise `{output_path}/review-code-{iteration}.md` (scoped callers may use `review-code-{scope}-{iteration}.md`). Include:

1. **Summary:** target revision/scope, severity counts, completion status and verdict.
2. **Requirement compliance:** criterion → implementation evidence → satisfied/violated/unverified, separate from quality findings.
3. **Issues:** grouped Blocker → Nit, each with file/line, description, observed evidence versus hypothesis, impact, suggested fix, confidence, and related requirement IDs.
4. **Coverage and limitations:** inspected/uninspected files, checks actually run and their results, and unresolved uncertainty.
5. **Verdict:** `PASS` only for completed scope with no Blockers/Majors; `CHANGES_REQUESTED` for completed scope with either; `INCOMPLETE` when required inspection/evidence remains unavailable.

When the caller supplies `contract_path`, read that finding protocol and emit its required machine-readable sibling alongside this report. The review-loop owns aggregation, duplicate handling, repair and platform delivery; this lens returns findings and does not start a fix loop or post a review by itself.
