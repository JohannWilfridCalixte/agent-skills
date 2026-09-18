---
name: agentic:skill:review-security
description: Use when reviewing code for security vulnerabilities, auth/authz gaps, trust-boundary failures, or sensitive data handling.
---

# Review Security

Review the changed attack surface against its actual access and data contracts. Think through what an attacker can achieve; findings concern security, while general code quality belongs to `agentic:skill:review-code`. Assess compliance only against specified requirements, not an implied certification audit.

## Inputs and method

Use the fixed code revision/diff, security requirements and accepted architecture, relevant callers/configuration, dependency versions, and prior findings on re-review. Inspect every changed file in the assigned security scope and follow relevant data/control flow beyond the diff.

For each changed entry point, establish the intended caller, trust boundary, required authentication/authorization, input sources, sensitive operation, and attacker-controlled path. Publicly reachable does not mean authentication is required: an intentionally anonymous endpoint is not a missing-auth vulnerability. Protected tenant resources require authorization against the actual tenant/resource contract even after authentication succeeds.

## Review checklist

- **Input validation:** trace untrusted data into sensitive operations. Check type/shape, permitted values, size, canonicalization, and contextual encoding or parameterization as appropriate to the sink.
- **API security:** public and internal endpoints, trust between services, session management, authentication, authorization, tenant boundaries, privilege escalation and replay.
- **Injection:** SQL, XSS, SSRF, command injection, path traversal; determine whether escaping/validation at the relevant boundary prevents the actual exploit.
- **Data handling:** establish sensitivity before flagging; inspect exposure, credential/PII logs, access, storage and retention against the contract.
- **Configuration:** secrets, insecure defaults, required headers, cryptography and deployment-specific exposure.
- **Dependencies:** check the actual imported/locked version and relevant advisory evidence; distinguish an applicable vulnerability from an unverified advisory or unreachable usage.
- **Effectful flows:** where relevant, consider concurrent authorization changes, duplicate/replayed operations, idempotency, retry after partial success, cancellation, and backward-compatible security during migrations.

Never approve unvalidated attacker-controlled input reaching a sensitive operation without an effective boundary defense. Never downplay missing required auth/authz or broken access control. A generic validation layer is not a substitute for authorization or sink-specific protection.

## Severity and evidence

| Severity | Evidence and impact | Blocks readiness? |
|---|---|---|
| Blocker | Demonstrated exploitable vulnerability, missing required auth/authz, or sensitive data leak | Yes |
| Major | Weak auth/validation/control with a concrete consequential security gap, short of demonstrated Blocker impact | Yes |
| Minor | Non-exploitable defense-in-depth improvement or limited security weakness | No |
| Nit | Best-practice suggestion with no established risk | No |

Classify validation by trust contract, exploitability and impact, not merely “user-facing” versus “internal.” An exploitable internal command sink can be Blocker; a missing optional check with no exploitable path is Minor at most. If exploitability cannot be determined, state the uncertainty and missing evidence instead of claiming an exploit. Prefer the lower severity when evidence is borderline; uncertainty must not conceal a proven access-control defect.

Every finding includes relevant entry-to-operation, configuration, data-exposure or advisory evidence, attacker capability/preconditions, resulting impact, and specific remediation. Separate observed facts from hypotheses. Add OWASP category and CWE ID when applicable and supported. Explicit user requirements override conventions; clarify only consequential unresolved requirements, not already authorized choices.

## Output

Write the caller's filename, otherwise `{output_path}/review-security-{iteration}.md` (scoped callers may use `review-security-{scope}-{iteration}.md`). Include:

1. **Summary:** revision/scope, severity counts, completion status and verdict.
2. **Issues:** grouped by severity; file/line, vulnerability description, OWASP/CWE when applicable, evidence/preconditions, impact, concrete remediation, confidence and related requirement IDs.
3. **Coverage and limitations:** inspected/uninspected files, trust boundaries checked, advisory/tool evidence actually obtained, hypotheses and unknowns. Never approve code not read or imply unavailable checks passed.
4. **Verdict:** `PASS` for completed scope with no Blockers/Majors; `CHANGES_REQUESTED` for completed scope with either; otherwise `INCOMPLETE`, retaining established findings.

If the revision changes, mark affected evidence stale. When `contract_path` is supplied, read that protocol and emit its required JSON sibling. The caller owns aggregation, repair and external review posting; this lens returns its findings.
