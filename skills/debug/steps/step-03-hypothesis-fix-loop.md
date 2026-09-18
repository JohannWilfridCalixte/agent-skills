# Step 3: Hypothesis–Fix Loop

Budget: three **actually rejected bug hypotheses**, one hypothesis at a time. Each worker receives bug/investigation/regression paths, prior hypothesis history and an immutable baseline. Parent saves initial user work and owns rollback/integration; worker source writes are limited to the assigned fix/test paths.

Per attempt, delegate with code-writing role, selected skills and engineering guidance:

1. Form one statement: “The bug is caused by X because Y,” citing evidence.
2. Make one minimal change addressing that cause; avoid bundled improvements.
3. Run the behavioral regression, then the full suite on the exact candidate.
4. Return hypothesis, patch/changed paths, candidate identity, regression/full-suite command outputs and learning.

Append each attempt and result to `hypothesis-log.md`; retain its candidate and rollback evidence. `fix-log.md` summarizes the currently retained fix and links history rather than erasing rejected experiments.

## Evaluate every outcome

| Regression | Full suite | Next action |
|---|---|---|
| Expected behavioral failure persists and falsifies hypothesis | Any | Mark hypothesis rejected; parent restores only this attempt's owned patch; increment failed_hypotheses; retry if below 3 |
| Cannot execute / wrong failure | Any | Block on reproducer/environment evidence; not a rejected root-cause hypothesis |
| Green | Green | Record confirmed evidence and proceed to verification |
| Green | Red | Triage below; never claim success or consume a rejected-hypothesis count merely for this result |

For green/red, compare failing commands/output against the recorded baseline on equivalent environment and revisions. If the candidate introduced the failure, delegate one bounded repair within the existing owned scope, then rerun regression and full suite and review the resulting candidate. If still red, block verification. If demonstrably pre-existing/unrelated/environmental, preserve the regression-green fix, record the separate failure and follow-up, and block on the unmet full-suite prerequisite. Unknown attribution remains blocked for focused investigation. Do not silently repair outside scope or waive the suite. A user-authorized change to verification scope must be explicit and evidence-bound; it is not a green result for the original gate.

## State and escalation

Parent records `debug.hypothesis_loop`: attempt, failed_hypotheses, max_failed_hypotheses=3, status (`in_progress | confirmed | escalated | blocked`), and hypotheses with id, statement, evidence, result (`confirmed | rejected | inconclusive`), learning, snapshot and check IDs. Parent also stores `debug.full_suite_triage` when applicable. Review repair rounds and setup retries have separate counters.

On the third rejected bug hypothesis, restore its owned changes, write `escalation.md` containing rejected hypotheses, learnings, evidence, unknowns and options for human review. Set workflow status escalated, completed_at null, and halt automatic fix attempts. Do not infer an architectural cause from attempt count. Further attempts require an explicit revised approach/budget. On both tests green, update artifacts and load step 4.
