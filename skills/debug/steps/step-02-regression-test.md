# Step 2: Regression Test

Delegate to a code-writing worker with selected skills, `code-testing`, [engineering guidance](../../delegate-work/references/engineering-contract.md), bug/investigation paths and an owned test scope. The worker writes a minimal behavioral regression test before any product fix, runs it on the baseline, and returns test path, command, expected assertion, actual output, baseline revision and what defect the failure demonstrates. Capture baseline full-suite status/failures as well for later attribution.

The parent validates **why** the test is red:

| Observation | Action |
|---|---|
| Expected behavioral assertion fails because of the reported defect | Accept regression evidence; proceed |
| Syntax/import/setup/environment error prevents reaching that assertion | Repair test/setup within scope and rerun; this is not a proved regression |
| Test passes | Investigate already-fixed, incorrect assumptions or intermittent/environmental reproduction; never introduce a fake failure |
| Reproduction remains unavailable | Record evidence/attempts and `blocked` with a concrete prerequisite; no product fix under this workflow |

Allow at most two bounded reproducer/setup refinements before blocked escalation for missing reproduction. These are not rejected bug hypotheses. Intermittent defects require recorded repeatable conditions and the specific behavioral failure; missing evidence stays unavailable rather than pretending a deterministic test was obtained. Non-test diagnosis may inform investigation, but does not silently bypass the failing-test gate.

Parent stores `debug.regression` with path, command, baseline revision, expected_failure, observed_failure, evidence_path and `status: failing_behavior | unavailable`. Store baseline checks as ordinary revision-bound check receipts. The initial red check has status failed, its actual exit code and `required: false`; the accepted reproduction gate explains why that expected failure is correct evidence. Preserve it as historical evidence, distinct from the final required green regression/full-suite receipts. Load step 3 only after failing_behavior is verified.
