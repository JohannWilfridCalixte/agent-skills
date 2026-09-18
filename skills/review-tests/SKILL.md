---
name: agentic:skill:review-tests
description: Use when reviewing test quality, coverage adequacy, or testing anti-patterns.
---

# Review Tests

Review what tests prove and what requested behavior remains untested. Findings concern test quality; read implementation/spec context to establish the contract, while implementation defects belong to `agentic:skill:review-code`.

**Required skill:** load `agentic:skill:code-testing` directly before reviewing, including applicable language rules. Use the local installed code-testing package; no external testing skill or persona is required.

## Inputs and inspection

Use accepted spec/plan requirements, implementation log, test files/diff, fixed target revision, and resolved engineering skills. Inspect every changed test file in the assigned scope; map each acceptance criterion/plan task to its actual assertions, not just a test name or passing command. Read relevant unchanged tests when coverage depends on them.

Record inspected/uninspected files and unavailable checks. Never approve unread scope or imply tests ran when they were only inspected. Separate observed failures from hypotheses and state the check needed to resolve uncertainty. Explicit user instructions override conventions; inspect existing patterns and clarify only consequential unresolved ambiguity.

## Quality checklist

| Pattern | What to inspect | Severity when established |
|---|---|---|
| The Liar | No meaningful assertion; passes when required behavior is broken | Blocker |
| Shared State | Results depend on order/parallel interference | Blocker |
| Brittle Test | Private implementation details or unnecessary exact structure | Major when strategy is fragile |
| Over-Mocking | Canned internal collaborators replace the behavior being tested | Major |
| Flaky Test | Uncontrolled time, races or arbitrary sleeps | Major when reliability is compromised |
| Test-to-Code Coupling | Breaks on valid refactors without behavioral change | Major |
| Giant Test | Unrelated behaviors make failures hard to diagnose | Minor |
| Missing Edge Cases | Required error/boundary behavior lacks evidence | Risk-based: Major on critical paths, Minor on low-risk paths |

An owned port fake for an isolated use case is a valid boundary; do not automatically flag it as internal over-mocking. A state-transition/protocol requirement may need multiple actions/assertions for one behavior. Setup size and sleep usage prompt inspection of the actual consequence rather than substituting for evidence.

Check FIRST isolation/determinism, public behavior, meaningful assertions, specification-like names, and appropriate unit/integration/E2E boundaries. For changed effects, inspect relevant concurrent-update, idempotency, retry-after-partial-success, cancellation/cleanup and compatibility tests. Verify a regression test fails for its intended defect, not a setup error.

## Severity and evidence

| Severity | Meaning | Blocks readiness? |
|---|---|---|
| Blocker | Test proves nothing or is fundamentally broken | Yes |
| Major | Coverage gap on critical behavior (for example auth denial), unreliable/fragile strategy | Yes |
| Minor | Missing low-risk edge case, incidental log-format coverage, style issue | No |
| Nit | Naming or minor structural preference | No |

Prefer the lower severity when borderline; explain concrete risk. Style never blocks. A green suite or 95% coverage does not excuse a missing acceptance criterion. Neither does a low global percentage alone establish a defect.

## Output

Write the caller's filename, otherwise `{output_path}/review-tests-{iteration}.md` (scoped callers may use `review-tests-{scope}-{iteration}.md`). Include:

1. **Summary:** revision/scope, severity counts, completion status and verdict.
2. **Coverage matrix:** requirement/plan-task ID → test file/line and assertion → covered/weak/missing. Record unavailable execution separately from missing tests; non-executable requirements need their actual verification evidence.
3. **Issues:** grouped by severity, with location, anti-pattern when applicable, evidence versus hypothesis, concrete impact, suggested fix, confidence and requirement IDs.
4. **Coverage and limitations:** inspected/uninspected files, commands/results actually observed, and unresolved uncertainty.
5. **Verdict:** `PASS` for complete inspection with no Blockers/Majors; `CHANGES_REQUESTED` for complete inspection with either; otherwise `INCOMPLETE` with findings retained.

When `contract_path` is supplied, read that protocol and emit its required JSON sibling. Aggregation, repair loops and review posting belong to the caller, not this lens.
