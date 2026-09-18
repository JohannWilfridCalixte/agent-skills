---
name: agentic:workflow:debug
description: Use when investigating bug reports, error logs, stack traces, failing CI, regressions, flaky tests, or unexpected runtime behavior.
argument-hint: "[<error.log | #issue | URL | error description>]"
---

# Debug

Establish evidence before changing code, reproduce the behavioral defect before fixing it, and verify the owned result. Required skills: `use-agentic`, `use-workflow`, `delegate-work`, `code-testing`, `review-loop`, `use-knowledge`.

Accept a file, issue reference/URL, inline report or adequate current conversation context; missing input yields usage and awaits the report. Initialize the run before writing `bug-report.md`; preserve source provenance and useful diagnostic detail while redacting secrets/personal values.

| Phase | Instructions |
|---|---|
| 1 | [Investigate](steps/step-01-investigate.md) |
| 2 | [Establish regression](steps/step-02-regression-test.md) |
| 3 | [Hypothesis/fix loop](steps/step-03-hypothesis-fix-loop.md) |
| 4 | [Verify and deliver](steps/step-04-verify.md) |

Delegate technical investigation, tests, hypotheses, fixes and reviews to native workers with selected skills and bounded source/report ownership. The parent alone changes shared state or Git. Preserve initial user changes and use immutable base/candidate snapshots; reverting an attempt restores only its owned patch. Debug delivers verified local changes by default; commits, issue closure, push and PR publication require explicit user authorization.

Keep the investigation/model-choice gates, reusing prior explicit answers. Keep one evidence-backed hypothesis and minimal fix at a time, behavioral red before fix, full-suite checks, rollback and escalation after three actually rejected bug hypotheses. Time pressure, an unrelated failing suite, or an exhausted review budget does not waive these gates. Exhaustion is evidence for human review, not a diagnosis of architectural failure.

Retrieve relevant knowledge before investigation and reconcile significant verified findings at completion. Start phase 1.
